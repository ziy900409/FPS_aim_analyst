import { describe, expect, it } from 'vitest';
import type { DrillEvent } from '../../data/DataRecorder.ts';
import { microFlickThreeTargetTestV8 } from '../../drill/micro_flick_three_target_test_v8.ts';
import {
  RENDER_FPS,
  createMicroFlickHarness,
  expectObjectIsDeep,
} from './microFlickDeterminismHarness.ts';

/**
 * WP-63 / T-exit — **NFR-63.2**：同一 seed 與輸入序列，在 30／60／144／240 render FPS 下，v8 的
 * 逐 tick trace 與本 WP 全部指標輸出逐位一致。
 *
 * T7 交付的 `NFR-63.2: display FPS metadata does not perturb …` 量的是**另一件事**：它把同一份合成
 * payload 的 `meta.displayHz` 改掉再比對，兩側的 `ticks` 來自同一個 generator ⇒ 那條斷言恆真，與
 * 指標實作無關。它守住的是「指標不讀 `meta.displayHz`」（仍值得有），但**不是** NFR-63.2。本檔補
 * 上真正的閘：**跑真的 v8**，以四種 render 幀序列 pump 同一份輸入，再逐位比對 trace 與四層指標。
 *
 * ⚠️ WP-68 / T2：harness 本體已抽進
 * [`microFlickDeterminismHarness.ts`](microFlickDeterminismHarness.ts)，與 v9 的 NFR-68.3 共用同一
 * 份實作（C-D4：同一構念不開第二套實作）。本檔只保留 v8 的參數與斷言；下方的瞄準參數與交付時
 * 逐字相同，`wp68-v9-metrics-determinism.test.ts` 的同名常數則因靶更小而另有其值。
 */

const V8 = microFlickThreeTargetTestV8;

/**
 * 開火節奏：略大於 `usp_s_laser` 的 170 ms cycletime ⇒ 每次點擊恰一發。
 * 振幅交替 1.5°／9°、每 tick 收 3%：190 ms ≈ 24 ticks ⇒ 9° × 0.97^24 ≈ 4.3°，遠大於 v8 的 1.24°
 * 角半徑 ⇒ 首發必失手；小振幅同一時刻只剩 0.72° ⇒ 首發即命中。一份 trace 因此同時走過命中與失手
 * 兩條分支，逐位比對才不是在比兩條全命中的直線。
 */
const HARNESS = createMicroFlickHarness(V8, {
  expectedTicks: 900,
  approachAmplitudeDeg: [1.5, 9],
  approachDecay: 0.97,
  clickPeriodMs: 190,
});

describe('WP-63 T-exit — NFR-63.2：v8 的 tick trace 與四層指標跨 render FPS 逐位一致', () => {
  it('這份 trace 不是空對空：有 kill、有 hit 也有 miss、有真的 dYaw', () => {
    const fires = HARNESS.canonical.events.filter(
      (event): event is Extract<DrillEvent, { type: 'fire' }> => event.type === 'fire',
    );
    const visible = HARNESS.canonical.events.filter((event) => event.type === 'visible');

    expect(HARNESS.canonical.tickCount).toBe(HARNESS.expectedTicks);
    expect(fires.filter((fire) => fire.hit).length).toBeGreaterThan(5);
    expect(fires.filter((fire) => !fire.hit).length).toBeGreaterThan(5);
    // 三顆起始 + 每次擊殺補一顆 ⇒ visible 數必然大於 3。
    expect(visible.length).toBeGreaterThan(3);
    expect(HARNESS.canonical.ticks.some((tick) => (tick.dYaw ?? 0) !== 0)).toBe(true);
    // 指標四層都真的出數（否則下面的逐位比對是在比四個空殼）。
    expect(HARNESS.canonicalMetrics.outcome.n).toBeGreaterThan(1);
    expect(HARNESS.canonicalMetrics.geometry.shots.length).toBeGreaterThan(5);
    expect(HARNESS.canonicalMetrics.selection.n).toBeGreaterThan(1);
    expect(HARNESS.canonicalMetrics.microAdjust.n).toBeGreaterThan(0);
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
