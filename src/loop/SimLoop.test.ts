import { describe, expect, it } from 'vitest';
import { createSharedState } from '../state/SharedState.ts';
import type { Clock } from './clock.ts';
import { SIM_HZ } from './constants.ts';
import { createSimLoop, simStep } from './SimLoop.ts';

/** 固定基準的注入式 clock（OQ-2.3）。 */
function fixedClock(t: number): Clock {
  return { now: () => t };
}

const TICK_MS = 1000 / SIM_HZ; // 7.8125（2 的冪，float 精確）

describe('SimLoop accumulator（固定 128 Hz）', () => {
  it('固定步進累積出正確 tick 數（64 幀 × 2 tick = 128 ticks/s）', () => {
    const state = createSharedState();
    const loop = createSimLoop(state, fixedClock(0), SIM_HZ);
    let total = 0;
    for (let f = 1; f <= 64; f++) {
      total += loop.pump(2 * TICK_MS * f).ticks; // 每幀 15.625ms = 2 ticks（精確）
    }
    expect(total).toBe(SIM_HZ); // 128，剛好 1 秒
  });

  it('大 spike 被夾住（單幀 500ms → 0.25s 對應 tick 數，不 spiral）', () => {
    const state = createSharedState();
    const loop = createSimLoop(state, fixedClock(0), SIM_HZ);
    const { ticks } = loop.pump(500);
    expect(ticks).toBe(0.25 * SIM_HZ); // 32，非 64（被 Math.min(.,0.25) 夾住）
  });

  it('alpha = 餘量 / TICK ∈ [0,1)', () => {
    const state = createSharedState();
    const loop = createSimLoop(state, fixedClock(0), SIM_HZ);
    const { ticks, alpha } = loop.pump(TICK_MS * 1.5); // 1 tick + 半 tick 餘量
    expect(ticks).toBe(1);
    expect(alpha).toBeCloseTo(0.5, 10);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });

  it('simStep 等速推進 x（純函式，只用 dtSec）+ 維護 prev/curr', () => {
    const state = createSharedState();
    state.player.vx = 128; // u/s
    simStep(state, 1 / SIM_HZ, 0); // 無輸入；tickEndMs 任意
    expect(state.player.x).toBeCloseTo(1, 12); // 128 × (1/128) = 1 u
    expect(state.prev.x).toBe(0); //                prev = 推進前位置（內插基準）
    expect(state.curr.x).toBe(state.player.x); //   curr = 推進後位置
  });

  it('輸入依 timeStamp 落入對應 tick 窗 toggle vx（決定性前提的最小機制）', () => {
    const state = createSharedState();
    // baseline=0；KeyD down @ t=2ms 應落在 tick1 窗 [0, 7.8125)
    state.input.push({ type: 'key', code: 'KeyD', down: true, t: 2 });
    const loop = createSimLoop(state, fixedClock(0), SIM_HZ);
    loop.pump(TICK_MS); // 跑 1 個 tick
    expect(state.player.vx).toBe(250); // KeyD 已消費 → snap 到 +STRAFE
    expect(state.input).toHaveLength(0); // 事件已消費出緩衝
  });

  it('未到期的事件不被提前消費（晚於本 tick 窗）', () => {
    const state = createSharedState();
    // KeyD @ t=20ms 落在 tick3（[15.625, 23.4375)），跑單一 tick 不應消費
    state.input.push({ type: 'key', code: 'KeyD', down: true, t: 20 });
    const loop = createSimLoop(state, fixedClock(0), SIM_HZ);
    loop.pump(TICK_MS); // 只跑 tick1，窗 [0,7.8125)
    expect(state.player.vx).toBe(0); // 尚未到期
    expect(state.input).toHaveLength(1); // 仍在緩衝
  });
});
