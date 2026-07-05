import type { Rng } from './rng.ts';
import type { RecoilState } from './punch.ts';

const TWO_PI = Math.PI * 2;

export interface WeaponInaccuracyLike {
  inaccuracy: {
    stand: number;
    crouch?: number;
    move: number;
  };
}

export interface SpreadSample {
  x: number;
  y: number;
}

export function sampleSpread(
  s: RecoilState,
  w: WeaponInaccuracyLike,
  speedRatio: number,
  rng: Rng,
): SpreadSample {
  validateWeaponInaccuracy(w);
  validateSpeedRatio(speedRatio);

  const inaccuracy = totalInaccuracy(s, w, speedRatio);
  const theta = rng() * TWO_PI;
  const radius = rng() * inaccuracy;

  return {
    x: Math.cos(theta) * radius,
    y: Math.sin(theta) * radius,
  };
}

function totalInaccuracy(s: RecoilState, w: WeaponInaccuracyLike, speedRatio: number): number {
  return w.inaccuracy.stand + s.inaccuracyFire + speedRatio ** 0.25 * w.inaccuracy.move;
}

function validateWeaponInaccuracy(w: WeaponInaccuracyLike): void {
  requireNonNegativeFinite(w.inaccuracy.stand, 'weapon inaccuracy.stand');
  requireNonNegativeFinite(w.inaccuracy.move, 'weapon inaccuracy.move');
  if (w.inaccuracy.crouch !== undefined) {
    requireNonNegativeFinite(w.inaccuracy.crouch, 'weapon inaccuracy.crouch');
  }
}

function validateSpeedRatio(speedRatio: number): void {
  if (!Number.isFinite(speedRatio) || speedRatio < 0 || speedRatio > 1) {
    throw new Error('speedRatio must be in [0, 1]');
  }
}

function requireNonNegativeFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be >= 0`);
  }
}
