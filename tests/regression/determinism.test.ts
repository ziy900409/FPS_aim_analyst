import { describe, expect, it } from 'vitest';
import drillJson from '../../drills/counterstrafe_ad_v1.json';
import { createSharedState, type SharedState } from '../../src/state/SharedState.ts';
import { pushEvent } from '../../src/state/inputRingTestUtil.ts';
import type { InputEvent } from '../../src/state/types.ts';
import type { Clock } from '../../src/loop/clock.ts';
import { SIM_HZ } from '../../src/loop/constants.ts';
import { createSimLoop } from '../../src/loop/SimLoop.ts';
import { createTargetManager } from '../../src/sim/TargetManager.ts';
import { createDrillRunner } from '../../src/drill/DrillRunner.ts';
import { createDataRecorder, type DataRecorderSnapshot } from '../../src/data/DataRecorder.ts';
import { loadDrill } from '../../src/drill/DrillLoader.ts';

/**
 * 決定性回歸（自動化）★M1 守護 — WP-9 / T3（FR-9.3）
 *
 * WP-2 T4 的決定性驗證只涵蓋**純 movement**（`SimLoop` + 位移）。本回歸把它**升級為完整 sim**：
 * 同一條與生產同源的管線——`createSimLoop` + `MovementController`（movement / 反向鍵急停）+
 * `consume`（依 timeStamp 消費輸入 ring）+ `TargetManager`/`DrillRunner`（countdown→running→spawn/
 * 可見性、以 sim clock 蓋 `t_visible`）+ `DataRecorder`（逐 tick + 事件記錄）——在**多種 render FPS
 * 幀序列**下驅動，斷言**逐 tick sim 狀態**與**整份記錄資料集**（ticks + events）皆 render-FPS 無關。
 *
 * 守護對象（CLAUDE.md §4 / 規格 §6 / ADR-3,7）：任何後續改動若偷渡 frame delta 進 sim（誤把
 * frame dt 當 tick dt、把 `t_visible`/急停判定綁到 rAF 幀邊界），會使不同 FPS 的逐 tick 狀態或
 * 記錄資料分歧 → 本測試紅燈擋下（這是整個計時效度的根，README failure-mode「決定性退化」）。
 *
 * **範圍**：斷言逐 **tick index** 的 sim **狀態** `{x,z,vx,vz,stopped}` 與記錄資料集（ADR-7）；
 * **不**涵蓋 hit-detection（命中依 camera 朝向，屬每-幀外部耦合、非 sim 狀態；由 T1 E2E 在真瀏覽器
 * 以 per-tick 瞄準覆蓋）。故此處管線**不注入 camera**，fire 事件記錄但不判命中（`hit=false`）。
 * 浮點採 **exact 相等**（本階段 A snap 邏輯數值 float 精確）。
 */

const TICK_MS = 1000 / SIM_HZ; // 7.8125（=125/16，float 精確）
const CLOCK_BASE = 0; //          注入 clock 基準；simTimeMs 從此起、每 tick +tickMs

/** 完整 sim 逐 tick 狀態快照（含急停 flag，較 WP-2 T4 多 `stopped`，涵蓋 WP-5 T4 反向鍵急停）。 */
interface FullSnap {
  x: number;
  z: number;
  vx: number;
  vz: number;
  stopped: boolean;
}
/** 每幀記錄：至此累積 tick 數 + 狀態快照。 */
interface Sample {
  ticks: number;
  snap: FullSnap;
}
/** 一次完整跑的產物：逐幀樣本 + 最終記錄資料集快照 + 收尾相位。 */
interface RunResult {
  samples: Sample[];
  snapshot: DataRecorderSnapshot;
  phase: string;
}

/**
 * 合成輸入序列（量測時鐘域絕對 ms，同一份餵所有 FPS 序列）。時間戳皆落在 drill running 相位
 * （countdown 3000ms 之後），交替驅動：右移 → 反向鍵急停（記 counter 'A'）→ 停止態開火 → 放開 →
 * 左移 → 反向鍵急停（記 counter 'D'）→ 開火 → 放開。fire 單發以 down→up 表示；橫跨數個 tick 窗，
 * 足以暴露 frame-dependent bug。
 */
function syntheticInputs(): InputEvent[] {
  return [
    { type: 'key', code: 'KeyD', down: true, t: 3100 }, //  右移 +vStrafe
    { type: 'key', code: 'KeyA', down: true, t: 3250 }, //  移動中按反向鍵 A → 急停（counter 'A'）
    { type: 'fire', down: true, t: 3300 }, //                 停止態開火（residualSpeed=0）
    { type: 'fire', down: false, t: 3301 },
    { type: 'key', code: 'KeyD', down: false, t: 3350 }, //  放開兩鍵（held 皆 false → vx=0）
    { type: 'key', code: 'KeyA', down: false, t: 3350 },
    { type: 'key', code: 'KeyA', down: true, t: 3450 }, //  左移 −vStrafe（vx 曾為 0 → 非 counter）
    { type: 'key', code: 'KeyD', down: true, t: 3600 }, //  移動中按反向鍵 D → 急停（counter 'D'）
    { type: 'fire', down: true, t: 3650 },
    { type: 'fire', down: false, t: 3651 },
    { type: 'key', code: 'KeyA', down: false, t: 3700 }, //  放開兩鍵
    { type: 'key', code: 'KeyD', down: false, t: 3700 },
  ];
}

