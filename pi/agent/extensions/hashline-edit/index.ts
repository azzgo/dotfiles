/**
 * hashline-edit (lite) — content-hash-anchored read/edit for pi-coding-agent.
 *
 * Replaces the built-in read/edit tools with hashline-anchored versions:
 * - read returns lines as "LINE#HASH:content"
 * - edit uses those hashes as anchors for precise, stale-resistant edits
 *
 * Adapted from pi-hashline-edit (MIT, github.com/RimuruW/pi-hashline-edit).
 * Lite version: MD5 hash (node:crypto, zero external deps), hardcoded hash
 * length 2, replace + replace_text ops only, no grep, no 3-way merge.
 *
 * Reference source: /Users/ison/dev/sources/pi-hashline-edit
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerReadTool } from "./read";
import { registerEditTool } from "./edit";
import { SESSION_PROTOCOL_NOTICE } from "./prompt";

export default function hashlineEdit(pi: ExtensionAPI): void {
	registerReadTool(pi);
	registerEditTool(pi);

	// Inject a brief protocol notice on session start so the model knows
	// hashline mode is active before it processes tool definitions.
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.notify("Hashline Edit (lite) mode active", "info");
	});

	// Inject protocol context at the start of each agent turn.
	pi.on("before_agent_start", async () => {
		return {
			message: {
				customType: "hashline-edit-protocol",
				content: SESSION_PROTOCOL_NOTICE,
				display: false,
			},
		};
	});
}
