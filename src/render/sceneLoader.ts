import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { SceneConfig } from '../scene/SceneConfig.ts';

/**
 * sceneLoader — WP-19 / T2（FR-C2）
 *
 * GLTF 場景資產「進得來、出得去、垮不掉」的 async 管線。屬「渲染」層（CONTEXT.md §B）:
 * 只把 GLTF group 載入 world 並套 render-only `displayScale`;**不碰 sim、不讀 propBounds**
 * （GD-6:場景幾何永不進 sim runtime）。
 *
 * 失敗契約(單一路徑):載入失敗一律回 `null`,由呼叫端 fallback 佔位房間 config——
 * 與正常路徑走**同一條 SceneConfig 入口**,無特例分支(README §2 佔位房間收編)。
 */

/** GLTFLoader.loadAsync 的最小結構化子集(供依賴注入/測試 mock,不必真跑 WebGPU/GLTF 解析)。 */
export interface LoadedGltf {
  scene: THREE.Group;
}

export interface SceneAssetLoader {
  loadAsync(url: string): Promise<LoadedGltf>;
}

function defaultLoader(): SceneAssetLoader {
  const loader = new GLTFLoader();
  return { loadAsync: (url) => loader.loadAsync(url) as Promise<LoadedGltf> };
}

/**
 * 載入 GLTF 場景資產,回傳已套 `displayScale` 的 group。
 * `asset === null`(佔位房間程序化場景)或任何載入/解析失敗 → 回 `null`(呼叫端 fallback)。
 */
export async function loadScene(
  config: SceneConfig,
  loaderOverride?: SceneAssetLoader,
): Promise<THREE.Group | null> {
  if (config.asset === null) return null;
  const loader = loaderOverride ?? defaultLoader();
  try {
    const gltf = await loader.loadAsync(config.asset.url);
    const group = gltf.scene;
    group.scale.setScalar(config.asset.displayScale ?? 1);
    return group;
  } catch (error) {
    console.error(`[sceneLoader] 場景資產載入失敗,fallback 佔位房間: ${config.asset.url}`, error);
    return null;
  }
}

/**
 * 完整釋放一棵 Object3D 子樹的 GPU 資源(geometry / material / texture),並自 parent 移除。
 * 場景切換前呼叫,防止 GPU 記憶體洩漏(T2 In scope:dispose 完整釋放)。
 */
export function disposeScene(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Partial<THREE.Mesh>;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (material !== undefined) {
      const materials = Array.isArray(material) ? material : [material];
      for (const m of materials) disposeMaterial(m);
    }
  });
  root.removeFromParent();
}

function disposeMaterial(material: THREE.Material): void {
  // material 上任何 Texture 值屬性(map/normalMap/roughnessMap/...)一律釋放,再釋放 material 本身。
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}
