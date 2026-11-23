import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert";

import {
	auditSkills,
	collectInstalledSkills,
	collectSkillUsage,
	renderAuditJson,
	renderAuditReport,
	renderAuditTable,
	type SkillAuditRow,
} from "./audit.ts";

function tmp(prefix: string): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function skillLine(timestamp: string, names: string[]): string {
	const text = names.map((n) => `<skill name=\"${n}\" location=\"/skills/${n}/SKILL.md\">\n# ${n}`).join("\n\n");
	return JSON.stringify({ type: "message", timestamp, message: { role: "user", content: [{ type: "text", text }] } });
}

const NOW = new Date(2026, 10, 23, 12, 0, 0);

test("usage: an empty sessions dir yields no counts", async () => {
	const dir = tmp("audit-empty-");
	const usage = await collectSkillUsage(dir, { now: NOW });
	assert.strictEqual(usage.size, 0);
});

test("usage: one session counts loads and assigns the day from the line timestamp", async () => {
	const dir = tmp("audit-one-");
	fs.mkdirSync(path.join(dir, "--project--"), { recursive: true });
	fs.writeFileSync(
		path.join(dir, "--project--", "s1.jsonl"),
		[
			JSON.stringify({ type: "session", timestamp: "2026-11-20T01:00:00.000Z" }),
			skillLine("2026-11-20T09:00:00.000Z", ["how"]),
			skillLine("2026-11-21T10:00:00.000Z", ["how", "nightshift"]),
		].join("\n"),
	);
	const usage = await collectSkillUsage(dir, { now: NOW });
	const how = usage.get("how");
	assert.ok(how !== undefined);
	assert.strictEqual(how.total, 2);
	assert.strictEqual(how.recent, 2);
	assert.strictEqual(how.lastLoaded, localDate("2026-11-21T10:00:00.000Z"));
	const nightshift = usage.get("nightshift");
	assert.ok(nightshift !== undefined);
	assert.strictEqual(nightshift.total, 1);
	assert.strictEqual(nightshift.lastLoaded, localDate("2026-11-21T10:00:00.000Z"));
});

test("usage: repeated loads across files accumulate, and loads older than the window are not recent", async () => {
	const dir = tmp("audit-repeat-");
	fs.mkdirSync(path.join(dir, "a"), { recursive: true });
	fs.mkdirSync(path.join(dir, "b"), { recursive: true });
	fs.writeFileSync(
		path.join(dir, "a", "s1.jsonl"),
		[skillLine("2026-09-01T08:00:00.000Z", ["bro"]), skillLine("2026-11-01T08:00:00.000Z", ["bro"])].join("\n"),
	);
	fs.writeFileSync(path.join(dir, "b", "s2.jsonl"), skillLine("2026-11-22T08:00:00.000Z", ["bro"]));
	const usage = await collectSkillUsage(dir, { now: NOW, windowDays: 60 });
	const bro = usage.get("bro");
	assert.ok(bro !== undefined);
	assert.strictEqual(bro.total, 3);
	assert.strictEqual(bro.recent, 2, "the September load is outside the 60-day window");
	assert.strictEqual(bro.lastLoaded, localDate("2026-11-22T08:00:00.000Z"));
});

test("usage: only loads inside the window count as recent", async () => {
	const dir = tmp("audit-window-");
	fs.writeFileSync(
		path.join(dir, "s.jsonl"),
		[skillLine("2026-09-25T12:00:00.000Z", ["tdd"]), skillLine("2026-09-20T12:00:00.000Z", ["grilling"])].join("\n"),
	);
	const usage = await collectSkillUsage(dir, { now: NOW, windowDays: 60 });
	assert.strictEqual(usage.get("tdd")?.recent, 1, "59 days back is inside the window");
	assert.strictEqual(usage.get("grilling")?.recent, 0, "64 days back is outside the window");
	assert.strictEqual(usage.get("grilling")?.total, 1, "the old load still counts in the total");
});

test("inventory: categories, line counts and the invocation flag are read from disk", () => {
	const pi = tmp("audit-pi-");
	const generic = tmp("audit-generic-");
	const project = tmp("audit-project-");
	const write = (root: string, name: string, body: string): void => {
		fs.mkdirSync(path.join(root, name), { recursive: true });
		fs.writeFileSync(path.join(root, name, "SKILL.md"), body);
	};
	write(pi, "how", "---\nname: how\ndisable-model-invocation: true\n---\n\n# How\n");
	write(generic, "bro", "---\nname: bro\n---\n\n# Bro\n\nbody\n");
	fs.mkdirSync(path.join(project, "local"), { recursive: true });
	fs.writeFileSync(path.join(project, "local", "SKILL.md"), "---\nname: local\ndisable-model-invocation: true\n---\n\n# Local\n");

	const skills = collectInstalledSkills({ pi, generic, project });
	assert.deepStrictEqual(
		skills.map((s) => [s.name, s.category, s.disableModelInvocation]),
		[
			["bro", "generic", false],
			["how", "pi", true],
			["local", "project", true],
		],
	);
	assert.strictEqual(skills.find((s) => s.name === "how")?.lines, 6);
});

test("report: table carries every column, plus the never-loaded and stale sections", async () => {
	const pi = tmp("audit-pi-");
	const generic = tmp("audit-generic-");
	const project = tmp("audit-project-");
	const sessions = tmp("audit-sessions-");
	for (const [root, name] of [
		[pi, "used"],
		[generic, "never"],
		[project, "stale"],
	] as const) {
		fs.mkdirSync(path.join(root, name), { recursive: true });
		fs.writeFileSync(path.join(root, name, "SKILL.md"), `---\nname: ${name}\ndisable-model-invocation: true\n---\n\n# ${name}\n`);
	}
	fs.writeFileSync(
		path.join(sessions, "s.jsonl"),
		[skillLine("2026-11-20T08:00:00.000Z", ["used"]), skillLine("2026-01-02T08:00:00.000Z", ["stale"])].join("\n"),
	);
	const result = await auditSkills({
		piSkillsDir: pi,
		genericSkillsDir: generic,
		projectSkillsDir: project,
		sessionsDir: sessions,
		now: NOW,
	});
	const report = renderAuditReport(result);
	assert.ok(report.includes("used"));
	assert.ok(report.includes("从未加载：never（全局通用）"), report);
	assert.ok(report.includes("超过 60 天未加载：stale（最近 2026-01-02）"), report);
	assert.strictEqual(result.rows.find((r) => r.name === "used")?.lines, 6);

	const table = renderAuditTable(result.rows, 60);
	assert.ok(table.split("\n")[0]?.includes("SKILL.md 行数"), table);

	const json = JSON.parse(renderAuditJson(result)) as { skills: SkillAuditRow[]; neverLoaded: string[] };
	assert.deepStrictEqual(json.neverLoaded, ["never"]);
	assert.ok(json.skills.every((s) => !JSON.stringify(s).includes(sessions)));
});

function localDate(iso: string): string {
	const d = new Date(iso);
	const pad = (n: number): string => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
