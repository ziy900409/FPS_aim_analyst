import { describe, expect, it } from 'vitest';
import drillJson from '../../drills/counterstrafe_ad_v1.json';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { loadDrill } from '../drill/DrillLoader.ts';
import type { SceneConfig } from './SceneConfig.ts';
import {
  CLEARANCE_MARGIN_U,
  TARGET_HITBOX_RADIUS_U,
  deriveTargetEnvelopes,
  targetHitboxRadius,
  validateClearance,
} from './clearance.ts';

const EPS = 1e-3;
const INFLATION = TARGET_HITBOX_RADIUS_U + CLEARANCE_MARGIN_U;

function drill(overrides: Partial<DrillConfig> = {}): DrillConfig {
  return {
    drillId: 'test',
    targets: { count: 1, distance: 4 },
    sequence: { alternation: 'RL' },
    timing: { countdownMs: 0 },
    endCondition: { type: 'targetCount', value: 1 },
    ...overrides,
  };
}

function scene(propBounds: SceneConfig['propBounds'], halfWidthU = 0.000001): SceneConfig {
  return {
    sceneId: 'test-scene',
    assetPackVersion: 'test',
    clutterTier: 'low',
    asset: null,
    propBounds,
    playerCorridor: { halfWidthU },
  };
}

describe('deriveTargetEnvelopes', () => {
  it('推得靜態目標 hitbox AABB（side offset + distance + hitbox）', () => {
    expect(deriveTargetEnvelopes(drill())).toEqual([
      {
        side: 'R',
        min: { x: 1.5, y: 0.5, z: -4.5 },
        max: { x: 2.5, y: 2.5, z: -3.5 },
      },
    ]);
  });

  it('config.targets.hitbox 會縮放靜態目標 envelope（小目標 smoke）', () => {
    expect(
      deriveTargetEnvelopes(drill({ targets: { count: 1, distance: 4, hitbox: { widthU: 0.5, heightU: 1, depthU: 0.5 } } })),
    ).toEqual([
      {
        side: 'R',
        min: { x: 1.75, y: 1, z: -4.25 },
        max: { x: 2.25, y: 2, z: -3.75 },
      },
    ]);
  });

  it('motion range 會保守擴張目標包絡極值', () => {
    const envelopes = deriveTargetEnvelopes(
      drill({ targets: { count: 1, distance: 4, motion: { type: 'pingpong', axis: 'horizontal', range: 3 } } }),
    );
    expect(envelopes[0].min.x).toBe(-1.5);
    expect(envelopes[0].max.x).toBe(5.5);
  });

  it('spawnArea 會以 polar yaw/distance 極值推得保守 hitbox AABB（WP-21 T1）', () => {
    const envelopes = deriveTargetEnvelopes(
      drill({
        targets: {
          count: 1,
          distance: 4,
          spawnArea: { yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] },
        },
        sequence: { alternation: 'LR', seed: 7 },
      }),
    );
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0].min.x).toBeCloseTo(-2.3595203516590777, 12);
    expect(envelopes[0].max.x).toBeCloseTo(2.3595203516590777, 12);
    expect(envelopes[0].min.y).toBe(0.5);
    expect(envelopes[0].max.y).toBe(2.5);
    expect(envelopes[0].min.z).toBeCloseTo(-4.9, 12);
    expect(envelopes[0].max.z).toBeCloseTo(-2.40018491851728, 12);
  });

  // 保證門縱深（PR #10 review）:NaN envelope 會讓 segmentIntersectsAabb 全部靜默回 false,
  // 「未檢查」被當成「淨空」——即使呼叫端繞過 schema,此處也必須 loud fail 而非放行。
  it('waypoint 座標非有限 → throw、不得靜默視為淨空', () => {
    const bad = drill({
      targets: { count: 1, distance: 4, motion: { type: 'waypoints', waypoints: [{ x: NaN, y: 0, z: 0 }] } },
    });
    expect(() => deriveTargetEnvelopes(bad)).toThrow(/非有限邊界/);
    expect(() => validateClearance(scene([]), bad)).toThrow(/非有限邊界/);
  });
});

