import { afterEach, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

import type { SessionEntry } from "@earendil-works/pi-coding-agent";

/**
 * Integration tests for the Compaction Summary path (ADR 0015, refined by ADR 0020).
 *
 * These exercise the real `buildCompactionSummary`, so the Pi runtime values it
 * imports are stubbed via a loader hook (pattern from ../../xfer/commands.test.ts).
 * The behaviour under test is the failure accounting: Pi swallows extension
 * exceptions and treats a bare `undefined` result as "no extension result",
 * which silently reinstates built-in summarization. So the contract is that
 * this function ALWAYS returns a `compaction` and never throws.
 *
 * Requires the Pi runtime to be resolvable — true wherever the extension is
 * actually installed. When it is not, the suite skips instead of failing:
 * the pure suites still cover the rest.
 */

let buildCompactionSummary: typeof import("./compaction").buildCompactionSummary;

/**
 * Locate pi-ai's entry module without hardcoding a machine-specific install path.
 * pi-ai's `exports` map blocks `package.json` and deep specifiers, so read the
 * manifest off disk. `node_modules` is populated by `just install-pi` on a
 * machine where the extension is installed; when it is absent the suite skips.
 */
function resolvePiAi(): string | undefined {
	const manifest = path.join(import.meta.dirname, "node_modules/@earendil-works/pi-ai/package.json");
	if (!fs.existsSync(manifest)) return undefined;
	try {
		const pkg = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
			main?: string;
			exports?: Record<string, { import?: string }>;
		};
		const entry = pkg.exports?.["."]?.import ?? pkg.main;
		if (!entry) return undefined;
		const resolved = path.join(path.dirname(manifest), entry);
		return fs.existsSync(resolved) ? resolved : undefined;
	} catch {
		return undefined;
	}
}

const piAiPath = resolvePiAi();

beforeAll(async () => {
	if (!piAiPath) return;
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "track-compaction-stub-"));
	const stubPath = path.join(tmpDir, "pi-ai-stub.mjs");
	// Re-export the real pi-ai and override only uuidv7: pi-coding-agent imports
	// a large surface of this module, so a hand-written stub is a losing game.
	fs.writeFileSync(
		stubPath,
		[
			`export * from ${JSON.stringify(pathToFileURL(piAiPath).href)};`,
			"export function uuidv7() { return 'test-uuid'; }",
		].join("\n"),
		"utf8",
	);
	const stubUrl = pathToFileURL(stubPath).href;
	registerHooks({
		resolve(specifier, context, nextResolve) {
			if (specifier === "@earendil-works/pi-ai") return { url: stubUrl, shortCircuit: true };
			return nextResolve(specifier, context);
		},
	});
	({ buildCompactionSummary } = await import("./compaction.js"));
});

const tmpDirs: string[] = [];

function tmpCwd(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "track-compaction-"));
	tmpDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
	delete process.env.PI_COMPACTION_CONFIG;
});

const SESSION_FILE = "/tmp/pi-sessions/session.jsonl";

function makeCtx(
	cwd: string,
	complete: (model: unknown, req: unknown, opts: unknown) => Promise<unknown>,
	find: (provider: string, modelId: string) => unknown = () => undefined,
) {
	return {
		cwd,
		hasUI: true,
		model: { id: "stub", provider: "stub" },
		modelRegistry: { complete, find, getAvailable: () => [] },
		sessionManager: { getSessionFile: () => SESSION_FILE },
		ui: { notify: () => {} },
		getContextUsage: () => undefined,
	} as never;
}

const textResponse = (text: string) => ({ content: [{ type: "text", text }], usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, totalTokens: 15, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } });

function prep() {
	return {
		messagesToSummarize: [
			{ role: "user", content: [{ type: "text", text: "earlier work" }], timestamp: 1 },
			{ role: "assistant", content: [{ type: "toolCall", name: "write", arguments: { path: "src/a.ts" } }], timestamp: 2 },
			{ role: "assistant", content: [{ type: "toolCall", name: "read", arguments: { path: "src/b.ts" } }], timestamp: 3 },
		],
		turnPrefixMessages: [],
		tokensBefore: 12345,
		firstKeptEntryId: "entry-42",
	};
}

