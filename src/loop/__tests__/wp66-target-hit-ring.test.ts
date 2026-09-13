import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../../data/DataRecorder.ts';
import type { TargetManager } from '../../sim/TargetManager.ts';
import { CS2_PROFILE } from '../../sim/MovementController.ts';
import { createSharedState, type SharedState } from '../../state/SharedState.ts';
import type { TargetState } from '../../state/types.ts';
import { ak47 } from '../../weapon/weapons.ts';
import type { WeaponConfig } from '../../weapon/WeaponConfig.ts';
import { SIM_HZ } from '../constants.ts';
import { simStep } from '../SimLoop.ts';

/**
 * WP-66 / T1 — `targetHits` 的寫入條件（FR-66.1／66.2／66.3）
 *
 * 本檔釘死的不是「命中會亮」，而是**「只有命中才會亮」**：命中回饋是給受試者的刺激，一次「沒打中
 * 卻亮」就直接污染實驗。既有的彈著格（`impacts`）**脫靶也寫**，正是它不能拿來當命中訊號的理由
 * ——下方「脫靶」那條同時斷言 `impacts.total > 0` 且 `targetHits.total === 0`，把兩者的語意差釘死。
 *
 * 寫入條件不得是本 WP 新發明的判定：hitscan 側消費既有的 `hit`（= `accurate && result.hit &&
 * blocker === undefined`），projectile 側消費既有的 `hitIndex >= 0 && arena.accurate[i] === 1`
 * ⇒ 速度閘與 WP-45 occlusion 是**繼承**來的，不是重寫的（GD-7 單一來源）。
 */

const TICK_MS = 1000 / SIM_HZ;

const projectileAk47: WeaponConfig = {
  ...ak47,
  id: 'ak47_projectile_test',
  bullet: { model: 'projectile', speedU: 832, gravityU: 1, maxRangeU: 64 },
};

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

/** 命中即撤除的 TargetManager stub（比照 SimLoop.test.ts 既有寫法）。 */
function killingManager(killed: string[]): TargetManager {
  return {
    tick() {},
    markKilled(s, id) {
      killed.push(id);
      const i = s.targets.findIndex((target) => target.id === id);
      if (i >= 0) s.targets.splice(i, 1);
    },
    reset() {},
  };
}

/** 環形格中已寫入的 id，依 `seq` 還原寫入序（空槽 seq=0 不計）。 */
function writtenIds(state: SharedState): string[] {
  const out: { id: string; seq: number }[] = [];
  for (let i = 0; i < state.targetHits.seq.length; i++) {
    const seq = state.targetHits.seq[i];
    if (seq > 0) out.push({ id: state.targetHits.id[i], seq });
  }
  out.sort((a, b) => a.seq - b.seq);
  return out.map((entry) => entry.id);
}

describe('WP-66 T1 — hitscan 命中寫入 targetHits（FR-66.2）', () => {
  it('命中 → 恰寫一筆，id = 被命中目標，seq 自 1 起', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    const killed: string[] = [];
    state.player.vx = 0; // 精準（靜止）
    state.targets.push(makeTarget('t0', 0, -8));
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    simStep(state, 1 / SIM_HZ, TICK_MS, killingManager(killed), cameraLookingDownZ(), undefined, undefined, undefined, recorder);

    expect(recorder.snapshot().events.find((e) => e.type === 'fire')).toMatchObject({ hit: true, targetId: 't0' });
    expect(state.targetHits.total).toBe(1);
    expect(state.targetHits.cursor).toBe(1);
    expect(state.targetHits.id[0]).toBe('t0');
    expect(state.targetHits.seq[0]).toBe(1);
  });

  it('脫靶 → 零筆，且 impacts.total > 0（證明彈著格不是命中訊號，FR-66.3）', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    state.targets.push(makeTarget('t0', 0, -8));
    state.aim.yaw = 0.2; // 偏離目標
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    simStep(state, 1 / SIM_HZ, TICK_MS, killingManager([]), cameraLookingDownZ(), undefined, undefined, undefined, recorder);

    expect(recorder.snapshot().events.find((e) => e.type === 'fire')).toMatchObject({ hit: false });
    expect(state.impacts.total).toBeGreaterThan(0); // 交戰平面投影彈孔照寫
    expect(state.targetHits.total).toBe(0); // 命中格不寫
  });

  it('occlusion blocker 擋下 → 零筆（WP-45 的隔牆未命中免費繼承）', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    const killed: string[] = [];
    state.targets.push(makeTarget('t0', 0, -8));
    state.heldFire = true;
    state.weapon.nextFireT = 0;
    // 牆面涵蓋 (0,1.5,z) 射線在 z∈[-1,1] 的路徑，落在 camera(z=5) 與目標近面(z=-7.5) 之間。
    const hitscanOcclusion = {
      propBounds: [{ id: 'cover-wall', min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 3, z: 1 } }],
    };

    simStep(state, 1 / SIM_HZ, TICK_MS, killingManager(killed), cameraLookingDownZ(), undefined, undefined, undefined, recorder, undefined, undefined, undefined, hitscanOcclusion);

    expect(recorder.snapshot().events.find((e) => e.type === 'fire')).toMatchObject({ hit: false });
    expect(killed).toEqual([]);
    expect(state.impacts.total).toBe(1); // 彈孔停在牆面
    expect(state.targetHits.total).toBe(0);
  });

  it('未過速度閘（|vx| ≥ accuracyThreshold）→ 零筆，即使射線幾何對準目標', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    const killed: string[] = [];
    state.player.vx = CS2_PROFILE.accuracyThreshold + 0.001; // 移動中開火
    state.targets.push(makeTarget('t0', 0, -8));
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    simStep(state, 1 / SIM_HZ, TICK_MS, killingManager(killed), cameraLookingDownZ(), undefined, undefined, undefined, recorder);

    expect(recorder.snapshot().events.find((e) => e.type === 'fire')).toMatchObject({ hit: false });
    expect(killed).toEqual([]);
    expect(state.targetHits.total).toBe(0);
  });

  it('無存活目標 → 零筆', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 8 });
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    simStep(state, 1 / SIM_HZ, TICK_MS, killingManager([]), cameraLookingDownZ(), undefined, undefined, undefined, recorder);

    expect(recorder.snapshot().events.find((e) => e.type === 'fire')).toMatchObject({ hit: false });
    expect(state.targetHits.total).toBe(0);
  });

  it('persistent 目標連續命中 N 次 → total === N（命中不撤除，回饋要能重複觸發）', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 512 });
    const killed: string[] = [];
    const cam = cameraLookingDownZ();
    const tm = killingManager(killed);
    state.player.vx = 0;
    state.targets.push(makeTarget('t0', 0, -8, { persistent: true }));
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    // 500 ms ÷ AK 0.10 s cycletime ⇒ 數發連射；recoilRuntime 省略 ⇒ 無 spread/punch，發發同幾何。
    const ticks = Math.round(500 / TICK_MS);
    for (let k = 1; k <= ticks; k++) {
      simStep(state, 1 / SIM_HZ, k * TICK_MS, tm, cam, undefined, undefined, undefined, recorder);
    }

    const hits = recorder.snapshot().events.filter((event) => event.type === 'fire' && event.hit);
    expect(hits.length).toBeGreaterThanOrEqual(5); // 情境非平凡（否則 total === N 會是 0 === 0 的假綠燈）
    expect(killed).toEqual([]); // persistent → 全程不撤除
    expect(state.targetHits.total).toBe(hits.length);
    expect(writtenIds(state)).toEqual(new Array(hits.length).fill('t0'));
  });
});

