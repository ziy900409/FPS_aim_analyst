import * as THREE from 'three/webgpu';
import type { TargetState } from '../state/types.ts';

/**
 * TargetView — WP-4 / T1b（FR-4.1）
 *
 * 渲染層（CONTEXT.md §B）:依 `SharedState.targets` **唯讀** 顯示/隱藏目標 mesh。
 * 狀態只由 sim（`TargetManager`，T2/T3）改；本檔絕不寫 state（README failure-mode
 * 「render 改目標狀態」)。可見性判定與 `t_visible` 蓋戳屬 sim 職責、不在此。
 *
 * GC 紀律（CLAUDE.md §4）:mesh **重用池**——不每幀/每 spawn `new Mesh`。共用一份單位
 * `BoxGeometry` 與一份 material,以 `mesh.scale` 套各目標 hitbox 尺寸,避免每目標配置新
 * geometry。多出的池內 mesh 隱藏(`visible=false`)而非銷毀,供下次 spawn 重用。
 *
 * hitbox 與 mesh 由同一 `TargetState.hitbox`(box:width/height/depth)衍生,確保視覺與
 * WP-5 raycast(`Box3`)判定同來源、不漂移(README failure-mode「hitbox 與 mesh 不一致」)。
 */

const TARGET_COLOR = 0xd94f4f;

export class TargetView {
  readonly #scene: THREE.Scene;
  /** 單位 box(1×1×1);各目標以 mesh.scale 套 hitbox 尺寸,故只需一份 geometry。 */
  readonly #geometry: THREE.BoxGeometry;
  readonly #material: THREE.MeshStandardMaterial;
  /** mesh 重用池:index 對應本幀第 n 個顯示中的目標;多出者隱藏留用。 */
  readonly #pool: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.#scene = scene;
    this.#geometry = new THREE.BoxGeometry(1, 1, 1);
    this.#material = new THREE.MeshStandardMaterial({
      color: TARGET_COLOR,
      roughness: 0.6,
    });
  }

  /**
   * render frame 呼叫(唯讀):把顯示中的目標映射到池內 mesh、其餘隱藏。
   *
   * 顯示條件為 `visible`(是否已 spawn／在視野內——由 sim 於 t_visible 轉換 tick 設,T2);
   * `alive` 撤除語意屬 T3/WP-5,不在 T1b 收斂。
   */
  sync(targets: readonly TargetState[]): void {
    let used = 0;
    for (const t of targets) {
      if (!t.visible) continue;
      const mesh = this.#acquire(used++);
      mesh.position.set(t.pos.x, t.pos.y, t.pos.z);
      mesh.scale.set(t.hitbox.width, t.hitbox.height, t.hitbox.depth);
      mesh.visible = true;
    }
    // 本幀未用到的池內 mesh 隱藏(重用、不銷毀)。
    for (let i = used; i < this.#pool.length; i++) {
      this.#pool[i].visible = false;
    }
  }

  /** 目前池大小(建立過的 mesh 數);測試/診斷用。 */
  get poolSize(): number {
    return this.#pool.length;
  }

  /** 依需擴充池:index 超出時建新 mesh(一次性加入 scene)、否則回收既有。 */
  #acquire(i: number): THREE.Mesh {
    let mesh = this.#pool[i];
    if (mesh === undefined) {
      mesh = new THREE.Mesh(this.#geometry, this.#material);
      this.#pool.push(mesh);
      this.#scene.add(mesh);
    }
    return mesh;
  }

  /** 釋放 GPU 資源(重開 drill／卸載);階段 A 場景長駐,通常不需呼叫。 */
  dispose(): void {
    for (const mesh of this.#pool) this.#scene.remove(mesh);
    this.#pool.length = 0;
    this.#geometry.dispose();
    this.#material.dispose();
  }
}
