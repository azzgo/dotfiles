import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { consumeVerifyToken, readVerifyToken, verifyBriefPath, writeVerifyBrief } from "./track";

// Deterministic FS unit tests: each test gets a fresh unique tmpdir (no taskmd,
// no shared state); cleanup after every test.
const tmpDirs: string[] = [];

function tmpCwd(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "goal-runtime-track-"));
	tmpDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("verify brief one-time token", () => {
	it("writeVerifyBrief round-trips the token through readVerifyToken", () => {
		const cwd = tmpCwd();
		writeVerifyBrief(cwd, "020", "Verify brief for goal 020.", "tok-abc-123");
		expect(readVerifyToken(cwd, "020")).toBe("tok-abc-123");
	});

	it("consumeVerifyToken makes readVerifyToken return null but keeps the brief for audit", () => {
		const cwd = tmpCwd();
		writeVerifyBrief(cwd, "020", "Verify brief for goal 020.", "tok-abc-123");
		consumeVerifyToken(cwd, "020");
		expect(readVerifyToken(cwd, "020")).toBeNull();
		const briefPath = verifyBriefPath(cwd, "020");
		expect(fs.existsSync(briefPath)).toBe(true); // file kept as audit record
		expect(fs.readFileSync(briefPath, "utf8")).toContain("VERIFY_TOKEN(consumed): tok-abc-123");
	});

	it("a fresh writeVerifyBrief after consumption mints a new usable token (re-entry / reopen)", () => {
		const cwd = tmpCwd();
		writeVerifyBrief(cwd, "020", "First review entry.", "tok-first");
		consumeVerifyToken(cwd, "020");
		expect(readVerifyToken(cwd, "020")).toBeNull();
		writeVerifyBrief(cwd, "020", "Reopened review entry (fresh token).", "tok-second");
		expect(readVerifyToken(cwd, "020")).toBe("tok-second");
		// old consumed marker is gone: the brief was fully rewritten
		expect(fs.readFileSync(verifyBriefPath(cwd, "020"), "utf8")).not.toContain("VERIFY_TOKEN(consumed)");
	});

	it("consumeVerifyToken is a silent no-op when the brief does not exist", () => {
		const cwd = tmpCwd();
		expect(() => consumeVerifyToken(cwd, "999")).not.toThrow();
		expect(fs.existsSync(verifyBriefPath(cwd, "999"))).toBe(false);
	});
});
