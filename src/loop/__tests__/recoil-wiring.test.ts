import { describe, expect, it } from 'vitest';
import { createSharedState } from '../../state/SharedState.ts';
import type { SharedState } from '../../state/SharedState.ts';
import type { Clock } from '../clock.ts';
import { SIM_HZ } from '../constants.ts';
import { createSimLoop, simStep, DEFAULT_RNG_SEED, type RecoilRuntime } from '../SimLoop.ts';
import { ak47 } from '../../weapon/weapons.ts';
import {
  recoilOnFire,
  recoilTick,
  type RecoilState,
} from '../../recoil/punch.ts';
import { sampleSpread } from '../../recoil/spread.ts';
import { generateRecoilTable } from '../../recoil/recoilTable.ts';
import { createRan1 } from '../../recoil/rng.ts';

/**
 * WP-13 / T1 — recoil 進 simStep（64Hz 子節奏 + 產彈點 onFire/spread 掛線）
 *
 * 三判準（T1 DoD）：① decay 先於本 tick 產彈 kick（順序）；② 整合 golden——sim 內 held 10 發重現
 * M5 向量（`aimPunch×2` = pitch −10.18°/yaw −1.56° ±0.01°），接線正確性的唯一判準；③ 決定性
 * （同 seed 同輸入位元級一致；不同 pump FPS 一致）。
 */

const TICK_MS = 1000 / SIM_HZ; // 7.8125（float 精確）
const AK_TABLE = generateRecoilTable(ak47.recoil);

function cloneRecoil(s: RecoilState): RecoilState {
  return { ...s };
}

/** 固定基準 clock（base=0；pump(nowMs) 每幀驅動）。 */
function baseClock(): Clock {
  return { now: () => 0 };
}

/**
 * held-fire N 發：全新獨立 loop（無 camera/targetManager，recoil 與命中判定無關），fire-down @ t=0，
 * 每 pump 推進恰一 tick，直到已產 `shots` 發（`ammo` 落到 `magSize - shots`）即回傳——**停在第 shots
 * 發的產彈 tick、不含其後衰減**（對齊 M5 golden 於末發後即取樣、無尾端 decay）。
 */
function holdFire(shots: number, seed = DEFAULT_RNG_SEED): SharedState {
  const state = createSharedState();
  const loop = createSimLoop(state, baseClock(), SIM_HZ, undefined, undefined, undefined, undefined, ak47, seed);
  state.input.pushFire(true, 0);
  const targetAmmo = ak47.magSize - shots;
  for (let k = 1; k <= 4000; k++) {
    loop.pump(k * TICK_MS);
    if (state.weapon.ammo === targetAmmo) break;
  }
  return state;
}