/** The window that stays in context after the compaction. */
const branchEntries = [
	{ type: "message", id: "entry-41", parentId: null, timestamp: "2026-10-22T21:00:00.000Z", message: { role: "user", content: [{ type: "text", text: "earlier work" }] } },
	{ type: "message", id: "entry-42", parentId: "entry-41", timestamp: "2026-10-22T21:01:00.000Z", message: { role: "user", content: [{ type: "text", text: "检查 report" }] } },
	{ type: "message", id: "entry-43", parentId: "entry-42", timestamp: "2026-10-22T21:02:00.000Z", message: { role: "assistant", content: [{ type: "text", text: "ns-0010 已通过" }] } },
] as unknown as SessionEntry[];

const sig = () => new AbortController().signal;

// Skipped (not failed) when the Pi runtime cannot be resolved on this machine.
describe.skipIf(!piAiPath)("buildCompactionSummary", () => {
	const okSummary = JSON.stringify({
		topics: ["改摘要提示词"],
		fileNotes: [{ path: "src/a.ts", note: "重写了 reconcile" }],
		nextIntent: "改完提示词跑测试",
		restore: "",
	});

	it("assembles the summary from model parts plus the mechanical file lists and handle", async () => {
		const cwd = tmpCwd();

		const out = await buildCompactionSummary(
			{ preparation: prep(), branchEntries, reason: "manual", signal: sig() },
			makeCtx(cwd, async () => textResponse(okSummary)),
		);

		expect(out.compaction.firstKeptEntryId).toBe("entry-42");
		expect(out.compaction.tokensBefore).toBe(12345);
		expect(out.compaction.summary).toContain("改摘要提示词");
		expect(out.compaction.summary).toContain("改完提示词跑测试");
		expect(out.compaction.summary).toContain("src/a.ts — 重写了 reconcile");
		expect(out.compaction.summary).toContain("src/b.ts");
		expect(out.compaction.summary).toContain(SESSION_FILE);
	});

	it("keeps the user requests as the request line", async () => {
		const cwd = tmpCwd();

		const out = await buildCompactionSummary(
			{ preparation: prep(), branchEntries, reason: "manual", signal: sig() },
			makeCtx(cwd, async () => textResponse(okSummary)),
		);

		expect(out.compaction.summary).toContain("## 请求线");
		expect(out.compaction.summary).toContain("earlier work");
		expect(out.compaction.summary).toContain("检查 report");
	});

	it("shows the kept window to the summary model so the next intent cannot predate it", async () => {
		const cwd = tmpCwd();
		let seenPrompt = "";

		await buildCompactionSummary(
			{ preparation: prep(), branchEntries, reason: "manual", signal: sig() },
			makeCtx(cwd, async (_model, request) => {
				seenPrompt = JSON.stringify(request);
				return textResponse(okSummary);
			}),
		);

		expect(seenPrompt).toContain("保留窗口");
		expect(seenPrompt).toContain("ns-0010 已通过");
	});

	it("never lists a file the model invented", async () => {
		const cwd = tmpCwd();

		const out = await buildCompactionSummary(
			{ preparation: prep(), branchEntries, reason: "manual", signal: sig() },
			makeCtx(cwd, async () =>
				textResponse('{"topics":["t"],"fileNotes":[{"path":"src/ghost.ts","note":"x"}],"nextIntent":"go"}'),
			),
		);

		expect(out.compaction.summary).toContain("src/a.ts");
		expect(out.compaction.summary).not.toContain("src/ghost.ts");
	});

	it("never returns undefined when the model output is unusable", async () => {
		const cwd = tmpCwd();

		const out = await buildCompactionSummary(
			{ preparation: prep(), branchEntries, reason: "manual", signal: sig() },
			makeCtx(cwd, async () => textResponse("I am unable to comply.")),
		);

		expect(out?.compaction).toBeDefined();
		expect(out.compaction.summary).toContain("兜底");
		expect(out.compaction.summary).toContain("earlier work");
		expect(out.compaction.summary).toContain(SESSION_FILE);
		expect(out.compaction.firstKeptEntryId).toBe("entry-42");
	});

	it("repairs unparseable output once before falling back", async () => {
		const cwd = tmpCwd();
		let calls = 0;

		const out = await buildCompactionSummary(
			{ preparation: prep(), branchEntries, reason: "manual", signal: sig() },
			makeCtx(cwd, async () => {
				calls++;
				return calls === 1 ? textResponse("not json") : textResponse(okSummary);
			}),
		);

		expect(calls).toBe(2);
		expect(out.compaction.summary).toContain("改完提示词跑测试");
		expect(out.compaction.summary).not.toContain("兜底");
	});

	it("records the reason when the model call throws, instead of propagating", async () => {
		const cwd = tmpCwd();

		const out = await buildCompactionSummary(
			{ preparation: prep(), branchEntries, reason: "manual", signal: sig() },
			makeCtx(cwd, async () => {
				throw new Error("provider exploded");
			}),
		);

		expect(out?.compaction).toBeDefined();
		expect(out.compaction.summary).toContain("provider exploded");
	});

	it("classifies an aborted call as an abort, not a crash", async () => {
		const cwd = tmpCwd();
		const ac = new AbortController();
		ac.abort();

		const out = await buildCompactionSummary(
			{ preparation: prep(), branchEntries, reason: "manual", signal: ac.signal },
			makeCtx(cwd, async () => {
				throw new Error("aborted by signal");
			}),
		);

		expect(out.compaction.summary).toContain("取消");
	});

	it("takes the fast path on overflow: no model call, mechanical orientation only", async () => {
		const cwd = tmpCwd();
		let calls = 0;

		const out = await buildCompactionSummary(
			{ preparation: prep(), branchEntries, reason: "overflow", signal: sig() },
			makeCtx(cwd, async () => {
				calls++;
				return textResponse("{}");
			}),
		);

		expect(calls).toBe(0);
		expect(out.compaction.summary).toContain("溢出快路径");
		expect(out.compaction.summary).toContain("src/a.ts");
		expect(out.compaction.summary).toContain(SESSION_FILE);
	});

	it("logs every failure to .pi/compaction/failures.log", async () => {
		const cwd = tmpCwd();

		await buildCompactionSummary(
			{ preparation: prep(), branchEntries, reason: "manual", signal: sig() },
			makeCtx(cwd, async () => textResponse("nonsense")),
		);

		const log = fs.readFileSync(path.join(cwd, ".pi/compaction/failures.log"), "utf8");
		expect(log).toContain("无法解析");
	});

	it("records every attempt in .pi/compaction/stats.log", async () => {
		const cwd = tmpCwd();

		await buildCompactionSummary(
			{ preparation: prep(), branchEntries, reason: "manual", signal: sig() },
			makeCtx(cwd, async () => textResponse(okSummary)),
		);

		const log = fs.readFileSync(path.join(cwd, ".pi/compaction/stats.log"), "utf8");
		expect(log).toContain("outcome=ok");
		expect(log).toContain("model=stub/stub");
	});

	it("uses the configured summary model when there is one", async () => {
		const cwd = tmpCwd();
		const configPath = path.join(cwd, "compaction.json");
		fs.writeFileSync(configPath, JSON.stringify({ summaryModel: "prov/cheap" }), "utf8");
		process.env.PI_COMPACTION_CONFIG = configPath;
		let usedModel: unknown;

		await buildCompactionSummary(
			{ preparation: prep(), branchEntries, reason: "manual", signal: sig() },
			makeCtx(
				cwd,
				async (model) => {
					usedModel = model;
					return textResponse(okSummary);
				},
				(provider, modelId) => (provider === "prov" && modelId === "cheap" ? { id: "cheap", provider: "prov" } : undefined),
			),
		);

		expect(usedModel).toEqual({ id: "cheap", provider: "prov" });
	});

	it("falls back to the session model when the configured one is unavailable", async () => {
		const cwd = tmpCwd();
		const configPath = path.join(cwd, "compaction.json");
		fs.writeFileSync(configPath, JSON.stringify({ summaryModel: "prov/gone" }), "utf8");
		process.env.PI_COMPACTION_CONFIG = configPath;
		let usedModel: unknown;

		await buildCompactionSummary(
			{ preparation: prep(), branchEntries, reason: "manual", signal: sig() },
			makeCtx(cwd, async (model) => {
				usedModel = model;
				return textResponse(okSummary);
			}),
		);

		expect(usedModel).toEqual({ id: "stub", provider: "stub" });
	});
});
