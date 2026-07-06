import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createImpactRing, IMPACT_CAP, pushImpact } from '../state/SharedState.ts';
import { ImpactView } from './ImpactView.ts';

/** scene 內由 ImpactView 加入的 InstancedMesh。 */
function instanced(scene: THREE.Scene): THREE.InstancedMesh {
  const m = scene.children.find((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
  if (m === undefined) throw new Error('no InstancedMesh in scene');
  return m;
}

/** 取第 i 個 instance 的 world 位置。 */
function instancePos(mesh: THREE.InstancedMesh, i: number): [number, number, number] {
  const mat = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  mesh.getMatrixAt(i, mat);
  pos.setFromMatrixPosition(mat);
  return [pos.x, pos.y, pos.z];
}

describe('ImpactView — 依 impacts 環形格唯讀繪彈孔（FR-B10）', () => {
  it('單一 InstancedMesh（1 draw call 前提）；初始 count=0', () => {
    const scene = new THREE.Scene();
    const view = new ImpactView(scene);

    const meshes = scene.children.filter((c) => c instanceof THREE.InstancedMesh);
    expect(meshes).toHaveLength(1); // 全部彈孔共用一個 InstancedMesh
    expect(view.count).toBe(0);
  });

  it('sync 後 count = 彈著數，instance 位置取自 impacts 座標', () => {
    const scene = new THREE.Scene();
    const view = new ImpactView(scene);
    const ring = createImpactRing();

    pushImpact(ring, 1, 2, -8);
    pushImpact(ring, -3, 1.5, -4);
    view.sync(ring);

    const mesh = instanced(scene);
    expect(view.count).toBe(2);
    expect(instancePos(mesh, 0)).toEqual([1, 2, -8]);
    expect(instancePos(mesh, 1)).toEqual([-3, 1.5, -4]);
  });

  it('無新彈著 → sync 早退（count 不變）', () => {
    const scene = new THREE.Scene();
    const view = new ImpactView(scene);
    const ring = createImpactRing();

    pushImpact(ring, 0, 0, -5);
    view.sync(ring);
    expect(view.count).toBe(1);

    view.sync(ring); // total 未變
    expect(view.count).toBe(1);
  });

  it('增量同步：第二次 sync 只加新彈著，count 累進', () => {
    const scene = new THREE.Scene();
    const view = new ImpactView(scene);
    const ring = createImpactRing();

    pushImpact(ring, 0, 0, -5);
    view.sync(ring);
    expect(view.count).toBe(1);

    pushImpact(ring, 1, 1, -6);
    view.sync(ring);
    const mesh = instanced(scene);
    expect(view.count).toBe(2);
    expect(instancePos(mesh, 1)).toEqual([1, 1, -6]);
  });

  it('cap 溢位 → count 封頂 IMPACT_CAP，最舊槽被新彈著覆寫', () => {
    const scene = new THREE.Scene();
    const view = new ImpactView(scene);
    const ring = createImpactRing();

    for (let i = 0; i < IMPACT_CAP; i++) pushImpact(ring, i, 0, 0);
    view.sync(ring);
    expect(view.count).toBe(IMPACT_CAP);

    // 再一發覆寫 slot 0。
    pushImpact(ring, 999, 7, 7);
    view.sync(ring);

    const mesh = instanced(scene);
    expect(view.count).toBe(IMPACT_CAP); // 封頂
    expect(instancePos(mesh, 0)).toEqual([999, 7, 7]); // 最舊槽被覆寫
  });

  it('dispose 後場景清空 InstancedMesh', () => {
    const scene = new THREE.Scene();
    const view = new ImpactView(scene);
    view.dispose();
    expect(scene.children.filter((c) => c instanceof THREE.InstancedMesh)).toHaveLength(0);
  });
});