const CONFIG = loadDrill(drillJson); // 真 drill（countdownMs=3000、targetCount=20、LR 交替）

function snap(s: SharedState): FullSnap {
  return { x: s.curr.x, z: s.curr.z, vx: s.player.vx, vz: s.player.vz, stopped: s.player.stopped };
}

/**
 * 以一組**絕對** frame 時間戳（ms，量測時鐘域）驅動完整 sim 管線，每幀記錄累積 tick 數 + 快照；
 * 收尾回傳 DataRecorder 快照（逐 tick + 事件）與相位。clock 只提供 base（=0）；真正每幀驅動源是
 * `pump(now)`（正式/測試共用同一函式）。**不注入 camera**（命中屬外部每-幀耦合，見檔頭範圍說明）。
 */
function runFrames(absTimes: number[]): RunResult {
  const state = createSharedState();
  const clock: Clock = { now: () => CLOCK_BASE };
  const recorder = createDataRecorder({ simHz: SIM_HZ });
  const targetManager = createTargetManager(CONFIG);
  const drillRunner = createDrillRunner(state, targetManager);
  const sim = createSimLoop(state, clock, SIM_HZ, targetManager, undefined, drillRunner, recorder);
  drillRunner.start(CONFIG); // 先 start（其 resetState 會 clear 輸入 ring）……
  for (const ev of syntheticInputs()) pushEvent(state, ev); // ……再 up-front 全推合成輸入（避免被 reset 清掉）

  const samples: Sample[] = [];
  let total = 0;
  for (const now of absTimes) {
    total += sim.pump(now).ticks;
    samples.push({ ticks: total, snap: snap(state) });
  }
  return { samples, snapshot: recorder.snapshot(), phase: drillRunner.phase };
}

/**
 * Ground truth：每幀恰好餵一個 tick（`pump(k·tickMs)` → 每次 +tickSec → 1 tick），得到 per-tick
 * 軌跡（索引 k-1 = 跑完第 k 個 tick 後狀態）+ canonical 記錄資料集。float 精確、bit-exact。
 */
function canonicalRun(nTicks: number): RunResult {
  const abs: number[] = [];
  for (let k = 1; k <= nTicks; k++) abs.push(k * TICK_MS);
  return runFrames(abs);
}

/** 穩定 FPS 幀序列：等距 `periodMs`，收尾對齊到 `endMs`（相同總模擬時間，避免尾端浮點 off-by-one）。 */
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

// 總模擬時間落在第 EXPECTED_TICKS 個 tick 窗中段，穩定跑該 tick 數；所有序列共用。
// END 覆蓋整段合成輸入（末事件 3700ms）+ 收尾，落在 running 相位（無 camera → 無擊殺 → 不 ended）。
const EXPECTED_TICKS = 499;
const END_MS = (EXPECTED_TICKS + 0.5) * TICK_MS; // 3902.34375ms
const CANON = canonicalRun(EXPECTED_TICKS);
const GROUND: FullSnap[] = CANON.samples.map((s) => s.snap);

const sequences: Record<string, number[]> = {
  '穩定 60 Hz': framesAt(1000 / 60, END_MS),
  '穩定 144 Hz': framesAt(1000 / 144, END_MS),
  '穩定 240 Hz': framesAt(1000 / 240, END_MS),
  '抖動 144 Hz ±50%': jitterFrames(1000 / 144, END_MS),
};

describe('決定性回歸（完整 sim）★M1 守護 — 同輸入序列、不同 render FPS → 逐 tick 狀態一致（FR-9.3）', () => {
  for (const [name, abs] of Object.entries(sequences)) {
    it(`${name}：每幀狀態 exact 對齊 ground-truth per-tick 軌跡`, () => {
      const { samples } = runFrames(abs);
      // 相同總模擬時間 ⇒ 相同總 tick 數（與 render FPS 無關）。
      expect(samples[samples.length - 1].ticks).toBe(EXPECTED_TICKS);
      for (const s of samples) {
        if (s.ticks === 0) continue; // 尚未跑任何 tick 的前導幀
        // 逐 tick index 全等：本幀跑到第 s.ticks 個 tick，須等於 canonical 第 s.ticks 個 tick 後狀態。
        expect(s.snap).toEqual(GROUND[s.ticks - 1]);
      }
    });
  }

  it('四種 FPS 序列的最終狀態彼此 bit-exact 相等（= ground truth 第 499 tick）', () => {
    const expected = GROUND[EXPECTED_TICKS - 1];
    for (const abs of Object.values(sequences)) {
      const { samples } = runFrames(abs);
      expect(samples[samples.length - 1].snap).toEqual(expected);
    }
  });
});

