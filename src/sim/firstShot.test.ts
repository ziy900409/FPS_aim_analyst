import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { SIM_HZ } from '../loop/constants.ts';
import { simStep } from '../loop/SimLoop.ts';
import { createSharedState } from '../state/SharedState.ts';
import type { TargetState } from '../state/types.ts';
import { currentPeekId, firstShotGate } from './firstShot.ts';

/** 建一個 active（visible+alive）目標於準心上（camera 朝 -Z、目標在 -Z）。 */
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

/** 建一台朝 -Z 看的 camera 並更新 matrixWorld（供 raycast，同 HitDetector.test）。 */
function cameraLookingDownZ(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  cam.position.set(0, 1.5, 5);
  cam.lookAt(0, 1.5, -1);
  cam.updateMatrixWorld(true);
  return cam;
}

describe('firstShot — firstShotGate（每 peek 首發，掃射不稀釋，FR-5.2）', () => {
  it('同 peek 連開三槍 → 只有第一槍 firstShot=true', () => {
    const state = createSharedState();
    expect(firstShotGate(state, 't0')).toBe(true); // 首發
    expect(firstShotGate(state, 't0')).toBe(false); // 掃射不稀釋
    expect(firstShotGate(state, 't0')).toBe(false);
  });

  it('換 peek（新 id）→ 第一槍又 true（隱式 reset）', () => {
    const state = createSharedState();
    expect(firstShotGate(state, 't0')).toBe(true);
    expect(firstShotGate(state, 't0')).toBe(false);
    // 新目標可見 = 新 peekId → 首發旗標重新放行。
    expect(firstShotGate(state, 't1')).toBe(true);
    expect(firstShotGate(state, 't1')).toBe(false);
  });

  it('旗標記憶寫入 state.firstShotPeekId', () => {
    const state = createSharedState();
    expect(state.firstShotPeekId).toBeNull();
    firstShotGate(state, 't0');
    expect(state.firstShotPeekId).toBe('t0');
    firstShotGate(state, 't1');
    expect(state.firstShotPeekId).toBe('t1');
  });
});

describe('firstShot — currentPeekId（active 目標 = peek 錨）', () => {
  it('回傳第一個 visible && alive 目標 id', () => {
    const state = createSharedState();
    state.targets.push(makeTarget('t0', 0, -8));
    expect(currentPeekId(state)).toBe('t0');
  });

  it('略過 invisible / dead 目標', () => {
    const state = createSharedState();
    state.targets.push(makeTarget('dead', 0, -8, { alive: false }));
    state.targets.push(makeTarget('hidden', 0, -8, { visible: false }));
    state.targets.push(makeTarget('t0', 0, -8));
    expect(currentPeekId(state)).toBe('t0');
  });

  it('無 active 目標 → undefined', () => {
    const state = createSharedState();
    expect(currentPeekId(state)).toBeUndefined();
    state.targets.push(makeTarget('dead', 0, -8, { alive: false }));
    expect(currentPeekId(state)).toBeUndefined();
  });
});

describe('firstShot — simStep 整合（fire 串流內判首發，換 peek reset）', () => {
  /** markKilled 撤除目標 + 依既有 nextSide 於對側 spawn 新 id（模擬 TargetManager P2 行為）。 */
  function makeTargetManager() {
    let nextId = 1;
    return {
      tick(s: ReturnType<typeof createSharedState>, _nowMs: number) {
        // 無存活目標 → spawn 新 peek（唯一新 id）。
        if (!s.targets.some((t) => t.alive)) s.targets.push(makeTarget(`t${nextId++}`, 0, -8));
      },
      markKilled(s: ReturnType<typeof createSharedState>, id: string) {
        const i = s.targets.findIndex((t) => t.id === id);
        if (i >= 0) s.targets.splice(i, 1);
      },
      reset() {},
    };
  }

  it('同 peek 內連開三槍未命中 → 首發旗標只記錄一次該 peek', () => {
    const state = createSharedState();
    const cam = cameraLookingDownZ();
    const tm = makeTargetManager();
    // 目標偏離準心（x=5）→ fire 不命中、不擊殺、peek 不變。
    state.targets.push(makeTarget('t0', 5, -8));

    for (let k = 0; k < 3; k++) {
      state.input.pushFire(true, 1 + k);
      simStep(state, 1 / SIM_HZ, 100, tm, cam);
    }

    expect(state.firstShotPeekId).toBe('t0'); // 三槍同 peek，旗標仍指 t0（未被稀釋成別的 peek）
    expect(state.targets).toHaveLength(1); // 未命中 → 目標仍在
  });

  it('命中擊殺 → 換 peek → 下一 fire 對新 peek 又計首發', () => {
    const state = createSharedState();
    const cam = cameraLookingDownZ();
    const tm = makeTargetManager();
    state.targets.push(makeTarget('t0', 0, -8)); // 正對準心

    // tick 1：fire 命中 t0 → markKilled；首發已在命中前對 t0 判定。
    state.input.pushFire(true, 1);
    simStep(state, 1 / SIM_HZ, 100, tm, cam);
    expect(state.firstShotPeekId).toBe('t0');
    expect(state.targets).toHaveLength(0);

    // tick 2：tm.tick spawn 新 peek t1（唯一新 id）；fire 命中 → 首發對 t1 重新放行。
    state.input.pushFire(true, 101);
    simStep(state, 1 / SIM_HZ, 200, tm, cam);
    expect(state.firstShotPeekId).toBe('t1'); // 換 peek → 首發旗標隨新 id 推進
  });
});
