/**
 * project-skills extension for pi.
 *
 * Replaces the old global skill linking in `just install-pi`
 * (~/.pi/agent/skills and ~/.agents/skills). Instead, `/pi-skills`
 * links the dotfiles-maintained skills into the *current project*:
 *
 *   dotfiles/pi/agent/skills/*  ->  <cwd>/.pi/skills/<name> and <cwd>/.agents/skills/<name>
 *   dotfiles/skills/*           ->  <cwd>/.pi/skills/<name> and <cwd>/.agents/skills/<name>
 *
 * Skills are linked one by one, so a project can delete or override
 * individual skills locally. Existing non-symlink entries are never clobbered.
 * Args are skill names to exclude: /pi-skills wayfinder show-me
 */

import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

// Extension is symlinked into ~/.pi/agent/extensions, but node resolves the
// realpath of the module, so import.meta.url points back into the dotfiles repo:
// <dotfiles>/pi/agent/extensions/project-skills -> up four levels to <dotfiles>.
const extensionDir = dirname(fileURLToPath(import.meta.url));
const dotfilesDir = resolve(extensionDir, '..', '..', '..', '..');

const SOURCE_DIRS = [join(dotfilesDir, 'pi', 'agent', 'skills'), join(dotfilesDir, 'skills')];
const PROJECT_TARGET_DIRS = ['.pi/skills', '.agents/skills'];

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
		description: 'Link dotfiles skills into this project (.pi/skills and .agents/skills); args = skill names to skip',
		handler: async (args: unknown, ctx: { cwd?: string; ui?: { notify(message: string, tone?: string): void } } | undefined) => {
			const cwd = ctx?.cwd ?? process.cwd();
			// Args are skill names to exclude: /pi-skills wayfinder show-me
			const skip = new Set(typeof args === 'string' ? args.split(/\s+/).filter(Boolean) : []);
			const lines: string[] = [];

			for (const sourceDir of SOURCE_DIRS) {
				if (!existsSync(sourceDir)) continue;
				for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
					if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'README.txt') continue;
					if (skip.has(entry.name)) {
						lines.push(`  ⏭️  ${entry.name} (skipped by args)`);
						continue;
					}
					const source = join(sourceDir, entry.name);
					for (const rel of PROJECT_TARGET_DIRS) {
						const outcome = linkSkill(source, join(cwd, rel, entry.name));
						lines.push(outcome === 'kept' ? `  ⏭️  ${rel}/${entry.name} (already present, kept)` : `  🔗 ${rel}/${entry.name} -> ${source}`);
					}
				}
			}

			ctx?.ui?.notify(lines.length > 0 ? `/pi-skills done:\n${lines.join('\n')}` : '/pi-skills: no skills found to link.', 'info');
		},
	});
}
