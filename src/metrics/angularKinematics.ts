import type { TickRecord } from '../data/RingBuffer.ts';

export type OmegaSource = 'tick-integral';

export interface OmegaResult {
  readonly values: readonly number[];
  readonly source: OmegaSource;
}

/**
 * Tick-integral angular speed in deg/s. The first sample is NaN by contract.
 *
 * This intentionally refuses pre-KI-005 exports instead of falling back to the
 * legacy aim-diff derivation, whose render/sim beat aliasing is a known bug.
 */
export function omegaDegPerSec(ticks: readonly TickRecord[]): OmegaResult {
  const values = new Array<number>(ticks.length).fill(Number.NaN);
  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i];
    requireFiniteNumber(tick.t, `ticks[${i}].t`);
    requireFiniteNumber(tick.aim.yaw, `ticks[${i}].aim.yaw`);
    requireFiniteNumber(tick.aim.pitch, `ticks[${i}].aim.pitch`);
  }

  for (let i = 1; i < ticks.length; i++) {
    const previous = ticks[i - 1];
    const tick = ticks[i];
    const dtS = (tick.t - previous.t) / 1000;
    if (dtS <= 0) throw new Error('tick timestamps must be strictly increasing');

    const dYaw = integratedDelta(tick.dYaw, `ticks[${i}].dYaw`);
    const dPitch = integratedDelta(tick.dPitch, `ticks[${i}].dPitch`);
    const midPitch = tick.aim.pitch - dPitch / 2;
    const speedRadS = Math.hypot(dYaw * Math.cos(midPitch), dPitch) / dtS;
    values[i] = radToDeg(speedRadS);
  }

  return { values, source: 'tick-integral' };
}

function integratedDelta(value: number | undefined, path: string): number {
  if (value === undefined || !Number.isFinite(value)) {
    throw new Error(
      `omegaDegPerSec: this export has no ticks.dYaw/dPitch (${path}); omega would carry the render/sim beat-aliasing bug -- see docs/known_issue/KI-005-*`,
    );
  }
  return value;
}

function requireFiniteNumber(value: number, path: string): void {
  if (!Number.isFinite(value)) throw new Error(`${path} must contain only finite values`);
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}
