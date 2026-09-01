import type { DrillConfig } from './DrillConfig.ts';
import type { ClearanceOptions } from '../scene/clearance.ts';
import { angularSizeToHitboxWidthU } from './peek_click_transfer_pilot_v1.ts';

/**
 * peek_click_transfer_pilot_v2 — WP-52 / T1（FR-52-1/2, NFR-52-1/2/3）
 *
 * Evidence-collection revision of the peek-click-transfer transfer pilot. WP-52 T0 (OQ-52-1/2/3,
 * D-52.4/5/6) found no evidence to change target-size candidates, timeout, or warmup policy away
 * from `peek_click_transfer_pilot_v1` — v2 therefore keeps those values, but ships under its own
 * id/module/seed range so its evidence round stays independently auditable from v1's (D-52.1); v1
 * itself is untouched by this file.
 */

/**
 * Distance (u) the `peek-ad-corridor-v1` cover geometry was calibrated against (D-45.10). Same
 * value as v1 — changing it invalidates that scene's occlusion/visibility invariants regardless of
 * which pilot version references it.
 */
export const PEEK_CLICK_TRANSFER_PILOT_V2_DISTANCE_U = 8;

/** Pilot angular-size candidates (deg), unchanged from v1 per D-52.4. */
export const PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG = [1.5, 2, 3] as const;
export type PeekClickTransferPilotV2AngularSizeDeg =
  (typeof PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG)[number];

export const PEEK_CLICK_TRANSFER_PILOT_V2_DEFAULT_ANGULAR_SIZE_DEG: PeekClickTransferPilotV2AngularSizeDeg = 2;

export const PEEK_CLICK_TRANSFER_PILOT_V2_TARGET_COUNT = 20;

/** Spawn-anchored timeout/countdown, unchanged from v1 per D-52.5. */
export const PEEK_CLICK_TRANSFER_PILOT_V2_TIMING = {
  countdownMs: 3000,
  peekTimeoutMs: 3000,
  timeLimitMs: 120000,
} as const;

export const PEEK_CLICK_TRANSFER_PILOT_V2_VISIBILITY = { sampleCount: 9, onsetThreshold: 0.5 } as const;

export const PEEK_CLICK_TRANSFER_PILOT_V2_CLEARANCE_OPTIONS: ClearanceOptions = {
  allowedOcclusionPropIds: ['cover-wall-l', 'cover-wall-r'],
};

/** Family id shared by every v2 candidate's drill id; distinct from `peek_click_transfer_pilot_v1_*`. */
export const PEEK_CLICK_TRANSFER_PILOT_V2_ID = 'peek_click_transfer_pilot_v2';

/**
 * Pilot-v2-only seed base — distinct from v1's 94000-series (94015/94020/94030), so the two
 * evidence rounds can never collide in exported seeds and stay auditable as separate cohorts.
 */
const PEEK_CLICK_TRANSFER_PILOT_V2_SEED_BASE = 95000;

export interface PeekClickTransferPilotV2Config {
  readonly id: string;
  readonly sceneId: 'peek-ad-corridor-v1';
  readonly drill: DrillConfig;
  readonly clearanceOptions: ClearanceOptions;
  readonly visibility: typeof PEEK_CLICK_TRANSFER_PILOT_V2_VISIBILITY;
  readonly angularSizeDeg: PeekClickTransferPilotV2AngularSizeDeg;
  readonly candidateLabel: string;
}

function pilotV2DrillId(angularSizeDeg: PeekClickTransferPilotV2AngularSizeDeg): string {
  return `${PEEK_CLICK_TRANSFER_PILOT_V2_ID}_${angularSizeDeg.toString().replace('.', '_')}deg`;
}

/**
 * Builds one pilot v2 cell for a fixed angular-size candidate. Only accepts
 * {@link PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG} values (enforced by the
 * parameter's literal union type) — operators cannot inject an uncalibrated size (FR-52-3).
 */
export function buildPeekClickTransferPilotV2Config(
  angularSizeDeg: PeekClickTransferPilotV2AngularSizeDeg,
): PeekClickTransferPilotV2Config {
  const widthU = angularSizeToHitboxWidthU(angularSizeDeg, PEEK_CLICK_TRANSFER_PILOT_V2_DISTANCE_U);
  const seed = PEEK_CLICK_TRANSFER_PILOT_V2_SEED_BASE + Math.round(angularSizeDeg * 10);
  const drillId = pilotV2DrillId(angularSizeDeg);

  return {
    id: drillId,
    sceneId: 'peek-ad-corridor-v1',
    clearanceOptions: PEEK_CLICK_TRANSFER_PILOT_V2_CLEARANCE_OPTIONS,
    visibility: PEEK_CLICK_TRANSFER_PILOT_V2_VISIBILITY,
    angularSizeDeg,
    candidateLabel: `${angularSizeDeg}°`,
    drill: {
      drillId,
      mode: 'practice',
      cue: { kind: 'single' },
      targets: {
        count: PEEK_CLICK_TRANSFER_PILOT_V2_TARGET_COUNT,
        distance: PEEK_CLICK_TRANSFER_PILOT_V2_DISTANCE_U,
        hitbox: { widthU, heightU: widthU, depthU: 1 },
      },
      sequence: { alternation: 'LR', seed, spawnDelayMsRange: [500, 500] },
      timing: PEEK_CLICK_TRANSFER_PILOT_V2_TIMING,
      endCondition: { type: 'targetCount', value: PEEK_CLICK_TRANSFER_PILOT_V2_TARGET_COUNT },
    },
  };
}

/** Researcher-mode default pilot cell (2° candidate, matching v1's default). */
export const peekClickTransferPilotV2 = buildPeekClickTransferPilotV2Config(
  PEEK_CLICK_TRANSFER_PILOT_V2_DEFAULT_ANGULAR_SIZE_DEG,
);
