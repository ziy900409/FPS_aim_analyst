import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { BULLET_CAP, createSharedState } from '../state/SharedState.ts';
import { pushEvent } from '../state/inputRingTestUtil.ts';
import type { TargetManager } from '../sim/TargetManager.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import type { TargetState } from '../state/types.ts';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import type { Clock } from './clock.ts';
import { SIM_HZ } from './constants.ts';
import { createSimLoop, simStep, type RecoilRuntime } from './SimLoop.ts';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { ak47, m4a1s } from '../weapon/weapons.ts';
import type { WeaponConfig } from '../weapon/WeaponConfig.ts';
import { CS2_PROFILE } from '../sim/MovementController.ts';
import { generateRecoilTable } from '../recoil/recoilTable.ts';
import { createRan1 } from '../recoil/rng.ts';
import { CameraController } from '../view/CameraController.ts';
import { resolveMouseGain } from '../input/mouseGain.ts';

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
    hitbox: { width: 1, height: 2, depth: 1, shape: 'box' },
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

const projectileAk47: WeaponConfig = {
  ...ak47,
  id: 'ak47_projectile_test',
  bullet: { model: 'projectile', speedU: 832, gravityU: 1, maxRangeU: 64 },
};

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
        ads: false,
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

  it('ads down/up 依時序消費並翻轉 heldAds（WP-24 / T1）', () => {
    const state = createSharedState();

    pushEvent(state, { type: 'ads', down: true, t: 10 });
    simStep(state, 1 / SIM_HZ, 100);
    expect(state.heldAds).toBe(true);

    pushEvent(state, { type: 'ads', down: false, t: 110 });
    simStep(state, 1 / SIM_HZ, 200);
    expect(state.heldAds).toBe(false);
  });

  it('ads down→up 同 tick 內依事件序消費，收尾 heldAds=false', () => {
    const state = createSharedState();
    pushEvent(state, { type: 'ads', down: true, t: 10 });
    pushEvent(state, { type: 'ads', down: false, t: 11 });
    simStep(state, 1 / SIM_HZ, 100); // 兩事件皆落 [0,100) → 依序 down 再 up
    expect(state.heldAds).toBe(false);
    expect(state.input.size()).toBe(0);
  });

  it('ads 事件只記錄 ads，不觸發開火 / 命中（GD-16：ADS 不進 sim）', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 4 });
    const cam = cameraLookingDownZ();
    state.targets.push(makeTarget('t0', 0, -8));
    const killed: string[] = [];
    const tm: TargetManager = {
      tick() {},
      markKilled(_s, id) {
        killed.push(id);
      },
      reset() {},
    };

    // 未按左鍵開火，僅右鍵 ADS 按住 → 不得產彈 / 擊殺 / 記 fire 事件；ads 本身須進記錄。
    pushEvent(state, { type: 'ads', down: true, t: 10 });
    simStep(state, 1 / SIM_HZ, 100, tm, cam, undefined, undefined, undefined, recorder);

    expect(state.heldAds).toBe(true);
    expect(state.heldFire).toBe(false);
    expect(state.weapon.ammo).toBe(30); // 未消耗
    expect(killed).toEqual([]);
    expect(recorder.snapshot().events.filter((e) => e.type === 'fire')).toEqual([]);
    expect(recorder.snapshot().events.filter((e) => e.type === 'ads')).toEqual([{ type: 'ads', down: true, t: 10 }]);
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

  it('persistent 目標命中不撤除：記 hit 事件但不呼叫 markKilled（timed presentation,WP-18/T3）', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    const cam = cameraLookingDownZ();
    const killed: string[] = [];
    const tm: TargetManager = {
      tick() {},
      markKilled(s, id) {
        killed.push(id);
        const i = s.targets.findIndex((target) => target.id === id);
        if (i >= 0) s.targets.splice(i, 1);
      },
      reset() {},
    };
    state.player.vx = 0; // 精準（靜止）→ 命中
    state.targets.push(makeTarget('t0', 0, -8, { persistent: true }));
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    simStep(state, 1 / SIM_HZ, TICK_MS, tm, cam, undefined, undefined, undefined, recorder);

    const fire = recorder.snapshot().events.find((e) => e.type === 'fire');
    expect(fire).toMatchObject({ type: 'fire', hit: true, targetId: 't0' }); // 命中有記錄
    expect(killed).toEqual([]); // persistent → 不撤除
    expect(state.targets.map((target) => target.id)).toEqual(['t0']); // 目標仍存活於場上
    expect(state.targets[0].alive).toBe(true);
  });

  it('非 persistent 目標命中即撤除（既有政策零破壞）', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    const cam = cameraLookingDownZ();
    const killed: string[] = [];
    const tm: TargetManager = {
      tick() {},
      markKilled(s, id) {
        killed.push(id);
        const i = s.targets.findIndex((target) => target.id === id);
        if (i >= 0) s.targets.splice(i, 1);
      },
      reset() {},
    };
    state.player.vx = 0;
    state.targets.push(makeTarget('t0', 0, -8)); // persistent 省略
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    simStep(state, 1 / SIM_HZ, TICK_MS, tm, cam, undefined, undefined, undefined, recorder);

    expect(killed).toEqual(['t0']); // 命中即撤除
  });

  it('fire hit writes a render-only shotRay from camera origin to the impact point', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    const cam = cameraLookingDownZ();
    const tm: TargetManager = {
      tick() {},
      markKilled() {},
      reset() {},
    };
    state.targets.push(makeTarget('t0', 0, -8));
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    simStep(state, 1 / SIM_HZ, TICK_MS, tm, cam, undefined, undefined, undefined, recorder);

    expect(state.shotRays.total).toBe(1);
    expect(state.shotRays.cursor).toBe(1);
    expect([state.shotRays.ox[0], state.shotRays.oy[0], state.shotRays.oz[0]]).toEqual([0.15, 1.38, 4.4]);
    expect(state.shotRays.ex[0]).toBeCloseTo(state.impacts.x[0], 12);
    expect(state.shotRays.ey[0]).toBeCloseTo(state.impacts.y[0], 12);
    expect(state.shotRays.ez[0]).toBeCloseTo(state.impacts.z[0], 12);
  });

  it('fire miss writes a shotRay endpoint on the existing engagement-plane projection', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    const cam = cameraLookingDownZ();
    const tm: TargetManager = {
      tick() {},
      markKilled() {},
      reset() {},
    };
    state.targets.push(makeTarget('t0', 0, -8));
    state.aim.yaw = 0.2;
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    simStep(state, 1 / SIM_HZ, TICK_MS, tm, cam, undefined, undefined, undefined, recorder);

    expect(recorder.snapshot().events.find((e) => e.type === 'fire')).toMatchObject({ hit: false });
    expect(state.shotRays.total).toBe(1);
    expect(state.shotRays.ex[0]).not.toBeCloseTo(0, 6);
    expect(state.shotRays.ez[0]).toBeCloseTo(-8, 12);
    expect(state.shotRays.ex[0]).toBeCloseTo(state.impacts.x[0], 12);
    expect(state.shotRays.ey[0]).toBeCloseTo(state.impacts.y[0], 12);
    expect(state.shotRays.ez[0]).toBeCloseTo(state.impacts.z[0], 12);
  });

  it('WP-45 / T1：scene occlusion 阻擋隔牆命中——目標未撤除、彈孔/tracer 終點停在牆面', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    const cam = cameraLookingDownZ(); // (0,1.5,5) 朝 -z；state.aim 預設 yaw/pitch=0 → 射線沿 (0,1.5,z)
    const killed: string[] = [];
    const tm: TargetManager = {
      tick() {},
      markKilled(s, id) {
        killed.push(id);
        const i = s.targets.findIndex((target) => target.id === id);
        if (i >= 0) s.targets.splice(i, 1);
      },
      reset() {},
    };
    state.targets.push(makeTarget('t0', 0, -8)); // 命中點近面 z=-7.5（未阻擋時）
    state.heldFire = true;
    state.weapon.nextFireT = 0;
    // 牆面涵蓋整條 (0,1.5,z) 射線在 z∈[-1,1] 的路徑，落在 camera(z=5) 與目標近面(z=-7.5) 之間。
    const hitscanOcclusion = { propBounds: [{ id: 'cover-wall', min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 3, z: 1 } }] };

    simStep(state, 1 / SIM_HZ, TICK_MS, tm, cam, undefined, undefined, undefined, recorder, undefined, undefined, undefined, hitscanOcclusion);

    expect(recorder.snapshot().events.find((e) => e.type === 'fire')).toMatchObject({ hit: false });
    expect(killed).toEqual([]); // 隔牆未擊殺，目標仍存活
    expect(state.targets).toHaveLength(1);
    // 彈孔/tracer 終點停在牆近面（z=max.z=1），非目標近面（z=-7.5）。
    expect(state.impacts.total).toBe(1);
    expect(state.impacts.z[0]).toBeCloseTo(1, 9);
    expect(state.shotRays.total).toBe(1);
    expect(state.shotRays.ez[0]).toBeCloseTo(1, 9);
  });

  it('WP-45 / T1：省略 hitscanOcclusion context 的曝空目標維持既有命中/擊殺行為（NFR-P45-2）', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    const cam = cameraLookingDownZ();
    const killed: string[] = [];
    const tm: TargetManager = {
      tick() {},
      markKilled(s, id) {
        killed.push(id);
        const i = s.targets.findIndex((target) => target.id === id);
        if (i >= 0) s.targets.splice(i, 1);
      },
      reset() {},
    };
    state.targets.push(makeTarget('t0', 0, -8));
    state.heldFire = true;
    state.weapon.nextFireT = 0;
    // props=[] 情境（context 存在但無阻擋道具）——與省略 context 應等效，皆命中即擊殺。
    const hitscanOcclusion = { propBounds: [] };

    simStep(state, 1 / SIM_HZ, TICK_MS, tm, cam, undefined, undefined, undefined, recorder, undefined, undefined, undefined, hitscanOcclusion);

    expect(recorder.snapshot().events.find((e) => e.type === 'fire')).toMatchObject({ hit: true });
    expect(killed).toEqual(['t0']);
    expect(state.impacts.z[0]).toBeCloseTo(-7.5, 9); // 目標近面，未被牆截斷
  });

  it('projectile fire spawns a bullet and later records a swept hit event with time of flight', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 16 });
    const cam = cameraLookingDownZ();
    const killed: string[] = [];
    const tm: TargetManager = {
      tick() {},
      markKilled(s, id) {
        killed.push(id);
        const i = s.targets.findIndex((target) => target.id === id);
        if (i >= 0) s.targets.splice(i, 1);
      },
      reset() {},
    };
    state.targets.push(makeTarget('t0', 0, -8));
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    simStep(state, 1 / SIM_HZ, TICK_MS, tm, cam, undefined, undefined, undefined, recorder, projectileAk47);

    expect(state.bullets.activeCount).toBe(1);
    expect(state.impacts.total).toBe(0);
    expect(state.shotRays.total).toBe(0);
    expect(recorder.snapshot().events).toEqual([
      expect.objectContaining({ type: 'fire', t: 0, hit: false, firstShot: true, shotSeq: 1, targetId: 't0' }),
    ]);

    simStep(state, 1 / SIM_HZ, 2 * TICK_MS, tm, cam, undefined, undefined, undefined, recorder, projectileAk47);
    expect(recorder.snapshot().events.filter((event) => event.type === 'hit')).toEqual([]);

    simStep(state, 1 / SIM_HZ, 3 * TICK_MS, tm, cam, undefined, undefined, undefined, recorder, projectileAk47);

    const hit = recorder.snapshot().events.find((event) => event.type === 'hit');
    expect(hit).toMatchObject({ type: 'hit', shotSeq: 1, targetId: 't0' });
    if (hit?.type !== 'hit') throw new Error('expected projectile hit event');
    expect(hit.t).toBeGreaterThan(2 * TICK_MS);
    expect(hit.timeOfFlightMs).toBeGreaterThan(0);
    expect(killed).toEqual(['t0']);
    expect(state.bullets.activeCount).toBe(0);
    expect(state.impacts.total).toBe(1);
    expect(state.shotRays.total).toBe(1);
  });

  it('projectile arena full refuses fire, preserves ammo, and raises overflow metadata', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 16 });
    const cam = cameraLookingDownZ();
    const tm: TargetManager = { tick() {}, markKilled() {}, reset() {} };
    for (let i = 0; i < BULLET_CAP; i++) {
      state.bullets.y[i] = 1.5;
      state.bullets.alive[i] = 1;
    }
    state.bullets.activeCount = BULLET_CAP;
    state.targets.push(makeTarget('t0', 0, -8));
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    simStep(state, 1 / SIM_HZ, TICK_MS, tm, cam, undefined, undefined, undefined, recorder, projectileAk47);

    expect(state.bullets.overflowCount).toBe(1);
    expect(state.bullets.activeCount).toBe(BULLET_CAP);
    expect(state.weapon.ammo).toBe(30);
    expect(recorder.snapshot().events.filter((event) => event.type === 'fire')).toEqual([]);
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

  it('exports spider-shot visible events with their additive center/peripheral zone', () => {
    const config: DrillConfig = {
      drillId: 'spider-shot-test',
      targets: { count: 2, distance: 4 },
      sequence: { alternation: 'LR' },
      spiderShot: {
        kind: 'center-peripheral',
        seed: 7,
        centerDistanceU: 4,
        peripheral: {
          angularRadiusDegRange: [30, 30],
          azimuthDegRange: [90, 90],
          distanceURange: [4, 4],
        },
      },
      timing: { countdownMs: 0 },
      endCondition: { type: 'targetCount', value: 2 },
    };
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    const tm = createTargetManager(config);

    simStep(state, 1 / SIM_HZ, TICK_MS, tm, undefined, undefined, undefined, undefined, recorder);
    tm.markKilled(state, state.targets[0].id);
    simStep(state, 1 / SIM_HZ, TICK_MS * 2, tm, undefined, undefined, undefined, undefined, recorder);

    expect(recorder.snapshot().events.filter((event) => event.type === 'visible')).toMatchObject([
      { targetId: 't0', zone: 'center' },
      { targetId: 't1', zone: 'peripheral' },
    ]);
  });

  it('records visible, counter, and fire events from a synthetic drill', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    const cam = cameraLookingDownZ();
    let spawned = false;
    const tm: TargetManager = {
      tick(s, nowMs) {
        if (spawned) return;
        s.targets.push(makeTarget('t0', 0, -8, { hitbox: { width: 1, height: 2, depth: 1, shape: 'box', part: 'head' } }));
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
    pushEvent(state, { type: 'ads', down: true, t: 150 });
    simStep(state, 1 / SIM_HZ, 200, tm, cam, undefined, undefined, undefined, recorder);
    pushEvent(state, { type: 'fire', down: true, t: 201 });
    simStep(state, 1 / SIM_HZ, 300, tm, cam, undefined, undefined, undefined, recorder);

    expect(recorder.snapshot().events).toEqual([
      { type: 'visible', targetId: 't0', side: 'R', t: 100, targetX: 0, targetY: 1.5, targetZ: -8 },
      { type: 'counter', key: 'A', t: 101 },
      { type: 'ads', down: true, t: 150 },
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

describe('SimLoop applyInput — WP-29 / T3 additive key 事件（opt-in，預設關閉）', () => {
  it('預設 recorder 不記 key 事件（既有基準逐位不變）', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    expect(recorder.recordKeyEvents).toBe(false);

    pushEvent(state, { type: 'key', code: 'KeyD', down: true, t: 2 });
    pushEvent(state, { type: 'key', code: 'KeyD', down: false, t: 9 });
    simStep(state, 1 / SIM_HZ, TICK_MS, undefined, undefined, undefined, undefined, undefined, recorder);
    simStep(state, 1 / SIM_HZ, 2 * TICK_MS, undefined, undefined, undefined, undefined, undefined, recorder);

    expect(recorder.snapshot().events.filter((event) => event.type === 'key')).toEqual([]);
  });

  it('啟用時：key down 先於 counter 並列記錄、canonical code、down/up 各一、順序決定性', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8, recordKeyEvents: true });
    expect(recorder.recordKeyEvents).toBe(true);
    state.player.vx = -250; // 左移中 → KeyD 為反向鍵（counter 'D'）
    state.held.right = false;

    pushEvent(state, { type: 'key', code: 'KeyD', down: true, t: 2 });
    simStep(state, 1 / SIM_HZ, TICK_MS, undefined, undefined, undefined, undefined, undefined, recorder);
    pushEvent(state, { type: 'key', code: 'KeyD', down: false, t: 9 });
    simStep(state, 1 / SIM_HZ, 2 * TICK_MS, undefined, undefined, undefined, undefined, undefined, recorder);

    // raw key 轉換先寫、derived counter 後寫（同 t）；keyup 只記 key、無 counter。
    expect(recorder.snapshot().events).toEqual([
      { type: 'key', code: 'D', down: true, t: 2 },
      { type: 'counter', key: 'D', t: 2 },
      { type: 'key', code: 'D', down: false, t: 9 },
    ]);
  });

  it('啟用時：非反向 keydown 仍記 key 事件但不產 counter；KeyA → canonical A', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8, recordKeyEvents: true });
    state.player.vx = 0; // 非反向 → 無 counter

    pushEvent(state, { type: 'key', code: 'KeyA', down: true, t: 3 });
    simStep(state, 1 / SIM_HZ, TICK_MS, undefined, undefined, undefined, undefined, undefined, recorder);

    const events = recorder.snapshot().events;
    expect(events.filter((event) => event.type === 'key')).toEqual([{ type: 'key', code: 'A', down: true, t: 3 }]);
    expect(events.filter((event) => event.type === 'counter')).toEqual([]);
  });
});

