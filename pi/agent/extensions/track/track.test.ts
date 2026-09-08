import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendToTrack, initTrack, readTrack, trackPaths } from "./track";

// Deterministic FS unit tests: each test gets a fresh unique tmpdir (no shared
// state); cleanup after every test.
const tmpDirs: string[] = [];

function tmpCwd(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "track-extension-"));
	tmpDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("track storage (flat files at .pi/track/)", () => {
	it("initTrack writes both canonical files and readTrack sees them", () => {
		const cwd = tmpCwd();
		expect(readTrack(cwd).exists).toBe(false);
		initTrack(cwd);
		const state = readTrack(cwd);
		expect(state.exists).toBe(true);
		expect(state.findings).toContain("# Findings");
		expect(state.findings).toContain("## Confirmed Constraints");
		expect(state.progress).toContain("# Progress");
		expect(state.progress).toContain("## Timeline");
		expect(fs.existsSync(trackPaths(cwd)["findings.md"])).toBe(true);
		expect(fs.existsSync(trackPaths(cwd)["progress.md"])).toBe(true);
	});

	it("initTrack resets existing content (a fresh scratchpad, not an append)", () => {
		const cwd = tmpCwd();
		initTrack(cwd);
		fs.writeFileSync(trackPaths(cwd)["progress.md"], "stale content", "utf8");
		initTrack(cwd);
		expect(fs.readFileSync(trackPaths(cwd)["progress.md"], "utf8")).toContain("# Progress");
		expect(fs.readFileSync(trackPaths(cwd)["progress.md"], "utf8")).not.toContain("stale content");
	});

	it("appendToTrack appends a timestamped bullet, replacing the [empty] placeholder", () => {
		const cwd = tmpCwd();
		initTrack(cwd);
		appendToTrack(cwd, "progress.md", "Timeline", "did the thing");
		const progress = fs.readFileSync(trackPaths(cwd)["progress.md"], "utf8");
		expect(progress).toMatch(/- \[\d{4}-\d{2}-\d{2}T[^\]]*\] did the thing/);
		const timeline = progress.match(/## Timeline\n[\s\S]*?(?=\n## |$)/)?.[0] ?? "";
		expect(timeline).not.toContain("- [empty]");
	});

	it("appendToTrack creates the section and file when missing", () => {
		const cwd = tmpCwd();
		appendToTrack(cwd, "findings.md", "Notes", "a note without init");
		const findings = fs.readFileSync(trackPaths(cwd)["findings.md"], "utf8");
		expect(findings).toContain("## Notes");
		expect(findings).toContain("a note without init");
	});
});
