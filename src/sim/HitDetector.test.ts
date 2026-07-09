import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { SIM_HZ } from '../loop/constants.ts';
import { simStep } from '../loop/SimLoop.ts';
import { createSharedState } from '../state/SharedState.ts';
import type { TargetState } from '../state/types.ts';
import { raycastFromCenter, raycastWithRay, type HitPointOut } from './HitDetector.ts';

/** 建一台朝 -Z 看的 camera（等同 SceneManager 基準朝向），並更新 matrixWorld 供 raycast。 */
function cameraLookingDownZ(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  cam.position.set(0, 1.5, 5);
  cam.lookAt(0, 1.5, -1); // 朝 -Z
  cam.updateMatrixWorld(true); // Raycaster.setFromCamera 讀 matrixWorld（測試須顯式更新）
  return cam;
}

/** 建一個 active（visible+alive）目標；預設單一 box hitbox（H1）。 */
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

function cameraCenterRay(cam: THREE.Camera): { origin: THREE.Vector3; direction: THREE.Vector3 } {
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  cam.getWorldPosition(origin);
  cam.getWorldDirection(direction);
  return { origin, direction };
}

function rayTowardTarget(origin: THREE.Vector3, target: TargetState): THREE.Vector3 {
  return new THREE.Vector3(target.pos.x, target.pos.y, target.pos.z).sub(origin).normalize();
}

/** 從 origin 指向任意 world point 的正規化方向（sub-tick 內插測試用；瞄準非目標中心的一點）。 */
function rayToPoint(origin: THREE.Vector3, x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z).sub(origin).normalize();
}

describe('HitDetector — raycastFromCenter（camera 中心射線判命中，FR-5.1）', () => {
  it('camera 正對目標 → hit，回傳 targetId', () => {
    const cam = cameraLookingDownZ();
    const result = raycastFromCenter(cam, [makeTarget('t0', 0, -8)]);

    expect(result.hit).toBe(true);
    expect(result.targetId).toBe('t0');
  });

  it('目標偏離中心射線 → miss', () => {
    const cam = cameraLookingDownZ();
    // hitbox x∈[4.5,5.5]，中心射線在 x=0 → 未穿過。
    const result = raycastFromCenter(cam, [makeTarget('t0', 5, -8)]);

    expect(result.hit).toBe(false);
    expect(result.targetId).toBeUndefined();
  });

  it('目標在 camera 後方 → miss（射線只朝前）', () => {
    const cam = cameraLookingDownZ();
    // camera 朝 -Z；目標在 +Z（背後）→ 射線不命中。
    const result = raycastFromCenter(cam, [makeTarget('t0', 0, 10)]);

    expect(result.hit).toBe(false);
  });

  it('多目標同在射線上 → 取最近者', () => {
    const cam = cameraLookingDownZ();
    const far = makeTarget('far', 0, -8);
    const near = makeTarget('near', 0, -4); // 較接近 camera（z=5）
    const result = raycastFromCenter(cam, [far, near]);

    expect(result.hit).toBe(true);
    expect(result.targetId).toBe('near');
  });

  it('不命中非 active 目標（invisible / 已死）', () => {
    const cam = cameraLookingDownZ();
    const dead = makeTarget('dead', 0, -8, { alive: false });
    const hidden = makeTarget('hidden', 0, -8, { visible: false });

    expect(raycastFromCenter(cam, [dead]).hit).toBe(false);
    expect(raycastFromCenter(cam, [hidden]).hit).toBe(false);
  });

  it('無目標 → miss', () => {
    const cam = cameraLookingDownZ();
    expect(raycastFromCenter(cam, []).hit).toBe(false);
  });
});

