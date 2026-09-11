import { describe, expect, it } from 'vitest';
import drillJson from '../../../drills/counterstrafe_ad_v1.json';
import { createDataRecorder, type DataRecorderSnapshot } from '../../data/DataRecorder.ts';
import { loadDrill } from '../../drill/DrillLoader.ts';
import { createDrillRunner } from '../../drill/DrillRunner.ts';
import { createSharedState, type SharedState } from '../../state/SharedState.ts';
import { pushEvent } from '../../state/inputRingTestUtil.ts';
import type { InputEvent } from '../../state/types.ts';
import { createTargetManager } from '../../sim/TargetManager.ts';
import { ak47 } from '../../weapon/weapons.ts';
import type { Clock } from '../clock.ts';
import { SIM_HZ } from '../constants.ts';
import { createSimLoop } from '../SimLoop.ts';

/**
 * WP-65 / T1 — 待命閘的決定性契約（NFR-65.1）
 *
 * 待命閘引入了一個**由 sim 外部寫入**的相位轉移條件（`SharedState.armRequested`），這正是決定性
 * 最容易破掉的地方：若解除待命的時點被綁在 wall-clock 或 render 幀上，同一份輸入序列在不同 render
 * FPS 下就會在**不同 tick** 起算倒數，整場 sim 隨之偏移。
 *
 * 本測試把「解除」釘在**固定 tick index** 上（由 `afterTick` 於 sim 內寫入，模擬 input 層在該 tick
 * 之後翻旗標），然後在 4 種 render 幀序列下比對逐 tick 軌跡與 recorder 快照是否逐位一致。
 * 同時反向釘死：**不解除**就永遠停在 `armed`，且跨 FPS 一致地什麼都不做。
 */

const TICK_MS = 1000 / SIM_HZ;
const CLOCK_BASE = 0;
/** 總模擬時間落在 tick 窗中段，避免尾端浮點 off-by-one（比照 determinism.test.ts）。 */
const EXPECTED_TICKS = 640;
const END_MS = (EXPECTED_TICKS + 0.5) * TICK_MS;
/** 解除待命的 tick index：刻意落在 countdownMs（3000 ms ≈ 384 ticks）之前的任意一點。 */
const ARM_TICK_INDEX = 96;

interface TickSnap {
  tickIndex: number;
  t: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  stopped: boolean;
  targetX: number | null;
  targetZ: number | null;
}

interface ArmTrace {
  tickSnaps: TickSnap[];
  snapshot: DataRecorderSnapshot;
  phase: string;
}

/** 合成輸入序列（固定 timeStamp，與 render FPS 無關）；跨全部幀序列共用同一份。 */
function syntheticInputs(): InputEvent[] {
  return [
    { type: 'key', code: 'KeyD', down: true, t: 3100 },
    { type: 'key', code: 'KeyA', down: true, t: 3250 },
    { type: 'key', code: 'KeyD', down: false, t: 3350 },
    { type: 'key', code: 'KeyA', down: false, t: 3350 },
    { type: 'key', code: 'KeyA', down: true, t: 3450 },
    { type: 'key', code: 'KeyD', down: true, t: 3600 },
    { type: 'key', code: 'KeyA', down: false, t: 3700 },
    { type: 'key', code: 'KeyD', down: false, t: 3700 },
  ];
}

function framesAt(periodMs: number, endMs: number): number[] {
  const abs: number[] = [];
  for (let t = periodMs; t < endMs; t += periodMs) abs.push(t);
  if (abs.length === 0 || abs[abs.length - 1] < endMs) abs.push(endMs);
  return abs;
}

/** 抖動幀序列：決定性 LCG（不使用任何非決定性亂數來源），比照 determinism.test.ts。 */
function jitterFrames(basePeriod: number, endMs: number): number[] {
  let seed = 1234567;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const abs: number[] = [];
  let t = 0;
  for (;;) {
    const d = basePeriod * (0.5 + rand());
    if (t + d >= endMs) break;
    t += d;
    abs.push(t);
  }
  abs.push(endMs);
  return abs;
}

function snapTick(state: SharedState, t: number, tickIndex: number): TickSnap {
  const target = state.targets.find((candidate) => candidate.visible && candidate.alive);
  return {
    tickIndex,
    t,
    x: state.curr.x,
    z: state.curr.z,
    vx: state.player.vx,
    vz: state.player.vz,
    stopped: state.player.stopped,
    targetX: target?.pos.x ?? null,
    targetZ: target?.pos.z ?? null,
  };
}

