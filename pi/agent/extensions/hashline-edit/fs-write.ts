/**
 * Atomic file write — tempfile + rename.
 *
 * Adapted from pi-hashline-edit (MIT).
 * Lite version: no symlink resolution, no hardlink protection. Just the core
 * tempfile + rename pattern using node:fs/promises.
 */

import { randomUUID } from "node:crypto";
import { mkdir, open, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export async function writeFileAtomically(
	path: string,
	content: string,
): Promise<void> {
	const targetPath = resolve(path);

	let existingStats: Awaited<ReturnType<typeof stat>> | null = null;
	try {
		existingStats = await stat(targetPath);
	} catch (error: unknown) {
		if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
	}

	const dir = dirname(targetPath);
	const tempPath = join(dir, `.tmp-${randomUUID()}`);
	await mkdir(dir, { recursive: true });
	const tempHandle = await open(tempPath, "wx", 0o600);
	try {
		await tempHandle.writeFile(content, "utf-8");
		if (existingStats) {
			await tempHandle.chmod(existingStats.mode & 0o7777);
		}
	} finally {
		await tempHandle.close();
	}

	await rename(tempPath, targetPath);
}

/** Write content in-place (used as fallback if atomic rename fails on some FS). */
export async function writeInPlace(path: string, content: string): Promise<void> {
	await writeFile(resolve(path), content, "utf-8");
}
