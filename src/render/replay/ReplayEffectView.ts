import * as THREE from 'three/webgpu';
import type { ReplaySample, ReplayTargetState } from '../../replay/contracts.ts';

/**
 * ReplayEffectView — WP-50 / T4（README §2.9/T4 Steps #3，D-50-P6/D-50-P23）
 *
 * 唯讀、時間純推導的 shot/hit cue：`sample.effects`（`sampleReplay.ts` 已依固定 `EFFECT_WINDOW_MS`
 * 篩出「此刻仍在效果視窗內」的事件，見 `sampleReply.ts`）只在有 `fire`/`hit` 事件落在窗內時顯示
 * 對應的單一 marker mesh，否則隱藏——不是 live `ImpactView`/`TracerView` 的累積式 ring（那兩者依
 * render wall time / monotonic seq 遞增，不符合任意 seek 純推導，README D-50-P4/T0 discovery item
 * 7）。backward seek 到窗外的 `t` 時，`sample.effects` 自然不含該事件，marker 自動隱藏——無殘影。
 *
 * **資料限制決策（D-50-P23）**：現有 export 沒有 world-space `shotRays`/impact 座標（T0 discovery
 * item 2；D-50-P6 已把「精確 tracer/projectile 幾何」排除出 full 範圍）。因此本層只呈現**近似 cue**：
 * - hit：一個小 marker 貼在 `hit.targetId` 對應的 sampled target 位置（找不到就跳過，不猜座標，
 *   README failure-mode「不得為不完整舊資料猜測 impact 位置」）。
 * - fire：一個小 marker 貼在 camera 前方固定偏移（沒有 muzzle world 座標可用，唯一決定性輸入是
 *   camera 當下 position/quaternion——非精確 muzzle offset，但誠實地標示「此刻正在開火」）。
 *
 * 視窗內若同時有多個同種事件（full-auto 多發、duplicate shots），只取**最後一個**（`sample.effects`
 * 保證 ascending time order，README §2.5）——marker 為單一 boolean cue，不逐發計數。
 */
const HIT_MARKER_SIZE = 0.1;
const HIT_MARKER_COLOR = 0xffffff;
const FIRE_MARKER_SIZE = 0.03;
const FIRE_MARKER_COLOR = 0xffcc55;
const FIRE_MARKER_FORWARD_OFFSET = 0.3;

const FORWARD = new THREE.Vector3(0, 0, -1);

export class ReplayEffectView {
  readonly #scene: THREE.Scene;
  readonly #hitMesh: THREE.Mesh;
  readonly #fireMesh: THREE.Mesh;
  readonly #forwardScratch = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.#scene = scene;
    this.#hitMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(HIT_MARKER_SIZE, HIT_MARKER_SIZE),
      new THREE.MeshBasicMaterial({ color: HIT_MARKER_COLOR }),
    );
    this.#hitMesh.visible = false;
    this.#scene.add(this.#hitMesh);

    this.#fireMesh = new THREE.Mesh(
      new THREE.SphereGeometry(FIRE_MARKER_SIZE, 8, 6),
      new THREE.MeshBasicMaterial({ color: FIRE_MARKER_COLOR }),
    );
    this.#fireMesh.visible = false;
    this.#scene.add(this.#fireMesh);
  }

  /** render frame 呼叫（唯讀）：依 `sample.effects` 窗內最後一個 fire/hit 事件更新兩個 marker。 */
  sync(sample: ReplaySample, camera: THREE.Camera): void {
    let hitTarget: ReplayTargetState | undefined;
    let fireActive = false;

    for (const effect of sample.effects) {
      const raw = effect.event.raw;
      if (raw.type === 'hit') {
        const targetId = typeof raw.targetId === 'string' ? raw.targetId : undefined;
        const match = targetId !== undefined ? sample.targets.find((t) => t.id === targetId) : sample.targets[0];
        if (match !== undefined) hitTarget = match;
      } else if (raw.type === 'fire') {
        fireActive = true;
      }
    }

    if (hitTarget !== undefined) {
      this.#hitMesh.position.set(hitTarget.x, hitTarget.y, hitTarget.z);
      this.#hitMesh.visible = true;
    } else {
      this.#hitMesh.visible = false;
    }

    if (fireActive) {
      this.#forwardScratch.copy(FORWARD).applyQuaternion(camera.quaternion);
      this.#fireMesh.position
        .copy(camera.position)
        .addScaledVector(this.#forwardScratch, FIRE_MARKER_FORWARD_OFFSET);
      this.#fireMesh.visible = true;
    } else {
      this.#fireMesh.visible = false;
    }
  }

  /** 目前是否顯示中（測試/診斷用）。 */
  get hitActive(): boolean {
    return this.#hitMesh.visible;
  }

  get fireActive(): boolean {
    return this.#fireMesh.visible;
  }

  dispose(): void {
    this.#scene.remove(this.#hitMesh);
    this.#scene.remove(this.#fireMesh);
    this.#hitMesh.geometry.dispose();
    (this.#hitMesh.material as THREE.Material).dispose();
    this.#fireMesh.geometry.dispose();
    (this.#fireMesh.material as THREE.Material).dispose();
  }
}
