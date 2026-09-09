import { describe, expect, it } from 'vitest';
import { MouseSampleArena, mouseSampleCapacityForDrill } from './mouseSampleArena.ts';

describe('MouseSampleArena — WP-60 / T1 raw mouse sample contract', () => {
  it('sizes the default contract for 1000 Hz with 20% headroom', () => {
    expect(mouseSampleCapacityForDrill(60)).toBe(72_000);
    expect(() => mouseSampleCapacityForDrill(0)).toThrow('maxDrillSeconds must be a positive finite number');
  });

  it('records a contiguous prefix, quantizes dt to integer microseconds, and never wraps on overflow', () => {
    const arena = new MouseSampleArena(2);

    expect(arena.record(4, -2, 1000.1234)).toBe(true);
    expect(arena.record(-1, 3, 1001.124)).toBe(true);
    expect(arena.record(9, 9, 1002)).toBe(false);

    expect(arena.count).toBe(2);
    expect(arena.overflow).toBe(true);
    const snapshot = arena.snapshot();
    expect(snapshot).toMatchObject({
      samples: {
        t0Ms: 1000.1234,
        dtUs: [0, 1001],
        dx: [4, -1],
        dy: [-2, 3],
      },
      recorded: 2,
      capacity: 2,
      overflow: true,
    });
    expect(snapshot.observedRateHz).toBeCloseTo(999.4003597840867, 9);
  });

  it('resets count and overflow while keeping the preallocated arena reusable', () => {
    const arena = new MouseSampleArena(1);

    arena.record(1, 1, 10);
    arena.record(2, 2, 11);
    arena.reset();
    arena.record(3, 4, 20);

    expect(arena.snapshot()).toEqual({
      samples: { t0Ms: 20, dtUs: [0], dx: [3], dy: [4] },
      recorded: 1,
      capacity: 1,
      overflow: false,
      observedRateHz: 0,
    });
  });

  it('snapshots an enabled-but-empty arena as an empty columnar block', () => {
    expect(new MouseSampleArena(3).snapshot()).toEqual({
      samples: { t0Ms: 0, dtUs: [], dx: [], dy: [] },
      recorded: 0,
      capacity: 3,
      overflow: false,
      observedRateHz: 0,
    });
  });
});