describe('HitDetector — raycastWithRay（注入式射線方向，FR-B8）', () => {
  it('與 raycastFromCenter 在同 camera 中心射線下等價', () => {
    const cam = cameraLookingDownZ();
    const targets = [
      makeTarget('far', 0, -8),
      makeTarget('near', 0, -4, { hitbox: { width: 1, height: 2, depth: 1, part: 'head' } }),
    ];
    const { origin, direction } = cameraCenterRay(cam);

    expect(raycastWithRay(origin, direction, targets)).toEqual(raycastFromCenter(cam, targets));
  });

  it('注入偏移方向可命中側向目標', () => {
    const origin = new THREE.Vector3(0, 1.5, 5);
    const sideTarget = makeTarget('side', 3, -8, {
      hitbox: { width: 1, height: 2, depth: 1, part: 'body' },
    });
    const direction = rayTowardTarget(origin, sideTarget);

    expect(raycastWithRay(origin, direction, [sideTarget])).toEqual({
      hit: true,
      targetId: 'side',
      part: 'body',
    });
  });

  it('反向注入方向不命中前方目標', () => {
    const origin = new THREE.Vector3(0, 1.5, 5);
    const target = makeTarget('front', 0, -8);
    const backward = rayTowardTarget(origin, target).negate();

    expect(raycastWithRay(origin, backward, [target])).toEqual({ hit: false });
  });

  it('多目標同在注入射線上 → 取最近者', () => {
    const origin = new THREE.Vector3(0, 1.5, 5);
    const near = makeTarget('near', 3, -4);
    const far = makeTarget('far', 6, -13);
    const direction = rayTowardTarget(origin, near);

    expect(raycastWithRay(origin, direction, [far, near])).toEqual({
      hit: true,
      targetId: 'near',
      part: undefined,
    });
  });

  it('注入射線略過 invisible / dead 目標', () => {
    const origin = new THREE.Vector3(0, 1.5, 5);
    const dead = makeTarget('dead', 0, -8, { alive: false });
    const hidden = makeTarget('hidden', 0, -8, { visible: false });
    const { direction } = cameraCenterRay(cameraLookingDownZ());

    expect(raycastWithRay(origin, direction, [dead, hidden])).toEqual({ hit: false });
  });
});

