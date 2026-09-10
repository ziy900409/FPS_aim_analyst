import { describe, expect, it } from 'vitest';
import { createSharedState } from '../../state/SharedState.ts';
import type { SharedState } from '../../state/SharedState.ts';
import { pushEvent } from '../../state/inputRingTestUtil.ts';
import { createDataRecorder } from '../../data/DataRecorder.ts';
import type { Clock } from '../clock.ts';
import { SIM_HZ } from '../constants.ts';
import { createSimLoop } from '../SimLoop.ts';
import { counterstrafeFreeV1 } from '../../drill/counterstrafe_free_v1.ts';
import { holdClickV1 } from '../../drill/hold_click_v1.ts';
import { DECLARED_WEAPON_BY_DRILL_ID } from '../../session/drillFamily.ts';
import { compileSessionProgram, type RunStep } from '../../session/sessionProgram.ts';
import { DEFAULT_WEAPON_ID, resolveActiveWeapon, WEAPONS } from '../../weapon/weapons.ts';

/**
 * WP-62 / T3 — NFR-62.2 / A-62.6：**同一 program（含逐列指定武器）+ 同一輸入序列，跨 render FPS
 * 的 sim 狀態逐位一致**。
 *
 * 本檔補上既有兩支決定性測試（`determinism.test.ts` movement、`fire-determinism.test.ts`
 * full-auto）沒有的維度：**同一次 session 內每一步換武器**。換武器會換掉彈匣容量、cycletime、
 * recoil 參數與 `inaccuracy` 三項——若 Session Plan 的接線把武器解析成 render 幀邊界的函式
 * （例如晚於 `buildSimLoop()` 才賦值 override），這裡的出彈序列與收尾狀態就會隨 FPS 分歧。
 *
 * 為何是「模擬 `activateDrill()`」而非直接跑 `main.ts`：`main.ts` 是 WebGPU + DOM 的 top-level
 * 腳本，vitest 起不動。但**唯一新增的邏輯**是「這一步該用哪把武器」，而它已經抽成
 * `resolveActiveWeapon()`（`weapons.ts` 單一定義，`main.ts` `activeWeaponConfig()` 的唯一實作）。
 * 本檔呼叫的是**那個函式本身**，不是它的副本（C-D4：既有構念不得有第二定義）；其下游
 * （`createSimLoop(..., weapon)` 重建 loop）是既有且已被上述兩支測試覆蓋的路徑。順序本身則由
 * `sessionWeaponActivation.test.ts` 的 `main.ts` source 掃描釘死。
 *
 * 斷言對象（CLAUDE.md §4）：逐 tick 的 sim **狀態**與出彈 tick index；**不**斷言 wall-clock。
 */

const TICK_MS = 1000 / SIM_HZ; // 7.8125（=125/16，float 精確）
const CLOCK_BASE = 0;
const END_MS = 2600; // 覆蓋 USP 12 發（最短彈匣）到 AK 30 發連發 span 的大部分 + 收尾
const SEED = 424_242; // 固定 seed：換武器不得引入新亂數來源（GD-5）

/** 一步 run 的實跑結果：解析出的武器 + 逐發出彈 + 收尾 sim 狀態。全部逐位比較。 */
interface StepRun {
  drillId: string;
  weaponId: string;
  /** `createSimLoop()` 建構當下即寫入；首個 tick 跑完仍須是同一把武器的容量（賦值順序）。 */
  magSizeAtBuild: number;
  magSizeAfterFirstTick: number;
  shots: { t: number; tick: number }[];
  ammo: number;
  heldFire: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  recoilIndex: number;
  aimPunchPitchDeg: number;
  aimPunchYawDeg: number;
  lastSpreadX: number;
  lastSpreadY: number;
  ticks: number;
}

/**
 * 合成輸入序列：先左右移動（讓 `inaccuracy.move` 這一項真的參與散佈），再按住左鍵不放連發到
 * 彈匣盡。同一份餵給每個 FPS 序列與每一步。
 */
