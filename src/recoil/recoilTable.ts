import { createRan1, randomFloat } from './rng.ts';

export interface WeaponRecoilParams {
  seed: number;
  magnitude: number;
  magnitudeVariance: number;
  angleVariance: number;
}

export interface RecoilTableEntry {
  angleDeg: number;
  magnitude: number;
}

const RECOIL_TABLE_SIZE = 64;
const ADJACENT_SMOOTHING = 0.55;
const FIRST_BULLET_SUPPRESSION_COUNT = 4;
const FIRST_BULLET_SUPPRESSION_START = 0.75;
const FIRST_BULLET_SUPPRESSION_END = 1.0;

export function generateRecoilTable(p: WeaponRecoilParams): readonly RecoilTableEntry[] {
  validateParams(p);

  const rng = createRan1(p.seed);
  const table: RecoilTableEntry[] = [];
  let previousAngleDeg = 0;
  let previousMagnitude = p.magnitude;

  for (let i = 0; i < RECOIL_TABLE_SIZE; i++) {
    const rawAngleDeg = randomFloat(rng, -p.angleVariance, p.angleVariance);
    const rawMagnitude = randomFloat(rng, p.magnitude - p.magnitudeVariance, p.magnitude + p.magnitudeVariance);
    const angleDeg = i === 0 ? rawAngleDeg : lerp(previousAngleDeg, rawAngleDeg, ADJACENT_SMOOTHING);
    const smoothedMagnitude = i === 0 ? rawMagnitude : lerp(previousMagnitude, rawMagnitude, ADJACENT_SMOOTHING);

    previousAngleDeg = angleDeg;
    previousMagnitude = smoothedMagnitude;

    table.push({
      angleDeg,
      magnitude: smoothedMagnitude * firstBulletSuppression(i),
    });
  }

  return table;
}

export function firstBulletSuppression(index: number): number {
  if (index < 0 || index >= FIRST_BULLET_SUPPRESSION_COUNT) return 1;
  return lerp(FIRST_BULLET_SUPPRESSION_START, FIRST_BULLET_SUPPRESSION_END, index / FIRST_BULLET_SUPPRESSION_COUNT);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function validateParams(p: WeaponRecoilParams): void {
  requireFinite(p.seed, 'seed');
  requireFinite(p.magnitude, 'magnitude');
  requireFinite(p.magnitudeVariance, 'magnitudeVariance');
  requireFinite(p.angleVariance, 'angleVariance');
  if (p.magnitude < 0) throw new Error('recoil magnitude must be >= 0');
  if (p.magnitudeVariance < 0) throw new Error('recoil magnitudeVariance must be >= 0');
  if (p.angleVariance < 0) throw new Error('recoil angleVariance must be >= 0');
  if (p.magnitude - p.magnitudeVariance < 0) {
    throw new Error('recoil magnitudeVariance must not exceed magnitude');
  }
}

function requireFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) throw new Error(`recoil ${field} must be finite`);
}
