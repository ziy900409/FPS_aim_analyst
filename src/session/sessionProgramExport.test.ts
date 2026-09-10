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
