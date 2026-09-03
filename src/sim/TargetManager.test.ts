import { describe, expect, it } from 'vitest';
import type { Clock } from '../loop/clock.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { createSimLoop } from '../loop/SimLoop.ts';
import { simStep } from '../loop/SimLoop.ts';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { createSharedState } from '../state/SharedState.ts';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { createTargetManager } from './TargetManager.ts';
import {
  createTrackingTrajectory,
  projectTrackingAngles,
  type TrackingTrajectoryConfig,
  type TrackingTrajectorySample,
} from './trackingTrajectory.ts';

const TICK_MS = 1000 / SIM_HZ; // 7.8125

/** 固定基準的注入式 sim clock（與 SimLoop 測試同型）。 */
function fixedClock(t: number): Clock {
  return { now: () => t };
}

describe('TargetManager — 可見性 + t_visible 在 sim tick 內蓋戳（FR-4.2）', () => {
  it('tick：無存活目標時 spawn 一個（spawn 即可見，OQ-4.2）', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 100);

    expect(state.targets).toHaveLength(1);
    expect(state.targets[0].visible).toBe(true);
    expect(state.targets[0].alive).toBe(true);
    // hitbox 與 mesh 同來源（box）。
    expect(state.targets[0].hitbox).toEqual({ width: 1, height: 2, depth: 1, shape: 'box' });
  });

  it('tick：每次 spawn 以當前 weapon.magSize 回滿 ammo（OQ-11.2）', () => {
    const state = createSharedState();
    const tm = createTargetManager();
    state.weapon.magSize = 20;
    state.weapon.ammo = 0;

    tm.tick(state, 100);
    expect(state.weapon.ammo).toBe(20);

    tm.markKilled(state, state.targets[0].id);
    state.weapon.ammo = 3;
    tm.tick(state, 200);
    expect(state.weapon.ammo).toBe(20);
  });

  it('可見轉換 tick 蓋 t_visible = nowMs', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 42.5);

    const id = state.targets[0].id;
    expect(state.tVisible.get(id)).toBe(42.5);
  });

  it('t_visible 只蓋一次：後續 tick 不覆寫、不重複 spawn', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 100);
    const id = state.targets[0].id;
    tm.tick(state, 200); // 仍可見、已蓋過
    tm.tick(state, 300);

    expect(state.tVisible.get(id)).toBe(100); // 維持首次值，未被覆寫
    expect(state.tVisible.size).toBe(1);
    expect(state.targets).toHaveLength(1); // 未重複 spawn
  });

  it('時間源為注入 sim clock（非 Date.now/rAF）：t_visible = sim tick 邏輯時間', () => {
    const state = createSharedState();
    const tm = createTargetManager();
    // 注入 baseline=1000 的 sim clock；跑一個 tick → simTimeMs = 1000 + TICK_MS。
    const loop = createSimLoop(state, fixedClock(1000), SIM_HZ, tm);

    loop.pump(1000 + TICK_MS);

    const id = state.targets[0].id;
    const stamped = state.tVisible.get(id)!;
    // 值落在注入 sim clock 域（~1007.8），而非 Date.now()（~1.7e12）或 rAF frame 時間。
    expect(stamped).toBeCloseTo(1000 + TICK_MS, 10);
    expect(stamped).toBeLessThan(1e6); // 明確排除 Date.now 域
  });

  it('markKilled：撤除目標並清 t_visible；下一 tick 補生新目標', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 100);
    const first = state.targets[0].id;
    tm.markKilled(state, first);

    expect(state.targets).toHaveLength(0);
    expect(state.tVisible.has(first)).toBe(false);

    tm.tick(state, 200); // 無存活目標 → 補生
    expect(state.targets).toHaveLength(1);
    expect(state.targets[0].id).not.toBe(first); // 新 id
    expect(state.tVisible.get(state.targets[0].id)).toBe(200);
  });

  it('reset：清空目標與 tVisible；seq 首字定首個 spawn 側', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 100); // 預設 spawn 'R'
    expect(state.targets[0].side).toBe('R');

    tm.reset(state, 'LR');
    expect(state.targets).toHaveLength(0);
    expect(state.tVisible.size).toBe(0);

    tm.tick(state, 200);
    expect(state.targets[0].side).toBe('L'); // seq 'LR' → 首側 'L'
  });
});

describe('TargetManager — hold-track target_stop（WP-35 / T1）', () => {
  it('到期同 tick 解鎖並記 tStop，且之後原地凍結但維持可見存活', () => {
    const state = createSharedState();
    const cfg: DrillConfig = {
      drillId: 'hold-track-test',
      targets: { count: 1, distance: 4, motion: { type: 'pingpong', axis: 'horizontal', speed: 128, range: 100 } },
      sequence: { alternation: 'RL' },
      timing: { countdownMs: 0, trackingStopMs: TICK_MS * 2 },
      endCondition: { type: 'targetCount', value: 1 },
    };
    const tm = createTargetManager(cfg);

    tm.tick(state, TICK_MS);
    const target = state.targets[0];
    const positionBeforeStop = { ...target.pos };
    expect(target.age).toBeCloseTo(1 / SIM_HZ, 12);
    expect(target.fireLocked).toBe(true);
    expect(state.tStop.has(target.id)).toBe(false);

    tm.tick(state, TICK_MS * 2);
    expect(target.fireLocked).toBe(false);
    expect(state.tStop.get(target.id)).toBe(TICK_MS * 2);
    expect(target.pos).toEqual(positionBeforeStop);
    expect(target.visible).toBe(true);
    expect(target.alive).toBe(true);

    tm.tick(state, TICK_MS * 3);
    expect(target.pos).toEqual(positionBeforeStop);
    expect(state.tStop.get(target.id)).toBe(TICK_MS * 2);
  });

  it('markKilled 與 reset 會清除 tStop', () => {
    const state = createSharedState();
    const tm = createTargetManager();
    tm.tick(state, 100);
    const id = state.targets[0].id;
    state.tStop.set(id, 100);

    tm.markKilled(state, id);
    expect(state.tStop.has(id)).toBe(false);

    state.tStop.set('stale', 200);
    tm.reset(state);
    expect(state.tStop.size).toBe(0);
  });
});

