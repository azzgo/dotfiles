/**
 * ui.ts — sub-dispatch visual surfaces. All program-side (zero model tokens):
 *
 *   Dispatch Overview — persistent widget above the editor: one row per
 *                       running session (glyph · id · status · live elapsed ·
 *                       last output line); a settled row lingers
 *                       SETTLE_LINGER_MS then vanishes; hidden when empty.
 *   Output Peek       — read-only scrolling overlay over a session's output
 *                       buffer; auto-closes when a watched running session
 *                       settles. No input channel into the sub-agent.
 *   Dispatch Record   — compact one-line rendering of completion messages in
 *                       the transcript; full output tail only in expanded
 *                       (ctrl+o) mode.
 *
 * Output is captured by the program (stripTerminalSequences + \r final-frame)
 * — nothing here consults the model.
 */
import type { Component, TUI } from "@earendil-works/pi-tui";
import {
	matchesKey,
	Text,
	stripTerminalSequences,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import type {
	ExtensionUIContext,
	MessageRenderer,
	Theme,
	ThemeColor,
} from "@earendil-works/pi-coding-agent";

/* ── Session snapshot (view model shared by all surfaces) ────────────────── */

export type DispatchStatus = "running" | "done" | "error" | "killed" | "timeout";

export interface SessionSnapshot {
	id: string;
	agent: string;
	status: DispatchStatus;
	exitCode: number | null;
	startedAt: number;
	doneAt?: number;
	output: string;
}

/** How long a settled row lingers in the widget before disappearing. */
export const SETTLE_LINGER_MS = 5000;

/* ── Shared formatting ───────────────────────────────────────────────────── */

export function formatDurationMs(ms: number): string {
	const total = Math.max(0, Math.round(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const sec = total % 60;
	if (h > 0) return `${h}h ${m}m ${sec}s`;
	if (m > 0) return `${m}m ${sec}s`;
	return `${sec}s`;
}

export function statusSymbol(status: DispatchStatus): string {
	switch (status) {
		case "running":
			return "⏵";
		case "done":
			return "✓";
		case "error":
			return "✗";
		case "killed":
			return "⏹";
		case "timeout":
			return "⏱";
	}
}

function statusColor(status: DispatchStatus): ThemeColor {
	switch (status) {
		case "running":
			return "accent";
		case "done":
			return "success";
		case "error":
			return "error";
		case "killed":
		case "timeout":
			return "warning";
	}
}

function statusGlyph(status: DispatchStatus, theme: Theme): string {
	return theme.fg(statusColor(status), statusSymbol(status));
}

function statusWord(s: Pick<SessionSnapshot, "status" | "exitCode">): string {
	return s.status + (s.exitCode != null ? ` (exit ${s.exitCode})` : "");
}

/** Plain-text one-line summary for pickers/notifications (no ANSI). */
export function sessionSummary(s: SessionSnapshot, now: number): string {
	const durMs = (s.doneAt ?? now) - s.startedAt;
	return `${statusSymbol(s.status)} ${s.id} · ${statusWord(s)} · ${formatDurationMs(durMs)}`;
}

/* ── Output normalization (ANSI strip + \r final-frame) ──────────────────── */

export function normalizeOutputLines(output: string): string[] {
	const text = stripTerminalSequences(output.replace(/\r\n/g, "\n"));
	return text.split("\n").map((line) => (line.includes("\r") ? line.slice(line.lastIndexOf("\r") + 1) : line));
}

/** Last non-empty output line (the widget's live preview). */
export function lastOutputLine(output: string): string {
	const lines = normalizeOutputLines(output);
	for (let i = lines.length - 1; i >= 0; i--) {
		const trimmed = lines[i].trim();
		if (trimmed) return trimmed;
	}
	return "";
}

/* ── Dispatch Overview widget ─────────────────────────────────────────────── */

export interface DispatchWidgetHandle extends Component {
	/** Request a repaint (call on spawn/settle for immediate feedback). */
	refresh(): void;
	dispose(): void;
}

export function createDispatchWidget(tui: TUI, theme: Theme, getSnapshots: () => SessionSnapshot[]): DispatchWidgetHandle {
	// 1s repaint while rows are visible — drives the live elapsed tick and the
	// settle-linger countdown. Managed from render() so it self-heals.
	let repaintTimer: ReturnType<typeof setInterval> | null = null;
	const setTick = (active: boolean) => {
		if (active && !repaintTimer) repaintTimer = setInterval(() => tui.requestRender(), 1000);
		else if (!active && repaintTimer) {
			clearInterval(repaintTimer);
			repaintTimer = null;
		}
	};

	return {
		render(width: number): string[] {
			const now = Date.now();
			const snaps = getSnapshots();
			const running = snaps.filter((s) => s.status === "running").sort((a, b) => a.startedAt - b.startedAt);
			const settling = snaps
				.filter((s) => s.status !== "running" && s.doneAt != null && now - s.doneAt < SETTLE_LINGER_MS)
				.sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0));
			const rows = [...running, ...settling].map((s) => widgetRow(s, width, now, theme));
			setTick(rows.length > 0);
			return rows;
		},
		invalidate() {},
		refresh() {
			tui.requestRender();
		},
		dispose() {
			setTick(false);
		},
	};
}

function widgetRow(s: SessionSnapshot, width: number, now: number, theme: Theme): string {
	const durMs = (s.doneAt ?? now) - s.startedAt;
	const head =
		`${statusGlyph(s.status, theme)} ${s.id} ` +
		`· ${theme.fg(statusColor(s.status), statusWord(s))} ` +
		`· ${theme.fg("muted", formatDurationMs(durMs))}`;
	const preview = lastOutputLine(s.output);
	const sep = ` ${theme.fg("dim", "▏")} `;
	const avail = width - visibleWidth(head) - visibleWidth(sep);
	if (!preview || avail < 12) return truncateToWidth(head, width);
	return head + sep + theme.fg("dim", truncateToWidth(preview, avail));
}

/* ── Output Peek viewer (read-only overlay) ──────────────────────────────── */

export function openOutputPeek(opts: {
	ui: Pick<ExtensionUIContext, "custom">;
	/** Live snapshot lookup; returning undefined closes the viewer. */
	getSession: () => SessionSnapshot | undefined;
	/** Close automatically when the watched session settles (live peek). */
	autoClose: boolean;
}): Promise<void> {
	return opts.ui.custom<void>(
		(tui, theme, _keybindings, done) => {
			let closed = false;
			let followTail = true;
			let scrollTop = 0;
			let cache = { output: "", width: 0, lines: [] as string[] };
			let poll: ReturnType<typeof setInterval> | undefined;

			const finish = () => {
				if (closed) return;
				closed = true;
				if (poll) clearInterval(poll);
				done();
			};
			// Fixed-proportion peek window (~55% of the terminal, 8–30 rows) so
			// the overlay is a contained, centered dialog — not a full-screen wall.
			const bodyHeight = () => Math.max(8, Math.min(30, Math.floor(tui.terminal.rows * 0.55)));

			// Content/heartbeat poll: closes on settle (live peeks only), keeps
			// the header elapsed ticking, repaints as output streams in.
			poll = setInterval(() => {
				const s = opts.getSession();
				if (!s) {
					finish();
					return;
				}
				if (s.status !== "running" && opts.autoClose) {
					finish();
					return;
				}
				tui.requestRender();
			}, 250);

			return {
				render(width: number): string[] {
					const s = opts.getSession();
					if (!s) return [];
					// Full frame: 1-space padding between content and side borders.
					const inner = Math.max(10, width - 4);
					if (cache.output !== s.output || cache.width !== inner) {
						cache = {
							output: s.output,
							width: inner,
							lines: normalizeOutputLines(s.output).flatMap((l) => (l ? wrapTextWithAnsi(l, inner) : [""])),
						};
					}
					const bodyH = bodyHeight();
					const maxTop = Math.max(0, cache.lines.length - bodyH);
					const top = followTail ? maxTop : Math.max(0, Math.min(scrollTop, maxTop));
					const slice = cache.lines.slice(top, top + bodyH);
					const durMs = (s.doneAt ?? Date.now()) - s.startedAt;
					const header = truncateToWidth(
						`${statusGlyph(s.status, theme)} ${s.id} · ${theme.fg(statusColor(s.status), statusWord(s))} · ${theme.fg("muted", formatDurationMs(durMs))} · ${theme.fg("muted", `${cache.lines.length} lines`)}`,
						inner,
					);
					const footer = followTail
						? theme.fg("dim", "▏ following tail — ↑↓/PgUp/PgDn scroll · Home top · End retie · esc close")
						: theme.fg("dim", `▏ ${top + 1}–${top + slice.length}/${cache.lines.length} — End to follow tail · esc close`);
					const side = theme.fg("border", "│");
					const framed = (line: string) => {
						// │ + space + line + pad + │  → exactly `width` visible columns
						const pad = Math.max(0, width - 3 - visibleWidth(line));
						return `${side} ${line}${" ".repeat(pad)}${side}`;
					};
					return [
						theme.fg("border", `╭${"─".repeat(width - 2)}╮`),
						framed(""),
						framed(header),
						...slice.map(framed),
						framed(footer),
						framed(""),
						theme.fg("border", `╰${"─".repeat(width - 2)}╯`),
					];
				},
				handleInput(data: string) {
					if (closed) return;
					if (matchesKey(data, "escape") || data === "q") {
						finish();
						return;
					}
					const s = opts.getSession();
					if (!s) {
						finish();
						return;
					}
					const bodyH = bodyHeight();
					const maxTop = Math.max(0, cache.lines.length - bodyH);
					const current = followTail ? maxTop : Math.max(0, Math.min(scrollTop, maxTop));
					const page = Math.max(1, bodyH - 1);
					if (matchesKey(data, "up")) {
						followTail = false;
						scrollTop = Math.max(0, current - 1);
					} else if (matchesKey(data, "down")) {
						if (current + 1 >= maxTop) followTail = true;
						else {
							followTail = false;
							scrollTop = current + 1;
						}
					} else if (matchesKey(data, "pageUp")) {
						followTail = false;
						scrollTop = Math.max(0, current - page);
					} else if (matchesKey(data, "pageDown")) {
						if (current + page >= maxTop) followTail = true;
						else {
							followTail = false;
							scrollTop = current + page;
						}
					} else if (matchesKey(data, "home")) {
						followTail = false;
						scrollTop = 0;
					} else if (matchesKey(data, "end")) {
						followTail = true;
					} else {
						return;
					}
					tui.requestRender();
				},
				invalidate() {},
				dispose() {
					closed = true;
					if (poll) clearInterval(poll);
				},
			};
		},
		{
			overlay: true,
			// anchor defaults to "center"; with the fixed-proportion body the
			// dialog now has room to actually center in. margin keeps it clear
			// of the terminal edges; maxHeight is a safety clamp.
			overlayOptions: { width: "80%", maxHeight: "85%", margin: 2 },
		},
	);
}

/* ── Dispatch Record renderer (completion messages in the transcript) ────── */

export interface CompletionDetails {
	sessionId: string;
	agent: string;
	status: DispatchStatus;
	exitCode: number | null;
	durationMs: number;
}

export const renderDispatchRecord: MessageRenderer<CompletionDetails> = (message, options, theme) => {
	const content = typeof message.content === "string" ? message.content : "";
	const label = `${theme.fg("customMessageLabel", "sub-dispatch")} ${theme.fg("dim", "▏")} `;
	if (!options.expanded) {
		const d = message.details;
		let line: string;
		if (d?.sessionId && d?.status) {
			const bits = [`${statusGlyph(d.status, theme)} ${d.sessionId}`, theme.fg(statusColor(d.status), statusWord(d))];
			if (typeof d.durationMs === "number") bits.push(theme.fg("muted", formatDurationMs(d.durationMs)));
			line = bits.join(theme.fg("dim", " · "));
		} else {
			// Archival messages (pre-details): first content line is the summary.
			line = normalizeOutputLines(content).find((l) => l.trim()) ?? "done";
		}
		return new Text(label + line);
	}
	return new Text(label + (stripTerminalSequences(content).trim() || "(no output)"));
};
