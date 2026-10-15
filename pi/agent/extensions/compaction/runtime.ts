import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { buildCompactionSummary } from "./compaction";

export default function compactionExtension(pi: ExtensionAPI): void {
	// Compaction Summary as pointer (docs/adr/0015-compaction-summary-as-pointer.md).
	//
	// The summary is an orientation plus a retrieval handle, so Pi's built-in
	// summarizer never runs. buildCompactionSummary never throws and never returns
	// undefined: Pi's ExtensionRunner.emit() swallows handler exceptions and
	// treats the resulting undefined exactly like "no extension result", which
	// would silently reinstate built-in summarization. Failures are therefore
	// recorded in-band by the returned summary instead, pointing at the transcript.
	pi.on("session_before_compact", async (event, ctx) => {
		return buildCompactionSummary(event, ctx);
	});
}
