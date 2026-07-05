import { describe, expect, it } from 'vitest';
import { createRecoilState, recoilOnFire, recoilTick, type WeaponRecoilLike } from './punch.ts';
import { createRan1, type Rng } from './rng.ts';
import { sampleSpread, type WeaponInaccuracyLike } from './spread.ts';

const RECOIL_DT_SEC = 1 / 64;

const ak47Inaccuracy = {
  stand: 0.00641,
  crouch: 0.00481,
  fire: 0.0078,
  move: 0.02,
  recoveryTimeStand: 0.4,
};

const ak47Weapon: WeaponRecoilLike & WeaponInaccuracyLike = {
  cycletimeSec: 0.1,
  inaccuracy: ak47Inaccuracy,
};

describe('sampleSpread', () => {
  it('re-generates the same spread sequence bit-for-bit for the same seed', () => {
    expect(sampleSequence(223)).toEqual(sampleSequence(223));
    expect(sampleSequence(223)).not.toEqual(sampleSequence(224));
  });

  it('consumes exactly two rng values per shot in theta-then-radius order', () => {
    const state = createRecoilState();
    const rng = countingRng([0.25, 0.5]);

    const sample = sampleSpread(state, ak47Weapon, 0, rng);

    expect(rng.calls).toBe(2);
    expect(sample.x).toBeCloseTo(0, 15);
    expect(sample.y).toBeCloseTo(ak47Inaccuracy.stand * 0.5, 15);
  });

  it('samples a bounded center-biased radius with a uniform theta', () => {
    const state = createRecoilState();
    const rng = createRan1(223);
    const samples = 10_000;
    const bins = new Array<number>(12).fill(0);
    let radiusSum = 0;

    for (let i = 0; i < samples; i++) {
      const sample = sampleSpread(state, ak47Weapon, 0, rng);
      const radius = Math.hypot(sample.x, sample.y);
      expect(radius).toBeLessThanOrEqual(ak47Inaccuracy.stand + 1e-15);
      radiusSum += radius;

      const theta = (Math.atan2(sample.y, sample.x) + Math.PI * 2) % (Math.PI * 2);
      bins[Math.floor((theta / (Math.PI * 2)) * bins.length)] += 1;
    }

    const expectedBinCount = samples / bins.length;
    const chiSquared = bins.reduce(
      (sum, count) => sum + (count - expectedBinCount) ** 2 / expectedBinCount,
      0,
    );
    expect(chiSquared).toBeLessThan(30);
    expect(radiusSum / samples).toBeLessThan(ak47Inaccuracy.stand * 0.51);
  });

  it('composes stand, fire, and movement inaccuracy components', () => {
    const state = createRecoilState();
    state.inaccuracyFire = 0.003;
    const rngAtMaxRadius = sequenceRng([0, 1]);

    expect(sampleSpread(state, ak47Weapon, 0, rngAtMaxRadius).x).toBeCloseTo(
      ak47Inaccuracy.stand + 0.003,
      15,
    );

    expect(sampleSpread(state, ak47Weapon, 1, sequenceRng([0, 1])).x).toBeCloseTo(
      ak47Inaccuracy.stand + 0.003 + ak47Inaccuracy.move,
      15,
    );
  });

  it('rejects invalid inaccuracy inputs', () => {
    expect(() =>
      sampleSpread(createRecoilState(), { inaccuracy: { stand: -1, move: 0 } }, 0, createRan1(1)),
    ).toThrow('weapon inaccuracy.stand must be >= 0');
    expect(() => sampleSpread(createRecoilState(), ak47Weapon, 1.1, createRan1(1))).toThrow(
      'speedRatio must be in [0, 1]',
    );
  });
});

describe('inaccuracyFire recovery', () => {
  it('increases over a five-shot burst and then decays by the recovery curve', () => {
    const state = createRecoilState();
    const inaccuracyAfterFire: number[] = [];

    for (let shot = 0; shot < 5; shot++) {
      if (shot > 0) tickCount(state, ticksForSeconds(ak47Weapon.cycletimeSec));
      recoilOnFire(state, ak47Weapon, [{ angleDeg: 0, magnitude: 0 }]);
      inaccuracyAfterFire.push(state.inaccuracyFire);
    }

    expect(inaccuracyAfterFire).toEqual([...inaccuracyAfterFire].sort((a, b) => a - b));

    const beforeRecovery = state.inaccuracyFire;
    tickCount(state, 8);

    const expected =
      beforeRecovery *
      Math.exp((-8 * RECOIL_DT_SEC * Math.LN10) / ak47Inaccuracy.recoveryTimeStand);
    expect(state.inaccuracyFire).toBeCloseTo(expected, 15);
  });
});

function sampleSequence(seed: number) {
  const state = createRecoilState();
  state.inaccuracyFire = 0.0156;
  const rng = createRan1(seed);

  return Array.from({ length: 8 }, () => {
    const sample = sampleSpread(state, ak47Weapon, 1, rng);
    return {
      x: Number(sample.x.toFixed(15)),
      y: Number(sample.y.toFixed(15)),
    };
  });
}

function tickCount(state: ReturnType<typeof createRecoilState>, count: number): void {
  for (let i = 0; i < count; i++) recoilTick(state, RECOIL_DT_SEC);
}

function ticksForSeconds(seconds: number): number {
  return Math.round(seconds / RECOIL_DT_SEC);
}

function sequenceRng(values: number[]): Rng {
  let index = 0;
  return () => {
    const value = values[index];
    if (value === undefined) throw new Error('test rng exhausted');
    index += 1;
    return value;
  };
}

function countingRng(values: number[]): Rng & { calls: number } {
  const inner = sequenceRng(values);
  const rng = (() => {
    rng.calls += 1;
    return inner();
  }) as Rng & { calls: number };
  rng.calls = 0;
  return rng;
}
