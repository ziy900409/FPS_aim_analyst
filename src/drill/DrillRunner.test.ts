import { describe, expect, it } from 'vitest';
import type { Clock } from '../loop/clock.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { createSimLoop } from '../loop/SimLoop.ts';
import { createSharedState, type SharedState } from '../state/SharedState.ts';
import { createTargetManager, type TargetManager } from '../sim/TargetManager.ts';
import type { DrillConfig } from './DrillConfig.ts';
import { createDrillRunner } from './DrillRunner.ts';

/** 最小合法 config；各測試以 spread 覆寫需要的欄位。 */
function makeConfig(overrides: Partial<DrillConfig> = {}): DrillConfig {
  return {
    drillId: 'test_ad_v1',
    targets: { count: 3, distance: 4 },
    sequence: { alternation: 'LR' },
    timing: { countdownMs: 1000 },
    endCondition: { type: 'targetCount', value: 3 },
    ...overrides,
  };
}

/**
 * 標準佈線：TargetManager 與 DrillRunner **共用同一 config**（tm 由 config 取得 spawn 上限
 * `targets.count`，runner 判定 endCondition）——即 app / T2 的真實用法。
 */
function setup(config: DrillConfig): { state: SharedState; tm: TargetManager; runner: ReturnType<typeof createDrillRunner> } {
  const state = createSharedState();
  const tm = createTargetManager(config);
  const runner = createDrillRunner(state, tm);
  return { state, tm, runner };
}

/** 固定基準的注入式 sim clock（與 SimLoop 測試同型）。 */
function fixedClock(t: number): Clock {
  return { now: () => t };
}

/** 擊殺當前 active（visible && alive）目標——模擬 fire→markKilled（WP-5 路徑）。 */
function killCurrentTarget(state: SharedState, tm: TargetManager): void {
  const active = state.targets.find((t) => t.alive);
  if (active) tm.markKilled(state, active.id);
}

