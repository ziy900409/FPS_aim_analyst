import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import { SIM_TO_WORLD } from '../loop/constants.ts';
import { aimForward, angularEccentricityDeg, eyeOriginForTick, resolveEyeOrigin } from './eyeOrigin.ts';

const baseMeta: Meta = {
  schemaVersion: 2,
  drillId: 'test-drill',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 1,
  backend: 'webgl2',
  displayHz: 144,
  simHz: 128,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-08-06T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
};

function payloadWith(metaOverride: Partial<Meta>): ExportPayload {
  return { meta: { ...baseMeta, ...metaOverride }, ticks: [], events: [] };
}

describe('resolveEyeOrigin', () => {
  it('prefers an explicit eyeBase over meta, even when meta is also present', () => {
    const payload = payloadWith({ simToWorld: 0.02, scene: { sceneId: 's', assetPackVersion: 'v1', clutterTier: 'low', fallback: false, eye: { x: 9, y: 9, z: 9 } } });
    const resolved = resolveEyeOrigin(payload, { eyeBase: { x: 1, y: 2, z: 3 }, simToWorld: 0.05 });

    expect(resolved).toEqual({ base: { x: 1, y: 2, z: 3 }, simToWorld: 0.05, source: 'explicit' });
  });

  it('defaults simToWorld to the engine constant when eyeBase is given without simToWorld', () => {
    const payload = payloadWith({});
    const resolved = resolveEyeOrigin(payload, { eyeBase: { x: 1, y: 2, z: 3 } });

    expect(resolved).toEqual({ base: { x: 1, y: 2, z: 3 }, simToWorld: SIM_TO_WORLD, source: 'explicit' });
  });

  it('resolves the meta branch when meta.scene.eye and meta.simToWorld are both present', () => {
    const payload = payloadWith({
      simToWorld: 0.01,
      scene: { sceneId: 'field-low', assetPackVersion: 'v1', clutterTier: 'low', fallback: false, eye: { x: 0, y: 1.6, z: 4 } },
    });
    const resolved = resolveEyeOrigin(payload);

    expect(resolved).toEqual({ base: { x: 0, y: 1.6, z: 4 }, simToWorld: 0.01, source: 'meta' });
  });

  it('allows meta.scene.eye components to be zero or negative (br-field eyeZ:0)', () => {
    const payload = payloadWith({
      simToWorld: 0.01,
      scene: { sceneId: 'br-field', assetPackVersion: 'v1', clutterTier: 'low', fallback: false, eye: { x: 0, y: 1.6, z: 0 } },
    });
    const resolved = resolveEyeOrigin(payload);

    expect(resolved.source).toBe('meta');
    expect(resolved.base).toEqual({ x: 0, y: 1.6, z: 0 });
  });

  it('falls back to legacy-default when meta.scene.eye is present but meta.simToWorld is missing (half-meta miss, FM-1b)', () => {
    const payload = payloadWith({
      scene: { sceneId: 'field-low', assetPackVersion: 'v1', clutterTier: 'low', fallback: false, eye: { x: 0, y: 1.6, z: 4 } },
    });
    const resolved = resolveEyeOrigin(payload);

    expect(resolved).toEqual({ base: { x: 0, y: 1.6, z: 0 }, simToWorld: SIM_TO_WORLD, source: 'legacy-default' });
  });

  it('falls back to legacy-default when meta.simToWorld is present but meta.scene.eye is missing (half-meta miss, FM-1b)', () => {
    const payload = payloadWith({
      simToWorld: 0.01,
      scene: { sceneId: 'field-low', assetPackVersion: 'v1', clutterTier: 'low', fallback: false },
    });
    const resolved = resolveEyeOrigin(payload);

    expect(resolved.source).toBe('legacy-default');
  });

  it('falls back to legacy-default when neither eyeBase nor meta are present (pre-S1 exports)', () => {
    const payload = payloadWith({});
    const resolved = resolveEyeOrigin(payload);

    expect(resolved).toEqual({ base: { x: 0, y: 1.6, z: 0 }, simToWorld: SIM_TO_WORLD, source: 'legacy-default' });
  });

  it('applies the deprecated eyeHeight alias only in the legacy-default fallback', () => {
    const payload = payloadWith({});
    const resolved = resolveEyeOrigin(payload, { eyeHeight: 1.8 });

    expect(resolved).toEqual({ base: { x: 0, y: 1.8, z: 0 }, simToWorld: SIM_TO_WORLD, source: 'legacy-default' });
  });

  it('still applies simToWorld in the legacy-default fallback (D2b factor is knowable even without D2a base.z)', () => {
    const payload = payloadWith({});
    const resolved = resolveEyeOrigin(payload);

    expect(resolved.simToWorld).toBe(SIM_TO_WORLD);
  });

  it('throws in strict mode when resolution falls to legacy-default', () => {
    const payload = payloadWith({});

    expect(() => resolveEyeOrigin(payload, { strictEyeOrigin: true })).toThrow(/legacy-default|meta\.scene\.eye/);
  });

  it('does not throw in strict mode when an explicit eyeBase is given', () => {
    const payload = payloadWith({});

    expect(() => resolveEyeOrigin(payload, { eyeBase: { x: 0, y: 1.6, z: 0 }, strictEyeOrigin: true })).not.toThrow();
  });

  it('does not throw in strict mode when meta resolves successfully (G-7: new exports self-describe)', () => {
    const payload = payloadWith({
      simToWorld: 0.01,
      scene: { sceneId: 'field-low', assetPackVersion: 'v1', clutterTier: 'low', fallback: false, eye: { x: 0, y: 1.6, z: 4 } },
    });

    expect(() => resolveEyeOrigin(payload, { strictEyeOrigin: true })).not.toThrow();
    expect(resolveEyeOrigin(payload, { strictEyeOrigin: true }).source).toBe('meta');
  });
});

