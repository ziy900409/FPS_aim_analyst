import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import defaultDrillSource from '../../drills/counterstrafe_ad_v1.json';
import { createDrillMetricRegistry } from '../history/DrillMetricRegistry.ts';
import { counterstrafeFreeV1 } from '../drill/counterstrafe_free_v1.ts';
import { counterstrafeReversalV1 } from '../drill/counterstrafe_reversal_v1.ts';
import { resolveDrillTimeLimitMs, type DrillConfig } from '../drill/DrillConfig.ts';
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
import { spiderShotV3, spiderShotV3Binding } from '../drill/spider_shot_v3.ts';
import { resolveSpiderShotWideV1, spiderShotWideV1Binding } from '../drill/spider_shot_wide_v1.ts';
import { trackingBrVariants } from '../drill/tracking_br_v1.ts';
import { trackingLongrangeV1 } from '../drill/tracking_longrange_v1.ts';
import { trackingSceneV1 } from '../drill/tracking_scene_v1.ts';
import { trackingV1 } from '../drill/tracking_v1.ts';
import { WEAPONS, isWeaponId } from '../weapon/weapons.ts';
import {
  DECLARED_WEAPON_BY_DRILL_ID,
  FAMILY_BY_DRILL_ID,
  SCHEDULABLE_DRILL_IDS,
  buildDeclaredWeaponByDrillId,
  resolveFamilyDrillId,
} from './drillFamily.ts';
import {
  KNOWN_SESSION_FAMILY_IDS,
  SCHEDULABLE_FAMILY_IDS,
  TEST_FAMILY_IDS,
  TRANSFER_FORMAL_FAMILY_IDS,
  TRANSFER_PILOT_FAMILY_IDS,
  buildFamilyOrder,
} from './sessionSchedule.ts';
import {
  ALL_TRACKING_PILOT_CONFIGS,
  TRACKING_PILOT_RUNTIME_DRILLS,
  TRACKING_PILOT_SCHEDULABLE_DRILL_IDS,
  TRACKING_PILOT_SCHEDULABLE_DRILLS,
} from './trackingPilotSchedulableDrills.ts';

/**
 * WP-64 T1: the seven WP-54 tracking-pilot blocks the researcher did *not* curate. They must stay
 * exactly as unschedulable as all nine were before WP-64 — "one pilot block became schedulable" may
 * never generalise to "the pilot manifest is schedulable" (FM-64.4).
 */
const UNCURATED_TRACKING_PILOT_DRILL_IDS: readonly string[] = ALL_TRACKING_PILOT_CONFIGS
  .map((config) => config.drillId)
  .filter((drillId) => !TRACKING_PILOT_SCHEDULABLE_DRILL_IDS.includes(drillId));

/**
 * WP-58 T1 — README §2.3's four invariants for the drill <-> family single source, plus the
 * additive-only guarantee for `KNOWN_SESSION_FAMILY_IDS` (FR-58.2).
 */

describe('WP-58 T1 — invariant 1: family -> drill -> family round trip', () => {
  it.each([...KNOWN_SESSION_FAMILY_IDS])('%s resolves to a drill that maps back to it', (family) => {
    expect(FAMILY_BY_DRILL_ID.get(resolveFamilyDrillId(family))).toBe(family);
  });

  it('keeps every frozen family resolving to the same drill as before WP-58', () => {
    // The six pre-WP-58 families, pinned as literals on purpose: this is the one place where a
    // literal is the assertion rather than a source of error (see D-58-T0-2).
    expect(resolveFamilyDrillId('hold-click')).toBe('hold_click_v1');
    expect(resolveFamilyDrillId('hold-track')).toBe('hold_track_v1');
    expect(resolveFamilyDrillId('spider-shot')).toBe('spider-shot-v3');
    expect(resolveFamilyDrillId('counterstrafe')).toBe('counterstrafe-reversal-v1');
    expect(resolveFamilyDrillId('peek-click-transfer')).toBe('peek_click_transfer_pilot_v1_2deg');
    expect(resolveFamilyDrillId('peek-click-transfer-v1')).toBe('peek_click_transfer_v1');
  });

  it('gives each new family a representative drill of its own', () => {
    // WP-58 T-exit (OQ-58.6): the scene-pinned variant. `tracking_v1` pins no scene, so on the
    // frozen path it inherited the boot scene `field-low` and failed clearance before the first
    // countdown — see the roster invariant below.
    expect(resolveFamilyDrillId('tracking')).toBe('tracking_scene_v1');
    expect(resolveFamilyDrillId('detection')).toBe('detection_popin_v1');
    expect(resolveFamilyDrillId('micro-flick')).toBe('micro_flick_three_target_test_v1');
    expect(resolveFamilyDrillId('spider-shot-wide')).toBe('spider-shot-wide-v1');
    // The wide-flick sibling construct must not collapse into `spider-shot` (D-58-T0-1): a program
    // crossing between them has to earn the family rest, not the shorter drill rest.
    expect(resolveFamilyDrillId('spider-shot-wide')).not.toBe(resolveFamilyDrillId('spider-shot'));
  });
});