describe('TargetManager — counter-strafe single cue (WP-37 / T1)', () => {
  const cueConfig: DrillConfig = {
    drillId: 'counterstrafe-cued-test',
    mode: 'assessment',
    cue: { kind: 'single' },
    targets: { count: 2, distance: 4 },
    sequence: { alternation: 'LR', seed: 37, spawnDelayMsRange: [100, 100] },
    timing: { countdownMs: 0 },
    endCondition: { type: 'targetCount', value: 2 },
  };

  it('issues each cue at foreperiod start with the side-matched A/D direction', () => {
    const state = createSharedState();
    const tm = createTargetManager(cueConfig);

    tm.tick(state, 100);
    expect(state.targets).toEqual([]);
    expect(state.cues).toEqual([{ t: 100, direction: 'A' }]);

    tm.tick(state, 200);
    expect(state.targets[0].side).toBe('L');
    expect(state.tVisible.get(state.targets[0].id)).toBe(200);

    tm.markKilled(state, state.targets[0].id);
    tm.tick(state, 300);
    expect(state.cues).toEqual([{ t: 100, direction: 'A' }, { t: 300, direction: 'D' }]);
  });

  it('exports cue before its visible event through the standard SimLoop recorder handshake', () => {
    const state = createSharedState();
    const recorder = createDataRecorder();
    const tm = createTargetManager(cueConfig);

    simStep(state, 1 / SIM_HZ, 100, tm, undefined, undefined, undefined, undefined, recorder);
    simStep(state, 1 / SIM_HZ, 200, tm, undefined, undefined, undefined, undefined, recorder);

    expect(recorder.snapshot().events).toEqual([
      { type: 'cue', t: 100, direction: 'A' },
      expect.objectContaining({ type: 'visible', side: 'L', t: 200 }),
    ]);
    expect(state.cues).toEqual([]);
  });
});

describe('TargetManager — 左右交替序列（FR-4.3）', () => {
  /** 驅動一輪「擊殺 → 下一 tick 生成對側」;回傳每次 spawn 的 side（依序）。 */
  function killSequence(seq: 'LR' | 'RL', rounds: number): Array<'L' | 'R'> {
    const state = createSharedState();
    const tm = createTargetManager();
    tm.reset(state, seq);
    const sides: Array<'L' | 'R'> = [];
    let now = 100;
    for (let i = 0; i < rounds; i++) {
      tm.tick(state, now); // 無存活目標 → spawn
      sides.push(state.targets[0].side);
      tm.markKilled(state, state.targets[0].id); // 擊殺 → 翻面
      now += 100;
    }
    return sides;
  }

  it('連續 markKilled → side 嚴格交替（R→L→R→L…）', () => {
    expect(killSequence('RL', 5)).toEqual(['R', 'L', 'R', 'L', 'R']);
  });

  it('首側由 reset(seq) 決定，之後嚴格交替（L→R→L…）', () => {
    expect(killSequence('LR', 4)).toEqual(['L', 'R', 'L', 'R']);
  });

  it('每次生成對側目標蓋一枚新 t_visible（不同 id、新戳值）', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 100);
    const first = state.targets[0];
    expect(state.tVisible.get(first.id)).toBe(100);

    tm.markKilled(state, first.id);
    expect(state.tVisible.has(first.id)).toBe(false); // 舊戳清掉

    tm.tick(state, 250); // 生成對側
    const second = state.targets[0];
    expect(second.id).not.toBe(first.id); // 新 id
    expect(second.side).not.toBe(first.side); // 對側
    expect(state.tVisible.get(second.id)).toBe(250); // 新 t_visible
    expect(state.tVisible.size).toBe(1); // 一次只一枚（單 active 目標）
  });

  it('決定性：相同 seq 重跑產生完全相同的 side 序列', () => {
    expect(killSequence('RL', 6)).toEqual(killSequence('RL', 6));
    expect(killSequence('LR', 6)).toEqual(killSequence('LR', 6));
  });

  it('擊殺不存在的 id 不推進序列（不翻面）', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 100); // spawn 'R'
    expect(state.targets[0].side).toBe('R');

    tm.markKilled(state, 'nonexistent'); // 無效擊殺
    tm.markKilled(state, state.targets[0].id); // 真擊殺 → 翻面

    tm.tick(state, 200);
    expect(state.targets[0].side).toBe('L'); // 只翻一次 → 對側
  });
});

