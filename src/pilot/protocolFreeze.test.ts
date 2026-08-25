import { describe, expect, it } from 'vitest';
import { COUNTERSTRAFE_REVERSAL_HOLD_DURATION_MS_V1, counterstrafeReversalV1 } from '../drill/counterstrafe_reversal_v1.ts';
import { HOLD_CLICK_DISTANCE_LEVELS_V1, holdClickV1 } from '../drill/hold_click_v1.ts';
import { HOLD_TRACK_DISTANCE_LEVELS_V1, holdTrackV1 } from '../drill/hold_track_v1.ts';
import { STAGE6_BASELINE_MIN_N, STAGE6_BASELINE_WINDOW_SIZE, STAGE6_PROTOCOL_VERSION } from '../drill/protocolVersion.ts';
import { SPIDER_SHOT_ANGULAR_RADIUS_DEG_V1, SPIDER_SHOT_HITBOX_V1, spiderShotV1 } from '../drill/spider_shot_v1.ts';
import { DIAGNOSIS_THRESHOLDS_V1, PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS } from '../metrics/diagnosisRules.ts';

describe('stage6 formal freeze', () => {
  it('uses explicit release versions and preserves pilot threshold history', () => {
    expect(STAGE6_PROTOCOL_VERSION).toBe('1.0.0');
    expect(DIAGNOSIS_THRESHOLDS_V1.version).toBe('recommendation-v1.0.0');
    expect(DIAGNOSIS_THRESHOLDS_V1.version).not.toBe(PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS.version);
    expect(STAGE6_BASELINE_WINDOW_SIZE).toBe(5);
    expect(STAGE6_BASELINE_MIN_N).toBe(3);
  });

  it('uses the frozen values in every formal assessment config', () => {
    expect(HOLD_CLICK_DISTANCE_LEVELS_V1).toEqual({ near: 6, mid: 8, far: 10 });
    expect(HOLD_TRACK_DISTANCE_LEVELS_V1).toEqual({ near: 6, mid: 8, far: 10 });
    expect(holdClickV1.drill.targets.distance).toBe(HOLD_CLICK_DISTANCE_LEVELS_V1.mid);
    expect(holdTrackV1.drill.targets.distance).toBe(HOLD_TRACK_DISTANCE_LEVELS_V1.mid);
    expect(spiderShotV1.targets.hitbox).toEqual(SPIDER_SHOT_HITBOX_V1);
    expect(spiderShotV1.spiderShot?.peripheral.angularRadiusDegRange).toEqual([
      SPIDER_SHOT_ANGULAR_RADIUS_DEG_V1,
      SPIDER_SHOT_ANGULAR_RADIUS_DEG_V1,
    ]);
    expect(counterstrafeReversalV1.cue).toEqual({ kind: 'hold-reversal', holdDurationMs: COUNTERSTRAFE_REVERSAL_HOLD_DURATION_MS_V1 });
  });
});
