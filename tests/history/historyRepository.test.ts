import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createHistoryRepository,
  HistoryContainmentError,
  MissingParticipantError,
  PracticeNotArchivableError,
  type HistoryRepository,
} from '../../server/history/HistoryRepository.ts';
import { buildIdentitySegment } from '../../server/history/historyPaths.ts';
import { makeAssessmentPayload, makeTempRoot, removeTempRoot } from './testHelpers.ts';

const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

describe('HistoryRepository — initialize on an empty root', () => {
  let root: string;
  let repo: HistoryRepository;

  beforeEach(async () => {
    root = await makeTempRoot();
    repo = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
  });

  afterEach(async () => {
    await repo.close();
    await removeTempRoot(root);
  });

  it('reports zero counts and an empty participant list', async () => {
    const report = await repo.initialize();
    expect(report).toMatchObject({ validRunCount: 0, invalidFileCount: 0, unsupportedFileCount: 0, excludedPracticeFileCount: 0 });
    expect(repo.listParticipants()).toEqual([]);
  });
});

describe('HistoryRepository — saveRun archival policy', () => {
  let root: string;
  let repo: HistoryRepository;

  beforeEach(async () => {
    root = await makeTempRoot();
    repo = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    await repo.initialize();
  });

  afterEach(async () => {
    await repo.close();
    await removeTempRoot(root);
  });

  it('rejects a Practice payload without creating any file', async () => {
    const practice = makeAssessmentPayload({ assessment: false });
    await expect(repo.saveRun(practice)).rejects.toBeInstanceOf(PracticeNotArchivableError);
    await expect(listRunJsonFiles(root)).resolves.toEqual([]);
  });

  it('rejects an Assessment payload missing participantId without creating any file', async () => {
    const payload = makeAssessmentPayload();
    delete (payload.meta as { session?: unknown }).session;
    await expect(repo.saveRun(payload)).rejects.toBeInstanceOf(MissingParticipantError);
    await expect(listRunJsonFiles(root)).resolves.toEqual([]);
  });
});

describe('HistoryRepository — saveRun happy path and disk layout', () => {
  let root: string;
  let repo: HistoryRepository;

  beforeEach(async () => {
    root = await makeTempRoot();
    repo = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    await repo.initialize();
  });

  afterEach(async () => {
    await repo.close();
    await removeTempRoot(root);
  });

  it('creates a run under participant/drill hash segments with no leftover tmp file', async () => {
    const payload = makeAssessmentPayload();
    const result = await repo.saveRun(payload);
    expect(result.disposition).toBe('created');
    if (result.disposition === 'conflict') throw new Error('unexpected conflict');

    const participantSeg = buildIdentitySegment('P-001');
    const drillSeg = buildIdentitySegment('counterstrafe_reversal_v1');
    const expectedFile = path.join(root, participantSeg, drillSeg, `2026-08-27T14-32-11.321Z_assessment_${result.run.runId.slice(0, 12)}.json`);
    await expect(fs.readFile(expectedFile, 'utf8')).resolves.toContain('"schemaVersion": 2');

    const files = await listAllFiles(root);
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false);
  });

  it('same identity + same content is idempotent (existing)', async () => {
    const payload = makeAssessmentPayload();
    const first = await repo.saveRun(payload);
    const second = await repo.saveRun(makeAssessmentPayload());
    expect(first.disposition).toBe('created');
    expect(second.disposition).toBe('existing');
    if (first.disposition !== 'conflict' && second.disposition !== 'conflict') {
      expect(second.run.runId).toBe(first.run.runId);
    }
    expect((await listAllFiles(root)).filter((f) => f.endsWith('.json')).length).toBe(1);
  });

  it('same identity + different content is a conflict, not an overwrite', async () => {
    await repo.saveRun(makeAssessmentPayload());
    const result = await repo.saveRun(makeAssessmentPayload({ suspect: true }));
    expect(result.disposition).toBe('conflict');
    expect((await listAllFiles(root)).filter((f) => f.endsWith('.json')).length).toBe(1);
  });

  it('list/load reflect a saved run', async () => {
    const saved = await repo.saveRun(makeAssessmentPayload());
    if (saved.disposition === 'conflict') throw new Error('unexpected conflict');

    expect(repo.listParticipants()).toEqual([{ participantId: 'P-001', drillCount: 1, runCount: 1, latestStartedAt: '2026-08-27T14:32:11.321Z' }]);
    expect(repo.listDrills('P-001')).toEqual([{ drillId: 'counterstrafe_reversal_v1', runCount: 1, latestStartedAt: '2026-08-27T14:32:11.321Z' }]);
    expect(repo.listRuns('P-001', 'counterstrafe_reversal_v1')).toEqual([saved.run]);

    const loaded = await repo.loadRun(saved.run.runId);
    expect(loaded?.meta.drillId).toBe('counterstrafe_reversal_v1');
    expect(loaded?.meta.session?.participantId).toBe('P-001');
  });

  it('loadRun returns undefined for an unknown runId', async () => {
    await expect(repo.loadRun('0'.repeat(64))).resolves.toBeUndefined();
  });
});

