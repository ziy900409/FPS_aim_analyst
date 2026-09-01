import type { DrillConfig } from './DrillConfig.ts';
import type { ClearanceOptions } from '../scene/clearance.ts';
import { angularSizeToHitboxWidthU } from './peek_click_transfer_pilot_v1.ts';
import { PEEK_CLICK_TRANSFER_PILOT_V2_CLEARANCE_OPTIONS } from './peek_click_transfer_pilot_v2.ts';

/**
 * peek_click_transfer_v1 — WP-53 / T1 — formal Assessment release
 *
 * GD-29（DECISIONS.md）：formal freeze decision, 2026-09-01. Every numeric value below is frozen by
 * that decision, not borrowed from `peek_click_transfer_pilot_v2`'s current default — deliberately
 * a standalone literal so a future change to the pilot's default candidate can never silently move
 * the formal release out from under an already-collected dataset. `angularSizeDeg=2.5` was chosen
 * because real evidence (3 sessions, `peek_click_transfer_pilot_v2_masked`) showed 1° at 42.9%
 * valid-first-shot (floor-effect risk) and 5° at 100% (ceiling-effect risk); 2.5° at 95.2% keeps
 * headroom in both directions for a single fixed-condition assessment.
 *
 * Shape follows pilot v1/v2's wrapper pattern (sceneId + clearanceOptions travel with the drill),
 * because the formal release reuses the same `peek-ad-corridor-v1` scene/occlusion setup — T4
 * Session Plan integration will need both fields.
 */

export const PEEK_CLICK_TRANSFER_V1_PROTOCOL_VERSION = 'peek-click-transfer-v1.0.0';

/** Frozen by GD-29 (2026-09-01) — see file header for the evidence behind this specific value. */
export const PEEK_CLICK_TRANSFER_V1_ANGULAR_SIZE_DEG = 2.5;

/** 沿用 `peek-ad-corridor-v1` 場景校準距離（D-45.10），與 pilot v1/v2 相同，非 freeze 決策項。 */
export const PEEK_CLICK_TRANSFER_V1_DISTANCE_U = 8;

export const PEEK_CLICK_TRANSFER_V1_TARGET_COUNT = 20;

/** Frozen by GD-29: carried over from pilot v1/v2's existing timing — no evidence suggested changing it. */
export const PEEK_CLICK_TRANSFER_V1_TIMING = {
  countdownMs: 3000,
  peekTimeoutMs: 3000,
  timeLimitMs: 120000,
} as const;

export const PEEK_CLICK_TRANSFER_V1_VISIBILITY = { sampleCount: 9, onsetThreshold: 0.5 } as const;

export const PEEK_CLICK_TRANSFER_V1_ID = 'peek_click_transfer_v1';

/**
 * Formal-only seed — distinct from pilot v1's 94000-series and pilot v2's 95000/95100/95200
 * series, so a formal run's seed can never collide with a pilot cohort's exported seed.
 */
const PEEK_CLICK_TRANSFER_V1_SEED = 96000;

const PEEK_CLICK_TRANSFER_V1_WIDTH_U = angularSizeToHitboxWidthU(
  PEEK_CLICK_TRANSFER_V1_ANGULAR_SIZE_DEG,
  PEEK_CLICK_TRANSFER_V1_DISTANCE_U,
);

export interface PeekClickTransferV1Config {
  readonly id: string;
  readonly sceneId: 'peek-ad-corridor-v1';
  readonly drill: DrillConfig;
  readonly clearanceOptions: ClearanceOptions;
  readonly visibility: typeof PEEK_CLICK_TRANSFER_V1_VISIBILITY;
  readonly protocolVersion: string;
}

/**
 * Formal Assessment config（WP-53 T1）。`mode:'assessment'` + 獨立 `drillId`，不沿用任何 pilot
 * drill id（FR-53-2）。凍結數值全數為 GD-29 formal freeze decision 的正式結果。
 */
export const peekClickTransferV1: PeekClickTransferV1Config = {
  id: PEEK_CLICK_TRANSFER_V1_ID,
  sceneId: 'peek-ad-corridor-v1',
  clearanceOptions: PEEK_CLICK_TRANSFER_PILOT_V2_CLEARANCE_OPTIONS,
  visibility: PEEK_CLICK_TRANSFER_V1_VISIBILITY,
  protocolVersion: PEEK_CLICK_TRANSFER_V1_PROTOCOL_VERSION,
  drill: {
    drillId: PEEK_CLICK_TRANSFER_V1_ID,
    mode: 'assessment',
    cue: { kind: 'single' },
    targets: {
      count: PEEK_CLICK_TRANSFER_V1_TARGET_COUNT,
      distance: PEEK_CLICK_TRANSFER_V1_DISTANCE_U,
      hitbox: {
        widthU: PEEK_CLICK_TRANSFER_V1_WIDTH_U,
        heightU: PEEK_CLICK_TRANSFER_V1_WIDTH_U,
        depthU: 1,
      },
    },
    sequence: { alternation: 'LR', seed: PEEK_CLICK_TRANSFER_V1_SEED, spawnDelayMsRange: [500, 500] },
    timing: PEEK_CLICK_TRANSFER_V1_TIMING,
    endCondition: { type: 'targetCount', value: PEEK_CLICK_TRANSFER_V1_TARGET_COUNT },
  },
};