describe('WP-58 T1 — invariant 2: the table covers exactly `main.ts`\'s roster', () => {
  /**
   * `availableDrills` lives inside `main.ts`, which cannot be imported here (top-level await +
   * WebGPU + DOM). Parsing its literal is the only way to notice the failure mode that matters:
   * someone adds a drill to the roster and forgets this table, leaving a drill that the Session
   * Plan form offers but the compiler (T2) rejects. Every id in the table is read from the same
   * drill-module constants `main.ts` uses, so a size mismatch is the only way they can diverge.
   */
  function rosterSizeFromMain(): number {
    const source = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
    const start = source.indexOf('const availableDrills: AvailableDrill[] = [');
    expect(start, 'availableDrills literal not found in main.ts').toBeGreaterThan(-1);
    const block = source.slice(start, source.indexOf('\n];', start));

    const explicitEntries = (block.match(/\n {2}\{/g) ?? []).length;
    const spreadLengths: Record<string, number> = {
      PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES: PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES.length,
      trackingBrVariants: trackingBrVariants.length,
      TRACKING_PILOT_RUNTIME_DRILLS: TRACKING_PILOT_RUNTIME_DRILLS.length,
    };
    let spreadTotal = 0;
    for (const [, spreadSource] of block.matchAll(/\n {2}\.\.\.(\[[^\]]*\]|[A-Za-z_$][\w$]*)/g)) {
      if (spreadSource.startsWith('[')) {
        spreadTotal += spreadSource
          .slice(1, -1)
          .split(',')
          .filter((entry) => entry.trim() !== '').length;
        continue;
      }
      const known = spreadLengths[spreadSource];
      // An unrecognized spread source means the roster grew in a shape this parser cannot count —
      // fail loudly rather than silently under-counting and passing.
      expect(known, `unrecognized availableDrills spread: ${spreadSource}`).toBeDefined();
      spreadTotal += known ?? 0;
    }
    return explicitEntries + spreadTotal;
  }

  it('registers every roster drill exactly once, with no extras', () => {
    expect(FAMILY_BY_DRILL_ID.size).toBe(rosterSizeFromMain());
    // 36 through WP-62, + the two WP-64 curated tracking-pilot blocks.
    expect(FAMILY_BY_DRILL_ID.size).toBe(38);
    expect(SCHEDULABLE_DRILL_IDS).toHaveLength(FAMILY_BY_DRILL_ID.size);
    expect(new Set(SCHEDULABLE_DRILL_IDS).size).toBe(SCHEDULABLE_DRILL_IDS.length);
  });

  it('leaves off-roster drills unschedulable rather than giving them a fallback family', () => {
    // `counterstrafe-cued-v1` exists as a module but is not registered in `availableDrills`; the
    // uncurated tracking-pilot blocks stay owned by `TrackingPilotRunner` via
    // `loadDrillConfigDirect()` (WP-64 curated exactly two of the nine, FR-64.1).
    expect(UNCURATED_TRACKING_PILOT_DRILL_IDS).toHaveLength(7);
    for (const id of ['counterstrafe-cued-v1', ...UNCURATED_TRACKING_PILOT_DRILL_IDS]) {
      expect(FAMILY_BY_DRILL_ID.get(id), id).toBeUndefined();
    }
  });

  it('groups the roster by family, at the T0-frozen sizes', () => {
    const sizeByFamily = new Map<string, number>();
    for (const family of FAMILY_BY_DRILL_ID.values()) {
      sizeByFamily.set(family, (sizeByFamily.get(family) ?? 0) + 1);
    }
    expect(Object.fromEntries(sizeByFamily)).toEqual({
      'hold-click': 1,
      'hold-track': 1,
      'spider-shot': 3,
      'spider-shot-wide': 1,
      counterstrafe: 3,
      'peek-click-transfer': 6,
      'peek-click-transfer-v1': 1,
      tracking: 13, // 11 through WP-62, + the two WP-64 curated tracking-pilot blocks
      detection: 1,
      'micro-flick': 8,
    });
  });
});

