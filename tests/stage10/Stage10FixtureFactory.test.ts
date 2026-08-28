import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHistoryRepository, PracticeNotArchivableError, type HistoryRepository } from '../../server/history/HistoryRepository.ts';
import { parseExportPayload } from '../../src/data/exportPayloadSchema.ts';
import { createDrillMetricRegistry } from '../../src/history/DrillMetricRegistry.ts';
import { buildCompatibilityKey, checkCompatibility } from '../../src/metrics/compatibilityKey.ts';
import { buildStage10Fixtures } from './Stage10FixtureFactory.ts';
import { makeTempRoot, removeTempRoot } from '../history/testHelpers.ts';

const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

describe('buildStage10Fixtures — determinism and identity', () => {
  it('is deterministic for a given runToken and unique across different runTokens', () => {
    const a1 = buildStage10Fixtures('run-a');
    const a2 = buildStage10Fixtures('run-a');
    const b = buildStage10Fixtures('run-b');

    expect(a2.manifest).toEqual(a1.manifest);
    expect(a1.manifest.syntheticParticipantIds).not.toEqual(b.manifest.syntheticParticipantIds);
    expect(new Set(a1.manifest.assessmentRunIds).size).toBe(a1.manifest.assessmentRunIds.length);
  });

  it('only uses synthetic, runToken-scoped participant ids', () => {
    const { manifest, assessmentPayloads, practicePayload } = buildStage10Fixtures('scope-check');
    for (const id of manifest.syntheticParticipantIds) {
      expect(id).toContain('scope-check');
    }
    for (const payload of [...assessmentPayloads, practicePayload]) {
      expect(manifest.syntheticParticipantIds).toContain(payload.meta.session?.participantId);
    }
  });
});

describe('buildStage10Fixtures — assessment/practice payloads round-trip through the real repository', () => {
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

  it('saves every assessment payload and its precomputed runId matches the repository result', async () => {
    const { manifest, assessmentPayloads } = buildStage10Fixtures('repo-check');
    const savedRunIds: string[] = [];
    for (const payload of assessmentPayloads) {
      const result = await repo.saveRun(payload);
      if (result.disposition !== 'created') throw new Error(`expected 'created', got ${result.disposition}`);
      savedRunIds.push(result.run.runId);
    }
    expect(savedRunIds).toEqual(manifest.assessmentRunIds);
  });

  it('rejects the practice payload without archiving it, and its precomputed runId is never used', async () => {
    const { practicePayload, manifest } = buildStage10Fixtures('practice-check');
    await expect(repo.saveRun(practicePayload)).rejects.toBeInstanceOf(PracticeNotArchivableError);
    expect(repo.listParticipants()).toEqual([]);
    expect(manifest.practiceRunId).toEqual(expect.any(String));
  });

  it('the tie-break pair shares startedAt but resolves to two distinct runs under listRuns', async () => {
    const { assessmentPayloads } = buildStage10Fixtures('tie-check');
    const tieRuns = assessmentPayloads.filter((p) => p.meta.drillId === 'counterstrafe-cued-v1');
    expect(tieRuns).toHaveLength(2);
    expect(tieRuns[0]?.meta.startedAt).toBe(tieRuns[1]?.meta.startedAt);

    for (const payload of tieRuns) await repo.saveRun(payload);
    for (const participantId of new Set(tieRuns.map((p) => p.meta.session?.participantId))) {
      if (participantId === undefined) continue;
      const runs = repo.listRuns(participantId, 'counterstrafe-cued-v1');
      expect(runs).toHaveLength(1);
    }
  });
});

describe('buildStage10Fixtures — cohort/metric coverage', () => {
  it('produces an unregistered-metric drill (hold_click_v1 has no DrillMetricRegistry entry)', () => {
    const { assessmentPayloads } = buildStage10Fixtures('metric-check');
    const registry = createDrillMetricRegistry();
    const unknown = assessmentPayloads.find((p) => p.meta.drillId === 'hold_click_v1');
    expect(unknown).toBeDefined();
    expect(registry.project(unknown!)).toMatchObject({ status: 'unregistered-drill' });
  });

  it('produces two spider-shot-v2 runs with incompatible cohort keys (different sensitivity)', () => {
    const { assessmentPayloads } = buildStage10Fixtures('cohort-check');
    const spiderRuns = assessmentPayloads.filter((p) => p.meta.drillId === 'spider-shot-v2');
    expect(spiderRuns).toHaveLength(2);
    const [runA, runB] = spiderRuns;
    expect(runA!.meta.sensitivity).not.toBe(runB!.meta.sensitivity);

    const keyA = buildCompatibilityKey(runA!.meta, 'spider-shot-v2', 'condition-cell', 'ok');
    const keyB = buildCompatibilityKey(runB!.meta, 'spider-shot-v2', 'condition-cell', 'ok');
    expect(checkCompatibility(keyA, keyB)).toBe(false);

    // End-to-end: the real registry must actually reach 'ready' (not silently fall back to
    // invalid-metric for missing fields) so the cohort split is genuinely observable downstream.
    const registry = createDrillMetricRegistry();
    const resultA = registry.project(runA!);
    const resultB = registry.project(runB!);
    expect(resultA.status).toBe('ready');
    expect(resultB.status).toBe('ready');
    if (resultA.status === 'ready' && resultB.status === 'ready') {
      expect(checkCompatibility(resultA.compatibilityKey, resultB.compatibilityKey)).toBe(false);
    }
  });
});

describe('buildStage10Fixtures — corrupt/unsupported bootstrap fixtures', () => {
  it('corrupt fixture content fails JSON.parse', () => {
    const { corruptFixtures } = buildStage10Fixtures('corrupt-check');
    expect(corruptFixtures).toHaveLength(1);
    expect(() => JSON.parse(corruptFixtures[0]!.content)).toThrow();
  });

  it('unsupported fixture content is well-formed JSON that parseExportPayload rejects as unsupported_schema', () => {
    const { unsupportedFixtures } = buildStage10Fixtures('unsupported-check');
    expect(unsupportedFixtures).toHaveLength(1);
    const json = JSON.parse(unsupportedFixtures[0]!.content);
    const result = parseExportPayload(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'unsupported_schema')).toBe(true);
    }
  });

  it('bootstrap fixtures are discovered as invalid/unsupported when written directly under a repository root before initialize', async () => {
    const root = await makeTempRoot();
    try {
      const { corruptFixtures, unsupportedFixtures } = buildStage10Fixtures('bootstrap-check');
      for (const fixture of [...corruptFixtures, ...unsupportedFixtures]) {
        await fs.writeFile(path.join(root, fixture.relativePath), fixture.content, 'utf8');
      }
      const repo = createHistoryRepository({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
      const report = await repo.initialize();
      expect(report.invalidFileCount).toBe(corruptFixtures.length);
      expect(report.unsupportedFileCount).toBe(unsupportedFixtures.length);
      await repo.close();
    } finally {
      await removeTempRoot(root);
    }
  });
});