describe('validateClearance', () => {
  it('prop 膨脹後恰好貼到視線線段時回報違規', () => {
    const violations = validateClearance(
      scene([
        {
          id: 'touching-prop',
          min: { x: -INFLATION - 0.2, y: 1.6 - INFLATION - 0.1, z: -INFLATION - 0.1 },
          max: { x: -INFLATION, y: 1.6 - INFLATION + 0.1, z: -INFLATION + 0.1 },
        },
      ]),
      drill(),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].propId).toBe('touching-prop');
  });

  it('prop 膨脹後與線段保留 epsilon 間隙時通過', () => {
    expect(
      validateClearance(
        scene([
          {
            id: 'clear-prop',
            min: { x: -INFLATION - 0.2, y: 1.6 - INFLATION - 0.1, z: -INFLATION - 0.1 },
            max: { x: -INFLATION - EPS, y: 1.6 - INFLATION + 0.1, z: -INFLATION + 0.1 },
          },
        ]),
        drill(),
      ),
    ).toEqual([]);
  });

  it('config.targets.hitbox 會縮小 prop inflation 半徑（小目標 smoke）', () => {
    const small = drill({ targets: { count: 1, distance: 4, hitbox: { widthU: 0.5, heightU: 1, depthU: 0.5 } } });
    const smallInflation = targetHitboxRadius({ width: 0.5, height: 1, depth: 0.5 }) + CLEARANCE_MARGIN_U;
    expect(smallInflation).toBeLessThan(INFLATION);
    expect(
      validateClearance(
        scene([
          {
            id: 'default-only-blocker',
            min: { x: -INFLATION - 0.2, y: 1.6 - INFLATION - 0.1, z: -INFLATION - 0.1 },
            max: { x: -INFLATION, y: 1.6 - INFLATION + 0.1, z: -INFLATION + 0.1 },
          },
        ]),
        small,
      ),
    ).toEqual([]);
  });

  it('prop 在玩家背後時不誤擋', () => {
    expect(
      validateClearance(
        scene([
          {
            id: 'behind-player',
            min: { x: -1, y: 0, z: INFLATION + EPS },
            max: { x: 1, y: 3, z: INFLATION + 1 },
          },
        ]),
        drill(),
      ),
    ).toEqual([]);
  });

  it('移動目標只有在 motion 極值處碰到 prop 時回報違規', () => {
    const moving = drill({
      targets: { count: 1, distance: 4, motion: { type: 'pingpong', axis: 'horizontal', range: 3 } },
    });
    const violations = validateClearance(
      scene([
        {
          id: 'motion-extreme-prop',
          min: { x: -1.5 - INFLATION - 0.1, y: 1.5 - INFLATION - 0.1, z: -4 - INFLATION - 0.1 },
          max: { x: -1.5 - INFLATION + 0.1, y: 1.5 - INFLATION + 0.1, z: -4 - INFLATION + 0.1 },
        },
      ]),
      moving,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].propId).toBe('motion-extreme-prop');
    expect(validateClearance(scene([]), moving)).toEqual([]);
  });

  it('spawnArea 極值納入淨空檢查：阻擋 seeded pop-in 包絡時回報違規', () => {
    const seeded = drill({
      targets: {
        count: 1,
        distance: 4,
        spawnArea: { yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] },
      },
      sequence: { alternation: 'LR', seed: 7 },
    });
    const violations = validateClearance(
      scene([
        {
          id: 'spawnarea-blocker',
          min: { x: -0.1, y: 1.4, z: -4.95 },
          max: { x: 0.1, y: 1.8, z: -4.85 },
        },
      ]),
      seeded,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].propId).toBe('spawnarea-blocker');
  });

  it('field-low 淨空 fixture × 現行 counter-strafe drill 通過', () => {
    const fieldLowClearFixture = scene(
      [
        {
          id: 'safe-crate',
          min: { x: 8, y: 0, z: -2 },
          max: { x: 9, y: 1, z: -1 },
        },
      ],
      1,
    );
    expect(validateClearance(fieldLowClearFixture, loadDrill(drillJson))).toEqual([]);
  });
});
