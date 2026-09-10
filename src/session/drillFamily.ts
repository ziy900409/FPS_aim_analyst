import defaultDrillSource from '../../drills/counterstrafe_ad_v1.json';
import { counterstrafeFreeV1 } from '../drill/counterstrafe_free_v1.ts';
import { counterstrafeReversalV1 } from '../drill/counterstrafe_reversal_v1.ts';
import { detectionPopinV1 } from '../drill/detection_popin_v1.ts';
import { holdClickV1 } from '../drill/hold_click_v1.ts';
import { holdTrackV1 } from '../drill/hold_track_v1.ts';
import { microFlickThreeTargetTestV1 } from '../drill/micro_flick_three_target_test_v1.ts';
import { microFlickThreeTargetTestV2 } from '../drill/micro_flick_three_target_test_v2.ts';
import { microFlickThreeTargetTestV3 } from '../drill/micro_flick_three_target_test_v3.ts';
import { microFlickThreeTargetTestV4 } from '../drill/micro_flick_three_target_test_v4.ts';
import { microFlickThreeTargetTestV5 } from '../drill/micro_flick_three_target_test_v5.ts';
import { microFlickThreeTargetTestV6 } from '../drill/micro_flick_three_target_test_v6.ts';
import { microFlickThreeTargetTestV7 } from '../drill/micro_flick_three_target_test_v7.ts';
import { microFlickThreeTargetTestV8 } from '../drill/micro_flick_three_target_test_v8.ts';
import { peekClickTransferPilotV1 } from '../drill/peek_click_transfer_pilot_v1.ts';
import {
  PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES,
  peekClickTransferPilotV2Masked,
  peekClickTransferPilotV2Randomized,
} from '../drill/peek_click_transfer_pilot_v2.ts';
import { peekClickTransferV1 } from '../drill/peek_click_transfer_v1.ts';
import { spiderShotV1 } from '../drill/spider_shot_v1.ts';
import { spiderShotV2 } from '../drill/spider_shot_v2.ts';
import { spiderShotV3Binding } from '../drill/spider_shot_v3.ts';
import { spiderShotWideV1Binding } from '../drill/spider_shot_wide_v1.ts';
import { trackingBrVariants } from '../drill/tracking_br_v1.ts';
import { trackingLongrangeV1 } from '../drill/tracking_longrange_v1.ts';
import { trackingSceneV1 } from '../drill/tracking_scene_v1.ts';
import { trackingV1 } from '../drill/tracking_v1.ts';
import { isWeaponId, type WeaponId } from '../weapon/weapons.ts';
import { KNOWN_SESSION_FAMILY_IDS, type SessionFamilyId } from './sessionSchedule.ts';

/**
 * WP-58 T1 (FR-58.1) — the single place that answers "which family does this drill belong to" and
 * "which drill represents this family". Both directions live here so they cannot drift apart; the
 * family *allowlist* itself stays in `sessionSchedule.ts` (KI-016) and is only referenced, never
 * restated.
 *
 * D-58-T0-2 — every id below is read from the drill module's own exported constant, never typed as
 * a literal. Drill ids in this repo mix hyphens and underscores (`spider-shot-v3` next to
 * `micro_flick_three_target_test_v1`), and WP-58's planning table got six of them wrong precisely
 * because they were hand-written. Referencing the constants makes that class of error unspellable.
 *
 * Scheduling reach is not Assessment eligibility (FR-58.3 / GD-35): a drill listed here can be put
 * into a session program, but whether its run is stored, projected into trend cohorts, or treated
 * as an assessment at all is decided by `DrillConfig.mode` and `DrillMetricRegistry`'s exact-id
 * registrations — two gates that know nothing about families. `drillFamily.test.ts` pins that
 * decoupling with per-drill negative assertions so nobody later "fixes" it with a family fallback.
 */
