import * as THREE from 'three/webgpu';
import { TRACER_CAP, type ShotRayRing } from '../state/SharedState.ts';

const TRACER_WIDTH = 0.018;
const TRACER_COLOR = 0x7dd3fc;
const TRACER_LIFETIME_MS = 260;
const X_AXIS = new THREE.Vector3(1, 0, 0);

/**
 * TracerView — WP-25 / T1（FR-E7）
 *
 * Render-only tracer：把 `SharedState.shotRays`（sim 產彈點寫入的 origin→endpoint）唯讀繪成短壽命線段。
 * 單一 `InstancedMesh(TRACER_CAP)` 維持一個 draw call；壽命衰減只用 render frame 時間縮尾，不讀 sim 時鐘、
 * 不寫 SharedState、不進記錄匯出。
 */
export class TracerView {
  readonly #scene: THREE.Scene;
  readonly #geometry: THREE.PlaneGeometry;
  readonly #material: THREE.MeshBasicMaterial;
  readonly #mesh: THREE.InstancedMesh;
  readonly #dummy = new THREE.Object3D();
  readonly #dir = new THREE.Vector3();
  readonly #mid = new THREE.Vector3();
  readonly #quat = new THREE.Quaternion();
  readonly #birthMs = new Float64Array(TRACER_CAP);
  readonly #live = new Uint8Array(TRACER_CAP);
  readonly #ox = new Float64Array(TRACER_CAP);
  readonly #oy = new Float64Array(TRACER_CAP);
  readonly #oz = new Float64Array(TRACER_CAP);
  readonly #dx = new Float64Array(TRACER_CAP);
  readonly #dy = new Float64Array(TRACER_CAP);
  readonly #dz = new Float64Array(TRACER_CAP);
  readonly #length = new Float64Array(TRACER_CAP);
  #syncedSeq = 0;
  #activeCount = 0;

  constructor(scene: THREE.Scene) {
    this.#scene = scene;
    this.#geometry = new THREE.PlaneGeometry(1, TRACER_WIDTH);
    this.#material = new THREE.MeshBasicMaterial({
      color: TRACER_COLOR,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.#mesh = new THREE.InstancedMesh(this.#geometry, this.#material, TRACER_CAP);
    this.#mesh.count = 0;
    this.#mesh.frustumCulled = false;
    this.#scene.add(this.#mesh);
  }

  /**
   * render frame 呼叫（唯讀）：同步新 shot ray，並依 render `nowMs` 對仍存活的 tracer 做縮尾。
   * `enabled=false` 時呼叫端應直接略過本方法，以達成關閉時零同步工作。
   */
  sync(shotRays: ShotRayRing, nowMs: number): void {
    if (shotRays.total < this.#syncedSeq) this.clear(shotRays.total);

    let changed = false;
    if (shotRays.total !== this.#syncedSeq) {
      for (let i = 0; i < TRACER_CAP; i++) {
        if (shotRays.seq[i] <= this.#syncedSeq) continue;
        this.#copyShotRay(shotRays, i, nowMs);
      }
      this.#mesh.count = Math.min(shotRays.total, TRACER_CAP);
      this.#syncedSeq = shotRays.total;
      changed = true;
    } else if (this.#activeCount === 0) {
      return;
    }

    let active = 0;
    for (let i = 0; i < this.#mesh.count; i++) {
      const life = 1 - (nowMs - this.#birthMs[i]) / TRACER_LIFETIME_MS;
      if (life <= 0 || this.#length[i] <= 0) {
        if (this.#live[i] === 1) {
          this.#live[i] = 0;
          this.#hide(i);
          changed = true;
        }
        continue;
      }
      active++;
      this.#writeMatrix(i, life);
      changed = true;
    }
    this.#activeCount = active;
    if (changed) this.#mesh.instanceMatrix.needsUpdate = true;
  }

  /** 已配置給 InstancedMesh 的可見上限；滿格後封頂 `TRACER_CAP`。 */
  get count(): number {
    return this.#mesh.count;
  }

  /** 仍在 lifetime 內、非零長度的 tracer 數（測試/診斷用）。 */
  get activeCount(): number {
    return this.#activeCount;
  }

  /** 立即隱藏所有 tracer；`syncedSeq` 可用於 toggle off/on 時略過既有 ring backlog。 */
  clear(syncedSeq = 0): void {
    for (let i = 0; i < TRACER_CAP; i++) {
      this.#birthMs[i] = 0;
      this.#live[i] = 0;
      this.#hide(i);
    }
    this.#mesh.count = 0;
    this.#activeCount = 0;
    this.#syncedSeq = syncedSeq;
    this.#mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.#scene.remove(this.#mesh);
    this.#mesh.dispose();
    this.#geometry.dispose();
    this.#material.dispose();
  }

  #copyShotRay(shotRays: ShotRayRing, i: number, nowMs: number): void {
    const ox = shotRays.ox[i];
    const oy = shotRays.oy[i];
    const oz = shotRays.oz[i];
    const vx = shotRays.ex[i] - ox;
    const vy = shotRays.ey[i] - oy;
    const vz = shotRays.ez[i] - oz;
    const len = Math.hypot(vx, vy, vz);

    this.#birthMs[i] = nowMs;
    this.#live[i] = 1;
    this.#ox[i] = ox;
    this.#oy[i] = oy;
    this.#oz[i] = oz;
    this.#length[i] = len;
    if (len > 0) {
      this.#dx[i] = vx / len;
      this.#dy[i] = vy / len;
      this.#dz[i] = vz / len;
    } else {
      this.#dx[i] = 1;
      this.#dy[i] = 0;
      this.#dz[i] = 0;
    }
  }

  #writeMatrix(i: number, life: number): void {
    const len = this.#length[i] * life;
    const halfLen = len * 0.5;
    this.#dir.set(this.#dx[i], this.#dy[i], this.#dz[i]);
    this.#mid.set(
      this.#ox[i] + this.#dx[i] * halfLen,
      this.#oy[i] + this.#dy[i] * halfLen,
      this.#oz[i] + this.#dz[i] * halfLen,
    );
    this.#quat.setFromUnitVectors(X_AXIS, this.#dir);
    this.#dummy.position.copy(this.#mid);
    this.#dummy.quaternion.copy(this.#quat);
    this.#dummy.scale.set(len, 1, 1);
    this.#dummy.updateMatrix();
    this.#mesh.setMatrixAt(i, this.#dummy.matrix);
  }

  #hide(i: number): void {
    this.#dummy.position.set(0, 0, 0);
    this.#dummy.quaternion.identity();
    this.#dummy.scale.set(1e-9, 1e-9, 1e-9);
    this.#dummy.updateMatrix();
    this.#mesh.setMatrixAt(i, this.#dummy.matrix);
  }

}
