import { describe, expect, it } from 'vitest';
import { loadDrill } from '../../drill/DrillLoader.ts';
import { formatClearanceViolations, type TargetEnvelope, validateClearance } from '../clearance.ts';
import peekCorridorProps from './peek-corridor.props.json';
import { peekCorridor } from './peek-corridor.ts';

const peekCorridorGltfText = Object.values(
  import.meta.glob<string>('../../../public/assets/scenes/peek-corridor/peek-corridor.gltf', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0];

const HIDDEN_YAW_DEG = -(Math.asin(2 / 8) * 180) / Math.PI;
const HOLD_CLICK_FIXTURE_SOURCE = {
  drillId: 'hold_click_peek_corridor_fixture',
  targets: {
    count: 1,
    distance: 8,
    spawnArea: { yawDegRange: [HIDDEN_YAW_DEG, HIDDEN_YAW_DEG], distanceURange: [8, 8] },
    motion: { type: 'linear', axis: 'horizontal', range: 4, speed: 4, spawnKind: 'slide-in' },
  },
  sequence: { alternation: 'LR', seed: 34 },
  timing: { countdownMs: 0, peekTimeoutMs: 1500 },
  endCondition: { type: 'targetCount', value: 1 },
};
const EXPOSED_REST_ENVELOPE: TargetEnvelope = {
  side: 'R',
  min: { x: 1.5, y: 0.5, z: -8.5 },
  max: { x: 2.5, y: 2.5, z: -7.5 },
};

interface GltfJson {
  nodes: Array<{ name?: string; mesh?: number }>;
  materials: unknown[];
}

describe('peek-corridor SceneConfig', () => {
  it('通過 validateScene(模組載入即自驗)並帶程序化 GLTF 資產', () => {
    expect(peekCorridor.sceneId).toBe('peek-corridor');
    expect(peekCorridor.assetPackVersion).toBe('peek-corridor-v1');
    expect(peekCorridor.clutterTier).toBe('low');
    expect(peekCorridor.asset).toEqual({
      url: '/assets/scenes/peek-corridor/peek-corridor.gltf',
      displayScale: 1,
    });
    expect(peekCorridor.playerCorridor.halfWidthU).toBe(1);
    expect(peekCorridor.propBounds.map((p) => p.id)).toEqual(['cover-wall']);
  });

  it('strict clearance 會拒絕 emergence 前被 cover-wall 遮蔽的 slide-in envelope', () => {
    const drill = loadDrill(HOLD_CLICK_FIXTURE_SOURCE);
    const violations = validateClearance(peekCorridor, drill);

    expect(violations.some((v) => v.propId === 'cover-wall'), formatClearanceViolations(violations)).toBe(true);
    expect(() => loadDrill(HOLD_CLICK_FIXTURE_SOURCE, peekCorridor)).toThrow(/cover-wall/);
  });

  it('occlusion-aware clearance 允許列名 cover-wall,但曝光後 rest envelope 保持零遮蔽', () => {
    const drill = loadDrill(HOLD_CLICK_FIXTURE_SOURCE);

    expect(
      validateClearance(peekCorridor, drill, {
        allowedOcclusionPropIds: ['cover-wall'],
        exposedRestEnvelope: EXPOSED_REST_ENVELOPE,
      }),
    ).toEqual([]);
  });

  it('GLTF 資產與 prop 清單同源,且不需要外部授權素材', () => {
    const gltf = JSON.parse(peekCorridorGltfText) as GltfJson;
    const meshNodes = gltf.nodes.filter((node) => node.mesh !== undefined);

    for (const p of peekCorridorProps.props) {
      expect(meshNodes.some((node) => node.name === p.id), p.id).toBe(true);
    }
    expect(meshNodes.map((node) => node.name)).toContain('ground');
    expect(meshNodes).toHaveLength(3);
    expect(gltf.materials).toHaveLength(3);
  });
});
