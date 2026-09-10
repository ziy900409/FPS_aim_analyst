import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import { createDrillMetricRegistry } from '../history/DrillMetricRegistry.ts';
import {
  trackingCorePrPilotV1CalibrationHorizontal,
  trackingCorePrPilotV1CalibrationVertical,
  trackingCorePrPilotV1Practice,
  TRACKING_CORE_PR_PILOT_V1_CANDIDATES,
} from '../drill/tracking_core_pr_pilot_v1.ts';
import { TRACKING_REVERSAL_PILOT_V1_CANDIDATES } from '../drill/tracking_reversal_pilot_v1.ts';
import { FAMILY_BY_DRILL_ID } from '../session/drillFamily.ts';
import {
  ALL_TRACKING_PILOT_CONFIGS,
  TRACKING_PILOT_SCHEDULABLE_DRILLS,
} from '../session/trackingPilotSchedulableDrills.ts';

/**
 * README §4 T4 DoD: "practice/pilot run 被 history guard 排除". T0/README §0 already established
 * this as an existing fact rather than something T4 needs to build: `DrillMetricRegistry`'s
 * `REGISTRATIONS` only ever listed `spider-shot-v2`/`peek-click-transfer-v1` (WP-49 T4), no WP-54
 * tracking pilot drillId has ever been registered, and `project()` independently refuses any
 * `meta.assessment === undefined` payload (every WP-54 block is `mode: 'practice'`, T2 decision).
 * This test locks that fact down rather than adding a redundant guard mechanism on top of it.
 */

const ALL_TRACKING_PILOT_DRILL_IDS: readonly string[] = [
  trackingCorePrPilotV1Practice.drillId,
  trackingCorePrPilotV1CalibrationHorizontal.drillId,
  trackingCorePrPilotV1CalibrationVertical.drillId,
  ...TRACKING_CORE_PR_PILOT_V1_CANDIDATES.map((config) => config.drillId),
  ...TRACKING_REVERSAL_PILOT_V1_CANDIDATES.map((config) => config.drillId),
];

const baseMeta: Meta = {
  schemaVersion: 2,
  drillId: 'placeholder',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 54000,
  backend: 'webgl2',
  displayHz: 144,
  simHz: 128,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-09-02T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  // No meta.assessment — every WP-54 pilot block is mode:'practice' (T2 decision); main.ts only
  // attaches meta.assessment for mode:'assessment' drills.
};

describe('WP-54 tracking pilot drills are excluded from the formal history registry', () => {
  it('has at least the 9 T2 pilot blocks to check (sanity — catches an accidental empty list)', () => {
    expect(ALL_TRACKING_PILOT_DRILL_IDS.length).toBe(9);
    expect(new Set(ALL_TRACKING_PILOT_DRILL_IDS).size).toBe(9); // each drillId is unique
  });

  it('registrationForExactDrill() returns undefined for every tracking pilot drillId', () => {
    const registry = createDrillMetricRegistry();
    for (const drillId of ALL_TRACKING_PILOT_DRILL_IDS) {
      expect(registry.registrationForExactDrill(drillId)).toBeUndefined();
    }
  });

  /**
   * WP-64 T1 (FR-64.8) — WP-64 made two of these nine blocks reachable from a custom Session Plan.
   * The whole point of the exclusion above is that reachability and research status are orthogonal:
   * a block a researcher can now schedule is *still* practice, still unregistered, still absent
   * from trend cohorts. This is where "schedulable therefore assessment" would be caught.
   */
  it('keeps the two WP-64 curated blocks practice-mode and unregistered even though they are now schedulable', () => {
    const registry = createDrillMetricRegistry();
    expect(TRACKING_PILOT_SCHEDULABLE_DRILLS.length).toBeGreaterThan(0);
    for (const entry of TRACKING_PILOT_SCHEDULABLE_DRILLS) {
      const { drillId } = entry.config;
      // Independently maintained list above vs. the registry's own census — each checks the other.
      expect(ALL_TRACKING_PILOT_DRILL_IDS, drillId).toContain(drillId);
      expect(FAMILY_BY_DRILL_ID.get(drillId)).toBe('tracking'); // reachable...
      expect(entry.config.mode).toBe('practice'); // ...and still not an assessment
      expect(registry.registrationForExactDrill(drillId)).toBeUndefined();
      const payload: ExportPayload = { meta: { ...baseMeta, drillId }, ticks: [], events: [] };
      expect(payload.meta.assessment).toBeUndefined();
      expect(registry.project(payload)).toEqual({ status: 'unregistered-drill', drillId });
    }
  });

  it('agrees with the scheduling registry about which nine blocks exist', () => {
    expect(ALL_TRACKING_PILOT_CONFIGS.map((config) => config.drillId)).toEqual(ALL_TRACKING_PILOT_DRILL_IDS);
  });

  it('project() reports unregistered-drill (never ready) for a tracking pilot export', () => {
    const registry = createDrillMetricRegistry();
    for (const drillId of ALL_TRACKING_PILOT_DRILL_IDS) {
      const payload: ExportPayload = { meta: { ...baseMeta, drillId }, ticks: [], events: [] };
      const result = registry.project(payload);
      expect(result).toEqual({ status: 'unregistered-drill', drillId });
    }
  });
});