describe('eyeOriginForTick', () => {
  it('offsets the base by px/pz scaled by simToWorld; y is unaffected by px/pz', () => {
    const resolved = { base: { x: 0, y: 1.6, z: 4 }, simToWorld: 0.01, source: 'meta' as const };
    const eye = eyeOriginForTick({ px: 169.25, pz: -50 }, resolved);
    expect(eye.x).toBeCloseTo(1.6925, 12);
    expect(eye.y).toBe(1.6);
    expect(eye.z).toBeCloseTo(3.5, 12);
  });

  it('is the identity offset when px/pz are zero', () => {
    const resolved = { base: { x: 0, y: 1.6, z: 4 }, simToWorld: 0.01, source: 'legacy-default' as const };
    expect(eyeOriginForTick({ px: 0, pz: 0 }, resolved)).toEqual({ x: 0, y: 1.6, z: 4 });
  });
});

describe('angularEccentricityDeg', () => {
  it('is zero when the aim ray points exactly at the target center', () => {
    const resolved = { base: { x: 0, y: 1.6, z: 4 }, simToWorld: 0.01, source: 'explicit' as const };
    const target = { x: 2, y: 1.5, z: -4 };
    const eye = eyeOriginForTick({ px: 0, pz: 0 }, resolved);
    const dx = target.x - eye.x;
    const dy = target.y - eye.y;
    const dz = target.z - eye.z;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.asin(dy / Math.hypot(dx, dy, dz));

    const tick = { px: 0, pz: 0, aim: { yaw, pitch } };
    expect(angularEccentricityDeg(tick, target, resolved)).toBeCloseTo(0, 4);
  });

  it('returns zero when aim origin coincides with the target (degenerate direction)', () => {
    const resolved = { base: { x: 2, y: 1.5, z: -4 }, simToWorld: 0.01, source: 'explicit' as const };
    const tick = { px: 0, pz: 0, aim: { yaw: 0, pitch: 0 } };
    expect(angularEccentricityDeg(tick, { x: 2, y: 1.5, z: -4 }, resolved)).toBe(0);
  });

  it('matches the forward-vector convention shared with aimForward', () => {
    const forward = aimForward(0, 0);
    expect(forward.x).toBeCloseTo(0, 12);
    expect(forward.y).toBeCloseTo(0, 12);
    expect(forward.z).toBe(-1);
  });
});
