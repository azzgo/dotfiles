import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { MESSAGE_TYPE_TRACK_CONTEXT, MESSAGE_TYPE_TRACK_STATUS, MESSAGE_TYPE_TRACK_UPDATE, WIDGET_KEY } from "./types";
import type { TrackSnapshot } from "./types";
import { trackDir } from "./utils";
import { initTrack, readTrack } from "./track";
import { buildTrackContextPrompt, buildTrackStatusText, buildTrackUpdatePrompt } from "./prompts";
import { buildWidgetLines } from "./ui";

const TRACK_HELP = [
	"/track — flat working memory (findings.md + progress.md at .pi/track/; auto-initialized once when missing, otherwise fully manual)",
	"  /track new                 reset/init the scratchpad",
	"  /track update              reconcile track with current state, then STOP (checkpoint before ending the session; auto-continue is suppressed)",
	"  /track context             inject track context (findings/progress tails) as a user message; continue only when the user stated an explicit next step",
	"  /track status              report track state (no mutation)",
].join("\n");

export default function trackExtension(pi: ExtensionAPI): void {
	function getSnapshot(cwd: string, resumedFromPreviousSession = false): TrackSnapshot {
		return {
			cwd,
			trackDir: trackDir(cwd),
			track: readTrack(cwd),
			resumedFromPreviousSession,
		};
	}

	let snapshot = getSnapshot(process.cwd());
	/**
	 * The turn triggered by `/track update` is a checkpoint: it flushes working
	 * memory to disk so the user can end the session (low context, handoff), NOT a
	 * sign to keep driving. Auto-continuation is suppressed for exactly that turn —
	 * see turn_end. Set in the /track update command handler and consumed (reset)
	 * in turn_end; NOT reset in turn_start (the flag must survive until the turn it
	 * marks completes).
	 */
	let suppressContinuationThisTurn = false;

	// ---- refresh ----

	function refresh(ctx?: ExtensionContext, resumedFromPreviousSession = snapshot.resumedFromPreviousSession): void {
		snapshot = getSnapshot(ctx?.cwd ?? process.cwd(), resumedFromPreviousSession);
		if (!ctx?.hasUI) return;
		const widgetLines = buildWidgetLines(snapshot);
		if (widgetLines) ctx.ui.setWidget(WIDGET_KEY, widgetLines, { placement: "aboveEditor" });
	}

	function send(content: string, customType: string): void {
		pi.sendMessage({ customType, content, display: false }, { triggerTurn: true });
	}

	// ---- commands ----

	pi.registerCommand("track", {
		description: "Track: flat working memory (.pi/track/findings.md + progress.md). Commands: new / update / context / status.",
		handler: async (args, ctx) => {
			refresh(ctx, false);
			const [sub] = args.trim().split(/\s+/);
			switch (sub ?? "") {
				case "":
				case "status":
					send(buildTrackStatusText(snapshot), MESSAGE_TYPE_TRACK_STATUS);
					break;
				case "new":
					initTrack(ctx.cwd);
					refresh(ctx, false);
					ctx.ui.notify("Track reset: .pi/track/findings.md + progress.md initialized fresh.", "info");
					break;
				case "update":
					// /track update is a session checkpoint (flush state before a fresh
					// session / handoff). The reconciliation turn writes the track files
					// and then STOPS — this flag suppresses any auto-continuation for
					// exactly that turn. Gate the turn that follows this command.
					suppressContinuationThisTurn = true;
					send(buildTrackUpdatePrompt(snapshot), MESSAGE_TYPE_TRACK_UPDATE);
					break;
				case "context":
					send(buildTrackContextPrompt(snapshot), MESSAGE_TYPE_TRACK_CONTEXT);
					break;
				case "help":
					ctx.ui.notify(TRACK_HELP, "info");
					break;
				default:
					ctx.ui.notify(`Unknown /track subcommand "${sub}".\n\n${TRACK_HELP}`, "warning");
					break;
			}
		},
	});

	// ---- events ----

	pi.on("session_start", async (event, ctx) => {
		const resumed = event.reason === "resume" || event.reason === "fork";
		refresh(ctx, resumed);
		const label = resumed ? "Track resumed." : `Track attached (${".pi/track"}).`;
		ctx.ui.notify(label, "info");
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		refresh(ctx, snapshot.resumedFromPreviousSession);
		// Auto /track new only: at the FIRST conversation of a session the extension
		// initializes Track when missing, so working memory exists on disk. Nothing
		// is auto-injected into the conversation — the model gets Track context
		// only when the user runs `/track context`, and reconciliation only via
		// `/track update`.
		if (snapshot.track.exists) return;
		initTrack(ctx.cwd);
		refresh(ctx, snapshot.resumedFromPreviousSession);
		ctx.ui.notify("Track initialized: .pi/track/findings.md + progress.md (auto /track new).", "info");
	});

	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName === "write" || event.toolName === "edit") {
			refresh(ctx, false);
		}
	});

	pi.on("turn_end", async () => {
		refresh();
		// /track update is a checkpoint turn: stop after reconciliation and wait
		// for the user (typically the context window is nearly full and the user
		// wants to resume in a fresh session via /track context). No auto-continue.
		if (suppressContinuationThisTurn) {
			suppressContinuationThisTurn = false;
		}
	});
}
