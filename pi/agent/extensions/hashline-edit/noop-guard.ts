/**
 * Noop loop guard — prevents the LLM from re-sending byte-identical no-op
 * payloads in an infinite loop (wasting tokens).
 *
 * Adapted from pi-hashline-edit (MIT).
 * Lite version: in-memory only (resets on /reload or session switch). No
 * cross-call duplicate-applied-payload tracking (that requires snapshots).
 */

/** @public */
export const NOOP_HARD_LIMIT = 3;

interface NoopEntry {
	payloadKey: string;
	count: number;
}

const noopTracker = new Map<string, NoopEntry>();

/**
 * Record a noop edit attempt for the given path. A different payloadKey
 * resets the count (the model changed payload = progress).
 * Returns the current count and whether the hard limit has been hit.
 */
export function recordNoopEdit(
	path: string,
	payloadKey: string,
): { count: number; escalate: boolean } {
	const existing = noopTracker.get(path);
	if (existing && existing.payloadKey === payloadKey) {
		existing.count += 1;
	} else {
		noopTracker.set(path, { payloadKey, count: 1 });
	}
	const count = noopTracker.get(path)!.count;
	return { count, escalate: count >= NOOP_HARD_LIMIT };
}

/** Clear the noop counter for a path (called after a successful edit or re-read). */
export function clearNoopTracker(path: string): void {
	noopTracker.delete(path);
}
