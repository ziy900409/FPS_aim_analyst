import { describe, expect, it } from 'vitest';
import ak47PunchGolden from '../../tests/golden/recoil/ak47-10shot-punch.json';
import { generateRecoilTable, type WeaponRecoilParams } from './recoilTable.ts';
import {
  createRecoilState,
  recoilOnFire,
  recoilTick,
  resetRecoilState,
  type RecoilState,
  type WeaponRecoilLike,
} from './punch.ts';

const RECOIL_DT_SEC = 1 / 64;

const ak47Recoil: WeaponRecoilParams = {
  seed: 223,
  magnitude: 30,
  magnitudeVariance: 0,
  angleVariance: 70,
};

const ak47Weapon: WeaponRecoilLike = {
  cycletimeSec: 0.1,
  inaccuracy: {
    fire: 0.0078,
  },
};

describe('recoil punch dynamics', () => {
  it('creates and resets a reusable zeroed state object', () => {
    const state = createRecoilState();
    state.aimPunchPitchDeg = 1;
    state.punchVelYaw = -2;
    state.recoilIndex = 3;
    state.inaccuracyFire = 0.25;

    expect(resetRecoilState(state)).toBe(state);
    expect(state).toMatchObject({
      aimPunchPitchDeg: 0,
      aimPunchYawDeg: 0,
      punchVelPitch: 0,
      punchVelYaw: 0,
      viewPunchPitchDeg: 0,
      viewPunchYawDeg: 0,
      recoilIndex: 0,
      inaccuracyFire: 0,
    });
  });

  it('rejects non-64Hz recoil ticks', () => {
    expect(() => recoilTick(createRecoilState(), 1 / 128)).toThrow(
      'recoilTick dtSec must be exactly 1/64',
    );
  });

  it('uses the current recoil index to select table entries on fire', () => {
    const state = createRecoilState();
    const table = [
      { angleDeg: 0, magnitude: 10 },
      { angleDeg: 90, magnitude: 20 },
    ];

    recoilOnFire(state, ak47Weapon, table);
    const firstPitchVel = state.punchVelPitch;

    recoilOnFire(state, ak47Weapon, table);

    expect(firstPitchVel).toBeLessThan(0);
    expect(Math.abs(state.punchVelPitch - firstPitchVel)).toBeLessThan(1e-10);
    expect(state.punchVelYaw).toBeLessThan(-1);
    expect(state.recoilIndex).toBe(2);
    expect(state.inaccuracyFire).toBe(0.0156);
  });

  it('decays recoil index only after the weapon reset delay', () => {
    const state = createRecoilState();
    recoilOnFire(state, ak47Weapon, [{ angleDeg: 0, magnitude: 0 }]);

    for (let i = 0; i < 7; i++) recoilTick(state, RECOIL_DT_SEC);
    expect(state.recoilIndex).toBe(1);

    recoilTick(state, RECOIL_DT_SEC);
    expect(state.recoilIndex).toBeCloseTo(Math.exp(-RECOIL_DT_SEC * Math.LN10 * 2), 12);
  });

  it('matches the AK-47 10-shot punch golden sequence', () => {
    const result = simulateAk47TenShot();

    expect(result).toEqual(ak47PunchGolden);
    expect(Math.abs(result.final.rawPunchPitchDeg - -10.18)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(result.final.rawPunchYawDeg - -1.56)).toBeLessThanOrEqual(0.01);
  });

  it('re-generates the same punch sequence bit-for-bit for the same inputs', () => {
    expect(simulateAk47TenShot()).toEqual(simulateAk47TenShot());
  });
});

function simulateAk47TenShot(): typeof ak47PunchGolden {
  const state = createRecoilState();
  const table = generateRecoilTable(ak47Recoil);
  const ticks: Array<(typeof ak47PunchGolden.ticks)[number]> = [];
  const shotsLog: Array<(typeof ak47PunchGolden.shotsLog)[number]> = [];
  let elapsedSec = 0;

  for (let shot = 0; shot < 10; shot++) {
    const fireAtSec = shot * ak47Weapon.cycletimeSec;
    while (elapsedSec + 1e-12 < fireAtSec) {
      recoilTick(state, RECOIL_DT_SEC);
      elapsedSec += RECOIL_DT_SEC;
      ticks.push(toTickSnapshot(ticks.length + 1, elapsedSec, state));
    }

    recoilOnFire(state, ak47Weapon, table);
    shotsLog.push(toShotSnapshot(shot + 1, elapsedSec, state));
  }

  return {
    dtSec: RECOIL_DT_SEC,
    shots: 10,
    cycletimeSec: ak47Weapon.cycletimeSec,
    final: {
      timeSec: round(elapsedSec),
      aimPunchPitchDeg: round(state.aimPunchPitchDeg),
      aimPunchYawDeg: round(state.aimPunchYawDeg),
      rawPunchPitchDeg: round(state.aimPunchPitchDeg * 2),
      rawPunchYawDeg: round(state.aimPunchYawDeg * 2),
      recoilIndex: round(state.recoilIndex),
      inaccuracyFire: round(state.inaccuracyFire),
    },
    shotsLog,
    ticks,
  };
}

function toShotSnapshot(shot: number, timeSec: number, state: RecoilState) {
  return {
    shot,
    timeSec: round(timeSec),
    aimPunchPitchDeg: round(state.aimPunchPitchDeg),
    aimPunchYawDeg: round(state.aimPunchYawDeg),
    recoilIndex: round(state.recoilIndex),
  };
}

function toTickSnapshot(tick: number, timeSec: number, state: RecoilState) {
  return {
    tick,
    timeSec: round(timeSec),
    aimPunchPitchDeg: round(state.aimPunchPitchDeg),
    aimPunchYawDeg: round(state.aimPunchYawDeg),
    punchVelPitch: round(state.punchVelPitch),
    punchVelYaw: round(state.punchVelYaw),
    recoilIndex: round(state.recoilIndex),
  };
}

function round(value: number): number {
  return Number(value.toFixed(12));
}