describe('HitDetector — 目標 sub-tick 命中內插（WP-18 / T2，FR-B17）', () => {
  const origin = new THREE.Vector3(0, 1.5, 5);
  const centerDir = new THREE.Vector3(0, 0, -1); // 準心中心射線（x=0）

  it('靜止目標（posPrev==pos）：任意 subAlpha 逐位等價現行判定（零破壞不變式）', () => {
    const staticT = makeTarget('t0', 0, -8, { posPrev: { x: 0, y: 1.5, z: -8 } });
    const baseline = raycastWithRay(origin, centerDir, [makeTarget('t0', 0, -8)]);
    for (const alpha of [0, 0.25, 0.5, 0.75, 1]) {
      expect(raycastWithRay(origin, centerDir, [staticT], undefined, alpha)).toEqual(baseline);
    }
    // 命中點回填亦逐位等價（posPrev==pos → 內插中心 == pos）。
    const hpInterp: HitPointOut = { valid: false, x: 0, y: 0, z: 0 };
    const hpBase: HitPointOut = { valid: false, x: 0, y: 0, z: 0 };
    raycastWithRay(origin, centerDir, [staticT], hpInterp, 0.5);
    raycastWithRay(origin, centerDir, [makeTarget('t0', 0, -8)], hpBase);
    expect(hpInterp).toEqual(hpBase);
  });

  it('無 posPrev + subAlpha → 退回讀 pos（向後相容;直接注入目標無快照欄）', () => {
    const noPrev = makeTarget('t0', 0, -8); // 無 posPrev
    expect(raycastWithRay(origin, centerDir, [noPrev], undefined, 0.3)).toEqual(
      raycastWithRay(origin, centerDir, [noPrev]),
    );
  });

  it('移動目標 fire 中點 → 命中中心 ≈ 兩 tick 中點（posPrev x=−1、posCurr x=+1 → 中點 0）', () => {
    // posCurr(pos) x=+1、posPrev x=−1 → 中點 x=0。射線瞄準 x=0.4（非中心）：只有內插中心落在 ~0
    // 時才命中（hitbox 半寬 0.5 → x∈[−0.1,0.9]）;若讀 posCurr(x=1) 或 posPrev(x=−1) 皆脫靶。
    const moving = makeTarget('t0', 1, -8, { posPrev: { x: -1, y: 1.5, z: -8 } });
    const dir = rayToPoint(origin, 0.4, 1.5, -8);
    expect(raycastWithRay(origin, dir, [moving], undefined, 0.5).hit).toBe(true); // 中點 x=0 → 命中
    expect(raycastWithRay(origin, dir, [moving], undefined, 1).hit).toBe(false); // posCurr x=1 → 脫靶
    expect(raycastWithRay(origin, dir, [moving], undefined, 0).hit).toBe(false); // posPrev x=−1 → 脫靶
  });

  it('邊界:subAlpha=0 → posPrev 位置、subAlpha=1 → posCurr 位置', () => {
    // posPrev x=0（中心射線命中）、posCurr(pos) x=3（脫靶）。α=0 取 posPrev → 命中;α=1 取 posCurr → 脫靶。
    const moving = makeTarget('t0', 3, -8, { posPrev: { x: 0, y: 1.5, z: -8 } });
    expect(raycastWithRay(origin, centerDir, [moving], undefined, 0).hit).toBe(true);
    expect(raycastWithRay(origin, centerDir, [moving], undefined, 1).hit).toBe(false);
  });

  it('翻轉案例:高速移動目標,sub-tick 命中 vs「最近 tick 位置」脫靶（FR-B17 修正的偏差）', () => {
    // 目標本 tick 由 x=0 移到 x=2（位移 2u,遠大於 hitbox 半寬 0.5）。fire 落在 tick 前段（α=0.1）：
    // 內插中心 x=0.2、hitbox x∈[−0.3,0.7] → 中心射線(x=0)命中。舊行為讀 tick 末 pos(x=2、hitbox
    // [1.5,2.5]) → 脫靶。此即 FR-B17 修正對象:命中判定對齊 fire 時刻而非 tick 末（偏差量化 = 2u 位移
    // 造成命中↔脫靶翻轉）。
    const fast = makeTarget('t0', 2, -8, { posPrev: { x: 0, y: 1.5, z: -8 } });
    expect(raycastWithRay(origin, centerDir, [fast], undefined, 0.1).hit).toBe(true); // sub-tick 內插 → 命中
    expect(raycastWithRay(origin, centerDir, [fast]).hit).toBe(false); //                「最近 tick」→ 脫靶
  });
});

describe('HitDetector — hitPointOut 命中點回填（WP-13 / T3）', () => {
  function out(): HitPointOut {
    return { valid: false, x: 0, y: 0, z: 0 };
  }

  it('命中 → valid=true，座標落在 hitbox 近面上', () => {
    // origin z=5 沿 -Z；target z=-8、depth=1 → hitbox z∈[-8.5,-7.5]，近面 z=-7.5。
    const origin = new THREE.Vector3(0, 1.5, 5);
    const dir = new THREE.Vector3(0, 0, -1);
    const target = makeTarget('t0', 0, -8);
    const hp = out();

    const result = raycastWithRay(origin, dir, [target], hp);

    expect(result.hit).toBe(true);
    expect(hp.valid).toBe(true);
    expect(hp.z).toBeCloseTo(-7.5, 5); // 近面（entry point）
    expect(hp.x).toBeCloseTo(0, 5);
    expect(hp.y).toBeCloseTo(1.5, 5);
  });

  it('未命中 → valid=false（座標不作數）', () => {
    const origin = new THREE.Vector3(0, 1.5, 5);
    const dir = new THREE.Vector3(0, 0, -1);
    const target = makeTarget('t0', 5, -8); // 偏離射線
    const hp = out();

    const result = raycastWithRay(origin, dir, [target], hp);

    expect(result.hit).toBe(false);
    expect(hp.valid).toBe(false);
  });

  it('多目標 → 回填最近命中點', () => {
    const origin = new THREE.Vector3(0, 1.5, 5);
    const dir = new THREE.Vector3(0, 0, -1);
    const far = makeTarget('far', 0, -8); // 近面 z=-7.5
    const near = makeTarget('near', 0, -4); // 近面 z=-3.5（較近 camera）
    const hp = out();

    const result = raycastWithRay(origin, dir, [far, near], hp);

    expect(result.targetId).toBe('near');
    expect(hp.z).toBeCloseTo(-3.5, 5);
  });

  it('未提供 hitPointOut → 行為不變（回傳形狀不含命中點）', () => {
    const origin = new THREE.Vector3(0, 1.5, 5);
    const dir = new THREE.Vector3(0, 0, -1);
    expect(raycastWithRay(origin, dir, [makeTarget('t0', 0, -8)])).toEqual({
      hit: true,
      targetId: 't0',
      part: undefined,
    });
  });
});

