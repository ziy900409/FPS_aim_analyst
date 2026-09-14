import { describe, expect, it } from 'vitest';
import { canonicalExportJSON, parseExportPayload } from '../data/exportPayloadSchema.ts';
import type { ExportPayload } from '../data/export.ts';
import { collectMeta } from '../data/metadata.ts';
import type { Clock } from '../loop/clock.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { createSimLoop } from '../loop/SimLoop.ts';
import { createRecoilState, recoilOnFire } from '../recoil/punch.ts';
import { generateRecoilTable } from '../recoil/recoilTable.ts';
import type { Rng } from '../recoil/rng.ts';
import { sampleSpread } from '../recoil/spread.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import type { SharedState } from '../state/SharedState.ts';
import { createSharedState } from '../state/SharedState.ts';
import type { WeaponConfig } from '../weapon/WeaponConfig.ts';
import { resolveActiveWeapon, WEAPONS } from '../weapon/weapons.ts';
import { microFlickThreeTargetTestV8 } from './micro_flick_three_target_test_v8.ts';

/**
 * WP-63 / T1 — evidence for NFR-63.7 and for the claim that declaring `weaponId` on v8 breaks the
 * data generation *only* at the weapon.
 *
 * The fixture change is a single key, but it swaps the weapon the entire run executes with. The
 * three things that could have made that swap unsafe are pinned here mechanically:
 *
 *  1. the seeded spawn stream is untouched — same seed and same kill order give bit-identical
 *     placements under either weapon;
 *  2. `sampleSpread()` early-returns for this weapon ([spread.ts] `inaccuracy === 0`), so its own
 *     seeded stream is not advanced by a single draw;
 *  3. the recoil table is bit-zero, so `aimPunch` never moves and `ticks[].aim` is the real view.
 *
 * ⚠️ Corrected in WP-68 T-exit (OQ-68.5), comment only — no assertion changed. This header used to
 * say (2) was *why* (1) survives live fire. It is not: spread and spawn draw from two **separate**
 * `createRan1` instances (`SimLoop.ts:855` builds `recoilRuntime.rng`, `TargetManager.ts:315`
 * builds its own `spawnRng`, and the loop never hands its rng to the manager), and `createRan1`
 * returns a closure owning its `idum`/`iy`/`iv` (`rng.ts:13-22`), so two instances on one seed are
 * still two states. (1) and (2) are **independent** claims. What each actually buys:
 *   (1) a guard against some *other* weapon property coupling into spawn — the magazine shrinks
 *       30 -> 12 here and `spawn()` refills it (`TargetManager.ts:585`), so ammo and placement do
 *       meet;
 *   (2) a tripwire for the day someone retunes `usp_s_laser` to a non-zero inaccuracy.
 * See `micro_flick_three_target_test_v9_weapon.test.ts` for the same reasoning stated correctly
 * from the start.
 */

const V8_CONFIG = microFlickThreeTargetTestV8.drill;
const V8_SEED = V8_CONFIG.sequence.seed;
/** What `main.ts`'s `activeWeaponConfig()` resolves for v8 before and after this task. */
const PRE_T1_WEAPON = resolveActiveWeapon(undefined, undefined);
const POST_T1_WEAPON = resolveActiveWeapon(undefined, V8_CONFIG.weaponId);

const TRACE_SNAPSHOTS = 96;

interface V8Trace {
  readonly trace: readonly (readonly TracedTarget[])[];
  readonly shotsFired: number;
}

interface TracedTarget {
  readonly id: string;
  readonly side: 'L' | 'R';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly visible: boolean;
  readonly alive: boolean;
}

function fixedClock(nowMs: number): Clock {
  return { now: () => nowMs };
}

function snapshot(state: SharedState): readonly TracedTarget[] {
  return state.targets.map((target) => ({
    id: target.id,
    side: target.side,
    x: target.pos.x,
    y: target.pos.y,
    z: target.pos.z,
    visible: target.visible,
    alive: target.alive,
  }));
}

/**
 * One v8 spawn trace. The kill order is scripted off `tickIndex` rather than off shots landing, so
 * it is identical for both weapons by construction — which is the point: the only variable left
 * between two runs is the weapon. Fire input is fed anyway, so each weapon's recoil and spread path
 * really does execute while the trace is being taken.
 */
