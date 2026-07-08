import { describe, expect, it } from 'vitest';
import { collectMeta, measureDisplayHz, measureDisplayRefresh, type CollectMetaArgs } from './metadata.ts';

describe('collectMeta', () => {
  it('collects complete drill metadata and computes suspect from overflow flags', () => {
    expect(
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 144,
        simHz: 128,
        browser: 'TestBrowser/1.0',
        sensitivity: 1.2,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        vStrafe: 250,
        maxDrillSeconds: 300,
        lateEventCount: 2,
        bufferOverflow: 1,
        recorderOverflow: false,
      }),
    ).toEqual({
      schemaVersion: 2,
      drillId: 'counterstrafe_ad_v1',
      weaponId: 'ak47',
      weaponSeed: 223,
      rngSeed: 1,
      backend: 'webgpu',
      displayHz: 144,
      simHz: 128,
      browser: 'TestBrowser/1.0',
      sensitivity: 1.2,
      sensitivityModel: 'cs2-0.022deg',
      movementModel: 'cs2-source',
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      unit: 'source',
      vStrafe: 250,
      maxDrillSeconds: 300,
      lateEventCount: 2,
      bufferOverflow: true,
      recorderOverflow: false,
      suspect: true,
    });
  });

  it('applies phase-A defaults for sim rate, source units, and overflow metadata', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgl2',
      displayHz: 60,
      browser: 'TestBrowser/1.0',
      sensitivity: 1,
      crossOriginIsolated: false,
      startedAt: new Date('2026-07-02T10:00:00.000Z'),
    });

    expect(meta).toMatchObject({
      simHz: 128,
      schemaVersion: 2,
      unit: 'source',
      weaponId: 'ak47',
      weaponSeed: 223,
      rngSeed: 1,
      sensitivityModel: 'cs2-0.022deg',
      movementModel: 'cs2-source',
      vStrafe: 250,
      maxDrillSeconds: 300,
      lateEventCount: 0,
      bufferOverflow: false,
      recorderOverflow: false,
      suspect: false,
    });
  });

  it('rejects missing required backend, sensitivity, or crossOriginIsolated fields', () => {
    const valid: CollectMetaArgs = {
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 60,
      browser: 'TestBrowser/1.0',
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
    };

    expect(() => collectMeta({ ...valid, backend: undefined } as unknown as CollectMetaArgs)).toThrow(
      'backend must be webgpu or webgl2',
    );
    expect(() => collectMeta({ ...valid, sensitivity: undefined } as unknown as CollectMetaArgs)).toThrow(
      'sensitivity must be a positive finite number',
    );
    expect(() =>
      collectMeta({ ...valid, crossOriginIsolated: undefined } as unknown as CollectMetaArgs),
    ).toThrow('crossOriginIsolated must be a boolean');
  });

  it('accepts explicit v2 weapon and spawn metadata', () => {
    expect(
      collectMeta({
        drillId: 'spray_v1',
        weaponId: 'm4a4',
        weaponSeed: 38965,
        rngSeed: 2026,
        backend: 'webgl2',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        spawn: { seed: 2026, motion: { type: 'static' } },
      }),
    ).toMatchObject({
      schemaVersion: 2,
      drillId: 'spray_v1',
      weaponId: 'm4a4',
      weaponSeed: 38965,
      rngSeed: 2026,
      movementModel: 'cs2-source',
      spawn: { seed: 2026, motion: { type: 'static' } },
    });
  });

  it('accepts stage3 scene metadata including fallback state', () => {
    expect(
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        scene: {
          sceneId: 'field-low',
          assetPackVersion: 'field-low-v1',
          clutterTier: 'low',
          fallback: true,
        },
      }),
    ).toMatchObject({
      scene: {
        sceneId: 'field-low',
        assetPackVersion: 'field-low-v1',
        clutterTier: 'low',
        fallback: true,
      },
    });
  });

  it('accepts WP-20 display metadata with explicit buffer and refresh estimate', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 120,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      display: {
        mode: 'fhd-1080',
        bufferW: 1920,
        bufferH: 1080,
        cssW: 2560,
        cssH: 1440,
        dpr: 1.25,
        screenW: 3200,
        screenH: 1800,
        fullscreen: true,
        refreshEstimateHz: 120,
        refreshMedianDeltaMs: 8.333,
      },
    });

    expect(meta.display).toEqual({
      mode: 'fhd-1080',
      bufferW: 1920,
      bufferH: 1080,
      cssW: 2560,
      cssH: 1440,
      dpr: 1.25,
      screenW: 3200,
      screenH: 1800,
      fullscreen: true,
      refreshEstimateHz: 120,
      refreshMedianDeltaMs: 8.333,
    });
  });

  it('carries the eligibility gate report through meta.display.gate (GD-10 audit)', () => {
    const meta = collectMeta({
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 120,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
      display: {
        mode: 'qhd-1440',
        bufferW: 2560,
        bufferH: 1440,
        cssW: 2560,
        cssH: 1440,
        dpr: 1,
        screenW: 2560,
        screenH: 1440,
        fullscreen: true,
        refreshEstimateHz: 120,
        gate: { pass: true, native: true, fullscreen: true, perf: true, details: 'all pass' },
      },
    });

    expect(meta.display?.gate).toEqual({
      pass: true,
      native: true,
      fullscreen: true,
      perf: true,
      details: 'all pass',
    });
  });

  it('rejects a malformed gate report on display metadata', () => {
    expect(() =>
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 120,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        display: {
          mode: 'qhd-1440',
          bufferW: 2560,
          bufferH: 1440,
          cssW: 2560,
          cssH: 1440,
          dpr: 1,
          screenW: 2560,
          screenH: 1440,
          fullscreen: true,
          refreshEstimateHz: 120,
          gate: { pass: 'yes' },
        },
      } as unknown as CollectMetaArgs),
    ).toThrow('display.gate.pass');
  });

  it('rejects malformed display metadata', () => {
    const valid: CollectMetaArgs = {
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 120,
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-07-02T10:00:00.000Z',
    };

    expect(() =>
      collectMeta({
        ...valid,
        display: { mode: 'bogus' },
      } as unknown as CollectMetaArgs),
    ).toThrow('display.mode must be native, fhd-1080, or qhd-1440');
  });

  it('allows runtime validity observers to mark metadata suspect', () => {
    expect(
      collectMeta({
        drillId: 'counterstrafe_ad_v1',
        backend: 'webgpu',
        displayHz: 144,
        sensitivity: 1,
        crossOriginIsolated: true,
        startedAt: '2026-07-02T10:00:00.000Z',
        suspect: true,
      }).suspect,
    ).toBe(true);
  });
});

describe('measureDisplayHz', () => {
  it('estimates refresh rate from the median requestAnimationFrame interval', async () => {
    const timestamps = [0, 16.67, 33.34, 50.01, 66.68, 83.35];
    let i = 0;

    const hz = await measureDisplayHz({
      samples: 5,
      warmupSamples: 0,
      requestAnimationFrame: (callback) => {
        callback(timestamps[i++]);
        return i;
      },
    });

    expect(hz).toBeCloseTo(60, 1);
  });

  it('drops warmup deltas and reports rounded Hz plus median delta', async () => {
    const timestamps = [0, 100, 200, 208.34, 216.67, 225, 233.33, 241.66];
    let i = 0;

    const estimate = await measureDisplayRefresh({
      samples: 5,
      warmupSamples: 2,
      requestAnimationFrame: (callback) => {
        callback(timestamps[i++]);
        return i;
      },
    });

    expect(estimate.refreshEstimateHz).toBe(120);
    expect(estimate.medianDeltaMs).toBeCloseTo(8.33, 2);
  });

  it('requires requestAnimationFrame to measure displayHz', async () => {
    await expect(measureDisplayHz({ requestAnimationFrame: null })).rejects.toThrow(
      'requestAnimationFrame is not available',
    );
  });
});