describe('TargetManager — config 驅動（WP-6 / T2，FR-6.2；換 config 即換 drill）', () => {
  /** 構造合法 DrillConfig（欄位形狀對齊 DrillConfig）。 */
  function config(over: {
    count: number;
    alternation: 'LR' | 'RL';
    distance?: number;
    seed?: number;
    hitbox?: DrillConfig['targets']['hitbox'];
    spawnArea?: DrillConfig['targets']['spawnArea'];
    spawnDelayMsRange?: [number, number];
  }): DrillConfig {
    return {
      drillId: 'test',
      targets: {
        count: over.count,
        distance: over.distance ?? 4,
        ...(over.hitbox !== undefined ? { hitbox: over.hitbox } : {}),
        ...(over.spawnArea !== undefined ? { spawnArea: over.spawnArea } : {}),
      },
      sequence: {
        alternation: over.alternation,
        ...(over.seed !== undefined ? { seed: over.seed } : {}),
        ...(over.spawnDelayMsRange !== undefined ? { spawnDelayMsRange: over.spawnDelayMsRange } : {}),
      },
      timing: { countdownMs: 0 },
      endCondition: { type: 'targetCount', value: over.count },
    };
  }

  /** 跑完整 drill（kill→補生），回傳每次 spawn 的 side 依序;達 spawn 上限即停。 */
  function runDrill(cfg: DrillConfig): Array<'L' | 'R'> {
    const state = createSharedState();
    const tm = createTargetManager(cfg);
    const sides: Array<'L' | 'R'> = [];
    let now = 100;
    for (let guard = 0; guard < 1000; guard++) {
      tm.tick(state, now);
      if (state.targets.length === 0) break; // spawn 上限達標、序列耗盡
      sides.push(state.targets[0].side);
      tm.markKilled(state, state.targets[0].id);
      now += 100;
    }
    return sides;
  }

  it('distance 來自 config：目標 z = -config.targets.distance（非引擎預設）', () => {
    const state = createSharedState();
    const tm = createTargetManager(config({ count: 5, alternation: 'RL', distance: 7 }));
    tm.tick(state, 100);
    expect(state.targets[0].pos.z).toBe(-7);
  });

  it('hitbox 來自 config：小目標尺寸寫入 TargetState，省略時維持預設 H1', () => {
    const small = createSharedState();
    createTargetManager(
      config({ count: 1, alternation: 'RL', hitbox: { widthU: 0.5, heightU: 1, depthU: 0.5 } }),
    ).tick(small, 100);
    expect(small.targets[0].hitbox).toEqual({ width: 0.5, height: 1, depth: 0.5, shape: 'box' });

    const omitted = createSharedState();
    createTargetManager(config({ count: 1, alternation: 'RL' })).tick(omitted, 100);
    expect(omitted.targets[0].hitbox).toEqual({ width: 1, height: 2, depth: 1, shape: 'box' });
  });

  it('首側來自 sequence.alternation 首字（LR→L、RL→R）', () => {
    const stateL = createSharedState();
    createTargetManager(config({ count: 5, alternation: 'LR' })).tick(stateL, 100);
    expect(stateL.targets[0].side).toBe('L');

    const stateR = createSharedState();
    createTargetManager(config({ count: 5, alternation: 'RL' })).tick(stateR, 100);
    expect(stateR.targets[0].side).toBe('R');
  });

  it('spawn 上限 = targets.count：達標後 tick 不再補生', () => {
    const cfg = config({ count: 3, alternation: 'RL' });
    const state = createSharedState();
    const tm = createTargetManager(cfg);

    // 擊殺 3 個。
    for (let i = 0; i < 3; i++) {
      tm.tick(state, 100 + i * 100);
      tm.markKilled(state, state.targets[0].id);
    }
    // 第 4 次 tick：已達上限 → 不補生。
    tm.tick(state, 500);
    expect(state.targets).toHaveLength(0);
  });

  it('換 config 即換 drill（零引擎改動）：不同 count/alternation → 不同序列，同一 createTargetManager', () => {
    const a = runDrill(config({ count: 2, alternation: 'LR' }));
    const b = runDrill(config({ count: 4, alternation: 'RL' }));

    expect(a).toEqual(['L', 'R']); //           count=2、首側 L
    expect(b).toEqual(['R', 'L', 'R', 'L']); // count=4、首側 R
    expect(a).not.toEqual(b); //                純由 config 差異驅動,無 .ts 改動
  });

  it('決定性：相同 config 重跑產生完全相同的序列', () => {
    const cfg = config({ count: 6, alternation: 'RL' });
    expect(runDrill(cfg)).toEqual(runDrill(cfg));
  });

  it('reset 省略 seq 時退回 config 首側，並歸零 spawn 計數（可重跑滿額）', () => {
    const cfg = config({ count: 2, alternation: 'LR' });
    const state = createSharedState();
    const tm = createTargetManager(cfg);

    // 第一輪跑滿 2 個。
    tm.tick(state, 100);
    tm.markKilled(state, state.targets[0].id);
    tm.tick(state, 200);
    tm.markKilled(state, state.targets[0].id);
    tm.tick(state, 300);
    expect(state.targets).toHaveLength(0); // 已達上限

    // reset（省略 seq）→ 計數歸零、首側回 config 'L'。
    tm.reset(state);
    tm.tick(state, 400);
    expect(state.targets[0].side).toBe('L'); // config 首側
    expect(state.targets).toHaveLength(1); // 可再補生（計數已歸零）
  });

  it('config.targets.motion 提供時寫入目標（F5 接縫，複製非共用參考）', () => {
    const cfg: DrillConfig = {
      ...config({ count: 1, alternation: 'RL' }),
      targets: { count: 1, distance: 4, motion: { type: 'linear', speed: 2 } },
    };
    const state = createSharedState();
    createTargetManager(cfg).tick(state, 100);
    expect(state.targets[0].motion).toEqual({ type: 'linear', speed: 2 });
    expect(state.targets[0].motion).not.toBe(cfg.targets.motion); // 複製,不共用參考
  });

  it('seed-only config 維持既有 L/R slot 位置（counterstrafe_ad_v1 零破壞）', () => {
    const state = createSharedState();
    createTargetManager(config({ count: 1, alternation: 'LR', seed: 1 })).tick(state, 100);

    expect(state.targets[0].side).toBe('L');
    expect(state.targets[0].pos).toEqual({ x: -2, y: 1.5, z: -4 });
  });
});

