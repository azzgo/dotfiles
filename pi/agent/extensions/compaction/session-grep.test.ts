import { describe, expect, it } from "vitest";

import { formatHits, grepSessionJsonl } from "./session-grep";

function line(entry: unknown): string {
	return JSON.stringify(entry);
}

const TRANSCRIPT = [
	line({ type: "message", timestamp: "2026-10-22T21:03:00.000Z", message: { role: "user", content: [{ type: "text", text: "检查 report" }] } }),
	line({ type: "message", timestamp: "2026-10-22T21:04:00.000Z", message: { role: "assistant", content: [{ type: "text", text: "report: 5 派 4 过" }] } }),
	line({ type: "message", timestamp: "2026-10-22T21:05:00.000Z", message: { role: "toolResult", content: [{ type: "text", text: "error: nope" }] } }),
	line({ type: "compaction", timestamp: "2026-10-22T21:06:00.000Z", summary: "report 里说了什么" }),
	"not json at all",
];

describe("grepSessionJsonl", () => {
	it("finds matching messages with role and timestamp", () => {
		const hits = grepSessionJsonl(TRANSCRIPT, { query: "report" });
		expect(hits).toHaveLength(2);
		expect(hits[0]).toMatchObject({ role: "user", timestamp: "2026-10-22T21:03:00.000Z" });
		expect(hits[0].excerpt).toContain("检查 report");
	});

	it("filters by role", () => {
		const hits = grepSessionJsonl(TRANSCRIPT, { query: "report", role: "user" });
		expect(hits).toHaveLength(1);
		expect(hits[0].role).toBe("user");
	});

	it("filters by time range", () => {
		const hits = grepSessionJsonl(TRANSCRIPT, {
			query: "report",
			since: "2026-10-22T21:04:00.000Z",
		});
		expect(hits).toHaveLength(1);
		expect(hits[0].role).toBe("assistant");
	});

	it("treats an invalid regex as a literal", () => {
		const hits = grepSessionJsonl(TRANSCRIPT, { query: "5 派 (" });
		expect(hits).toHaveLength(0);
	});

	it("honours the limit", () => {
		const hits = grepSessionJsonl(TRANSCRIPT, { query: "report", limit: 1 });
		expect(hits).toHaveLength(1);
	});

	it("never matches non-message entries", () => {
		expect(grepSessionJsonl(TRANSCRIPT, { query: "旧记录" })).toHaveLength(0);
	});
});

describe("formatHits", () => {
	it("renders a readable list", () => {
		const hits = grepSessionJsonl(TRANSCRIPT, { query: "report" });
		expect(formatHits(hits)).toContain("[2026-10-22T21:03:00.000Z] user");
	});

	it("says so when nothing matched", () => {
		expect(formatHits([])).toBe("(no matches)");
	});
});