describe('SimLoop applyInput — KI-005 / A tick 窗 mouse 積分（T4，FR-A-1/4/9/10）', () => {
  const HIP_GAIN = resolveMouseGain({ sensitivity: 1, hipFovDeg: 75 }); // 75 = cameraLookingDownZ() 預設 fov

  it('mouse 事件只寫 recorder，不寫 state（NFR-A-1）；未配置 mouseIntegration 時無 dYaw/dPitch key', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 4 });

    pushEvent(state, { type: 'mouse', dx: 5, dy: -2, t: 3 });
    simStep(state, 1 / SIM_HZ, TICK_MS, undefined, undefined, undefined, undefined, undefined, recorder);

    expect(state.aim.yaw).toBe(0); // mouse 分支不寫 state.aim（render/camera 才寫）
    expect(state.aim.pitch).toBe(0);
    const tick = recorder.snapshot().ticks[0];
    expect(Object.keys(tick)).not.toContain('dYaw');
    expect(Object.keys(tick)).not.toContain('dPitch');
  });

  it('啟用時：tick 窗內多筆 mouse delta 積分進 ticks[].dYaw/dPitch（依事件序，跨 tick 邊界正確分桶）', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 4, mouseIntegration: { gain: HIP_GAIN } });

    // tick1 窗 [0, TICK_MS)：兩筆事件；tick2 窗 [TICK_MS, 2*TICK_MS)：無事件。
    pushEvent(state, { type: 'mouse', dx: 3, dy: 1, t: 2 });
    pushEvent(state, { type: 'mouse', dx: -1, dy: 2, t: 5 });
    simStep(state, 1 / SIM_HZ, TICK_MS, undefined, undefined, undefined, undefined, undefined, recorder);
    simStep(state, 1 / SIM_HZ, 2 * TICK_MS, undefined, undefined, undefined, undefined, undefined, recorder);

    const [tick1, tick2] = recorder.snapshot().ticks;
    expect(tick1.dYaw).toBeCloseTo(-(3 - 1) * HIP_GAIN.hipStep, 15);
    expect(tick1.dPitch).toBeCloseTo(-(1 + 2) * HIP_GAIN.hipStep, 15);
    expect(tick2.dYaw).toBe(0);
    expect(tick2.dPitch).toBe(0);
  });

  it('ads 事件與 mouse 事件同 tick 依 timeStamp 排序，accumulateMouse 讀事件時刻的 heldAds', () => {
    const state = createSharedState();
    const gain = resolveMouseGain({ sensitivity: 1, hipFovDeg: 75, ads: { fovDeg: 40, sensitivityRatio: 2 } });
    const recorder = createDataRecorder({ capacity: 4, mouseIntegration: { gain } });

    pushEvent(state, { type: 'mouse', dx: 4, dy: 0, t: 1 }); // hip（ads 尚未 down）
    pushEvent(state, { type: 'ads', down: true, t: 2 });
    pushEvent(state, { type: 'mouse', dx: 4, dy: 0, t: 3 }); // ads 中
    simStep(state, 1 / SIM_HZ, TICK_MS, undefined, undefined, undefined, undefined, undefined, recorder);

    const tick = recorder.snapshot().ticks[0];
    expect(tick.dYaw).toBeCloseTo(-4 * gain.hipStep + -4 * gain.adsStep, 12);
  });

  describe('閘② 守恆（FR-A-9）：Σ dYaw/dPitch ≡ Δaim.yaw/pitch（hip-only）', () => {
    function runConservation(events: Array<{ dx: number; dy: number; t: number }>) {
      const state = createSharedState();
      const cam = cameraLookingDownZ();
      const cameraController = new CameraController(cam, state.aim);
      const recorder = createDataRecorder({ capacity: 256, mouseIntegration: { gain: HIP_GAIN } });
      const loop = createSimLoop(state, fixedClock(0), SIM_HZ, undefined, undefined, undefined, recorder);

      for (const ev of events) {
        cameraController.applyDelta(ev.dx, ev.dy); // render 路徑（camera 側，獨立 AimIntegrator 實例）
        state.input.pushMouse(ev.dx, ev.dy, ev.t); // 量測路徑（同一批事件送進 ring）
      }
      const advanceTo = tickAdvancer(loop);
      advanceTo(20 * TICK_MS);

      const ticks = recorder.snapshot().ticks;
      const sumDYaw = ticks.reduce((s, tk) => s + (tk.dYaw ?? 0), 0);
      const sumDPitch = ticks.reduce((s, tk) => s + (tk.dPitch ?? 0), 0);
      return { sumDYaw, sumDPitch, aim: { yaw: state.aim.yaw, pitch: state.aim.pitch } };
    }

    it('一般序列（未撞夾角）', () => {
      const { sumDYaw, sumDPitch, aim } = runConservation([
        { dx: 3, dy: 1, t: 2 },
        { dx: -5, dy: 2, t: 9 },
        { dx: 10, dy: -3, t: 40 },
        { dx: 0.5, dy: 0.25, t: 41 },
        { dx: -2, dy: 4, t: 100 },
      ]);
      expect(Math.abs(sumDYaw - aim.yaw)).toBeLessThanOrEqual(1e-12);
      expect(Math.abs(sumDPitch - aim.pitch)).toBeLessThanOrEqual(1e-12);
    });

    it('pitch 撞 ±MAX_PITCH 夾角仍守恆（D-A2）', () => {
      const bigDy = -20000; // 遠超 MAX_PITCH 所需，強制撞頂
      const { sumDYaw, sumDPitch, aim } = runConservation([
        { dx: 1, dy: bigDy, t: 2 },
        { dx: 1, dy: bigDy, t: 9 },
        { dx: 1, dy: bigDy, t: 16 },
      ]);
      expect(Math.abs(aim.pitch)).toBeGreaterThan(Math.PI / 2 - 0.02); // 確認真的撞到夾角
      expect(Math.abs(sumDYaw - aim.yaw)).toBeLessThanOrEqual(1e-12);
      expect(Math.abs(sumDPitch - aim.pitch)).toBeLessThanOrEqual(1e-12);
    });
  });

  describe('閘① 刷新率不變性（FR-A-10）：固定合成事件序列 × 4 種 pump 節奏', () => {
    // 事件時間戳固定、與「以何種節奏呼叫 pump()」無關——consume() 只比較 event.t 與固定 128Hz tick
    // 邊界（架構解耦，見 progress.md 的推導）。事件先整批塞進 ring，pump 節奏只決定何時把它們排空。
    function buildFixedEvents(): Array<{ dx: number; dy: number; t: number }> {
      const events: Array<{ dx: number; dy: number; t: number }> = [];
      let t = 0;
      // ≥64 tick（64 * TICK_MS ≈ 500ms）等速段：每 3ms 一筆固定 dx=2。
      while (t < 400) {
        t += 3;
        events.push({ dx: 2, dy: 0.5, t });
      }
      // 一段 flick：短窗內大 dx。
      for (let i = 0; i < 5; i++) {
        t += 1;
        events.push({ dx: 40, dy: -10, t });
      }
      // 收尾等速段，確保覆蓋 ≥64 tick 並留邊界緩衝。
      while (t < 600) {
        t += 3;
        events.push({ dx: 2, dy: 0.5, t });
      }
      return events;
    }

    function runAtPumpCadence(events: ReturnType<typeof buildFixedEvents>, pumpIntervalMs: number) {
      const state = createSharedState();
      const recorder = createDataRecorder({ capacity: 512, mouseIntegration: { gain: HIP_GAIN } });
      const loop = createSimLoop(state, fixedClock(0), SIM_HZ, undefined, undefined, undefined, recorder);

      for (const ev of events) state.input.pushMouse(ev.dx, ev.dy, ev.t);

      const lastT = events.at(-1)?.t ?? 0;
      let now = 0;
      while (now < lastT + TICK_MS) {
        now += pumpIntervalMs;
        loop.pump(now);
      }
      return recorder.snapshot().ticks.map((tk) => ({ dYaw: tk.dYaw, dPitch: tk.dPitch }));
    }

    it('240/165/144/60 Hz 四種 pump 節奏下 dYaw/dPitch 逐位相同（差 = 0，非容差）', () => {
      const events = buildFixedEvents();
      const cadences = [240, 165, 144, 60].map((hz) => 1000 / hz);
      const [ref, ...rest] = cadences.map((interval) => runAtPumpCadence(events, interval));

      expect(ref.length).toBeGreaterThanOrEqual(64);
      for (const run of rest) {
        expect(run).toEqual(ref); // 逐位相同：deepEqual 已是逐位數值比較（無 toBeCloseTo 容差）
      }
    });
  });

  describe('閘③ opt-in 關閉時逐位不變（NFR-A-2）', () => {
    it('mouseIntegration 未啟用：mouse 事件不影響匯出，JSON 序列化不含 dYaw/dPitch key', () => {
      const state = createSharedState();
      const recorder = createDataRecorder({ capacity: 4 });

      pushEvent(state, { type: 'mouse', dx: 100, dy: 100, t: 1 });
      pushEvent(state, { type: 'mouse', dx: -50, dy: 30, t: 5 });
      simStep(state, 1 / SIM_HZ, TICK_MS, undefined, undefined, undefined, undefined, undefined, recorder);

      const tick = recorder.snapshot().ticks[0];
      expect(tick).toEqual({
        t: TICK_MS,
        vx: 0,
        vz: 0,
        px: 0,
        pz: 0,
        tx: null,
        ty: null,
        tz: null,
        aim: { yaw: 0, pitch: 0 },
        keys: [],
        ads: false,
      });
      expect(JSON.stringify(tick)).not.toContain('dYaw');
    });
  });
});

