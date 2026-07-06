import { describe, expect, it } from 'vitest';
import { collectMeta, measureDisplayHz, type CollectMetaArgs } from './metadata.ts';

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
      drillId: 'counterstrafe_ad_v1',
      backend: 'webgpu',
      displayHz: 144,
      simHz: 128,
      browser: 'TestBrowser/1.0',
      sensitivity: 1.2,
      sensitivityModel: 'cs2-0.022deg',
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
      unit: 'source',
      sensitivityModel: 'cs2-0.022deg',
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
});

describe('measureDisplayHz', () => {
  it('estimates refresh rate from the median requestAnimationFrame interval', async () => {
    const timestamps = [0, 16.67, 33.34, 50.01, 66.68, 83.35];
    let i = 0;

    const hz = await measureDisplayHz({
      samples: 5,
      requestAnimationFrame: (callback) => {
        callback(timestamps[i++]);
        return i;
      },
    });

    expect(hz).toBeCloseTo(60, 1);
  });

  it('requires requestAnimationFrame to measure displayHz', async () => {
    await expect(measureDisplayHz({ requestAnimationFrame: null })).rejects.toThrow(
      'requestAnimationFrame is not available',
    );
  });
});
