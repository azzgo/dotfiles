// ---- constants ----

export const WIDGET_KEY = "track";

export const MESSAGE_TYPE_TRACK_CONTEXT = "track-context";
export const MESSAGE_TYPE_TRACK_UPDATE = "track-update";
export const MESSAGE_TYPE_TRACK_STATUS = "track-status";

export const TRACK_DIR = ".pi/track";
export const TRACK_FILES = ["findings.md", "progress.md"] as const;
export const TRACK_FILE_NAMES = [...TRACK_FILES] as const;

/** Append-only log of failed Compaction Reconciles (see ADR 0008). */
export const RECONCILE_LOG_FILE = "reconcile.log";

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

/** One new bullet to append during a Compaction Reconcile. */
export type ReconcileEntry = {
	file: (typeof TRACK_FILES)[number];
	heading: string;
	text: string;
};

export type ReconcileResult = {
	entries: ReconcileEntry[];
};
