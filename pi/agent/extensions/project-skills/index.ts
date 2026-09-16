/**
 * project-skills extension for pi.
 *
 * `/pi-skills` links the *pi-coupled* skills maintained by this dotfiles
 * repo into the *current project*:
 *
 *   dotfiles/pi/agent/skills/*  ->  <cwd>/.pi/skills/<name>
 *
 * Generic (pi-independent) skills from dotfiles/skills/ are NOT handled
 * here — they are installed globally via `just install-skills` into
 * ~/.agents/skills/ (which is also a pi skill search path).
 */

import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, realpathSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

// Extension is symlinked into ~/.pi/agent/extensions. Native Node ESM would
// resolve the symlink, but pi loads extensions via jiti, which keeps the
// ~/.pi path in import.meta.url — so realpath it explicitly to get back into
// the dotfiles repo: <dotfiles>/pi/agent/extensions/project-skills -> up four
// levels to <dotfiles>.
function realpathSafe(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}
const extensionDir = realpathSafe(dirname(fileURLToPath(import.meta.url)));
const dotfilesDir = resolve(extensionDir, '..', '..', '..', '..');

const SOURCE_DIR = join(dotfilesDir, 'pi', 'agent', 'skills');
const TARGET_DIR = '.pi/skills';

function isSymlink(target: string): boolean {
	return lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink() ?? false;
}

function linkSkill(source: string, target: string): 'linked' | 'kept' {
	if (isSymlink(target) && readlinkSync(target) === source) return 'kept';
	if (isSymlink(target)) unlinkSync(target); // stale symlink, re-point it
	else if (existsSync(target)) return 'kept'; // real file/dir in project, never clobber
	mkdirSync(dirname(target), { recursive: true });
	symlinkSync(source, target);
	return 'linked';
}

export default function projectSkills(pi: ExtensionAPI): void {
		pi.registerCommand('pi-skills', {
			description: 'Link pi-coupled dotfiles skills into this project (.pi/skills); args = skill names to skip',
			handler: async (args: unknown, ctx: { cwd?: string; ui?: { notify(message: string, tone?: string): void } } | undefined) => {
				const cwd = ctx?.cwd ?? process.cwd();
				// Args are skill names to exclude: /pi-skills wayfinder show-me
				const skip = new Set(typeof args === 'string' ? args.split(/\s+/).filter(Boolean) : []);
				const lines: string[] = [];

				if (existsSync(SOURCE_DIR)) {
					for (const entry of readdirSync(SOURCE_DIR, { withFileTypes: true })) {
						if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'README.txt') continue;
						if (skip.has(entry.name)) {
							lines.push(`  ⏭️  ${entry.name} (skipped by args)`);
							continue;
						}
						const source = join(SOURCE_DIR, entry.name);
						const outcome = linkSkill(source, join(cwd, TARGET_DIR, entry.name));
						lines.push(outcome === 'kept' ? `  ⏭️  ${TARGET_DIR}/${entry.name} (already present, kept)` : `  🔗 ${TARGET_DIR}/${entry.name} -> ${source}`);
					}
				}

				ctx?.ui?.notify(lines.length > 0 ? `/pi-skills done:\n${lines.join('\n')}` : `/pi-skills: no skills found to link (looked in ${SOURCE_DIR}).`, 'info');
			},
		});
}
