import { describe, expect, it } from 'vitest';
import type { TickRecord } from '../data/RingBuffer.ts';
import { omegaDegPerSec } from './angularKinematics.ts';

describe('omegaDegPerSec', () => {
  it('returns NaN at index zero and pure yaw angular speed in deg/s', () => {
    const result = omegaDegPerSec([
      tick({ t: 0, yaw: 0, pitch: 0 }),
      tick({ t: 1000, yaw: Math.PI / 2, pitch: 0, dYaw: Math.PI / 2, dPitch: 0 }),
    ]);

    expect(Number.isNaN(result.values[0])).toBe(true);
    expect(result.values[1]).toBeCloseTo(90, 12);
    expect(result.source).toBe('tick-integral');
  });

  it('computes pure pitch angular speed', () => {
    const result = omegaDegPerSec([
      tick({ t: 0, yaw: 0, pitch: 0 }),
      tick({ t: 500, yaw: 0, pitch: Math.PI / 4, dYaw: 0, dPitch: Math.PI / 4 }),
    ]);

    expect(result.values[1]).toBeCloseTo(90, 12);
  });

  it('uses tick pitch minus half integrated pitch for yaw correction', () => {
    const result = omegaDegPerSec([
      tick({ t: 0, yaw: 0, pitch: 0 }),
      tick({ t: 1000, yaw: Math.PI / 2, pitch: Math.PI / 3, dYaw: Math.PI / 2, dPitch: 0 }),
    ]);

    expect(result.values[1]).toBeCloseTo(45, 12);
  });

  it('rejects non-increasing tick timestamps', () => {
    expect(() =>
      omegaDegPerSec([
        tick({ t: 10, yaw: 0, pitch: 0 }),
        tick({ t: 10, yaw: 0, pitch: 0, dYaw: 0, dPitch: 0 }),
      ]),
    ).toThrow(/strictly increasing/);
  });

  it('rejects missing tick-integral deltas with the KI-005 reason', () => {
    expect(() =>
      omegaDegPerSec([
        tick({ t: 0, yaw: 0, pitch: 0 }),
        tick({ t: 1000, yaw: 0, pitch: 0, dYaw: 0 }),
      ]),
    ).toThrow(/dYaw\/dPitch|KI-005/);
  });
});

interface TickOptions {
  t: number;
  yaw: number;
  pitch: number;
  dYaw?: number;
  dPitch?: number;
}

function tick(options: TickOptions): TickRecord {
  return {
    t: options.t,
    vx: 0,
    vz: 0,
    px: 0,
    pz: 0,
    tx: null,
    ty: null,
    tz: null,
    aim: { yaw: options.yaw, pitch: options.pitch },
    keys: [],
    ads: false,
    ...(options.dYaw !== undefined ? { dYaw: options.dYaw } : {}),
    ...(options.dPitch !== undefined ? { dPitch: options.dPitch } : {}),
  };
}