function v8SpawnTrace(weapon: WeaponConfig): V8Trace {
  const state = createSharedState();
  const manager = createTargetManager(V8_CONFIG);
  const trace: (readonly TracedTarget[])[] = [];
  let shotsFired = 0;
  let previousAmmo = weapon.magSize;
  const loop = createSimLoop(
    state,
    fixedClock(0),
    SIM_HZ,
    manager,
    undefined,
    undefined,
    undefined,
    weapon,
    V8_SEED,
    {
      translation: 'locked',
      afterTick(current, _tickEndMs, tickIndex): void {
        if (tickIndex % 3 === 0 && current.targets.length > 0) {
          manager.markKilled(current, current.targets[tickIndex % current.targets.length].id);
        }
        // `spawn()` refills the magazine (D-63-P4), so ammo is not monotonic across the run; only
        // the downward steps are shots.
        if (current.weapon.ammo < previousAmmo) shotsFired += previousAmmo - current.weapon.ammo;
        previousAmmo = current.weapon.ammo;
        if (trace.length < TRACE_SNAPSHOTS) trace.push(snapshot(current));
      },
    },
  );

  let frameNowMs = 0;
  let fireT = 0;
  while (trace.length < TRACE_SNAPSHOTS) {
    // Press/release spaced well above either weapon's cycletime, so both actually fire.
    state.input.pushFire(true, fireT);
    state.input.pushFire(false, fireT + 1);
    fireT += 200;
    frameNowMs += 1000 / 144;
    loop.pump(frameNowMs);
  }
  return { trace, shotsFired };
}

/** An rng that records how often it was drawn from. Its value is unused whenever spread is zero. */
function countingRng(): { readonly rng: Rng; readonly calls: () => number } {
  let calls = 0;
  return {
    rng: (): number => {
      calls += 1;
      return 0.5;
    },
    calls: () => calls,
  };
}

