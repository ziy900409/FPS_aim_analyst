import type { ExportPayload } from '../../src/data/export.ts';
import { buildRunId, buildRunIdentity } from '../../server/history/historyPaths.ts';
import { makeAssessmentPayload } from '../history/payloadFixtures.ts';

/**
 * WP-51 T1 — deterministic synthetic Assessment/Practice fixtures for the Stage 10 acceptance
 * runner (README §2.2 `Stage10FixtureManifest`, T1-acceptance-harness.md Work item 4). Every
 * identity is derived from `runToken` so parallel/repeated Stage 10 runs never collide, and every
 * `runId` is precomputed with the same pure `buildRunIdentity`/`buildRunId` the real
 * `HistoryRepository` uses (server/history/historyPaths.ts) — no guessing, no duplicate hashing
 * logic (README §5 "只用synthetic IDs").
 *
 * Only two exact drills are exercised here: `spider-shot-v2` (the sole `DrillMetricRegistry`
 * registration, src/history/DrillMetricRegistry.ts) to get a real cohort/compatibility-key signal,
 * and `hold_click_v1` (an official Assessment exact id per WP-50 T0's roster,
 * docs/exec-plan/active/stage10/wp-50-3d-state-replay/progress.md) to get the "unregistered
 * metric" branch. Full/partial/unsupported/invalid *Replay* support fixtures are deferred —
 * WP-50 has not yet shipped `replayCompatibility.ts`/the replay schema (only T0 planning exists),
 * so there is nothing to classify against yet; that lands with WP-51 T2 once WP-50 ships (see
 * progress.md).
 */

export interface Stage10FixtureManifest {
  readonly syntheticParticipantIds: readonly string[];
  readonly assessmentRunIds: readonly string[];
  readonly practiceRunId: string;
  readonly corruptRelativePaths: readonly string[];
  readonly unsupportedRelativePaths: readonly string[];
}

export interface Stage10BootstrapFileFixture {
  /** Path relative to the target History root (server/history/HistoryRepository.ts on-disk layout is
   * a flat recursive scan for `*.json` — a corrupt/unsupported file does not need to match the
   * participant/drill segment convention to be discovered, only to sit somewhere under the root). */
  readonly relativePath: string;
  readonly content: string;
}

export interface Stage10FixtureBundle {
  readonly manifest: Stage10FixtureManifest;
  /** Valid Assessment payloads — seed these via the public `POST /api/history/runs` API only. */
  readonly assessmentPayloads: readonly ExportPayload[];
  /** A valid Practice payload — the save API must reject this (PRACTICE_NOT_ARCHIVABLE), never write it. */
  readonly practicePayload: ExportPayload;
  /** Malformed-JSON text — must be written directly to disk before the server starts (bootstrap-only,
   * README §1.3: "corrupt/unsupported bootstrap fixture可在server啟動前由runner放入該root"). */
  readonly corruptFixtures: readonly Stage10BootstrapFileFixture[];
  /** Well-formed JSON that fails `parseExportPayload` with `unsupported_schema` — same bootstrap-only rule. */
  readonly unsupportedFixtures: readonly Stage10BootstrapFileFixture[];
}

function syntheticParticipantId(runToken: string, n: number): string {
  return `stage10-${runToken}-participant-${n}`;
}

function computeRunId(payload: ExportPayload): string {
  const participantId = payload.meta.session?.participantId ?? '';
  const identity = buildRunIdentity(payload.meta.schemaVersion, participantId, payload.meta.drillId, payload.meta.startedAt);
  return buildRunId(identity);
}

/** `fovDeg` is optional on `Meta` (src/data/metadata.ts) but `buildCompatibilityKey`'s
 * `sensitivityFovKey` (src/metrics/compatibilityKey.ts) requires it — without it every spider-shot-v2
 * payload projects as `invalid-metric` regardless of cohort, so the "incompatible cohort" fixture
 * must set it explicitly to actually exercise cohort separation end-to-end. */
function withSensitivityFov(payload: ExportPayload, sensitivity: number, fovDeg: number): ExportPayload {
  return { ...payload, meta: { ...payload.meta, sensitivity, fovDeg } };
}

export function buildStage10Fixtures(runToken: string): Stage10FixtureBundle {
  const participantA = syntheticParticipantId(runToken, 1);
  const participantB = syntheticParticipantId(runToken, 2);

  // Unregistered-metric case: hold_click_v1 has no DrillMetricRegistry registration.
  const unknownMetricRun = makeAssessmentPayload({
    participantId: participantA,
    drillId: 'hold_click_v1',
    startedAt: '2026-08-28T09:00:00.000Z',
  });

  // Incompatible cohort: same participant/drill (spider-shot-v2, the one registered drill) but a
  // different `sensitivity` — buildCompatibilityKey's sensitivityFovKey differs, so these two runs
  // must NOT be merged into one trend cohort (src/metrics/compatibilityKey.ts).
  const cohortRunA = withSensitivityFov(
    makeAssessmentPayload({ participantId: participantA, drillId: 'spider-shot-v2', startedAt: '2026-08-28T09:05:00.000Z' }),
    1,
    103,
  );
  const cohortRunB = withSensitivityFov(
    makeAssessmentPayload({ participantId: participantA, drillId: 'spider-shot-v2', startedAt: '2026-08-28T09:10:00.000Z' }),
    1.5,
    103,
  );

  // Same-instant tie-break: two different participants completing the same exact drill at the
  // identical `startedAt` — listRuns ordering must resolve the tie deterministically (not by
  // insertion order alone).
  const tieRunA = makeAssessmentPayload({
    participantId: participantA,
    drillId: 'counterstrafe-cued-v1',
    startedAt: '2026-08-28T09:15:00.000Z',
  });
  const tieRunB = makeAssessmentPayload({
    participantId: participantB,
    drillId: 'counterstrafe-cued-v1',
    startedAt: '2026-08-28T09:15:00.000Z',
  });

  const practicePayload = makeAssessmentPayload({
    participantId: participantA,
    drillId: 'hold_track_v1',
    startedAt: '2026-08-28T09:20:00.000Z',
    assessment: false,
  });

  const assessmentPayloads = [unknownMetricRun, cohortRunA, cohortRunB, tieRunA, tieRunB];

  const corruptFixtures: Stage10BootstrapFileFixture[] = [
    { relativePath: `stage10-corrupt-${runToken}.json`, content: '{ this is not valid json' },
  ];
  const unsupportedFixtures: Stage10BootstrapFileFixture[] = [
    {
      relativePath: `stage10-unsupported-${runToken}.json`,
      content: JSON.stringify({ ...unknownMetricRun, meta: { ...unknownMetricRun.meta, schemaVersion: 999 } }),
    },
  ];

  return {
    manifest: {
      syntheticParticipantIds: [participantA, participantB],
      assessmentRunIds: assessmentPayloads.map(computeRunId),
      practiceRunId: computeRunId(practicePayload),
      corruptRelativePaths: corruptFixtures.map((f) => f.relativePath),
      unsupportedRelativePaths: unsupportedFixtures.map((f) => f.relativePath),
    },
    assessmentPayloads,
    practicePayload,
    corruptFixtures,
    unsupportedFixtures,
  };
}
