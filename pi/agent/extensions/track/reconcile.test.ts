import { describe, expect, it } from "vitest";
import { parseReconcileResult } from "./reconcile";

// The reconcile payload is the only place where a malformed model response can
// destroy recorded working memory, so parsing is tested hard: it must either
// return validated entries or nothing at all.
describe("parseReconcileResult", () => {
	it("parses a bare JSON object", () => {
		const result = parseReconcileResult('{"findings":[{"heading":"Notes","text":"a"}],"progress":[]}');
		expect(result?.entries).toEqual([{ file: "findings.md", heading: "Notes", text: "a" }]);
	});

	it("parses JSON inside a markdown fence and ignores surrounding prose", () => {
		const raw = 'Sure, here it is:\n```json\n{"progress":[{"heading":"Work Completed","text":"did x"}]}\n```\nDone.';
		const result = parseReconcileResult(raw);
		expect(result?.entries).toEqual([{ file: "progress.md", heading: "Work Completed", text: "did x" }]);
	});

	it("routes progress entries to progress.md", () => {
		const result = parseReconcileResult('{"progress":[{"heading":"Timeline","text":"t"}]}');
		expect(result?.entries[0]?.file).toBe("progress.md");
	});

	it("falls back to the last section on an unknown heading rather than dropping the entry", () => {
		const result = parseReconcileResult('{"findings":[{"heading":"Made Up Section","text":"keep me"}]}');
		expect(result?.entries[0]).toEqual({ file: "findings.md", heading: "Notes", text: "keep me" });
	});

	it("returns undefined for unparseable output (never a partial guess)", () => {
		expect(parseReconcileResult("no json here")).toBeUndefined();
		expect(parseReconcileResult("{ broken")).toBeUndefined();
		expect(parseReconcileResult("[]")).toBeUndefined();
	});

	it("returns undefined when every entry is empty", () => {
		expect(parseReconcileResult('{"findings":[{"heading":"Notes","text":"   "}],"progress":[]}')).toBeUndefined();
		expect(parseReconcileResult('{"findings":[],"progress":[]}')).toBeUndefined();
	});

	it("skips malformed entries but keeps the valid ones", () => {
		const raw = '{"findings":[{"heading":"Notes"},{"text":"survivor"},{"heading":"Notes","text":"also fine"}]}';
		const result = parseReconcileResult(raw);
		expect(result?.entries.map((e) => e.text)).toEqual(["survivor", "also fine"]);
	});

	it("restricts to the allowed files when asked", () => {
		const raw = '{"findings":[{"heading":"Notes","text":"f"}],"progress":[{"heading":"Timeline","text":"p"}]}';
		const result = parseReconcileResult(raw, ["progress.md"]);
		expect(result?.entries).toEqual([{ file: "progress.md", heading: "Timeline", text: "p" }]);
	});
});