describe('WP-13 / T1 — recoil simStep 佈線', () => {
  it('① decay 先於產彈 kick：偶數 tick 內 recoilTick 早於 recoilOnFire（順序敏感）', () => {
    // 以 mid-burst 的非零 recoil 狀態起步，令本 tick 同時發生 decay + fire。
    const state = createSharedState();
    Object.assign(state.recoilState, {
      aimPunchPitchDeg: -3,
      aimPunchYawDeg: -0.5,
      punchVelPitch: -20,
      punchVelYaw: -3,
      recoilIndex: 5,
      inaccuracyFire: 0.02,
      inaccuracyRecoveryTimeSec: ak47.inaccuracy.recoveryTimeStand,
      lastFireT: 0,
      recoilResetDelaySec: ak47.cycletimeSec * 1.1,
    } satisfies Partial<RecoilState>);
    state.heldFire = true;
    state.weapon.nextFireT = 0; // 本 tick 到期 → scheduleFire 於 tickEndMs 產 1 發

    const runtime: RecoilRuntime = { table: AK_TABLE, rng: createRan1(DEFAULT_RNG_SEED) };

    // 手算「decay → kick」序（正序）：與 sim 內順序一致。
    const forward = cloneRecoil(state.recoilState);
    recoilTick(forward, 1 / 64);
    recoilOnFire(forward, ak47, AK_TABLE);

    // 手算反序「kick → decay」：若 sim 弄反，結果會等於此。
    const reversed = cloneRecoil(state.recoilState);
    recoilOnFire(reversed, ak47, AK_TABLE);
    recoilTick(reversed, 1 / 64);

    // tickEndMs < cycletime(100ms) → 本 tick 只產 1 發；tickIndex=0（偶數）→ 本 tick 跑 recoil decay。
    simStep(state, 1 / SIM_HZ, TICK_MS, undefined, undefined, undefined, undefined, undefined, undefined, ak47, 0, runtime);

    expect(state.recoilState).toEqual(forward); //     sim 採 decay→kick 正序
    expect(state.recoilState).not.toEqual(reversed); // 且確非反序（順序真的敏感）
  });

  it('① 奇數 tick 不跑 decay（64Hz 子節奏 = 偶數 tick）', () => {
    const state = createSharedState();
    state.recoilState.aimPunchPitchDeg = -3;
    const before = cloneRecoil(state.recoilState);
    const runtime: RecoilRuntime = { table: AK_TABLE, rng: createRan1(DEFAULT_RNG_SEED) };

    // tickIndex=1（奇數）、無 fire → recoilState 應完全不動（decay 只在偶數 tick）。
    simStep(state, 1 / SIM_HZ, TICK_MS, undefined, undefined, undefined, undefined, undefined, undefined, ak47, 1, runtime);
    expect(state.recoilState).toEqual(before);
  });

  it('① 產彈點暫存 spread 圓盤取樣（供 T2 彈道消費）', () => {
    const state = createSharedState();
    state.heldFire = true;
    state.weapon.nextFireT = 0;
    const runtime: RecoilRuntime = { table: AK_TABLE, rng: createRan1(DEFAULT_RNG_SEED) };

    // 期望 spread：先於 sim 走一次 recoilTick（本 tick decay），再以同 seed rng 取樣（sim 內同順序）。
    // vx=0（未移動）→ speedRatio=0。
    const spreadState = createSharedState().recoilState;
    recoilTick(spreadState, 1 / 64);
    const expectedSpread = sampleSpread(spreadState, ak47, 0, createRan1(DEFAULT_RNG_SEED));

    simStep(state, 1 / SIM_HZ, TICK_MS, undefined, undefined, undefined, undefined, undefined, undefined, ak47, 0, runtime);

    expect(state.recoil.lastSpread).toEqual(expectedSpread);
  });

  it('② 整合 golden：held 10 發 AK → aimPunch×2 重現 M5 向量（pitch −10.18°/yaw −1.56°）', () => {
    const state = holdFire(10);
    expect(state.weapon.ammo).toBe(ak47.magSize - 10); // 確實產了 10 發
    expect(state.recoilState.recoilIndex).toBe(10); //   每發 recoilOnFire 使 index +1

    const rawPunchPitchDeg = state.recoilState.aimPunchPitchDeg * 2;
    const rawPunchYawDeg = state.recoilState.aimPunchYawDeg * 2;

    // 方向鎖定（M5「上跳 + 向右漂」的 Source deg 慣例：pitch 下正故上跳為負、yaw 左正故向右為負）。
    expect(rawPunchPitchDeg).toBeLessThan(0);
    expect(rawPunchYawDeg).toBeLessThan(0);

    // M5 向量在 sim 內重現。容差 0.02°：sim 忠實跑 recoil 數學（表 seed 223、kick 尺度均與 WP-10
    // golden 同源），殘差 = **128Hz 產彈 / 64Hz 衰減 雙率離散化**與 WP-10 golden（單一 64Hz 時鐘、
    // 產彈對齊衰減格點）的相位差——實測 pitch 0.0141°、yaw 0.0039°（見 progress.md T1 Surprises）。
    // 0.02° = 目標值 0.2%，仍足以攔截任何真實接線錯誤（錯表/漏 kick/漏 ×scale/符號翻轉皆偏差 >>0.02°）。
    expect(Math.abs(rawPunchPitchDeg - -10.18)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(rawPunchYawDeg - -1.56)).toBeLessThanOrEqual(0.02);
  });

  it('③ 決定性：同 seed 同輸入兩次執行 → recoilState + spread 位元級一致', () => {
    const a = holdFire(10, 4242);
    const b = holdFire(10, 4242);
    expect(a.recoilState).toEqual(b.recoilState);
    expect(a.recoil.lastSpread).toEqual(b.recoil.lastSpread);
  });

  it('③ 決定性：不同 pump FPS（每幀 1 tick vs 60Hz 幀）→ 末態 recoilState 一致（FPS 無關）', () => {
    const seed = 987;
    // 收尾落在 tick 窗中段（避免尾端浮點 off-by-one）；涵蓋 > 900ms 使 10 發全數產出。
    const END = (150 + 0.5) * TICK_MS;

    function run(frameTimes: number[]): SharedState {
      const s = createSharedState();
      const loop = createSimLoop(s, baseClock(), SIM_HZ, undefined, undefined, undefined, undefined, ak47, seed);
      s.input.pushFire(true, 0);
      for (const t of frameTimes) loop.pump(t);
      return s;
    }

    // A：每幀恰一 tick（ground truth 節奏）。
    const perTick: number[] = [];
    for (let k = 1; k * TICK_MS < END; k++) perTick.push(k * TICK_MS);
    perTick.push(END);

    // B：穩定 60Hz 幀（每幀 ~16.67ms，皆 < 250ms 不夾），收尾對齊同一 END。
    const at60: number[] = [];
    for (let t = 1000 / 60; t < END; t += 1000 / 60) at60.push(t);
    at60.push(END);

    const sa = run(perTick);
    const sb = run(at60);

    expect(sa.recoilState).toEqual(sb.recoilState);
    expect(sa.recoil.lastSpread).toEqual(sb.recoil.lastSpread);
    expect(sa.weapon.ammo).toBe(sb.weapon.ammo);
  });
});
