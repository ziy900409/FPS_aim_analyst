import type { DrillConfig } from './DrillConfig.ts';
import type { ClearanceOptions } from '../scene/clearance.ts';

/**
 * peek_click_transfer_pilot_v1 — WP-45 / T3（FR-P45-1/3/4/7）
 *
 * Practice-only self-motion exposure × counter-strafe transfer pilot: the player peeks A/D from
 * behind `peek-ad-corridor-v1`'s center pillar to expose a static, angular-size-controlled target,
 * then counter-strafes to a first shot. Reuses the existing cue/alternation/miss-refire/timeout
 * pipeline (`TargetManager`/`DrillRunner`/`SimLoop` hitscan occlusion gate, WP-45 T1/T2) — this file
 * only supplies data (DrillConfig + wrapper metadata), no engine changes (README §2.3 C).
 */

/**
 * Distance (u) the `peek-ad-corridor-v1` cover geometry was calibrated against
 * (D-45.10 / `peek-ad-corridor.test.ts`). Changing this invalidates that scene's occlusion/
 * visibility invariants — re-verify the scene test first.
 */
export const PEEK_CLICK_TRANSFER_DISTANCE_U = 8;

/** Pilot angular-size candidates (deg, FR-P45-7). The researcher entry point defaults to 2° (OQ-S9-5). */
export const PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG = [1.5, 2, 3] as const;
export type PeekClickAngularSizeDeg = (typeof PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG)[number];

export const PEEK_CLICK_TRANSFER_DEFAULT_ANGULAR_SIZE_DEG: PeekClickAngularSizeDeg = 2;

export const PEEK_CLICK_TRANSFER_VISIBILITY = { sampleCount: 9, onsetThreshold: 0.5 } as const;

export const PEEK_CLICK_TRANSFER_CLEARANCE_OPTIONS: ClearanceOptions = {
  allowedOcclusionPropIds: ['cover-wall-l', 'cover-wall-r'],
};

/**
 * Pilot-only seed base (outside the 1–37002 assessment roster and above the 90000–93999 range used
 * by the four existing `src/pilot/pilotConfigs.ts` families, so this fifth family cannot collide).
 */
const PEEK_CLICK_TRANSFER_SEED_BASE = 94000;

export interface PeekClickTransferPilotConfig {
  readonly id: string;
  readonly sceneId: 'peek-ad-corridor-v1';
  readonly drill: DrillConfig;
  readonly clearanceOptions: ClearanceOptions;
  readonly visibility: typeof PEEK_CLICK_TRANSFER_VISIBILITY;
  readonly angularSizeDeg: PeekClickAngularSizeDeg;
}

/** World hitbox width/height (u): a target subtending `angularSizeDeg` at `distanceU`. */
export function angularSizeToHitboxWidthU(angularSizeDeg: number, distanceU: number): number {
  return 2 * distanceU * Math.tan((angularSizeDeg * Math.PI) / 360);
}

function pilotDrillId(angularSizeDeg: PeekClickAngularSizeDeg): string {
  return `peek_click_transfer_pilot_v1_${angularSizeDeg.toString().replace('.', '_')}deg`;
}

/**
 * Builds one pilot cell for a fixed angular-size candidate. Only accepts
 * {@link PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG} values (enforced by the parameter's literal union
 * type) — operators cannot inject an uncalibrated size into a pilot run (README §2.3 C).
 */
export function buildPeekClickTransferPilotConfig(
  angularSizeDeg: PeekClickAngularSizeDeg,
): PeekClickTransferPilotConfig {
  const widthU = angularSizeToHitboxWidthU(angularSizeDeg, PEEK_CLICK_TRANSFER_DISTANCE_U);
  const seed = PEEK_CLICK_TRANSFER_SEED_BASE + Math.round(angularSizeDeg * 10);
  const drillId = pilotDrillId(angularSizeDeg);

  return {
    id: drillId,
    sceneId: 'peek-ad-corridor-v1',
    clearanceOptions: PEEK_CLICK_TRANSFER_CLEARANCE_OPTIONS,
    visibility: PEEK_CLICK_TRANSFER_VISIBILITY,
    angularSizeDeg,
    drill: {
      drillId,
      mode: 'practice',
      cue: { kind: 'single' },
      targets: {
        count: 20,
        distance: PEEK_CLICK_TRANSFER_DISTANCE_U,
        hitbox: { widthU, heightU: widthU, depthU: 1 },
      },
      // cue foreperiod 500ms（README §2.4 step 2）；OQ-S9-4：spawn-anchored 總 timeout 3000ms 預設。
      sequence: { alternation: 'LR', seed, spawnDelayMsRange: [500, 500] },
      timing: { countdownMs: 3000, peekTimeoutMs: 3000, timeLimitMs: 120000 },
      endCondition: { type: 'targetCount', value: 20 },
    },
  };
}

/** Researcher-mode default pilot cell (2° candidate, OQ-S9-5) — registered directly in `main.ts`. */
export const peekClickTransferPilotV1 = buildPeekClickTransferPilotConfig(
  PEEK_CLICK_TRANSFER_DEFAULT_ANGULAR_SIZE_DEG,
);
