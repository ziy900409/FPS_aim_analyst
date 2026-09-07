import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import { CLEARANCE_MARGIN_U, TARGET_HITBOX_RADIUS_U } from '../scene/clearance.ts';
import { spiderShotRoom } from '../scene/scenes/spider-shot-room.ts';
import { spiderShotV3 } from './spider_shot_v3.ts';

/** 最小合法 config（欄位形狀對齊 DrillConfig / validateDrill）。 */
const VALID = {
  drillId: 'test_ad_v1',
  targets: { count: 10, distance: 4 },
  sequence: { alternation: 'RL' },
  timing: { countdownMs: 3000 },
  endCondition: { type: 'targetCount', value: 10 },
} as const;

const INFLATION = TARGET_HITBOX_RADIUS_U + CLEARANCE_MARGIN_U;

function sceneWithBlockingProp(): SceneConfig {
  return {
    sceneId: 'blocked',
    assetPackVersion: 'test',
    clutterTier: 'low',
    asset: null,
    propBounds: [
      {
        id: 'blocking-crate',
        min: { x: -INFLATION - 0.2, y: 1.6 - INFLATION - 0.1, z: -INFLATION - 0.1 },
        max: { x: -INFLATION, y: 1.6 - INFLATION + 0.1, z: -INFLATION + 0.1 },
      },
    ],
    playerCorridor: { halfWidthU: 0.000001 },
  };
}

describe('loadDrill — 載入邊界（FR-6.2，OQ-6.4）', () => {
  it('接受已解析物件 → 回傳收斂 DrillConfig', () => {
    const cfg = loadDrill(VALID);
    expect(cfg.drillId).toBe('test_ad_v1');
    expect(cfg.targets.count).toBe(10);
    expect(cfg.sequence.alternation).toBe('RL');
    expect(cfg.endCondition).toEqual({ type: 'targetCount', value: 10 });
  });

  it('接受 JSON 字串 → 解析後驗證回傳（fetch().text() 路徑）', () => {
    const cfg = loadDrill(JSON.stringify(VALID));
    expect(cfg.drillId).toBe('test_ad_v1');
    expect(cfg.targets.distance).toBe(4);
  });

  it('JSON 字串語法錯 → throw 明確「載入失敗」錯誤、不回傳半成品', () => {
    expect(() => loadDrill('{ not valid json ')).toThrow(/載入失敗: JSON 解析錯誤/);
  });

  it('schema 不合（缺欄位）→ 委派 validateDrill throw 帶欄位路徑錯誤', () => {
    const bad = { ...VALID, targets: { distance: 4 } }; // 缺 targets.count
    expect(() => loadDrill(bad)).toThrow(/驗證失敗: targets\.count/);
  });

  it('schema 不合（型別錯）→ throw（不啟動 drill，OQ-6.4）', () => {
    const bad = { ...VALID, sequence: { alternation: 'XY' } };
    expect(() => loadDrill(bad)).toThrow(/驗證失敗: sequence\.alternation/);
  });

  it('scene clearance 違規時拒載，錯誤訊息指名 prop id', () => {
    expect(() => loadDrill(VALID, sceneWithBlockingProp())).toThrow(/clearance 驗證失敗.*blocking-crate/);
  });

  it('rejects an eye-frame Spider Shot drill when its bound scene eye is not the canonical anchor', () => {
    expect(loadDrill(spiderShotV3, spiderShotRoom).drillId).toBe('spider-shot-v3');
    const displacedEyeScene: SceneConfig = {
      ...spiderShotRoom,
      proceduralRoom: { ...spiderShotRoom.proceduralRoom!, eyeZ: 4 },
    };

    expect(() => loadDrill(spiderShotV3, displacedEyeScene)).toThrow(/delivery geometry.*eye anchor/i);
  });

  it('requires an eye-frame Spider Shot assessment to lock and audit player translation', () => {
    expect(() =>
      loadDrill({ ...spiderShotV3, playerControl: { translation: 'enabled' } }, spiderShotRoom),
    ).toThrow(/delivery geometry.*translation.*locked/i);
    expect(() =>
      loadDrill({ ...spiderShotV3, protocolGuard: undefined }, spiderShotRoom),
    ).toThrow(/delivery geometry.*noMovement/i);
  });

  it('rejects drift between the declared eye-frame distance, target size, and hitbox', () => {
    expect(() =>
      loadDrill(
        {
          ...spiderShotV3,
          spiderShot: { ...spiderShotV3.spiderShot!, centerDistanceU: 12 },
        },
        spiderShotRoom,
      ),
    ).toThrow(/delivery geometry.*center distance/i);

    expect(() =>
      loadDrill(
        {
          ...spiderShotV3,
          spiderShot: {
            ...spiderShotV3.spiderShot!,
            peripheral: {
              ...spiderShotV3.spiderShot!.peripheral,
              distanceURange: [8, 9],
            },
          },
        },
        spiderShotRoom,
      ),
    ).toThrow(/delivery geometry.*peripheral distance/i);

    expect(() =>
      loadDrill(
        {
          ...spiderShotV3,
          targets: {
            ...spiderShotV3.targets,
            hitbox: { ...spiderShotV3.targets.hitbox!, widthU: 0.5, heightU: 0.5, depthU: 0.5 },
          },
        },
        spiderShotRoom,
      ),
    ).toThrow(/delivery geometry.*angular diameter/i);
  });

  it('rejects a dedicated Spider Shot room that cannot contain the configured spawn envelope', () => {
    const shallowRoom: SceneConfig = {
      ...spiderShotRoom,
      proceduralRoom: { ...spiderShotRoom.proceduralRoom!, roomSize: [16, 8, 10] },
    };

    expect(() => loadDrill(spiderShotV3, shallowRoom)).toThrow(/delivery geometry.*room envelope/i);
  });

  // PR #10 review（Codex P2）:非 Vec3 waypoint 過去可通過 validateDrill,使 clearance envelope
  // 變 NaN 而「未檢查即放行」。現在必須在 schema 層拒載,不得回傳看似通過淨空驗證的 DrillConfig。
  it('waypoints 元素非 Vec3 → 帶 scene 載入時於 schema 層拒載，不得靜默通過 clearance', () => {
    const bad = {
      ...VALID,
      targets: { count: 10, distance: 4, motion: { type: 'waypoints', waypoints: [{ x: 1 }] } },
    };
    const cleanScene: SceneConfig = {
      sceneId: 'clean',
      assetPackVersion: 'test',
      clutterTier: 'low',
      asset: null,
      propBounds: [],
      playerCorridor: { halfWidthU: 0.5 },
    };
    expect(() => loadDrill(bad, cleanScene)).toThrow(/targets\.motion\.waypoints\[0\]\.y/);
  });
});
