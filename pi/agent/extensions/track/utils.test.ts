import { describe, expect, it } from "vitest";
import { appendBulletToHeading, tailLines, truncate } from "./utils";

describe("tailLines / truncate", () => {
	it("tailLines keeps only non-empty lines, last N", () => {
		expect(tailLines("a\n\nb\nc\n\n", 2)).toBe("b\nc");
	});

	it("truncate passes short text through and marks long text", () => {
		expect(truncate("short", 10)).toBe("short");
		expect(truncate("x".repeat(20), 10)).toBe(`${"x".repeat(10)}\n...[truncated]`);
	});
});

describe("appendBulletToHeading", () => {
	it("replaces the initial [empty] placeholder", () => {
		const md = "## Timeline\n- [empty]";
		const next = appendBulletToHeading(md, "Timeline", "first");
		expect(next).not.toContain("[empty]");
		expect(next).toContain("- first");
	});

	it("appends after existing bullets within the section only", () => {
		const md = "## Timeline\n- one\n\n## Other\n- keep";
		const next = appendBulletToHeading(md, "Timeline", "two");
		expect(next).toContain("- one\n- two");
		expect(next).toContain("## Other\n- keep");
	});

	it("creates the heading when missing", () => {
		const next = appendBulletToHeading("## Existing\n- x", "Fresh", "y");
		expect(next).toContain("## Fresh\n- y");
	});
});
