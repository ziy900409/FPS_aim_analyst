import type { DrillConfig } from '../drill/DrillConfig.ts';
import {
  trackingCorePrPilotV1CalibrationHorizontal,
  trackingCorePrPilotV1CalibrationVertical,
  trackingCorePrPilotV1Practice,
  TRACKING_CORE_PR_PILOT_V1_CANDIDATES,
} from '../drill/tracking_core_pr_pilot_v1.ts';
import { TRACKING_REVERSAL_PILOT_V1_CANDIDATES } from '../drill/tracking_reversal_pilot_v1.ts';
import { TRACKING_PILOT_PROTOCOL_VERSION } from '../pilot/trackingCompatibilityKey.ts';
import { buildFamilyOrderForRoster } from './sessionSchedule.ts';

/**
 * trackingPilotManifest — WP-54 / T5 (README §2.4 `TrackingPilotManifest` interface contract,
 * FR-54-12, task-checklist T5 "定義 TrackingPilotManifest、counterbalance cell、session index、
 * alternate seed family"). README never defined `TrackingPilotBlock` — this file designs it.
 *
 * Reuses WP-41's `buildFamilyOrderForRoster()` (`sessionSchedule.ts`) for the counterbalance
 * rotation instead of reinventing a shuffle — same "deterministic arithmetic over `createRan1`
 * sampling" precedent (WP-41 progress.md §0-5): ordering 6 known drill ids is a rotation, not a
 * sampling operation, so GD-5's seeded-RNG requirement does not apply here.
 */

export type TrackingPilotBlockRole = 'practice' | 'calibration' | 'scored';

/**
 * One manifest entry. Deliberately minimal — `drillId` is the single source for which config to
 * run (looked up against the known WP-54 pilot candidates below, never re-declared here); `role`
 * is intentionally NOT stored on the block (it is 1:1 derivable from `drillId` via
 * `trackingPilotBlockRole()` — storing it here would let a corrupt/hand-edited manifest claim a
 * role that disagrees with the actual drill, which `parseTrackingPilotManifest()` could not then
 * catch as a conflict). `seedFamily` is genuine manifest-level state (which seed variant this
 * particular block run should use) — not derivable from anything else, so it does live here.
 */
export interface TrackingPilotBlock {
  readonly drillId: string;
  readonly seedFamily: 'primary' | 'alternate';
}

export interface TrackingPilotManifest {
  readonly protocolVersion: 'tracking-pilot-v1';
  readonly participantId: string;
  readonly sessionIndex: 0 | 1;
  readonly orderedBlocks: readonly TrackingPilotBlock[];
  readonly restSeconds: number;
  readonly generatedFromCounterbalanceCell: string;
}

/** Alternate-seed offset for T8 "alternate-seed equivalence" (README §4 T8) — session 1 reruns
 * every scored block's trajectory with a different seed than session 0, so repeatability evidence
 * isn't confounded with "the participant memorized this exact trajectory realization". Chosen far
 * outside both WP-54 seed families (54000s/54100s) and every other WP's ranges (18018/23002/
 * 94000s/95000s/pilot 90000s) so offset seeds never collide with a literal config seed. */
const ALTERNATE_SEED_OFFSET = 10000;

const KNOWN_BLOCK_ROLES: ReadonlyMap<string, TrackingPilotBlockRole> = new Map([
  [trackingCorePrPilotV1Practice.drillId, 'practice'],
  [trackingCorePrPilotV1CalibrationHorizontal.drillId, 'calibration'],
  [trackingCorePrPilotV1CalibrationVertical.drillId, 'calibration'],
  ...TRACKING_CORE_PR_PILOT_V1_CANDIDATES.map((config): readonly [string, TrackingPilotBlockRole] => [
    config.drillId,
    'scored',
  ]),
  ...TRACKING_REVERSAL_PILOT_V1_CANDIDATES.map((config): readonly [string, TrackingPilotBlockRole] => [
    config.drillId,
    'scored',
  ]),
]);

const KNOWN_BLOCK_CONFIGS: ReadonlyMap<string, DrillConfig> = new Map([
  [trackingCorePrPilotV1Practice.drillId, trackingCorePrPilotV1Practice],
  [trackingCorePrPilotV1CalibrationHorizontal.drillId, trackingCorePrPilotV1CalibrationHorizontal],
  [trackingCorePrPilotV1CalibrationVertical.drillId, trackingCorePrPilotV1CalibrationVertical],
  ...TRACKING_CORE_PR_PILOT_V1_CANDIDATES.map((config): readonly [string, DrillConfig] => [config.drillId, config]),
  ...TRACKING_REVERSAL_PILOT_V1_CANDIDATES.map((config): readonly [string, DrillConfig] => [
    config.drillId,
    config,
  ]),
]);

