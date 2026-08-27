import type { Dirent } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { canonicalExportJSON, parseExportPayload } from '../../src/data/exportPayloadSchema.ts';
import type { ExportPayload } from '../../src/data/export.ts';
import type {
  HistoryDrillSummary,
  HistoryIndexReport,
  HistoryParticipantSummary,
  HistoryRunSummary,
  SaveHistoryRunResult,
} from '../../src/history/contracts.ts';
import {
  buildIdentitySegment,
  buildRunFilename,
  buildRunId,
  buildRunIdentity,
  isLexicallyContained,
  sha256Hex,
} from './historyPaths.ts';

/**
 * Filesystem-backed, HTTP/Vite/DOM-agnostic history repository (WP-48 T2, README §2.4). JSON on
 * disk is the only source of truth (D-48.P3) — `runsById` is a rebuildable in-memory index, never
 * persisted itself. One process owns one root at a time via a lease file (§2.6); mutations run
 * through a single serialized queue so identity checks and atomic publication never interleave.
 */

const LEASE_FILE_NAME = '.history-root.lease';

export class HistoryRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class HistoryRootLockedError extends HistoryRepositoryError {}
export class PracticeNotArchivableError extends HistoryRepositoryError {}
export class MissingParticipantError extends HistoryRepositoryError {}
export class PayloadTooLargeError extends HistoryRepositoryError {}
export class HistoryContainmentError extends HistoryRepositoryError {}

export interface HistoryRepository {
  initialize(): Promise<HistoryIndexReport>;
  saveRun(payload: ExportPayload): Promise<SaveHistoryRunResult>;
  listParticipants(): readonly HistoryParticipantSummary[];
  listDrills(participantId: string): readonly HistoryDrillSummary[];
  listRuns(participantId: string, drillId: string): readonly HistoryRunSummary[];
  loadRun(runId: string): Promise<ExportPayload | undefined>;
  close(): Promise<void>;
}

export interface CreateHistoryRepositoryOptions {
  readonly root: string;
  readonly maxPayloadBytes: number;
  readonly now?: () => Date;
}

export function createHistoryRepository(options: CreateHistoryRepositoryOptions): HistoryRepository {
  return new FilesystemHistoryRepository(options);
}

interface RunIndexEntry {
  readonly summary: HistoryRunSummary;
  readonly filePath: string;
  readonly contentHash: string;
}

interface MutableIndexStats {
  validRunCount: number;
  invalidFileCount: number;
  unsupportedFileCount: number;
  excludedPracticeFileCount: number;
}