describe('KI-005 / A — RED 基線（修法前）：aim-diff ω 的 ZOH aliasing 簽名（T4 §6 閘①佐證）', () => {
  const HIP_GAIN = resolveMouseGain({ sensitivity: 1, hipFovDeg: 75 });
  // raw 滑鼠取樣率刻意取 SIM_HZ 的整數倍（8×128=1024，貼近真實 ~1000 Hz 滑鼠），使每個 128 Hz
  // tick 窗恰好含整數個 raw 樣本——這是讓「新法」CV→0 的關鍵對齊（非任意選擇）。
  const RAW_HZ = SIM_HZ * 8;
  const RAW_DT_MS = 1000 / RAW_HZ;
  const DX_PER_RAW_SAMPLE = 0.25; // 等速訊號（counts/raw-sample，常數角速度）

  /**
   * 重現 KI-005 根因的關鍵不對稱：`PointerLock.onMove`（render/camera 路徑）只用**單次 dispatched
   * mousemove 的聚合** `movementX/Y`（一次 render 幀一筆），而 `InputSampler.onPointerMove`
   * （量測路徑）用 `getCoalescedEvents()` 把**同一次 dispatch 內的次幀 raw 樣本**逐一各帶自己的
   * `timeStamp` 推進 ring（見 InputSampler.ts:135-140）。兩條路徑消費的是同一組 raw 樣本的
   * **兩種聚合粒度**——camera 每 frame 聚合一次（ZOH 來源）、ring 保留每個 raw 樣本的原始時刻
   * （tick-window 積分的精度來源）。
   */
  function driveRenderAndSim(renderHz: number, totalTicks: number) {
    const state = createSharedState();
    const cam = cameraLookingDownZ();
    const cameraController = new CameraController(cam, state.aim);
    const recorder = createDataRecorder({ capacity: totalTicks + 32, mouseIntegration: { gain: HIP_GAIN } });
    const loop = createSimLoop(state, fixedClock(0), SIM_HZ, undefined, undefined, undefined, recorder);

    const frameDtMs = 1000 / renderHz;
    const totalMs = (totalTicks + 8) * TICK_MS;

    let rawT = 0;
    let nextFrameT = frameDtMs;
    let frameAccumDx = 0;
    while (rawT < totalMs) {
      rawT += RAW_DT_MS;
      state.input.pushMouse(DX_PER_RAW_SAMPLE, 0, rawT); // 新法：每個 raw 樣本各自入 ring（各帶自己的 timeStamp）
      frameAccumDx += DX_PER_RAW_SAMPLE;

      while (rawT >= nextFrameT) {
        cameraController.applyDelta(frameAccumDx, 0); // 舊法：camera 只收「一次 dispatch 的聚合量」
        loop.pump(nextFrameT);
        frameAccumDx = 0;
        nextFrameT += frameDtMs;
      }
    }
    return recorder.snapshot().ticks;
  }

  function coefficientOfVariation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance) / Math.abs(mean);
  }

  it('240 Hz：舊法（ticks[].aim 差分）重現 KI-005 §3.3 簽名；新法（dYaw）同批資料變異係數 ≈ 0', () => {
    const ticks = driveRenderAndSim(240, 96).slice(16, -8); // 去頭去尾暫態
    const oldDiffs: number[] = [];
    for (let i = 1; i < ticks.length; i++) oldDiffs.push(Math.abs(ticks[i].aim.yaw - ticks[i - 1].aim.yaw));

    const mean = oldDiffs.reduce((a, b) => a + b, 0) / oldDiffs.length;
    const normalized = oldDiffs.map((d) => d / mean);
    const low = normalized.filter((n) => n < 0.8);
    const high = normalized.filter((n) => n >= 0.8);

    const dYaw = ticks.map((tk) => tk.dYaw as number);
    // KI-005 §3.3：240/128 = 1.875 = 15/8 → 每 8 tick 週期 7 個「2 幀 tick」+ 1 個「1 幀 tick」。
    // 實測（見 progress.md）：lowRatio≈0.115、lowMean≈0.553、highMean≈1.058、dYawCV≈1.1e-15。
    expect(low.length / normalized.length).toBeGreaterThan(0.08);
    expect(low.length / normalized.length).toBeLessThan(0.18);
    expect(low.reduce((a, b) => a + b, 0) / low.length).toBeGreaterThan(0.4);
    expect(low.reduce((a, b) => a + b, 0) / low.length).toBeLessThan(0.65);
    expect(high.reduce((a, b) => a + b, 0) / high.length).toBeGreaterThan(0.95);
    expect(high.reduce((a, b) => a + b, 0) / high.length).toBeLessThan(1.2);
    expect(coefficientOfVariation(dYaw)).toBeLessThanOrEqual(1e-9);
  });

  it.each([165, 144, 60])('%d Hz：舊法 aim-diff ω 亦有顯著非零變異係數（結構性 aliasing，非 240 Hz 特例）', (hz) => {
    const ticks = driveRenderAndSim(hz, 96).slice(16, -8);
    const oldDiffs: number[] = [];
    for (let i = 1; i < ticks.length; i++) oldDiffs.push(Math.abs(ticks[i].aim.yaw - ticks[i - 1].aim.yaw));

    const dYaw = ticks.map((tk) => tk.dYaw as number);
    // 實測（見 progress.md）：165Hz oldCV≈0.351、144Hz oldCV≈0.280、60Hz oldCV≈1.040；三者 dYawCV≈1.1e-15。
    expect(coefficientOfVariation(oldDiffs)).toBeGreaterThan(0.05);
    expect(coefficientOfVariation(dYaw)).toBeLessThanOrEqual(1e-9);
  });
});
