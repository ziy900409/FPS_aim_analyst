import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createSharedState } from '../state/SharedState.ts';
import { pushEvent } from '../state/inputRingTestUtil.ts';
import type { TargetManager } from '../sim/TargetManager.ts';
import type { TargetState } from '../state/types.ts';
import type { Clock } from './clock.ts';
import { SIM_HZ } from './constants.ts';
import { createSimLoop, simStep } from './SimLoop.ts';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { m4a1s } from '../weapon/weapons.ts';

/** 固定基準的注入式 clock（OQ-2.3）。 */
function fixedClock(t: number): Clock {
  return { now: () => t };
}

const TICK_MS = 1000 / SIM_HZ; // 7.8125（2 的冪，float 精確）

function cameraLookingDownZ(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  cam.position.set(0, 1.5, 5);
  cam.lookAt(0, 1.5, -1);
  cam.updateMatrixWorld(true);
  return cam;
}

function makeTarget(id: string, x: number, z: number, over: Partial<TargetState> = {}): TargetState {
  return {
    id,
    side: 'R',
    pos: { x, y: 1.5, z },
    visible: true,
    alive: true,
    hitbox: { width: 1, height: 2, depth: 1 },
    ...over,
  };
}

function tickAdvancer(loop: ReturnType<typeof createSimLoop>): (endMs: number) => void {
  let now = 0;
  return (endMs: number): void => {
    while (now + TICK_MS <= endMs + 1e-9) {
      now += TICK_MS;
      loop.pump(now);
    }
  };
}

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

  it('simStep 由 held 經 friction/accelerate 推進 vx/x（只用 dtSec）+ 維護 prev/curr', () => {
    const state = createSharedState();
    state.held.right = true; // 按住 D（無新事件）→ MovementController.step 每 tick 加速
    simStep(state, 1 / SIM_HZ, 0); // 無新輸入事件；tickEndMs 任意
    expect(state.player.vx).toBeCloseTo(10.9375, 12);
    expect(state.player.x).toBeCloseTo(10.9375 / SIM_HZ, 12);
    expect(state.prev.x).toBe(0); //                prev = 推進前位置（內插基準）
    expect(state.curr.x).toBe(state.player.x); //   curr = 推進後位置
  });

  it('輸入依 timeStamp 落入對應 tick 窗 toggle vx（決定性前提的最小機制）', () => {
    const state = createSharedState();
    // baseline=0；KeyD down @ t=2ms 應落在 tick1 窗 [0, 7.8125)
    pushEvent(state, { type: 'key', code: 'KeyD', down: true, t: 2 });
    const loop = createSimLoop(state, fixedClock(0), SIM_HZ);
    loop.pump(TICK_MS); // 跑 1 個 tick
    expect(state.player.vx).toBeCloseTo(10.9375, 12); // KeyD 已消費 → 起步加速
    expect(state.input.size()).toBe(0); // 事件已消費出緩衝
  });

  it('未到期的事件不被提前消費（晚於本 tick 窗）', () => {
    const state = createSharedState();
    // KeyD @ t=20ms 落在 tick3（[15.625, 23.4375)），跑單一 tick 不應消費
    pushEvent(state, { type: 'key', code: 'KeyD', down: true, t: 20 });
    const loop = createSimLoop(state, fixedClock(0), SIM_HZ);
    loop.pump(TICK_MS); // 只跑 tick1，窗 [0,7.8125)
    expect(state.player.vx).toBe(0); // 尚未到期
    expect(state.input.size()).toBe(1); // 仍在緩衝
  });

  it('反向鍵於 simStep 內不瞬停，改由速度自然穿越 stopped 門檻', () => {
    const state = createSharedState();
    state.held.right = true; // 向右移動
    for (let i = 0; i < 64; i++) simStep(state, 1 / SIM_HZ, i * TICK_MS);
    expect(state.player.vx).toBeCloseTo(249.28460529178633, 12);
    expect(state.player.stopped).toBe(false);

    // 反向鍵（放 D、按 A）→ 由 friction/accelerate 連續減速，不再同 tick 歸零。
    state.held.right = false;
    state.held.left = true;
    simStep(state, 1 / SIM_HZ, 65 * TICK_MS);
    expect(state.player.vx).toBeCloseTo(228.2199182018075, 12);
    expect(state.player.stopped).toBe(false);
  });

  it('simStep 末端把 movement 後的 tick row 寫入 DataRecorder', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 2 });
    state.held.right = true;
    state.aim.yaw = 3;
    state.aim.pitch = -2;

    simStep(state, 1 / SIM_HZ, TICK_MS, undefined, undefined, undefined, undefined, undefined, recorder);

    expect(recorder.snapshot().ticks).toEqual([
      { t: TICK_MS, vx: 10.9375, vz: 0, aim: { yaw: 3, pitch: -2 }, keys: ['D'] },
    ]);
  });

  it('fire down/up 依時序消費並翻轉 heldFire', () => {
    const state = createSharedState();

    pushEvent(state, { type: 'fire', down: true, t: 10 });
    simStep(state, 1 / SIM_HZ, 100);
    expect(state.heldFire).toBe(true);

    pushEvent(state, { type: 'fire', down: false, t: 110 });
    simStep(state, 1 / SIM_HZ, 200);
    expect(state.heldFire).toBe(false);
  });

  it('fire up 只清 heldFire，不觸發 raycast 或 fire 記錄', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 4 });
    const cam = cameraLookingDownZ();
    state.heldFire = true;
    state.targets.push(makeTarget('t0', 0, -8));
    const killed: string[] = [];
    const tm: TargetManager = {
      tick() {},
      markKilled(_s, id) {
        killed.push(id);
      },
      reset() {},
    };

    pushEvent(state, { type: 'fire', down: false, t: 10 });
    simStep(state, 1 / SIM_HZ, 100, tm, cam, undefined, undefined, undefined, recorder);

    expect(state.heldFire).toBe(false);
    expect(killed).toEqual([]);
    expect(recorder.snapshot().events.filter((e) => e.type === 'fire')).toEqual([]);
  });

  it('down→up 落同 tick 仍以 fire-down 時刻產 1 發（OQ-11.1）', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    const loop = createSimLoop(state, fixedClock(0), SIM_HZ, undefined, undefined, undefined, recorder);
    const advanceTo = tickAdvancer(loop);

    state.input.pushFire(true, 10);
    state.input.pushFire(false, 11);
    advanceTo(2 * TICK_MS);

    const fires = recorder.snapshot().events.filter((e) => e.type === 'fire');
    expect(fires).toHaveLength(1);
    expect(fires[0]).toMatchObject({ type: 'fire', t: 10, hit: false });
    expect(state.heldFire).toBe(false);
    expect(state.weapon.ammo).toBe(29);
  });

  it('AK full-auto 以 0.10s cycletime 累加排程，30 發後彈匣盡即停火', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 512 });
    const loop = createSimLoop(state, fixedClock(0), SIM_HZ, undefined, undefined, undefined, recorder);
    const advanceTo = tickAdvancer(loop);

    state.input.pushFire(true, 0);
    advanceTo(3000);

    const fires = recorder.snapshot().events.filter((e) => e.type === 'fire');
    expect(fires).toHaveLength(30);
    expect(fires[0].t).toBe(0);
    expect(fires.at(-1)?.t).toBeCloseTo(2900, 10);
    expect((fires.at(-1)?.t ?? 0) - fires[0].t).toBeLessThanOrEqual(2900 + TICK_MS);
    expect(state.weapon.ammo).toBe(0);
    expect(state.heldFire).toBe(false);

    state.input.pushFire(false, 3010);
    advanceTo(3050);
    state.input.pushFire(true, 3060);
    advanceTo(3300);

    expect(recorder.snapshot().events.filter((e) => e.type === 'fire')).toHaveLength(30);
    expect(state.weapon.ammo).toBe(0);
  });

  it('M4A1-S 注入後使用 20 發彈匣', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 512 });
    const loop = createSimLoop(state, fixedClock(0), SIM_HZ, undefined, undefined, undefined, recorder, m4a1s);
    const advanceTo = tickAdvancer(loop);

    expect(state.weapon.ammo).toBe(20);
    state.input.pushFire(true, 0);
    advanceTo(3000);

    const fires = recorder.snapshot().events.filter((e) => e.type === 'fire');
    expect(fires).toHaveLength(20);
    expect(fires.at(-1)?.t).toBeCloseTo(1900, 10);
    expect(state.weapon.ammo).toBe(0);
    expect(state.heldFire).toBe(false);
  });

  it('records visible, counter, and fire events from a synthetic drill', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    const cam = cameraLookingDownZ();
    let spawned = false;
    const tm: TargetManager = {
      tick(s, nowMs) {
        if (spawned) return;
        s.targets.push(makeTarget('t0', 0, -8, { hitbox: { width: 1, height: 2, depth: 1, part: 'head' } }));
        s.tVisible.set('t0', nowMs);
        spawned = true;
      },
      markKilled(s, id) {
        const i = s.targets.findIndex((target) => target.id === id);
        if (i >= 0) s.targets.splice(i, 1);
      },
      reset() {},
    };

    simStep(state, 1 / SIM_HZ, 100, tm, cam, undefined, undefined, undefined, recorder);
    state.player.vx = 250;
    state.held.right = true;
    pushEvent(state, { type: 'key', code: 'KeyA', down: true, t: 101 });
    simStep(state, 1 / SIM_HZ, 200, tm, cam, undefined, undefined, undefined, recorder);
    pushEvent(state, { type: 'fire', down: true, t: 201 });
    simStep(state, 1 / SIM_HZ, 300, tm, cam, undefined, undefined, undefined, recorder);

    expect(recorder.snapshot().events).toEqual([
      { type: 'visible', targetId: 't0', side: 'R', t: 100 },
      { type: 'counter', key: 'A', t: 101 },
      { type: 'fire', t: 201, hit: true, firstShot: true, residualSpeed: 239.84375, targetId: 't0', offsetDeg: 0, part: 'head' },
    ]);
  });
});
