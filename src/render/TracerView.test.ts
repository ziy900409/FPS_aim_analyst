import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createShotRayRing, pushShotRay, TRACER_CAP } from '../state/SharedState.ts';
import { TracerView } from './TracerView.ts';

function instanced(scene: THREE.Scene): THREE.InstancedMesh {
  const m = scene.children.find((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
  if (m === undefined) throw new Error('no InstancedMesh in scene');
  return m;
}

function instanceTransform(mesh: THREE.InstancedMesh, i: number): { pos: THREE.Vector3; scale: THREE.Vector3 } {
  const mat = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  mesh.getMatrixAt(i, mat);
  mat.decompose(pos, quat, scale);
  return { pos, scale };
}

describe('TracerView — 依 shotRays 環形格唯讀繪 tracer（FR-E7）', () => {
  it('單一 InstancedMesh（1 draw call 前提）；初始 count=0', () => {
    const scene = new THREE.Scene();
    const view = new TracerView(scene);

    expect(scene.children.filter((c) => c instanceof THREE.InstancedMesh)).toHaveLength(1);
    expect(view.count).toBe(0);
    expect(view.activeCount).toBe(0);
  });

  it('sync 後 count = 軌跡數，線段由 origin 指向 endpoint', () => {
    const scene = new THREE.Scene();
    const view = new TracerView(scene);
    const ring = createShotRayRing();

    pushShotRay(ring, 0, 0, 0, 10, 0, 0);
    view.sync(ring, 1000);

    const tx = instanceTransform(instanced(scene), 0);
    expect(view.count).toBe(1);
    expect(view.activeCount).toBe(1);
    expect(tx.pos.x).toBeCloseTo(5, 12);
    expect(tx.pos.y).toBeCloseTo(0, 12);
    expect(tx.pos.z).toBeCloseTo(0, 12);
    expect(tx.scale.x).toBeCloseTo(10, 12);
  });

  it('增量同步：第二次 sync 只新增新槽，count 累進', () => {
    const scene = new THREE.Scene();
    const view = new TracerView(scene);
    const ring = createShotRayRing();

    pushShotRay(ring, 0, 0, 0, 10, 0, 0);
    view.sync(ring, 1000);
    pushShotRay(ring, 0, 1, 0, 0, 6, 0);
    view.sync(ring, 1010);

    const mesh = instanced(scene);
    const second = instanceTransform(mesh, 1);
    expect(view.count).toBe(2);
    expect(view.activeCount).toBe(2);
    expect(second.pos.y).toBeCloseTo(3.5, 12);
    expect(second.scale.x).toBeCloseTo(5, 12);
  });

  it('render-time 縮尾並於 lifetime 後隱藏，但不寫回 ring', () => {
    const scene = new THREE.Scene();
    const view = new TracerView(scene);
    const ring = createShotRayRing();

    pushShotRay(ring, 0, 0, 0, 10, 0, 0);
    view.sync(ring, 1000);
    view.sync(ring, 1130);

    const mesh = instanced(scene);
    const half = instanceTransform(mesh, 0);
    expect(half.pos.x).toBeCloseTo(2.5, 12);
    expect(half.scale.x).toBeCloseTo(5, 12);
    expect(ring.seq[0]).toBe(1);

    view.sync(ring, 1261);
    const expired = instanceTransform(mesh, 0);
    expect(view.activeCount).toBe(0);
    expect(expired.scale.x).toBeLessThan(1e-6);
  });

  it('cap 溢位 → count 封頂 TRACER_CAP，最舊槽被新軌跡覆寫', () => {
    const scene = new THREE.Scene();
    const view = new TracerView(scene);
    const ring = createShotRayRing();

    for (let i = 0; i < TRACER_CAP; i++) pushShotRay(ring, i, 0, 0, i + 1, 0, 0);
    view.sync(ring, 1000);
    expect(view.count).toBe(TRACER_CAP);

    pushShotRay(ring, 999, 0, 0, 1009, 0, 0);
    view.sync(ring, 1010);

    const overwritten = instanceTransform(instanced(scene), 0);
    expect(view.count).toBe(TRACER_CAP);
    expect(overwritten.pos.x).toBeCloseTo(1004, 12);
    expect(overwritten.scale.x).toBeCloseTo(10, 12);
  });

  it('clear hides current tracers and can skip ring backlog after a disabled interval', () => {
    const scene = new THREE.Scene();
    const view = new TracerView(scene);
    const ring = createShotRayRing();

    pushShotRay(ring, 0, 0, 0, 10, 0, 0);
    view.sync(ring, 1000);
    expect(view.activeCount).toBe(1);

    view.clear(ring.total);
    expect(view.count).toBe(0);
    expect(view.activeCount).toBe(0);

    pushShotRay(ring, 0, 0, 0, 20, 0, 0);
    view.clear(ring.total); // toggle on after disabled shots: skip old backlog
    view.sync(ring, 1100);
    expect(view.count).toBe(0);

    pushShotRay(ring, 0, 0, 0, 30, 0, 0);
    view.sync(ring, 1110);
    expect(view.count).toBe(3);
    expect(view.activeCount).toBe(1);
  });

  it('dispose 後場景清空 InstancedMesh', () => {
    const scene = new THREE.Scene();
    const view = new TracerView(scene);
    view.dispose();
    expect(scene.children.filter((c) => c instanceof THREE.InstancedMesh)).toHaveLength(0);
  });
});