/** Fixed generation order for the 6 counterbalance-rotated scored candidates (4 core + 2 reversal
 * — README §4 T5 "counterbalance cell"). Rotation order, not presentation order: the actual
 * per-participant/session presentation order is produced by `buildFamilyOrderForRoster()` below. */
const SCORED_DRILL_ID_ROSTER: readonly string[] = [
  ...TRACKING_CORE_PR_PILOT_V1_CANDIDATES.map((config) => config.drillId),
  ...TRACKING_REVERSAL_PILOT_V1_CANDIDATES.map((config) => config.drillId),
];

/** Derives a block's role from its `drillId` against the single-source registry above — never
 * trust a stored role field (there isn't one; see `TrackingPilotBlock` doc comment). */
export function trackingPilotBlockRole(drillId: string): TrackingPilotBlockRole {
  const role = KNOWN_BLOCK_ROLES.get(drillId);
  if (role === undefined) throw new Error(`Unknown WP-54 tracking pilot drillId: ${drillId}`);
  return role;
}

/**
 * Non-throwing practice probe for consumers that may be handed arbitrary payloads — unlike
 * `trackingPilotBlockRole()`, which fails fast on an unknown drillId because a *manifest* must
 * never carry one. Returns `false` for anything that is not a registered WP-54 practice block.
 *
 * Exists because FR-54-5's acceptance clause ("practice 不寫入 scored aggregation") has to be
 * enforced by role, not by the absence of a `scored_start` event: a practice block has no prep
 * window, so `TargetManager` stamps `tScoredStart` on its very first motion tick and the export
 * does carry one `scored_start` (T6 slice 2 measured this — see progress.md D-54.34).
 */
export function isTrackingPilotPracticeDrillId(drillId: string): boolean {
  return KNOWN_BLOCK_ROLES.get(drillId) === 'practice';
}

/**
 * Builds a deterministic manifest for one participant/session. Practice and both axis-calibration
 * blocks always run first in a fixed order (they are diagnostic, not part of the counterbalanced
 * scored-condition comparison — README §2.5 primary outcome is defined over the scored blocks
 * only). The 6 scored blocks (4 core matrix + 2 reversal density) are then ordered by
 * `buildFamilyOrderForRoster()` — position-balanced across participants/sessions like WP-41's
 * family order, avoiding a fresh shuffle implementation.
 *
 * `sessionIndex === 0` uses every block's own literal (primary) seed; `sessionIndex === 1`
 * reruns the scored blocks under the alternate-seed family (T8 alternate-seed equivalence) while
 * practice/calibration keep their primary seed (their role is diagnostic, not data-bearing —
 * re-running them under a different trajectory realization would not change what they measure).
 */
export function buildTrackingPilotManifest(
  participantId: string,
  sessionIndex: 0 | 1,
  restSeconds: number,
): TrackingPilotManifest {
  if (participantId.trim() === '') throw new Error('participantId must be a non-empty string');
  if (sessionIndex !== 0 && sessionIndex !== 1) throw new Error('sessionIndex must be 0 or 1');
  if (!Number.isFinite(restSeconds) || restSeconds < 0) {
    throw new Error('restSeconds must be a non-negative finite number');
  }

  const scoredSeedFamily: TrackingPilotBlock['seedFamily'] = sessionIndex === 0 ? 'primary' : 'alternate';
  const orderedScoredDrillIds = buildFamilyOrderForRoster(participantId, sessionIndex, SCORED_DRILL_ID_ROSTER);

  const orderedBlocks: readonly TrackingPilotBlock[] = [
    { drillId: trackingCorePrPilotV1Practice.drillId, seedFamily: 'primary' },
    { drillId: trackingCorePrPilotV1CalibrationHorizontal.drillId, seedFamily: 'primary' },
    { drillId: trackingCorePrPilotV1CalibrationVertical.drillId, seedFamily: 'primary' },
    ...orderedScoredDrillIds.map((drillId) => ({ drillId, seedFamily: scoredSeedFamily })),
  ];

  return {
    protocolVersion: TRACKING_PILOT_PROTOCOL_VERSION,
    participantId,
    sessionIndex,
    orderedBlocks,
    restSeconds,
    generatedFromCounterbalanceCell: `${TRACKING_PILOT_PROTOCOL_VERSION}:${participantId}:session-${sessionIndex}`,
  };
}

