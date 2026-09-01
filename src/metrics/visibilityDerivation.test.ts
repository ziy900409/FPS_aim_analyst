import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { buildExportPayload, serializeJSON, type ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import { deriveVisibilityTimeline } from './visibilityDerivation.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const TARGET = { x: 0, y: 1.6, z: -10 };
const HITBOX = { width: 2, height: 2, depth: 2 };

const meta: Meta = {
  schemaVersion: 2,
  drillId: 'hold_click_visibility_fixture',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 3401,
  backend: 'webgl2',
  displayHz: 144,
  simHz: SIM_HZ,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-08-19T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  simToWorld: 1,
  targets: { hitbox: { widthU: HITBOX.width, heightU: HITBOX.height, depthU: HITBOX.depth } },
  scene: {
    sceneId: 'visibility-fixture',
    assetPackVersion: 'synthetic-v1',
    clutterTier: 'low',
    fallback: false,
    eye: { x: 0, y: 1.6, z: 0 },
  },
};

describe('deriveVisibilityTimeline', () => {
  it('reports full exposure when there are no prop bounds', () => {
    const result = deriveVisibilityTimeline(makePayload([{ ...TARGET }]), sceneWithProps([]), {
      sampleCount: 9,
      onsetThreshold: 0.5,
    });

    expect(result.samples).toEqual([{ t: 0, visibleFraction: 1 }]);
    expect(result.tFirstVisible).toBe(0);
    expect(result.tMeasurementOnset).toBe(0);
    expect(result.tFullExposure).toBe(0);
  });

  it('reports zero visibility for ticks with no target coordinates', () => {
    const result = deriveVisibilityTimeline(makePayload([null, { ...TARGET }]), sceneWithProps([]), {
      sampleCount: 9,
      onsetThreshold: 0.5,
    });

    expect(result.samples).toEqual([
      { t: 0, visibleFraction: 0 },
      { t: TICK_MS, visibleFraction: 1 },
    ]);
    expect(result.tFirstVisible).toBe(TICK_MS);
    expect(result.tMeasurementOnset).toBe(TICK_MS);
    expect(result.tFullExposure).toBe(TICK_MS);
  });

  it('distinguishes fully occluded, partially occluded, and fully exposed ticks', () => {
    const result = deriveVisibilityTimeline(makePayload([TARGET, { x: 1, y: 1.6, z: -10 }, { x: 3, y: 1.6, z: -10 }]), sceneWithProps([occluder()]), {
      sampleCount: 9,
      onsetThreshold: 0.5,
    });

    expect(result.samples.map((sample) => sample.visibleFraction)).toEqual([0, 4 / 9, 1]);
    expect(result.tFirstVisible).toBe(TICK_MS);
    expect(result.tMeasurementOnset).toBe(2 * TICK_MS);
    expect(result.tFullExposure).toBe(2 * TICK_MS);
  });

  it('hitboxAtTick overrides the default/meta hitbox per tick (WP-52 T5)', () => {
    const target = { x: 1, y: 1.6, z: -10 };
    const withoutOverride = deriveVisibilityTimeline(makePayload([target]), sceneWithProps([occluder()]), {
      sampleCount: 9,
      onsetThreshold: 0.5,
    });
    expect(withoutOverride.samples[0].visibleFraction).toBe(4 / 9);

    const shrunk = deriveVisibilityTimeline(makePayload([target]), sceneWithProps([occluder()]), {
      sampleCount: 9,
      onsetThreshold: 0.5,
      hitboxAtTick: () => ({ width: 0.1, height: 0.1, depth: 0.1, shape: 'box' }),
    });
    expect(shrunk.samples[0].visibleFraction).toBe(0);

    const widened = deriveVisibilityTimeline(makePayload([target]), sceneWithProps([occluder()]), {
      sampleCount: 9,
      onsetThreshold: 0.5,
      hitboxAtTick: () => ({ width: 6, height: 6, depth: 6, shape: 'box' }),
    });
    expect(widened.samples[0].visibleFraction).toBe(8 / 9);
  });

  it('falls back to the default hitbox when hitboxAtTick returns undefined for a tick', () => {
    const target = { x: 1, y: 1.6, z: -10 };
    const result = deriveVisibilityTimeline(makePayload([target]), sceneWithProps([occluder()]), {
      sampleCount: 9,
      onsetThreshold: 0.5,
      hitboxAtTick: () => undefined,
    });
    expect(result.samples[0].visibleFraction).toBe(4 / 9);
  });

  it('keeps edge-grazing sensitivity explicit by sample count', () => {
    const centerOnly = deriveVisibilityTimeline(makePayload([TARGET]), sceneWithProps([edgeGrazingOccluder()]), {
      sampleCount: 1,
      onsetThreshold: 0.5,
    });
    const ninePoint = deriveVisibilityTimeline(makePayload([TARGET]), sceneWithProps([edgeGrazingOccluder()]), {
      sampleCount: 9,
      onsetThreshold: 0.5,
    });

    expect(centerOnly.samples[0].visibleFraction).toBe(1);
    expect(ninePoint.samples[0].visibleFraction).toBe(5 / 9);
  });
});

function makePayload(targets: Array<{ x: number; y: number; z: number } | null>): ExportPayload {
  const recorder = createDataRecorder({ capacity: targets.length + 1 });

  targets.forEach((target, tick) => {
    recorder.recordTick({
      t: tick * TICK_MS,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: target?.x ?? null,
      ty: target?.y ?? null,
      tz: target?.z ?? null,
      aim: { yaw: 0, pitch: 0 },
      keys: [],
    });
  });

  const payload = buildExportPayload(meta, recorder.snapshot());
  return JSON.parse(serializeJSON(payload)) as ExportPayload;
}

function sceneWithProps(propBounds: SceneConfig['propBounds']): SceneConfig {
  return {
    sceneId: 'visibility-fixture',
    assetPackVersion: 'synthetic-v1',
    clutterTier: 'low',
    asset: null,
    propBounds,
    playerCorridor: { halfWidthU: 1 },
  };
}

function occluder(): SceneConfig['propBounds'][number] {
  return {
    id: 'center-wall',
    min: { x: -0.6, y: 0, z: -5 },
    max: { x: 0.6, y: 3, z: -4 },
  };
}

function edgeGrazingOccluder(): SceneConfig['propBounds'][number] {
  return {
    id: 'edge-slit',
    min: { x: 0.35, y: 0, z: -5 },
    max: { x: 0.65, y: 3, z: -4 },
  };
}
