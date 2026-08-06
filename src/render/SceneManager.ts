import * as THREE from 'three/webgpu';
import type { ProceduralRoomConfig, SceneConfig } from '../scene/SceneConfig.ts';
import { disposeScene, loadScene, type SceneAssetLoader } from './sceneLoader.ts';
import { placeholderRoom } from '../scene/scenes/placeholder-room.ts';
import { DEFAULT_PROCEDURAL_ROOM, resolveEyeWorldBase } from '../scene/eyePose.ts';

/**
 * SceneManager — WP-1 / T1（FR-1.1）+ WP-19 / T2（FR-C2）
 *
 * 建出可見的舞台(camera + 光 + 背景)與可見幾何,作為 WP-1 視角與 WP-4 目標的舞台。
 * 本檔屬「渲染」層（CONTEXT.md §B）：只擺場景與 camera，不碰 sim、不引入 accumulator
 * （雙迴圈邊界，WP-2）;**不讀 propBounds**(GD-6:場景幾何永不進 sim runtime)。
 *
 * 兩種場景走**同一個 SceneConfig 入口**(README §2 佔位房間收編):
 * - `asset === null`:程序化房間(地板 + 四牆 + 光),`proceduralRoom` 描述尺寸/顏色/光照。
 * - `asset !== null`:GLTF 場景。`proceduralRoom` 仍描述 camera(眼高/FOV/standoff)+ 光 +
 *   背景色的「舞台」,但**不建牆/地板**(GLTF 自帶地形/props);GLTF group 由 `createSceneManager`
 *   async 載入後 `mountAsset()` 掛入。載入失敗 fallback 佔位房間(同一路徑,無特例分支)。
 *
 * ⚠️ 單位：房間尺寸 / 眼高為 **render 端佔位常數**（THREE world unit；OQ-1.2，
 * 10×10×3、眼高 ~1.6）。正式幾何由 WP-6 drill config 以 **canonical CS unit (u)**
 * 定義（CONTEXT.md §C 正規單位：sim/資料一律 u/s，render 可另套 display scale）。
 * 此處的數字不得流入 sim 或匯出資料。
 */

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  #assetGroup: THREE.Group | null = null;

  constructor(config: SceneConfig) {
    const room = config.proceduralRoom ?? DEFAULT_PROCEDURAL_ROOM;
    const [width, depth, height] = room.roomSize;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(room.colors.background);

    // 程序化房間幾何只在無 GLTF 資產時建;GLTF 場景自帶地形/props(見類別註解)。
    if (config.asset === null) {
      this.#buildRoom(width, depth, height, room.colors);
    }
    this.#buildLights(room.lights);

    // camera 立於房間一端、踩中軸，朝 -Z 望向對牆與中軸（FR-1.1）。
    // T4 的 CameraController 之後接管 yaw/pitch；此 lookAt 為 yaw=pitch=0 的基準朝向。
    // aspect 先給 1，由 main 在 resize() 帶入真實視窗比例。
    this.camera = new THREE.PerspectiveCamera(room.fovDeg, 1, 0.1, 1000);
    // KI-004 / S1 T1:射線/彈道原點的 world base 抽為單一純函式（`resolveEyeWorldBase`），
    // camera 與離線推導共用同一定義，防止日後再度只改一邊（D2a 的成因）。
    const eye = resolveEyeWorldBase(config);
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.camera.lookAt(0, room.eyeHeight, -depth / 2); // 維持 -Z 基準朝向
  }

  /** 視窗縮放時更新 camera aspect（renderer.setSize 由 main 持有）。 */
  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** 掛載已套 displayScale 的 GLTF group;重覆呼叫前先釋放前一個(防洩漏)。 */
  mountAsset(group: THREE.Group): void {
    if (this.#assetGroup !== null) disposeScene(this.#assetGroup);
    this.#assetGroup = group;
    this.scene.add(group);
  }

  /**
   * 釋放整個場景(房間 mesh + GLTF group)的 GPU 資源;場景切換前呼叫(T4),防洩漏。
   * (即 T2 In scope 所述 `disposeScene()` 職責,以 SceneManager 方法形式提供。)
   */
  dispose(): void {
    for (const child of [...this.scene.children]) disposeScene(child);
    this.#assetGroup = null;
  }

  #buildRoom(width: number, depth: number, height: number, colors: ProceduralRoomConfig['colors']): void {
    const hw = width / 2;
    const hd = depth / 2;

    // 地板：平面鋪在 XZ（y=0），法線朝 +Y。
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: colors.floor, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // 四牆：PlaneGeometry 預設法線 +Z，以 rotation.y 轉到「朝房間內側」(FrontSide
    // 即可從室內看見且被正確打光)。牆高 = height。
    const wallMat = new THREE.MeshStandardMaterial({
      color: colors.wall,
      roughness: 0.9,
    });
    // [planeWidth, x, z, rotY]
    const walls: ReadonlyArray<[number, number, number, number]> = [
      [width, 0, -hd, 0], // 北牆，法線 +Z（朝中心）
      [width, 0, hd, Math.PI], // 南牆，法線 -Z
      [depth, -hw, 0, Math.PI / 2], // 西牆，法線 +X
      [depth, hw, 0, -Math.PI / 2], // 東牆，法線 -X
    ];
    for (const [planeWidth, x, z, rotY] of walls) {
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(planeWidth, height),
        wallMat,
      );
      wall.position.set(x, height / 2, z);
      wall.rotation.y = rotY;
      this.scene.add(wall);
    }
  }

  #buildLights(lights: ProceduralRoomConfig['lights']): void {
    // 環境光保證無面全黑；方向光給地板與各牆不同明暗，肉眼可分辨表面（DoD）。
    this.scene.add(new THREE.AmbientLight(0xffffff, lights.ambientIntensity));
    const dir = new THREE.DirectionalLight(0xffffff, lights.directionalIntensity);
    dir.position.set(lights.directionalPosition.x, lights.directionalPosition.y, lights.directionalPosition.z);
    this.scene.add(dir);
  }
}

export interface SceneManagerLoadResult {
  manager: SceneManager;
  effectiveConfig: SceneConfig;
  fallback: boolean;
}

/**
 * 依 SceneConfig 建 SceneManager,GLTF 資產 async 載入後掛入(FR-C2)。
 * - `asset === null`:同步程序化房間。
 * - `asset !== null`:先建舞台(camera + 光),再 `await loadScene` 掛 GLTF group。
 *   載入失敗 → **fallback 佔位房間**(遞迴走 placeholderRoom config,單一路徑,無特例分支)。
 *
 * `loaderOverride` 供測試注入 mock loader(不必真跑 WebGPU/GLTF 解析)。
 */
export async function createSceneManagerWithStatus(
  config: SceneConfig,
  loaderOverride?: SceneAssetLoader,
): Promise<SceneManagerLoadResult> {
  const manager = new SceneManager(config);
  if (config.asset === null) return { manager, effectiveConfig: config, fallback: false };

  const group = await loadScene(config, loaderOverride);
  if (group !== null) {
    manager.mountAsset(group);
    return { manager, effectiveConfig: config, fallback: false };
  }
  // 載入失敗:丟棄剛建的舞台,fallback 佔位房間(與正常路徑同一 config 入口)。
  manager.dispose();
  return { manager: new SceneManager(placeholderRoom), effectiveConfig: placeholderRoom, fallback: true };
}

export async function createSceneManager(
  config: SceneConfig,
  loaderOverride?: SceneAssetLoader,
): Promise<SceneManager> {
  return (await createSceneManagerWithStatus(config, loaderOverride)).manager;
}