function feedInputs(state: SharedState): void {
  pushEvent(state, { type: 'key', code: 'KeyD', down: true, t: 10 });
  pushEvent(state, { type: 'key', code: 'KeyD', down: false, t: 180 });
  pushEvent(state, { type: 'key', code: 'KeyA', down: true, t: 200 });
  pushEvent(state, { type: 'fire', down: true, t: 260 }); // 移動中開火（散佈含 move 項）
  pushEvent(state, { type: 'key', code: 'KeyA', down: false, t: 520 });
}

/**
 * 模擬 `activateDrill()` 對某個 run step 做的事：解析武器 → 以該武器重建 sim loop → 餵同一份
 * 輸入 → 依給定 frame 時間戳序列 pump。回傳可逐位比較的結果。
 */
function runStep(step: RunStep, absTimes: readonly number[]): StepRun {
  // 與 `main.ts` `activeWeaponConfig()` 同一條 precedence，同一個函式。
  const weapon = resolveActiveWeapon(step.weaponId, DECLARED_WEAPON_BY_DRILL_ID.get(step.drillId));
  const state = createSharedState();
  const clock: Clock = { now: () => CLOCK_BASE };
  const recorder = createDataRecorder({ simHz: SIM_HZ });
  const sim = createSimLoop(state, clock, SIM_HZ, undefined, undefined, undefined, recorder, weapon, SEED);
  const magSizeAtBuild = state.weapon.magSize;
  feedInputs(state);

  let ticks = 0;
  let magSizeAfterFirstTick = -1;
  for (const now of absTimes) {
    ticks += sim.pump(now).ticks;
    if (magSizeAfterFirstTick === -1 && ticks > 0) magSizeAfterFirstTick = state.weapon.magSize;
  }

  const snap = recorder.snapshot();
  const shots = snap.events
    .filter((e): e is Extract<typeof e, { type: 'fire' }> => e.type === 'fire')
    .map((f) => ({ t: f.t, tick: snap.ticks.findIndex((tk) => tk.t >= f.t) + 1 }));

  return {
    drillId: step.drillId,
    weaponId: weapon.id,
    magSizeAtBuild,
    magSizeAfterFirstTick,
    shots,
    ammo: state.weapon.ammo,
    heldFire: state.heldFire,
    x: state.curr.x,
    z: state.curr.z,
    vx: state.player.vx,
    vz: state.player.vz,
    recoilIndex: state.recoilState.recoilIndex,
    aimPunchPitchDeg: state.recoilState.aimPunchPitchDeg,
    aimPunchYawDeg: state.recoilState.aimPunchYawDeg,
    lastSpreadX: state.recoil.lastSpread.x,
    lastSpreadY: state.recoil.lastSpread.y,
    ticks,
  };
}

/** 穩定 FPS 幀序列：等距 `periodMs`，收尾對齊 `END_MS`。 */
function framesAt(periodMs: number): number[] {
  const abs: number[] = [];
  for (let t = periodMs; t < END_MS; t += periodMs) abs.push(t);
  if (abs.length === 0 || abs[abs.length - 1] < END_MS) abs.push(END_MS);
  return abs;
}

/** 抖動幀序列：決定性 LCG（不用 `Math.random`，守測試可重現）。 */
function jitterFrames(basePeriod: number): number[] {
  let seed = 1234567;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const abs: number[] = [];
  let t = 0;
  for (;;) {
    const d = basePeriod * (0.5 + rand()); // [0.5,1.5)·basePeriod，恆 < 250ms（不夾）
    if (t + d >= END_MS) break;
    t += d;
    abs.push(t);
  }
  abs.push(END_MS);
  return abs;
}

/** Ground truth：每幀恰一 tick。 */
function canonicalFrames(): number[] {
  const abs: number[] = [];
  for (let k = 1; k * TICK_MS <= END_MS; k += 1) abs.push(k * TICK_MS);
  return abs;
}

const BR_DECLARED_DRILL_ID = 'tracking_br_v1__ads_off__hitscan__0p5deg';
const BR_DECLARED_WEAPON_ID = 'ak47_br_hip_hitscan';

/**
 * 一份 program 走完本 WP 的三條 precedence 分支：
 *   1. 逐列指定武器（`m4a1s`，mag 20），`reps: 3` ⇒ 三輪都同一把（FR-62.3）；
 *   2. drill 自宣告武器（BR 實驗格，D-62-1 不可覆蓋）；
 *   3. 兩者皆無 ⇒ app 預設。
 */
