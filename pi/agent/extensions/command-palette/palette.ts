/**
 * palette.ts — fuzzy command palette component.
 *
 * Composed from stock primitives: pi-tui `Input` (filter query) + `SelectList`
 * (result list) + `fuzzyFilter` (ranking over label and description). The
 * palette temporarily replaces the composer via ctx.ui.custom(); typing
 * refilters, up/down moves the selection, Enter/Tab confirm, Esc cancels.
 *
 * Rendering is hand-composed (no Container) so the list can be swapped for a
 * fresh SelectList whenever the query changes — SelectList only supports
 * prefix filtering via setFilter, we need fuzzy.
 */
import {
	fuzzyFilter,
	Input,
	matchesKey,
	Key,
	SelectList,
	Text,
	truncateToWidth,
	type Component,
	type Focusable,
	type TUI,
} from "@earendil-works/pi-tui";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";

/** One selectable entry: `value` is the literal slash text inserted into the composer. */
export interface PaletteItem {
	value: string;
	label: string;
	description?: string;
}

/** Max rows shown in the result list before scrolling. */
export const MAX_VISIBLE = 12;

export class CommandPalette implements Component, Focusable {
	private readonly tui: TUI;
	private readonly theme: Theme;
	private readonly items: PaletteItem[];
	private filtered: PaletteItem[];
	private selected = 0;

	private readonly topBorder: Component;
	private readonly bottomBorder: Component;
	private readonly title: Text;
	private readonly help: Text;
	private readonly input: Input;
	private list: SelectList;

	/** Resolved once when the user confirms or cancels. */
	onDone?: (item: PaletteItem | null) => void;

	constructor(tui: TUI, theme: Theme, items: PaletteItem[]) {
		this.tui = tui;
		this.theme = theme;
		this.items = items;
		this.filtered = items;

		this.topBorder = new DynamicBorder((s: string) => theme.fg("accent", s));
		this.bottomBorder = new DynamicBorder((s: string) => theme.fg("accent", s));
		this.title = new Text("", 1, 0);
		this.help = new Text("", 1, 0);
		this.input = new Input({
			placeholder: "type to filter…",
			placeholderStyle: (t: string) => theme.fg("dim", t),
		});
		this.list = this.makeList(items);

		this.input.onSubmit = () => this.confirm();
		this.input.onEscape = () => this.onDone?.(null);

		this.rebakeTexts();
	}

	/* ── Focusable — propagate to the embedded Input so IME cursor positioning works ── */

	private _focused = false;
	get focused(): boolean {
		return this._focused;
	}
	set focused(value: boolean) {
		this._focused = value;
		this.input.focused = value;
	}

	/* ── Component ── */

	handleInput(data: string): void {
		if (matchesKey(data, Key.up) || matchesKey(data, "ctrl+p")) {
			this.move(-1);
		} else if (matchesKey(data, Key.down) || matchesKey(data, "ctrl+n")) {
			this.move(1);
		} else if (matchesKey(data, Key.pageUp)) {
			this.page(-1);
		} else if (matchesKey(data, Key.pageDown)) {
			this.page(1);
		} else if (matchesKey(data, Key.tab)) {
			this.confirm();
		} else {
			const before = this.input.getValue();
			this.input.handleInput(data);
			const after = this.input.getValue();
			if (after !== before) this.refilter(after);
		}
		this.tui.requestRender();
	}

	render(width: number): string[] {
		const lines: string[] = [];
		lines.push(...this.topBorder.render(width));
		lines.push(...this.title.render(width));
		for (const line of this.input.render(width - 2)) {
			lines.push(truncateToWidth(` ${line}`, width));
		}
		lines.push(...this.list.render(width));
		lines.push(...this.help.render(width));
		lines.push(...this.bottomBorder.render(width));
		return lines;
	}

	invalidate(): void {
		this.topBorder.invalidate();
		this.bottomBorder.invalidate();
		this.title.invalidate();
		this.help.invalidate();
		this.input.invalidate();
		this.list.invalidate();
		this.rebakeTexts(); // title/help bake theme colors — rebuild on theme change
	}

	/* ── internals ── */

	private makeList(items: PaletteItem[]): SelectList {
		return new SelectList(
			items.map((it) => ({ value: it.value, label: it.label, description: it.description })),
			Math.max(1, Math.min(items.length, MAX_VISIBLE)),
			{
				selectedPrefix: (t) => this.theme.fg("accent", t),
				selectedText: (t) => this.theme.fg("accent", t),
				description: (t) => this.theme.fg("muted", t),
				scrollInfo: (t) => this.theme.fg("dim", t),
				noMatch: (t) => this.theme.fg("warning", t),
			},
		);
	}

	private rebakeTexts(): void {
		const total = this.items.length;
		const scope =
			this.filtered.length === total ? `${total}` : `${this.filtered.length}/${total}`;
		this.title.setText(
			this.theme.fg("accent", this.theme.bold("Commands")) +
				this.theme.fg("dim", `  ${scope}`),
		);
		this.help.setText(
			this.theme.fg(
				"dim",
				"↑↓/ctrl+n·p navigate · pgup/pgdn page · enter/tab insert · esc cancel",
			),
		);
	}

	private refilter(query: string): void {
		this.filtered = fuzzyFilter(
			this.items,
			query,
			(it) => `${it.label} ${it.description ?? ""}`,
		);
		this.selected = 0;
		this.list = this.makeList(this.filtered);
		this.rebakeTexts();
	}

	private move(delta: number): void {
		if (this.filtered.length === 0) return;
		this.selected = Math.min(Math.max(this.selected + delta, 0), this.filtered.length - 1);
		this.list.setSelectedIndex(this.selected);
	}

	private page(delta: number): void {
		this.move(delta * MAX_VISIBLE);
	}

	private confirm(): void {
		const item = this.filtered[this.selected];
		if (item) this.onDone?.(item);
	}
}
