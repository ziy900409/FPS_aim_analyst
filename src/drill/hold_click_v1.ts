import type { DrillConfig } from './DrillConfig.ts';
import type { ClearanceOptions, TargetEnvelope } from '../scene/clearance.ts';

const HIDDEN_YAW_DEG = -(Math.asin(2 / 8) * 180) / Math.PI;

export const HOLD_CLICK_ONSET_THRESHOLD = 0.5;
export const HOLD_CLICK_VISIBILITY_SAMPLE_COUNT = 9;

export const HOLD_CLICK_EXPOSED_REST_ENVELOPE: TargetEnvelope = {
  side: 'R',
  min: { x: 1.5, y: 0.5, z: -8.5 },
  max: { x: 2.5, y: 2.5, z: -7.5 },
};

export const HOLD_CLICK_CLEARANCE_OPTIONS: ClearanceOptions = {
  allowedOcclusionPropIds: ['cover-wall'],
  exposedRestEnvelope: HOLD_CLICK_EXPOSED_REST_ENVELOPE,
};

export interface HoldClickProtocolConfig {
  readonly id: 'hold_click_v1';
  readonly sceneId: 'peek-corridor';
  readonly drill: DrillConfig;
  readonly clearanceOptions: ClearanceOptions;
  readonly visibility: {
    readonly sampleCount: typeof HOLD_CLICK_VISIBILITY_SAMPLE_COUNT;
    readonly onsetThreshold: typeof HOLD_CLICK_ONSET_THRESHOLD;
  };
}

export const holdClickV1: HoldClickProtocolConfig = {
  id: 'hold_click_v1',
  sceneId: 'peek-corridor',
  clearanceOptions: HOLD_CLICK_CLEARANCE_OPTIONS,
  visibility: {
    sampleCount: HOLD_CLICK_VISIBILITY_SAMPLE_COUNT,
    onsetThreshold: HOLD_CLICK_ONSET_THRESHOLD,
  },
  drill: {
    drillId: 'hold_click_v1',
    mode: 'assessment',
    targets: {
      count: 20,
      distance: 8,
      spawnArea: { yawDegRange: [HIDDEN_YAW_DEG, HIDDEN_YAW_DEG], distanceURange: [8, 8] },
      motion: { type: 'linear', axis: 'horizontal', range: 4, speed: 4, spawnKind: 'slide-in' },
    },
    sequence: {
      alternation: 'LR',
      seed: 34034,
      spawnDelayMsRange: [700, 1700],
    },
    timing: {
      countdownMs: 3000,
      peekTimeoutMs: 1500,
      timeLimitMs: 120000,
    },
    endCondition: { type: 'targetCount', value: 20 },
  },
};