describe('WP-66 T1 — projectile 命中寫入 targetHits（FR-66.2）', () => {
  it('命中 → 恰寫一筆，且與 hit 事件落在同一 tick', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 16 });
    const killed: string[] = [];
    const cam = cameraLookingDownZ();
    const tm = killingManager(killed);
    state.player.vx = 0;
    state.targets.push(makeTarget('t0', 0, -8));
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    // 產彈那一 tick：只有飛行彈、尚未命中 ⇒ 命中格必須仍為空（回饋不得早於命中，這正是
    // D-66-5「projectile 的回饋延遲 = 飛行時間」在 sim 側的表現）。
    simStep(state, 1 / SIM_HZ, TICK_MS, tm, cam, undefined, undefined, undefined, recorder, projectileAk47);
    expect(state.bullets.activeCount).toBe(1);
    expect(state.targetHits.total).toBe(0);

    // 逐 tick 推進至 hit 事件出現；命中格必須在**同一 tick** 由 0 變 1。
    let hitTick = -1;
    for (let k = 2; k <= 12 && hitTick < 0; k++) {
      const before = state.targetHits.total;
      simStep(state, 1 / SIM_HZ, k * TICK_MS, tm, cam, undefined, undefined, undefined, recorder, projectileAk47);
      if (recorder.snapshot().events.some((event) => event.type === 'hit')) {
        hitTick = k;
        expect(before).toBe(0);
        expect(state.targetHits.total).toBe(1);
      }
    }

    expect(hitTick).toBeGreaterThan(1);
    expect(state.targetHits.id[0]).toBe('t0');
    expect(state.targetHits.seq[0]).toBe(1);
  });

  it('未過速度閘的飛行彈（accurate === 0）掃過目標 → 零筆', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 16 });
    const killed: string[] = [];
    const cam = cameraLookingDownZ();
    const tm = killingManager(killed);
    state.targets.push(makeTarget('t0', 0, -8));
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    for (let k = 1; k <= 12; k++) {
      state.player.vx = CS2_PROFILE.accuracyThreshold + 0.001; // 產彈時記下 accurate = 0
      simStep(state, 1 / SIM_HZ, k * TICK_MS, tm, cam, undefined, undefined, undefined, recorder, projectileAk47);
    }

    expect(recorder.snapshot().events.filter((event) => event.type === 'hit')).toEqual([]);
    expect(killed).toEqual([]);
    expect(state.targetHits.total).toBe(0);
  });

  it('逾 maxRangeU 消滅 → 零筆', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 16 });
    const cam = cameraLookingDownZ();
    const tm = killingManager([]);
    state.player.vx = 0;
    state.targets.push(makeTarget('t0', 0, -8));
    state.aim.yaw = 0.2; // 偏離目標 ⇒ 掃掠測不到命中，彈一路飛到 maxRangeU
    state.heldFire = true;
    state.weapon.nextFireT = 0;

    // 832 u/s × (1/128 s) ≈ 6.5 u/tick ⇒ 64 u 約 10 tick 內消滅；跑 16 tick 確保已過期。
    for (let k = 1; k <= 16; k++) {
      simStep(state, 1 / SIM_HZ, k * TICK_MS, tm, cam, undefined, undefined, undefined, recorder, projectileAk47);
    }

    expect(recorder.snapshot().events.filter((event) => event.type === 'hit')).toEqual([]);
    expect(state.shotRays.total).toBeGreaterThan(0); // tracer 有畫（消滅點）
    expect(state.targetHits.total).toBe(0); // 但沒有任何命中
  });
});
