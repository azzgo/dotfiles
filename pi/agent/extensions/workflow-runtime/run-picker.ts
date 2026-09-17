/**
 * run-picker.ts — rich Run picker component for `/wf` / `/wf switch`.
 *
 * ctx.ui.select() has no custom-key support, so the picker is composed from
 * stock pi-tui primitives (SelectList + DynamicBorder + Text) and shown via
 * ctx.ui.custom(). Same selection semantics as the old select-based flow
 * (Esc = null, Enter = picked entry), plus ctrl+r: resolve the "✏️ rename"
 * entry of the currently highlighted run, without moving the selection.
 */
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, SelectList, Text, truncateToWidth, type Component, type TUI } from "@earendil-works/pi-tui";

/** Mirrors commands.ts PickEntry (kept structural to avoid an import cycle). */
export interface PickerEntry {
	label: string;
	kind: "run" | "rename" | "remove" | "header" | "plain";
	runId?: string;
}

export class RunPicker implements Component {
	private readonly tui: TUI;
	private readonly theme: Theme;
	private readonly byLabel = new Map<string, PickerEntry>();
	private readonly topBorder: Component;
	private readonly bottomBorder: Component;
	private readonly title: Text;
	private readonly help: Text;
	private readonly list: SelectList;

	/** Resolved once: the picked entry, or null on Esc. */
	onDone?: (entry: PickerEntry | null) => void;

	constructor(tui: TUI, theme: Theme, title: string, entries: PickerEntry[]) {
		this.tui = tui;
		this.theme = theme;
		for (const e of entries) this.byLabel.set(e.label, e);

		// headers stay in the list (selecting one is a noop) so the archived
		// section keeps its visible separator, matching the old select-based flow
		this.topBorder = new DynamicBorder((s) => theme.fg("accent", s));
		this.bottomBorder = new DynamicBorder((s) => theme.fg("accent", s));
		this.title = new Text(theme.fg("accent", theme.bold(title)), 1, 0);
		const renameable = entries.some((e) => e.runId);
		this.help = new Text(
			theme.fg("dim", `↑↓ navigate · enter select${renameable ? " · ctrl+r rename" : ""} · esc cancel`),
			1,
			0,
		);
		this.list = new SelectList(
			entries.map((e) => ({ value: e.label, label: e.label })),
			Math.max(1, Math.min(entries.length, 16)),
			{
				selectedPrefix: (t) => theme.fg("accent", t),
				selectedText: (t) => theme.fg("accent", t),
				description: (t) => theme.fg("muted", t),
				scrollInfo: (t) => theme.fg("dim", t),
				noMatch: (t) => theme.fg("warning", t),
			},
		);
		this.list.onSelect = (item) => this.resolve(this.byLabel.get(item.value) ?? null);
		this.list.onCancel = () => this.onDone?.(null);
	}

	handleInput(data: string): void {
		if (matchesKey(data, "ctrl+r")) {
			this.renameSelected();
		} else {
			this.list.handleInput(data);
		}
		this.tui.requestRender();
	}

	render(width: number): string[] {
		return [
			...this.topBorder.render(width),
			...this.title.render(width),
			...this.list.render(width),
			...this.help.render(width).map((l) => truncateToWidth(l, width)),
			...this.bottomBorder.render(width),
		];
	}

	invalidate(): void {
		this.topBorder.invalidate();
		this.bottomBorder.invalidate();
		this.title.invalidate();
		this.help.invalidate();
		this.list.invalidate();
	}

	private renameSelected(): void {
		const sel = this.list.getSelectedItem();
		if (!sel) return;
		const entry = this.byLabel.get(sel.value);
		if (!entry?.runId) return;
		// synthetic entry — no dedicated rename row is rendered; ctrl+r is the only trigger
		this.resolve({ label: `✏️ rename ${entry.runId}`, kind: "rename", runId: entry.runId });
	}

	private resolve(entry: PickerEntry | null): void {
		this.onDone?.(entry);
	}
}
