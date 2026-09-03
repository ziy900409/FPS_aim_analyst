import { describe, expect, it } from 'vitest';
import type { Meta } from '../data/metadata.ts';
import {
  buildTrackingCompatibilityKey,
  checkTrackingCompatibility,
  TRACKING_PILOT_PROTOCOL_VERSION,
  type TrackingCompatibilityKey,
} from './trackingCompatibilityKey.ts';

const baseMeta: Meta = {
  schemaVersion: 2,
  drillId: 'tracking_core_pr_pilot_v1_2p0deg_5dps',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 54000,
  backend: 'webgl2',
  displayHz: 144,
  simHz: 128,
  browser: 'test-browser',
  sensitivity: 1.2,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  fovDeg: 103,
  crossOriginIsolated: true,
  startedAt: '2026-09-02T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  mouseIntegration: { model: 'tick-window-integral', radPerCount: 0.0001, hipStep: 1, adsStep: 1 },
  // KI-020: target angular size now lives in the hitbox, and OQ-54-11 added display refresh as a
  // cohort axis.
  targets: { hitbox: { widthU: 0.13964, heightU: 0.13964, depthU: 0.13964, shape: 'box' } },
  spawn: {
    seed: 54000,
    trackingTrajectory: {
      kind: 'band-limited-2d-v1',
      seed: 54000,
      durationMs: 25000,
      yawBoundDeg: 2,
      pitchBoundDeg: 2,
      targetRmsSpeedDegPerSec: 5,
      frequencyBandHz: [0.1, 0.7],
    },
  },
};

describe('buildTrackingCompatibilityKey — band-limited-2d-v1', () => {
  it('builds a key with travel amplitude/speed from the trajectory and size from the hitbox', () => {
    const key = buildTrackingCompatibilityKey(baseMeta);
    expect(key).toEqual<TrackingCompatibilityKey>({
      drillId: 'tracking_core_pr_pilot_v1_2p0deg_5dps',
      protocolVersion: TRACKING_PILOT_PROTOCOL_VERSION,
      motionKind: 'band-limited-2d-v1',
      travelAmplitudeDeg: '2x2',
      speedDegPerSec: '5',
      targetHitboxWidthU: 0.13964,
      fovDeg: 103,
      sensitivity: 1.2,
      inputMode: 'tick-window-integral',
      displayRefreshHz: 144,
    });
  });

  it('falls back to aim-diff-legacy input mode when mouseIntegration is absent', () => {
    const { mouseIntegration: _mouseIntegration, ...rest } = baseMeta;
    const key = buildTrackingCompatibilityKey(rest);
    expect(key.inputMode).toBe('aim-diff-legacy');
  });
});

describe('buildTrackingCompatibilityKey — reversal-2d-v1', () => {
  it('builds a key with range-formatted sizeDeg/speedDegPerSec', () => {
    const meta: Meta = {
      ...baseMeta,
      spawn: {
        seed: 54100,
        trackingTrajectory: {
          kind: 'reversal-2d-v1',
          seed: 54100,
          durationMs: 25000,
          angularBoundsDeg: [-8, 8],
          speedRangeDegPerSec: [5, 20],
          reversalIntervalMs: [800, 1400],
          accelerationRampMs: 150,
        },
      },
    };
    const key = buildTrackingCompatibilityKey(meta);
    expect(key.motionKind).toBe('reversal-2d-v1');
    expect(key.travelAmplitudeDeg).toBe('-8..8');
    expect(key.speedDegPerSec).toBe('5..20');
  });
});

describe('buildTrackingCompatibilityKey — fail fast', () => {
  it('throws when meta.fovDeg is missing', () => {
    const { fovDeg: _fovDeg, ...rest } = baseMeta;
    expect(() => buildTrackingCompatibilityKey(rest)).toThrow(/fovDeg/);
  });

  it('throws when meta.spawn.trackingTrajectory is missing', () => {
    const meta: Meta = { ...baseMeta, spawn: { seed: 54000 } };
    expect(() => buildTrackingCompatibilityKey(meta)).toThrow(/trackingTrajectory/);
  });

  it('throws on an unrecognized trackingTrajectory.kind', () => {
    const meta: Meta = { ...baseMeta, spawn: { seed: 54000, trackingTrajectory: { kind: 'legacy-static-v0' } } };
    expect(() => buildTrackingCompatibilityKey(meta)).toThrow(/not recognized/);
  });

  it('throws on a non-ascending angularBoundsDeg range', () => {
    const meta: Meta = {
      ...baseMeta,
      spawn: {
        seed: 54100,
        trackingTrajectory: {
          kind: 'reversal-2d-v1',
          seed: 54100,
          durationMs: 25000,
          angularBoundsDeg: [8, -8],
          speedRangeDegPerSec: [5, 20],
          reversalIntervalMs: [800, 1400],
          accelerationRampMs: 150,
        },
      },
    };
    expect(() => buildTrackingCompatibilityKey(meta)).toThrow(/ascending/);
  });
});

  it('separates cohorts by display refresh rate, rounded to whole Hz (OQ-54-11)', () => {
    // The researcher accepted 60 Hz pilot data but required refresh to split cohorts: the sim
    // clock is 128 Hz either way, yet what the participant *sees* bounds their achievable error.
    const at60 = buildTrackingCompatibilityKey({ ...baseMeta, displayHz: 59.94 });
    const at144 = buildTrackingCompatibilityKey({ ...baseMeta, displayHz: 143.9 });
    expect(at60.displayRefreshHz).toBe(60);
    expect(at144.displayRefreshHz).toBe(144);
    expect(checkTrackingCompatibility(at60, at144)).toBe(false);
    // A measurement wobble within the same panel must not split the cohort.
    expect(checkTrackingCompatibility(at60, buildTrackingCompatibilityKey({ ...baseMeta, displayHz: 60.02 }))).toBe(true);
  });

  it('requires the target hitbox (size is no longer derivable from the trajectory) (KI-020)', () => {
    const meta = { ...baseMeta };
    delete (meta as { targets?: unknown }).targets;
    expect(() => buildTrackingCompatibilityKey(meta)).toThrow(/meta\.targets\.hitbox\.widthU/);
  });

describe('checkTrackingCompatibility', () => {
  const key = buildTrackingCompatibilityKey(baseMeta);

  it('returns true for two identical keys', () => {
    expect(checkTrackingCompatibility(key, { ...key })).toBe(true);
  });

  const fieldOverrides: Array<[keyof TrackingCompatibilityKey, unknown]> = [
    ['drillId', 'other-drill'],
    ['protocolVersion', 'tracking-pilot-v2'],
    ['motionKind', 'reversal-2d-v1'],
    ['travelAmplitudeDeg', '0.5x0.5'],
    ['speedDegPerSec', '20'],
    ['targetHitboxWidthU', 0.0349],
    ['fovDeg', 90],
    ['sensitivity', 0.8],
    ['inputMode', 'aim-diff-legacy'],
    ['displayRefreshHz', 60],
  ];

  for (const [field, value] of fieldOverrides) {
    it(`returns false when ${field} differs`, () => {
      const other: TrackingCompatibilityKey = { ...key, [field]: value };
      expect(checkTrackingCompatibility(key, other)).toBe(false);
    });
  }
});
