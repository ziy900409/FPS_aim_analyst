import type { DrillConfig } from './DrillConfig.ts';
import type { ClearanceOptions } from '../scene/clearance.ts';
import { angularSizeToHitboxWidthU } from './peek_click_transfer_pilot_v1.ts';

/**
 * peek_click_transfer_pilot_v2 — WP-52 / T1（FR-52-1/2, NFR-52-1/2/3）
 *
 * Evidence-collection revision of the peek-click-transfer transfer pilot, shipped under its own
 * id/module/seed range so its evidence round stays independently auditable from v1's (D-52.1); v1
 * itself is untouched by this file. Timeout and warmup policy keep v1's values (D-52.5/D-52.6, no
 * evidence to change them). The angular-size candidates originally also matched v1 (D-52.4), but a
 * manual pilot pass found the 1.5/2/3 deg spread felt too similar across candidates; D-52.9 widened
 * them to 1/2.5/5 deg based on that feedback.
 */

/**
 * Distance (u) the `peek-ad-corridor-v1` cover geometry was calibrated against (D-45.10). Same
 * value as v1 — changing it invalidates that scene's occlusion/visibility invariants regardless of
 * which pilot version references it.
 */
export const PEEK_CLICK_TRANSFER_PILOT_V2_DISTANCE_U = 8;

/**
 * Pilot angular-size candidates (deg). Widened from v1's 1.5/2/3 deg (D-52.9) — a manual pilot pass
 * found that spread's 2× min-to-max hitbox width too small to feel meaningfully different across
 * candidates. 1/2.5/5 deg gives a 5× min-to-max spread (widthU ≈ 0.140/0.349/0.699u at the fixed
 * 8u distance) while staying well inside the corridor's occlusion geometry.
 */
export const PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG = [1, 2.5, 5] as const;
export type PeekClickTransferPilotV2AngularSizeDeg =
  (typeof PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG)[number];

export const PEEK_CLICK_TRANSFER_PILOT_V2_DEFAULT_ANGULAR_SIZE_DEG: PeekClickTransferPilotV2AngularSizeDeg = 2.5;

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

/** Researcher-mode default pilot cell (2.5° candidate, the widened set's midpoint). */
export const peekClickTransferPilotV2 = buildPeekClickTransferPilotV2Config(
  PEEK_CLICK_TRANSFER_PILOT_V2_DEFAULT_ANGULAR_SIZE_DEG,
);

/** Every fixed-size candidate cell, single source for researcher-mode drill registration (WP-52 T5). */
export const PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES = PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG.map(
  (deg) => buildPeekClickTransferPilotV2Config(deg),
);

/**
 * WP-52 / T5 — target count for the randomized cell: `targets.count` must divide evenly by
 * {@link PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG}'s length (`schema.ts`-enforced)
 * so the balanced shuffle has no remainder; 21 gives exactly 7 presentations per candidate.
 */
export const PEEK_CLICK_TRANSFER_PILOT_V2_RANDOMIZED_TARGET_COUNT = 21;

/** Distinct from every fixed-candidate seed (95010/95025/95050) so the two cohorts never collide. */
const PEEK_CLICK_TRANSFER_PILOT_V2_RANDOMIZED_SEED = 95100;

export interface PeekClickTransferPilotV2RandomizedConfig {
  readonly id: string;
  readonly sceneId: 'peek-ad-corridor-v1';
  readonly drill: DrillConfig;
  readonly clearanceOptions: ClearanceOptions;
  readonly visibility: typeof PEEK_CLICK_TRANSFER_PILOT_V2_VISIBILITY;
  /** Every candidate's hitbox width (u), for mapping an exported `hitboxWidthU` back to its angular-size label. */
  readonly candidateWidthsU: readonly number[];
}

/**
 * WP-52 / T5 — single drill cell drawing all of
 * {@link PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG} in a seeded balanced-shuffle
 * order (`DrillConfig.targets.hitboxCandidates`), instead of one fixed size per drill id. Built per
 * user request after manually pilot-testing the fixed-size cells: comparing candidates one drill at
 * a time made the size difference hard to judge; interleaving them randomly within one run makes
 * the contrast direct.
 */
export function buildPeekClickTransferPilotV2RandomizedConfig(): PeekClickTransferPilotV2RandomizedConfig {
  const hitboxCandidates = PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG.map((deg) => {
    const widthU = angularSizeToHitboxWidthU(deg, PEEK_CLICK_TRANSFER_PILOT_V2_DISTANCE_U);
    return { widthU, heightU: widthU, depthU: 1 };
  });
  const drillId = `${PEEK_CLICK_TRANSFER_PILOT_V2_ID}_randomized`;

  return {
    id: drillId,
    sceneId: 'peek-ad-corridor-v1',
    clearanceOptions: PEEK_CLICK_TRANSFER_PILOT_V2_CLEARANCE_OPTIONS,
    visibility: PEEK_CLICK_TRANSFER_PILOT_V2_VISIBILITY,
    candidateWidthsU: hitboxCandidates.map((candidate) => candidate.widthU),
    drill: {
      drillId,
      mode: 'practice',
      cue: { kind: 'single' },
      targets: {
        count: PEEK_CLICK_TRANSFER_PILOT_V2_RANDOMIZED_TARGET_COUNT,
        distance: PEEK_CLICK_TRANSFER_PILOT_V2_DISTANCE_U,
        hitboxCandidates,
      },
      sequence: { alternation: 'LR', seed: PEEK_CLICK_TRANSFER_PILOT_V2_RANDOMIZED_SEED, spawnDelayMsRange: [500, 500] },
      timing: PEEK_CLICK_TRANSFER_PILOT_V2_TIMING,
      endCondition: { type: 'targetCount', value: PEEK_CLICK_TRANSFER_PILOT_V2_RANDOMIZED_TARGET_COUNT },
    },
  };
}

export const peekClickTransferPilotV2Randomized = buildPeekClickTransferPilotV2RandomizedConfig();

/** Maps an exported presentation's `hitboxWidthU` back to its angular-size label (e.g. `'2.5°'`). */
export function peekClickTransferPilotV2CandidateLabel(hitboxWidthU: number): string {
  const match = PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG.find(
    (deg) => angularSizeToHitboxWidthU(deg, PEEK_CLICK_TRANSFER_PILOT_V2_DISTANCE_U) === hitboxWidthU,
  );
  return match !== undefined ? `${match}°` : `${hitboxWidthU}u`;
}
