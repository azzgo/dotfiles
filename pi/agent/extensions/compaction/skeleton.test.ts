import { describe, expect, it } from "vitest";

import { buildSkeleton, formatTimestamp, selectRequests } from "./skeleton";

describe("buildSkeleton", () => {
	it("keeps one line per message and drops system messages", () => {
		const skeleton = buildSkeleton([
			{ role: "system", content: [{ type: "text", text: "you are pi" }], timestamp: 1 },
			{ role: "user", content: [{ type: "text", text: "检查 report" }], timestamp: 2 },
			{ role: "assistant", content: [{ type: "text", text: "5 派 4 过" }], timestamp: 3 },
		]);

		expect(skeleton.lines).toHaveLength(2);
		expect(skeleton.lines[0]).toContain("user 检查 report");
		expect(skeleton.lines[1]).toContain("assistant 5 派 4 过");
	});

	it("collects user requests separately, oldest first", () => {
		const skeleton = buildSkeleton([
			{ role: "user", content: [{ type: "text", text: "第一个请求" }], timestamp: 1 },
			{ role: "assistant", content: [{ type: "text", text: "ok" }], timestamp: 2 },
			{ role: "user", content: [{ type: "text", text: "第二个请求" }], timestamp: 3 },
		]);

		expect(skeleton.requests.map((request) => request.text)).toEqual(["第一个请求", "第二个请求"]);
	});

	it("keeps error lines of a failing tool result and drops the rest", () => {
		const skeleton = buildSkeleton([
			{
				role: "toolResult",
				isError: true,
				content: [{ type: "text", text: "noise line\nerror: cannot find module\nmore noise" }],
				timestamp: 4,
			},
		]);

		expect(skeleton.lines[0]).toContain("✗ error: cannot find module");
		expect(skeleton.lines[0]).not.toContain("more noise");
	});

	it("keeps the first line of a successful tool result", () => {
		const skeleton = buildSkeleton([
			{ role: "toolResult", isError: false, content: [{ type: "text", text: "ok\nsecond line" }], timestamp: 5 },
		]);

		expect(skeleton.lines[0]).toContain("tool ok");
		expect(skeleton.lines[0]).not.toContain("second line");
	});

	it("marks assistant tool calls", () => {
		const skeleton = buildSkeleton([
			{
				role: "assistant",
				content: [{ type: "toolCall", name: "bash", arguments: { command: "ls" } }],
				timestamp: 6,
			},
		]);

		expect(skeleton.lines[0]).toContain("[tool] bash");
	});

	it("truncates long lines", () => {
		const skeleton = buildSkeleton([{ role: "user", content: [{ type: "text", text: "x".repeat(500) }], timestamp: 7 }], {
			textChars: 50,
		});

		expect(skeleton.lines[0].length).toBeLessThan(120);
	});
});

describe("selectRequests", () => {
	it("keeps the most recent requests", () => {
		const requests = [1, 2, 3, 4, 5, 6].map((n) => ({ text: `r${n}` }));
		expect(selectRequests(requests, 2).map((request) => request.text)).toEqual(["r5", "r6"]);
	});

	it("returns nothing for a non-positive limit", () => {
		expect(selectRequests([{ text: "r1" }], 0)).toEqual([]);
	});
});

describe("formatTimestamp", () => {
	it("formats a timestamp as MM-DD HH:MM", () => {
		const stamp = new Date(2026, 9, 22, 21, 7).getTime();
		expect(formatTimestamp(stamp)).toBe("10-22 21:07");
	});

	it("falls back to a placeholder", () => {
		expect(formatTimestamp(undefined)).toBe("--");
	});
});
