/**
 * Command Palette — fuzzy finder over every slash command pi can invoke,
 * bound to a keyboard shortcut (registers no /command of its own).
 *
 * Entries come from:
 *   - pi.getCommands()  → extension commands, prompt templates, skill commands
 *     (skill names already carry the `skill:` prefix, so `/{name}` is directly
 *     invocable for every source)
 *   - a curated mirror of pi's built-in interactive commands (/model, /compact, …)
 *     — these are not exposed via getCommands() but DO work once submitted from
 *     the interactive composer, which is exactly this extension's output path.
 *
 * Selecting an entry inserts it at the FRONT of the composer; nothing is
 * executed:
 *   empty composer  →  "/cmd "
 *   has text        →  "/cmd " + existing text
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CommandPalette, type PaletteItem } from "./palette";

/** Activation key. Not bound to any pi default; adjust here if it clashes. */
const SHORTCUT = "alt+.";

/**
 * Mirror of pi's internal BUILTIN_SLASH_COMMANDS (dist/core/slash-commands.js,
 * pi 0.85.1). Not part of the public API, hence duplicated here — refresh when
 * upgrading pi. Failure mode is benign: a stale entry simply errors in the
 * composer like any unknown slash command.
 */
const BUILTIN_COMMANDS: ReadonlyArray<{
	name: string;
	description: string;
	argumentHint?: string;
}> = [
	{ name: "settings", description: "Open settings menu" },
	{ name: "model", description: "Select model (opens selector UI)", argumentHint: "<provider/model>" },
	{ name: "tree", description: "Navigate session tree (switch branches)" },
	{ name: "thinking", description: "Set thinking level", argumentHint: "<level>" },
	{ name: "scoped-models", description: "Enable/disable models for Ctrl+P cycling" },
	{ name: "export", description: "Export session (HTML default, or specify path: .html/.jsonl)" },
	{ name: "import", description: "Import and resume a session from a JSONL file" },
	{ name: "share", description: "Share session as a secret GitHub gist" },
	{ name: "copy", description: "Copy last agent message to clipboard" },
	{ name: "name", description: "Set session display name" },
	{ name: "session", description: "Show session info and stats" },
	{ name: "changelog", description: "Show changelog entries" },
	{ name: "hotkeys", description: "Show all keyboard shortcuts" },
	{ name: "fork", description: "Create a new fork from a previous user message" },
	{ name: "clone", description: "Duplicate the current session at the current position" },
	{ name: "trust", description: "Save project trust decision for future sessions" },
	{ name: "login", description: "Configure provider authentication", argumentHint: "<provider>" },
	{ name: "logout", description: "Remove provider authentication" },
	{ name: "new", description: "Start a new session" },
	{ name: "compact", description: "Manually compact the session context" },
	{ name: "resume", description: "Resume a different session" },
	{ name: "reload", description: "Reload keybindings, extensions, skills, prompts, themes, and context files" },
	{ name: "quit", description: "Quit pi" },
];

function collectItems(pi: ExtensionAPI): PaletteItem[] {
	const items: PaletteItem[] = [];
	for (const cmd of pi.getCommands()) {
		const invocable = `/${cmd.name}`;
		items.push({ value: invocable, label: invocable, description: cmd.description });
	}
	for (const b of BUILTIN_COMMANDS) {
		items.push({
			value: `/${b.name}`,
			label: `/${b.name}`,
			description: b.argumentHint ? `${b.description} (${b.argumentHint})` : b.description,
		});
	}
	return items;
}

export default function commandPaletteExtension(pi: ExtensionAPI): void {
	pi.registerShortcut(SHORTCUT, {
		description: "Command palette: fuzzy-pick a slash command into the composer",
		handler: async (ctx) => {
			if (ctx.mode !== "tui") return; // custom() UI is TUI-only

			const items = collectItems(pi);
			if (items.length === 0) {
				ctx.ui.notify("Command palette: no commands available", "warning");
				return;
			}

			const picked = await ctx.ui.custom<PaletteItem | null>(
				(tui, theme, _keybindings, done) => {
					const palette = new CommandPalette(tui, theme, items);
					palette.onDone = done;
					return palette;
				},
			);
			if (!picked) return;

			const prefix = `${picked.value} `;
			const existing = ctx.ui.getEditorText();
			ctx.ui.setEditorText(existing ? prefix + existing : prefix);
		},
	});
}
