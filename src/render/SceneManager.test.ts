import * as THREE from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';
import { placeholderRoom } from '../scene/scenes/placeholder-room.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import { createSceneManager, createSceneManagerWithStatus, SceneManager } from './SceneManager.ts';
import type { SceneAssetLoader } from './sceneLoader.ts';

const gltfConfig: SceneConfig = {
  ...placeholderRoom,
  sceneId: 'gltf-scene',
  asset: { url: '/assets/scenes/field-low/field-low.gltf' },
};

function meshesOf(manager: SceneManager): THREE.Object3D[] {
  return manager.scene.children.filter((child) => child instanceof THREE.Mesh);
}
function lightsOf(manager: SceneManager): THREE.Object3D[] {
  return manager.scene.children.filter((child) => child instanceof THREE.Light);
}

describe('SceneManager', () => {
  it('用 asset:null 的 SceneConfig 建出既有佔位房間與 camera', () => {
    const manager = new SceneManager(placeholderRoom);
    expect(meshesOf(manager)).toHaveLength(5);
    expect(lightsOf(manager)).toHaveLength(2);
    expect(manager.camera.fov).toBe(75);
    expect(manager.camera.position.x).toBe(0);
    expect(manager.camera.position.y).toBeCloseTo(1.6);
    expect(manager.camera.position.z).toBeCloseTo(4);
  });

  it('GLTF 場景只建舞台(camera + 光 + 背景),不建房間牆/地板', () => {
    const manager = new SceneManager(gltfConfig);
    expect(meshesOf(manager)).toHaveLength(0); // GLTF 自帶地形/props
    expect(lightsOf(manager)).toHaveLength(2);
    expect(manager.camera.fov).toBe(75);
  });

  it('mountAsset 掛入 group;重覆 mount 釋放前一個並替換', () => {
    const manager = new SceneManager(gltfConfig);
    const first = new THREE.Group();
    const firstGeom = new THREE.BoxGeometry();
    first.add(new THREE.Mesh(firstGeom, new THREE.MeshStandardMaterial()));
    const firstDispose = vi.spyOn(firstGeom, 'dispose');

    manager.mountAsset(first);
    expect(manager.scene.children).toContain(first);

    const second = new THREE.Group();
    manager.mountAsset(second);
    expect(firstDispose).toHaveBeenCalledOnce();
    expect(manager.scene.children).not.toContain(first);
    expect(manager.scene.children).toContain(second);
  });
});

describe('createSceneManager', () => {
  it('asset:null 走同步程序化房間', async () => {
    const manager = await createSceneManager(placeholderRoom);
    expect(meshesOf(manager)).toHaveLength(5);
  });

  it('GLTF 載入成功 → 掛入 group', async () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    const loader: SceneAssetLoader = { loadAsync: vi.fn(async () => ({ scene: group })) };

    const manager = await createSceneManager(gltfConfig, loader);
    expect(manager.scene.children).toContain(group);
  });

  it('GLTF 載入失敗 → fallback 佔位房間(單一路徑)', async () => {
    const loader: SceneAssetLoader = {
      loadAsync: vi.fn(async () => {
        throw new Error('壞 URL / 斷網');
      }),
    };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const manager = await createSceneManager(gltfConfig, loader);
    // fallback 佔位房間:5 mesh + 2 光,與正常 placeholder 路徑同構。
    expect(meshesOf(manager)).toHaveLength(5);
    expect(lightsOf(manager)).toHaveLength(2);
    errorSpy.mockRestore();
  });

  it('createSceneManagerWithStatus 回報 fallback 狀態與有效 config', async () => {
    const loader: SceneAssetLoader = {
      loadAsync: vi.fn(async () => {
        throw new Error('壞 URL / 斷網');
      }),
    };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await createSceneManagerWithStatus(gltfConfig, loader);

    expect(result.fallback).toBe(true);
    expect(result.effectiveConfig.sceneId).toBe('placeholder-room');
    expect(meshesOf(result.manager)).toHaveLength(5);
    errorSpy.mockRestore();
  });
});
