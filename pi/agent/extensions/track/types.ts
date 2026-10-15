// ---- constants ----

export const WIDGET_KEY = "track";

export const MESSAGE_TYPE_TRACK_CONTEXT = "track-context";
export const MESSAGE_TYPE_TRACK_UPDATE = "track-update";
export const MESSAGE_TYPE_TRACK_STATUS = "track-status";

export const TRACK_DIR = ".pi/track";
export const TRACK_FILES = ["findings.md", "progress.md"] as const;
export const TRACK_FILE_NAMES = [...TRACK_FILES] as const;

// ---- types ----

export type TrackState = {
	findings: string;
	progress: string;
	exists: boolean;
};

export type TrackSnapshot = {
	cwd: string;
	trackDir: string;
	track: TrackState;
	resumedFromPreviousSession: boolean;
};
