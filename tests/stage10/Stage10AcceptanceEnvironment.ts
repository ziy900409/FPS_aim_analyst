import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isLexicallyContained } from '../../server/history/historyPaths.ts';

/**
 * WP-51 T1 — run-scoped, workspace-contained roots for the Stage 10 acceptance runner
 * (README §2.2/2.3). Every mutating path this module touches must resolve underneath
 * `.playwright-tmp/stage10/` — never `data/session-history/` (NFR-51.3).
 */

export interface Stage10AcceptanceEnvironment {
  readonly runToken: string;
  readonly workspaceRoot: string;
  readonly workspaceTempRoot: string;
  readonly devHistoryRoot: string;
  readonly previewHistoryRoot: string;
  readonly downloadsRoot: string;
  readonly outsideSentinel: string;
}

export interface AllocateStage10EnvironmentOptions {
  readonly workspaceRoot?: string;
  readonly runToken?: string;
  /** Defaults to `<workspaceRoot>/data/session-history` — the one real root this run must never touch. */
  readonly realHistoryRoot?: string;
}

export interface CleanupStage10EnvironmentResult {
  readonly ok: boolean;
  readonly reason?: string;
}

export class Stage10ReentryError extends Error {
  constructor(
    public readonly lockPath: string,
    public readonly owner: unknown,
  ) {
    super(`Stage 10 acceptance run already in progress (lock: ${lockPath})`);
    this.name = 'Stage10ReentryError';
  }
}

export class Stage10ContainmentViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Stage10ContainmentViolationError';
  }
}

const STAGE10_ROOT_DIRNAME = path.join('.playwright-tmp', 'stage10');
const LOCK_FILENAME = 'stage10.lock';

function stage10Root(workspaceRoot: string): string {
  return path.join(workspaceRoot, STAGE10_ROOT_DIRNAME);
}

function lockPath(workspaceRoot: string): string {
  return path.join(stage10Root(workspaceRoot), LOCK_FILENAME);
}

function defaultRealHistoryRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'data', 'session-history');
}

/**
 * Fail-fast, single-run mutex over the fixed 5173/4173 ports (README §1.3/3.1 "同時第二個run立即
 * 失敗並指出owner manifest"). Never inspects/kills the existing owner — only reports it.
 */