const FAMILY_ROSTER: readonly (readonly [SessionFamilyId, readonly string[]])[] = [
  ['hold-click', [holdClickV1.id]],
  ['hold-track', [holdTrackV1.id]],
  ['spider-shot', [spiderShotV1.drillId, spiderShotV2.drillId, spiderShotV3Binding.id]],
  ['spider-shot-wide', [spiderShotWideV1Binding.id]],
  ['counterstrafe', [counterstrafeReversalV1.drillId, counterstrafeFreeV1.drillId, defaultDrillSource.drillId]],
  [
    'peek-click-transfer',
    [
      peekClickTransferPilotV1.id,
      ...PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES.map((candidate) => candidate.id),
      peekClickTransferPilotV2Randomized.id,
      peekClickTransferPilotV2Masked.id,
    ],
  ],
  ['peek-click-transfer-v1', [peekClickTransferV1.id]],
  [
    'tracking',
    [
      trackingV1.drillId,
      trackingSceneV1.id,
      trackingLongrangeV1.id,
      ...trackingBrVariants.map((variant) => variant.id),
    ],
  ],
  ['detection', [detectionPopinV1.drillId]],
  [
    'micro-flick',
    [
      microFlickThreeTargetTestV1.id,
      microFlickThreeTargetTestV2.id,
      microFlickThreeTargetTestV3.id,
      microFlickThreeTargetTestV4.id,
      microFlickThreeTargetTestV5.id,
      microFlickThreeTargetTestV6.id,
      microFlickThreeTargetTestV7.id,
      microFlickThreeTargetTestV8.id,
    ],
  ],
];

function buildFamilyByDrillId(): ReadonlyMap<string, SessionFamilyId> {
  const map = new Map<string, SessionFamilyId>();
  for (const [family, drillIds] of FAMILY_ROSTER) {
    if (!KNOWN_SESSION_FAMILY_IDS.has(family)) throw new Error(`Unknown session plan family: ${family}`);
    for (const drillId of drillIds) {
      // A drill belongs to exactly one family — two entries would make the rest boundary between
      // them (FR-58.5) depend on lookup order rather than on the construct.
      const existing = map.get(drillId);
      if (existing !== undefined) {
        throw new Error(`Drill ${drillId} is claimed by both '${existing}' and '${family}'`);
      }
      map.set(drillId, family);
    }
  }
  return map;
}

/** drill -> family. Membership here is what makes a drill schedulable; drills outside it are not. */
export const FAMILY_BY_DRILL_ID: ReadonlyMap<string, SessionFamilyId> = buildFamilyByDrillId();

/**
 * Every schedulable drill id, grouped by family in `FAMILY_ROSTER` order. The grouping is the point:
 * the roster is 36 entries, so a flat alphabetical menu would be unusable (WP-58 §3.2 debt).
 */
export const SCHEDULABLE_DRILL_IDS: readonly string[] = [...FAMILY_BY_DRILL_ID.keys()];

/**
 * WP-62 T1 — drill -> the weapon that drill declares for itself. A drill absent from this map
 * declares no weapon, so a Session Plan item may name one for it (FR-62.1); a drill present here
 * has its weapon fixed as an experimental factor and may not be overridden (D-62-1).
 *
 * Every value is read from the drill module's own config, never hand-typed (D-58-T0-2), so "which
 * weapon does this drill declare" cannot drift from what the sim actually receives. That is also
 * why there is no second hand-maintained allowlist here (KI-016): the roster below is derived from
 * the same `trackingBrVariants` this file already imports for `FAMILY_ROSTER`, and
 * `drillFamily.test.ts` walks every schedulable drill's config to prove the derivation stays total.
 *
 * Currently the eight `tracking_br_v1` cells (the 2x2x2 ads x ballistic x angular-height grid,
 * carrying four distinct weapons between them). The two tracking-pilot blocks also declare a weapon
 * but are not schedulable — they load through `loadDrillConfigDirect()`, never through a session
 * program — and the schedulability check below is what keeps them out of this map.
 */
type DeclaredWeaponRosterEntry = readonly [drillId: string, weaponId: string | undefined];

