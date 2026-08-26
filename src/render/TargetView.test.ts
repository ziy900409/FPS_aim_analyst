import * as THREE from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';
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
    hitbox: over.hitbox ?? { width: 1, height: 2, depth: 1, shape: 'box' },
    motion: over.motion,
    age: over.age,
    posPrev: over.posPrev,
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

    view.sync([target({ pos: { x: -2, y: 1.5, z: 6 }, hitbox: { width: 1, height: 3, depth: 2, shape: 'box' } })]);

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

  it('render alpha 內插：posPrev→pos，alpha=0→posPrev、1→pos、0.5→中點（WP-18/T3，render-only）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);
    const moving = (): TargetState =>
      target({ pos: { x: 4, y: 1.5, z: -8 }, posPrev: { x: 0, y: 1.5, z: -8 } });

    view.sync([moving()], 0);
    expect(meshes(scene)[0].position.toArray()).toEqual([0, 1.5, -8]); // α=0 → posPrev

    view.sync([moving()], 1);
    expect(meshes(scene)[0].position.toArray()).toEqual([4, 1.5, -8]); // α=1 → pos

    view.sync([moving()], 0.5);
    expect(meshes(scene)[0].position.toArray()).toEqual([2, 1.5, -8]); // α=0.5 → 中點
  });

  it('無 posPrev → 退回讀 pos（向後相容；alpha 省略＝1）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([target({ pos: { x: -2, y: 1.5, z: 6 } })]); // 無 posPrev、alpha 預設 1
    expect(meshes(scene)[0].position.toArray()).toEqual([-2, 1.5, 6]);
  });

  it('sync 不寫回 state（render 唯讀；posPrev/pos 不被修改）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);
    const t = target({ pos: { x: 4, y: 1.5, z: -8 }, posPrev: { x: 0, y: 1.5, z: -8 } });

    view.sync([t], 0.5);
    expect(t.pos).toEqual({ x: 4, y: 1.5, z: -8 });
    expect(t.posPrev).toEqual({ x: 0, y: 1.5, z: -8 });
  });

  it('setShape(\'sphere\') 後新 spawn 的目標渲染為 SphereGeometry（WP-46/T3 FR-46.3）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.setShape('sphere');
    view.sync([target()]);

    expect(meshes(scene)[0].geometry).toBeInstanceOf(THREE.SphereGeometry);
  });

  it('既有 pool mesh（非新建）換形狀後 geometry 參照同步更新（WP-46/T3）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([target()]);
    const existingMesh = meshes(scene)[0];
    expect(existingMesh.geometry).toBeInstanceOf(THREE.BoxGeometry);

    view.setShape('sphere');

    // 同一個 mesh 物件（identity 不變），geometry 已換成新的。
    expect(meshes(scene)[0]).toBe(existingMesh);
    expect(existingMesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
  });

  it('連續呼叫 setShape(\'box\') 同形狀為 no-op：不重複 dispose 舊 geometry（WP-46/T3）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([target()]);
    const geometryBefore = meshes(scene)[0].geometry;
    const disposeSpy = vi.spyOn(geometryBefore, 'dispose');

    view.setShape('box');
    view.setShape('box');

    expect(disposeSpy).not.toHaveBeenCalled();
    expect(meshes(scene)[0].geometry).toBe(geometryBefore);
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
