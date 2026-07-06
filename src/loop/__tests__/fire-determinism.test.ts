import { describe, expect, it } from 'vitest';
import { createSharedState } from '../../state/SharedState.ts';
import { pushEvent } from '../../state/inputRingTestUtil.ts';
import { createDataRecorder } from '../../data/DataRecorder.ts';
import type { Clock } from '../clock.ts';
import { SIM_HZ } from '../constants.ts';
import { createSimLoop } from '../SimLoop.ts';
import { ak47, m4a4, m4a1s } from '../../weapon/weapons.ts';
import type { WeaponConfig } from '../../weapon/WeaponConfig.ts';

/**
 * 連發（full-auto）決定性回歸 ★WP-11 T-exit 閘 — 同輸入序列、不同 render FPS → 出彈序列一致
 *
 * WP-2/T4 與 tests/regression 的決定性回歸涵蓋 movement / 急停 / 單發 fire；本檔補上 WP-11 的
 * **cycletime full-auto 產彈**維度:按住左鍵不放,由 `scheduleFire` 依武器 cycletime 在 tick 內
 * 累加產彈直到彈匣盡(OQ-S2-6:彈匣盡即停火)。
 *
 * 決定性根源(見 SimLoop.ts `scheduleFire`):`nextFireT` 以 `cycletimeSec*1000` **累加**(非
 * `now + cycletime` 重設),且落點只由累積 sim 時間決定(`consume` 依 timeStamp 分桶、`simTimeMs`
 * 每 tick +tickMs)——與 render frame 邊界無關。任何把 frame delta / rAF 幀邊界偷渡進產彈排程的
 * 改動(README failure-mode「排程漂移,pattern 全歪」)會使不同 FPS 的出彈 tick index 序列分歧
 * → 本測試紅燈擋下。
 *
 * 斷言對象:逐發**出彈 tick index 序列**與**排程時刻序列**在 60/144/240/抖動 FPS 下逐位 bit-exact
 * 一致(= canonical 每幀一 tick 的 ground truth)。不注入 camera/target → fire 記 miss、無擊殺,
 * 專測產彈排程本身。
 */

const TICK_MS = 1000 / SIM_HZ; // 7.8125（=125/16，float 精確）
const CLOCK_BASE = 0;
const FIRE_DOWN_MS = 50; // 按下左鍵時刻（量測時鐘域 ms）；首發 nextFireT = 此值
const END_MS = 3200; // 覆蓋最長彈匣(AK 30 發 ×100ms = 2900ms span，末發 2950ms)+ 收尾

/** 一次連發跑的產物:逐發 {排程時刻 t, 出彈 tick index} + 收尾彈匣/held 狀態 + 總 tick 數。 */
interface FireRun {
  shots: { t: number; tick: number }[];
  ammo: number;
  heldFire: boolean;
  ticks: number;
}

/**
 * 以一組**絕對** frame 時間戳(ms)驅動 `pump`,`FIRE_DOWN_MS` 按下左鍵後**不放**(不推 fire-up),
 * 由 scheduler 連發至彈匣盡。回傳逐發排程時刻與出彈 tick index(由記錄的 tick 邊界回推,
 * **非計算**得出,故確為實跑結果)。不注入 target/camera/drillRunner → 彈匣不被 spawn 重置。
 */
function runFire(weapon: WeaponConfig, absTimes: number[]): FireRun {
  const state = createSharedState();
  const clock: Clock = { now: () => CLOCK_BASE };
  const recorder = createDataRecorder({ simHz: SIM_HZ });
  const sim = createSimLoop(state, clock, SIM_HZ, undefined, undefined, undefined, recorder, weapon);
  pushEvent(state, { type: 'fire', down: true, t: FIRE_DOWN_MS }); // 按住不放

  let ticks = 0;
  for (const now of absTimes) ticks += sim.pump(now).ticks;

  const snap = recorder.snapshot();
  // 每個 tick 記錄的 `t` = 該 tick 的 tickEndMs;某發(排程時刻 fireT)於「首個 tickEndMs ≥ fireT」
  // 的 tick 內產出 → 該 tick 的 1-based index。tick 邊界與 FPS 無關,故 index 亦與 FPS 無關。
  const shots = snap.events
    .filter((e): e is Extract<typeof e, { type: 'fire' }> => e.type === 'fire')
    .map((f) => ({ t: f.t, tick: snap.ticks.findIndex((tk) => tk.t >= f.t) + 1 }));

  return { shots, ammo: state.weapon.ammo, heldFire: state.heldFire, ticks };
}

