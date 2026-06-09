/**
 * State persistence for read-only mode.
 *
 * Saves and restores the enabled state across session restarts
 * and tree navigation.
 */

import { STATE_ENTRY } from './constants.js';

export interface PersistedState {
  readonlyMode: boolean;
}

export interface StateEntry {
  type: string;
  customType?: string;
  data?: unknown;
}

function isPersistedState(value: unknown): value is PersistedState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'readonlyMode' in value &&
    typeof (value as Record<string, unknown>).readonlyMode === 'boolean'
  );
}

/**
 * Walk the session entries backwards and return the last persisted
 * read-only mode state. Returns `undefined` when no saved state exists.
 */
export function findSavedReadonlyState(entries: StateEntry[]): boolean | undefined {
  let saved: boolean | undefined;

  for (const entry of entries) {
    if (entry.type !== 'custom' || entry.customType !== STATE_ENTRY) continue;
    if (!isPersistedState(entry.data)) continue;
    saved = entry.data.readonlyMode;
  }

  return saved;
}
