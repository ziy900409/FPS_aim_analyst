import { describe, expect, it } from 'vitest';
import type { DrillConfig } from './DrillConfig.ts';
import { validateDrill } from './schema.ts';

/** 最小合法 config（僅必填欄位;選填省略）。 */
function minimalValid(): unknown {
  return {
    drillId: 'counterstrafe_ad_v1',
    targets: { count: 20, distance: 4 },
    sequence: { alternation: 'RL' },
    timing: { countdownMs: 3000 },
    endCondition: { type: 'targetCount', value: 20 },
  };
}

describe('validateDrill — 合法 config（FR-6.1）', () => {
  it('最小必填 config 通過並回傳收斂型別', () => {
    const cfg: DrillConfig = validateDrill(minimalValid());
    expect(cfg.drillId).toBe('counterstrafe_ad_v1');
    expect(cfg.targets.count).toBe(20);
    expect(cfg.targets.distance).toBe(4);
    expect(cfg.sequence.alternation).toBe('RL');
    expect(cfg.timing.countdownMs).toBe(3000);
    expect(cfg.endCondition).toEqual({ type: 'targetCount', value: 20 });
  });

  it('保留所有選填欄位（seed / spawnDelayMs / peekTimeoutMs / timeLimitMs / motion）', () => {
    const cfg = validateDrill({
      ...(minimalValid() as object),
      targets: { count: 30, distance: 4, motion: { type: 'pingpong', axis: 'horizontal', speed: 150, range: 120 } },
      sequence: { alternation: 'LR', seed: 42 },
      timing: { countdownMs: 3000, spawnDelayMs: 0, peekTimeoutMs: 1500, timeLimitMs: 60000 },
    });
    expect(cfg.sequence.seed).toBe(42);
    expect(cfg.timing.spawnDelayMs).toBe(0);
    expect(cfg.timing.peekTimeoutMs).toBe(1500);
    expect(cfg.timing.timeLimitMs).toBe(60000);
    expect(cfg.targets.motion).toEqual({ type: 'pingpong', axis: 'horizontal', speed: 150, range: 120 });
  });

  it('省略 motion → static（向後相容,F5 接縫）', () => {
    const cfg = validateDrill(minimalValid());
    expect(cfg.targets.motion).toBeUndefined();
  });

  it('waypoints 合法 Vec3 元素（含負/零偏移）通過並收斂為純 {x,y,z}', () => {
    const cfg = validateDrill({
      ...(minimalValid() as object),
      targets: {
        count: 20,
        distance: 4,
        motion: { type: 'waypoints', waypoints: [{ x: -1.5, y: 0, z: 2, extra: 'dropped' }] },
      },
    });
    expect(cfg.targets.motion?.waypoints).toEqual([{ x: -1.5, y: 0, z: 2 }]);
  });
});

describe('validateDrill — 驗證失敗 throw 帶欄位路徑（OQ-6.4）', () => {
  it('缺 drillId → throw 指名 drillId', () => {
    const bad = minimalValid() as Record<string, unknown>;
    delete bad.drillId;
    expect(() => validateDrill(bad)).toThrow(/drillId/);
  });

  it('負目標數 → throw 指名 targets.count', () => {
    const bad = { ...(minimalValid() as object), targets: { count: -5, distance: 4 } };
    expect(() => validateDrill(bad)).toThrow(/targets\.count/);
  });

  it('非整數目標數 → throw（正整數約束）', () => {
    const bad = { ...(minimalValid() as object), targets: { count: 2.5, distance: 4 } };
    expect(() => validateDrill(bad)).toThrow(/targets\.count/);
  });

  it('未知 alternation → throw 指名 sequence.alternation', () => {
    const bad = { ...(minimalValid() as object), sequence: { alternation: 'XY' } };
    expect(() => validateDrill(bad)).toThrow(/sequence\.alternation/);
  });

  it('未知 endCondition.type → throw', () => {
    const bad = { ...(minimalValid() as object), endCondition: { type: 'allHit', value: 20 } };
    expect(() => validateDrill(bad)).toThrow(/endCondition\.type/);
  });

  it('負 distance → throw 指名 targets.distance', () => {
    const bad = { ...(minimalValid() as object), targets: { count: 20, distance: -1 } };
    expect(() => validateDrill(bad)).toThrow(/targets\.distance/);
  });

  it('countdownMs 非數字 → throw', () => {
    const bad = { ...(minimalValid() as object), timing: { countdownMs: 'soon' } };
    expect(() => validateDrill(bad)).toThrow(/timing\.countdownMs/);
  });

  it('非物件輸入（null / 陣列 / 字串）→ throw root', () => {
    expect(() => validateDrill(null)).toThrow(/root/);
    expect(() => validateDrill([])).toThrow(/root/);
    expect(() => validateDrill('drill')).toThrow(/root/);
  });

  it('未知 motion.type → throw 指名 targets.motion.type', () => {
    const bad = { ...(minimalValid() as object), targets: { count: 20, distance: 4, motion: { type: 'orbit' } } };
    expect(() => validateDrill(bad)).toThrow(/targets\.motion\.type/);
  });

  // 非 Vec3 waypoint 元素若放行,clearance envelope 會變 NaN 而靜默跳過淨空檢查（PR #10 review）。
  it('waypoint 元素非物件 → throw 帶索引路徑', () => {
    const bad = {
      ...(minimalValid() as object),
      targets: { count: 20, distance: 4, motion: { type: 'waypoints', waypoints: [{ x: 0, y: 0, z: 0 }, 'north'] } },
    };
    expect(() => validateDrill(bad)).toThrow(/targets\.motion\.waypoints\[1\]/);
  });

  it('waypoint 元素缺座標欄位 → throw 指名 waypoints[i].y', () => {
    const bad = {
      ...(minimalValid() as object),
      targets: { count: 20, distance: 4, motion: { type: 'waypoints', waypoints: [{ x: 1, z: 2 }] } },
    };
    expect(() => validateDrill(bad)).toThrow(/targets\.motion\.waypoints\[0\]\.y/);
  });

  it('waypoint 座標非有限（NaN / Infinity）→ throw', () => {
    const nan = {
      ...(minimalValid() as object),
      targets: { count: 20, distance: 4, motion: { type: 'waypoints', waypoints: [{ x: NaN, y: 0, z: 0 }] } },
    };
    expect(() => validateDrill(nan)).toThrow(/targets\.motion\.waypoints\[0\]\.x/);
    const inf = {
      ...(minimalValid() as object),
      targets: { count: 20, distance: 4, motion: { type: 'waypoints', waypoints: [{ x: 0, y: Infinity, z: 0 }] } },
    };
    expect(() => validateDrill(inf)).toThrow(/targets\.motion\.waypoints\[0\]\.y/);
  });
});
