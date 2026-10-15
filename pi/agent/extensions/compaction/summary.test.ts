import { describe, expect, it } from "vitest";
import { MAX_TOPICS, parseCompactionSummary } from "./summary";

// The summary is the only thing that survives a compaction, so parsing is
// tested hard: it either returns something usable or nothing at all. A partial
// guess is worse than a failure record, because the failure record still points
// at the untouched transcript.
describe("parseCompactionSummary", () => {
	it("parses a bare JSON object", () => {
		const raw = '{"topics":["a","b"],"nextIntent":"do c","restore":"","fileNotes":[]}';
		const parts = parseCompactionSummary(raw);
		expect(parts?.topics).toEqual(["a", "b"]);
		expect(parts?.nextIntent).toBe("do c");
		expect(parts?.restore).toBe("");
	});

	it("parses JSON inside a markdown fence and ignores surrounding prose", () => {
		const raw = 'Sure:\n```json\n{"topics":["a"],"nextIntent":"c"}\n```\nDone.';
		expect(parseCompactionSummary(raw)?.topics).toEqual(["a"]);
	});

	it("keeps file notes in order and drops duplicates", () => {
		const raw = '{"topics":["a"],"fileNotes":[{"path":"b.ts","note":"n1"},{"path":"b.ts","note":"n2"},{"path":"c.ts"}]}';
		const parts = parseCompactionSummary(raw);
		expect(parts?.fileNotes).toEqual([
			{ path: "b.ts", note: "n1" },
			{ path: "c.ts", note: "" },
		]);
	});

	it(`caps topics at ${MAX_TOPICS}`, () => {
		const topics = Array.from({ length: 9 }, (_, i) => `t${i}`);
		expect(parseCompactionSummary(JSON.stringify({ topics }))?.topics).toHaveLength(MAX_TOPICS);
	});

	it("accepts an intent with no topics", () => {
		const parts = parseCompactionSummary('{"topics":[],"nextIntent":"just go"}');
		expect(parts?.topics).toEqual([]);
		expect(parts?.nextIntent).toBe("just go");
	});

	it("rejects file notes alone — echoing the given list is not an orientation", () => {
		expect(parseCompactionSummary('{"topics":[],"nextIntent":"","fileNotes":[{"path":"a"}]}')).toBeUndefined();
	});

	it("returns undefined for unparseable output", () => {
		expect(parseCompactionSummary("no json here")).toBeUndefined();
		expect(parseCompactionSummary("{ broken")).toBeUndefined();
		expect(parseCompactionSummary("[]")).toBeUndefined();
		expect(parseCompactionSummary("null")).toBeUndefined();
	});

	it("drops blank entries instead of emitting empty lines", () => {
		const parts = parseCompactionSummary('{"topics":["  ","keep"],"nextIntent":"  go  "}');
		expect(parts?.topics).toEqual(["keep"]);
		expect(parts?.nextIntent).toBe("go");
	});
});