describe('DrillRunner — 生命週期（FR-6.4）', () => {
  it('初始相位為 idle', () => {
    const { runner } = setup(makeConfig());
    expect(runner.phase).toBe('idle');
  });

  it('start → countdown；倒數期間不 spawn 目標', () => {
    const { state, runner } = setup(makeConfig({ timing: { countdownMs: 1000 } }));

    runner.start(makeConfig({ timing: { countdownMs: 1000 } }));
    expect(runner.phase).toBe('countdown');

    runner.tick(state, 0); // 第一 tick：起算倒數
    runner.tick(state, 500); // 倒數中
    expect(runner.phase).toBe('countdown');
    expect(state.targets).toHaveLength(0); // countdown 期間不驅動目標
  });

  it('倒數自「第一個 tick」起算（非 start() 呼叫時刻）→ 達 countdownMs 後轉 running 並 spawn', () => {
    const config = makeConfig({ timing: { countdownMs: 1000 } });
    const { state, runner } = setup(config);

    runner.start(config);
    runner.tick(state, 5000); // 第一 tick nowMs=5000 → countdownStart=5000
    expect(runner.phase).toBe('countdown');
    runner.tick(state, 5999); // 相對第一 tick 尚未滿 1000
    expect(runner.phase).toBe('countdown');
    runner.tick(state, 6000); // 相對第一 tick 滿 1000 → running（同 tick spawn 首目標）
    expect(runner.phase).toBe('running');
    expect(state.targets).toHaveLength(1);
    expect(state.targets[0].side).toBe('L'); // config 首側 = alternation[0]
  });

  it('running：擊殺達 endCondition.targetCount → ended（且不超額 spawn）', () => {
    const config = makeConfig({
      timing: { countdownMs: 0 },
      targets: { count: 3, distance: 4 },
      endCondition: { type: 'targetCount', value: 3 },
    });
    const { state, tm, runner } = setup(config);

    runner.start(config);
    let now = 0;
    runner.tick(state, now); // countdownMs=0 → 立即 running + spawn t0
    expect(runner.phase).toBe('running');

    // 依序擊殺 3 個目標；每次擊殺後 tick 補生下一個。
    for (let i = 0; i < 3; i++) {
      killCurrentTarget(state, tm);
      now += 100;
      runner.tick(state, now);
    }
    expect(runner.phase).toBe('ended');
    // 恰 3 個目標曾生成、全數擊殺、無超額補生（tm 達 targets.count 後不再 spawn）。
    expect(state.targets).toHaveLength(0);
  });

  it('endCondition.timeLimit：running 經過 value ms → ended', () => {
    const config = makeConfig({ timing: { countdownMs: 0 }, endCondition: { type: 'timeLimit', value: 2000 } });
    const { state, runner } = setup(config);

    runner.start(config);
    runner.tick(state, 0); // running 起點 runStartMs=0
    expect(runner.phase).toBe('running');
    runner.tick(state, 1999);
    expect(runner.phase).toBe('running');
    runner.tick(state, 2000); // 達時限
    expect(runner.phase).toBe('ended');
  });

  it('timing.timeLimitMs 後援閘：targetCount 未達仍因時限 → ended（防卡 phase）', () => {
    // targetCount=99（不會達），但 timeLimitMs=1000 後援。
    const config = makeConfig({
      timing: { countdownMs: 0, timeLimitMs: 1000 },
      targets: { count: 99, distance: 4 },
      endCondition: { type: 'targetCount', value: 99 },
    });
    const { state, runner } = setup(config);

    runner.start(config);
    runner.tick(state, 0);
    expect(runner.phase).toBe('running');
    runner.tick(state, 1000); // 後援時限到
    expect(runner.phase).toBe('ended');
  });

  it('restart：全 reset → idle，state/target/首發游標無殘留', () => {
    const config = makeConfig({
      timing: { countdownMs: 0 },
      targets: { count: 3, distance: 4 },
      endCondition: { type: 'targetCount', value: 3 },
    });
    const { state, tm, runner } = setup(config);

    // 跑到 ended 並製造殘留狀態（player 位移、首發旗標、目標、tVisible）。
    runner.start(config);
    runner.tick(state, 0);
    state.player.x = 123; // 模擬遊玩殘留
    state.player.vx = 250;
    state.firstShotPeekId = state.targets[0].id;
    for (let i = 0; i < 3; i++) {
      killCurrentTarget(state, tm);
      runner.tick(state, (i + 1) * 100);
    }
    expect(runner.phase).toBe('ended');

    runner.restart();
    expect(runner.phase).toBe('idle');
    // 全 reset 斷言（無殘留）。
    expect(state.targets).toHaveLength(0);
    expect(state.tVisible.size).toBe(0);
    expect(state.firstShotPeekId).toBeNull();
    expect(state.player.x).toBe(0);
    expect(state.player.vx).toBe(0);

    // restart 後可重玩並再次達 ended（內部 seen 游標已清、tm spawn 計數歸零）。
    runner.start(config);
    runner.tick(state, 0);
    expect(runner.phase).toBe('running');
    for (let i = 0; i < 3; i++) {
      killCurrentTarget(state, tm);
      runner.tick(state, (i + 1) * 100);
    }
    expect(runner.phase).toBe('ended');
  });

  it('idle 相位：未 start 時 tick 不推進、不 spawn', () => {
    const { state, runner } = setup(makeConfig());

    runner.tick(state, 100);
    expect(runner.phase).toBe('idle');
    expect(state.targets).toHaveLength(0);
  });
});

describe('DrillRunner — SimLoop 整合（sim tick 呼叫 DrillRunner.tick）', () => {
  const TICK_MS = 1000 / SIM_HZ;

  it('createSimLoop 注入 drillRunner：pump 在 sim tick 內驅動 runner（running 才 spawn）', () => {
    const config = makeConfig({ timing: { countdownMs: 0 } }); // 倒數 0 → 首 running tick 即 spawn
    const { state, tm, runner } = setup(config);
    const loop = createSimLoop(state, fixedClock(0), SIM_HZ, tm, undefined, runner);

    // 尚未 start：pump 數 tick 不應 spawn（runner idle 閘住目標）。
    loop.pump(3 * TICK_MS);
    expect(runner.phase).toBe('idle');
    expect(state.targets).toHaveLength(0);

    // start → pump 一個 tick：countdownMs=0 → running → spawn 首目標（證 sim tick 有呼叫 runner.tick）。
    runner.start(config);
    loop.pump(4 * TICK_MS);
    expect(runner.phase).toBe('running');
    expect(state.targets).toHaveLength(1);
  });
});
