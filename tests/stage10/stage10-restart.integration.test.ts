import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExportPayload } from '../../src/data/export.ts';
import type { HistoryRunSummary } from '../../src/history/contracts.ts';
import { createHistoryRepository, PracticeNotArchivableError, type HistoryRepository } from '../../server/history/HistoryRepository.ts';
import { createDrillMetricRegistry } from '../../src/history/DrillMetricRegistry.ts';
import { checkCompatibility } from '../../src/metrics/compatibilityKey.ts';
import { buildStage10Fixtures } from './Stage10FixtureFactory.ts';
import { makeTempRoot, removeTempRoot } from '../history/testHelpers.ts';

const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

/**
 * WP-51 T2 (FR-51.4) — server restart must rebuild the Participant/drill/run index from JSON only,
 * with the same ordering/identity as before. `tests/history/historyRepository.test.ts` already
 * proves the base mechanism for one run (WP-48 exit evidence); `Stage10FixtureFactory.test.ts`
 * already proves tie-break distinctness, cohort separation, unregistered-metric projection and
 * bootstrap corrupt/unsupported discovery all hold within one live repository instance. The one
 * thing neither proves — and the one thing FR-51.4 is actually about — is whether all of that
 * *together* survives a close()+reopen() on the same root, i.e. a second repository instance that
 * shares no in-memory state with the first.
 */
async function snapshotRoster(repo: HistoryRepository): Promise<{
  readonly participantOrder: readonly string[];
  readonly runsByParticipantDrill: Record<string, readonly HistoryRunSummary[]>;
  readonly loadedById: Record<string, ExportPayload>;
}> {
  const participants = repo.listParticipants();
  const runsByParticipantDrill: Record<string, readonly HistoryRunSummary[]> = {};
  const loadedById: Record<string, ExportPayload> = {};
  for (const participant of participants) {
    for (const drill of repo.listDrills(participant.participantId)) {
      const runs = repo.listRuns(participant.participantId, drill.drillId);
      runsByParticipantDrill[`${participant.participantId}:${drill.drillId}`] = runs;
      for (const run of runs) {
        const loaded = await repo.loadRun(run.runId);
        if (loaded !== undefined) loadedById[run.runId] = loaded;
      }
    }
  }
  return { participantOrder: participants.map((p) => p.participantId), runsByParticipantDrill, loadedById };
}

describe('Stage 10 T2 — restart rebuilds the full fixture roster identically from JSON (FR-51.4)', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTempRoot();
  });

  afterEach(async () => {
    await removeTempRoot(root);
  });

  it('participant tie-break order, exact grouping, cohort separation, unregistered-metric and bootstrap counts survive a restart', async () => {
    const { manifest, assessmentPayloads, practicePayload, corruptFixtures, unsupportedFixtures } = buildStage10Fixtures('restart-check');
    const [participantA, participantB] = manifest.syntheticParticipantIds;

    // Bootstrap-only corrupt/unsupported files must exist before the FIRST initialize() — same rule
    // the real acceptance runner follows (README §1.3/§2.3).
    for (const fixture of [...corruptFixtures, ...unsupportedFixtures]) {
      await fs.writeFile(path.join(root, fixture.relativePath), fixture.content, 'utf8');
    }

    const first = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    const firstReport = await first.initialize();
    for (const payload of assessmentPayloads) {
      const result = await first.saveRun(payload);
      if (result.disposition === 'conflict') throw new Error(`unexpected conflict saving ${payload.meta.drillId}`);
    }
    await expect(first.saveRun(practicePayload)).rejects.toBeInstanceOf(PracticeNotArchivableError);
    const before = await snapshotRoster(first);
    await first.close();

    // "Restart": a fresh repository instance on the same root, sharing no in-memory state with `first`.
    const second = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    const secondReport = await second.initialize();
    const after = await snapshotRoster(second);

    // `initialize()`'s report is a snapshot taken at that call — `firstReport` was taken before any
    // saveRun(), so only the bootstrap corrupt/unsupported counts are comparable across the two
    // instances; the rebuilt valid-run count on restart must match the runs actually saved.
    expect(secondReport.invalidFileCount).toBe(firstReport.invalidFileCount);
    expect(secondReport.unsupportedFileCount).toBe(firstReport.unsupportedFileCount);
    expect(secondReport.validRunCount).toBe(assessmentPayloads.length);
    expect(after).toEqual(before);

    // Both synthetic participants share the same latestStartedAt (the counterstrafe-cued-v1 tie) —
    // the participantId tie-break order must be identical before and after the rebuild.
    expect(before.participantOrder).toEqual(manifest.syntheticParticipantIds);
    expect(after.participantOrder).toEqual(manifest.syntheticParticipantIds);
    expect(after.runsByParticipantDrill[`${participantB}:counterstrafe-cued-v1`]).toHaveLength(1);

    // Exact grouping never merges the two spider-shot-v2 cohort runs into one bucket, restart or not.
    const cohortKey = `${participantA}:spider-shot-v2`;
    const cohortRunIds = (after.runsByParticipantDrill[cohortKey] ?? []).map((r) => r.runId);
    expect(cohortRunIds).toHaveLength(2);

    // The reloaded (post-restart) payloads still carry the exact sensitivity/fovDeg fields the
    // WP-49 compatibility-key split depends on — the registry still classifies them as two
    // incompatible cohorts, not merely a byte-identical blob nobody re-checked semantically.
    const registry = createDrillMetricRegistry();
    const [resultA, resultB] = cohortRunIds.map((id) => registry.project(after.loadedById[id]!));
    expect(resultA!.status).toBe('ready');
    expect(resultB!.status).toBe('ready');
    if (resultA!.status === 'ready' && resultB!.status === 'ready') {
      expect(checkCompatibility(resultA!.compatibilityKey, resultB!.compatibilityKey)).toBe(false);
    }

    // The unregistered-metric drill (hold_click_v1) is still present and still projects as such.
    const unknownRunIds = after.runsByParticipantDrill[`${participantA}:hold_click_v1`] ?? [];
    expect(unknownRunIds).toHaveLength(1);
    expect(registry.project(after.loadedById[unknownRunIds[0]!.runId]!)).toMatchObject({ status: 'unregistered-drill' });

    // Practice never made it to disk, so it cannot reappear after a rebuild.
    expect(manifest.practiceRunId in after.loadedById).toBe(false);
    expect(after.runsByParticipantDrill[`${participantA}:hold_track_v1`]).toBeUndefined();

    await second.close();
  });
});
