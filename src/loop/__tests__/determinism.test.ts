import { describe, expect, it } from 'vitest';
import { createSharedState } from '../../state/SharedState.ts';
import type { SharedState } from '../../state/SharedState.ts';
import type { InputEvent } from '../../state/types.ts';
import { pushEvent } from '../../state/inputRingTestUtil.ts';
import type { Clock } from '../clock.ts';
import { SIM_HZ } from '../constants.ts';
import { createSimLoop } from '../SimLoop.ts';

/**
 * 決定性驗證 ★M1 gate — WP-2 / T4（FR-2.4）
 *
 * 證明：**給定相同輸入事件序列（含 timeStamp），sim 的逐 tick 輸出與 render FPS（frame
 * delta 序列）無關**。這是整個量測工具效度的基石（規格 §6、ADR-7 兩時鐘）。
 *
 * 決定性根源（見 SimLoop.ts）：`simStep` 只用固定 `TICK` 推進、事件依 `timeStamp` 落入
 * tick 邏輯窗 `[.. , k·tickMs)` 消費；而 tick 窗只由「已跑第幾個 tick」決定（`simTimeMs`
 * 每 tick +tickMs，與 render frame 邊界無關）。故第 k 個 tick 後的狀態與「分幾次餵」無關。
 *
 * 斷言對象（ADR-7）：逐 **tick index** 的 sim **狀態** `{x,z,vx,vz}`；**不**斷言 wall-clock
 * `t_visible`（本質非決定性）。浮點採 **exact 相等**（本佔位邏輯的數值 float 精確，見下）。
 */

const TICK_MS = 1000 / SIM_HZ; // 7.8125（=125/16，float 精確）
const CLOCK_BASE = 0; //          注入 clock 基準；tick 窗 = [ (k-1)·tickMs, k·tickMs )

/** 每幀快照：curr（內插基準，= 該幀最後一個 tick 後位置）+ 當前 velocity。 */
interface FullSnap {
  x: number;
  z: number;
  vx: number;
  vz: number;
}
/** 每幀記錄：至此累積 tick 數 + 狀態快照。 */
interface Sample {
  ticks: number;
  snap: FullSnap;
}

/**
 * 合成輸入序列（OQ-2.1）：固定 timeStamp 切換 vx；同一份餵所有 FPS 序列。
 * 事件時間戳橫跨數個 tick 窗，足以暴露「誤把 frame delta 當 sim dt」的 frame-dependent bug。
 */
function syntheticInputs(): InputEvent[] {
  return [
    { type: 'key', code: 'KeyD', down: true, t: 10 }, //   起步加速（落 tick2 窗 [7.8125,15.625)）
    { type: 'key', code: 'KeyD', down: false, t: 100 }, //  0
    { type: 'key', code: 'KeyA', down: true, t: 150 }, //  左向加速
    { type: 'key', code: 'KeyA', down: false, t: 300 }, //  0
  ];
}

/** 全新獨立 state，預載合成輸入的**副本**（避免跨序列共享/汙染）。 */
function freshState(): SharedState {
  const s = createSharedState();
  for (const ev of syntheticInputs()) pushEvent(s, ev); // 編碼寫入 ring（取代 plain-array push）
  return s;
}

function snap(s: SharedState): FullSnap {
  return { x: s.curr.x, z: s.curr.z, vx: s.player.vx, vz: s.player.vz };
}

/**
 * 以一組**絕對** frame 時間戳（ms，量測時鐘域）驅動 `pump`，每幀記錄累積 tick 數 + 快照。
 * clock 只提供 base（=0）；真正每幀驅動源是 `pump(now)`（正式/測試共用同一函式，OQ-2.3）。
 */
function runFrames(absTimes: number[]): Sample[] {
  const state = freshState();
  const clock: Clock = { now: () => CLOCK_BASE };
  const sim = createSimLoop(state, clock, SIM_HZ);
  const out: Sample[] = [];
  let total = 0;
  for (const now of absTimes) {
    total += sim.pump(now).ticks;
    out.push({ ticks: total, snap: snap(state) });
  }
  return out;
}

/**
 * Ground truth：每幀恰好餵一個 tick（`pump(k·tickMs)` → 每次 +tickSec → 1 tick），
 * 得到 per-tick 軌跡（索引 k-1 = 跑完第 k 個 tick 後的狀態）。float 精確、bit-exact。
 */
function canonicalTrajectory(nTicks: number): FullSnap[] {
  const abs: number[] = [];
  for (let k = 1; k <= nTicks; k++) abs.push(k * TICK_MS);
  return runFrames(abs).map((s) => s.snap);
}

/**
 * 穩定 FPS 幀序列：等距 `periodMs`，收尾對齊到 `endMs`（相同總模擬時間，避免尾端浮點
 * off-by-one；`endMs` 落在 tick 窗中段 → 少數 ULP 抖動不改變 tick 數）。
 */
function framesAt(periodMs: number, endMs: number): number[] {
  const abs: number[] = [];
  for (let t = periodMs; t < endMs; t += periodMs) abs.push(t);
  if (abs.length === 0 || abs[abs.length - 1] < endMs) abs.push(endMs);
  return abs;
}