describe('WP-63 T1 — micro flick v8 runs a zero-spread, zero-recoil weapon', () => {
  it('resolves usp_s_laser through the same precedence rule main.ts uses', () => {
    expect(POST_T1_WEAPON).toBe(WEAPONS.usp_s_laser);
    // The pre-T1 fact this task exists to change: with no key, v8 silently ran the app default.
    expect(PRE_T1_WEAPON).toBe(WEAPONS.ak47);
    expect(POST_T1_WEAPON).not.toBe(PRE_T1_WEAPON);
    // Accounted side effect (D-63-P3): the cadence floor rises from 100 ms to 170 ms, which is
    // exactly why T5 has to split `correctionMs` into `settlingMs` + `cadenceWaitMs`.
    expect(POST_T1_WEAPON.cycletimeSec).toBe(0.17);
    expect(PRE_T1_WEAPON.cycletimeSec).toBe(0.1);
  });

  it('swapping the weapon does not perturb the seeded spawn stream, even under live fire', () => {
    const { trace: before, shotsFired: shotsBefore } = v8SpawnTrace(PRE_T1_WEAPON);
    const { trace: after, shotsFired: shotsAfter } = v8SpawnTrace(POST_T1_WEAPON);

    // Without shots the comparison would prove nothing about the spread stream: `ak47` must
    // actually have drawn from it during the traced window for its absence under v8's weapon to
    // be the thing being demonstrated.
    expect(shotsBefore).toBeGreaterThan(0);
    expect(shotsAfter).toBe(shotsBefore);

    expect(before.length).toBe(TRACE_SNAPSHOTS);
    expect(after.length).toBe(before.length);
    // Object.is per field rather than toEqual, so a -0 or a one-ulp drift cannot slip through.
    for (let index = 0; index < before.length; index += 1) {
      expect(after[index].length).toBe(before[index].length);
      for (let slot = 0; slot < before[index].length; slot += 1) {
        const expected = before[index][slot];
        const actual = after[index][slot];
        for (const key of Object.keys(expected) as (keyof TracedTarget)[]) {
          expect(
            Object.is(actual[key], expected[key]),
            `snapshot ${index} slot ${slot} field ${key}: ${String(actual[key])} !== ${String(expected[key])}`,
          ).toBe(true);
        }
      }
    }
    // The trace has to be non-trivial for the comparison above to mean anything: replacements must
    // actually have been drawn from the spawn stream during the traced window.
    const distinctIds = new Set(before.flatMap((frame) => frame.map((target) => target.id)));
    expect(distinctIds.size).toBeGreaterThan(V8_CONFIG.targets.population.activeCount);
  });

  it('never draws from the shared seeded stream, because sampleSpread early-returns', () => {
    const recoilState = createRecoilState();
    const table = generateRecoilTable(POST_T1_WEAPON.recoil);
    const counter = countingRng();

    // v8 is `translation: 'locked'` so speedRatio is always 0; 0.5 and 1 are included anyway to
    // show the early return does not depend on standing still.
    for (const speedRatio of [0, 0.5, 1]) {
      expect(sampleSpread(recoilState, POST_T1_WEAPON, speedRatio, counter.rng)).toEqual({ x: 0, y: 0 });
    }
    // And it stays zero through a full magazine, when `inaccuracyFire` would normally accumulate.
    for (let shot = 0; shot < POST_T1_WEAPON.magSize; shot += 1) {
      recoilOnFire(recoilState, POST_T1_WEAPON, table);
      expect(sampleSpread(recoilState, POST_T1_WEAPON, 0, counter.rng)).toEqual({ x: 0, y: 0 });
    }
    expect(recoilState.inaccuracyFire).toBe(0);
    expect(counter.calls()).toBe(0);

    // Control: the weapon v8 used to run does draw. The zero above is therefore a property of the
    // weapon, not of this harness.
    const control = countingRng();
    sampleSpread(createRecoilState(), PRE_T1_WEAPON, 0, control.rng);
    expect(control.calls()).toBeGreaterThan(0);
  });

  it('generates a bit-zero recoil table, so aim punch never moves the recorded view', () => {
    const table = generateRecoilTable(POST_T1_WEAPON.recoil);
    expect(table.length).toBeGreaterThan(0);
    for (const entry of table) {
      expect(Object.is(entry.angleDeg, 0)).toBe(true);
      expect(Object.is(entry.magnitude, 0)).toBe(true);
    }

    const recoilState = createRecoilState();
    for (let shot = 0; shot < POST_T1_WEAPON.magSize; shot += 1) {
      recoilOnFire(recoilState, POST_T1_WEAPON, table);
    }
    expect(recoilState.aimPunchPitchDeg).toBe(0);
    expect(recoilState.aimPunchYawDeg).toBe(0);
    expect(recoilState.viewPunchPitchDeg).toBe(0);
    expect(recoilState.viewPunchYawDeg).toBe(0);
  });

  it('stamps the generation break into meta.weaponId, through the shape-only reader', () => {
    const payload: ExportPayload = {
      meta: collectMeta({
        drillId: V8_CONFIG.drillId,
        weaponId: POST_T1_WEAPON.id,
        weaponSeed: POST_T1_WEAPON.recoil.seed,
        rngSeed: V8_SEED,
        backend: 'webgpu',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-09-14T00:00:00.000Z',
      }),
      ticks: [],
      events: [],
    };

    const parsed = parseExportPayload(JSON.parse(canonicalExportJSON(payload)));
    if (!parsed.ok) throw new Error(`v8 payload failed to parse: ${JSON.stringify(parsed.errors)}`);
    expect(parsed.payload.meta.drillId).toBe('micro_flick_three_target_test_v8');
    // This field is what makes pre-T1 and post-T1 v8 exports mechanically separable. They are not
    // comparable data: the randomness of the hit decision itself changed.
    expect(parsed.payload.meta.weaponId).toBe('usp_s_laser');
    expect(parsed.payload.meta.weaponId).not.toBe('ak47');
  });

  it('starts every magazine at the declared size, which FR-63.13 reads back off fire.ammo', () => {
    // FR-63.13's offline predicate is "a `fire` event inside the window carrying `ammo === 0`".
    // That is only decidable if the magazine the run starts from is the one this weapon declares.
    const state = createSharedState();
    const manager = createTargetManager(V8_CONFIG);
    createSimLoop(
      state,
      fixedClock(0),
      SIM_HZ,
      manager,
      undefined,
      undefined,
      undefined,
      POST_T1_WEAPON,
      V8_SEED,
      { translation: 'locked' },
    );
    expect(state.weapon.magSize).toBe(POST_T1_WEAPON.magSize);
    expect(state.weapon.ammo).toBe(POST_T1_WEAPON.magSize);
    expect(POST_T1_WEAPON.magSize).toBe(12);
  });
});
