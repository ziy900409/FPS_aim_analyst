import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createSharedState } from '../state/SharedState.ts';
import { pushEvent } from '../state/inputRingTestUtil.ts';
import type { TargetManager } from '../sim/TargetManager.ts';
import type { TargetState } from '../state/types.ts';
import type { Clock } from './clock.ts';
import { SIM_HZ } from './constants.ts';
import { createSimLoop, simStep, type RecoilRuntime } from './SimLoop.ts';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { ak47, m4a1s } from '../weapon/weapons.ts';
import { CS2_PROFILE } from '../sim/MovementController.ts';
import { generateRecoilTable } from '../recoil/recoilTable.ts';
import { createRan1 } from '../recoil/rng.ts';

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

function runtime(seed: number): RecoilRuntime {
  return { table: generateRecoilTable(ak47.recoil), rng: createRan1(seed) };
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

  it('afterTick observer can flag player corridor escape without clamping movement', () => {
    const state = createSharedState();
    state.held.right = true;
    const loop = createSimLoop(
      state,
      fixedClock(0),
      SIM_HZ,
      undefined,
      undefined,
      undefined,
      undefined,
      ak47,
      {
        afterTick(s) {
          if (Math.abs(s.player.x) > 0.05) s.validity.playerCorridorExceeded = true;
        },
      },
    );

    loop.pump(TICK_MS);

    expect(state.player.x).toBeCloseTo(10.7421875 / SIM_HZ, 12);
    expect(state.validity.playerCorridorExceeded).toBe(true);
  });

  it('simStep 由 held 經 friction/accelerate 推進 vx/x（只用 dtSec）+ 維護 prev/curr', () => {
    const state = createSharedState();
    state.held.right = true; // 按住 D（無新事件）→ MovementController.step 每 tick 加速
    simStep(state, 1 / SIM_HZ, 0); // 無新輸入事件；tickEndMs 任意
    expect(state.player.vx).toBeCloseTo(10.7421875, 12);
    expect(state.player.x).toBeCloseTo(10.7421875 / SIM_HZ, 12);
    expect(state.prev.x).toBe(0); //                prev = 推進前位置（內插基準）
    expect(state.curr.x).toBe(state.player.x); //   curr = 推進後位置
  });

  it('輸入依 timeStamp 落入對應 tick 窗 toggle vx（決定性前提的最小機制）', () => {
    const state = createSharedState();
    // baseline=0；KeyD down @ t=2ms 應落在 tick1 窗 [0, 7.8125)
    pushEvent(state, { type: 'key', code: 'KeyD', down: true, t: 2 });
    const loop = createSimLoop(state, fixedClock(0), SIM_HZ);
    loop.pump(TICK_MS); // 跑 1 個 tick
    expect(state.player.vx).toBeCloseTo(10.7421875, 12); // KeyD 已消費 → 起步加速
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
    expect(state.player.vx).toBeCloseTo(244.5779902109947, 12);
    expect(state.player.stopped).toBe(false);

    // 反向鍵（放 D、按 A）→ 由 friction/accelerate 連續減速，不再同 tick 歸零。
    state.held.right = false;
    state.held.left = true;
    simStep(state, 1 / SIM_HZ, 65 * TICK_MS);
    expect(state.player.vx).toBeCloseTo(223.89982185867305, 12);
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
      {
        t: TICK_MS,
        vx: 10.7421875,
        vz: 0,
        px: 0.08392333984375,
        pz: 0,
        tx: null,
        ty: null,
        tz: null,
        aim: { yaw: 3, pitch: -2 },
        keys: ['D'],
      },
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

  it('velocity gate 直接以 |vx| < CS2_PROFILE.accuracyThreshold 判定命中精準度', () => {
    function fireAt(vx: number, staleStopped: boolean) {
      const state = createSharedState();
      const recorder = createDataRecorder({ capacity: 8 });
      const cam = cameraLookingDownZ();
      const killed: string[] = [];
      const tm: TargetManager = {
        tick() {},
        markKilled(_s, id) {
          killed.push(id);
        },
        reset() {},
      };
      state.player.vx = vx;
      state.player.stopped = staleStopped;
      state.targets.push(makeTarget('t0', 0, -8));
      state.heldFire = true;
      state.weapon.nextFireT = 0;

      simStep(state, 1 / SIM_HZ, TICK_MS, tm, cam, undefined, undefined, undefined, recorder);

      return { killed, fire: recorder.snapshot().events.find((e) => e.type === 'fire') };
    }

    const below = fireAt(CS2_PROFILE.accuracyThreshold - 0.001, false);
    expect(below.killed).toEqual(['t0']);
    expect(below.fire).toMatchObject({ type: 'fire', hit: true, residualSpeed: CS2_PROFILE.accuracyThreshold - 0.001 });

    const above = fireAt(CS2_PROFILE.accuracyThreshold + 0.001, true);
    expect(above.killed).toEqual([]);
    expect(above.fire).toMatchObject({ type: 'fire', hit: false, residualSpeed: CS2_PROFILE.accuracyThreshold + 0.001 });
  });

  it('spread movement term uses true speed ratio: max-speed spread mean is much larger than stopped spread', () => {
    function meanSpreadRadius(vx: number, seed: number): number {
      const rt = runtime(seed);
      let sum = 0;
      const samples = 256;
      for (let i = 0; i < samples; i++) {
        const state = createSharedState();
        state.player.vx = vx;
        state.heldFire = true;
        state.weapon.nextFireT = 0;
        simStep(state, 1 / SIM_HZ, TICK_MS, undefined, undefined, undefined, undefined, undefined, undefined, ak47, 0, rt);
        sum += Math.hypot(state.recoil.lastSpread.x, state.recoil.lastSpread.y);
      }
      return sum / samples;
    }

    const stopped = meanSpreadRadius(0, 2026);
    const moving = meanSpreadRadius(CS2_PROFILE.maxSpeed, 2026);

    expect(moving / stopped).toBeGreaterThan(3.5);
  });

  it('velocity-gated fire events and spread samples replay deterministically for the same seed and speeds', () => {
    function run(seed: number) {
      const out: unknown[] = [];
      const rt = runtime(seed);
      for (const vx of [CS2_PROFILE.accuracyThreshold - 0.5, CS2_PROFILE.accuracyThreshold + 0.5]) {
        const state = createSharedState();
        const recorder = createDataRecorder({ capacity: 4 });
        const cam = cameraLookingDownZ();
        const tm: TargetManager = {
          tick() {},
          markKilled(s, id) {
            const i = s.targets.findIndex((target) => target.id === id);
            if (i >= 0) s.targets.splice(i, 1);
          },
          reset() {},
        };
        state.player.vx = vx;
        state.targets.push(makeTarget('t0', 0, -8));
        state.heldFire = true;
        state.weapon.nextFireT = 0;

        simStep(state, 1 / SIM_HZ, TICK_MS, tm, cam, undefined, undefined, undefined, recorder, ak47, 0, rt);
        out.push({
          fire: recorder.snapshot().events.find((e) => e.type === 'fire'),
          spread: { ...state.recoil.lastSpread },
        });
      }
      return out;
    }

    expect(run(4242)).toEqual(run(4242));
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
      { type: 'visible', targetId: 't0', side: 'R', t: 100, targetX: 0, targetY: 1.5, targetZ: -8 },
      { type: 'counter', key: 'A', t: 101 },
      {
        type: 'fire',
        t: 201,
        hit: false,
        firstShot: true,
        residualSpeed: 239.84375,
        viewYaw: 0,
        viewPitch: 0,
        aimPunchPitch: 0,
        aimPunchYaw: 0,
        spreadX: 0,
        spreadY: 0,
        recoilIndex: 0,
        ammo: 30,
        targetId: 't0',
        offsetDeg: 0,
      },
    ]);
  });
});