/** Resolves a manifest block to the actual `DrillConfig` to load. Applies the alternate-seed
 * offset for `seedFamily: 'alternate'` scored blocks only — practice/calibration blocks never
 * carry `'alternate'` (rejected by `parseTrackingPilotManifest()`) so this never clones them. */
export function resolveTrackingPilotBlockConfig(block: TrackingPilotBlock): DrillConfig {
  const config = KNOWN_BLOCK_CONFIGS.get(block.drillId);
  if (config === undefined) throw new Error(`Unknown WP-54 tracking pilot drillId: ${block.drillId}`);
  if (block.seedFamily === 'primary') return config;

  const trajectory = config.targets.trackingTrajectory;
  if (trajectory === undefined) {
    throw new Error(`WP-54 tracking pilot drillId ${block.drillId} has no trackingTrajectory to re-seed`);
  }
  return {
    ...config,
    targets: {
      ...config.targets,
      trackingTrajectory: { ...trajectory, seed: trajectory.seed + ALTERNATE_SEED_OFFSET },
    },
  };
}

/**
 * Fail-fast structural validator for a manifest reconstructed from outside this module (e.g.
 * replayed from a persisted run log) — task-checklist T5 "非法 manifest（重複 block、未知
 * drillId、seed 家族衝突等）fail fast". `buildTrackingPilotManifest()`'s own output always
 * satisfies this (see the round-trip test), but is not routed through it — this validator exists
 * for manifests arriving from outside this module's control.
 */
export function parseTrackingPilotManifest(value: unknown): TrackingPilotManifest {
  const root = requireRecord(value, 'manifest');
  if (root.protocolVersion !== TRACKING_PILOT_PROTOCOL_VERSION) {
    throw new Error(`manifest.protocolVersion must be '${TRACKING_PILOT_PROTOCOL_VERSION}'`);
  }
  const participantId = requireNonEmptyString(root.participantId, 'manifest.participantId');
  if (root.sessionIndex !== 0 && root.sessionIndex !== 1) {
    throw new Error('manifest.sessionIndex must be 0 or 1');
  }
  const restSeconds = root.restSeconds;
  if (typeof restSeconds !== 'number' || !Number.isFinite(restSeconds) || restSeconds < 0) {
    throw new Error('manifest.restSeconds must be a non-negative finite number');
  }
  const generatedFromCounterbalanceCell = requireNonEmptyString(
    root.generatedFromCounterbalanceCell,
    'manifest.generatedFromCounterbalanceCell',
  );

  const rawBlocks = root.orderedBlocks;
  if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) {
    throw new Error('manifest.orderedBlocks must be a non-empty array');
  }

  const seenDrillIds = new Set<string>();
  const scoredSeedFamilies = new Set<TrackingPilotBlock['seedFamily']>();
  const orderedBlocks: TrackingPilotBlock[] = rawBlocks.map((rawBlock, index) => {
    const blockRecord = requireRecord(rawBlock, `manifest.orderedBlocks[${index}]`);
    const drillId = requireNonEmptyString(blockRecord.drillId, `manifest.orderedBlocks[${index}].drillId`);
    if (seenDrillIds.has(drillId)) {
      throw new Error(`manifest.orderedBlocks must not repeat a drillId (duplicate: ${drillId})`);
    }
    seenDrillIds.add(drillId);

    const seedFamily = blockRecord.seedFamily;
    if (seedFamily !== 'primary' && seedFamily !== 'alternate') {
      throw new Error(`manifest.orderedBlocks[${index}].seedFamily must be 'primary' or 'alternate'`);
    }

    const role = trackingPilotBlockRole(drillId);
    if (role !== 'scored' && seedFamily === 'alternate') {
      throw new Error(
        `manifest.orderedBlocks[${index}] (${drillId}) is role '${role}' and must not use the 'alternate' seed family`,
      );
    }
    if (role === 'scored') scoredSeedFamilies.add(seedFamily);

    return { drillId, seedFamily };
  });

  if (scoredSeedFamilies.size > 1) {
    throw new Error('manifest.orderedBlocks scored blocks must all share the same seedFamily');
  }

  return {
    protocolVersion: TRACKING_PILOT_PROTOCOL_VERSION,
    participantId,
    sessionIndex: root.sessionIndex,
    orderedBlocks,
    restSeconds,
    generatedFromCounterbalanceCell,
  };
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}