describe('TargetManager — 移動目標 motion drive（WP-18 / T1，FR-B17 前置）', () => {
  const TICK_SEC = 1 / SIM_HZ; // 每 tick age 累加步長（1/128 = 0.0078125，逐位可表示）

  /** 帶 motion 的 config（count=1、首側由 alternation 定；非 seeded → 立即 spawn）。 */
  function motionConfig(motion: DrillConfig['targets']['motion'], alternation: 'LR' | 'RL' = 'RL'): DrillConfig {
    return {
      drillId: 'motion-test',
      targets: { count: 1, distance: 4, ...(motion !== undefined ? { motion } : {}) },
      sequence: { alternation },
      timing: { countdownMs: 0 },
      endCondition: { type: 'targetCount', value: 1 },
    };
  }

  it('spawn 時 age=0，之後每 tick 累加 TICK_SEC', () => {
    const state = createSharedState();
    const tm = createTargetManager(motionConfig({ type: 'linear', speed: 2 }));

    tm.tick(state, 100); // spawn（age 起算 0）+ 首個 drive tick → age = 1·TICK_SEC
    expect(state.targets[0].age).toBe(TICK_SEC);

    tm.tick(state, 200);
    tm.tick(state, 300);
    expect(state.targets[0].age).toBe(3 * TICK_SEC);
  });

  it('static motion：pos 逐位不變（多 tick 後仍等於 spawn 位置）', () => {
    const state = createSharedState();
    const tm = createTargetManager(motionConfig({ type: 'static' }, 'RL'));

    tm.tick(state, 100);
    const spawnPos = { ...state.targets[0].pos }; // R 側 slot：{x:2,y:1.5,z:-4}
    for (let i = 0; i < 50; i++) tm.tick(state, 200 + i * 100);

    expect(state.targets[0].pos).toEqual(spawnPos);
    expect(state.targets[0].pos).toEqual({ x: 2, y: 1.5, z: -4 });
  });

  it('無 motion（既有 counter-strafe drill）：pos 逐位不變', () => {
    const state = createSharedState();
    const tm = createTargetManager(motionConfig(undefined, 'RL'));

    tm.tick(state, 100);
    for (let i = 0; i < 50; i++) tm.tick(state, 200 + i * 100);

    expect(state.targets[0].pos).toEqual({ x: 2, y: 1.5, z: -4 });
  });

  it('linear：pos 沿 axis 等速位移（128 tick = 1s，逐位 golden）', () => {
    const state = createSharedState();
    const tm = createTargetManager(motionConfig({ type: 'linear', speed: 2, axis: 'horizontal' }, 'RL'));

    // spawn 於首 tick；再跑到累計 128 tick（age=1s）。offset.x = speed·age = 2 → pos.x = 2(slot)+2 = 4。
    for (let i = 0; i < 128; i++) tm.tick(state, 100 + i);
    expect(state.targets[0].age).toBe(1);
    expect(state.targets[0].pos.x).toBe(4); // 2/128 每 tick（exact binary）× 128 = 2.0 位移
    expect(state.targets[0].pos.y).toBe(1.5); // horizontal → y/z 不動
    expect(state.targets[0].pos.z).toBe(-4);
  });

  it('linear vertical：位移落在 y、x/z 不動', () => {
    const state = createSharedState();
    const tm = createTargetManager(motionConfig({ type: 'linear', speed: 2, axis: 'vertical' }, 'RL'));

    for (let i = 0; i < 128; i++) tm.tick(state, 100 + i);
    expect(state.targets[0].pos.x).toBe(2); // slot x 不動
    expect(state.targets[0].pos.y).toBe(1.5 + 2); // 1.5 + speed·age
    expect(state.targets[0].pos.z).toBe(-4);
  });

  it('pingpong：在 spawn 原點 ±range 往返（peak 與回原點 golden）', () => {
    const state = createSharedState();
    const tm = createTargetManager(motionConfig({ type: 'pingpong', speed: 2, range: 1 }, 'RL'));

    for (let i = 0; i < 64; i++) tm.tick(state, 100 + i); // age=0.5s → +range 峰
    expect(state.targets[0].pos.x).toBe(3); // slot 2 + range 1

    for (let i = 0; i < 64; i++) tm.tick(state, 200 + i); // age=1s → 回原點
    expect(state.targets[0].pos.x).toBe(2);
  });

  it('sine：在 spawn 原點 ±range 擺盪（峰值 golden，浮點容差）', () => {
    const state = createSharedState();
    const tm = createTargetManager(motionConfig({ type: 'sine', speed: Math.PI, range: 1 }, 'RL'));

    for (let i = 0; i < 64; i++) tm.tick(state, 100 + i); // age=0.5s → sin(π/2)=+range 峰
    expect(state.targets[0].pos.x).toBeCloseTo(3, 10); // slot 2 + range 1
  });

  it('決定性：相同 tick 數、不同 nowMs 序列（frame 切法）→ per-tick pos 逐位一致', () => {
    // motion drive 以 TICK_SEC 常數累加 age，與 nowMs（frame 時間）解耦——pos 只依 tick 數。
    function runPositions(nowSeq: number[]): Array<{ x: number; y: number; z: number }> {
      const state = createSharedState();
      const tm = createTargetManager(motionConfig({ type: 'pingpong', speed: 3, range: 1.2 }, 'RL'));
      const trail: Array<{ x: number; y: number; z: number }> = [];
      for (const now of nowSeq) {
        tm.tick(state, now);
        trail.push({ ...state.targets[0].pos });
      }
      return trail;
    }

    const ticks = 200;
    // A：規律 frame 間距；B：不規律（大小幀交錯）——同 tick 數,不同 nowMs。
    const seqA = Array.from({ length: ticks }, (_, i) => 1000 + i * 8);
    const seqB = Array.from({ length: ticks }, (_, i) => 1000 + i * i * 0.37 + (i % 3) * 5);

    expect(runPositions(seqA)).toEqual(runPositions(seqB));
  });

  it('config.motion 複製非共用參考時，pos 更新不回寫 config', () => {
    const cfg = motionConfig({ type: 'linear', speed: 2 }, 'RL');
    const state = createSharedState();
    const tm = createTargetManager(cfg);
    tm.tick(state, 100);
    tm.tick(state, 200);
    // 目標 pos 已移動,但 config 的 motion 定義（無 pos 概念）不受污染,drill 可重跑一致。
    expect(cfg.targets.motion).toEqual({ type: 'linear', speed: 2 });
    expect(state.targets[0].pos.x).not.toBe(2); // 已離開 slot
  });
});