const DECLARED_WEAPON_ROSTER: readonly DeclaredWeaponRosterEntry[] = [
  ...trackingBrVariants.map((variant) => [variant.id, variant.drill.weaponId] as const),
];

/**
 * Exported for the three pollution cases `drillFamily.test.ts` drives through it directly — an
 * unknown weapon id, a drill declaring twice, and an unschedulable drill. Each has to fail at
 * module construction rather than at drill activation, where the scene has already swapped and the
 * operator is left with a half-armed drill (FM-1).
 */
export function buildDeclaredWeaponByDrillId(
  roster: readonly DeclaredWeaponRosterEntry[],
): ReadonlyMap<string, WeaponId> {
  const map = new Map<string, WeaponId>();
  for (const [drillId, weaponId] of roster) {
    if (weaponId === undefined || !isWeaponId(weaponId)) {
      throw new Error(`Drill ${drillId} declares an unknown weapon: ${weaponId}`);
    }
    const existing = map.get(drillId);
    if (existing !== undefined) {
      throw new Error(`Drill ${drillId} declares both '${existing}' and '${weaponId}'`);
    }
    // A drill outside the family table cannot be put into a program at all, so a weapon declaration
    // for it could only ever mislead a reader of this map into thinking it were schedulable.
    if (!FAMILY_BY_DRILL_ID.has(drillId)) {
      throw new Error(`Drill ${drillId} is not schedulable, so it must not declare a weapon here`);
    }
    map.set(drillId, weaponId);
  }
  return map;
}

/** drill -> its own declared weapon. Absence means "no declaration", not "no weapon at runtime". */
export const DECLARED_WEAPON_BY_DRILL_ID: ReadonlyMap<string, WeaponId> =
  buildDeclaredWeaponByDrillId(DECLARED_WEAPON_ROSTER);

/**
 * family -> the drill that represents it on the frozen counterbalanced path. Moved here verbatim
 * from `SessionRunner.ts` (WP-58 T1) so the runner no longer imports drill modules; the six frozen
 * families' return values are unchanged.
 */
export function resolveFamilyDrillId(family: SessionFamilyId): string {
  switch (family) {
    case 'hold-click':
      return holdClickV1.id;
    case 'hold-track':
      return holdTrackV1.id;
    case 'spider-shot':
      return spiderShotV3Binding.id;
    case 'counterstrafe':
      return counterstrafeReversalV1.drillId;
    case 'peek-click-transfer':
      return peekClickTransferPilotV1.id;
    case 'peek-click-transfer-v1':
      return peekClickTransferV1.id;
    case 'spider-shot-wide':
      return spiderShotWideV1Binding.id;
    case 'tracking':
      // WP-58 T-exit (OQ-58.6): the scene-pinned variant, not `tracking_v1`. An unpinned drill
      // inherits whichever scene is loaded, and `tracking_v1`'s 1 u motion range does not clear the
      // boot scene `field-low` (its rocks and trees) — so making it this family's representative
      // handed the operator a frozen session that aborted on its very first step. `tracking_scene_v1`
      // is the same construct in the same family, differing only by pinning `field-low` and
      // narrowing the range to 0.25 u to clear it. Every other family's representative is
      // scene-pinned in `main.ts`'s roster; `drillFamily.test.ts` pins that as an invariant.
      return trackingSceneV1.id;
    case 'detection':
      return detectionPopinV1.drillId;
    case 'micro-flick':
      return microFlickThreeTargetTestV1.id;
  }
}

export type WarmupAvailability = 'available' | 'unavailable';

/**
 * Moved here verbatim from `SessionRunner.ts` (WP-58 T1) together with its one drill import.
 * `counterstrafe` remains the only family with a warmup drill.
 */
export function resolveWarmupDrillId(
  family: SessionFamilyId,
): { availability: WarmupAvailability; drillId?: string } {
  return family === 'counterstrafe'
    ? { availability: 'available', drillId: counterstrafeFreeV1.drillId }
    : { availability: 'unavailable' };
}
