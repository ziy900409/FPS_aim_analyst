import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHistoryRepository, type HistoryRepository } from '../../server/history/HistoryRepository.ts';
import { buildIdentitySegment } from '../../server/history/historyPaths.ts';
import { makeAssessmentPayload, makeTempRoot, removeTempRoot } from './testHelpers.ts';

const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

describe('HistoryRepository — concurrent saveRun (FM-48.3)', () => {
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

  it('20 concurrent saves of the identical run produce exactly one file: 1 created + 19 existing', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => repo.saveRun(makeAssessmentPayload())));
    const created = results.filter((r) => r.disposition === 'created');
    const existing = results.filter((r) => r.disposition === 'existing');
    expect(created).toHaveLength(1);
    expect(existing).toHaveLength(19);

    const runIds = new Set(results.map((r) => (r.disposition === 'conflict' ? r.runId : r.run.runId)));
    expect(runIds.size).toBe(1);

    const jsonFiles = await countJsonFiles(root);
    expect(jsonFiles).toBe(1);
  });

  it('concurrent saves of the same identity with different content: exactly one winner, the rest conflict', async () => {
    const results = await Promise.all([
      repo.saveRun(makeAssessmentPayload({ suspect: false })),
      repo.saveRun(makeAssessmentPayload({ suspect: true })),
      repo.saveRun(makeAssessmentPayload({ suspect: false })),
      repo.saveRun(makeAssessmentPayload({ suspect: true })),
    ]);

    const winners = results.filter((r) => r.disposition === 'created' || r.disposition === 'existing');
    const conflicts = results.filter((r) => r.disposition === 'conflict');
    expect(winners.length + conflicts.length).toBe(4);
    expect(winners.length).toBeGreaterThanOrEqual(1);
    // Whichever content landed first "wins"; every other distinct-content call must conflict, not overwrite.
    expect(await countJsonFiles(root)).toBe(1);
  });
});

describe('HistoryRepository — stale temp file cleanup (FM-48.2)', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTempRoot();
  });

  afterEach(async () => {
    await removeTempRoot(root);
  });

  it('a leftover .json.tmp from a simulated crash is removed and never indexed', async () => {
    const participantSeg = buildIdentitySegment('P-001');
    const drillSeg = buildIdentitySegment('counterstrafe_reversal_v1');
    const dir = path.join(root, participantSeg, drillSeg);
    await fs.mkdir(dir, { recursive: true });
    const staleTmpPath = path.join(dir, '2026-08-27T14-32-11.321Z_assessment_deadbeef0000.json.tmp');
    await fs.writeFile(staleTmpPath, JSON.stringify(makeAssessmentPayload()), 'utf8');

    const repo = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    const report = await repo.initialize();

    expect(report.validRunCount).toBe(0);
    await expect(fs.access(staleTmpPath)).rejects.toThrow();
    await repo.close();
  });
});

async function countJsonFiles(dir: string): Promise<number> {
  let count = 0;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return count;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) count += await countJsonFiles(abs);
    else if (entry.name.endsWith('.json')) count += 1;
  }
  return count;
}
