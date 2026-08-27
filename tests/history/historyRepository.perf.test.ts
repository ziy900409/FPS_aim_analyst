import { performance } from 'node:perf_hooks';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHistoryRepository, type HistoryRepository } from '../../server/history/HistoryRepository.ts';
import { buildIdentitySegment, buildRunFilename, buildRunId, buildRunIdentity } from '../../server/history/historyPaths.ts';
import { makeAssessmentPayload, makeTempRoot, removeTempRoot } from './testHelpers.ts';

/**
 * WP-48 T2 NFR-48.2/48.3 benchmark: 5,000 summary-sized run files, cold-scan rebuild time and
 * warm list P95. Opt-in (RUN_HISTORY_PERF_BENCHMARK=1) — writing + scanning 5,000 files on every
 * CI run would be slow and is not needed to gate normal PRs; the DoD requires the measurement to
 * exist and be evidence-backed, not that it runs on every `npm test`.
 */

const RUN_BENCHMARK = process.env.RUN_HISTORY_PERF_BENCHMARK === '1';
const RUN_COUNT = 5000;
const PARTICIPANT_COUNT = 100;
const DRILLS_PER_PARTICIPANT = 5;
const RUNS_PER_DRILL = RUN_COUNT / (PARTICIPANT_COUNT * DRILLS_PER_PARTICIPANT);
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

describe.skipIf(!RUN_BENCHMARK)('HistoryRepository — 5,000-run benchmark (opt-in)', () => {
  let root: string;
  let repo: HistoryRepository;

  beforeAll(async () => {
    root = await makeTempRoot('fps-history-perf-');
    await seedFixtures(root);
  }, 60_000);

  afterAll(async () => {
    await repo.close();
    await removeTempRoot(root);
  });

  it(`cold rebuild of ${RUN_COUNT} runs is under 10s`, async () => {
    repo = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    const start = performance.now();
    const report = await repo.initialize();
    const elapsedMs = performance.now() - start;
    console.log(`[history perf] cold rebuild of ${RUN_COUNT} runs: ${elapsedMs.toFixed(1)}ms`);
    expect(report.validRunCount).toBe(RUN_COUNT);
    expect(elapsedMs).toBeLessThan(10_000);
  }, 30_000);

  it('warm listParticipants/listRuns P95 is under 100ms', () => {
    const samples: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      const start = performance.now();
      repo.listParticipants();
      repo.listRuns('P-0000', 'drill-0');
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(`[history perf] warm list P95: ${p95.toFixed(3)}ms (samples: ${samples.map((s) => s.toFixed(2)).join(', ')})`);
    expect(p95).toBeLessThan(100);
  });
});

async function seedFixtures(root: string): Promise<void> {
  let startedAtCounter = 0;
  for (let p = 0; p < PARTICIPANT_COUNT; p += 1) {
    const participantId = `P-${String(p).padStart(4, '0')}`;
    for (let d = 0; d < DRILLS_PER_PARTICIPANT; d += 1) {
      const drillId = `drill-${d}`;
      const participantSeg = buildIdentitySegment(participantId);
      const drillSeg = buildIdentitySegment(drillId);
      const dir = path.join(root, participantSeg, drillSeg);
      await fs.mkdir(dir, { recursive: true });
      for (let r = 0; r < RUNS_PER_DRILL; r += 1) {
        startedAtCounter += 1;
        const startedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, startedAtCounter)).toISOString();
        const payload = makeAssessmentPayload({ participantId, drillId, startedAt });
        const identity = buildRunIdentity(2, participantId, drillId, startedAt);
        const runId = buildRunId(identity);
        const filename = buildRunFilename(startedAt, runId);
        await fs.writeFile(path.join(dir, filename), JSON.stringify(payload), 'utf8');
      }
    }
  }
}