/** 抖動幀序列：以決定性 LCG（**不**用 Math.random，守測試可重現）在 basePeriod 上下抖 ±50%。 */
function jitterFrames(basePeriod: number, endMs: number): number[] {
  let seed = 1234567;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const abs: number[] = [];
  let t = 0;
  for (;;) {
    const d = basePeriod * (0.5 + rand()); // [0.5, 1.5)·basePeriod，恆 < 250ms（不夾）
    if (t + d >= endMs) break;
    t += d;
    abs.push(t);
  }
  abs.push(endMs);
  return abs;
}

// 總模擬時間落在第 64 個 tick 窗中段（64.5·tickMs），穩定跑 64 ticks；所有序列共用。
const EXPECTED_TICKS = 64;
const END_MS = (EXPECTED_TICKS + 0.5) * TICK_MS; // 503.90625ms
const GROUND = canonicalTrajectory(EXPECTED_TICKS);

describe('決定性驗證 ★M1 gate — 同輸入序列、不同 render FPS → 逐 tick 一致（FR-2.4）', () => {
  const sequences: Record<string, number[]> = {
    '穩定 60 Hz': framesAt(1000 / 60, END_MS),
    '穩定 144 Hz': framesAt(1000 / 144, END_MS),
    '穩定 240 Hz': framesAt(1000 / 240, END_MS),
    '抖動 144 Hz ±50%': jitterFrames(1000 / 144, END_MS),
  };

  for (const [name, abs] of Object.entries(sequences)) {
    it(`${name}：每幀狀態 exact 對齊 ground-truth per-tick 軌跡`, () => {
      const samples = runFrames(abs);
      // 相同總模擬時間 ⇒ 相同總 tick 數（與 render FPS 無關）。
      expect(samples[samples.length - 1].ticks).toBe(EXPECTED_TICKS);
      for (const s of samples) {
        if (s.ticks === 0) continue; // 尚未跑任何 tick 的前導幀（如 240Hz 首幀 < 1 tick）
        // 逐 tick index 全等：本幀跑到第 s.ticks 個 tick，須等於 canonical 第 s.ticks 個 tick 後狀態。
        expect(s.snap).toEqual(GROUND[s.ticks - 1]);
      }
    });
  }

  it('四種 FPS 序列的最終狀態彼此 bit-exact 相等（= ground truth 第 64 tick）', () => {
    const expected = GROUND[EXPECTED_TICKS - 1];
    for (const abs of Object.values(sequences)) {
      expect(runFrames(abs)[runFrames(abs).length - 1].snap).toEqual(expected);
    }
  });

  it('事件確於同一 tick index 落點（vx 於固定 tick 切換，與 FPS 無關）', () => {
    // KeyD@10 → tick2 消費（窗 [7.8125,15.625) 含 10）：ground[0]（tick1）vx=0、ground[1]（tick2）起步加速。
    expect(GROUND[0].vx).toBe(0);
    expect(GROUND[1].vx).toBeCloseTo(10.9375, 12);
    // x 只在 vx≠0 的 tick 推進；tick2 後 x = 10.9375·(1/128)。
    expect(GROUND[1].x).toBeCloseTo(10.9375 / SIM_HZ, 12);
  });
});

describe('邊界：大 gap 的夾除行為明確、不產生分歧（背景分頁 / 卡頓）', () => {
  it('大 unclamped gap（200ms 單幀）與多小幀切分 → 結果 bit-exact 相同', () => {
    // 200ms < 250ms 不夾。兩者共用同一收尾（每幀 ≤250ms，皆不夾），只差 [0,200] 的切分方式。
    const tail = framesAt(1000 / 60, END_MS).filter((t) => t > 200);
    const single = [200, ...tail]; // 一個 200ms 大幀
    const chopped: number[] = [];
    for (let t = 5; t <= 200; t += 5) chopped.push(t); // 40 個 5ms 小幀
    chopped.push(...tail);

    const a = runFrames(single);
    const b = runFrames(chopped);
    expect(a[a.length - 1].ticks).toBe(b[b.length - 1].ticks);
    expect(a[a.length - 1].snap).toEqual(b[b.length - 1].snap);
    expect(a[a.length - 1].ticks).toBe(EXPECTED_TICKS); // 收斂到同一總模擬時間
  });

  it('單一 >250ms spike（300ms）夾成 32 ticks（0.25s·128），不 spiral of death', () => {
    const s = runFrames([300]);
    expect(s[s.length - 1].ticks).toBe(0.25 * SIM_HZ); // 32，非 38；Math.min(δ,0.25) 夾住
  });

  it('含多次 spike 的序列於重播下 bit-exact 相同（夾除為決定性、非隨機/wall-clock）', () => {
    // 兩次 >250ms spike 分布不同位置；重播兩次應完全一致（無 Date.now()/Math.random() 洩漏）。
    const seq = [50, 400, 80, 60, 350, 40, END_MS];
    expect(runFrames(seq)).toEqual(runFrames(seq));
  });
});