describe('TargetManager — WP-21 seeded spawn（FR-C10）', () => {
  const SPAWN_AREA = { yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] } satisfies NonNullable<
    DrillConfig['targets']['spawnArea']
  >;

  function config(seed: number, count = 5, spawnDelayMsRange: [number, number] = [0, 0]): DrillConfig {
    return {
      drillId: 'seeded-test',
      targets: { count, distance: 4, spawnArea: SPAWN_AREA },
      sequence: { alternation: 'LR', seed, spawnDelayMsRange },
      timing: { countdownMs: 0 },
      endCondition: { type: 'targetCount', value: count },
    };
  }

  function collectImmediateSpawns(cfg: DrillConfig): Array<{ side: 'L' | 'R'; x: number; y: number; z: number }> {
    const state = createSharedState();
    const tm = createTargetManager(cfg);
    const samples: Array<{ side: 'L' | 'R'; x: number; y: number; z: number }> = [];
    for (let i = 0; i < cfg.targets.count; i++) {
      tm.tick(state, 100 + i * 100);
      const target = state.targets[0];
      samples.push({ side: target.side, x: target.pos.x, y: target.pos.y, z: target.pos.z });
      tm.markKilled(state, target.id);
    }
    return samples;
  }

  it('同 seed reset 後重跑產生完全相同的 spawn 位置序列', () => {
    const cfg = config(77, 4);
    const state = createSharedState();
    const tm = createTargetManager(cfg);

    function run(): Array<{ side: 'L' | 'R'; x: number; y: number; z: number }> {
      const samples: Array<{ side: 'L' | 'R'; x: number; y: number; z: number }> = [];
      for (let i = 0; i < cfg.targets.count; i++) {
        tm.tick(state, 100 + i * 100);
        const target = state.targets[0];
        samples.push({ side: target.side, x: target.pos.x, y: target.pos.y, z: target.pos.z });
        tm.markKilled(state, target.id);
      }
      return samples;
    }

    const first = run();
    tm.reset(state);
    expect(run()).toEqual(first);
  });

  it('不同 seed 產生不同 spawn 位置序列（sanity）', () => {
    expect(collectImmediateSpawns(config(77, 4))).not.toEqual(collectImmediateSpawns(config(78, 4)));
  });

  it('取樣次序鎖定：delay → yaw → distance（seed=12345 前五個 spawn golden）', () => {
    const state = createSharedState();
    const tm = createTargetManager(config(12345, 5, [100, 200]));
    const expected = [
      { t: 1192.3120571730249, side: 'L', x: -0.4987525503090686, z: -3.401090868918761 },
      { t: 1387.2542292751623, side: 'R', x: 1.0738688519024253, z: -4.24699909359848 },
      { t: 1578.6672345728925, side: 'R', x: 0.25058957781529, z: -3.441850672924976 },
      { t: 1696.4455222228753, side: 'R', x: 1.48768974307174, z: -3.7683740784973336 },
      { t: 1799.8563998843806, side: 'L', x: -0.47634821560472135, z: -3.7846125290323904 },
    ] as const;

    let now = 1000;
    for (const sample of expected) {
      tm.tick(state, now); // schedules this trial's seeded delay; no target until due.
      expect(state.targets).toHaveLength(0);
      tm.tick(state, sample.t - 1e-6);
      expect(state.targets).toHaveLength(0);

      tm.tick(state, sample.t);
      const target = state.targets[0];
      expect(target.side).toBe(sample.side);
      expect(target.pos.x).toBeCloseTo(sample.x, 12);
      expect(target.pos.y).toBe(1.5);
      expect(target.pos.z).toBeCloseTo(sample.z, 12);
      expect(state.tVisible.get(target.id)).toBeCloseTo(sample.t, 10);

      tm.markKilled(state, target.id);
      now = sample.t;
    }
  });
});

describe('TargetManager — WP-36 spider-shot center/peripheral schedule', () => {
  function spiderConfig(
    seed: number,
    peripheral: NonNullable<DrillConfig['spiderShot']>['peripheral'] = {
      angularRadiusDegRange: [10, 30],
      azimuthDegRange: [0, 360],
      distanceURange: [3.5, 4.5],
    },
  ): DrillConfig {
    return {
      drillId: 'spider-shot-test',
      targets: { count: 6, distance: 4 },
      sequence: { alternation: 'LR' },
      spiderShot: { kind: 'center-peripheral', seed, centerDistanceU: 4, peripheral },
      timing: { countdownMs: 0 },
      endCondition: { type: 'targetCount', value: 6 },
    };
  }

  function collectSequence(cfg: DrillConfig): Array<{ zone: 'center' | 'peripheral'; x: number; y: number; z: number }> {
    const state = createSharedState();
    const tm = createTargetManager(cfg);
    const sequence: Array<{ zone: 'center' | 'peripheral'; x: number; y: number; z: number }> = [];
    for (let i = 0; i < cfg.targets.count; i++) {
      tm.tick(state, 100 + i * 100);
      const target = state.targets[0];
      sequence.push({ zone: target.zone!, x: target.pos.x, y: target.pos.y, z: target.pos.z });
      tm.markKilled(state, target.id);
    }
    return sequence;
  }

  it('alternates center → peripheral → center while keeping only one active target', () => {
    const state = createSharedState();
    const tm = createTargetManager(spiderConfig(77));

    tm.tick(state, 100);
    expect(state.targets).toHaveLength(1);
    expect(state.targets[0]).toMatchObject({ zone: 'center', pos: { x: 0, y: 1.5, z: -4 } });
    tm.markKilled(state, state.targets[0].id);

    tm.tick(state, 200);
    expect(state.targets).toHaveLength(1);
    expect(state.targets[0].zone).toBe('peripheral');
    tm.markKilled(state, state.targets[0].id);

    tm.tick(state, 300);
    expect(state.targets).toHaveLength(1);
    expect(state.targets[0]).toMatchObject({ zone: 'center', pos: { x: 0, y: 1.5, z: -4 } });
  });

  it('replays the same peripheral sequence after reset, while a different seed changes it', () => {
    const cfg = spiderConfig(77);
    const state = createSharedState();
    const tm = createTargetManager(cfg);
    const run = (): Array<{ zone: 'center' | 'peripheral'; x: number; y: number; z: number }> => {
      const sequence: Array<{ zone: 'center' | 'peripheral'; x: number; y: number; z: number }> = [];
      for (let i = 0; i < cfg.targets.count; i++) {
        tm.tick(state, 100 + i * 100);
        const target = state.targets[0];
        sequence.push({ zone: target.zone!, x: target.pos.x, y: target.pos.y, z: target.pos.z });
        tm.markKilled(state, target.id);
      }
      return sequence;
    };

    const first = run();
    tm.reset(state);
    expect(run()).toEqual(first);
    expect(collectSequence(spiderConfig(78))).not.toEqual(first);
  });

  it('maps four cardinal azimuths and two diagonals to independently calculated world coordinates', () => {
    const expected = [
      { azimuthDeg: 0, x: 0, y: 7.490633420552356, z: 2.8089875327071336 },
      { azimuthDeg: 90, x: 8, y: 0, z: 0 },
      { azimuthDeg: 180, x: 0, y: -7.490633420552356, z: -2.8089875327071336 },
      { azimuthDeg: 270, x: -8, y: 0, z: 0 },
      { azimuthDeg: 45, x: 5.65685424949238, y: 5.296677687055156, z: 1.9862541326456833 },
      { azimuthDeg: 225, x: -5.65685424949238, y: -5.296677687055156, z: -1.9862541326456833 },
    ] as const;

    for (const sample of expected) {
      const state = createSharedState();
      const tm = createTargetManager(
        spiderConfig(1, {
          angularRadiusDegRange: [90, 90],
          azimuthDegRange: [sample.azimuthDeg, sample.azimuthDeg],
          distanceURange: [8, 8],
        }),
      );
      tm.tick(state, 100);
      tm.markKilled(state, state.targets[0].id);
      tm.tick(state, 200);

      const peripheral = state.targets[0];
      expect(peripheral.zone).toBe('peripheral');
      expect(peripheral.pos.x).toBeCloseTo(sample.x, 12);
      expect(peripheral.pos.y).toBeCloseTo(sample.y, 12);
      expect(peripheral.pos.z).toBeCloseTo(sample.z, 12);
    }
  });
});

