import { describe, expect, it } from 'vitest';
import { createSharedState } from '../../state/SharedState.ts';
import type { SharedState } from '../../state/SharedState.ts';
import { pushEvent } from '../../state/inputRingTestUtil.ts';
import type { Clock } from '../clock.ts';
import { SIM_HZ } from '../constants.ts';
import { createSimLoop } from '../SimLoop.ts';

/**
 * KI-001 回歸 — sim 邏輯時鐘漂移（開火/鍵盤輸入嚴重延遲）
 *
 * 根因（KI-001 §2.1）:`pump` 把 frame delta 夾在 0.25s 避免 spiral of death,但 `simTimeMs`
 * 只以 1:1 前進——單次 >250ms 卡頓後,`simTimeMs` 永久落後真實時間(event.timeStamp 域),
 * 消費閘門 `tickEndMs=simTimeMs` 因而落在事件「未來」,開火/鍵盤事件延後數百 ms 才被消費。
 *
 * 修法(§2.4 INV-ReAnchor):>250ms 夾除生效時把 `simTimeMs` 重新錨定至真實 `nowMs`。
 *
 * 這兩條在**未修法時紅**(重現 KI-001)、在 re-anchor 修法後綠。時鐘一律量測時鐘域
 * (`performance.now()`/`event.timeStamp`,ADR-4),故本測試以絕對 ms 直接驅動 `pump`。
 */

const TICK_MS = 1000 / SIM_HZ; // 7.8125
const SPIRAL_CAP_MS = 250; // Math.min(delta, 0.25s) 的夾除門檻

/** 全新 state + base=0 clock 的 sim loop（不接 target/camera，focus 於輸入消費閘門）。 */
function freshLoop(): { state: SharedState; pump: (now: number) => void } {
  const state = createSharedState();
  const clock: Clock = { now: () => 0 };
  const sim = createSimLoop(state, clock, SIM_HZ);
  return { state, pump: (now: number) => void sim.pump(now) };
}

describe('KI-001 — sim 邏輯時鐘不因 >250ms 卡頓而永久漂移', () => {
  it('baseline（無卡頓）：開火事件於下一健康幀即被消費（heldFire 置真）', () => {
    const { state, pump } = freshLoop();
    // 真實時鐘域 t=10ms 開火;下一幀 now=20ms（跨 2 個 tick 窗）。
    pushEvent(state, { type: 'fire', down: true, t: 10 });
    pump(20);
    expect(state.heldFire).toBe(true);
  });

  it('單次 >250ms 卡頓後：真實域開火事件於下一健康幀被消費（延遲 ≤ 2 tick）', () => {
    const { state, pump } = freshLoop();

    // ① 一次 700ms 卡頓幀:rawDelta=700ms 被夾成 250ms → 32 ticks,simTimeMs 只前進 250ms
    //    （未修法時 simTimeMs=250,落後真實時間 450ms;修法後 re-anchor 至 700）。
    const stallNow = 700;
    pump(stallNow);

    // ② 卡頓「之後」到達的開火事件,戳的是真實時鐘域（≈ stallNow）。
    pushEvent(state, { type: 'fire', down: true, t: stallNow });

    // ③ 下一個健康幀,前進 2 個 tick（16ms > 1 tick）。
    //    未修法:tickEndMs≈258/266ms « 700 → 事件排不進本 tick,heldFire 維持 false（KI-001 症狀）。
    //    修法後:simTimeMs 已 re-anchor 至 700,tickEndMs≈708/716ms > 700 → 事件當幀被消費。
    pump(stallNow + 2 * TICK_MS + 1);

    expect(state.heldFire).toBe(true);
  });

  it('卡頓後邏輯時鐘不落後真實時間逾一個 tick（re-anchor 收斂）', () => {
    const { state, pump } = freshLoop();
    const stallNow = 1000;
    pump(stallNow); // >250ms（首幀 base=0 → delta=1000ms）夾除
    // 再跑一個健康幀推進 ≥1 tick,把 fire 消費出來;若邏輯時鐘仍落後數百 ms,事件永遠排不掉。
    pushEvent(state, { type: 'fire', down: true, t: stallNow });
    pump(stallNow + SPIRAL_CAP_MS - 1); // 249ms 健康幀（< 250，不再觸發夾除）
    expect(state.heldFire).toBe(true);
  });
});
