import { createHash } from 'node:crypto';
import path from 'node:path';

/**
 * Pure identity/path helpers for the WP-48 T2 `HistoryRepository`. No fs access, no HTTP/DOM —
 * safe to unit test without a filesystem and safe to reuse from historyApi.ts (T3) for
 * error-message-safe diagnostics. Disk layout / identity rules: README.md §2.3.
 */

const SEGMENT_DISALLOWED = /[^A-Za-z0-9._-]/g;
const HASH_PREFIX_LENGTH = 10;
const RUN_ID_FILENAME_LENGTH = 12;
const MAX_SEGMENT_PREFIX_LENGTH = 40;

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Readable-prefix half of a directory segment. Allow-list charset ([A-Za-z0-9._-]) means every
 * Windows/POSIX-forbidden character (incl. path separators and NUL) is replaced, so the result is
 * always a single safe path component fragment — never `..`/`.` (both collapse to `x` because the
 * leading/trailing dot-trim strips an all-dot string down to empty first).
 */
export function sanitizeSegmentPrefix(raw: string): string {
  const collapsed = raw.replace(SEGMENT_DISALLOWED, '_').replace(/_+/g, '_').replace(/^[_.]+|[_.]+$/g, '');
  const truncated = collapsed.slice(0, MAX_SEGMENT_PREFIX_LENGTH);
  return truncated.length > 0 ? truncated : 'x';
}

/** `{sanitized-prefix}--{hash10}` — the hash suffix guarantees uniqueness even when two distinct
 * raw values collapse to the same sanitized prefix (e.g. two different non-ASCII participant IDs
 * both degrading to `x`). */
export function buildIdentitySegment(raw: string): string {
  return `${sanitizeSegmentPrefix(raw)}--${sha256Hex(raw).slice(0, HASH_PREFIX_LENGTH)}`;
}

/** `\0`-joined identity string (README §2.3) — schemaVersion pinned so a future schema bump never
 * collides with a v2 identity by accident. */
export function buildRunIdentity(
  schemaVersion: number,
  participantId: string,
  drillId: string,
  startedAt: string,
): string {
  return `${schemaVersion}\0${participantId}\0${drillId}\0${startedAt}`;
}

export function buildRunId(identity: string): string {
  return sha256Hex(identity);
}

/** `{startedAt-with-colons-as-dashes}_assessment_{runId12}.json`. WP-48 only archives Assessment
 * runs (D-48.P7), so the mode suffix is a fixed literal, not a parameter. */
export function buildRunFilename(startedAt: string, runId: string): string {
  const safeStartedAt = startedAt.replace(SEGMENT_DISALLOWED, '-');
  return `${safeStartedAt}_assessment_${runId.slice(0, RUN_ID_FILENAME_LENGTH)}.json`;
}

/**
 * True iff `candidate` resolves to a strict descendant of `root` (never equal to `root` itself).
 * Lexical only — does not touch the filesystem or resolve symlinks; pair with a `fs.realpath`
 * check on disk for symlink/junction escape defense (see HistoryRepository.ts).
 */
export function isLexicallyContained(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  if (resolvedCandidate === resolvedRoot) return false;
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}
