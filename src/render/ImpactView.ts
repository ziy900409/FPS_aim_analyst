import * as THREE from 'three/webgpu';
import { IMPACT_CAP, type ImpactRing } from '../state/SharedState.ts';

/**
 * ImpactView — WP-13 / T3（FR-B10）
 *
 * 渲染層（CONTEXT.md §B）：把 `SharedState.impacts`（sim 命中時寫入的彈著環形格）**唯讀**繪成彈孔。
 * 單一 `InstancedMesh(IMPACT_CAP)` → **一個 draw call**（稽核加分項；`renderer.info.render.drawcalls`
 * 可佐證）。狀態只由 sim（`pushImpact`）寫，本檔絕不寫 state（雙迴圈邊界，比照 [TargetView](./TargetView.ts)）。
 *
 * 增量同步（GC 紀律 §4）：每幀依 `seq` 偵測新彈著——只有 seq 大於上次同步高水位的槽才重寫其
 * instanceMatrix（環狀覆寫最舊時舊槽獲更大 seq，故亦會被更新）；無新彈著即早退。`instanceMatrix`
 * 為預配置緩衝、`Object3D` scratch 重用，熱路徑零配置。
 *
 * 座標：`impacts` 存 world 座標（`raycastWithRay` 命中點與 camera/目標同空間），故 instance 直接
 * 置於該座標、無縮放（比照 TargetView 以 `t.pos` 直接定位）。
 */

/** 彈孔面片邊長（source/world unit；目標 hitbox ~1–2u，取小值使彈孔明顯但不遮擋 pattern）。 */
const IMPACT_SIZE = 0.06;
const IMPACT_COLOR = 0x101014;

export class ImpactView {
  readonly #scene: THREE.Scene;
  readonly #geometry: THREE.PlaneGeometry;
  readonly #material: THREE.MeshBasicMaterial;
  readonly #mesh: THREE.InstancedMesh;
  /** 矩陣合成 scratch（重用，避免每彈著配置 Object3D；GC 紀律）。 */
  readonly #dummy = new THREE.Object3D();
  /** 上次已同步的 seq 高水位；`impacts.total` 未變即無新彈著（早退）。 */
  #syncedSeq = 0;

  constructor(scene: THREE.Scene) {
    this.#scene = scene;
    this.#geometry = new THREE.PlaneGeometry(IMPACT_SIZE, IMPACT_SIZE);
    this.#material = new THREE.MeshBasicMaterial({ color: IMPACT_COLOR });
    this.#mesh = new THREE.InstancedMesh(this.#geometry, this.#material, IMPACT_CAP);
    this.#mesh.count = 0; // 尚無彈著
    this.#mesh.frustumCulled = false; // instance 分散各處，關閉整體 cull 避免誤剔
    this.#scene.add(this.#mesh);
  }

  /**
   * render frame 呼叫（唯讀）：把新彈著（`seq > #syncedSeq`）寫入 instanceMatrix，更新可見 instance 數。
   * `count = min(total, CAP)`——滿格後恆 CAP。無新彈著即早退（零工作）。
   */
  sync(impacts: ImpactRing): void {
    if (impacts.total === this.#syncedSeq) return; // 無新彈著

    for (let i = 0; i < IMPACT_CAP; i++) {
      if (impacts.seq[i] <= this.#syncedSeq) continue; // 舊槽已同步、空槽（seq=0）略過
      this.#dummy.position.set(impacts.x[i], impacts.y[i], impacts.z[i]);
      this.#dummy.updateMatrix();
      this.#mesh.setMatrixAt(i, this.#dummy.matrix);
    }

    this.#mesh.count = Math.min(impacts.total, IMPACT_CAP);
    this.#mesh.instanceMatrix.needsUpdate = true;
    this.#syncedSeq = impacts.total;
  }

  /** 目前可見 instance 數（測試/診斷用）。 */
  get count(): number {
    return this.#mesh.count;
  }

  /** 釋放 GPU 資源（重開 drill／卸載）；階段 A 場景長駐,通常不需呼叫。 */
  dispose(): void {
    this.#scene.remove(this.#mesh);
    this.#mesh.dispose();
    this.#geometry.dispose();
    this.#material.dispose();
  }
}