describe('HitDetector — simStep fire 事件 → 第一次命中即擊殺（OQ-5.4）', () => {
  it('fire 命中 → markKilled 撤除目標', () => {
    const state = createSharedState();
    const cam = cameraLookingDownZ();
    // 手動放一個 active 目標於準心上（tm.tick 見有存活目標即不再 spawn）。
    state.targets.push(makeTarget('t0', 0, -8));

    // 追蹤 markKilled 是否以正確 id 被呼叫。
    const killed: string[] = [];
    const tm = {
      tick() {},
      markKilled(_s: typeof state, id: string) {
        killed.push(id);
        const i = _s.targets.findIndex((t) => t.id === id);
        if (i >= 0) _s.targets.splice(i, 1);
      },
      reset() {},
    };

    state.input.pushFire(true, 1); // t=1，落在本 tick 窗 [_, 100)
    simStep(state, 1 / SIM_HZ, 100, tm, cam);

    expect(killed).toEqual(['t0']);
    expect(state.targets).toHaveLength(0);
  });

  it('目標偏離準心 → fire 不擊殺', () => {
    const state = createSharedState();
    const cam = cameraLookingDownZ();
    state.targets.push(makeTarget('t0', 5, -8)); // 偏離中心射線

    const killed: string[] = [];
    const tm = {
      tick() {},
      markKilled(_s: typeof state, id: string) {
        killed.push(id);
      },
      reset() {},
    };

    state.input.pushFire(true, 1);
    simStep(state, 1 / SIM_HZ, 100, tm, cam);

    expect(killed).toEqual([]);
    expect(state.targets).toHaveLength(1);
  });

  it('fire 命中 → 彈著點寫入 state.impacts（world 座標,近面上）', () => {
    // camera(0,1.5,5) 朝 -Z；target z=-8 depth1 → 近面 z=-7.5。punch=0 → 彈道退化中心射線 → 命中。
    const state = createSharedState();
    const cam = cameraLookingDownZ();
    state.targets.push(makeTarget('t0', 0, -8));
    const tm = { tick() {}, markKilled() {}, reset() {} };

    state.input.pushFire(true, 1);
    simStep(state, 1 / SIM_HZ, 100, tm, cam);

    expect(state.impacts.total).toBe(1);
    expect(state.impacts.x[0]).toBeCloseTo(0, 5);
    expect(state.impacts.y[0]).toBeCloseTo(1.5, 5);
    expect(state.impacts.z[0]).toBeCloseTo(-7.5, 5);
  });

  it('fire 未命中目標 → 彈著投影至交戰平面（active 目標 z 深度;WP-13 T4 壓槍 pattern 可視化）', () => {
    const state = createSharedState();
    const cam = cameraLookingDownZ();
    state.targets.push(makeTarget('t0', 5, -8)); // 偏離中心射線 → 脫靶(不擊殺、不計命中)
    const tm = { tick() {}, markKilled() {}, reset() {} };

    state.input.pushFire(true, 1);
    simStep(state, 1 / SIM_HZ, 100, tm, cam);

    // 脫靶仍投影彈孔到交戰平面 z=-8:camera(0,1.5,5) 中心射線 → (0,1.5,-8)。目標未被擊殺(留存)。
    expect(state.impacts.total).toBe(1);
    expect(state.impacts.x[0]).toBeCloseTo(0, 5);
    expect(state.impacts.y[0]).toBeCloseTo(1.5, 5);
    expect(state.impacts.z[0]).toBeCloseTo(-8, 5);
    expect(state.targets).toHaveLength(1);
  });

  it('fire 脫靶且無存活目標 → 不產彈孔（交戰平面未定義,impacts 空）', () => {
    const state = createSharedState();
    const cam = cameraLookingDownZ();
    // 無目標 → 無交戰平面可投影(drill 收尾邊界);彈道脫靶不留痕。
    const tm = { tick() {}, markKilled() {}, reset() {} };

    state.input.pushFire(true, 1);
    simStep(state, 1 / SIM_HZ, 100, tm, cam);

    expect(state.impacts.total).toBe(0);
  });
});

