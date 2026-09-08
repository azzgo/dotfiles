import type { TrackSnapshot } from "./types";

/** Widget lines displayed above the editor. */
export function buildWidgetLines(state: TrackSnapshot): string[] | undefined {
	if (!state.track.exists) return undefined;
	return [`track: ${state.trackDir}`];
}
