import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectMeta, type CollectMetaArgs } from '../data/metadata.ts';
import type { ExportPayload } from '../data/export.ts';
import { exportBasename } from '../results/ResultPresentation.ts';
import { buildFrozenSessionPlan } from './SessionRunner.ts';
import {
  compileSessionProgram,
  deriveProgramFamilyOrder,
  type RunStep,
  type SessionProgramItem,
} from './sessionProgram.ts';
import { DECLARED_WEAPON_BY_DRILL_ID } from './drillFamily.ts';
import {
  TRACKING_PILOT_RUNTIME_DRILLS,
  TRACKING_PILOT_SCHEDULABLE_DRILLS,
} from './trackingPilotSchedulableDrills.ts';
import { canonicalExportJSON, parseExportPayload } from '../data/exportPayloadSchema.ts';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { DEFAULT_RNG_SEED } from '../loop/SimLoop.ts';
import { fieldLow } from '../scene/scenes/field-low.ts';
import { resolveActiveWeapon } from '../weapon/weapons.ts';

/**
 * WP-58 T5 (FR-58.14~58.16) — the export side of the program contract: every rep produces its own
 * uniquely named payload, and every payload can say which rep of which item it is.
 *
 * The three moving parts are exercised against each other rather than in isolation: the compiler
 * produces the run steps, `collectMeta` records the coordinates, and `exportBasename` names the
 * file. A drift between any two of them shows up here.
 */

const CUSTOM_ITEMS = [
  { drillId: 'hold_click_v1', reps: 3 },
  { drillId: 'spider-shot-v2', reps: 2 },
] as const;

const PROGRAM = compileSessionProgram({ items: CUSTOM_ITEMS, drillRestSeconds: 30, familyRestSeconds: 60 });
const RUN_STEPS: readonly RunStep[] = PROGRAM.filter((step): step is RunStep => step.kind === 'run');

/** What `main.ts` writes for a custom run, minus the parts that are not about the program. */
function metaForRun(step: RunStep, startedAt: string): CollectMetaArgs {
  return {
    drillId: step.drillId,
    backend: 'webgpu',
    displayHz: 144,
    sensitivity: 1,
    crossOriginIsolated: true,
    startedAt,
    sessionPlanMode: 'custom',
    sessionPlanItems: CUSTOM_ITEMS,
    sessionPlanDrillRestSeconds: 30,
    sessionPlanRestSeconds: 60,
    sessionPlanFamilyOrder: deriveProgramFamilyOrder(PROGRAM),
    sessionPlanItemIndex: step.itemIndex,
    sessionPlanRepIndex: step.repIndex,
  };
}

function payloadFor(step: RunStep, startedAt: string): ExportPayload {
  return { meta: collectMeta(metaForRun(step, startedAt)), ticks: [], events: [] };
}

