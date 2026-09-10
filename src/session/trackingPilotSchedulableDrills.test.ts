import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { buildTrackingCorePrPilotV1Cell } from '../drill/tracking_core_pr_pilot_v1.ts';
import { trackingReversalPilotV1High } from '../drill/tracking_reversal_pilot_v1.ts';
import { DECLARED_WEAPON_BY_DRILL_ID, FAMILY_BY_DRILL_ID, SCHEDULABLE_DRILL_IDS } from './drillFamily.ts';
import {
  ALL_TRACKING_PILOT_CONFIGS,
  buildCuratedRegistry,
  TRACKING_PILOT_SCHEDULABLE_DRILL_IDS,
  TRACKING_PILOT_SCHEDULABLE_DRILLS,
} from './trackingPilotSchedulableDrills.ts';

/**
 * WP-64 T1. The registry's whole job is to be the *only* answer to "which tracking-pilot block is
 * schedulable", so these tests check two things and nothing else: that the two curated entries are
 * bit-for-bit the canonical WP-54 configs, and that the other seven blocks stay exactly as
 * unreachable as they were before this module existed (T0 §6 baseline: all nine absent).
 */

const CURATED_CORE = buildTrackingCorePrPilotV1Cell(2, 5);
const SELECTED_IDS = [CURATED_CORE.drillId, trackingReversalPilotV1High.drillId] as const;
const COMPLEMENT_IDS = ALL_TRACKING_PILOT_CONFIGS.map((config) => config.drillId).filter(
  (drillId) => !SELECTED_IDS.includes(drillId as (typeof SELECTED_IDS)[number]),
);

/** A minimal stand-in for "a drill that is not a WP-54 pilot block" — never registered anywhere. */
const OFF_CENSUS: DrillConfig = { ...CURATED_CORE, drillId: 'not_a_tracking_pilot_block' };

describe('WP-64 T1 — the curated registry is exactly the two approved WP-54 blocks (FR-64.1)', () => {
  it('holds the nine-block census it validates against, with unique ids', () => {
    expect(ALL_TRACKING_PILOT_CONFIGS).toHaveLength(9);
    expect(new Set(ALL_TRACKING_PILOT_CONFIGS.map((config) => config.drillId)).size).toBe(9);
  });

  it('curates the 2deg/5dps core cell and the high-density reversal cell, in that order', () => {
    expect(TRACKING_PILOT_SCHEDULABLE_DRILL_IDS).toEqual([
      'tracking_core_pr_pilot_v1_2deg_5dps',
      'tracking_reversal_pilot_v1_high',
    ]);
    expect(TRACKING_PILOT_SCHEDULABLE_DRILL_IDS).toEqual([...SELECTED_IDS]);
    // NFR-64.2: 1-2, never "the whole pilot manifest".
    expect(TRACKING_PILOT_SCHEDULABLE_DRILLS.length).toBeGreaterThanOrEqual(1);
    expect(TRACKING_PILOT_SCHEDULABLE_DRILLS.length).toBeLessThanOrEqual(2);
  });

  it('carries the canonical configs unmodified — no clone, no re-seed, no re-shaped stimulus (FR-64.2)', () => {
    const [core, reversal] = TRACKING_PILOT_SCHEDULABLE_DRILLS;
    // The builder is deterministic, so an equal-but-rebuilt config is the strongest available check
    // that nothing was spread-and-edited on the way in.
    expect(core.config).toEqual(CURATED_CORE);
    expect(reversal.config).toBe(trackingReversalPilotV1High);
  });

  it('pins the primary seeds T0 froze, so a rep can never become a different sample (OQ-64.4)', () => {
    const seeds = TRACKING_PILOT_SCHEDULABLE_DRILLS.map((entry) => entry.config.targets.trackingTrajectory?.seed);
    expect(seeds).toEqual([54012, 54101]);
  });

  it('covers both trajectory generators — steady pursuit and reactive correction', () => {
    const kinds = TRACKING_PILOT_SCHEDULABLE_DRILLS.map((entry) => entry.config.targets.trackingTrajectory?.kind);
    expect(kinds).toEqual(['band-limited-2d-v1', 'reversal-2d-v1']);
  });

  it('declares tracking / field-low / session-plan-only for every entry (FR-64.5, OQ-64.2)', () => {
    for (const entry of TRACKING_PILOT_SCHEDULABLE_DRILLS) {
      expect(entry.family, entry.config.drillId).toBe('tracking');
      expect(entry.sceneId, entry.config.drillId).toBe('field-low');
      expect(entry.selectionSurface, entry.config.drillId).toBe('session-plan-only');
    }
  });

  it('keeps every entry practice-mode and pinned to the pilot hold weapon (FR-64.4/FR-64.8)', () => {
    for (const entry of TRACKING_PILOT_SCHEDULABLE_DRILLS) {
      expect(entry.config.mode, entry.config.drillId).toBe('practice');
      expect(entry.config.weaponId, entry.config.drillId).toBe('tracking_pilot_hold');
      // The scored-window guard is part of the stimulus and travels with the config untouched.
      expect(entry.config.protocolGuard, entry.config.drillId).toEqual({ requireFire: true, noMovement: true });
    }
  });
});