describe('決定性回歸（完整 sim）— 記錄資料集（ticks + events）render-FPS 無關（FR-9.3）', () => {
  for (const [name, abs] of Object.entries(sequences)) {
    it(`${name}：DataRecorder 快照（逐 tick + 事件）與 canonical bit-exact 相等`, () => {
      const { snapshot, phase } = runFrames(abs);
      // 整份匯出來源（ticks 陣列 + 事件序列 + overflow 旗標）逐欄深度相等 → 匯出資料 FPS 無關。
      expect(snapshot).toEqual(CANON.snapshot);
      // drill 相位轉換（countdown→running）以 sim clock 判定，故與 FPS 無關（同 canonical）。
      expect(phase).toBe(CANON.phase);
    });
  }
});

describe('決定性回歸（完整 sim）— 完整 sim 邏輯確實被涵蓋（movement / 急停 / 輸入消費 / 目標）', () => {
  it('countdown→running：drill 於 running 相位、生成首目標並蓋一次 t_visible（sim clock 時間源）', () => {
    // countdownMs=3000；running 起於 nowMs−countdownStart≥3000 的 tick，與 FPS 無關。無擊殺 → 停在 running。
    expect(CANON.phase).toBe('running');
    const visible = CANON.snapshot.events.filter((e) => e.type === 'visible');
    expect(visible.length).toBe(1); // 單 active 目標、無擊殺補生
    expect(visible[0]).toMatchObject({ type: 'visible', side: 'L' }); // LR 交替首側 = L
    // t_visible 蓋在 sim tick 邊界（tickMs 倍數），非 rAF/Date.now。
    expect((visible[0] as { t: number }).t % TICK_MS).toBeCloseTo(0, 9);
  });

  it('反向鍵急停（WP-5 T4）：兩次 counter 事件於固定 t，且急停 tick 的 vx=0 / stopped=true', () => {
    const counters = CANON.snapshot.events.filter((e) => e.type === 'counter');
    // 右移按 A → counter 'A'；左移按 D → counter 'D'（順序即發生序）。
    expect(counters.map((e) => (e as { key: string }).key)).toEqual(['A', 'D']);
    // 急停穿越 tick：該 tick 末 vx 歸零且 stopped=true（GROUND 中至少存在此狀態）。
    const stoppedTicks = GROUND.filter((g) => g.stopped);
    expect(stoppedTicks.length).toBeGreaterThan(0);
    for (const g of stoppedTicks) expect(g.vx).toBe(0);
  });

  it('movement / 輸入消費：曾達左右兩方向的 ±vStrafe（250），位移由固定 tick dt 累積（非 frame dt）', () => {
    const vxs = GROUND.map((g) => g.vx);
    expect(Math.max(...vxs)).toBe(250); // 右移曾達 +vStrafe
    expect(Math.min(...vxs)).toBe(-250); // 左移曾達 −vStrafe
    // z 軸階段 A 無前後移動（vz 恆 0）。
    expect(GROUND.every((g) => g.vz === 0 && g.z === 0)).toBe(true);
  });

  it('開火事件：兩次 fire 皆記錄（無 camera → hit=false、residualSpeed=0，命中判定由 T1 E2E 覆蓋）', () => {
    const fires = CANON.snapshot.events.filter((e) => e.type === 'fire');
    expect(fires.length).toBe(2);
    for (const f of fires) {
      expect(f).toMatchObject({ type: 'fire', hit: false, residualSpeed: 0 });
    }
  });
});

describe('決定性回歸（完整 sim）— 重播 bit-exact（無 Date.now / Math.random 洩漏）', () => {
  it('同一 FPS 序列重播兩次 → 逐幀樣本 + 記錄資料集完全一致', () => {
    const seq = sequences['抖動 144 Hz ±50%'];
    const a = runFrames(seq);
    const b = runFrames(seq);
    expect(a.samples).toEqual(b.samples);
    expect(a.snapshot).toEqual(b.snapshot);
  });

  it('大 gap 單幀與多小幀切分（皆 <250ms 不夾）→ 最終狀態 + tick 數 bit-exact 相同', () => {
    // 同一收尾（每幀 ≤200ms 皆不夾），只差 running 後 [3000,3200] 的切分方式。
    const tail = framesAt(1000 / 60, END_MS).filter((t) => t > 3200);
    const single = [3000, 3200, ...tail]; // 200ms 大幀
    const chopped: number[] = [3000];
    for (let t = 3010; t <= 3200; t += 10) chopped.push(t); // 20ms→10ms 小幀切分
    chopped.push(...tail);

    const a = runFrames(single);
    const b = runFrames(chopped);
    expect(a.samples[a.samples.length - 1].ticks).toBe(b.samples[b.samples.length - 1].ticks);
    expect(a.samples[a.samples.length - 1].snap).toEqual(b.samples[b.samples.length - 1].snap);
    expect(a.snapshot).toEqual(b.snapshot);
  });
});