describe('deriveProgramFamilyOrder', () => {
  it('collapses consecutive repeats of one family', () => {
    // Two items, one family, five runs — the family order is a single entry, not five.
    const program = compileSessionProgram({
      items: [
        { drillId: 'spider-shot-v2', reps: 3 },
        { drillId: 'spider-shot-v3', reps: 2 },
      ],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(deriveProgramFamilyOrder(program)).toEqual(['spider-shot']);
  });

  it('keeps a family that is revisited after another one (A-B-A)', () => {
    const program = compileSessionProgram({
      items: [
        { drillId: 'hold_click_v1', reps: 1 },
        { drillId: 'spider-shot-v2', reps: 1 },
        { drillId: 'hold_click_v1', reps: 1 },
      ],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(deriveProgramFamilyOrder(program)).toEqual(['hold-click', 'spider-shot', 'hold-click']);
  });

  it('reproduces the frozen family order the operator selected', () => {
    const frozen = buildFrozenSessionPlan({
      participantId: 'P-001',
      sessionIndex: 0,
      families: ['hold-click', 'counterstrafe', 'spider-shot'],
      restSeconds: 60,
      includeWarmup: false,
    });
    expect(deriveProgramFamilyOrder(frozen.plan.program)).toEqual(['hold-click', 'counterstrafe', 'spider-shot']);
  });

  it('is validated by the metadata writer without a second allowlist', () => {
    // The derived order feeds `sessionPlanFamilyOrder`, whose validator is the KI-016 single source.
    const order = deriveProgramFamilyOrder(PROGRAM);
    expect(collectMeta(metaForRun(RUN_STEPS[0], '2026-09-08T10:00:00.000Z')).sessionPlanFamilyOrder).toEqual(order);
  });
});

describe('per-rep export identity (FR-58.15 / OQ-58.2)', () => {
  it('gives every rep of the program its own filename', () => {
    // Each rep is a fresh `activateDrill()`, so `startedAt` is re-stamped per rep — that is the
    // whole uniqueness mechanism, and OQ-58.2 decided not to add a rep suffix on top of it.
    const basenames = RUN_STEPS.map((step, index) =>
      exportBasename(payloadFor(step, `2026-09-08T10:0${index}:00.000Z`)),
    );
    expect(basenames).toHaveLength(5);
    expect(new Set(basenames).size).toBe(5);
    // Three reps of one drill produce three files, differing only in the timestamp.
    expect(basenames.filter((name) => name.startsWith('hold_click_v1-'))).toHaveLength(3);
  });

  it('locates each export at its own step of the program', () => {
    RUN_STEPS.forEach((step, index) => {
      const { meta } = payloadFor(step, `2026-09-08T10:0${index}:00.000Z`);
      expect(meta.sessionPlanItemIndex).toBe(step.itemIndex);
      expect(meta.sessionPlanRepIndex).toBe(step.repIndex);
      // The coordinates resolve inside the recorded program, and resolve to this run's drill.
      const item = meta.sessionPlanItems?.[meta.sessionPlanItemIndex ?? -1];
      expect(item?.drillId).toBe(meta.drillId);
      expect(meta.sessionPlanRepIndex).toBeLessThan(item?.reps ?? 0);
    });
    expect(RUN_STEPS.map((step) => [step.itemIndex, step.repIndex])).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ]);
  });

  it('names two reps identically only if they somehow started in the same millisecond', () => {
    // The known (and accepted) boundary of the timestamp scheme, pinned so nobody later "optimises"
    // `startedAt` into something coarser without noticing what it costs.
    const first = exportBasename(payloadFor(RUN_STEPS[0], '2026-09-08T10:00:00.000Z'));
    const second = exportBasename(payloadFor(RUN_STEPS[1], '2026-09-08T10:00:00.000Z'));
    expect(second).toBe(first);
  });
});


// ---------------------------------------------------------------------------
// WP-62 T5 (FR-62.4) — intent vs fact
// ---------------------------------------------------------------------------

/**
 * `meta.sessionPlanItems[].weaponId` is what the operator *planned*; `meta.weaponId` is what the run
 * actually loaded. They are written by two different code paths and can legitimately differ (an
 * unplanned row still loads a weapon), so the reconciliation rule is asserted here rather than
 * assumed. The fact side reads the same precedence function `main.ts` runs — restating the rule in
 * this file would only test the restatement (C-D4).
 */
const WEAPON_ITEMS: readonly SessionProgramItem[] = [
  // A plain drill with an explicit per-item weapon: intent is recorded, and it wins.
  { drillId: 'hold_click_v1', reps: 2, weaponId: 'm4a1s' },
  // A plain drill left on the default: no intent recorded, the app default is the fact.
  { drillId: 'spider-shot-v2', reps: 1 },
  // A BR experiment cell asked for exactly the weapon it already declares (legal — D-62-1 only
  // rejects a *different* one). Intent and fact coincide, and must both still be present.
  { drillId: 'tracking_br_v1__ads_off__hitscan__2deg', reps: 1, weaponId: 'ak47_br_hip_hitscan' },
  // A BR cell with no per-item weapon: the drill's own declaration is the fact, and there is no
  // intent to record — the row where "just copy meta.weaponId into the plan" would start lying.
  { drillId: 'tracking_br_v1__ads_on__projectile__2deg', reps: 1 },
];

const WEAPON_PROGRAM = compileSessionProgram({
  items: WEAPON_ITEMS,
  drillRestSeconds: 30,
  familyRestSeconds: 60,
});
const WEAPON_RUN_STEPS: readonly RunStep[] = WEAPON_PROGRAM.filter((step): step is RunStep => step.kind === 'run');

/** The fact half: exactly what `main.ts` resolves before it builds the sim loop for that step. */
function actualWeaponIdFor(step: RunStep): string {
  return resolveActiveWeapon(step.weaponId, DECLARED_WEAPON_BY_DRILL_ID.get(step.drillId)).id;
}

function weaponMetaForRun(step: RunStep): CollectMetaArgs {
  return {
    drillId: step.drillId,
    backend: 'webgpu',
    displayHz: 144,
    sensitivity: 1,
    crossOriginIsolated: true,
    startedAt: '2026-09-10T10:00:00.000Z',
    weaponId: actualWeaponIdFor(step),
    sessionPlanMode: 'custom',
    sessionPlanItems: WEAPON_ITEMS,
    sessionPlanDrillRestSeconds: 30,
    sessionPlanRestSeconds: 60,
    sessionPlanFamilyOrder: deriveProgramFamilyOrder(WEAPON_PROGRAM),
    sessionPlanItemIndex: step.itemIndex,
    sessionPlanRepIndex: step.repIndex,
  };
}

describe('planned weapon vs loaded weapon (FR-62.4)', () => {
  it('records the operator intent on exactly the rows that named a weapon', () => {
    const meta = collectMeta(weaponMetaForRun(WEAPON_RUN_STEPS[0]));
    expect(meta.sessionPlanItems).toEqual([
      { drillId: 'hold_click_v1', reps: 2, weaponId: 'm4a1s' },
      { drillId: 'spider-shot-v2', reps: 1 },
      { drillId: 'tracking_br_v1__ads_off__hitscan__2deg', reps: 1, weaponId: 'ak47_br_hip_hitscan' },
      { drillId: 'tracking_br_v1__ads_on__projectile__2deg', reps: 1 },
    ]);
  });

  it('makes the planned weapon match the loaded one on every planned row, every rep', () => {
    const planned = WEAPON_RUN_STEPS.filter((step) => WEAPON_ITEMS[step.itemIndex].weaponId !== undefined);
    // Two rows are planned, and one of them runs twice — the reps must not drift apart (FR-62.3).
    expect(planned).toHaveLength(3);
    for (const step of planned) {
      const meta = collectMeta(weaponMetaForRun(step));
      const intent = meta.sessionPlanItems?.[meta.sessionPlanItemIndex ?? -1].weaponId;
      expect(intent).toBe(WEAPON_ITEMS[step.itemIndex].weaponId);
      expect(meta.weaponId).toBe(intent);
    }
  });

  it('leaves the intent absent on unplanned rows while still recording which weapon ran', () => {
    const unplanned = WEAPON_RUN_STEPS.filter((step) => WEAPON_ITEMS[step.itemIndex].weaponId === undefined);
    expect(unplanned).toHaveLength(2);
    const facts = unplanned.map((step) => {
      const meta = collectMeta(weaponMetaForRun(step));
      const item = meta.sessionPlanItems?.[meta.sessionPlanItemIndex ?? -1] ?? {};
      expect('weaponId' in item).toBe(false);
      return meta.weaponId;
    });
    // The app default for the plain drill, the drill's own declaration for the BR cell — never
    // blank, so "no intent recorded" can never be read back as "no weapon ran".
    expect(facts).toEqual(['ak47', 'ak47_br_ads_projectile']);
  });

  it('records intent and fact separately even when they agree (the BR cell)', () => {
    // The row most tempting to "optimise" down to one field: the two carry the same value here, but
    // they answer different questions, and only one of them survives a drill roster change.
    const step = WEAPON_RUN_STEPS.find((run) => run.drillId === 'tracking_br_v1__ads_off__hitscan__2deg');
    if (step === undefined) throw new Error('expected the BR cell to be scheduled');
    const meta = collectMeta(weaponMetaForRun(step));
    expect(meta.weaponId).toBe('ak47_br_hip_hitscan');
    expect(meta.sessionPlanItems?.[step.itemIndex].weaponId).toBe('ak47_br_hip_hitscan');
  });

  it('is written from the very object the compiler validated (main.ts wiring)', () => {
    // `sessionPlanAuditFields()` hands `collectMeta` the submitted items verbatim, which is the only
    // reason `weaponId` reaches the payload without a second mapping step. Asserted by reading the
    // source because `main.ts` is a WebGPU/DOM top-level script Vitest cannot execute (same device
    // as the T3 activation-order scan).
    const source = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
    expect(source).toContain('sessionPlanItems: activeSessionPlanSelection.items');
    // The frozen branch must keep writing neither the items nor a mode (D-62-2 / FR-58.10).
    const frozenBranchStart = source.indexOf("if (activeSessionPlanSelection.mode === 'frozen') {");
    const customBranchStart = source.indexOf("    sessionPlanMode: 'custom',", frozenBranchStart);
    expect(frozenBranchStart).toBeGreaterThan(-1);
    expect(customBranchStart).toBeGreaterThan(frozenBranchStart);
    const frozenBranch = source.slice(frozenBranchStart, customBranchStart);
    expect(frozenBranch).not.toContain('sessionPlanItems');
    expect(frozenBranch).not.toContain('weapon');
  });

  it('leaves the frozen track free of any weapon field (FR-62.6)', () => {
    const frozen = buildFrozenSessionPlan({
      participantId: 'P-001',
      sessionIndex: 0,
      families: ['hold-click', 'counterstrafe', 'spider-shot'],
      restSeconds: 60,
      includeWarmup: true,
    });
    // No compiled frozen step carries one, so nothing downstream can put one in the payload.
    for (const step of frozen.plan.program) {
      if (step.kind === 'run') expect('weaponId' in step).toBe(false);
    }
    // And the frozen export keeps exactly the two stage8 keys it has always written.
    const meta = collectMeta({
      drillId: 'hold_click_v1',
      backend: 'webgpu',
      displayHz: 144,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-09-10T10:00:00.000Z',
      sessionPlanRestSeconds: 60,
      sessionPlanFamilyOrder: ['hold-click', 'counterstrafe', 'spider-shot'],
    });
    expect(Object.keys(meta).filter((key) => key.startsWith('sessionPlan')).sort()).toEqual([
      'sessionPlanFamilyOrder',
      'sessionPlanRestSeconds',
    ]);
  });
});


// ---------------------------------------------------------------------------
// WP-64 T2 (FR-64.6/FR-64.7/NFR-64.5) — an ad hoc Session Plan run of a curated pilot block
// ---------------------------------------------------------------------------

/**
 * The audit claim WP-64 rests on: a Session Plan run of a curated tracking-pilot block is
 * reconstructable from its own payload — which drill, which seed, which weapon, which scene, and
 * which item/rep of which program — **without** any new metadata field, and without borrowing a
 * single word of `tracking-pilot-v2` manifest vocabulary (FM-64.1/FM-64.8).
 *
 * Everything below is read from the curated registry, so a config change shows up here as a diff
 * rather than as a stale hand-typed expectation.
 */
const PILOT_ITEMS: readonly SessionProgramItem[] = TRACKING_PILOT_SCHEDULABLE_DRILLS.map(
  (entry, index) => ({ drillId: entry.config.drillId, reps: index === 0 ? 2 : 1 }),
);

const PILOT_PROGRAM = compileSessionProgram({
  items: PILOT_ITEMS,
  drillRestSeconds: 30,
  familyRestSeconds: 60,
});
const PILOT_RUN_STEPS: readonly RunStep[] = PILOT_PROGRAM.filter(
  (step): step is RunStep => step.kind === 'run',
);

function curatedConfigFor(drillId: string): DrillConfig {
  const entry = TRACKING_PILOT_SCHEDULABLE_DRILLS.find((candidate) => candidate.config.drillId === drillId);
  if (entry === undefined) throw new Error(`${drillId} is not a curated tracking-pilot block`);
  return entry.config;
}

/**
 * The block's stimulus seed. It lives in `targets.trackingTrajectory.seed`, **not** in
 * `sequence.seed` — which is why `meta.rngSeed` (the spawn stream) is not the field an analyst
 * reconciles a tracking-pilot run against.
 */
function trajectorySeedOf(config: DrillConfig): number {
  const seed = config.targets.trackingTrajectory?.seed;
  if (seed === undefined) throw new Error(`${config.drillId} declares no trajectory seed`);
  return seed;
}

function pilotSceneIdFor(drillId: string): string {
  const entry = TRACKING_PILOT_RUNTIME_DRILLS.find((candidate) => candidate.id === drillId);
  if (entry?.sceneId === undefined) throw new Error(`${drillId} has no pinned runtime scene`);
  return entry.sceneId;
}

/** What `main.ts` writes for one rep of a curated block, built from the same expressions it uses. */
function pilotMetaForRun(step: RunStep): CollectMetaArgs {
  const config = curatedConfigFor(step.drillId);
  return {
    drillId: step.drillId,
    backend: 'webgpu',
    displayHz: 144,
    sensitivity: 1,
    crossOriginIsolated: true,
    startedAt: '2026-09-11T10:00:00.000Z',
    weaponId: actualWeaponIdFor(step),
    // Both read exactly as `main.ts` writes them. A tracking-pilot block has neither a `spiderShot`
    // nor a `sequence.seed`, so this is `DEFAULT_RNG_SEED` — see the spawn block below for where
    // the block's *stimulus* seed actually lives.
    rngSeed: config.spiderShot?.seed ?? config.sequence.seed ?? DEFAULT_RNG_SEED,
    spawn: {
      seed: config.spiderShot?.seed ?? config.sequence.seed ?? DEFAULT_RNG_SEED,
      ...(config.targets.trackingTrajectory !== undefined
        ? { trackingTrajectory: config.targets.trackingTrajectory }
        : {}),
    },
    scene: {
      sceneId: pilotSceneIdFor(step.drillId),
      assetPackVersion: fieldLow.assetPackVersion,
      clutterTier: fieldLow.clutterTier,
      fallback: false,
    },
    sessionPlanMode: 'custom',
    sessionPlanItems: PILOT_ITEMS,
    sessionPlanDrillRestSeconds: 30,
    sessionPlanRestSeconds: 60,
    sessionPlanFamilyOrder: deriveProgramFamilyOrder(PILOT_PROGRAM),
    sessionPlanItemIndex: step.itemIndex,
    sessionPlanRepIndex: step.repIndex,
  };
}

describe('ad hoc pilot run — the payload accounts for itself (FR-64.6/NFR-64.5)', () => {
  it('lands both curated blocks in one tracking-family program', () => {
    // One family, so the only seams are rep and drill — the shape the UI preview test asserts from
    // the other side.
    expect(deriveProgramFamilyOrder(PILOT_PROGRAM)).toEqual(['tracking']);
    expect(PILOT_RUN_STEPS.map((step) => [step.itemIndex, step.repIndex])).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
    ]);
  });

  it('resolves every export back to the drill, seed, weapon and scene the config declares', () => {
    for (const step of PILOT_RUN_STEPS) {
      const meta = collectMeta(pilotMetaForRun(step));
      const config = curatedConfigFor(meta.drillId);
      // Coordinates -> item -> the same drill this payload is about (FR-64.6).
      const item = meta.sessionPlanItems?.[meta.sessionPlanItemIndex ?? -1];
      expect(item?.drillId).toBe(meta.drillId);
      expect(meta.sessionPlanRepIndex).toBeLessThan(item?.reps ?? 0);
      expect(meta.sessionPlanMode).toBe('custom');
      // Facts -> the canonical WP-54 config, with no alternate-seed offset anywhere (OQ-64.4).
      // The stimulus seed of a tracking block is the trajectory's, carried out verbatim inside
      // `meta.spawn.trackingTrajectory`; `meta.rngSeed` is the spawn stream and stays at the app
      // default for these blocks, exactly as it does on the formal pilot path.
      expect(meta.spawn?.trackingTrajectory).toEqual(config.targets.trackingTrajectory);
      expect((meta.spawn?.trackingTrajectory as { seed: number }).seed).toBe(trajectorySeedOf(config));
      expect(meta.rngSeed).toBe(DEFAULT_RNG_SEED);
      expect(meta.weaponId).toBe('tracking_pilot_hold');
      expect(config.weaponId).toBe('tracking_pilot_hold');
      expect(meta.scene?.sceneId).toBe('field-low');
    }
  });

  it('replays one seed across the reps of an item, so reps read as repeated exposure (FM-64.7)', () => {
    const reps = PILOT_RUN_STEPS.filter((step) => step.itemIndex === 0);
    expect(reps).toHaveLength(2);
    const seeds = new Set(
      reps.map((step) => (collectMeta(pilotMetaForRun(step)).spawn?.trackingTrajectory as { seed: number }).seed),
    );
    // One seed, two payloads: they differ only in `sessionPlanRepIndex`, which is exactly what
    // stops an analyst from pooling them as independent samples.
    expect(seeds.size).toBe(1);
    expect(new Set(reps.map((step) => step.repIndex))).toEqual(new Set([0, 1]));
  });

  it('round-trips through the shape-only reader without teaching it the roster', () => {
    const payload: ExportPayload = {
      meta: collectMeta(pilotMetaForRun(PILOT_RUN_STEPS[0])),
      ticks: [],
      events: [],
    };
    const parsed = parseExportPayload(JSON.parse(canonicalExportJSON(payload)));
    if (!parsed.ok) throw new Error(`ad hoc pilot payload failed to parse: ${JSON.stringify(parsed.errors)}`);
    expect(parsed.payload.meta.drillId).toBe(PILOT_RUN_STEPS[0].drillId);
    expect(parsed.payload.meta.sessionPlanItems).toEqual(PILOT_ITEMS);
    expect(parsed.payload.meta.spawn?.trackingTrajectory).toEqual(payload.meta.spawn?.trackingTrajectory);
    expect(parsed.payload.meta.scene?.sceneId).toBe('field-low');
    // The reader validates shape, never membership: a drill id it has never heard of parses fine.
    // That is why registering a pilot block needed no parser change (Failure handling, T2).
    const readerSource = readFileSync(new URL('../data/exportPayloadSchema.ts', import.meta.url), 'utf8');
    for (const drillId of PILOT_ITEMS.map((item) => item.drillId)) {
      expect(readerSource, `${drillId} must not be named by the payload reader`).not.toContain(drillId);
    }
  });
});

