import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { ReplayTargetView, resolveReplayTargetHitbox } from './ReplayTargetView.ts';
import type { ReplayTargetState } from '../../replay/contracts.ts';

describe('resolveReplayTargetHitbox — GD-7 single-source hitbox fallback', () => {
  it('resolves the H1 default {1,2,1,box} when hitbox is absent (legacy export)', () => {
    expect(resolveReplayTargetHitbox(undefined)).toEqual({ width: 1, height: 2, depth: 1, shape: 'box' });
  });

  it('maps a recorded box hitbox U-suffixed fields to the render-side width/height/depth shape', () => {
    expect(resolveReplayTargetHitbox({ widthU: 0.5, heightU: 0.5, depthU: 0.5, shape: 'sphere' })).toEqual({
      width: 0.5,
      height: 0.5,
      depth: 0.5,
      shape: 'sphere',
    });
  });

  it('defaults shape to box when the recorded hitbox omits it', () => {
    expect(resolveReplayTargetHitbox({ widthU: 1, heightU: 2, depthU: 1 })).toEqual({
      width: 1,
      height: 2,
      depth: 1,
      shape: 'box',
    });
  });
});

function target(id: string, x: number, y: number, z: number): ReplayTargetState {
  return { id, x, y, z };
}

describe('ReplayTargetView', () => {
  it('places one mesh per sampled target and scales it to the resolved hitbox size', () => {
    const scene = new THREE.Scene();
    const view = new ReplayTargetView(scene, { widthU: 0.8, heightU: 1.6, depthU: 0.8, shape: 'box' });

    view.sync([target('t1', 1, 2, 3)]);

    expect(view.poolSize).toBe(1);
    const [mesh] = scene.children as THREE.Mesh[];
    expect(mesh.visible).toBe(true);
    expect(mesh.position.toArray()).toEqual([1, 2, 3]);
    expect(mesh.scale.toArray()).toEqual([0.8, 1.6, 0.8]);
  });

  it('hides pool meshes not used by the current sample instead of removing them (pool reuse, no growth)', () => {
    const scene = new THREE.Scene();
    const view = new ReplayTargetView(scene, undefined);

    view.sync([target('t1', 0, 0, 0)]);
    expect(view.poolSize).toBe(1);
    view.sync([]); // no active target this frame

    expect(view.poolSize).toBe(1); // pool kept, not shrunk
    const [mesh] = scene.children as THREE.Mesh[];
    expect(mesh.visible).toBe(false);
  });

  it('never grows the pool beyond the max concurrent target count seen (official profiles: 0 or 1)', () => {
    const scene = new THREE.Scene();
    const view = new ReplayTargetView(scene, undefined);

    for (let i = 0; i < 50; i++) {
      view.sync(i % 2 === 0 ? [target('t1', i, 0, 0)] : []);
    }

    expect(view.poolSize).toBe(1);
  });

  it('dispose() removes all pooled meshes from the scene and releases shared geometry/material', () => {
    const scene = new THREE.Scene();
    const view = new ReplayTargetView(scene, undefined);
    view.sync([target('t1', 0, 0, 0)]);
    expect(scene.children.length).toBe(1);

    view.dispose();

    expect(scene.children.length).toBe(0);
    expect(view.poolSize).toBe(0);
  });
});
