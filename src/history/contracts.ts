/**
 * Type-only DTOs shared by the browser `HistoryClient` and the Node history repository/API
 * (WP-48). No runtime code, no Node/DOM imports — safe to import from either side of the
 * browser/Node boundary (WP-48 README §2.4).
 */

/** WP-50 will upgrade this to full/partial/unsupported after a replay schema audit. */
export type HistoryReplaySupport = 'unchecked';

export interface HistoryRunSummary {
  readonly runId: string;
  readonly participantId: string;
  readonly drillId: string;
  readonly startedAt: string;
  readonly schemaVersion: number;
  readonly suspect: boolean;
  readonly byteLength: number;
  readonly replaySupport: HistoryReplaySupport;
}

export interface HistoryParticipantSummary {
  readonly participantId: string;
  readonly drillCount: number;
  readonly runCount: number;
  readonly latestStartedAt: string;
}

export interface HistoryDrillSummary {
  readonly drillId: string;
  readonly runCount: number;
  readonly latestStartedAt: string;
}

export type SaveHistoryRunResult =
  | { readonly disposition: 'created' | 'existing'; readonly run: HistoryRunSummary }
  | { readonly disposition: 'conflict'; readonly runId: string };

export interface HistoryIndexReport {
  readonly validRunCount: number;
  readonly invalidFileCount: number;
  readonly unsupportedFileCount: number;
  readonly excludedPracticeFileCount: number;
  readonly rebuiltAt: string;
}

export type HistoryApiErrorCode =
  | 'MALFORMED_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_EXPORT'
  | 'UNSUPPORTED_SCHEMA'
  | 'PRACTICE_NOT_ARCHIVABLE'
  | 'MISSING_PARTICIPANT'
  | 'RUN_NOT_FOUND'
  | 'RUN_CONFLICT'
  | 'HISTORY_ROOT_LOCKED'
  | 'STORAGE_IO'
  | 'HISTORY_UNAVAILABLE';

export interface HistoryApiErrorBody {
  readonly ok: false;
  readonly error: {
    readonly code: HistoryApiErrorCode;
    readonly message: string;
    readonly details?: readonly { readonly path: string; readonly code: string }[];
  };
}

export interface HistoryApiSuccess<T> {
  readonly ok: true;
  readonly data: T;
}