function compareString(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

class FilesystemHistoryRepository implements HistoryRepository {
  private readonly root: string;
  private readonly maxPayloadBytes: number;
  private readonly now: () => Date;
  private readonly leasePath: string;
  private realRoot: string | undefined;
  private leaseAcquired = false;
  private closed = false;
  private mutationTail: Promise<void> = Promise.resolve();
  private runsById = new Map<string, RunIndexEntry>();

  constructor(options: CreateHistoryRepositoryOptions) {
    this.root = path.resolve(options.root);
    this.maxPayloadBytes = options.maxPayloadBytes;
    this.now = options.now ?? (() => new Date());
    this.leasePath = path.join(this.root, LEASE_FILE_NAME);
  }

  async initialize(): Promise<HistoryIndexReport> {
    if (this.closed) throw new HistoryRepositoryError('repository is closed');
    await fs.mkdir(this.root, { recursive: true });
    await this.acquireLease();
    this.realRoot = await fs.realpath(this.root);

    const stats: MutableIndexStats = {
      validRunCount: 0,
      invalidFileCount: 0,
      unsupportedFileCount: 0,
      excludedPracticeFileCount: 0,
    };
    this.runsById = new Map();
    await this.scanDirectory(this.root, stats);
    return { ...stats, rebuiltAt: this.now().toISOString() };
  }

  async saveRun(payload: ExportPayload): Promise<SaveHistoryRunResult> {
    this.ensureInitialized();
    if (payload.meta.assessment === undefined) {
      throw new PracticeNotArchivableError('practice runs are not archivable (D-48.P7)');
    }
    const participantId = payload.meta.session?.participantId?.trim();
    if (participantId === undefined || participantId === '') {
      throw new MissingParticipantError('meta.session.participantId is required to archive a run');
    }

    const canonical = canonicalExportJSON(payload);
    if (Buffer.byteLength(canonical, 'utf8') > this.maxPayloadBytes) {
      throw new PayloadTooLargeError(`payload exceeds the ${this.maxPayloadBytes}-byte limit`);
    }

    return this.enqueue(() => this.saveRunLocked(payload, participantId, canonical));
  }

  listParticipants(): readonly HistoryParticipantSummary[] {
    this.ensureInitialized();
    const byParticipant = new Map<string, { drills: Set<string>; runCount: number; latestStartedAt: string }>();
    for (const entry of this.runsById.values()) {
      const s = entry.summary;
      let agg = byParticipant.get(s.participantId);
      if (agg === undefined) {
        agg = { drills: new Set(), runCount: 0, latestStartedAt: s.startedAt };
        byParticipant.set(s.participantId, agg);
      }
      agg.drills.add(s.drillId);
      agg.runCount += 1;
      if (s.startedAt > agg.latestStartedAt) agg.latestStartedAt = s.startedAt;
    }
    const result: HistoryParticipantSummary[] = [];
    for (const [participantId, agg] of byParticipant) {
      result.push({ participantId, drillCount: agg.drills.size, runCount: agg.runCount, latestStartedAt: agg.latestStartedAt });
    }
    result.sort((a, b) => (a.latestStartedAt === b.latestStartedAt ? compareString(a.participantId, b.participantId) : compareString(b.latestStartedAt, a.latestStartedAt)));
    return result;
  }

  listDrills(participantId: string): readonly HistoryDrillSummary[] {
    this.ensureInitialized();
    const byDrill = new Map<string, { runCount: number; latestStartedAt: string }>();
    for (const entry of this.runsById.values()) {
      const s = entry.summary;
      if (s.participantId !== participantId) continue;
      let agg = byDrill.get(s.drillId);
      if (agg === undefined) {
        agg = { runCount: 0, latestStartedAt: s.startedAt };
        byDrill.set(s.drillId, agg);
      }
      agg.runCount += 1;
      if (s.startedAt > agg.latestStartedAt) agg.latestStartedAt = s.startedAt;
    }
    const result: HistoryDrillSummary[] = [];
    for (const [drillId, agg] of byDrill) result.push({ drillId, runCount: agg.runCount, latestStartedAt: agg.latestStartedAt });
    result.sort((a, b) => (a.latestStartedAt === b.latestStartedAt ? compareString(a.drillId, b.drillId) : compareString(b.latestStartedAt, a.latestStartedAt)));
    return result;
  }

  listRuns(participantId: string, drillId: string): readonly HistoryRunSummary[] {
    this.ensureInitialized();
    const result: HistoryRunSummary[] = [];
    for (const entry of this.runsById.values()) {
      if (entry.summary.participantId === participantId && entry.summary.drillId === drillId) result.push(entry.summary);
    }
    result.sort((a, b) => (a.startedAt === b.startedAt ? compareString(a.runId, b.runId) : compareString(b.startedAt, a.startedAt)));
    return result;
  }

  async loadRun(runId: string): Promise<ExportPayload | undefined> {
    this.ensureInitialized();
    const entry = this.runsById.get(runId);
    if (entry === undefined) return undefined;

    const real = await fs.realpath(entry.filePath).catch(() => undefined);
    if (real === undefined || !this.isWithinRealRoot(real)) return undefined;

    let raw: string;
    try {
      raw = await fs.readFile(entry.filePath, 'utf8');
    } catch {
      return undefined;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return undefined;
    }
    const result = parseExportPayload(json);
    if (!result.ok || result.payload.meta.assessment === undefined) return undefined;

    const participantId = result.payload.meta.session?.participantId?.trim();
    if (participantId === undefined || participantId === '') return undefined;
    const identity = buildRunIdentity(result.payload.meta.schemaVersion, participantId, result.payload.meta.drillId, result.payload.meta.startedAt);
    if (buildRunId(identity) !== runId) return undefined;

    return result.payload;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.mutationTail.catch(() => {});
    if (this.leaseAcquired) {
      await fs.unlink(this.leasePath).catch(() => {});
      this.leaseAcquired = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private ensureInitialized(): void {
    if (this.realRoot === undefined) throw new HistoryRepositoryError('repository has not been initialized');
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.mutationTail.then(task, task);
    this.mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private isWithinRealRoot(real: string): boolean {
    if (this.realRoot === undefined) return false;
    return real === this.realRoot || isLexicallyContained(this.realRoot, real);
  }

  /** Exclusive-create lease file; on EEXIST, reclaim it iff the owning pid is no longer alive
   * (§2.6 stale-lease recovery, T0 PoC3). Never surfaces the history root path (safe diagnostics,
   * FR-48.6/48.11). */
  private async acquireLease(): Promise<void> {
    if (this.leaseAcquired) return;
    const leaseBody = JSON.stringify({ pid: process.pid, startedAt: this.now().toISOString() });

    const tryCreate = async (): Promise<boolean> => {
      try {
        const handle = await fs.open(this.leasePath, 'wx');
        try {
          await handle.writeFile(leaseBody, 'utf8');
        } finally {
          await handle.close();
        }
        return true;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
        throw err;
      }
    };

    if (await tryCreate()) {
      this.leaseAcquired = true;
      return;
    }

    if (!(await this.isLeaseStale())) {
      throw new HistoryRootLockedError('history root is already owned by another process');
    }
    await fs.unlink(this.leasePath).catch(() => {});

    if (!(await tryCreate())) {
      throw new HistoryRootLockedError('history root is already owned by another process');
    }
    this.leaseAcquired = true;
  }

  private async isLeaseStale(): Promise<boolean> {
    let raw: string;
    try {
      raw = await fs.readFile(this.leasePath, 'utf8');
    } catch {
      return true;
    }
    let lease: { pid?: unknown };
    try {
      lease = JSON.parse(raw) as { pid?: unknown };
    } catch {
      return true;
    }
    const pid = typeof lease.pid === 'number' ? lease.pid : undefined;
    if (pid === undefined) return true;
    return !isProcessAlive(pid);
  }

  private async scanDirectory(dir: string, stats: MutableIndexStats): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name === LEASE_FILE_NAME) continue;
      const abs = path.join(dir, entry.name);

      if (entry.isSymbolicLink() || entry.isDirectory()) {
        const real = await fs.realpath(abs).catch(() => undefined);
        if (real === undefined || !this.isWithinRealRoot(real)) continue;
        const stat = await fs.stat(abs).catch(() => undefined);
        if (stat?.isDirectory()) await this.scanDirectory(abs, stats);
        continue;
      }

      if (!entry.isFile()) continue;
      if (abs.endsWith('.json.tmp')) {
        await fs.unlink(abs).catch(() => {});
        continue;
      }
      if (!abs.endsWith('.json')) continue;
      await this.indexCandidateFile(abs, dir, stats);
    }
  }

  private async indexCandidateFile(abs: string, dir: string, stats: MutableIndexStats): Promise<void> {
    let raw: string;
    try {
      raw = await fs.readFile(abs, 'utf8');
    } catch {
      stats.invalidFileCount += 1;
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      stats.invalidFileCount += 1;
      return;
    }
    const result = parseExportPayload(json);
    if (!result.ok) {
      if (result.errors.some((e) => e.code === 'unsupported_schema')) stats.unsupportedFileCount += 1;
      else stats.invalidFileCount += 1;
      return;
    }
    const payload = result.payload;
    if (payload.meta.assessment === undefined) {
      stats.excludedPracticeFileCount += 1;
      return;
    }
    const participantId = payload.meta.session?.participantId?.trim();
    if (participantId === undefined || participantId === '') {
      stats.invalidFileCount += 1;
      return;
    }

    const expectedParticipantSeg = buildIdentitySegment(participantId);
    const expectedDrillSeg = buildIdentitySegment(payload.meta.drillId);
    if (path.basename(dir) !== expectedDrillSeg || path.basename(path.dirname(dir)) !== expectedParticipantSeg) {
      stats.invalidFileCount += 1;
      return;
    }

    const identity = buildRunIdentity(payload.meta.schemaVersion, participantId, payload.meta.drillId, payload.meta.startedAt);
    const runId = buildRunId(identity);
    if (path.basename(abs) !== buildRunFilename(payload.meta.startedAt, runId)) {
      stats.invalidFileCount += 1;
      return;
    }
    if (this.runsById.has(runId)) {
      stats.invalidFileCount += 1;
      return;
    }

    const summary: HistoryRunSummary = {
      runId,
      participantId,
      drillId: payload.meta.drillId,
      startedAt: payload.meta.startedAt,
      schemaVersion: payload.meta.schemaVersion,
      suspect: payload.meta.suspect,
      byteLength: Buffer.byteLength(raw, 'utf8'),
      replaySupport: 'unchecked',
    };
    this.runsById.set(runId, { summary, filePath: abs, contentHash: sha256Hex(canonicalExportJSON(payload)) });
    stats.validRunCount += 1;
  }

  private async saveRunLocked(payload: ExportPayload, participantId: string, canonical: string): Promise<SaveHistoryRunResult> {
    const identity = buildRunIdentity(payload.meta.schemaVersion, participantId, payload.meta.drillId, payload.meta.startedAt);
    const runId = buildRunId(identity);
    const contentHash = sha256Hex(canonical);

    const existing = this.runsById.get(runId);
    if (existing !== undefined) {
      if (existing.contentHash === contentHash) return { disposition: 'existing', run: existing.summary };
      return { disposition: 'conflict', runId };
    }

    const participantSeg = buildIdentitySegment(participantId);
    const drillSeg = buildIdentitySegment(payload.meta.drillId);
    const filename = buildRunFilename(payload.meta.startedAt, runId);
    const dirPath = path.join(this.root, participantSeg, drillSeg);
    const finalPath = path.join(dirPath, filename);
    const tmpPath = `${finalPath}.tmp`;

    if (!isLexicallyContained(this.root, finalPath)) {
      throw new HistoryContainmentError('derived run path escapes the history root');
    }
    await this.assertContainedOnDisk(dirPath);

    await fs.mkdir(dirPath, { recursive: true });
    const text = `${JSON.stringify(payload, null, 2)}\n`;
    const handle = await fs.open(tmpPath, 'w');
    try {
      await handle.writeFile(text, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmpPath, finalPath);

    const summary: HistoryRunSummary = {
      runId,
      participantId,
      drillId: payload.meta.drillId,
      startedAt: payload.meta.startedAt,
      schemaVersion: payload.meta.schemaVersion,
      suspect: payload.meta.suspect,
      byteLength: Buffer.byteLength(text, 'utf8'),
      replaySupport: 'unchecked',
    };
    this.runsById.set(runId, { summary, filePath: finalPath, contentHash });
    return { disposition: 'created', run: summary };
  }

  /** Walk up from `targetDir` to the nearest existing ancestor and realpath-verify it is still
   * inside the root — catches a symlink/junction planted inside the root before we ever write
   * through it (T0 PoC1; must run before `mkdir`, not after). */
  private async assertContainedOnDisk(targetDir: string): Promise<void> {
    let dir = targetDir;
    for (;;) {
      let real: string;
      try {
        real = await fs.realpath(dir);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          const parent = path.dirname(dir);
          if (parent === dir) return;
          dir = parent;
          continue;
        }
        throw err;
      }
      if (!this.isWithinRealRoot(real)) {
        throw new HistoryContainmentError('history root is compromised by a symlink/junction escape');
      }
      return;
    }
  }
}