describe('TargetManager — WP-44 spider-shot stratified 12-cell peripheral schedule', () => {
  const AZIMUTH_QUADRANTS = 4;
  const RADIUS_TIERS = 3;
  const CELL_COUNT = AZIMUTH_QUADRANTS * RADIUS_TIERS;

  function stratifiedConfig(seed: number, spawnCount = CELL_COUNT): DrillConfig {
    return {
      drillId: 'spider-shot-stratified-test',
      targets: { count: spawnCount, distance: 8 },
      sequence: { alternation: 'LR' },
      spiderShot: {
        kind: 'center-peripheral-stratified',
        seed,
        centerDistanceU: 8,
        peripheral: {
          angularRadiusDegRange: [10, 25],
          azimuthDegRange: [0, 360],
          distanceURange: [8, 8],
        },
        grid: { azimuthQuadrants: AZIMUTH_QUADRANTS, radiusTiers: RADIUS_TIERS },
      },
      timing: { countdownMs: 0 },
      endCondition: { type: 'targetCount', value: spawnCount },
    };
  }

  it('single active target at all times, alternating center → peripheral', () => {
    const state = createSharedState();
    const tm = createTargetManager(stratifiedConfig(11));

    tm.tick(state, 100);
    expect(state.targets).toHaveLength(1);
    expect(state.targets[0]).toMatchObject({ zone: 'center', pos: { x: 0, y: 1.5, z: -8 } });
    tm.markKilled(state, state.targets[0].id);

    tm.tick(state, 200);
    expect(state.targets).toHaveLength(1);
    expect(state.targets[0].zone).toBe('peripheral');
  });

  it('replays the same stratified peripheral sequence after reset, while a different seed changes it', () => {
    const run = (cfg: DrillConfig): Array<{ x: number; y: number; z: number }> => {
      const state = createSharedState();
      const tm = createTargetManager(cfg);
      const sequence: Array<{ x: number; y: number; z: number }> = [];
      for (let i = 0; i < cfg.targets.count; i++) {
        tm.tick(state, 100 + i * 100);
        const target = state.targets[0];
        sequence.push({ x: target.pos.x, y: target.pos.y, z: target.pos.z });
        tm.markKilled(state, target.id);
      }
      return sequence;
    };

    const cfg = stratifiedConfig(11, CELL_COUNT * 2);
    const state = createSharedState();
    const tm = createTargetManager(cfg);
    const replay = (): Array<{ x: number; y: number; z: number }> => {
      const sequence: Array<{ x: number; y: number; z: number }> = [];
      for (let i = 0; i < cfg.targets.count; i++) {
        tm.tick(state, 100 + i * 100);
        const target = state.targets[0];
        sequence.push({ x: target.pos.x, y: target.pos.y, z: target.pos.z });
        tm.markKilled(state, target.id);
      }
      return sequence;
    };

    const first = replay();
    tm.reset(state);
    expect(replay()).toEqual(first);
    expect(run(stratifiedConfig(12, CELL_COUNT * 2))).not.toEqual(first);
  });

  it('covers all 12 azimuth-quadrant × radius-tier cells exactly once before any repeats, then reshuffles for the next round', () => {
    // Total spawn count must be 4× the cell count: center↔peripheral alternation means only half
    // of all spawns are peripheral, and we want two full 12-cell rounds among those.
    const cfg = stratifiedConfig(11, CELL_COUNT * 4);
    const state = createSharedState();
    const tm = createTargetManager(cfg);

    function cellKey(pos: { x: number; y: number; z: number }): string {
      // Recover azimuth (around the center sightline) and radius (off it) from world pos by
      // inverting the same forward/up basis peripheralPos() uses, independent of implementation.
      const centerDistanceU = 8;
      const targetY = 1.5;
      const centerLength = Math.hypot(targetY, centerDistanceU);
      const forwardY = targetY / centerLength;
      const forwardZ = -centerDistanceU / centerLength;
      const upY = centerDistanceU / centerLength;
      const upZ = targetY / centerLength;
      const distanceU = Math.hypot(pos.x, pos.y, pos.z);
      const forwardComponent = (pos.y * forwardY + pos.z * forwardZ) / distanceU;
      const radiusRad = Math.acos(forwardComponent);
      const upComponent = pos.y * upY + pos.z * upZ;
      const radialSin = Math.sin(radiusRad);
      const azimuthCos = radialSin === 0 ? 1 : upComponent / distanceU / radialSin;
      const azimuthSin = radialSin === 0 ? 0 : pos.x / distanceU / radialSin;
      const azimuthDeg = ((Math.atan2(azimuthSin, azimuthCos) * 180) / Math.PI + 360) % 360;
      const radiusDeg = (radiusRad * 180) / Math.PI;
      const azimuthQuadrant = Math.min(AZIMUTH_QUADRANTS - 1, Math.floor(azimuthDeg / (360 / AZIMUTH_QUADRANTS)));
      // Radius tiers are equal-solid-angle (non-uniform in degrees); classify by cos boundary.
      const cosInner = Math.cos((10 * Math.PI) / 180);
      const cosOuter = Math.cos((25 * Math.PI) / 180);
      const cosSpan = cosInner - cosOuter;
      const cosValue = Math.cos((radiusDeg * Math.PI) / 180);
      const radiusTier = Math.min(RADIUS_TIERS - 1, Math.floor(((cosInner - cosValue) / cosSpan) * RADIUS_TIERS));
      return `${azimuthQuadrant}:${radiusTier}`;
    }

    const peripheralKeys: string[] = [];
    for (let i = 0; i < cfg.targets.count; i++) {
      tm.tick(state, 100 + i * 100);
      const target = state.targets[0];
      if (target.zone === 'peripheral') peripheralKeys.push(cellKey(target.pos));
      tm.markKilled(state, target.id);
    }

    expect(peripheralKeys).toHaveLength(CELL_COUNT * 2);
    const firstRound = peripheralKeys.slice(0, CELL_COUNT);
    const secondRound = peripheralKeys.slice(CELL_COUNT);
    expect(new Set(firstRound).size).toBe(CELL_COUNT);
    expect(new Set(secondRound).size).toBe(CELL_COUNT);
  });

  it('samples fall within the declared azimuth/radius bounds', () => {
    const cfg = stratifiedConfig(99);
    const state = createSharedState();
    const tm = createTargetManager(cfg);

    for (let i = 0; i < cfg.targets.count; i++) {
      tm.tick(state, 100 + i * 100);
      const target = state.targets[0];
      if (target.zone === 'peripheral') {
        const distanceU = Math.hypot(target.pos.x, target.pos.y, target.pos.z);
        expect(distanceU).toBeCloseTo(8, 9);
      }
      tm.markKilled(state, target.id);
    }
  });
});

