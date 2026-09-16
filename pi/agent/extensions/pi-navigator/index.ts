/**
 * pi-navigator extension for pi.
 *
 * `/nav <task or question>` is the single entry point over every capability
 * maintained by this dotfiles repo (extensions, skills, patterns). Skills are
 * all disable-model-invocation and extension commands are invisible to the
 * model by default, so the navigator injects a capability catalog on demand:
 *
 *   hand-curated catalog.md + auto-scanned skill inventory + user input
 *     -> invisible message that triggers a turn
 *     -> model proposes a workflow (which skill / command / pattern, in order)
 */

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

// Extension is symlinked into ~/.pi/agent/extensions. pi loads extensions via
// jiti, which keeps the ~/.pi path in import.meta.url — realpath it explicitly
// to get back into the dotfiles repo (same trick as project-skills).
function realpathSafe(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}
const extensionDir = realpathSafe(dirname(fileURLToPath(import.meta.url)));
const CATALOG_PATH = join(extensionDir, 'catalog.md');

/** Skill sources scanned at invocation time so the catalog never goes stale. */
function skillSources(cwd: string): string[] {
	return [
		join(homedir(), '.pi', 'agent', 'skills'),
		join(cwd, '.pi', 'skills'),
		join(homedir(), '.agents', 'skills'),
	];
}

interface SkillEntry {
	name: string;
	description: string;
	disableModelInvocation: boolean;
	path: string;
}

/** Minimal frontmatter parse — same two/three fields every SKILL.md here uses. */
function parseSkill(skillDir: string): SkillEntry | undefined {
	const file = join(skillDir, 'SKILL.md');
	if (!existsSync(file)) return undefined;
	const raw = readFileSync(file, 'utf8');
	const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
	if (!match) return undefined;
	const field = (key: string): string | undefined => {
		const m = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(match[1]);
		return m?.[1].trim();
	};
	const name = field('name') ?? skillDir.split('/').pop() ?? skillDir;
	return {
		name,
		description: field('description') ?? '(no description)',
		disableModelInvocation: field('disable-model-invocation') === 'true',
		path: file,
	};
}

function scanInventory(cwd: string): string {
	const lines: string[] = [];
	for (const source of skillSources(cwd)) {
		if (!existsSync(source)) continue;
		for (const entry of readdirSync(source, { withFileTypes: true })) {
			if (entry.name.startsWith('.') || entry.name === 'README.txt') continue;
			// statSync follows symlinks: most skills in ~/.agents/skills are
			// symlinks into this repo, and withFileTypes reports them as
			// "symlink", not "directory".
			const skillDir = join(source, entry.name);
			if (!statSync(skillDir, { throwIfNoEntry: false })?.isDirectory()) continue;
			const skill = parseSkill(skillDir);
			if (skill) {
				const flag = skill.disableModelInvocation ? ' [user-invocation only]' : '';
				lines.push(`- /skill:${skill.name}${flag} — ${skill.description}\n  ${skill.path}`);
			}
		}
	}
	return lines.length > 0 ? lines.join('\n') : '(no skills found on disk)';
}

export default function piNavigator(pi: ExtensionAPI): void {
	pi.registerCommand('nav', {
		description: 'Navigator: suggest a workflow over repo skills/extensions/patterns for your input',
		handler: async (args: unknown, ctx: { cwd?: string; ui?: { notify(message: string, tone?: string): void } } | undefined) => {
			const input = typeof args === 'string' ? args.trim() : '';
			if (!input) {
				ctx?.ui?.notify('Usage: /nav <task or question> — e.g. /nav 我要给导出功能加 CSV 支持', 'warning');
				return;
			}
			const catalog = existsSync(CATALOG_PATH) ? readFileSync(CATALOG_PATH, 'utf8') : '(catalog.md missing)';
			const content = [
				'You are the capability navigator. Below is the capability catalog maintained by the dotfiles repo, the skills actually present on disk right now, and the user\'s request. Propose a concrete workflow: which skills / extension commands / tools / patterns to use, in what order, referencing each by its explicit invocation form (/skill:<name>, /command, tool name). End with exactly one recommended next action. Do not execute anything yet.',
				'',
				'## Capability catalog',
				'',
				catalog,
				'',
				'## Skills currently on disk',
				'',
				scanInventory(ctx?.cwd ?? process.cwd()),
				'',
				'## User request',
				'',
				input,
			].join('\n');
			pi.sendMessage({ customType: 'nav.route', content, display: false }, { triggerTurn: true });
		},
	});
}