describe('HistoryRepository — restart rebuilds the index from disk', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTempRoot();
  });

  afterEach(async () => {
    await removeTempRoot(root);
  });

  it('a fresh repository instance sees runs saved by a prior instance after close', async () => {
    const first = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    await first.initialize();
    const saved = await first.saveRun(makeAssessmentPayload());
    if (saved.disposition === 'conflict') throw new Error('unexpected conflict');
    await first.close();

    const second = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    const report = await second.initialize();
    expect(report.validRunCount).toBe(1);
    expect(second.listParticipants()).toHaveLength(1);
    const loaded = await second.loadRun(saved.run.runId);
    expect(loaded?.meta.session?.participantId).toBe('P-001');
    await second.close();
  });
});

describe('HistoryRepository — root lease', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTempRoot();
  });

  afterEach(async () => {
    await removeTempRoot(root);
  });

  it('refuses a second concurrent owner of the same root', async () => {
    const first = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    await first.initialize();

    const second = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    await expect(second.initialize()).rejects.toThrow(/already owned/);

    await first.close();
  });

  it('allows a new owner after the previous one closes', async () => {
    const first = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    await first.initialize();
    await first.close();

    const second = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    await expect(second.initialize()).resolves.toBeDefined();
    await second.close();
  });
});

describe('HistoryRepository — corrupt / unsupported / practice files on disk', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTempRoot();
  });

  afterEach(async () => {
    await removeTempRoot(root);
  });

  it('excludes malformed JSON, unsupported schema, and Practice files from the normal index', async () => {
    const participantSeg = buildIdentitySegment('P-001');
    const drillSeg = buildIdentitySegment('counterstrafe_reversal_v1');
    const dir = path.join(root, participantSeg, drillSeg);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(path.join(dir, 'corrupt.json'), '{not valid json', 'utf8');
    await fs.writeFile(path.join(dir, 'unsupported.json'), JSON.stringify({ meta: { schemaVersion: 1 }, ticks: [], events: [] }), 'utf8');

    const practicePayload = makeAssessmentPayload({ assessment: false });
    await fs.writeFile(path.join(dir, 'practice.json'), JSON.stringify(practicePayload), 'utf8');

    const repo = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    const report = await repo.initialize();

    expect(report.validRunCount).toBe(0);
    expect(report.invalidFileCount).toBe(1);
    expect(report.unsupportedFileCount).toBe(1);
    expect(report.excludedPracticeFileCount).toBe(1);
    expect(repo.listParticipants()).toEqual([]);
    await repo.close();
  });

  it('excludes a file whose location does not match its own metadata', async () => {
    const wrongDrillSeg = buildIdentitySegment('wrong-drill-id');
    const participantSeg = buildIdentitySegment('P-001');
    const dir = path.join(root, participantSeg, wrongDrillSeg);
    await fs.mkdir(dir, { recursive: true });
    const payload = makeAssessmentPayload();
    await fs.writeFile(path.join(dir, 'mislocated_assessment_abc.json'), JSON.stringify(payload), 'utf8');

    const repo = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    const report = await repo.initialize();
    expect(report.validRunCount).toBe(0);
    expect(report.invalidFileCount).toBe(1);
    await repo.close();
  });
});

describe('HistoryRepository — containment', () => {
  let root: string;
  let repo: HistoryRepository;

  beforeEach(async () => {
    root = await makeTempRoot();
    repo = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    await repo.initialize();
  });

  afterEach(async () => {
    await repo.close();
    await removeTempRoot(root);
  });

  it('a symlink/junction planted at the participant segment is rejected before any write', async () => {
    const outside = await makeTempRoot('fps-history-outside-');
    try {
      const participantSeg = buildIdentitySegment('P-001');
      const junctionPath = path.join(root, participantSeg);
      await fs.symlink(outside, junctionPath, process.platform === 'win32' ? 'junction' : 'dir');

      await expect(repo.saveRun(makeAssessmentPayload())).rejects.toBeInstanceOf(HistoryContainmentError);
      await expect(listAllFiles(outside)).resolves.toEqual([]);
    } finally {
      await removeTempRoot(outside);
    }
  });
});

async function listAllFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await listAllFiles(abs)));
    else result.push(abs);
  }
  return result;
}

async function listRunJsonFiles(dir: string): Promise<string[]> {
  return (await listAllFiles(dir)).filter((f) => !f.endsWith('.history-root.lease'));
}