describe('TargetManager — WP-52 T5 balanced-shuffle hitboxCandidates', () => {
  const CANDIDATES = [
    { widthU: 0.14, heightU: 0.14, depthU: 1 },
    { widthU: 0.35, heightU: 0.35, depthU: 1 },
    { widthU: 0.7, heightU: 0.7, depthU: 1 },
  ] as const;

  function config(seed: number, count = 21): DrillConfig {
    return {
      drillId: 'hitbox-candidates-test',
      targets: { count, distance: 8, hitboxCandidates: CANDIDATES },
      sequence: { alternation: 'LR', seed },
      timing: { countdownMs: 0 },
      endCondition: { type: 'targetCount', value: count },
    };
  }

  function collectHitboxes(cfg: DrillConfig): Array<{ widthU: number; hitboxVaries?: true }> {
    const state = createSharedState();
    const tm = createTargetManager(cfg);
    const samples: Array<{ widthU: number; hitboxVaries?: true }> = [];
    for (let i = 0; i < cfg.targets.count; i++) {
      tm.tick(state, 100 + i * 100);
      const target = state.targets[0];
      samples.push({ widthU: target.hitbox.width, hitboxVaries: target.hitboxVaries });
      tm.markKilled(state, target.id);
    }
    return samples;
  }

  it('each candidate appears an equal number of times across a full run', () => {
    const samples = collectHitboxes(config(1));
    const counts = new Map<number, number>();
    for (const sample of samples) counts.set(sample.widthU, (counts.get(sample.widthU) ?? 0) + 1);

    expect(samples).toHaveLength(21);
    expect([...counts.values()]).toEqual([7, 7, 7]);
    for (const candidate of CANDIDATES) expect(counts.get(candidate.widthU)).toBe(7);
  });

  it('marks every spawned target hitboxVaries: true (WP-52 T5 event-emission trigger)', () => {
    const samples = collectHitboxes(config(1));
    expect(samples.every((sample) => sample.hitboxVaries === true)).toBe(true);
  });

  it('does not produce every candidate in the same fixed order (sanity: it is shuffled, not round-robin)', () => {
    const widths = collectHitboxes(config(1)).map((sample) => sample.widthU);
    const roundRobin = [0, 1, 2].flatMap(() => CANDIDATES.map((c) => c.widthU));
    expect(widths).not.toEqual(roundRobin);
  });

  it('same seed reset produces the identical shuffled sequence; a different seed differs', () => {
    const cfg = config(42);
    const state = createSharedState();
    const tm = createTargetManager(cfg);

    function run(): number[] {
      const widths: number[] = [];
      for (let i = 0; i < cfg.targets.count; i++) {
        tm.tick(state, 100 + i * 100);
        widths.push(state.targets[0].hitbox.width);
        tm.markKilled(state, state.targets[0].id);
      }
      return widths;
    }

    const first = run();
    tm.reset(state);
    expect(run()).toEqual(first);
    expect(collectHitboxes(config(43)).map((s) => s.widthU)).not.toEqual(first);
  });

  it('a drill without hitboxCandidates never sets hitboxVaries (existing drills unaffected)', () => {
    const state = createSharedState();
    const tm = createTargetManager({
      drillId: 'no-candidates',
      targets: { count: 3, distance: 8, hitbox: { widthU: 0.35, heightU: 0.35, depthU: 1 } },
      sequence: { alternation: 'LR' },
      timing: { countdownMs: 0 },
      endCondition: { type: 'targetCount', value: 3 },
    });

    tm.tick(state, 100);
    expect(state.targets[0].hitboxVaries).toBeUndefined();
    expect(state.targets[0].hitbox.width).toBe(0.35);
  });
});

