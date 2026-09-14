import { describe, expect, it } from 'vitest';
import type { DrillEvent } from '../../data/DataRecorder.ts';
import { microFlickThreeTargetTestV9 } from '../../drill/micro_flick_three_target_test_v9.ts';
import {
  RENDER_FPS,
  createMicroFlickHarness,
  expectObjectIsDeep,
} from './microFlickDeterminismHarness.ts';

/**
 * WP-68 / T2 — **NFR-68.3**：同一 seed 與輸入序列，在 30／60／144／240 render FPS 下，v9 的逐 tick
 * trace 與四層指標輸出逐位一致。
 *
 * 形狀與 [`wp63-v8-metrics-determinism.test.ts`](wp63-v8-metrics-determinism.test.ts) 相同，且**共用
 * 同一份 harness**（`microFlickDeterminismHarness.ts`）——不是照抄一份。兩支 drill 因此走同一條程式
 * 路徑，「v8 綠、v9 紅」必然歸因於 drill 本身而不是兩份各自漂移的 harness。
 *
 * ⚠️ **v9 的靶比 v8 小 10%**（角半徑約 1.118° vs 1.242°），所以照抄 v8 的瞄準參數有讓 v9 全部失手的
 * 風險——四層指標會一起變空，逐位比對就淪為比四個空殼。下方第一條測試是擋這件事的**非空對空前置**，
 * 帶實測 trace 形狀數字；實測結果是 v8 的參數對 v9 仍同時走過命中與失手兩條分支（37 發 18 中 19 失），
 * 故**刻意沿用 v8 的常數**：讓兩支 drill 的差異只剩 drill config 本身。
 */

const V9 = microFlickThreeTargetTestV9;

/** 與 v8 逐字相同的瞄準參數（見上方 ⚠️：沿用是實測後的選擇，不是未複核的照抄）。 */
const HARNESS = createMicroFlickHarness(V9, {
  expectedTicks: 900,
  approachAmplitudeDeg: [1.5, 9],
  approachDecay: 0.97,
  clickPeriodMs: 190,
});

describe('WP-68 T2 — NFR-68.3：v9 的 tick trace 與四層指標跨 render FPS 逐位一致', () => {
  it('這份 trace 不是空對空：有 kill、有 hit 也有 miss、有真的 dYaw', () => {
    const fires = HARNESS.canonical.events.filter(
      (event): event is Extract<DrillEvent, { type: 'fire' }> => event.type === 'fire',
    );
    const visible = HARNESS.canonical.events.filter((event) => event.type === 'visible');

    // 實測形狀（2026-09-14）：900 ticks、37 發、18 中、19 失、21 窗。寫成 `toBe` 而不是 `>`，
    // 因為這條前置的價值就在於「trace 的形狀本身是釘死的」——它一旦變了，下面所有逐位比對的
    // 意義就跟著變，必須有人看一眼而不是靜默通過。
    expect(HARNESS.canonical.tickCount).toBe(HARNESS.expectedTicks);
    expect(fires.length).toBe(37);
    expect(fires.filter((fire) => fire.hit).length).toBe(18);
    expect(fires.filter((fire) => !fire.hit).length).toBe(19);
    expect(visible.length).toBe(21);
    expect(HARNESS.canonical.ticks.some((tick) => (tick.dYaw ?? 0) !== 0)).toBe(true);
    // 指標四層都真的出數（否則下面的逐位比對是在比四個空殼）。
    expect(HARNESS.canonicalMetrics.outcome.n).toBe(18);
    expect(HARNESS.canonicalMetrics.geometry.shots.length).toBe(37);
    expect(HARNESS.canonicalMetrics.selection.n).toBe(17);
    expect(HARNESS.canonicalMetrics.microAdjust.n).toBe(18);
  });

  it('FR-68.3：v9 是計時制 ⇒ 計分窗右界取最後一個 tick，不截在最後一次擊殺', () => {
    const outcome = HARNESS.canonicalMetrics.outcome;
    const lastTickMs = HARNESS.canonical.ticks.at(-1)!.t;
    const firstVisibleMs = Math.min(
      ...HARNESS.canonical.events.filter((event) => event.type === 'visible').map((event) => event.t),
    );
    const lastKillMs = Math.max(
      ...HARNESS.canonical.events
        .filter((event): event is Extract<DrillEvent, { type: 'fire' }> => event.type === 'fire')
        .filter((fire) => fire.hit)
        .map((fire) => fire.t),
    );

    // 右界 = 最後一個 tick，而不是最後一次擊殺。
    expect(outcome.validSpanMs).toBe(lastTickMs - firstVisibleMs);
    expect(outcome.flags).not.toContain('scoring_window_truncated_at_last_kill');
    expect(outcome.flags).not.toContain('unknown_end_condition');

    // 偏誤的方向與量級：舊右界會少算最後一殺之後的那一段，`killRateHz` 因此系統性**高估**。
    const truncatedSpanMs = lastKillMs - firstVisibleMs;
    expect(outcome.validSpanMs!).toBeGreaterThan(truncatedSpanMs);
    const truncatedKillRateHz = outcome.n / (truncatedSpanMs / 1000);
    expect(truncatedKillRateHz).toBeGreaterThan(outcome.killRateHz!);
  });

  for (const fps of RENDER_FPS) {
    it(`${fps} Hz：逐 tick trace 與 canonical 逐位相同`, () => {
      const run = HARNESS.run(HARNESS.framesAt(1000 / fps));
      expect(run.tickCount).toBe(HARNESS.canonical.tickCount);
      expectObjectIsDeep(run.ticks, HARNESS.canonical.ticks, `ticks@${fps}`);
      expectObjectIsDeep(run.events, HARNESS.canonical.events, `events@${fps}`);
    });

    it(`${fps} Hz：deriveMicroFlickMetrics 的四層輸出與 canonical 逐位相同`, () => {
      const metrics = HARNESS.metricsFor(HARNESS.run(HARNESS.framesAt(1000 / fps)));
      expectObjectIsDeep(metrics, HARNESS.canonicalMetrics, `metrics@${fps}`);
    });
  }

  it('四種 FPS 序列彼此逐位相等（不只是各自等於 canonical）', () => {
    const runs = RENDER_FPS.map((fps) => HARNESS.run(HARNESS.framesAt(1000 / fps)));
    for (const run of runs) expectObjectIsDeep(run.ticks, runs[0].ticks, 'ticks');
  });

  it('重播逐位相同：同一序列跑兩次一致（無時鐘／Math.random 洩漏）', () => {
    const frames = HARNESS.framesAt(1000 / 144);
    expectObjectIsDeep(HARNESS.run(frames).ticks, HARNESS.run(frames).ticks, 'replay');
  });
});
