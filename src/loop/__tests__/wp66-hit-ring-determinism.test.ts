import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../../data/DataRecorder.ts';
import type { TargetManager } from '../../sim/TargetManager.ts';
import { createSharedState, type SharedState } from '../../state/SharedState.ts';
import { pushEvent } from '../../state/inputRingTestUtil.ts';
import type { InputEvent, TargetState } from '../../state/types.ts';
import { ak47 } from '../../weapon/weapons.ts';
import type { Clock } from '../clock.ts';
import { SIM_HZ } from '../constants.ts';
import { createSimLoop } from '../SimLoop.ts';

/**
 * WP-66 / T1 — 命中環形格的跨 render FPS 決定性（NFR-66.1）
 *
 * `targetHits` 由 sim 寫入 ⇒ 它落入決定性契約（CLAUDE.md §4）。風險不是抽象的：命中與否經過
 * **速度閘**（`|vx| < accuracyThreshold`），而 `vx` 由逐 tick 的 movement 積分推進——只要環形格的
 * 寫入時機沾到 render 幀（而非 sim tick），同一份輸入序列在不同 FPS 下就會寫出不同的命中序列。
 *
 * 本測試刻意讓輸入序列**同時包含 A/D 橫移與全自動連射**，使速度閘在 run 中反覆翻轉 ⇒ 產出
 * **命中與脫靶交錯**的序列，再比對 4 種 render 幀序列下的 `total`／`cursor`／逐槽 `id`/`seq`。
 * 若只射不動，所有發都命中，測到的會是「一致地全部命中」的弱綠燈。
 */

const TICK_MS = 1000 / SIM_HZ;
/** 總模擬時間落在 tick 窗中段，避免尾端浮點 off-by-one（比照 wp65-arm-determinism.test.ts）。 */
const EXPECTED_TICKS = 640;
const END_MS = (EXPECTED_TICKS + 0.5) * TICK_MS;

interface RingSnapshot {
  total: number;
  cursor: number;
  id: string[];
  seq: number[];
}

interface HitTrace {
  ring: RingSnapshot;
  fires: { t: number; hit: boolean }[];
}

function cameraLookingDownZ(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  cam.position.set(0, 1.5, 5);
  cam.lookAt(0, 1.5, -1);
  cam.updateMatrixWorld(true);
  return cam;
}

/** persistent 目標：命中不撤除 ⇒ 一整個彈匣的命中都會寫進環形格（本 WP 的主要使用情境）。 */
function persistentTarget(): TargetState {
  return {
    id: 'track-0',
    side: 'R',
    pos: { x: 0, y: 1.5, z: -8 },
    visible: true,
    alive: true,
    hitbox: { width: 1, height: 2, depth: 1, shape: 'box' },
    persistent: true,
  };
}

/**
 * 合成輸入序列（固定 timeStamp，與 render FPS 無關）：按住開火的同時反覆 A/D 橫移，
 * 使 `|vx|` 在速度閘門檻兩側來回 ⇒ 命中／脫靶交錯。
 */
function syntheticInputs(): InputEvent[] {
  return [
    { type: 'fire', down: true, t: 40 },
    { type: 'key', code: 'KeyD', down: true, t: 300 },
    { type: 'key', code: 'KeyD', down: false, t: 620 },
    { type: 'key', code: 'KeyA', down: true, t: 900 },
    { type: 'key', code: 'KeyA', down: false, t: 1180 },
    { type: 'key', code: 'KeyD', down: true, t: 1500 },
    { type: 'key', code: 'KeyA', down: true, t: 1700 },
    { type: 'key', code: 'KeyD', down: false, t: 1900 },
    { type: 'key', code: 'KeyA', down: false, t: 2100 },
    { type: 'key', code: 'KeyD', down: true, t: 2400 },
    { type: 'key', code: 'KeyD', down: false, t: 2750 },
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

function snapshotRing(state: SharedState): RingSnapshot {
  return {
    total: state.targetHits.total,
    cursor: state.targetHits.cursor,
    id: [...state.targetHits.id],
    seq: Array.from(state.targetHits.seq),
  };
}

function runHitTrace(frames: number[]): HitTrace {
  const state = createSharedState();
  const clock: Clock = { now: () => 0 };
  const recorder = createDataRecorder({ capacity: 512 });
  // 不撤除任何目標：本測試量的是命中訊號的決定性，不是 drill 生命週期。
  const targetManager: TargetManager = { tick() {}, markKilled() {}, reset() {} };
  const sim = createSimLoop(
    state,
    clock,
    SIM_HZ,
    targetManager,
    cameraLookingDownZ(),
    undefined,
    recorder,
    ak47,
  );

  state.targets.push(persistentTarget());
  for (const ev of syntheticInputs()) pushEvent(state, ev);
  for (const now of frames) sim.pump(now);

  const fires = recorder
    .snapshot()
    .events.filter((event) => event.type === 'fire')
    .map((event) => ({ t: event.t, hit: event.type === 'fire' && event.hit }));

  return { ring: snapshotRing(state), fires };
}

const FRAME_SEQUENCES: Record<string, number[]> = {
  '穩定 60 Hz': framesAt(1000 / 60, END_MS),
  '穩定 144 Hz': framesAt(1000 / 144, END_MS),
  '穩定 240 Hz': framesAt(1000 / 240, END_MS),
  '抖動 144 Hz ±50%': jitterFrames(1000 / 144, END_MS),
};

describe('WP-66 T1 — targetHits 的跨 render FPS 決定性（NFR-66.1）', () => {
  it('同一輸入序列在 4 種 render 幀序列下：total / cursor / 逐槽 id 與 seq 逐位一致', () => {
    const names = Object.keys(FRAME_SEQUENCES);
    const ground = runHitTrace(FRAME_SEQUENCES[names[0]]);

    // 情境非平凡：確實有命中、也確實有脫靶（否則「一致」可能是「一致地什麼都沒發生」）。
    expect(ground.ring.total).toBeGreaterThan(0);
    expect(ground.fires.some((fire) => fire.hit)).toBe(true);
    expect(ground.fires.some((fire) => !fire.hit)).toBe(true);
    // 命中數必須與 fire 事件的 hit 數逐筆相符（環形格未繞圈時 total 即命中數）。
    expect(ground.ring.total).toBe(ground.fires.filter((fire) => fire.hit).length);

    for (const name of names.slice(1)) {
      const trace = runHitTrace(FRAME_SEQUENCES[name]);
      expect(trace.ring.total, name).toBe(ground.ring.total);
      expect(trace.ring.cursor, name).toBe(ground.ring.cursor);
      expect(trace.ring.id, name).toEqual(ground.ring.id);
      expect(trace.ring.seq, name).toEqual(ground.ring.seq);
      // fire 事件本身也必須逐位一致——否則上面的一致只是「兩邊都壞得一樣」。
      expect(trace.fires, name).toEqual(ground.fires);
    }
  });
});