describe('TargetManager — trackingTrajectory drive（WP-54 / T2）', () => {
  const TICK_SEC = 1 / SIM_HZ;
  const DISTANCE = 4;
  const CENTER_Y = 1.5; // TargetManager 私有 TARGET_Y 常數值（clearance.ts TARGET_CENTER_Y_U 同值）

  const BAND_LIMITED: TrackingTrajectoryConfig = {
    kind: 'band-limited-2d-v1',
    seed: 7,
    durationMs: 25000,
    yawBoundDeg: 2,
    pitchBoundDeg: 2,
    targetRmsSpeedDegPerSec: 5,
    frequencyBandHz: [0.1, 0.7],
  };

  const REVERSAL: TrackingTrajectoryConfig = {
    kind: 'reversal-2d-v1',
    seed: 7,
    durationMs: 25000,
    // KI-019 F-A2: ±13° so a leg's demanded travel fits the angular window.
    angularBoundsDeg: [-13, 13],
    speedRangeDegPerSec: [5, 20],
    reversalIntervalMs: [800, 1400],
    accelerationRampMs: 150,
  };

  function trajectoryConfig(
    trackingTrajectory: TrackingTrajectoryConfig,
    trackingPrepMs?: number,
  ): DrillConfig {
    return {
      drillId: 'tracking-trajectory-test',
      targets: { count: 1, distance: DISTANCE, trackingTrajectory },
      sequence: { alternation: 'RL' },
      timing: { countdownMs: 0, presentationMs: 30000, ...(trackingPrepMs !== undefined ? { trackingPrepMs } : {}) },
      endCondition: { type: 'timeLimit', value: 30000 },
    };
  }

  /** 直接用 trajectory kernel + 投影公式現算期望位置，避免手算誤差（同一份幾何函式）。 */
  function expectedPos(trackingTrajectory: TrackingTrajectoryConfig, ageSec: number): { x: number; y: number; z: number } {
    const trajectory = createTrackingTrajectory(trackingTrajectory);
    const sample: TrackingTrajectorySample = { yawDeg: 0, pitchDeg: 0, yawVelocityDegPerSec: 0, pitchVelocityDegPerSec: 0 };
    trajectory.sample(ageSec, sample);
    const out = { x: 0, y: 0, z: 0 };
    projectTrackingAngles(sample.yawDeg, sample.pitchDeg, { distanceU: DISTANCE, centerY: CENTER_Y }, out);
    return out;
  }

  it('無 trackingPrepMs：pos 逐 tick 等於 trajectory.sample(age) 的投影（round-trip，band-limited）', () => {
    const state = createSharedState();
    const tm = createTargetManager(trajectoryConfig(BAND_LIMITED));

    for (let i = 1; i <= 5; i++) {
      tm.tick(state, i * 100);
      const pos = state.targets[0].pos;
      const expected = expectedPos(BAND_LIMITED, i * TICK_SEC);
      expect(pos.x).toBeCloseTo(expected.x, 12);
      expect(pos.y).toBeCloseTo(expected.y, 12);
      expect(pos.z).toBeCloseTo(expected.z, 12);
    }
  });

  it('無 trackingPrepMs：scored_start 在第一個 drive tick 就蓋戳（prepSec=0 退化情形）', () => {
    const state = createSharedState();
    const tm = createTargetManager(trajectoryConfig(BAND_LIMITED));

    tm.tick(state, 100);
    const id = state.targets[0].id;
    expect(state.tScoredStart.get(id)).toBe(100);
  });

  it('trackingPrepMs 期間：pos 凍結在 trajectory.sample(0) 投影、tScoredStart 未蓋戳', () => {
    const state = createSharedState();
    const prepMs = 20 * TICK_SEC * 1000; // 20 ticks 的置中準備窗
    const tm = createTargetManager(trajectoryConfig(BAND_LIMITED, prepMs));
    const frozen = expectedPos(BAND_LIMITED, 0);

    for (let i = 1; i <= 10; i++) {
      tm.tick(state, i * 100);
      const pos = state.targets[0].pos;
      expect(pos.x).toBeCloseTo(frozen.x, 12);
      expect(pos.y).toBeCloseTo(frozen.y, 12);
      expect(pos.z).toBeCloseTo(frozen.z, 12);
    }
    expect(state.tScoredStart.size).toBe(0);
  });

  it('跨過 trackingPrepMs 那個 tick：蓋 tScoredStart（恰一次，邊界含跨過那一 tick）、之後 trajectoryAgeSec 從 0 重新推進', () => {
    const state = createSharedState();
    const prepTicks = 20; // crossedPrep 判準為 nextAge >= prepSec，故第 20 個 tick（含）即跨過
    const prepMs = prepTicks * TICK_SEC * 1000;
    const tm = createTargetManager(trajectoryConfig(BAND_LIMITED, prepMs));

    for (let i = 1; i < prepTicks; i++) {
      tm.tick(state, i * 100);
      expect(state.tScoredStart.size).toBe(0); // 仍在 prep 窗內，未蓋戳
    }
    tm.tick(state, prepTicks * 100); // 跨過 prep 的那個 tick（nextAge === prepSec）
    const id = state.targets[0].id;
    expect(state.tScoredStart.get(id)).toBe(prepTicks * 100);

    tm.tick(state, (prepTicks + 1) * 100); // 跨過後一個 tick：仍只蓋一次
    expect(state.tScoredStart.size).toBe(1);

    // 跨過後那個 tick：trajectoryAgeSec = 1·TICK_SEC（自跨過那一刻重新從 0 起算，不含 prep 窗內的 tick 數）。
    const posAfter = state.targets[0].pos;
    const expected = expectedPos(BAND_LIMITED, TICK_SEC);
    expect(posAfter.x).toBeCloseTo(expected.x, 12);
    expect(posAfter.y).toBeCloseTo(expected.y, 12);
    expect(posAfter.z).toBeCloseTo(expected.z, 12);
  });

  it('reversal-2d-v1：target_motion_change 事件在跨過 trackingPrepMs 之後才開始 drain（不在 prep 窗內提早觸發）', () => {
    const state = createSharedState();
    const prepTicks = 5; // crossedPrep 判準為 nextAge >= prepSec，故第 5 個 tick（含）即跨過
    const prepMs = prepTicks * TICK_SEC * 1000;
    const tm = createTargetManager(trajectoryConfig(REVERSAL, prepMs));

    for (let i = 1; i < prepTicks; i++) {
      tm.tick(state, i * 100);
      expect(state.targetMotionChanges).toHaveLength(0); // prep 窗內：changes[0].tMs=0 不得提早觸發
    }
    tm.tick(state, prepTicks * 100); // 跨過 prep 的那個 tick
    expect(state.targetMotionChanges).toHaveLength(1);
    expect(state.targetMotionChanges[0].targetId).toBe(state.targets[0].id);
    expect(state.targetMotionChanges[0].t).toBe(prepTicks * 100);
  });

  it('reversal-2d-v1：無 trackingPrepMs 時第一個 tick 立刻 drain changes[0]', () => {
    const state = createSharedState();
    const tm = createTargetManager(trajectoryConfig(REVERSAL));

    tm.tick(state, 100);
    expect(state.targetMotionChanges).toHaveLength(1);
    expect(state.targetMotionChanges[0].t).toBe(100);
  });

  it('markKilled 撤除目標後清除 tScoredStart（比照 tVisible/tStop）', () => {
    const state = createSharedState();
    const tm = createTargetManager(trajectoryConfig(BAND_LIMITED));

    tm.tick(state, 100);
    const id = state.targets[0].id;
    expect(state.tScoredStart.has(id)).toBe(true);
    tm.markKilled(state, id);
    expect(state.tScoredStart.has(id)).toBe(false);
  });

  it('reset 後 trajectory 從 age=0 重新決定性推進（同 seed 同序列）', () => {
    const state = createSharedState();
    const tm = createTargetManager(trajectoryConfig(BAND_LIMITED));

    tm.tick(state, 100);
    tm.tick(state, 200);
    const before = { ...state.targets[0].pos };

    tm.reset(state);
    tm.tick(state, 500);
    tm.tick(state, 600);
    const after = { ...state.targets[0].pos };

    expect(after).toEqual(before); // 決定性：與 nowMs 無關，只依 age（tick 數）
    expect(state.targetMotionChanges).toEqual([]); // reset 清空 transient queue
  });
});
