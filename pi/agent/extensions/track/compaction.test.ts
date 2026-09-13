import { afterEach, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

/**
 * Integration tests for the Compaction Reconcile path (ADR 0008).
 *
 * These exercise the real `buildTrackCompaction`, so the Pi runtime values it
 * imports are stubbed via a loader hook (pattern from ../../xfer/commands.test.ts).
 * The behaviour under test is the failure accounting: Pi swallows extension
 * exceptions and treats a bare `undefined` result as "no extension result",
 * which silently reinstates built-in summarization. So the contract is that
 * this function ALWAYS returns a `compaction` and never throws.
 *
 * Requires the Pi runtime to be resolvable — true wherever the extension is
 * actually installed. When it is not, the suite skips instead of failing:
 * `reconcile.test.ts` still covers the pure parsing logic.
 */

let buildTrackCompaction: typeof import("./compaction").buildTrackCompaction;

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
	);
	const stubUrl = pathToFileURL(stubPath).href;
	registerHooks({
		resolve(specifier, context, nextResolve) {
			if (specifier === "@earendil-works/pi-ai") return { url: stubUrl, shortCircuit: true };
			return nextResolve(specifier, context);
		},
	});
	({ buildTrackCompaction } = await import("./compaction.js"));
});

const tmpDirs: string[] = [];

function tmpCwd(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "track-compaction-"));
	tmpDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function seedTrack(cwd: string, progress = "## Timeline\n- [2026-01-01T00:00:00.000Z] seed entry"): void {
	fs.mkdirSync(path.join(cwd, ".pi/track"), { recursive: true });
	fs.writeFileSync(path.join(cwd, ".pi/track/findings.md"), "# Findings\n\n## Notes\n- [empty]\n", "utf8");
	fs.writeFileSync(path.join(cwd, ".pi/track/progress.md"), `# Progress\n\n${progress}\n`, "utf8");
}

function makeCtx(cwd: string, complete: (model: unknown, req: unknown, opts: unknown) => Promise<unknown>) {
	return {
		cwd,
		hasUI: true,
		model: { id: "stub" },
		modelRegistry: { complete },
		ui: { notify: () => {} },
	} as never;
}

const textResponse = (text: string) => ({ content: [{ type: "text", text }], usage: {} });

function prep() {
	return {
		messagesToSummarize: [{ role: "user", content: [{ type: "text", text: "earlier work" }], timestamp: 1 }],
		turnPrefixMessages: [],
		tokensBefore: 12345,
		firstKeptEntryId: "entry-42",
	};
}

const sig = () => new AbortController().signal;

// Skipped (not failed) when the Pi runtime cannot be resolved on this machine.
describe.skipIf(!piAiPath)("buildTrackCompaction", () => {
	it("writes reconciled entries, preserves existing content, and summarises Track", async () => {
		const cwd = tmpCwd();
		seedTrack(cwd);

		const out = await buildTrackCompaction(
			{ preparation: prep(), reason: "manual", signal: sig() },
			makeCtx(cwd, async () => textResponse('{"progress":[{"heading":"Work Completed","text":"reconciled"}]}')),
		);

		expect(out.compaction.firstKeptEntryId).toBe("entry-42");
		expect(out.compaction.tokensBefore).toBe(12345);
		expect(out.compaction.summary).toContain("reconciled");
		const file = fs.readFileSync(path.join(cwd, ".pi/track/progress.md"), "utf8");
		expect(file).toContain("reconciled");
		expect(file).toContain("seed entry");
	});

	it("never returns undefined when the model output is unusable", async () => {
		const cwd = tmpCwd();
		seedTrack(cwd);

		const out = await buildTrackCompaction(
			{ preparation: prep(), reason: "manual", signal: sig() },
			makeCtx(cwd, async () => textResponse("I am unable to comply.")),
		);

		expect(out?.compaction).toBeDefined();
		expect(out.compaction.summary).toContain("RECONCILE FAILED");
		expect(out.compaction.firstKeptEntryId).toBe("entry-42");
	});

	it("records the reason when the model call throws, instead of propagating", async () => {
		const cwd = tmpCwd();
		seedTrack(cwd);

		const out = await buildTrackCompaction(
			{ preparation: prep(), reason: "manual", signal: sig() },
			makeCtx(cwd, async () => {
				throw new Error("provider exploded");
			}),
		);

		expect(out?.compaction).toBeDefined();
		expect(out.compaction.summary).toContain("provider exploded");
	});

	it("classifies an aborted call as an abort, not a crash", async () => {
		const cwd = tmpCwd();
		seedTrack(cwd);
		const ac = new AbortController();
		ac.abort();

		const out = await buildTrackCompaction(
			{ preparation: prep(), reason: "manual", signal: ac.signal },
			makeCtx(cwd, async () => {
				throw new Error("aborted by signal");
			}),
		);

		expect(out.compaction.summary).toContain("reconcile was aborted");
	});

	it("takes the fast path on overflow: no model call, Track returned as-is", async () => {
		const cwd = tmpCwd();
		seedTrack(cwd);
		let calls = 0;

		const out = await buildTrackCompaction(
			{ preparation: prep(), reason: "overflow", signal: sig() },
			makeCtx(cwd, async () => {
				calls++;
				return textResponse("{}");
			}),
		);

		expect(calls).toBe(0);
		expect(out.compaction.summary).toContain("seed entry");
	});

	it("logs every failure to .pi/track/reconcile.log", async () => {
		const cwd = tmpCwd();
		seedTrack(cwd);

		await buildTrackCompaction(
			{ preparation: prep(), reason: "manual", signal: sig() },
			makeCtx(cwd, async () => textResponse("nonsense")),
		);

		const log = fs.readFileSync(path.join(cwd, ".pi/track/reconcile.log"), "utf8");
		expect(log).toContain("no usable entries");
	});
});