const PROGRAM = compileSessionProgram({
  items: [
    { drillId: holdClickV1.id, reps: 3, weaponId: 'm4a1s' },
    { drillId: BR_DECLARED_DRILL_ID, reps: 1 },
    { drillId: counterstrafeFreeV1.drillId, reps: 1 },
  ],
  drillRestSeconds: 30,
  familyRestSeconds: 60,
});
const RUN_STEPS = PROGRAM.filter((step): step is RunStep => step.kind === 'run');

const SEQUENCES: Record<string, number[]> = {
  '穩定 60 Hz': framesAt(1000 / 60),
  '穩定 144 Hz': framesAt(1000 / 144),
  '穩定 240 Hz': framesAt(1000 / 240),
  '抖動 144 Hz ±50%': jitterFrames(1000 / 144),
};

const CANONICAL = RUN_STEPS.map((step) => runStep(step, canonicalFrames()));

describe('WP-62 T3 — 逐列武器的 program 跨 render FPS 逐位一致（NFR-62.2 / A-62.6）', () => {
  it('program 走完三條 precedence 分支，且 reps 的每一輪同一把（FR-62.3）', () => {
    expect(RUN_STEPS.map((step) => step.drillId)).toEqual([
      holdClickV1.id,
      holdClickV1.id,
      holdClickV1.id,
      BR_DECLARED_DRILL_ID,
      counterstrafeFreeV1.drillId,
    ]);
    // 三輪 rep 全部帶同一把指定武器，第四步落回 drill 自宣告，第五步落回 app 預設。
    expect(CANONICAL.map((run) => run.weaponId)).toEqual([
      'm4a1s',
      'm4a1s',
      'm4a1s',
      BR_DECLARED_WEAPON_ID,
      DEFAULT_WEAPON_ID,
    ]);
  });

  it('武器賦值早於 sim loop 建構：首 tick 的 magSize 已是本步武器的容量', () => {
    // 這是「順序錯了」最直接的失敗模式：override 若晚於 buildSimLoop() 才寫，這一格就會留著
    // 上一步（或 app 預設）的彈匣容量，而受測者會在該 run 中途無聲停火。
    for (const run of CANONICAL) {
      const expected = WEAPONS[run.weaponId as keyof typeof WEAPONS].magSize;
      expect(run.magSizeAtBuild).toBe(expected);
      expect(run.magSizeAfterFirstTick).toBe(expected);
    }
    // 而且這幾把武器的容量確實彼此不同 —— 否則上面那條斷言恆真、什麼都沒守住。
    expect(new Set(CANONICAL.map((run) => run.magSizeAtBuild)).size).toBeGreaterThan(1);
    expect(CANONICAL[0].magSizeAtBuild).toBe(WEAPONS.m4a1s.magSize);
    expect(CANONICAL[0].magSizeAtBuild).not.toBe(WEAPONS[DEFAULT_WEAPON_ID].magSize);
  });

  it('每一步都真的產彈（否則跨 FPS 比對是在比兩個空序列）', () => {
    for (const run of CANONICAL) {
      expect(run.shots.length).toBeGreaterThan(0);
      expect(run.recoilIndex).toBeGreaterThan(0);
    }
  });

  for (const [seqName, abs] of Object.entries(SEQUENCES)) {
    it(`${seqName}：整份 program 的逐步 sim 狀態 bit-exact 對齊 canonical`, () => {
      expect(RUN_STEPS.map((step) => runStep(step, abs))).toEqual(CANONICAL);
    });
  }

  it('四種 FPS 序列彼此 bit-exact 相等（不只是各自等於 canonical）', () => {
    const runs = Object.values(SEQUENCES).map((abs) => RUN_STEPS.map((step) => runStep(step, abs)));
    for (const run of runs) expect(run).toEqual(runs[0]);
  });

  it('重播 bit-exact：同一序列跑兩次完全一致（無時鐘／Math.random 洩漏）', () => {
    const abs = SEQUENCES['抖動 144 Hz ±50%'];
    expect(RUN_STEPS.map((step) => runStep(step, abs))).toEqual(RUN_STEPS.map((step) => runStep(step, abs)));
  });
});