/** Ground truth:每幀恰一 tick(`pump(k·tickMs)`)。 */
function canonicalFire(weapon: WeaponConfig): FireRun {
  const abs: number[] = [];
  for (let k = 1; k * TICK_MS <= END_MS; k++) abs.push(k * TICK_MS);
  return runFire(weapon, abs);
}

/** 穩定 FPS 幀序列:等距 `periodMs`,收尾對齊 `END_MS`。 */
function framesAt(periodMs: number): number[] {
  const abs: number[] = [];
  for (let t = periodMs; t < END_MS; t += periodMs) abs.push(t);
  if (abs.length === 0 || abs[abs.length - 1] < END_MS) abs.push(END_MS);
  return abs;
}

/** 抖動幀序列:決定性 LCG(不用 Math.random)在 basePeriod 上下抖 ±50%。 */
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

const sequences: Record<string, number[]> = {
  '穩定 60 Hz': framesAt(1000 / 60),
  '穩定 144 Hz': framesAt(1000 / 144),
  '穩定 240 Hz': framesAt(1000 / 240),
  '抖動 144 Hz ±50%': jitterFrames(1000 / 144),
};

const weapons: { name: string; weapon: WeaponConfig }[] = [
  { name: 'AK-47 (cycletime 100ms, mag 30)', weapon: ak47 },
  { name: 'M4A4 (cycletime 90ms, mag 30)', weapon: m4a4 },
  { name: 'M4A1-S (cycletime 100ms, mag 20)', weapon: m4a1s },
];

describe('連發決定性 ★WP-11 T-exit — 同輸入序列、不同 render FPS → 出彈 tick index 序列逐位一致', () => {
  for (const { name, weapon } of weapons) {
    describe(name, () => {
      const canon = canonicalFire(weapon);

      it('canonical:恰產滿一匣、以累加制 span=(mag−1)·cycletime、收尾彈匣盡且 heldFire 解除', () => {
        const cycleMs = weapon.cycletimeSec * 1000;
        expect(canon.shots.length).toBe(weapon.magSize); // 彈匣盡即停火(OQ-S2-6)
        expect(canon.ammo).toBe(0);
        expect(canon.heldFire).toBe(false); // ammo=0 自動解除 heldFire，避免 stuck-fire
        // 首發於按下時刻;逐發累加 cycletime(防漂移):span = (mag−1)·cycletime。
        expect(canon.shots[0].t).toBe(FIRE_DOWN_MS);
        expect(canon.shots[canon.shots.length - 1].t - canon.shots[0].t).toBe((weapon.magSize - 1) * cycleMs);
        canon.shots.forEach((s, i) => expect(s.t).toBe(FIRE_DOWN_MS + i * cycleMs));
      });

      for (const [seqName, abs] of Object.entries(sequences)) {
        it(`${seqName}:出彈 {tick index, 排程時刻} 序列 bit-exact 對齊 canonical`, () => {
          const run = runFire(weapon, abs);
          expect(run.shots).toEqual(canon.shots); // 逐發 tick index + 排程時刻皆逐位一致
          expect(run.ammo).toBe(canon.ammo);
          expect(run.heldFire).toBe(canon.heldFire);
        });
      }
    });
  }

  it('四種 FPS 序列(AK)的出彈序列彼此 bit-exact 相等', () => {
    const runs = Object.values(sequences).map((abs) => runFire(ak47, abs));
    const first = runs[0].shots;
    for (const run of runs) expect(run.shots).toEqual(first);
  });

  it('重播 bit-exact(無 Date.now / Math.random 洩漏):同抖動序列跑兩次完全一致', () => {
    const seq = sequences['抖動 144 Hz ±50%'];
    expect(runFire(ak47, seq)).toEqual(runFire(ak47, seq));
  });
});
