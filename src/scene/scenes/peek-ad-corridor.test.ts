import { describe, expect, it } from 'vitest';
import { DEFAULT_TARGET_HITBOX } from '../../drill/DrillConfig.ts';
import { loadDrill } from '../../drill/DrillLoader.ts';
import { SIM_HZ } from '../../loop/constants.ts';
import { CS2_PROFILE } from '../../sim/MovementController.ts';
import { formatClearanceViolations, validateClearance } from '../clearance.ts';
import { visibleFractionForTarget } from '../occlusionGeometry.ts';
import peekAdCorridorProps from './peek-ad-corridor.props.json';
import { peekAdCorridor } from './peek-ad-corridor.ts';

const peekAdCorridorGltfText = Object.values(
  import.meta.glob<string>('../../../public/assets/scenes/peek-ad-corridor/peek-ad-corridor.gltf', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0];

interface GltfJson {
  nodes: Array<{ name?: string; mesh?: number; translation?: number[]; scale?: number[] }>;
  materials: unknown[];
}

// Geometry design assumption (WP-45 T2): cover-wall-l/-r were sized against this target distance and
// TargetManager's default (no spawnArea) L/R side positions (x=±2, y=1.5). T3's pilot config must keep
// the drill's target distance at this value, or re-verify the occlusion invariants below for a new one.
const DISTANCE = 8;
const EYE_Y = 1.6;
const TARGET_Y = 1.5;
const SIDE_OFFSET = 2;
const HITBOX = DEFAULT_TARGET_HITBOX;
const HALF_WIDTH_U = peekAdCorridor.playerCorridor.halfWidthU;

function targetPos(side: 'L' | 'R') {
  return { x: side === 'R' ? SIDE_OFFSET : -SIDE_OFFSET, y: TARGET_Y, z: -DISTANCE };
}

function fraction(px: number, side: 'L' | 'R'): number {
  return visibleFractionForTarget({ x: px, y: EYE_Y, z: 0 }, targetPos(side), HITBOX, peekAdCorridor.propBounds, 9);
}

/** Scans from the corridor center toward `direction` and returns the first px where visible fraction >= 0.5. */
function findOnsetPx(side: 'L' | 'R', direction: -1 | 1): number | null {
  const step = 0.01 * direction;
  for (let px = 0; Math.abs(px) <= HALF_WIDTH_U + 1e-9; px += step) {
    if (fraction(px, side) >= 0.5) return px;
  }
  return null;
}

const CLEARANCE_FIXTURE = {
  drillId: 'peek_ad_corridor_clearance_fixture',
  targets: { count: 2, distance: DISTANCE },
  sequence: { alternation: 'LR', seed: 45 },
  timing: { countdownMs: 0, peekTimeoutMs: 3000 },
  endCondition: { type: 'targetCount', value: 2 },
};

describe('peek-ad-corridor-v1 SceneConfig', () => {
  it('通過 validateScene(模組載入即自驗)並帶程序化 GLTF 資產', () => {
    expect(peekAdCorridor.sceneId).toBe('peek-ad-corridor-v1');
    expect(peekAdCorridor.assetPackVersion).toBe('peek-ad-corridor-v1');
    expect(peekAdCorridor.clutterTier).toBe('low');
    expect(peekAdCorridor.asset).toEqual({
      url: '/assets/scenes/peek-ad-corridor/peek-ad-corridor.gltf',
      displayScale: 1,
    });
    expect(peekAdCorridor.playerCorridor.halfWidthU).toBe(2);
    expect(peekAdCorridor.propBounds.map((p) => p.id)).toEqual(['cover-wall-l', 'cover-wall-r']);
  });

  it('每個 propBound min <= max(合法 AABB)', () => {
    for (const p of peekAdCorridor.propBounds) {
      expect(p.min.x).toBeLessThanOrEqual(p.max.x);
      expect(p.min.y).toBeLessThanOrEqual(p.max.y);
      expect(p.min.z).toBeLessThanOrEqual(p.max.z);
    }
  });

  it('GLTF 資產與 prop 清單同源,且不需要外部授權素材', () => {
    const gltf = JSON.parse(peekAdCorridorGltfText) as GltfJson;
    const meshNodes = gltf.nodes.filter((node) => node.mesh !== undefined);

    for (const p of peekAdCorridorProps.props) {
      expect(meshNodes.some((node) => node.name === p.id), p.id).toBe(true);
    }
    expect(meshNodes.map((node) => node.name)).toContain('ground');
    expect(meshNodes).toHaveLength(3);
    expect(gltf.materials).toHaveLength(2);
  });

  it('GLTF node AABB 與 props JSON/SceneConfig 逐項相同', () => {
    const gltf = JSON.parse(peekAdCorridorGltfText) as GltfJson;
    for (const p of peekAdCorridorProps.props) {
      const node = gltf.nodes.find((n) => n.name === p.id);
      expect(node, p.id).toBeDefined();
      const [tx, ty, tz] = node!.translation!;
      const [sx, sy, sz] = node!.scale!;
      expect(tx - sx / 2).toBeCloseTo(p.min.x, 10);
      expect(tx + sx / 2).toBeCloseTo(p.max.x, 10);
      expect(ty - sy / 2).toBeCloseTo(p.min.y, 10);
      expect(ty + sy / 2).toBeCloseTo(p.max.y, 10);
      expect(tz - sz / 2).toBeCloseTo(p.min.z, 10);
      expect(tz + sz / 2).toBeCloseTo(p.max.z, 10);
    }
  });
});

describe('peek-ad-corridor-v1 clearance(FR-P45-4)', () => {
  it('strict clearance 會拒絕 center pillar 對兩側靜止目標的遮蔽', () => {
    const drill = loadDrill(CLEARANCE_FIXTURE);
    const violations = validateClearance(peekAdCorridor, drill);
    const violatedIds = new Set(violations.map((v) => v.propId));
    expect(violatedIds.has('cover-wall-l'), formatClearanceViolations(violations)).toBe(true);
    expect(violatedIds.has('cover-wall-r'), formatClearanceViolations(violations)).toBe(true);
    expect(() => loadDrill(CLEARANCE_FIXTURE, peekAdCorridor)).toThrow(/cover-wall/);
  });

  it('只放行一側 cover-wall 時,未放行的一側仍被拒絕(非允許 prop 仍會拒絕)', () => {
    const drill = loadDrill(CLEARANCE_FIXTURE);
    const violations = validateClearance(peekAdCorridor, drill, { allowedOcclusionPropIds: ['cover-wall-l'] });
    const violatedIds = new Set(violations.map((v) => v.propId));
    expect(violatedIds.has('cover-wall-l')).toBe(false);
    expect(violatedIds.has('cover-wall-r'), formatClearanceViolations(violations)).toBe(true);
  });

  it('occlusion-aware clearance 放行兩側 cover-wall 後,pilot target envelopes 淨空零違規', () => {
    const drill = loadDrill(CLEARANCE_FIXTURE);
    const options = { allowedOcclusionPropIds: ['cover-wall-l', 'cover-wall-r'] };
    expect(validateClearance(peekAdCorridor, drill, options)).toEqual([]);
    expect(() => loadDrill(CLEARANCE_FIXTURE, peekAdCorridor, { clearance: options })).not.toThrow();
  });
});

describe('peek-ad-corridor-v1 visibility symmetry(FR-P45-4)', () => {
  it('中心起點對兩側目標的可見比例皆 < 0.5(center hidden)', () => {
    expect(fraction(0, 'L')).toBeLessThan(0.5);
    expect(fraction(0, 'R')).toBeLessThan(0.5);
  });

  it('向左移動跨越 50% onset 並達到 full exposure=1;右側目標維持隱藏', () => {
    const onsetPx = findOnsetPx('L', -1);
    expect(onsetPx).not.toBeNull();
    expect(Math.abs(onsetPx!)).toBeLessThanOrEqual(HALF_WIDTH_U);
    expect(fraction(onsetPx!, 'R')).toBeLessThan(0.5);
    expect(fraction(-HALF_WIDTH_U, 'L')).toBe(1);
    expect(fraction(-HALF_WIDTH_U, 'R')).toBe(0);
  });

  it('向右移動跨越 50% onset 並達到 full exposure=1;左側目標維持隱藏(鏡像)', () => {
    const onsetPx = findOnsetPx('R', 1);
    expect(onsetPx).not.toBeNull();
    expect(onsetPx!).toBeLessThanOrEqual(HALF_WIDTH_U);
    expect(fraction(onsetPx!, 'L')).toBeLessThan(0.5);
    expect(fraction(HALF_WIDTH_U, 'R')).toBe(1);
    expect(fraction(HALF_WIDTH_U, 'L')).toBe(0);
  });

  it('左右 crossing 位置的絕對值誤差在 1 tick(128Hz, CS2 maxSpeed)容差內', () => {
    const crossL = findOnsetPx('L', -1)!;
    const crossR = findOnsetPx('R', 1)!;
    const tickToleranceU = CS2_PROFILE.maxSpeed / SIM_HZ;
    expect(Math.abs(Math.abs(crossL) - Math.abs(crossR))).toBeLessThanOrEqual(tickToleranceU);
  });

  it('propBounds 為 x 軸鏡像(cover-wall-l ↔ cover-wall-r)', () => {
    const l = peekAdCorridor.propBounds.find((p) => p.id === 'cover-wall-l')!;
    const r = peekAdCorridor.propBounds.find((p) => p.id === 'cover-wall-r')!;
    expect(-r.max.x).toBeCloseTo(l.min.x, 10);
    expect(-r.min.x).toBeCloseTo(l.max.x, 10);
    expect(l.min.y).toBe(r.min.y);
    expect(l.max.y).toBe(r.max.y);
    expect(l.min.z).toBe(r.min.z);
    expect(l.max.z).toBe(r.max.z);
  });
});
