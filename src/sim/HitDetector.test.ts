import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { SIM_HZ } from '../loop/constants.ts';
import { simStep } from '../loop/SimLoop.ts';
import { createSharedState } from '../state/SharedState.ts';
import type { TargetState } from '../state/types.ts';
import { raycastFromCenter, raycastWithRay } from './HitDetector.ts';

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
});
