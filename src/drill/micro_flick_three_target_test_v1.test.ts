import { describe, expect, it, vi } from 'vitest';
import legacyDrill from '../../drills/counterstrafe_ad_v1.json';
import { createDrillMetricRegistry } from '../history/DrillMetricRegistry.ts';
import type { HistoryClient } from '../history/HistoryClient.ts';
import { createHistoryPersistence } from '../history/HistoryPersistence.ts';
import { replayProfileForExactDrill } from '../replay/replayCompatibility.ts';
import { KNOWN_SESSION_FAMILY_IDS } from '../session/sessionSchedule.ts';
import { microFlickRoom } from '../scene/scenes/micro-flick-room.ts';
import { makeAssessmentPayload } from '../../tests/history/payloadFixtures.ts';
import { loadDrill } from './DrillLoader.ts';
import {
  MICRO_FLICK_ROOM_SCENE_ID,
  MICRO_FLICK_TARGET_DIAMETER_U,
  MICRO_FLICK_THREE_TARGET_TEST_DRILL_ID,
  microFlickThreeTargetTestV1,
} from './micro_flick_three_target_test_v1.ts';
import { validateDrill } from './schema.ts';

function populationFixture(): Record<string, unknown> {
  return {
    drillId: 'population_contract_fixture',
    mode: 'practice',
    playerControl: { translation: 'locked' },
    targets: {
      count: 60,
      distance: 13,
      population: { activeCount: 3, replacement: 'next-tick' },
      spawnArea: {
        yawDegRange: [-22, 22],
        pitchDegRange: [-12, 12],
        distanceURange: [12, 14],
        minAngularSeparationDeg: 7,
      },
    },
    sequence: { alternation: 'LR', seed: 56001 },
    timing: { countdownMs: 3000 },
    endCondition: { type: 'targetCount', value: 60 },
  };
}

