import { describe, expect, it } from 'vitest';
import drillJson from '../../drills/counterstrafe_ad_v1.json';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { loadDrill } from '../drill/DrillLoader.ts';
import type { SceneConfig } from './SceneConfig.ts';
import {
  CLEARANCE_MARGIN_U,
  TARGET_HITBOX_RADIUS_U,
  deriveTargetEnvelopes,
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

  it('motion range 會保守擴張目標包絡極值', () => {
    const envelopes = deriveTargetEnvelopes(
      drill({ targets: { count: 1, distance: 4, motion: { type: 'pingpong', axis: 'horizontal', range: 3 } } }),
    );
    expect(envelopes[0].min.x).toBe(-1.5);
    expect(envelopes[0].max.x).toBe(5.5);
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
