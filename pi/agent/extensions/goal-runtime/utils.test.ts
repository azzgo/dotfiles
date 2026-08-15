import { describe, expect, it } from "vitest";
import {
	appendBulletToHeading,
	extractSection,
	firstMeaningfulLine,
	readFrontmatterString,
	readFrontmatterStringArray,
	splitFrontmatter,
	tailLines,
	truncate,
	upsertBodySection,
	writeFrontmatterFields,
} from "./utils";

describe("extractSection", () => {
	const body = "## Objective\nDo the thing.\n\n## Constraints\n- fast\n- safe\n\n## Notes\nstuff";

	it("extracts a section up to the next ## heading", () => {
		expect(extractSection(body, "Objective")).toBe("Do the thing.");
		expect(extractSection(body, "Constraints")).toBe("- fast\n- safe");
		expect(extractSection(body, "Notes")).toBe("stuff");
	});

	it("returns undefined for missing sections", () => {
		expect(extractSection(body, "Missing")).toBeUndefined();
	});

	it("escapes regex metacharacters in the heading", () => {
		expect(extractSection("## Out of Scope (v2)\nnothing", "Out of Scope (v2)")).toBe("nothing");
	});
});

describe("firstMeaningfulLine", () => {
	it("skips blanks and strips bullet markers", () => {
		expect(firstMeaningfulLine("\n\n- objective text\n- second")).toBe("objective text");
	});

	it("returns undefined for empty input", () => {
		expect(firstMeaningfulLine(undefined)).toBeUndefined();
		expect(firstMeaningfulLine("")).toBeUndefined();
	});
});

describe("tailLines / truncate", () => {
	it("tailLines keeps only non-empty lines, last N", () => {
		expect(tailLines("a\n\nb\nc\n\n", 2)).toBe("b\nc");
	});

	it("truncate passes short text through and marks long text", () => {
		expect(truncate("short", 10)).toBe("short");
		expect(truncate("x".repeat(20), 10)).toBe(`${"x".repeat(10)}\n...[truncated]`);
	});
});

describe("splitFrontmatter / frontmatter round-trip", () => {
	const doc = "---\nid: \"001\"\nphase: active\nopen_questions: [\"a?\", \"b?\"]\n---\n## Objective\nhello";

	it("splits frontmatter from body", () => {
		const { frontmatter, body } = splitFrontmatter(doc);
		expect(frontmatter).toContain("phase: active");
		expect(body.startsWith("## Objective")).toBe(true);
	});

	it("handles documents without frontmatter", () => {
		const { frontmatter, body } = splitFrontmatter("## Just body");
		expect(frontmatter).toBe("");
		expect(body).toBe("## Just body");
	});

	it("reads scalar fields in quoted and bare forms", () => {
		expect(readFrontmatterString(doc, "id")).toBe("001");
		expect(readFrontmatterString(doc, "phase")).toBe("active");
		expect(readFrontmatterString(doc, "missing")).toBeUndefined();
	});

	it("reads JSON-ish array fields", () => {
		expect(readFrontmatterStringArray(doc, "open_questions")).toEqual(["a?", "b?"]);
		expect(readFrontmatterStringArray(doc, "missing")).toEqual([]);
	});

	it("writeFrontmatterFields round-trips scalars and arrays, preserving the body", () => {
		const next = writeFrontmatterFields(doc, {
			phase: "ready",
			open_questions: ["c?"],
		});
		expect(readFrontmatterString(next, "phase")).toBe("ready");
		expect(readFrontmatterStringArray(next, "open_questions")).toEqual(["c?"]);
		expect(readFrontmatterString(next, "id")).toBe("001"); // untouched field preserved
		expect(next).toContain("## Objective\nhello"); // body preserved
	});

	it("writeFrontmatterFields appends new fields and JSON-quotes values with special chars", () => {
		const next = writeFrontmatterFields(doc, { source_topic: "why: not this?" });
		expect(readFrontmatterString(next, "source_topic")).toBe("why: not this?");
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

describe("upsertBodySection", () => {
	it("replaces an existing section with bullet lines", () => {
		const body = "## Objective\nold\n\n## Constraints\n- [empty]";
		const next = upsertBodySection(body, "Objective", ["new objective"]);
		expect(next).toContain("## Objective\nnew objective");
		expect(next).toContain("## Constraints"); // sibling preserved
	});

	it("writes - [empty] for empty arrays", () => {
		const next = upsertBodySection("## Objective\nx", "Out of Scope", []);
		expect(next).toContain("## Out of Scope\n- [empty]");
	});

	it("appends the section when missing", () => {
		const next = upsertBodySection("## Objective\nx", "Blocker Rule", ["ask the user"]);
		expect(next.endsWith("## Blocker Rule\nask the user\n")).toBe(true);
	});
});