describe('WP-56 T1 additive contract', () => {
  it('preserves the legacy canonical fixture without injecting new defaults', () => {
    expect(loadDrill(legacyDrill)).toEqual(legacyDrill);
    const parsed = loadDrill(legacyDrill);
    expect(parsed.playerControl).toBeUndefined();
    expect(parsed.targets.population).toBeUndefined();
    expect(parsed.targets.spawnArea).toBeUndefined();
  });

  it('accepts and canonicalizes population, vertical spawn, separation, and translation lock', () => {
    const parsed = validateDrill(populationFixture());
    expect(parsed.playerControl).toEqual({ translation: 'locked' });
    expect(parsed.targets.population).toEqual({ activeCount: 3, replacement: 'next-tick' });
    expect(parsed.targets.spawnArea).toEqual({
      yawDegRange: [-22, 22],
      pitchDegRange: [-12, 12],
      distanceURange: [12, 14],
      minAngularSeparationDeg: 7,
    });
  });

  it('accepts the schema boundaries while retaining optional fields when omitted', () => {
    const lower = populationFixture();
    lower.targets = {
      count: 1,
      distance: 13,
      population: { activeCount: 1, replacement: 'next-tick' },
    };
    const upper = populationFixture();
    upper.targets = {
      count: 16,
      distance: 13,
      population: { activeCount: 16, replacement: 'next-tick' },
      spawnArea: {
        yawDegRange: [-22, 22],
        pitchDegRange: [-89, 89],
        distanceURange: [12, 14],
      },
    };

    expect(validateDrill(lower).targets.population?.activeCount).toBe(1);
    expect(validateDrill(upper).targets.population?.activeCount).toBe(16);
    expect(validateDrill(lower).targets.spawnArea).toBeUndefined();
  });

  it.each([
    ['zero active count', { activeCount: 0, replacement: 'next-tick' }, /targets\.population\.activeCount/],
    ['non-integer active count', { activeCount: 2.5, replacement: 'next-tick' }, /targets\.population\.activeCount/],
    ['above schema maximum', { activeCount: 17, replacement: 'next-tick' }, /targets\.population\.activeCount/],
    ['above total spawn budget', { activeCount: 61, replacement: 'next-tick' }, /targets\.population\.activeCount/],
    ['unknown replacement policy', { activeCount: 3, replacement: 'immediate' }, /targets\.population\.replacement/],
  ])('rejects invalid population: %s', (_label, population, path) => {
    const fixture = populationFixture();
    fixture.targets = { ...(fixture.targets as object), population };
    expect(() => validateDrill(fixture)).toThrow(path);
  });

  it('requires a seed for population even when no spawnArea is present', () => {
    const fixture = populationFixture();
    fixture.targets = {
      count: 3,
      distance: 13,
      population: { activeCount: 3, replacement: 'next-tick' },
    };
    fixture.sequence = { alternation: 'LR' };
    expect(() => validateDrill(fixture)).toThrow(/sequence\.seed/);
  });

  it('rejects out-of-safe-range pitch, non-positive separation, and separation without population', () => {
    const badPitch = populationFixture();
    badPitch.targets = {
      ...(badPitch.targets as object),
      spawnArea: {
        yawDegRange: [-22, 22],
        pitchDegRange: [-90, 12],
        distanceURange: [12, 14],
        minAngularSeparationDeg: 7,
      },
    };
    expect(() => validateDrill(badPitch)).toThrow(/targets\.spawnArea\.pitchDegRange\[0\]/);

    const zeroSeparation = populationFixture();
    zeroSeparation.targets = {
      ...(zeroSeparation.targets as object),
      spawnArea: {
        yawDegRange: [-22, 22],
        pitchDegRange: [-12, 12],
        distanceURange: [12, 14],
        minAngularSeparationDeg: 0,
      },
    };
    expect(() => validateDrill(zeroSeparation)).toThrow(/targets\.spawnArea\.minAngularSeparationDeg/);

    const noPopulation = populationFixture();
    const { population: _population, ...targets } = noPopulation.targets as Record<string, unknown>;
    noPopulation.targets = targets;
    expect(() => validateDrill(noPopulation)).toThrow(/targets\.spawnArea\.minAngularSeparationDeg/);
  });

  it('fails fast when a fixed angular field cannot contain two separated centers', () => {
    const fixture = populationFixture();
    fixture.targets = {
      ...(fixture.targets as object),
      population: { activeCount: 2, replacement: 'next-tick' },
      spawnArea: {
        yawDegRange: [0, 0],
        pitchDegRange: [0, 0],
        distanceURange: [13, 13],
        minAngularSeparationDeg: 1,
      },
    };
    expect(() => validateDrill(fixture)).toThrow(/targets\.spawnArea\.minAngularSeparationDeg/);
  });

  it.each([
    ['cue', { cue: { kind: 'single' } }, /targets\.population/],
    ['timed presentation', { timing: { countdownMs: 3000, presentationMs: 1000 } }, /timing\.presentationMs/],
    ['spawn delay', { timing: { countdownMs: 3000, spawnDelayMs: 10 } }, /timing\.spawnDelayMs/],
    ['seeded spawn delay', { sequence: { alternation: 'LR', seed: 56001, spawnDelayMsRange: [0, 10] } }, /sequence\.spawnDelayMsRange/],
  ])('rejects unsupported population combination: %s', (_label, override, path) => {
    expect(() => validateDrill({ ...populationFixture(), ...override })).toThrow(path);
  });

  it('rejects population with spider-shot or tracking trajectory contracts', () => {
    const spider = populationFixture();
    const { spawnArea: _spawnArea, ...targets } = spider.targets as Record<string, unknown>;
    spider.targets = targets;
    spider.spiderShot = {
      kind: 'center-peripheral',
      seed: 1,
      centerDistanceU: 13,
      peripheral: { angularRadiusDegRange: [7, 12], azimuthDegRange: [0, 360], distanceURange: [12, 14] },
    };
    expect(() => validateDrill(spider)).toThrow(/targets\.population/);

    const tracking = populationFixture();
    tracking.targets = {
      ...(tracking.targets as object),
      trackingTrajectory: {
        kind: 'band-limited-2d-v1',
        seed: 1,
        durationMs: 1000,
        yawBoundDeg: 10,
        pitchBoundDeg: 10,
        targetRmsSpeedDegPerSec: 10,
        frequencyBandHz: [0.2, 1],
      },
    };
    expect(() => validateDrill(tracking)).toThrow(/targets\.population/);
  });

  it('validates the additive player translation policy with an exact field path', () => {
    expect(() => validateDrill({ ...populationFixture(), playerControl: { translation: 'disabled' } })).toThrow(
      /playerControl\.translation/,
    );
  });
});