describe('HitDetector — simStep sub-tick 命中內插端到端（WP-18 / T2，fire 時間戳 → subAlpha 接線）', () => {
  // tick 窗 [tickStart, 100)：tickMs = (1/SIM_HZ)·1000 = 1000/128 = 7.8125 → tickStart = 92.1875。
  const TICK_MS = 1000 / SIM_HZ;
  const TICK_START = 100 - TICK_MS;
  const atSubAlpha = (a: number): number => TICK_START + a * TICK_MS;

  /** tm stub：tick() 內把目標由 x=0 驅到 x=2（模擬 motion drive,發生於 simStep posPrev 快照之後）。 */
  function movingSetup() {
    const state = createSharedState();
    const cam = cameraLookingDownZ();
    // posPrev 必須存在,simStep 快照迴圈才會維護（無 posPrev 的目標退回讀 pos）；起始 pos.x=0。
    state.targets.push(makeTarget('t0', 0, -8, { posPrev: { x: 0, y: 1.5, z: -8 } }));
    const killed: string[] = [];
    const tm = {
      tick(_s: typeof state) {
        _s.targets[0].pos.x = 2; // posCurr = 2（posPrev 已由 simStep 快照為 0）
      },
      markKilled(_s: typeof state, id: string) {
        killed.push(id);
        const i = _s.targets.findIndex((t) => t.id === id);
        if (i >= 0) _s.targets.splice(i, 1);
      },
      reset() {},
    };
    return { state, cam, tm, killed };
  }

  it('fire 於 tick 前段（subAlpha≈0.1）→ 內插中心 x≈0.2 → 命中（對比「最近 tick」x=2 脫靶）', () => {
    const { state, cam, tm, killed } = movingSetup();
    state.input.pushFire(true, atSubAlpha(0.1)); // 92.96875
    simStep(state, 1 / SIM_HZ, 100, tm, cam);
    expect(killed).toEqual(['t0']); // sub-tick 內插命中 → markKilled；舊「讀 pos=2」則會脫靶不擊殺
    expect(state.targets).toHaveLength(0);
  });

  it('fire 於 tick 中段（subAlpha≈0.5）→ 內插中心 x=1.0 → 脫靶（目標已離開準心）', () => {
    const { state, cam, tm, killed } = movingSetup();
    state.input.pushFire(true, atSubAlpha(0.5)); // 96.09375
    simStep(state, 1 / SIM_HZ, 100, tm, cam);
    expect(killed).toEqual([]); // 內插中心 x=1.0、hitbox [0.5,1.5] → 中心射線(x=0)脫靶
    expect(state.targets).toHaveLength(1);
  });
});
