import * as THREE from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import { disposeScene, loadScene, type SceneAssetLoader } from './sceneLoader.ts';

function gltfSceneConfig(overrides: Partial<SceneConfig['asset'] & object> = {}): SceneConfig {
  return {
    sceneId: 'field-low',
    assetPackVersion: 'test-v1',
    clutterTier: 'low',
    asset: { url: '/assets/scenes/field-low/field-low.gltf', ...overrides },
    propBounds: [],
    playerCorridor: { halfWidthU: 1 },
  };
}

function loaderReturning(group: THREE.Group): SceneAssetLoader {
  return { loadAsync: vi.fn(async () => ({ scene: group })) };
}

describe('loadScene', () => {
  it('asset:null(佔位房間)回 null,讓呼叫端走程序化房間', async () => {
    const config: SceneConfig = { ...gltfSceneConfig(), asset: null };
    await expect(loadScene(config)).resolves.toBeNull();
  });

  it('成功載入回傳 group 並套 displayScale', async () => {
    const group = new THREE.Group();
    const config = gltfSceneConfig({ displayScale: 0.5 });
    const result = await loadScene(config, loaderReturning(group));
    expect(result).toBe(group);
    expect(group.scale.x).toBeCloseTo(0.5);
    expect(group.scale.y).toBeCloseTo(0.5);
    expect(group.scale.z).toBeCloseTo(0.5);
  });

  it('未指定 displayScale 時預設為 1', async () => {
    const group = new THREE.Group();
    const result = await loadScene(gltfSceneConfig(), loaderReturning(group));
    expect(result).toBe(group);
    expect(group.scale.x).toBeCloseTo(1);
  });

  it('載入/解析失敗回 null(fallback 契約),不外拋', async () => {
    const failingLoader: SceneAssetLoader = {
      loadAsync: vi.fn(async () => {
        throw new Error('404 / 壞 URL / 解析失敗');
      }),
    };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(loadScene(gltfSceneConfig(), failingLoader)).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});

describe('disposeScene', () => {
  it('釋放 geometry / material / texture 並自 parent 移除', () => {
    const parent = new THREE.Scene();
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    parent.add(group);

    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose');

    disposeScene(group);

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(parent.children).not.toContain(group);
  });

  it('釋放材質陣列的每個 material', () => {
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const matA = new THREE.MeshStandardMaterial();
    const matB = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geometry, [matA, matB]);
    group.add(mesh);

    const disposeA = vi.spyOn(matA, 'dispose');
    const disposeB = vi.spyOn(matB, 'dispose');

    disposeScene(group);

    expect(disposeA).toHaveBeenCalledOnce();
    expect(disposeB).toHaveBeenCalledOnce();
  });
});