/**
 * 跑一條 `requireArm: true` 的完整管線。`armAtTickIndex === null` ⇒ 永不解除（反向釘死用）。
 * 解除寫在 `afterTick` 內、以 **tick index** 而非時間為條件 ⇒ 與 render 幀序列完全無關。
 */
function runArmedTrace(frames: number[], armAtTickIndex: number | null): ArmTrace {
  const config = loadDrill(drillJson);
  const state = createSharedState();
  const clock: Clock = { now: () => CLOCK_BASE };
  const recorder = createDataRecorder({ simHz: SIM_HZ });
  const targetManager = createTargetManager(config);
  const drillRunner = createDrillRunner(state, targetManager, { requireArm: true });
  const tickSnaps: TickSnap[] = [];
  const sim = createSimLoop(state, clock, SIM_HZ, targetManager, undefined, drillRunner, recorder, ak47, 1, {
    afterTick: (s, t, tickIndex) => {
      tickSnaps.push(snapTick(s, t, tickIndex));
      if (armAtTickIndex !== null && tickIndex === armAtTickIndex) s.armRequested = true;
    },
  });

  drillRunner.start(config);
  expect(drillRunner.phase).toBe('armed');
  for (const ev of syntheticInputs()) pushEvent(state, ev);
  for (const now of frames) sim.pump(now);

  return { tickSnaps, snapshot: recorder.snapshot(), phase: drillRunner.phase };
}

const FRAME_SEQUENCES: Record<string, number[]> = {
  '穩定 60 Hz': framesAt(1000 / 60, END_MS),
  '穩定 144 Hz': framesAt(1000 / 144, END_MS),
  '穩定 240 Hz': framesAt(1000 / 240, END_MS),
  '抖動 144 Hz ±50%': jitterFrames(1000 / 144, END_MS),
};

describe('WP-65 T1 — 待命閘的跨 render FPS 決定性（NFR-65.1）', () => {
  it('同一 tick index 解除待命 → 4 種 render 幀序列的逐 tick 軌跡與 recorder 快照逐位一致', () => {
    const names = Object.keys(FRAME_SEQUENCES);
    const ground = runArmedTrace(FRAME_SEQUENCES[names[0]], ARM_TICK_INDEX);

    // 解除確實生效（否則下面的「一致」會是「一致地什麼都沒發生」的假綠燈）。
    expect(ground.phase).toBe('running');
    expect(ground.tickSnaps).toHaveLength(EXPECTED_TICKS);
    expect(ground.snapshot.events.some((event) => event.type === 'visible')).toBe(true);

    for (const name of names.slice(1)) {
      const trace = runArmedTrace(FRAME_SEQUENCES[name], ARM_TICK_INDEX);
      expect(trace.tickSnaps, name).toEqual(ground.tickSnaps);
      expect(trace.snapshot, name).toEqual(ground.snapshot);
      expect(trace.phase, name).toBe(ground.phase);
    }
  });

  it('倒數自「解除那一刻」起算：首個目標可見時刻 = (解除 tick 之後第一個 tick) + countdownMs，與 FPS 無關', () => {
    const config = loadDrill(drillJson);
    const countdownMs = config.timing.countdownMs;
    // afterTick 在 tick N 之後寫旗標 ⇒ tick N+1 才看見並起算；該 tick 的 sim 時刻為 (N+2)·TICK_MS。
    const countdownStartMs = (ARM_TICK_INDEX + 2) * TICK_MS;

    for (const [name, frames] of Object.entries(FRAME_SEQUENCES)) {
      const trace = runArmedTrace(frames, ARM_TICK_INDEX);
      const firstVisible = trace.snapshot.events.find((event) => event.type === 'visible');
      expect(firstVisible, name).toBeDefined();
      expect(firstVisible?.t, name).toBe(countdownStartMs + countdownMs);
    }
  });

  it('反向釘死：不解除待命 → 4 種幀序列全數停在 armed，零目標、零 visible 事件', () => {
    for (const [name, frames] of Object.entries(FRAME_SEQUENCES)) {
      const trace = runArmedTrace(frames, null);
      expect(trace.phase, name).toBe('armed');
      expect(trace.snapshot.events.filter((event) => event.type === 'visible'), name).toEqual([]);
      expect(trace.tickSnaps.every((snap) => snap.targetX === null), name).toBe(true);
    }
  });
});
