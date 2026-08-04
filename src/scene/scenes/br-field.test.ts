import { describe, expect, it } from 'vitest';
import { loadDrill } from '../../drill/DrillLoader.ts';
import { trackingLongrangeV1 } from '../../drill/tracking_longrange_v1.ts';
import { PERF_FLOOR_MS } from '../../display/constants.ts';
import { createFrameLog } from '../../display/frameLog.ts';
import { formatClearanceViolations, validateClearance } from '../clearance.ts';
import type { SceneConfig } from '../SceneConfig.ts';
import brFieldProps from './br-field.props.json';
import { brField } from './br-field.ts';

const brFieldGltfText = Object.values(
  import.meta.glob<string>('../../../public/assets/scenes/br-field/br-field.gltf', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0];

interface GltfJson {
  nodes: Array<{ name?: string; mesh?: number }>;
  materials: unknown[];
  accessors: Array<{ count: number }>;
}

const frontFacingLongrangeSource = (rangeScale = 1) => ({
  ...trackingLongrangeV1.drill,
  targets: {
    ...trackingLongrangeV1.drill.targets,
    spawnArea: {
      yawDegRange: [0, 0],
      distanceURange: [trackingLongrangeV1.drill.targets.distance, trackingLongrangeV1.drill.targets.distance],
    },
    motion: {
      ...trackingLongrangeV1.drill.targets.motion,
      range: trackingLongrangeV1.drill.targets.motion.range * rangeScale,
      speed: trackingLongrangeV1.drill.targets.motion.speed * rangeScale,
    },
  },
});

describe('br-field SceneConfig', () => {
  it('通過 validateScene(模組載入即自驗)並宣告低雜亂度 GLTF 資產', () => {
    expect(brField.sceneId).toBe('br-field');
    expect(brField.assetPackVersion).toBe('br-field-v1');
    expect(brField.clutterTier).toBe('low');
    expect(brField.asset).toEqual({ url: '/assets/scenes/br-field/br-field.gltf', displayScale: 1 });
    expect(brField.propBounds).toHaveLength(62);
    expect(brField.playerCorridor.halfWidthU).toBe(21);
  });

  it('propBounds id 唯一、AABB 合法,且全部避開 42u x 145u front-facing hard corridor', () => {
    const ids = new Set<string>();
    const band = brFieldProps.corridorClearance.clearBand;

    for (const p of brField.propBounds) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.min.x).toBeLessThanOrEqual(p.max.x);
      expect(p.min.y).toBeLessThanOrEqual(p.max.y);
      expect(p.min.z).toBeLessThanOrEqual(p.max.z);

      const overlapsHardBand =
        p.min.x <= band.max.x && p.max.x >= band.min.x && p.min.z <= band.max.z && p.max.z >= band.min.z;
      expect(overlapsHardBand, p.id).toBe(false);
    }
  });

  it('front-facing longrange drill 與 hard 20deg/s motion envelope 都通過 br-field clearance', () => {
    const canonical = loadDrill(frontFacingLongrangeSource());
    const hard = loadDrill(frontFacingLongrangeSource(4));

    expect(validateClearance(brField, canonical), formatClearanceViolations(validateClearance(brField, canonical))).toEqual(
      [],
    );
    expect(validateClearance(brField, hard), formatClearanceViolations(validateClearance(brField, hard))).toEqual([]);
    expect(() => loadDrill(frontFacingLongrangeSource(), brField)).not.toThrow();
    expect(() => loadDrill(frontFacingLongrangeSource(4), brField)).not.toThrow();
  });

  it('走廊內 blocker 會被 clearance 指名拒載', () => {
    const blockedScene: SceneConfig = {
      ...brField,
      propBounds: [
        {
          id: 'front-corridor-blocker',
          min: { x: -0.25, y: 1.0, z: -115 },
          max: { x: 0.25, y: 2.0, z: -114 },
        },
        ...brField.propBounds,
      ],
    };
    const drill = loadDrill(frontFacingLongrangeSource());

    const violations = validateClearance(blockedScene, drill);
    expect(violations.some((v) => v.propId === 'front-corridor-blocker')).toBe(true);
    expect(() => loadDrill(frontFacingLongrangeSource(), blockedScene)).toThrow(/front-corridor-blocker/);
  });

  it('GLTF 資產與 prop 清單同源,並低於 WP-26 render budget', () => {
    const gltf = JSON.parse(brFieldGltfText) as GltfJson;
    const meshNodes = gltf.nodes.filter((node) => node.mesh !== undefined);

    expect(meshNodes).toHaveLength(129);
    expect(meshNodes.length).toBeGreaterThan(brFieldProps.props.length);
    for (const p of brFieldProps.props) {
      const propVisualExists =
        meshNodes.some((node) => node.name === p.id) ||
        (meshNodes.some((node) => node.name === `${p.id}-trunk`) &&
          meshNodes.some((node) => node.name === `${p.id}-canopy`));
      expect(propVisualExists, p.id).toBe(true);
    }

    const triangles = meshNodes.length * (gltf.accessors[2].count / 3);
    expect(triangles).toBe(1548);
    expect(triangles).toBeLessThan(20_000);
    expect(gltf.materials.length).toBe(8);
  });

  it('frameLog records a br-field/field-low comparison below the perf floor without suspect p95', () => {
    const frameDeltasMs = [0, 8, 16, 24, 32, 40, 48];
    const fieldLowLog = createFrameLog(16);
    const brFieldLog = createFrameLog(16);
    for (const t of frameDeltasMs) {
      fieldLowLog.push(t);
      brFieldLog.push(t);
    }

    expect(brFieldLog.export(PERF_FLOOR_MS).summary).toEqual(fieldLowLog.export(PERF_FLOOR_MS).summary);
    expect(brFieldLog.export(PERF_FLOOR_MS).summary).toMatchObject({
      p95: 8,
      overBudgetWindows: 0,
      overflow: false,
    });
  });
});
