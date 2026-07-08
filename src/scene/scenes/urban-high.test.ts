import { describe, expect, it } from 'vitest';
import drillJson from '../../../drills/counterstrafe_ad_v1.json';
import { loadDrill } from '../../drill/DrillLoader.ts';
import { formatClearanceViolations, validateClearance } from '../clearance.ts';
import urbanHighProps from './urban-high.props.json';
import { urbanHigh } from './urban-high.ts';

const urbanHighGltfText = Object.values(
  import.meta.glob<string>('../../../public/assets/scenes/urban-high/urban-high.gltf', {
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

describe('urban-high SceneConfig', () => {
  it('通過 validateScene(模組載入即自驗)並宣告高雜亂度 GLTF 資產', () => {
    expect(urbanHigh.sceneId).toBe('urban-high');
    expect(urbanHigh.clutterTier).toBe('high');
    expect(urbanHigh.asset).toEqual({ url: '/assets/scenes/urban-high/urban-high.gltf', displayScale: 1 });
    expect(urbanHigh.propBounds.length).toBe(63);
    expect(urbanHigh.propBounds.length).toBeGreaterThan(40);
  });

  it('每個 propBound min <= max 且 id 唯一', () => {
    const ids = new Set<string>();
    for (const p of urbanHigh.propBounds) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.min.x).toBeLessThanOrEqual(p.max.x);
      expect(p.min.y).toBeLessThanOrEqual(p.max.y);
      expect(p.min.z).toBeLessThanOrEqual(p.max.z);
    }
  });

  it('urban-high × 現行 counter-strafe drill 淨空驗證零違規(DrillLoader 不拒載)', () => {
    const drill = loadDrill(drillJson);
    const violations = validateClearance(urbanHigh, drill);
    expect(violations, formatClearanceViolations(violations)).toEqual([]);
    expect(() => loadDrill(drillJson, urbanHigh)).not.toThrow();
  });

  it('淨空驗證會抓出高雜亂配置中誤入視線走廊的 prop id', () => {
    const drill = loadDrill(drillJson);
    const blockedScene = {
      ...urbanHigh,
      propBounds: [
        {
          id: 'intentional-blocker',
          min: { x: -0.25, y: 0.6, z: -2.4 },
          max: { x: 0.25, y: 2.2, z: -1.7 },
        },
        ...urbanHigh.propBounds,
      ],
    };

    const violations = validateClearance(blockedScene, drill);
    expect(violations.some((v) => v.propId === 'intentional-blocker')).toBe(true);
  });

  it('GLTF 資產與 prop 清單對齊,並低於 T5 負載預算', () => {
    const gltf = JSON.parse(urbanHighGltfText) as GltfJson;
    const meshNodes = gltf.nodes.filter((node) => node.mesh !== undefined);
    const visualOnlyNodes = ['ground', 'road-center', 'sidewalk-left', 'sidewalk-right'];

    expect(meshNodes).toHaveLength(urbanHighProps.props.length + visualOnlyNodes.length);
    for (const p of urbanHighProps.props) {
      expect(meshNodes.some((node) => node.name === p.id)).toBe(true);
    }
    for (const name of visualOnlyNodes) {
      expect(meshNodes.some((node) => node.name === name)).toBe(true);
      expect(urbanHigh.propBounds.some((p) => p.id === name)).toBe(false);
    }

    const triangles = meshNodes.length * (gltf.accessors[2].count / 3);
    expect(triangles).toBe(804);
    expect(triangles).toBeLessThan(20_000);
    expect(meshNodes.length).toBeLessThan(80);
    expect(gltf.materials.length).toBe(9);
  });
});