describe('micro_flick_three_target_test_v1 fixture and policy boundaries', () => {
  it('loads the exact Candidate A practice contract with a unique scene binding', () => {
    const parsed = loadDrill(microFlickThreeTargetTestV1.drill, microFlickRoom);

    expect(microFlickThreeTargetTestV1.id).toBe(MICRO_FLICK_THREE_TARGET_TEST_DRILL_ID);
    expect(microFlickThreeTargetTestV1.sceneId).toBe(MICRO_FLICK_ROOM_SCENE_ID);
    expect(microFlickRoom.sceneId).toBe(microFlickThreeTargetTestV1.sceneId);
    expect(microFlickRoom.proceduralRoom?.fovDeg).toBe(75);
    expect(parsed.drillId).toBe(MICRO_FLICK_THREE_TARGET_TEST_DRILL_ID);
    expect(parsed.mode).toBe('practice');
    expect(parsed.playerControl).toEqual({ translation: 'locked' });
    expect(parsed.targets.count).toBe(60);
    expect(parsed.targets.population).toEqual({ activeCount: 3, replacement: 'next-tick' });
    expect(parsed.targets.spawnArea).toEqual({
      yawDegRange: [-22, 22],
      pitchDegRange: [-12, 12],
      distanceURange: [12, 14],
      minAngularSeparationDeg: 7,
    });
    expect(parsed.targets.hitbox).toEqual({
      widthU: MICRO_FLICK_TARGET_DIAMETER_U,
      heightU: MICRO_FLICK_TARGET_DIAMETER_U,
      depthU: MICRO_FLICK_TARGET_DIAMETER_U,
      shape: 'sphere',
    });
    expect(MICRO_FLICK_TARGET_DIAMETER_U).toBeCloseTo(0.680834, 6);
    expect(parsed.endCondition).toEqual({ type: 'targetCount', value: 60 });
  });

  it('is absent from Participant/Assessment session and metric registries', () => {
    expect([...KNOWN_SESSION_FAMILY_IDS]).not.toContain(MICRO_FLICK_THREE_TARGET_TEST_DRILL_ID);
    const registry = createDrillMetricRegistry();
    for (const id of [
      MICRO_FLICK_THREE_TARGET_TEST_DRILL_ID,
      `${MICRO_FLICK_THREE_TARGET_TEST_DRILL_ID}_alt`,
      'micro_flick_three_target_test',
    ]) {
      expect(registry.registrationForExactDrill(id)).toBeUndefined();
    }
  });

  it('has no exact, prefix, or near-miss WP-50 full replay profile', () => {
    for (const id of [
      MICRO_FLICK_THREE_TARGET_TEST_DRILL_ID,
      `${MICRO_FLICK_THREE_TARGET_TEST_DRILL_ID}_alt`,
      'micro_flick_three_target_test',
    ]) {
      expect(replayProfileForExactDrill(id)).toBeUndefined();
    }
  });

  it('short-circuits history persistence as Practice without calling the client', async () => {
    const saveRun = vi.fn();
    const client = { saveRun } as unknown as HistoryClient;
    const persistence = createHistoryPersistence(client);
    const payload = makeAssessmentPayload({
      drillId: MICRO_FLICK_THREE_TARGET_TEST_DRILL_ID,
      assessment: false,
    });

    await expect(persistence.save(payload)).resolves.toEqual({ kind: 'excluded', reason: 'practice' });
    expect(saveRun).not.toHaveBeenCalled();
  });
});
