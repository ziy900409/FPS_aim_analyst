import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDrillMetricRegistry } from '../history/DrillMetricRegistry.ts';
import { PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES } from '../drill/peek_click_transfer_pilot_v2.ts';
import { trackingBrVariants } from '../drill/tracking_br_v1.ts';
import { FAMILY_BY_DRILL_ID, SCHEDULABLE_DRILL_IDS, resolveFamilyDrillId } from './drillFamily.ts';
import {
  KNOWN_SESSION_FAMILY_IDS,
  SCHEDULABLE_FAMILY_IDS,
  TEST_FAMILY_IDS,
  TRANSFER_FORMAL_FAMILY_IDS,
  TRANSFER_PILOT_FAMILY_IDS,
  buildFamilyOrder,
} from './sessionSchedule.ts';

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
    expect(resolveFamilyDrillId('tracking')).toBe('tracking_v1');
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
    expect(FAMILY_BY_DRILL_ID.size).toBe(36);
    expect(SCHEDULABLE_DRILL_IDS).toHaveLength(FAMILY_BY_DRILL_ID.size);
    expect(new Set(SCHEDULABLE_DRILL_IDS).size).toBe(SCHEDULABLE_DRILL_IDS.length);
  });

  it('leaves off-roster drills unschedulable rather than giving them a fallback family', () => {
    // `counterstrafe-cued-v1` exists as a module but is not registered in `availableDrills`;
    // the tracking-pilot blocks are owned by `TrackingPilotRunner` via `loadDrillConfigDirect()`.
    for (const id of ['counterstrafe-cued-v1', 'tracking_core_pr_pilot_v1', 'tracking_reversal_pilot_v1']) {
      expect(FAMILY_BY_DRILL_ID.get(id)).toBeUndefined();
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
      tracking: 11,
      detection: 1,
      'micro-flick': 8,
    });
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
