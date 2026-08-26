import { describe, expect, it } from 'vitest';
import type { Meta } from '../data/metadata.ts';
import { buildCompatibilityKey } from '../metrics/compatibilityKey.ts';
import { counterstrafeReversalV1 } from '../drill/counterstrafe_reversal_v1.ts';
import { holdClickV1 } from '../drill/hold_click_v1.ts';
import { holdTrackV1 } from '../drill/hold_track_v1.ts';
import { spiderShotV1 } from '../drill/spider_shot_v1.ts';
import { PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG } from '../drill/peek_click_transfer_pilot_v1.ts';
import {
  buildCounterstrafeReversalPilotConfigs,
  buildHoldClickPilotConfigs,
  buildHoldTrackPilotConfigs,
  buildPeekClickTransferPilotConfigs,
  buildSpiderShotPilotConfigs,
  PILOT_FEEDBACK_POLICY_CANDIDATES,
  PILOT_SEED_ROSTER_START,
} from './pilotConfigs.ts';

const distances = [
  { label: 'near', distanceU: 6 },
  { label: 'mid', distanceU: 8 },
  { label: 'far', distanceU: 10 },
] as const;

describe('stage6 pilot configs', () => {
  const allConfigs = () => [
    ...buildHoldClickPilotConfigs(distances, [{ onsetThreshold: 0.4 }, { onsetThreshold: 0.6 }]),
    ...buildHoldTrackPilotConfigs(distances),
    ...buildSpiderShotPilotConfigs([{ angularRadiusDeg: 15, widthU: 1, heightU: 2 }]),
    ...buildCounterstrafeReversalPilotConfigs([{ holdDurationMs: 400 }, { holdDurationMs: 600 }]),
    ...buildPeekClickTransferPilotConfigs(PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG),
  ];

  it('is deterministic and produces only practice configs', () => {
    expect(allConfigs()).toEqual(allConfigs());
    expect(allConfigs().every((config) => config.mode === 'practice')).toBe(true);
  });

  it('preserves each requested candidate in its practice configuration', () => {
    const holdClick = buildHoldClickPilotConfigs([{ label: 'near', distanceU: 6 }], [{ onsetThreshold: 0.4 }])[0];
    expect(holdClick.targets).toMatchObject({ distance: 6, spawnArea: { distanceURange: [6, 6] } });
    expect(holdClick.visibility).toEqual({ sampleCount: 9, onsetThreshold: 0.4 });

    expect(buildSpiderShotPilotConfigs([{ angularRadiusDeg: 20, widthU: 2, heightU: 3 }])[0]).toMatchObject({
      targets: { hitbox: { widthU: 2, heightU: 3 } },
      spiderShot: { peripheral: { angularRadiusDegRange: [20, 20] } },
    });
    expect(buildCounterstrafeReversalPilotConfigs([{ holdDurationMs: 600 }])[0].cue).toEqual({
      kind: 'hold-reversal',
      holdDurationMs: 600,
    });

    const [peekClick2Deg] = buildPeekClickTransferPilotConfigs([2]);
    expect(peekClick2Deg.cue).toEqual({ kind: 'single' });
    expect(peekClick2Deg.targets.hitbox).toMatchObject({ depthU: 1 });
    expect(peekClick2Deg.targets.hitbox!.widthU).toBeCloseTo(peekClick2Deg.targets.hitbox!.heightU, 12);
  });

  it('uses a pilot-only seed roster that cannot collide with assessment seeds', () => {
    const assessmentSeeds = [
      holdClickV1.drill.sequence.seed,
      holdTrackV1.drill.sequence.seed,
      spiderShotV1.spiderShot?.seed,
      counterstrafeReversalV1.sequence.seed,
    ];
    const pilotSeeds = allConfigs().map((config) => config.spiderShot?.seed ?? config.sequence.seed);

    expect(PILOT_SEED_ROSTER_START).toBeGreaterThan(Math.max(...assessmentSeeds.filter((seed): seed is number => seed !== undefined)));
    expect(pilotSeeds.every((seed) => seed !== undefined && !assessmentSeeds.includes(seed))).toBe(true);
    expect(new Set(pilotSeeds).size).toBe(pilotSeeds.length);
  });

  it('cannot build a formal compatibility key for a practice export', () => {
    const practiceMeta = {
      session: { participantId: 'P001' },
      startedAt: '2026-08-25T00:00:00.000Z',
      assessment: undefined,
    } as Meta;

    expect(() => buildCompatibilityKey(practiceMeta, 'hold-click-pilot-near-threshold-0.4', 'hold:distance=near', 'ok')).toThrow(
      'meta.assessment is required',
    );
  });

  it('exposes exactly the two feedback-policy candidates', () => {
    expect(PILOT_FEEDBACK_POLICY_CANDIDATES).toEqual([
      { assessmentFeedbackPolicy: 'minimal-end-of-block' },
      { assessmentFeedbackPolicy: 'unrestricted' },
    ]);
  });
});
