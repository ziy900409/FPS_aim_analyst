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
import { microFlickThreeTargetTestV9 } from './micro_flick_three_target_test_v9.ts';

/**
 * WP-68 / T1 — evidence for NFR-68.2, and for the claim that declaring `weaponId` on v9 changes the
 * data generation *only* at the weapon.
 *
 * v9 is v8's 60 s timed sibling and rests on the same premise: a hit is a pure function of the
 * angular error at the instant of firing. Before this task v9 declared no weapon and therefore ran
 * `main.ts`'s `ak47` default — 33/33 shots carrying seeded spread and 32/33 carrying aim punch in
 * the planning measurement, which makes that premise false. The fixture change is a single key, so
 * what needs proving is not that the key is there but that swapping the weapon is safe:
 *
 *  1. the seeded spawn stream is untouched — same seed and same kill order give bit-identical
 *     placements under either weapon;
 *  2. `sampleSpread()` early-returns for this weapon, so the shared seeded stream it draws from is
 *     not advanced by a single draw — that is *why* (1) also holds under live fire rather than only
 *     when nobody shoots;
 *  3. the recoil table is bit-zero, so `aimPunch` never moves and `ticks[].aim` is the real view.
 *
 * The accounted side effects are asserted rather than described: cycletime 0.10 -> 0.17 s and
 * magazine 30 -> 12, the second of which matters more for v9 than it did for v8 because v9's clock
 * does not stop when the player misses (OQ-68.4).
 */

const V9_CONFIG = microFlickThreeTargetTestV9.drill;
const V9_SEED = V9_CONFIG.sequence.seed;
/** What `main.ts`'s weapon resolution gives v9 before and after this task. */
const PRE_T1_WEAPON = resolveActiveWeapon(undefined, undefined);
const POST_T1_WEAPON = resolveActiveWeapon(undefined, V9_CONFIG.weaponId);

const TRACE_SNAPSHOTS = 96;

interface V9Trace {
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
 * One v9 spawn trace. The kill order is scripted off `tickIndex` rather than off shots landing, so
 * it is identical under both weapons by construction — which is the point: the only variable left
 * between two runs is the weapon. Fire input is fed anyway, so each weapon's recoil and spread path
 * really does execute while the trace is being taken.
 */
function v9SpawnTrace(weapon: WeaponConfig): V9Trace {
  const state = createSharedState();
  const manager = createTargetManager(V9_CONFIG);
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
    V9_SEED,
    {
      translation: 'locked',
      afterTick(current, _tickEndMs, tickIndex): void {
        if (tickIndex % 3 === 0 && current.targets.length > 0) {
          manager.markKilled(current, current.targets[tickIndex % current.targets.length].id);
        }
        // `spawn()` refills the magazine, so ammo is not monotonic across the run; only the
        // downward steps are shots.
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

describe('WP-68 T1 — micro flick v9 runs a zero-spread, zero-recoil weapon', () => {
  it('resolves usp_s_laser through the same precedence rule main.ts uses', () => {
    expect(POST_T1_WEAPON).toBe(WEAPONS.usp_s_laser);
    // The pre-T1 fact this task exists to change: with no key, v9 silently ran the app default.
    expect(PRE_T1_WEAPON).toBe(WEAPONS.ak47);
    expect(POST_T1_WEAPON).not.toBe(PRE_T1_WEAPON);
    // Accounted side effects, asserted so they cannot drift out of the ledger: the cadence floor
    // rises from 100 ms to 170 ms, and the magazine shrinks from 30 rounds to 12.
    expect(POST_T1_WEAPON.cycletimeSec).toBe(0.17);
    expect(PRE_T1_WEAPON.cycletimeSec).toBe(0.1);
    expect(POST_T1_WEAPON.magSize).toBe(12);
    expect(PRE_T1_WEAPON.magSize).toBe(30);
  });

  it('gives v9 the same instrument as v8, which leaves drillId as the only pooling key', () => {
    // A new fact WP-63 did not have to state: the two sibling drills now declare the same weapon,
    // so `meta.weaponId` cannot tell a v8 export from a v9 one. Offline pooling must key on
    // `meta.drillId`, which is also the field that carries the ball size and the scoring rule.
    expect(V9_CONFIG.weaponId).toBe(microFlickThreeTargetTestV8.drill.weaponId);
    expect(V9_CONFIG.drillId).not.toBe(microFlickThreeTargetTestV8.drill.drillId);
    // The two things that do differ, and therefore must never be pooled: ball size and end
    // condition. Both are reachable from `drillId` alone.
    expect(V9_CONFIG.targets.hitbox?.widthU).not.toBe(
      microFlickThreeTargetTestV8.drill.targets.hitbox?.widthU,
    );
    expect(V9_CONFIG.endCondition.type).toBe('timeLimit');
    expect(microFlickThreeTargetTestV8.drill.endCondition.type).toBe('targetCount');
  });

  it('swapping the weapon does not perturb the seeded spawn stream, even under live fire', () => {
    const { trace: before, shotsFired: shotsBefore } = v9SpawnTrace(PRE_T1_WEAPON);
    const { trace: after, shotsFired: shotsAfter } = v9SpawnTrace(POST_T1_WEAPON);

    // Without shots the comparison would prove nothing about the spread stream: `ak47` must
    // actually have drawn from it during the traced window for its absence under v9's weapon to be
    // the thing being demonstrated.
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
    expect(distinctIds.size).toBeGreaterThan(V9_CONFIG.targets.population.activeCount);
  });

  it('never draws from the shared seeded stream, because sampleSpread early-returns', () => {
    const recoilState = createRecoilState();
    const table = generateRecoilTable(POST_T1_WEAPON.recoil);
    const counter = countingRng();

    // v9 is `translation: 'locked'` so speedRatio is always 0; 0.5 and 1 are included anyway to
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

    // Control: the weapon v9 used to run does draw. The zero above is therefore a property of the
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
        drillId: V9_CONFIG.drillId,
        weaponId: POST_T1_WEAPON.id,
        weaponSeed: POST_T1_WEAPON.recoil.seed,
        rngSeed: V9_SEED,
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
    if (!parsed.ok) throw new Error(`v9 payload failed to parse: ${JSON.stringify(parsed.errors)}`);
    expect(parsed.payload.meta.drillId).toBe('micro_flick_three_target_test_v9');
    // This field is what makes pre-T1 and post-T1 v9 exports mechanically separable. They are not
    // comparable data: the randomness of the hit decision itself changed.
    expect(parsed.payload.meta.weaponId).toBe('usp_s_laser');
    expect(parsed.payload.meta.weaponId).not.toBe('ak47');
  });

  it('starts every magazine at the declared size, which the offline ammo flag reads back', () => {
    // The offline predicate for an exhausted magazine is a `fire` event carrying `ammo === 0`, which
    // is only decidable if the magazine the run starts from is the one this weapon declares. v9
    // reaches that state more readily than v8: 12 rounds instead of 30, and a clock that keeps
    // running through a miss streak rather than a kill budget that waits (OQ-68.4).
    const state = createSharedState();
    const manager = createTargetManager(V9_CONFIG);
    createSimLoop(
      state,
      fixedClock(0),
      SIM_HZ,
      manager,
      undefined,
      undefined,
      undefined,
      POST_T1_WEAPON,
      V9_SEED,
      { translation: 'locked' },
    );
    expect(state.weapon.magSize).toBe(POST_T1_WEAPON.magSize);
    expect(state.weapon.ammo).toBe(POST_T1_WEAPON.magSize);
    expect(POST_T1_WEAPON.magSize).toBe(12);
  });
});