async function acquireLock(workspaceRoot: string, runToken: string): Promise<void> {
  const root = stage10Root(workspaceRoot);
  await fs.mkdir(root, { recursive: true });
  const file = lockPath(workspaceRoot);
  const payload = JSON.stringify({ runToken, pid: process.pid, startedAt: new Date().toISOString() }, null, 2);
  try {
    await fs.writeFile(file, payload, { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      let owner: unknown;
      try {
        owner = JSON.parse(await fs.readFile(file, 'utf8'));
      } catch {
        owner = undefined;
      }
      throw new Stage10ReentryError(file, owner);
    }
    throw error;
  }
}

async function releaseLock(workspaceRoot: string): Promise<void> {
  await fs.rm(lockPath(workspaceRoot), { force: true });
}

// ---------------------------------------------------------------------------
// Outside sentinel — proves the real history root's file tree/mtimes never moved (NFR-51.3).
// ---------------------------------------------------------------------------

interface DirEntrySnapshot {
  readonly relPath: string;
  readonly size: number;
  readonly mtimeMs: number;
}

interface RealRootSnapshot {
  readonly realHistoryRoot: string;
  readonly existed: boolean;
  readonly entries: readonly DirEntrySnapshot[];
}

async function snapshotRealRoot(root: string): Promise<RealRootSnapshot> {
  const entries: DirEntrySnapshot[] = [];
  let existed = true;
  try {
    await fs.access(root);
  } catch {
    existed = false;
  }

  async function walk(dir: string): Promise<void> {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        await walk(full);
      } else if (item.isFile()) {
        const stat = await fs.stat(full);
        entries.push({
          relPath: path.relative(root, full).split(path.sep).join('/'),
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
      }
    }
  }
  if (existed) await walk(root);
  entries.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return { realHistoryRoot: path.resolve(root), existed, entries };
}

/** Exported for reuse by standalone specs (e.g. `tests/e2e/stage10-failure-recovery.spec.ts`) that
 * need the same before/after real-root proof without allocating a full `Stage10AcceptanceEnvironment`
 * (single source of truth for the sentinel format, NFR-51.3). */
export async function writeOutsideSentinel(sentinelPath: string, realHistoryRoot: string): Promise<void> {
  const snapshot = await snapshotRealRoot(realHistoryRoot);
  await fs.mkdir(path.dirname(sentinelPath), { recursive: true });
  await fs.writeFile(sentinelPath, JSON.stringify(snapshot, null, 2), 'utf8');
}

export interface OutsideSentinelCheck {
  readonly ok: boolean;
  readonly reason?: string;
}

export async function verifyOutsideSentinelUnchanged(sentinelPath: string): Promise<OutsideSentinelCheck> {
  const before = JSON.parse(await fs.readFile(sentinelPath, 'utf8')) as RealRootSnapshot;
  const after = await snapshotRealRoot(before.realHistoryRoot);
  if (before.existed !== after.existed) {
    return {
      ok: false,
      reason: `real history root existence changed (before=${before.existed}, after=${after.existed}): ${before.realHistoryRoot}`,
    };
  }
  if (JSON.stringify(before.entries) !== JSON.stringify(after.entries)) {
    return { ok: false, reason: `real history root file tree/mtimes changed during the run: ${before.realHistoryRoot}` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Allocate / cleanup
// ---------------------------------------------------------------------------

export async function allocateStage10Environment(
  options: AllocateStage10EnvironmentOptions = {},
): Promise<Stage10AcceptanceEnvironment> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const runToken = options.runToken ?? randomUUID();
  const realHistoryRoot = path.resolve(options.realHistoryRoot ?? defaultRealHistoryRoot(workspaceRoot));

  await acquireLock(workspaceRoot, runToken);

  const root = stage10Root(workspaceRoot);
  const workspaceTempRoot = path.join(root, runToken);

  // A hostile/malformed runToken (e.g. containing `..`) must not escape the stage10 root — fail
  // closed rather than silently sanitizing it (FR-51.2, "invalid root" regression).
  if (!isLexicallyContained(root, workspaceTempRoot)) {
    await releaseLock(workspaceRoot);
    throw new Stage10ContainmentViolationError(`runToken escapes the Stage 10 root: ${JSON.stringify(runToken)}`);
  }

  const devHistoryRoot = path.join(workspaceTempRoot, 'dev');
  const previewHistoryRoot = path.join(workspaceTempRoot, 'preview');
  const downloadsRoot = path.join(workspaceTempRoot, 'downloads');
  const outsideSentinel = path.join(root, `outside-sentinel-${runToken}.json`);

  await fs.mkdir(devHistoryRoot, { recursive: true });
  await fs.mkdir(previewHistoryRoot, { recursive: true });
  await fs.mkdir(downloadsRoot, { recursive: true });
  await writeOutsideSentinel(outsideSentinel, realHistoryRoot);

  return { runToken, workspaceRoot, workspaceTempRoot, devHistoryRoot, previewHistoryRoot, downloadsRoot, outsideSentinel };
}

/**
 * Cleanup order (README §2.7): sentinel/containment check BEFORE any deletion. On failure, the run
 * root is left in place as evidence and `{ ok: false }` is returned — the lock is still released
 * (in `finally`) so a later run is not permanently blocked by one broken cleanup.
 */
export async function cleanupStage10Environment(
  env: Stage10AcceptanceEnvironment,
): Promise<CleanupStage10EnvironmentResult> {
  const root = stage10Root(env.workspaceRoot);
  try {
    if (!isLexicallyContained(root, env.workspaceTempRoot)) {
      return { ok: false, reason: `refusing to delete a run root outside ${root}: ${env.workspaceTempRoot}` };
    }
    const sentinelCheck = await verifyOutsideSentinelUnchanged(env.outsideSentinel);
    if (!sentinelCheck.ok) {
      return { ok: false, reason: sentinelCheck.reason };
    }
    await fs.rm(env.workspaceTempRoot, { recursive: true, force: true });
    await fs.rm(env.outsideSentinel, { force: true });
    return { ok: true };
  } finally {
    await releaseLock(env.workspaceRoot);
  }
}
