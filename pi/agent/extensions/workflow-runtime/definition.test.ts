import { describe, expect, it } from "vitest";
import { extractSection, isKebabCase, parseDefinition } from "./definition";

const VALID = `---
name: bugfix
description: Fix a defect end to end
nodes:
  - id: intake
    title: Receive & triage the defect
    type: human
    suggest: [grill-with-docs]
  - id: locate
    title: Locate the root cause
    type: auto
    suggest: []
---
## intake
Brief prose: what this node is for.

done-when: repro or root-cause hypothesis is recorded.

## locate
Dispatch an explorer sub-agent.

done-when: root cause file:line identified.
`;

describe("parseDefinition", () => {
	it("parses the contract example", () => {
		const { definition, errors } = parseDefinition(VALID);
		expect(errors).toEqual([]);
		expect(definition!.name).toBe("bugfix");
		expect(definition!.description).toBe("Fix a defect end to end");
		expect(definition!.nodes).toHaveLength(2);
		const [intake, locate] = definition!.nodes;
		expect(intake!.id).toBe("intake");
		expect(intake!.type).toBe("human");
		expect(intake!.suggest).toEqual(["grill-with-docs"]);
		expect(locate!.type).toBe("auto");
		expect(locate!.suggest).toEqual([]);
		expect(locate!.doneWhen).toBe("root cause file:line identified.");
		expect(intake!.brief).toContain("Brief prose");
		expect(intake!.brief).not.toContain("done-when");
	});

	it("rejects a document without frontmatter", () => {
		const { errors } = parseDefinition("## intake\nhello");
		expect(errors.join(" ")).toMatch(/frontmatter/);
	});

	it("rejects missing name / description / nodes", () => {
		const doc = `---\nnodes: []\n---\n## a\nx\n\ndone-when: y`;
		const { errors } = parseDefinition(doc);
		expect(errors.join(" ")).toMatch(/'nodes:'/);
		expect(errors.join(" ")).toMatch(/missing 'name:'/);
		expect(errors.join(" ")).toMatch(/missing 'description:'/);
	});

	it("rejects zero nodes", () => {
		const doc = `---\nname: x\ndescription: d\nnodes:\n---\n`;
		const { errors } = parseDefinition(doc);
		expect(errors.join(" ")).toMatch(/at least one node/);
	});

	it("rejects duplicate node ids", () => {
		const doc = `---\nname: x\ndescription: d\nnodes:\n  - id: a\n    title: A\n    type: human\n    suggest: []\n  - id: a\n    title: A2\n    type: auto\n    suggest: []\n---\n## a\nx\n\ndone-when: y`;
		const { errors } = parseDefinition(doc);
		expect(errors.join(" ")).toMatch(/duplicate node id "a"/);
	});

	it("rejects invalid node types", () => {
		const doc = `---\nname: x\ndescription: d\nnodes:\n  - id: a\n    title: A\n    type: magic\n    suggest: []\n---\n## a\nx\n\ndone-when: y`;
		const { errors } = parseDefinition(doc);
		expect(errors.join(" ")).toMatch(/invalid type "magic"/);
	});

	it("rejects non-kebab-case ids", () => {
		const doc = `---\nname: x\ndescription: d\nnodes:\n  - id: Bad_Id\n    title: A\n    type: human\n    suggest: []\n---\n## Bad_Id\nx\n\ndone-when: y`;
		const { errors } = parseDefinition(doc);
		expect(errors.join(" ")).toMatch(/kebab-case/);
	});

	it("rejects unknown frontmatter and node keys", () => {
		const doc = `---\nname: x\ndescription: d\nbogus: 1\nnodes:\n  - id: a\n    title: A\n    type: human\n    weird: 1\n    suggest: []\n---\n## a\nx\n\ndone-when: y`;
		const { errors } = parseDefinition(doc);
		expect(errors.join(" ")).toMatch(/unknown frontmatter key "bogus"/);
		expect(errors.join(" ")).toMatch(/unknown node field "weird"/);
	});

	it("rejects a missing body section", () => {
		const doc = `---\nname: x\ndescription: d\nnodes:\n  - id: a\n    title: A\n    type: human\n    suggest: []\n---\nnothing here`;
		const { errors } = parseDefinition(doc);
		expect(errors.join(" ")).toMatch(/missing the '## a' section/);
	});

	it("rejects a section without done-when", () => {
		const doc = `---\nname: x\ndescription: d\nnodes:\n  - id: a\n    title: A\n    type: human\n    suggest: []\n---\n## a\nno criterion here`;
		const { errors } = parseDefinition(doc);
		expect(errors.join(" ")).toMatch(/missing a 'done-when:' line/);
	});

	it("collects ALL violations in one pass", () => {
		const doc = `---\ndescription: d\nnodes:\n  - id: a\n    title: A\n    type: alien\n---\n## a\nx`;
		const { errors } = parseDefinition(doc);
		expect(errors.length).toBeGreaterThanOrEqual(3);
	});
});

describe("helpers", () => {
	it("isKebabCase", () => {
		expect(isKebabCase("bug-fix-2")).toBe(true);
		expect(isKebabCase("Bug")).toBe(false);
		expect(isKebabCase("-x")).toBe(false);
		expect(isKebabCase("x-")).toBe(false);
	});

	it("extractSection stops at the next heading", () => {
		const body = "## a\none\n\n## b\ntwo";
		expect(extractSection(body, "a")).toBe("one");
		expect(extractSection(body, "b")).toBe("two");
		expect(extractSection(body, "c")).toBeUndefined();
	});
});
