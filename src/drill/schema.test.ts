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

  it('保留所有選填欄位（seed / spawnArea / spawnDelayMsRange / spawnDelayMs / peekTimeoutMs / timeLimitMs / motion）', () => {
    const cfg = validateDrill({
      ...(minimalValid() as object),
      weaponId: 'm4a4',
      targets: {
        count: 30,
        distance: 4,
        hitbox: { widthU: 0.5, heightU: 1, depthU: 0.5 },
        spawnArea: { yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] },
        motion: { type: 'pingpong', axis: 'horizontal', speed: 150, range: 120 },
      },
      sequence: { alternation: 'LR', seed: 42, spawnDelayMsRange: [100, 350] },
      timing: { countdownMs: 3000, spawnDelayMs: 0, peekTimeoutMs: 1500, timeLimitMs: 60000, presentationMs: 2500 },
    });
    expect(cfg.weaponId).toBe('m4a4');
    expect(cfg.targets.hitbox).toEqual({ widthU: 0.5, heightU: 1, depthU: 0.5 });
    expect(cfg.targets.spawnArea).toEqual({ yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] });
    expect(cfg.sequence.seed).toBe(42);
    expect(cfg.sequence.spawnDelayMsRange).toEqual([100, 350]);
    expect(cfg.timing.spawnDelayMs).toBe(0);
    expect(cfg.timing.peekTimeoutMs).toBe(1500);
    expect(cfg.timing.timeLimitMs).toBe(60000);
    expect(cfg.timing.presentationMs).toBe(2500);
    expect(cfg.targets.motion).toEqual({ type: 'pingpong', axis: 'horizontal', speed: 150, range: 120 });
  });

  it('省略 motion → static（向後相容,F5 接縫）', () => {
    const cfg = validateDrill(minimalValid());
    expect(cfg.targets.motion).toBeUndefined();
  });

  it('省略 hitbox → 保持 undefined（呼叫端解析為預設 H1）', () => {
    const cfg = validateDrill(minimalValid());
    expect(cfg.targets.hitbox).toBeUndefined();
  });

  it('省略 weaponId → 保持 undefined（呼叫端使用預設武器）', () => {
    const cfg = validateDrill(minimalValid());
    expect(cfg.weaponId).toBeUndefined();
  });

  it('省略 mode → 保持 undefined（語意上為 practice,既有 drill 零回溯成本）', () => {
    const cfg = validateDrill(minimalValid());
    expect(cfg.mode).toBeUndefined();
  });

  it("mode='practice' 不要求 sequence.seed", () => {
    const cfg = validateDrill({ ...(minimalValid() as object), mode: 'practice' });
    expect(cfg.mode).toBe('practice');
    expect(cfg.sequence.seed).toBeUndefined();
  });

  it("mode='assessment' 有 sequence.seed 時通過", () => {
    const cfg = validateDrill({
      ...(minimalValid() as object),
      mode: 'assessment',
      sequence: { alternation: 'RL', seed: 20260819 },
    });
    expect(cfg.mode).toBe('assessment');
    expect(cfg.sequence.seed).toBe(20260819);
  });

  it("mode='assessment' accepts a self-contained spiderShot seed without sequence.seed", () => {
    const cfg = validateDrill({
      ...(minimalValid() as object),
      mode: 'assessment',
      spiderShot: {
        kind: 'center-peripheral',
        seed: 20260824,
        centerDistanceU: 4,
        peripheral: {
          angularRadiusDegRange: [10, 30],
          azimuthDegRange: [0, 360],
          distanceURange: [3.5, 4.5],
        },
      },
    });
    expect(cfg.sequence.seed).toBeUndefined();
    expect(cfg.spiderShot).toEqual({
      kind: 'center-peripheral',
      seed: 20260824,
      centerDistanceU: 4,
      peripheral: {
        angularRadiusDegRange: [10, 30],
        azimuthDegRange: [0, 360],
        distanceURange: [3.5, 4.5],
      },
    });
  });

  it('seeded spawn range 允許退化為固定值（min=max）', () => {
    const cfg = validateDrill({
      ...(minimalValid() as object),
      targets: { count: 20, distance: 4, spawnArea: { yawDegRange: [0, 0], distanceURange: [4, 4] } },
      sequence: { alternation: 'RL', seed: 7, spawnDelayMsRange: [0, 0] },
    });
    expect(cfg.targets.spawnArea).toEqual({ yawDegRange: [0, 0], distanceURange: [4, 4] });
    expect(cfg.sequence.spawnDelayMsRange).toEqual([0, 0]);
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

  it('未知 mode → throw 指名 mode', () => {
    const bad = { ...(minimalValid() as object), mode: 'calibration' };
    expect(() => validateDrill(bad)).toThrow(/mode/);
  });

  it("mode='assessment' 缺 sequence.seed → throw 指名 sequence.seed", () => {
    const bad = { ...(minimalValid() as object), mode: 'assessment' };
    expect(() => validateDrill(bad)).toThrow(/sequence\.seed/);
  });

  it('未知 endCondition.type → throw', () => {
    const bad = { ...(minimalValid() as object), endCondition: { type: 'allHit', value: 20 } };
    expect(() => validateDrill(bad)).toThrow(/endCondition\.type/);
  });

  it('負 distance → throw 指名 targets.distance', () => {
    const bad = { ...(minimalValid() as object), targets: { count: 20, distance: -1 } };
    expect(() => validateDrill(bad)).toThrow(/targets\.distance/);
  });

  it('hitbox 非正、非有限或超過 sanity 上限 → throw 指名 targets.hitbox 欄位', () => {
    expect(() =>
      validateDrill({
        ...(minimalValid() as object),
        targets: { count: 20, distance: 4, hitbox: { widthU: 0, heightU: 1, depthU: 0.5 } },
      }),
    ).toThrow(/targets\.hitbox\.widthU/);
    expect(() =>
      validateDrill({
        ...(minimalValid() as object),
        targets: { count: 20, distance: 4, hitbox: { widthU: 0.5, heightU: Infinity, depthU: 0.5 } },
      }),
    ).toThrow(/targets\.hitbox\.heightU/);
    expect(() =>
      validateDrill({
        ...(minimalValid() as object),
        targets: { count: 20, distance: 4, hitbox: { widthU: 0.5, heightU: 1, depthU: 10.1 } },
      }),
    ).toThrow(/targets\.hitbox\.depthU/);
  });

  it('countdownMs 非數字 → throw', () => {
    const bad = { ...(minimalValid() as object), timing: { countdownMs: 'soon' } };
    expect(() => validateDrill(bad)).toThrow(/timing\.countdownMs/);
  });

  it('presentationMs ≤ 0 / 非有限 → throw 指名 timing.presentationMs', () => {
    const zero = { ...(minimalValid() as object), timing: { countdownMs: 3000, presentationMs: 0 } };
    expect(() => validateDrill(zero)).toThrow(/timing\.presentationMs/);
    const neg = { ...(minimalValid() as object), timing: { countdownMs: 3000, presentationMs: -100 } };
    expect(() => validateDrill(neg)).toThrow(/timing\.presentationMs/);
    const str = { ...(minimalValid() as object), timing: { countdownMs: 3000, presentationMs: 'long' } };
    expect(() => validateDrill(str)).toThrow(/timing\.presentationMs/);
  });

  it('trackingStopMs ≤ 0 / 非有限，或與 presentationMs 併用 → throw 指名 timing', () => {
    expect(validateDrill({ ...(minimalValid() as object), timing: { countdownMs: 3000, trackingStopMs: 2500 } }).timing.trackingStopMs).toBe(
      2500,
    );
    expect(() => validateDrill({ ...(minimalValid() as object), timing: { countdownMs: 3000, trackingStopMs: 0 } })).toThrow(
      /timing\.trackingStopMs/,
    );
    expect(() => validateDrill({ ...(minimalValid() as object), timing: { countdownMs: 3000, trackingStopMs: 'soon' } })).toThrow(
      /timing\.trackingStopMs/,
    );
    expect(() =>
      validateDrill({ ...(minimalValid() as object), timing: { countdownMs: 3000, presentationMs: 1000, trackingStopMs: 2000 } }),
    ).toThrow(/timing/);
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

  it('weaponId 非字串或空字串 → throw 指名 weaponId', () => {
    expect(() => validateDrill({ ...(minimalValid() as object), weaponId: '' })).toThrow(/weaponId/);
    expect(() => validateDrill({ ...(minimalValid() as object), weaponId: 47 })).toThrow(/weaponId/);
  });

  it('spawnArea 缺 sequence.seed → throw 指名 targets.spawnArea', () => {
    const bad = {
      ...(minimalValid() as object),
      targets: { count: 20, distance: 4, spawnArea: { yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] } },
    };
    expect(() => validateDrill(bad)).toThrow(/targets\.spawnArea/);
  });

  it('spawnDelayMsRange 缺 sequence.seed → throw 指名 sequence.spawnDelayMsRange', () => {
    const bad = {
      ...(minimalValid() as object),
      sequence: { alternation: 'RL', spawnDelayMsRange: [100, 350] },
    };
    expect(() => validateDrill(bad)).toThrow(/sequence\.spawnDelayMsRange/);
  });

  it('spawnArea range 形狀、順序與正距離錯誤 → throw field path', () => {
    expect(() =>
      validateDrill({
        ...(minimalValid() as object),
        targets: { count: 20, distance: 4, spawnArea: { yawDegRange: [25, -25], distanceURange: [3.2, 4.4] } },
        sequence: { alternation: 'RL', seed: 7 },
      }),
    ).toThrow(/targets\.spawnArea\.yawDegRange/);

    expect(() =>
      validateDrill({
        ...(minimalValid() as object),
        targets: { count: 20, distance: 4, spawnArea: { yawDegRange: [-25, 25], distanceURange: [0, 4.4] } },
        sequence: { alternation: 'RL', seed: 7 },
      }),
    ).toThrow(/targets\.spawnArea\.distanceURange/);
  });

  it('spawnDelayMsRange 非二元非負遞增 range → throw field path', () => {
    expect(() =>
      validateDrill({
        ...(minimalValid() as object),
        sequence: { alternation: 'RL', seed: 7, spawnDelayMsRange: [100] },
      }),
    ).toThrow(/sequence\.spawnDelayMsRange/);

    expect(() =>
      validateDrill({
        ...(minimalValid() as object),
        sequence: { alternation: 'RL', seed: 7, spawnDelayMsRange: [-1, 100] },
      }),
    ).toThrow(/sequence\.spawnDelayMsRange/);
  });

  it('spiderShot validates its geometry and rejects legacy seeded-spawn settings', () => {
    const spiderShot = {
      kind: 'center-peripheral',
      seed: 7,
      centerDistanceU: 4,
      peripheral: {
        angularRadiusDegRange: [10, 30],
        azimuthDegRange: [0, 360],
        distanceURange: [3.5, 4.5],
      },
    };
    expect(() =>
      validateDrill({ ...(minimalValid() as object), spiderShot: { ...spiderShot, kind: 'orbit' } }),
    ).toThrow(/spiderShot\.kind/);
    expect(() =>
      validateDrill({
        ...(minimalValid() as object),
        spiderShot: { ...spiderShot, peripheral: { ...spiderShot.peripheral, angularRadiusDegRange: [0, 30] } },
      }),
    ).toThrow(/spiderShot\.peripheral\.angularRadiusDegRange/);
    expect(() =>
      validateDrill({
        ...(minimalValid() as object),
        spiderShot: { ...spiderShot, peripheral: { ...spiderShot.peripheral, azimuthDegRange: [0, 361] } },
      }),
    ).toThrow(/spiderShot\.peripheral\.azimuthDegRange/);
    expect(() =>
      validateDrill({
        ...(minimalValid() as object),
        spiderShot: { ...spiderShot, peripheral: { ...spiderShot.peripheral, distanceURange: [0, 4.5] } },
      }),
    ).toThrow(/spiderShot\.peripheral\.distanceURange/);
    expect(() =>
      validateDrill({
        ...(minimalValid() as object),
        targets: { count: 20, distance: 4, spawnArea: { yawDegRange: [0, 0], distanceURange: [4, 4] } },
        sequence: { alternation: 'RL', seed: 1 },
        spiderShot,
      }),
    ).toThrow(/targets\.spawnArea/);
    expect(() =>
      validateDrill({ ...(minimalValid() as object), sequence: { alternation: 'RL', seed: 1 }, spiderShot }),
    ).toThrow(/sequence\.seed/);
    expect(() =>
      validateDrill({
        ...(minimalValid() as object),
        sequence: { alternation: 'RL', spawnDelayMsRange: [1, 2] },
        spiderShot,
      }),
    ).toThrow(/sequence\.spawnDelayMsRange/);
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