describe('WP-58 T-exit — invariant 5: every family representative pins a scene (OQ-58.6)', () => {
  /**
   * A roster entry without a `sceneId` inherits whichever scene happens to be loaded. That is
   * survivable for a drill a researcher picks by hand, but a *family representative* is what the
   * frozen Session Plan loads unattended, starting from the boot scene `field-low`.
   *
   * T1 made `tracking` a session family whose representative was the unpinned `tracking_v1`, whose
   * 1 u motion range does not clear `field-low`'s rocks and trees — so every frozen session that
   * included the family aborted before its first countdown. T6's live e2e found it; T-exit repointed
   * the family at `tracking_scene_v1` (same construct, same family, pinned to `field-low` with a
   * 0.25 u range). This invariant is what stops the class from coming back.
   *
   * `counterstrafe` is the single documented exception: its three drills predate scene pinning, are
   * `field-low` natives, and have shipped on the frozen path since before WP-58.
   */
  const SCENELESS_ROSTER_EXPRESSIONS: ReadonlyMap<string, string> = new Map([
    // Read from the same module constants `main.ts` uses — never hand-typed ids (D-58-T0-2).
    ['initialDrillConfig.drillId', defaultDrillSource.drillId],
    ['trackingV1.drillId', trackingV1.drillId],
    ['counterstrafeReversalV1.drillId', counterstrafeReversalV1.drillId],
    ['counterstrafeFreeV1.drillId', counterstrafeFreeV1.drillId],
  ]);

  /**
   * WP-64 T2 — a roster entry built outside this literal has no textual `sceneId` to scan for, so
   * its pinning is read off the objects instead. `TRACKING_PILOT_RUNTIME_DRILLS` moved out of
   * `main.ts` precisely so its `field-low` pin could be *executed* by a test (OQ-64.5); this map is
   * what keeps that move from quietly turning the entries into unreviewed scene-less ones here.
   */
  const PREBUILT_ROSTER_SPREADS: ReadonlyMap<string, readonly { id: string; sceneId?: string }[]> =
    new Map([['TRACKING_PILOT_RUNTIME_DRILLS', TRACKING_PILOT_RUNTIME_DRILLS]]);

  function scenelessRosterDrillIds(): Set<string> {
    const source = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
    const start = source.indexOf('const availableDrills: AvailableDrill[] = [');
    expect(start, 'availableDrills literal not found in main.ts').toBeGreaterThan(-1);
    const block = source.slice(start, source.indexOf('\n];', start));

    const ids = new Set<string>();
    for (const entry of block.split(/\n {2}(?=\{|\.\.\.)/).slice(1)) {
      if (entry.includes('sceneId')) continue;
      const spread = /^\.\.\.([A-Za-z_$][\w$]*),/.exec(entry.trim())?.[1];
      if (spread !== undefined) {
        const prebuilt = PREBUILT_ROSTER_SPREADS.get(spread);
        expect(prebuilt, `unrecognized prebuilt roster spread: ${spread}`).toBeDefined();
        for (const option of prebuilt ?? []) if (option.sceneId === undefined) ids.add(option.id);
        continue;
      }
      const expression = /\bid:\s*([^,\n]+)/.exec(entry)?.[1]?.trim();
      const id = expression === undefined ? undefined : SCENELESS_ROSTER_EXPRESSIONS.get(expression);
      // A scene-less entry this map cannot resolve means the roster grew an unpinned drill nobody
      // reviewed against this invariant — fail loudly rather than skip it and pass.
      expect(id, `unrecognized scene-less roster entry: ${expression ?? entry.slice(0, 80)}`).toBeDefined();
      if (id !== undefined) ids.add(id);
    }
    return ids;
  }

  it('leaves only the field-low-native counterstrafe drills unpinned', () => {
    expect(scenelessRosterDrillIds()).toEqual(
      new Set([defaultDrillSource.drillId, counterstrafeReversalV1.drillId, counterstrafeFreeV1.drillId, trackingV1.drillId]),
    );
  });

  it.each([...KNOWN_SESSION_FAMILY_IDS].filter((family) => family !== 'counterstrafe'))(
    "%s's representative drill pins its own scene",
    (family) => {
      expect(scenelessRosterDrillIds()).not.toContain(resolveFamilyDrillId(family));
    },
  );

  it('still lets an unpinned drill be scheduled by hand, just not represent a family', () => {
    // FR-58.3's shape, one layer up: reachability and representation are separate questions.
    // `tracking_v1` stays schedulable in a custom program (where the operator chooses what precedes
    // it); what it may not be is the drill a frozen session loads sight-unseen.
    expect(FAMILY_BY_DRILL_ID.get(trackingV1.drillId)).toBe('tracking');
    expect(SCHEDULABLE_DRILL_IDS).toContain(trackingV1.drillId);
  });
});

describe('WP-58 T1 — invariant 3: every mapped family is in the KI-016 allowlist', () => {
  it('maps only to allowlisted families', () => {
    for (const [drillId, family] of FAMILY_BY_DRILL_ID) {
      expect(KNOWN_SESSION_FAMILY_IDS.has(family), drillId).toBe(true);
    }
  });

  it('covers every allowlisted family with at least one drill', () => {
    expect(new Set(FAMILY_BY_DRILL_ID.values())).toEqual(new Set(KNOWN_SESSION_FAMILY_IDS));
  });

  it('extends the allowlist additively — the frozen rosters are byte-identical (FR-58.2)', () => {
    expect(TEST_FAMILY_IDS).toEqual(['hold-click', 'hold-track', 'spider-shot', 'counterstrafe']);
    expect(TRANSFER_PILOT_FAMILY_IDS).toEqual(['hold-click', 'counterstrafe', 'peek-click-transfer']);
    expect(TRANSFER_FORMAL_FAMILY_IDS).toEqual(['peek-click-transfer-v1']);
    expect(SCHEDULABLE_FAMILY_IDS).toEqual(['tracking', 'detection', 'micro-flick', 'spider-shot-wide']);
    expect([...KNOWN_SESSION_FAMILY_IDS]).toHaveLength(10);
    // `buildFamilyOrder()` rotates over `TEST_FAMILY_IDS` only, so the new ids cannot reach the
    // counterbalanced frozen assessment order.
    for (let sessionIndex = 0; sessionIndex < 4; sessionIndex += 1) {
      expect(new Set(buildFamilyOrder('participant-1', sessionIndex))).toEqual(new Set(TEST_FAMILY_IDS));
    }
  });
});

describe('WP-58 T1 — invariant 4: family membership does not grant Assessment eligibility (FR-58.3)', () => {
  /**
   * The decoupling already holds in production (GD-35 (5)): eligibility is decided by
   * `DrillConfig.mode` and by `DrillMetricRegistry`'s exact-id registrations, neither of which
   * consults a family. This suite exists to keep it that way — specifically to fail if anyone ever
   * adds a prefix/family fallback to the registry so that "schedulable" starts implying "scored".
   */
  const PRACTICE_ONLY_DRILL_IDS = [
    'detection_popin_v1',
    'tracking_v1',
    'tracking_scene_v1',
    'tracking_longrange_v1',
    'spider-shot-wide-v1',
    'counterstrafe-free-v1',
    'counterstrafe_ad_v1',
    'peek_click_transfer_pilot_v1_2deg',
    'peek_click_transfer_pilot_v2_1deg',
    'peek_click_transfer_pilot_v2_2_5deg',
    'peek_click_transfer_pilot_v2_5deg',
    'peek_click_transfer_pilot_v2_randomized',
    'peek_click_transfer_pilot_v2_masked',
    ...Array.from({ length: 8 }, (_unused, index) => `micro_flick_three_target_test_v${index + 1}`),
    ...trackingBrVariants.map((variant) => variant.id),
  ];

  it.each(PRACTICE_ONLY_DRILL_IDS)('%s is schedulable but carries no metric registration', (drillId) => {
    expect(FAMILY_BY_DRILL_ID.has(drillId)).toBe(true);
    expect(createDrillMetricRegistry().registrationForExactDrill(drillId)).toBeUndefined();
  });

  it('leaves the three registered assessment drills as the only registered ids', () => {
    const registry = createDrillMetricRegistry();
    const registered = SCHEDULABLE_DRILL_IDS.filter(
      (drillId) => registry.registrationForExactDrill(drillId) !== undefined,
    );
    expect(registered).toEqual(['spider-shot-v2', 'spider-shot-v3', 'peek_click_transfer_v1']);
  });

  it('does not register a family id itself as a drill', () => {
    const registry = createDrillMetricRegistry();
    for (const family of KNOWN_SESSION_FAMILY_IDS) {
      expect(registry.registrationForExactDrill(family), family).toBeUndefined();
      // A family id is never a drill id — nothing may become schedulable by naming its family.
      expect(FAMILY_BY_DRILL_ID.has(family), family).toBe(false);
    }
  });
});

/**
 * WP-62 T1 — `DECLARED_WEAPON_BY_DRILL_ID` is the single source for "does this drill fix its own
 * weapon", which T2 uses to reject an override (D-62-1) and T4 uses to name the weapon in the
 * preview. A derived map is only worth as much as the proof that its derivation is *total*, so the
 * first suite walks every schedulable drill's real config rather than the map's own keys.
 */

/**
 * Every schedulable drill's actual config source, in `main.ts`'s `availableDrills` order.
 *
 * The element type keeps `drillId` even though only `weaponId` is read: a shape of nothing but
 * optional properties is a weak type, which TypeScript will happily accept an unrelated object for.
 * Requiring `drillId` is what makes "this really is a drill config" a compile-time claim.
 */

/**
 * WP-65 / T4 — the roster's one JSON-sourced drill needs its `endCondition.type` narrowed:
 * `resolveJsonModule` types it as plain `string`. Narrowed by checking the value rather than
 * asserting it, so a JSON that grew an unknown end condition fails loudly here instead of being
 * cast into the shape the suites below expect. Every other entry is a typed module and needs none
 * of this.
 */
function narrowJsonDrill(
  source: typeof defaultDrillSource,
): Pick<DrillConfig, 'drillId' | 'weaponId' | 'endCondition'> {
  const type = source.endCondition.type;
  if (type !== 'targetCount' && type !== 'timeLimit') {
    throw new Error(`${source.drillId} declares an unknown endCondition type: ${type}`);
  }
  return { drillId: source.drillId, endCondition: { type, value: source.endCondition.value } };
}
const SCHEDULABLE_DRILL_SOURCES: readonly (readonly [
  string,
  Pick<DrillConfig, 'drillId' | 'weaponId' | 'endCondition'>,
])[] = [
  // Ids read from the drill modules, never hand-typed (D-58-T0-2).
  [defaultDrillSource.drillId, narrowJsonDrill(defaultDrillSource)],
  [detectionPopinV1.drillId, detectionPopinV1],
  [trackingV1.drillId, trackingV1],
  [trackingSceneV1.id, trackingSceneV1.drill],
  [trackingLongrangeV1.id, trackingLongrangeV1.drill],
  [holdClickV1.id, holdClickV1.drill],
  [holdTrackV1.id, holdTrackV1.drill],
  [spiderShotV1.drillId, spiderShotV1],
  [spiderShotV2.drillId, spiderShotV2],
  [spiderShotV3Binding.id, spiderShotV3],
  // OQ-62.3: the one roster entry whose config is produced at arm time. `resolveSpiderShotWideV1`
  // is a pure function of (vertical FOV, aspect) and needs no scene, so covering the lazy binding
  // costs nothing here — the same 75 / 16:9 pair `spider_shot_wide_v1.test.ts` uses.
  [spiderShotWideV1Binding.id, resolveSpiderShotWideV1(75, 16 / 9)],
  [counterstrafeReversalV1.drillId, counterstrafeReversalV1],
  [counterstrafeFreeV1.drillId, counterstrafeFreeV1],
  [peekClickTransferPilotV1.id, peekClickTransferPilotV1.drill],
  ...PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES.map(
    (candidate) => [candidate.id, candidate.drill] as const,
  ),
  [peekClickTransferPilotV2Randomized.id, peekClickTransferPilotV2Randomized.drill],
  [peekClickTransferPilotV2Masked.id, peekClickTransferPilotV2Masked.drill],
  [peekClickTransferV1.id, peekClickTransferV1.drill],
  ...[
    microFlickThreeTargetTestV1,
    microFlickThreeTargetTestV2,
    microFlickThreeTargetTestV3,
    microFlickThreeTargetTestV4,
    microFlickThreeTargetTestV5,
    microFlickThreeTargetTestV6,
    microFlickThreeTargetTestV7,
    microFlickThreeTargetTestV8,
  ].map((variant) => [variant.id, variant.drill] as const),
  ...trackingBrVariants.map((variant) => [variant.id, variant.drill] as const),
  // WP-64 T1: the curated tracking-pilot blocks, read from the same registry the map derives from.
  ...TRACKING_PILOT_SCHEDULABLE_DRILLS.map((entry) => [entry.config.drillId, entry.config] as const),
];

describe('WP-62 T1 — the declared-weapon map matches every schedulable drill config', () => {
  it('covers every schedulable drill, with no entry for anything off the roster', () => {
    // Full coverage of all 38 (OQ-62.3, no exemptions taken): a subset would leave exactly the
    // drills nobody checked as the ones free to grow a `weaponId` unnoticed.
    expect(new Set(SCHEDULABLE_DRILL_SOURCES.map(([drillId]) => drillId))).toEqual(
      new Set(SCHEDULABLE_DRILL_IDS),
    );
    expect(SCHEDULABLE_DRILL_SOURCES).toHaveLength(SCHEDULABLE_DRILL_IDS.length);
  });

  it.each(SCHEDULABLE_DRILL_SOURCES)(
    '%s declares in the map exactly what its config declares',
    (drillId, source) => {
      // The negative half — both sides `undefined` for the 28 drills that declare nothing — is the
      // half that catches the real failure mode: a drill gains a `weaponId`, nobody adds it here,
      // and T2 then lets a Session Plan item silently override an experimental factor.
      expect(DECLARED_WEAPON_BY_DRILL_ID.get(drillId)).toBe(source.weaponId);
    },
  );

  it('never maps an unschedulable drill, including the pilot blocks WP-64 left uncurated', () => {
    // All nine WP-54 blocks declare `tracking_pilot_hold`; only the two curated ones may appear.
    for (const drillId of UNCURATED_TRACKING_PILOT_DRILL_IDS) {
      expect(FAMILY_BY_DRILL_ID.has(drillId), drillId).toBe(false);
      expect(DECLARED_WEAPON_BY_DRILL_ID.has(drillId), drillId).toBe(false);
    }
  });

  it('holds exactly the eight BR cells plus the two curated pilot blocks, so a change of scope cannot pass review unnoticed', () => {
    expect(DECLARED_WEAPON_BY_DRILL_ID.size).toBe(10);
    expect(new Set(DECLARED_WEAPON_BY_DRILL_ID.keys())).toEqual(
      new Set([
        ...trackingBrVariants.map((variant) => variant.id),
        ...TRACKING_PILOT_SCHEDULABLE_DRILLS.map((entry) => entry.config.drillId),
      ]),
    );
    // Eight cells, four weapons: the grid's third axis (angular height) is a target-geometry factor,
    // not a weapon one, so the ads x ballistic pairs repeat across it.
    expect(new Set(DECLARED_WEAPON_BY_DRILL_ID.values())).toEqual(
      new Set([
        'ak47_br_hip_hitscan',
        'ak47_br_ads_hitscan',
        'ak47_br_hip_projectile',
        'ak47_br_ads_projectile',
        // WP-64 T1: both curated pilot blocks fix the same zero-recoil hold weapon (FR-64.4).
        'tracking_pilot_hold',
      ]),
    );
  });

  it('holds only real weapon ids, not ids that merely type-check', () => {
    for (const [drillId, weaponId] of DECLARED_WEAPON_BY_DRILL_ID) {
      expect(isWeaponId(weaponId), drillId).toBe(true);
      expect(WEAPONS[weaponId], drillId).toBeDefined();
    }
  });
});

describe('WP-62 T1 — the map refuses to be built from a polluted roster', () => {
  const schedulableDrillId = trackingBrVariants[0].id;

  it('rejects a weapon id that is not in WEAPONS', () => {
    expect(() => buildDeclaredWeaponByDrillId([[schedulableDrillId, 'ak47_br_hip_railgun']])).toThrow(
      /declares an unknown weapon: ak47_br_hip_railgun/,
    );
  });

  it('rejects a drill whose config lost its weapon id', () => {
    // The derivation reads `variant.drill.weaponId`, which `DrillConfig` allows to be absent — so
    // "the BR grid dropped its weapon" has to fail loudly rather than map to `undefined` and look
    // exactly like the 28 drills that legitimately declare nothing.
    expect(() => buildDeclaredWeaponByDrillId([[schedulableDrillId, undefined]])).toThrow(
      /declares an unknown weapon: undefined/,
    );
  });

  it('rejects the same drill declaring twice', () => {
    expect(() =>
      buildDeclaredWeaponByDrillId([
        [schedulableDrillId, 'ak47'],
        [schedulableDrillId, 'm4a4'],
      ]),
    ).toThrow(/declares both 'ak47' and 'm4a4'/);
  });

  it('rejects a drill that is not schedulable', () => {
    expect(() =>
      buildDeclaredWeaponByDrillId([['tracking_core_pr_pilot_v1', 'tracking_pilot_hold']]),
    ).toThrow(/is not schedulable/);
  });
});

/**
 * WP-65 / T4（FR-65.7）— the third projection over the same roster list: which drills have a total
 * duration the HUD may count down. The classification lives in `resolveDrillTimeLimitMs()`, read
 * here off every schedulable drill's real config rather than off a hand-kept list, so a drill that
 * changes its `endCondition` type cannot quietly change what its Time card shows.
 */
const COUNTDOWN_DRILL_IDS = [
  'spider-shot-v2',
  'spider-shot-v3',
  'spider-shot-wide-v1',
  'tracking_core_pr_pilot_v1_2deg_5dps',
  'tracking_reversal_pilot_v1_high',
] as const;

describe('WP-65 T4 — exactly the time-limited drills expose a duration to count down', () => {
  it.each(SCHEDULABLE_DRILL_SOURCES)('%s classifies from its own endCondition', (drillId, source) => {
    const expected = (COUNTDOWN_DRILL_IDS as readonly string[]).includes(drillId);
    expect(source.endCondition.type === 'timeLimit').toBe(expected);
    // The count-up half is the one that matters: a `targetCount` drill that leaked a limit would
    // show "118 s remaining" from its 120 s backstop — information the drill never promised.
    expect(resolveDrillTimeLimitMs(source as DrillConfig) !== undefined).toBe(expected);
  });

  it('names every countdown drill in the frozen list, and nothing else', () => {
    const fromRoster = SCHEDULABLE_DRILL_SOURCES.filter(
      ([, source]) => resolveDrillTimeLimitMs(source as DrillConfig) !== undefined,
    ).map(([drillId]) => drillId);
    expect(new Set(fromRoster)).toEqual(new Set(COUNTDOWN_DRILL_IDS));
    expect(fromRoster).toHaveLength(COUNTDOWN_DRILL_IDS.length);
    // Covered against the roster the app actually offers, so a new drill nobody listed here fails
    // this suite rather than silently defaulting to counting up.
    expect(new Set(SCHEDULABLE_DRILL_SOURCES.map(([drillId]) => drillId))).toEqual(
      new Set(SCHEDULABLE_DRILL_IDS),
    );
  });

  it('never reads the 120 s backstop as a duration', () => {
    // `timing.timeLimitMs` and `endCondition.value` are different quantities; the drills that carry
    // both are exactly where confusing them would be invisible.
    for (const [drillId, source] of SCHEDULABLE_DRILL_SOURCES) {
      const limit = resolveDrillTimeLimitMs(source as DrillConfig);
      if (limit === undefined) continue;
      expect(limit, drillId).toBe(source.endCondition.value);
    }
  });
});
