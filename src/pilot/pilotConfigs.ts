import type { AssessmentMeta } from '../data/metadata.ts';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { counterstrafeReversalV1 } from '../drill/counterstrafe_reversal_v1.ts';
import { holdClickV1, HOLD_CLICK_VISIBILITY_SAMPLE_COUNT } from '../drill/hold_click_v1.ts';
import { holdTrackV1 } from '../drill/hold_track_v1.ts';
import { spiderShotV1 } from '../drill/spider_shot_v1.ts';
import {
  buildPeekClickTransferPilotConfig,
  type PeekClickAngularSizeDeg,
} from '../drill/peek_click_transfer_pilot_v1.ts';
import {
  buildPeekClickTransferPilotV2Config,
  type PeekClickTransferPilotV2AngularSizeDeg,
} from '../drill/peek_click_transfer_pilot_v2.ts';

/** Pilot-only seed range; it is deliberately outside every assessment protocol's 1–37002 range. */
export const PILOT_SEED_ROSTER_START = 90000;

export interface PilotDistanceLevel {
  readonly label: 'near' | 'mid' | 'far';
  readonly distanceU: number;
}

export interface PilotVisibilityCandidate {
  readonly onsetThreshold: number;
}

export interface PilotSpiderShotCell {
  readonly angularRadiusDeg: number;
  readonly widthU: number;
  readonly heightU: number;
}

export interface PilotHoldDurationCandidate {
  readonly holdDurationMs: number;
}

export interface PilotFeedbackPolicyCandidate {
  readonly assessmentFeedbackPolicy: AssessmentMeta['assessmentFeedbackPolicy'];
}

/** A valid practice DrillConfig with the analysis-only visibility candidate kept beside it. */
export interface PilotHoldClickConfig extends DrillConfig {
  readonly visibility: {
    readonly sampleCount: typeof HOLD_CLICK_VISIBILITY_SAMPLE_COUNT;
    readonly onsetThreshold: number;
  };
}

export const PILOT_FEEDBACK_POLICY_CANDIDATES: readonly PilotFeedbackPolicyCandidate[] = [
  { assessmentFeedbackPolicy: 'minimal-end-of-block' },
  { assessmentFeedbackPolicy: 'unrestricted' },
] as const;

export function buildHoldClickPilotConfigs(
  distances: readonly PilotDistanceLevel[],
  visibilityCandidates: readonly PilotVisibilityCandidate[],
): readonly PilotHoldClickConfig[] {
  return distances.flatMap((distance, distanceIndex) =>
    visibilityCandidates.map((visibility, visibilityIndex) => ({
      ...practiceDistanceConfig(
        holdClickV1.drill,
        `hold-click-pilot-${distance.label}-threshold-${visibility.onsetThreshold}`,
        distance,
        pilotSeed(0, distanceIndex * visibilityCandidates.length + visibilityIndex),
      ),
      visibility: {
        sampleCount: HOLD_CLICK_VISIBILITY_SAMPLE_COUNT,
        onsetThreshold: visibility.onsetThreshold,
      },
    })),
  );
}

export function buildHoldTrackPilotConfigs(distances: readonly PilotDistanceLevel[]): readonly DrillConfig[] {
  return distances.map((distance, index) =>
    practiceDistanceConfig(holdTrackV1.drill, `hold-track-pilot-${distance.label}`, distance, pilotSeed(1, index)),
  );
}

export function buildSpiderShotPilotConfigs(cells: readonly PilotSpiderShotCell[]): readonly DrillConfig[] {
  const schedule = spiderShotV1.spiderShot;
  if (schedule === undefined) throw new Error('spiderShotV1 must define a spiderShot schedule');

  return cells.map((cell, index) => ({
    ...spiderShotV1,
    drillId: `spider-shot-pilot-d${cell.angularRadiusDeg}-w${cell.widthU}x${cell.heightU}`,
    mode: 'practice',
    targets: {
      ...spiderShotV1.targets,
      hitbox: { widthU: cell.widthU, heightU: cell.heightU, depthU: spiderShotV1.targets.hitbox?.depthU ?? 1 },
    },
    spiderShot: {
      ...schedule,
      seed: pilotSeed(2, index),
      peripheral: {
        ...schedule.peripheral,
        angularRadiusDegRange: [cell.angularRadiusDeg, cell.angularRadiusDeg],
      },
    },
  }));
}

export function buildCounterstrafeReversalPilotConfigs(
  candidates: readonly PilotHoldDurationCandidate[],
): readonly DrillConfig[] {
  return candidates.map((candidate, index) => ({
    ...counterstrafeReversalV1,
    drillId: `counterstrafe-reversal-pilot-hold-${candidate.holdDurationMs}`,
    mode: 'practice',
    cue: { kind: 'hold-reversal', holdDurationMs: candidate.holdDurationMs },
    sequence: { ...counterstrafeReversalV1.sequence, seed: pilotSeed(3, index) },
  }));
}

/** WP-45 / T3: one flat DrillConfig per requested angular-size candidate (`.drill` unwrapped, matching
 * the other builders' flat shape — pair with `PEEK_CLICK_TRANSFER_CLEARANCE_OPTIONS`/`sceneId` from
 * the drill file itself, same convention as `holdClickV1.clearanceOptions`/`sceneId`). */
export function buildPeekClickTransferPilotConfigs(
  candidates: readonly PeekClickAngularSizeDeg[],
): readonly DrillConfig[] {
  return candidates.map((angularSizeDeg) => buildPeekClickTransferPilotConfig(angularSizeDeg).drill);
}

/** WP-52 / T1: v2 counterpart of {@link buildPeekClickTransferPilotConfigs}, unwrapping v2 cells. */
export function buildPeekClickTransferPilotV2Configs(
  candidates: readonly PeekClickTransferPilotV2AngularSizeDeg[],
): readonly DrillConfig[] {
  return candidates.map((angularSizeDeg) => buildPeekClickTransferPilotV2Config(angularSizeDeg).drill);
}

function practiceDistanceConfig(
  base: DrillConfig,
  drillId: string,
  distance: PilotDistanceLevel,
  seed: number,
): DrillConfig {
  return {
    ...base,
    drillId,
    mode: 'practice',
    targets: {
      ...base.targets,
      distance: distance.distanceU,
      ...(base.targets.spawnArea === undefined
        ? {}
        : { spawnArea: { ...base.targets.spawnArea, distanceURange: [distance.distanceU, distance.distanceU] } }),
    },
    sequence: { ...base.sequence, seed },
  };
}

function pilotSeed(familyOffset: number, index: number): number {
  return PILOT_SEED_ROSTER_START + familyOffset * 1000 + index;
}
