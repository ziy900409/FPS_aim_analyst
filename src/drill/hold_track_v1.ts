import type { ClearanceOptions, TargetEnvelope } from '../scene/clearance.ts';
import type { DrillConfig } from './DrillConfig.ts';

const HIDDEN_YAW_DEG = -(Math.asin(2 / 8) * 180) / Math.PI;

export const HOLD_TRACK_EXPOSED_REST_ENVELOPE: TargetEnvelope = {
  side: 'R',
  min: { x: 1.5, y: 0.5, z: -8.5 },
  max: { x: 2.5, y: 2.5, z: -7.5 },
};

export const HOLD_TRACK_CLEARANCE_OPTIONS: ClearanceOptions = {
  allowedOcclusionPropIds: ['cover-wall'],
  exposedRestEnvelope: HOLD_TRACK_EXPOSED_REST_ENVELOPE,
};

export interface HoldTrackProtocolConfig {
  readonly id: 'hold_track_v1';
  readonly sceneId: 'peek-corridor';
  readonly drill: DrillConfig;
  readonly clearanceOptions: ClearanceOptions;
}

/**
 * Assessment protocol values are pilot candidates (WP-39), intentionally independent from
 * tracking_br_v1's angular-size / weapon condition matrix.
 */
export const holdTrackV1: HoldTrackProtocolConfig = {
  id: 'hold_track_v1',
  sceneId: 'peek-corridor',
  clearanceOptions: HOLD_TRACK_CLEARANCE_OPTIONS,
  drill: {
    drillId: 'hold_track_v1',
    mode: 'assessment',
    targets: {
      count: 20,
      distance: 8,
      spawnArea: { yawDegRange: [HIDDEN_YAW_DEG, HIDDEN_YAW_DEG], distanceURange: [8, 8] },
      motion: { type: 'linear', axis: 'horizontal', range: 4, speed: 4, spawnKind: 'slide-in' },
    },
    sequence: {
      alternation: 'LR',
      seed: 35035,
      spawnDelayMsRange: [700, 1700],
    },
    timing: {
      countdownMs: 3000,
      trackingStopMs: 1000,
      timeLimitMs: 120000,
    },
    endCondition: { type: 'targetCount', value: 20 },
  },
};