describe('ad hoc pilot run — what it must NOT claim (FR-64.7/FM-64.1)', () => {
  it('carries no assessment block, so it cannot be read as formal evidence', () => {
    for (const step of PILOT_RUN_STEPS) {
      const meta = collectMeta(pilotMetaForRun(step));
      expect(meta.assessment).toBeUndefined();
      // ...and the block it runs is still practice, which is what keeps it out of trend cohorts.
      expect(curatedConfigFor(step.drillId).mode).toBe('practice');
    }
  });

  it('writes exactly the custom-plan audit keys, and nothing manifest-shaped', () => {
    const meta = collectMeta(pilotMetaForRun(PILOT_RUN_STEPS[0]));
    expect(Object.keys(meta).filter((key) => key.startsWith('sessionPlan')).sort()).toEqual([
      'sessionPlanDrillRestSeconds',
      'sessionPlanFamilyOrder',
      'sessionPlanItemIndex',
      'sessionPlanItems',
      'sessionPlanMode',
      'sessionPlanRepIndex',
      'sessionPlanRestSeconds',
    ]);
    // No counterbalance cell, no session label, no pilot role: `meta.session` is the participant
    // block, written by the session setup form and by nothing pilot-specific.
    expect(meta.session).toBeUndefined();
  });

  it('never reaches for the manifest, the pilot runner or an eligibility verdict (FM-64.8)', () => {
    // `startSessionPlan()` is the whole ad hoc entry point. If the manifest ever leaked into it,
    // alternate seeds and eligibility verdicts would follow — asserted by reading the source for
    // the same reason as the WP-62 T3 activation-order scan (`main.ts` is not importable here).
    const source = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
    const start = source.indexOf('async function startSessionPlan()');
    expect(start, 'main.ts should still declare startSessionPlan()').toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('\n}', start));
    for (const forbidden of [
      'resolveTrackingPilotBlockConfig',
      'buildTrackingPilotManifest',
      'TrackingPilotRunner',
      'trackingPilotSession',
      'alternateSeed',
      'runEligibilityGate',
      'assessment',
    ]) {
      expect(body, `startSessionPlan() must not mention ${forbidden}`).not.toContain(forbidden);
    }
    // And the audit block it feeds `collectMeta` is the custom-plan one, unchanged by WP-64.
    const auditStart = source.indexOf('function sessionPlanAuditFields(');
    expect(auditStart).toBeGreaterThan(-1);
    const auditBody = source.slice(auditStart, source.indexOf('\n}', auditStart));
    expect(auditBody).not.toContain('Pilot');
    expect(auditBody).not.toContain('eligib');
  });
});
