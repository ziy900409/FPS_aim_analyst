import * as THREE from 'three/webgpu';
import { SceneManager } from '../SceneManager.ts';
import { resolveEyeWorldBase } from '../../scene/eyePose.ts';
import { SIM_TO_WORLD } from '../../loop/constants.ts';
import type { SceneConfig } from '../../scene/SceneConfig.ts';
import type { ReplaySample } from '../../replay/contracts.ts';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0);

/**
 * ReplaySceneAdapter — WP-50 / T3（README §2.3/2.7，D-50-P5）
 *
 * 隔離的 replay scene/camera：擁有自己的 `SceneManager` 實例（不共用 live 的 scene/camera/
 * TargetView/SharedState）。`applySample` 直接依 `ReplaySample` 套 camera position/quaternion，
 * 公式與 main.ts live render loop 逐項對齊——
 *   - position：`resolveEyeWorldBase(sceneConfig)` 基準 + `(px, pz) × SIM_TO_WORLD`
 *     （同 `SceneManager` 建構子取得的 base 與 main.ts render loop 的 `baseX/baseY/baseZ` 公式）。
 *   - orientation：`qYaw(yaw) · qPitch(pitch)`，與 `CameraController#applyToCamera` 同一組合順序。
 *
 * T3 刻意**不**疊加 recoil punch——OQ-50.1 收斂（D-50-P6）把 punch 重放歸給 T4 的
 * `ReplayEffectView`（D-50-P15），本層只負責「camera base 對得上」。
 */
export class ReplaySceneAdapter {
  readonly sceneManager: SceneManager;
  readonly #baseX: number;
  readonly #baseY: number;
  readonly #baseZ: number;
  readonly #qYaw = new THREE.Quaternion();
  readonly #qPitch = new THREE.Quaternion();

  constructor(sceneManager: SceneManager, sceneConfig: SceneConfig) {
    this.sceneManager = sceneManager;
    const eye = resolveEyeWorldBase(sceneConfig);
    this.#baseX = eye.x;
    this.#baseY = eye.y;
    this.#baseZ = eye.z;
  }

  /** render frame 呼叫（唯讀）：把一個 `ReplaySample` 套到本 adapter 的隔離 camera。 */
  applySample(sample: ReplaySample): void {
    const camera = this.sceneManager.camera;
    camera.position.set(
      this.#baseX + sample.player.px * SIM_TO_WORLD,
      this.#baseY,
      this.#baseZ + sample.player.pz * SIM_TO_WORLD,
    );
    this.#qYaw.setFromAxisAngle(WORLD_UP, sample.camera.yaw);
    this.#qPitch.setFromAxisAngle(LOCAL_RIGHT, sample.camera.pitch);
    camera.quaternion.copy(this.#qYaw).multiply(this.#qPitch);
  }

  /** viewport 尺寸變更時呼叫；只投遞給本 adapter 自己的隔離 camera（active-only resize）。 */
  resize(w: number, h: number): void {
    this.sceneManager.resize(w, h);
  }

  /** 釋放本 adapter 擁有的隔離 scene/camera 的 GPU 資源。 */
  dispose(): void {
    this.sceneManager.dispose();
  }
}
