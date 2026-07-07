import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { placeholderRoom } from '../scene/scenes/placeholder-room.ts';
import { SceneManager } from './SceneManager.ts';

describe('SceneManager', () => {
  it('用 asset:null 的 SceneConfig 建出既有佔位房間與 camera', () => {
    const manager = new SceneManager(placeholderRoom);
    const meshes = manager.scene.children.filter((child) => child instanceof THREE.Mesh);
    const lights = manager.scene.children.filter((child) => child instanceof THREE.Light);

    expect(meshes).toHaveLength(5);
    expect(lights).toHaveLength(2);
    expect(manager.camera.fov).toBe(75);
    expect(manager.camera.position.x).toBe(0);
    expect(manager.camera.position.y).toBeCloseTo(1.6);
    expect(manager.camera.position.z).toBeCloseTo(4);
  });

  it('GLTF asset 場景保留給 T2 管線處理', () => {
    expect(
      () =>
        new SceneManager({
          ...placeholderRoom,
          asset: { url: '/assets/scenes/field-low/scene.gltf' },
        }),
    ).toThrow(/WP-19 T2/);
  });
});
