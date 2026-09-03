import { describe, expect, it } from 'vitest';
import type { Clock } from '../loop/clock.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { createSimLoop } from '../loop/SimLoop.ts';
import { createSharedState, type SharedState } from '../state/SharedState.ts';
import { createTargetManager, type TargetManager } from '../sim/TargetManager.ts';
import type { DrillConfig } from './DrillConfig.ts';
import { createDrillRunner } from './DrillRunner.ts';
import { spiderShotV1 } from './spider_shot_v1.ts';

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

  it('timing.peekTimeoutMs：未擊殺的 visible target 逾時後推進序列並計入 targetCount', () => {
    const config = makeConfig({
      timing: { countdownMs: 0, peekTimeoutMs: 100 },
      targets: { count: 2, distance: 4 },
      endCondition: { type: 'targetCount', value: 2 },
    });
    const { state, runner } = setup(config);

    runner.start(config);
    runner.tick(state, 0);
    expect(runner.phase).toBe('running');
    expect(state.targets.map((target) => target.id)).toEqual(['t0']);

    runner.tick(state, 99);
    expect(state.targets.map((target) => target.id)).toEqual(['t0']);

    runner.tick(state, 100);
    expect(runner.phase).toBe('running');
    expect(state.targets).toHaveLength(0);

    runner.tick(state, 101);
    expect(state.targets.map((target) => target.id)).toEqual(['t1']);

    runner.tick(state, 201);
    expect(runner.phase).toBe('ended');
    expect(state.targets).toHaveLength(0);
  });

  it('spiderShot.centerExemptFromTimeout=true：center 目標超過 peekTimeoutMs 仍存活', () => {
    const config = makeConfig({
      timing: { countdownMs: 0, peekTimeoutMs: 100 },
      targets: { count: 2, distance: 8 },
      spiderShot: {
        kind: 'center-peripheral',
        seed: 7,
        centerDistanceU: 8,
        peripheral: { angularRadiusDegRange: [15, 15], azimuthDegRange: [0, 360], distanceURange: [8, 8] },
        centerExemptFromTimeout: true,
      },
    });
    const { state, runner } = setup(config);

    runner.start(config);
    runner.tick(state, 0);
    expect(state.targets[0]).toMatchObject({ id: 't0', zone: 'center' });

    runner.tick(state, 100);
    expect(state.targets).toHaveLength(1);
    expect(state.targets[0]).toMatchObject({ id: 't0', zone: 'center', alive: true });
  });

  it('spiderShot.centerExemptFromTimeout=true：peripheral 目標仍在 peekTimeoutMs 到期時撤除', () => {
    const config = makeConfig({
      timing: { countdownMs: 0, peekTimeoutMs: 100 },
      targets: { count: 2, distance: 8 },
      endCondition: { type: 'targetCount', value: 2 },
      spiderShot: {
        kind: 'center-peripheral',
        seed: 7,
        centerDistanceU: 8,
        peripheral: { angularRadiusDegRange: [15, 15], azimuthDegRange: [0, 360], distanceURange: [8, 8] },
        centerExemptFromTimeout: true,
      },
    });
    const { state, tm, runner } = setup(config);

    runner.start(config);
    runner.tick(state, 0);
    killCurrentTarget(state, tm);
    runner.tick(state, 1);
    expect(state.targets[0]).toMatchObject({ id: 't1', zone: 'peripheral' });

    runner.tick(state, 101);
    expect(state.targets).toHaveLength(0);
  });

  it('spider-shot-v1：未設 centerExemptFromTimeout 時 center 仍在 peekTimeoutMs 到期時撤除', () => {
    const config: DrillConfig = {
      ...spiderShotV1,
      targets: { ...spiderShotV1.targets, count: 2 },
      timing: { ...spiderShotV1.timing, countdownMs: 0, peekTimeoutMs: 100 },
      endCondition: { type: 'targetCount', value: 2 },
    };
    const { state, runner } = setup(config);

    runner.start(config);
    runner.tick(state, 0);
    expect(state.targets[0]).toMatchObject({ id: 't0', zone: 'center' });

    runner.tick(state, 100);
    expect(state.targets).toHaveLength(0);
  });

  it('timing.presentationMs：目標可見達呈現時長 → 純時長推進序列並計入 targetCount（WP-18/T3）', () => {
    const config = makeConfig({
      timing: { countdownMs: 0, presentationMs: 100 },
      targets: { count: 2, distance: 4 },
      endCondition: { type: 'targetCount', value: 2 },
    });
    const { state, runner } = setup(config);

    runner.start(config);
    runner.tick(state, 0);
    expect(runner.phase).toBe('running');
    expect(state.targets.map((target) => target.id)).toEqual(['t0']);
    // presentationMs 提供 → spawn 的目標標記 persistent（命中不撤除,SimLoop gate 消費）。
    expect(state.targets[0].persistent).toBe(true);

    runner.tick(state, 99); // 未達呈現時長,不推進
    expect(state.targets.map((target) => target.id)).toEqual(['t0']);

    runner.tick(state, 100); // 達呈現時長 → 撤舊目標推進
    expect(runner.phase).toBe('running');
    expect(state.targets).toHaveLength(0);

    runner.tick(state, 101); // 補生下一目標（對側）
    expect(state.targets.map((target) => target.id)).toEqual(['t1']);

    runner.tick(state, 201); // 第二個亦到期 → 達 targetCount=2 → ended
    expect(runner.phase).toBe('ended');
    expect(state.targets).toHaveLength(0);
  });

  it('未設 presentationMs：目標非 persistent，不因時長自動推進（既有政策零破壞）', () => {
    const config = makeConfig({
      timing: { countdownMs: 0 },
      targets: { count: 3, distance: 4 },
      endCondition: { type: 'targetCount', value: 3 },
    });
    const { state, runner } = setup(config);

    runner.start(config);
    runner.tick(state, 0);
    expect(state.targets).toHaveLength(1);
    expect(state.targets[0].persistent).toBeUndefined(); // 無 presentationMs → 不標記
    // 時間大幅推進但未擊殺 → 目標仍在（不因時長撤除;既有政策不變）。
    runner.tick(state, 999999);
    expect(state.targets.map((target) => target.id)).toEqual(['t0']);
    expect(runner.phase).toBe('running');
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

describe('DrillRunner — hold-reversal cue schedule (WP-37/T2)', () => {
  function reversalConfig(timing: DrillConfig['timing'] = { countdownMs: 0 }): DrillConfig {
    return makeConfig({
      cue: { kind: 'hold-reversal', holdDurationMs: 100 },
      timing,
      targets: { count: 2, distance: 4 },
      endCondition: { type: 'targetCount', value: 2 },
    });
  }

  it('emits the visible-side cue then the opposite cue after a continuous hold', () => {
    const config = reversalConfig();
    const { state, runner } = setup(config);

    runner.start(config);
    state.held.left = true;
    runner.tick(state, 0);
    expect(state.cues).toEqual([{ t: 0, direction: 'A' }]);

    runner.tick(state, 99);
    expect(state.cues).toHaveLength(1);
    runner.tick(state, 100);
    expect(state.cues).toEqual([{ t: 0, direction: 'A' }, { t: 100, direction: 'D' }]);
  });

  it('resets the hold timer when the prompted key is released instead of accumulating segments', () => {
    const config = reversalConfig();
    const { state, runner } = setup(config);

    runner.start(config);
    state.held.left = true;
    runner.tick(state, 0);
    runner.tick(state, 50);
    state.held.left = false;
    runner.tick(state, 51);
    state.held.left = true;
    runner.tick(state, 52);
    runner.tick(state, 151);
    expect(state.cues).toEqual([{ t: 0, direction: 'A' }]);

    runner.tick(state, 152);
    expect(state.cues).toEqual([{ t: 0, direction: 'A' }, { t: 152, direction: 'D' }]);
  });

  it.each([
    ['peek timeout', { countdownMs: 0, peekTimeoutMs: 100 }],
    ['timed presentation', { countdownMs: 0, presentationMs: 100 }],
  ] as const)('cancels reversal tracking when %s removes the target', (_name, timing) => {
    const config = reversalConfig(timing);
    const { state, runner } = setup(config);

    runner.start(config);
    state.held.left = true;
    runner.tick(state, 0);
    runner.tick(state, 100);
    expect(state.targets).toHaveLength(0);
    expect(state.cues).toEqual([{ t: 0, direction: 'A' }]);

    runner.tick(state, 101);
    expect(state.cues).toEqual([{ t: 0, direction: 'A' }, { t: 101, direction: 'D' }]);
  });

  it('produces identical cue timestamps for the same hold timeline', () => {
    const run = (): Array<{ t: number; direction: 'A' | 'D' }> => {
      const config = reversalConfig();
      const { state, runner } = setup(config);
      runner.start(config);
      state.held.left = true;
      for (const nowMs of [0, 25, 100]) runner.tick(state, nowMs);
      return state.cues.slice();
    };

    expect(run()).toEqual(run());
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

describe('DrillRunner — protocolGuard（WP-54 / T2）', () => {
  const TICK_MS = 1000 / SIM_HZ;

  const BAND_LIMITED: DrillConfig['targets']['trackingTrajectory'] = {
    kind: 'band-limited-2d-v1',
    seed: 7,
    durationMs: 25000,
    // KI-020: the amplitude must be able to deliver the requested RMS speed (the generator now
    // rejects configs where it cannot) — ±2° could only deliver 0.84deg/s on this band.
    yawBoundDeg: 16,
    pitchBoundDeg: 16,
    targetRmsSpeedDegPerSec: 5,
    frequencyBandHz: [0.1, 0.7],
  };

  function trackingGuardConfig(protocolGuard: DrillConfig['protocolGuard'], trackingPrepMs?: number): DrillConfig {
    return makeConfig({
      targets: { count: 1, distance: 4, trackingTrajectory: BAND_LIMITED },
      timing: { countdownMs: 0, presentationMs: 30000, ...(trackingPrepMs !== undefined ? { trackingPrepMs } : {}) },
      endCondition: { type: 'timeLimit', value: 30000 },
      protocolGuard,
    });
  }

  // trackingPrepMs = 3·TICK_MS → prepSec = 3·TICK_SEC；crossedPrep 判準為 nextAge >= prepSec，
  // 故第 3 個 `runner.tick()` 呼叫（含）即跨過（前 2 個仍在 prep 窗內）。
  const PREP_MS = 3 * TICK_MS;

  it('prep 窗內即使按住開火鍵也不記違規（scored 窗尚未開始）', () => {
    const config = trackingGuardConfig({ noFire: true }, PREP_MS);
    const { state, runner } = setup(config);
    runner.start(config);

    state.heldFire = true;
    runner.tick(state, 0); // 第 1 個 tick
    runner.tick(state, 100); // 第 2 個 tick：仍在 prep 窗內
    expect(state.protocolViolations).toEqual([]);
    expect(state.tScoredStart.size).toBe(0);
  });

  it('跨過 prep 窗、進入 scored 窗那個 tick：帶入的既有 heldFire 立即記一次違規', () => {
    const config = trackingGuardConfig({ noFire: true }, PREP_MS);
    const { state, runner } = setup(config);
    runner.start(config);

    state.heldFire = true;
    runner.tick(state, 0);
    runner.tick(state, 100);
    runner.tick(state, 200); // 第 3 個 tick：跨過 prep（nextAge === 3·TICK_SEC === prepSec）
    expect(state.tScoredStart.size).toBe(1);
    expect(state.protocolViolations).toEqual([{ kind: 'fire', t: 200 }]);
  });

  it('held 期間只記一次（latch）；放開後可再記一次', () => {
    const config = trackingGuardConfig({ noFire: true }); // 無 trackingPrepMs → 首 tick 即進 scored 窗
    const { state, runner } = setup(config);
    runner.start(config);

    state.heldFire = true;
    runner.tick(state, 0);
    runner.tick(state, 100);
    runner.tick(state, 200);
    expect(state.protocolViolations).toEqual([{ kind: 'fire', t: 0 }]); // 恆 held → 只記一次

    state.heldFire = false;
    runner.tick(state, 300);
    state.heldFire = true;
    runner.tick(state, 400);
    expect(state.protocolViolations).toEqual([
      { kind: 'fire', t: 0 },
      { kind: 'fire', t: 400 },
    ]);
  });

  it('noAds / noMovement 各自獨立偵測', () => {
    const config = trackingGuardConfig({ noAds: true, noMovement: true });
    const { state, runner } = setup(config);
    runner.start(config);

    state.heldAds = true;
    state.held.left = true;
    runner.tick(state, 0);
    expect(state.protocolViolations).toEqual(
      expect.arrayContaining([
        { kind: 'ads', t: 0 },
        { kind: 'movement', t: 0 },
      ]),
    );
    expect(state.protocolViolations).toHaveLength(2);
    expect(state.protocolViolations.some((v) => v.kind === 'fire')).toBe(false); // heldFire 未開、也未啟用 noFire
  });

  it('省略 protocolGuard：任何輸入皆不記違規（既有 drill 行為逐位不變）', () => {
    const config = trackingGuardConfig(undefined);
    const { state, runner } = setup(config);
    runner.start(config);

    state.heldFire = true;
    state.heldAds = true;
    state.held.left = true;
    runner.tick(state, 0);
    runner.tick(state, 100);
    expect(state.protocolViolations).toEqual([]);
  });

  it('不阻擋輸入本身：heldFire/heldAds/held 的值不受偵測影響', () => {
    const config = trackingGuardConfig({ noFire: true, noAds: true, noMovement: true });
    const { state, runner } = setup(config);
    runner.start(config);

    state.heldFire = true;
    state.heldAds = true;
    state.held.left = true;
    runner.tick(state, 0);

    expect(state.heldFire).toBe(true);
    expect(state.heldAds).toBe(true);
    expect(state.held.left).toBe(true);
  });
});
