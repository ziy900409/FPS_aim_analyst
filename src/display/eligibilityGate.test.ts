import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeWarmupP95Ms, runEligibilityGate } from './eligibilityGate.ts';
import { EXPERIMENT_MAX_CONDITION, PERF_FLOOR_MS } from './constants.ts';

const QHD = { minW: 2560, minH: 1440 };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubEnv(args: { screenW: number; screenH: number; dpr: number; fullscreen: boolean }): void {
  vi.stubGlobal('window', { devicePixelRatio: args.dpr });
  vi.stubGlobal('screen', { width: args.screenW, height: args.screenH });
  vi.stubGlobal('document', { fullscreenElement: args.fullscreen ? {} : null });
}

describe('runEligibilityGate — three-check matrix', () => {
  it('passes when native resolution, fullscreen, and perf floor all hold', () => {
    stubEnv({ screenW: 2560, screenH: 1440, dpr: 1, fullscreen: true });
    const report = runEligibilityGate(QHD, 8.0);
    expect(report).toMatchObject({ pass: true, native: true, fullscreen: true, perf: true });
    expect(report.details).toContain('native:     PASS');
    expect(report.details).toContain('fullscreen: PASS');
    expect(report.details).toContain('perf:       PASS');
  });

  it('fails native alone: FHD panel cannot run QHD condition (GD-10 rejection reason)', () => {
    stubEnv({ screenW: 1920, screenH: 1080, dpr: 1, fullscreen: true });
    const report = runEligibilityGate(QHD, 8.0);
    expect(report).toMatchObject({ pass: false, native: false, fullscreen: true, perf: true });
    expect(report.details).toContain('native:     FAIL');
    expect(report.details).toContain('原生 1920×1080');
    expect(report.details).toContain('需求 2560×1440');
  });

  it('fails fullscreen alone', () => {
    stubEnv({ screenW: 2560, screenH: 1440, dpr: 1, fullscreen: false });
    const report = runEligibilityGate(QHD, 8.0);
    expect(report).toMatchObject({ pass: false, native: true, fullscreen: false, perf: true });
    expect(report.details).toContain('fullscreen: FAIL');
  });

  it('fails perf alone when warmup p95 exceeds the floor', () => {
    stubEnv({ screenW: 2560, screenH: 1440, dpr: 1, fullscreen: true });
    const report = runEligibilityGate(QHD, PERF_FLOOR_MS + 0.01);
    expect(report).toMatchObject({ pass: false, native: true, fullscreen: true, perf: false });
    expect(report.details).toContain('perf:       FAIL');
  });

  it('treats p95 exactly at the floor as passing (<=)', () => {
    stubEnv({ screenW: 2560, screenH: 1440, dpr: 1, fullscreen: true });
    expect(runEligibilityGate(QHD, PERF_FLOOR_MS).perf).toBe(true);
  });

  it('honors a custom perf floor override', () => {
    stubEnv({ screenW: 2560, screenH: 1440, dpr: 1, fullscreen: true });
    expect(runEligibilityGate(QHD, 5, 4).perf).toBe(false);
    expect(runEligibilityGate(QHD, 5, 6).perf).toBe(true);
  });
});

describe('runEligibilityGate — Windows DPI scaling matrix', () => {
  // A 2560×1440 physical panel reported by the browser at different Windows scaling factors:
  // CSS screen dims shrink but devicePixelRatio compensates, so native pixels reconstruct to 2560×1440.
  it('100% scaling: screen 2560×1440 × dpr 1 → native 2560×1440 (PASS)', () => {
    stubEnv({ screenW: 2560, screenH: 1440, dpr: 1, fullscreen: true });
    expect(runEligibilityGate(EXPERIMENT_MAX_CONDITION, 8.0).native).toBe(true);
  });

  it('125% scaling: screen 2048×1152 × dpr 1.25 → native 2560×1440 (PASS)', () => {
    stubEnv({ screenW: 2048, screenH: 1152, dpr: 1.25, fullscreen: true });
    expect(runEligibilityGate(EXPERIMENT_MAX_CONDITION, 8.0).native).toBe(true);
  });

  it('150% scaling: screen ~1706.67×960 × dpr 1.5 → native 2560×1440 (PASS)', () => {
    stubEnv({ screenW: 1706.6667, screenH: 960, dpr: 1.5, fullscreen: true });
    expect(runEligibilityGate(EXPERIMENT_MAX_CONDITION, 8.0).native).toBe(true);
  });

  it('genuine FHD panel at 100% stays FAIL regardless of the rounding path', () => {
    stubEnv({ screenW: 1920, screenH: 1080, dpr: 1, fullscreen: true });
    expect(runEligibilityGate(EXPERIMENT_MAX_CONDITION, 8.0).native).toBe(false);
  });
});

describe('runEligibilityGate — argument validation', () => {
  it('rejects non-positive requirement', () => {
    stubEnv({ screenW: 2560, screenH: 1440, dpr: 1, fullscreen: true });
    expect(() => runEligibilityGate({ minW: 0, minH: 1440 }, 8)).toThrow('required.minW');
  });

  it('rejects negative warmup p95', () => {
    stubEnv({ screenW: 2560, screenH: 1440, dpr: 1, fullscreen: true });
    expect(() => runEligibilityGate(QHD, -1)).toThrow('warmupP95Ms');
  });
});

describe('probeWarmupP95Ms', () => {
  it('computes nearest-rank p95 over post-warmup rAF deltas', async () => {
    // deltas after warmup: 100 samples, one 20ms spike, rest 8ms → p95 = 8ms (spike below rank).
    const deltas: number[] = [];
    for (let i = 0; i < 130; i++) deltas.push(i === 60 ? 20 : 8);
    const p95 = await probeWarmupP95Ms({
      samples: 100,
      warmupSamples: 30,
      requestAnimationFrame: fakeRaf(deltas),
    });
    expect(p95).toBe(8);
  });

  it('reflects a spike that lands within the top 5%', async () => {
    // 100 post-warmup samples, 6 of them at 30ms → p95 (rank 95) sits on a 30ms sample.
    const deltas: number[] = [];
    for (let i = 0; i < 130; i++) deltas.push(i >= 124 ? 30 : 8);
    const p95 = await probeWarmupP95Ms({
      samples: 100,
      warmupSamples: 30,
      requestAnimationFrame: fakeRaf(deltas),
    });
    expect(p95).toBe(30);
  });
});

/** Deterministic rAF stub: emits a running timestamp advanced by successive deltas. */
function fakeRaf(deltas: readonly number[]): (cb: (time: number) => void) => number {
  let t = 1000;
  let i = 0;
  return (cb) => {
    const time = t;
    t += deltas[i] ?? 8;
    i++;
    queueMicrotask(() => cb(time));
    return i;
  };
}
