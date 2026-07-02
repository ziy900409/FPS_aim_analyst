import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import type { TargetState } from '../state/types.ts';
import { TargetView } from './TargetView.ts';

/** 建一個 TargetState;預設 visible、box hitbox。 */
function target(over: Partial<TargetState> = {}): TargetState {
  return {
    id: over.id ?? 't',
    side: over.side ?? 'R',
    pos: over.pos ?? { x: 0, y: 1, z: 8 },
    visible: over.visible ?? true,
    alive: over.alive ?? true,
    hitbox: over.hitbox ?? { width: 1, height: 2, depth: 1 },
    motion: over.motion,
    age: over.age,
  };
}

/** scene 內由 TargetView 加入的 mesh(排除燈光等)。 */
function meshes(scene: THREE.Scene): THREE.Mesh[] {
  return scene.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
}

describe('TargetView — 依 state 唯讀顯示/隱藏目標 mesh(FR-4.1)', () => {
  it('visible 目標 → 場景出現對應 mesh,位置/尺寸取自 state', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([target({ pos: { x: -2, y: 1.5, z: 6 }, hitbox: { width: 1, height: 3, depth: 2 } })]);

    const ms = meshes(scene);
    expect(ms).toHaveLength(1);
    expect(ms[0].visible).toBe(true);
    expect(ms[0].position.toArray()).toEqual([-2, 1.5, 6]);
    // 單位 box 以 scale 套 hitbox 尺寸(hitbox 與 mesh 同來源)。
    expect(ms[0].scale.toArray()).toEqual([1, 3, 2]);
  });

  it('visible=false → mesh 隱藏', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([target({ visible: true })]);
    expect(meshes(scene)[0].visible).toBe(true);

    view.sync([target({ visible: false })]);
    expect(meshes(scene)[0].visible).toBe(false);
  });

  it('mesh 重用:目標數變動不新建 mesh(GC 紀律)', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    // 兩個可見目標 → 池長 2。
    view.sync([target({ id: 'a', side: 'L' }), target({ id: 'b', side: 'R' })]);
    expect(view.poolSize).toBe(2);
    expect(meshes(scene).filter((m) => m.visible)).toHaveLength(2);

    // 降到一個 → 池不縮(重用),多出的 mesh 隱藏。
    view.sync([target({ id: 'a', side: 'L' })]);
    expect(view.poolSize).toBe(2);
    expect(meshes(scene).filter((m) => m.visible)).toHaveLength(1);

    // 回到兩個 → 沿用既有池,不新建。
    view.sync([target({ id: 'a', side: 'L' }), target({ id: 'b', side: 'R' })]);
    expect(view.poolSize).toBe(2);
    expect(meshes(scene).filter((m) => m.visible)).toHaveLength(2);
  });

  it('隱藏中的目標不佔用池 slot(只有 visible 者映射到 mesh)', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([
      target({ id: 'a', visible: false }),
      target({ id: 'b', visible: true }),
    ]);
    expect(view.poolSize).toBe(1);
    expect(meshes(scene).filter((m) => m.visible)).toHaveLength(1);
  });

  it('dispose 後場景清空且池歸零', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);
    view.sync([target({ id: 'a' }), target({ id: 'b' })]);
    view.dispose();
    expect(meshes(scene)).toHaveLength(0);
    expect(view.poolSize).toBe(0);
  });
});
