import { describe, expect, it } from "vitest";
import { collectFileOps, formatFileLists } from "./fileops";

const toolCall = (name: string, args: Record<string, unknown>) => ({ type: "toolCall", name, arguments: args });

describe("collectFileOps", () => {
	it("separates modified from read files", () => {
		const messages = [
			{ content: [toolCall("read", { path: "a.ts" }), toolCall("write", { path: "b.ts" })] },
		];
		expect(collectFileOps(messages)).toEqual({ read: ["a.ts"], modified: ["b.ts"] });
	});

	it("treats an edited file as modified, not read", () => {
		const messages = [{ content: [toolCall("read", { path: "a.ts" }), toolCall("edit", { path: "a.ts" })] }];
		expect(collectFileOps(messages)).toEqual({ read: [], modified: ["a.ts"] });
	});

	it("dedupes repeated touches and keeps first-seen order", () => {
		const messages = [
			{ content: [toolCall("read", { path: "b.ts" }), toolCall("read", { path: "a.ts" })] },
			{ content: [toolCall("read", { path: "b.ts" })] },
		];
		expect(collectFileOps(messages).read).toEqual(["b.ts", "a.ts"]);
	});

	it("picks up calls nested in a tool result (codemode scripts)", () => {
		const messages = [
			{
				role: "toolResult",
				toolResult: { nestedCalls: [toolCall("write", { path: "gen.ts" })] },
			},
		];
		expect(collectFileOps(messages).modified).toEqual(["gen.ts"]);
	});

	it("ignores tools without a path argument", () => {
		const messages = [{ content: [toolCall("bash", { command: "ls" }), toolCall("grep", { pattern: "x" })] }];
		expect(collectFileOps(messages)).toEqual({ read: [], modified: [] });
	});

	it("survives malformed messages", () => {
		expect(collectFileOps([null, 42, { content: "nope" }, { content: [null, 7] }])).toEqual({ read: [], modified: [] });
	});

	it("renders empty sections as empty strings", () => {
		expect(formatFileLists({ read: [], modified: ["a.ts"] })).toEqual({ read: "", modified: "a.ts" });
	});
});