describe('WP-64 T1 — the seven unselected pilot blocks stay unreachable (NFR-64.2/FM-64.4)', () => {
  it('leaves exactly seven blocks outside the curated set', () => {
    expect(COMPLEMENT_IDS).toEqual([
      'tracking_core_pr_pilot_v1_practice',
      'tracking_core_pr_pilot_v1_calibration_horizontal',
      'tracking_core_pr_pilot_v1_calibration_vertical',
      'tracking_core_pr_pilot_v1_3deg_5dps',
      'tracking_core_pr_pilot_v1_3deg_14dps',
      'tracking_core_pr_pilot_v1_2deg_14dps',
      'tracking_reversal_pilot_v1_medium',
    ]);
  });

  it.each(COMPLEMENT_IDS)('%s is neither curated nor schedulable', (drillId) => {
    expect(TRACKING_PILOT_SCHEDULABLE_DRILL_IDS).not.toContain(drillId);
    expect(FAMILY_BY_DRILL_ID.has(drillId)).toBe(false);
    expect(SCHEDULABLE_DRILL_IDS).not.toContain(drillId);
    expect(DECLARED_WEAPON_BY_DRILL_ID.has(drillId)).toBe(false);
  });
});

describe('WP-64 T1 — family, weapon and runtime all derive from this one registry (FR-64.9)', () => {
  it.each([...SELECTED_IDS])('%s is in the tracking family with its weapon fixed', (drillId) => {
    expect(FAMILY_BY_DRILL_ID.get(drillId)).toBe('tracking');
    expect(SCHEDULABLE_DRILL_IDS).toContain(drillId);
    expect(DECLARED_WEAPON_BY_DRILL_ID.get(drillId)).toBe('tracking_pilot_hold');
  });

  /**
   * FM-64.2 is "family roster grows, runtime registry does not" — the operator picks the drill,
   * the preview renders, and the session dies on `Unknown drill` after the scene has swapped.
   * `main.ts` cannot be imported here (top-level await + WebGPU + DOM), so the check is that its
   * roster is *derived from this module* rather than restated: a second hand-written list is the
   * only way the two can disagree.
   */
  it('registers the curated entries in `main.ts` by spreading this registry, not by hand', () => {
    const source = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
    const start = source.indexOf('const availableDrills: AvailableDrill[] = [');
    expect(start, 'availableDrills literal not found in main.ts').toBeGreaterThan(-1);
    const block = source.slice(start, source.indexOf('\n];', start));

    expect(block).toContain('...TRACKING_PILOT_SCHEDULABLE_DRILLS.map(');
    for (const drillId of ALL_TRACKING_PILOT_CONFIGS.map((config) => config.drillId)) {
      expect(block, `${drillId} must never be hand-written into the roster`).not.toContain(drillId);
    }
  });

  /**
   * FM-64.8 — the ad hoc path must not be able to grow manifest semantics (counterbalance,
   * alternate seeds, retry/abort, eligibility) by quietly reaching for the formal pilot modules.
   */
  it('imports neither the pilot manifest nor the pilot runner', () => {
    const source = readFileSync(new URL('./trackingPilotSchedulableDrills.ts', import.meta.url), 'utf8');
    // Module specifiers only — the doc comments name both modules on purpose, to say why they are
    // absent, and a naive substring scan would read that explanation as the violation.
    const specifiers = [...source.matchAll(/from '([^']+)'/g)].map(([, specifier]) => specifier);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier).not.toContain('trackingPilotManifest');
      expect(specifier).not.toContain('TrackingPilotRunner');
    }
  });
});

describe('WP-64 T1 — the registry refuses to be built from a polluted list (FM-64.2/FM-64.4)', () => {
  it('rejects an empty list', () => {
    expect(() => buildCuratedRegistry([])).toThrow(/must hold 1-2 drills/);
  });

  it('rejects a third entry rather than letting the picker creep towards the full manifest', () => {
    const three = [CURATED_CORE, trackingReversalPilotV1High, ALL_TRACKING_PILOT_CONFIGS[0]];
    expect(() => buildCuratedRegistry(three)).toThrow(/must hold 1-2 drills/);
  });

  it('rejects the same drill listed twice', () => {
    expect(() => buildCuratedRegistry([CURATED_CORE, CURATED_CORE])).toThrow(/lists .* twice/);
  });

  it('rejects a config that is not one of the nine WP-54 blocks', () => {
    expect(() => buildCuratedRegistry([OFF_CENSUS])).toThrow(/is not a WP-54 tracking-pilot block/);
  });

  it('rejects a block promoted out of practice mode', () => {
    const promoted: DrillConfig = { ...CURATED_CORE, mode: 'assessment' };
    expect(() => buildCuratedRegistry([promoted], [promoted])).toThrow(/must stay mode/);
  });

  it('rejects a block that does not declare the pilot hold weapon', () => {
    const rearmed: DrillConfig = { ...CURATED_CORE, weaponId: 'ak47' };
    expect(() => buildCuratedRegistry([rearmed], [rearmed])).toThrow(/must declare tracking_pilot_hold/);
  });

  it('rejects a block whose weapon declaration was dropped altogether', () => {
    const disarmed: DrillConfig = { ...CURATED_CORE };
    delete (disarmed as { weaponId?: string }).weaponId;
    expect(() => buildCuratedRegistry([disarmed], [disarmed])).toThrow(/must declare tracking_pilot_hold/);
  });
});
