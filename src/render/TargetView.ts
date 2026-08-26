import * as THREE from 'three/webgpu';
import type { TargetState } from '../state/types.ts';
import { lerp } from '../loop/RenderLoop.ts';

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
  /** 單位 geometry(box 1×1×1 / sphere 半徑 0.5);各目標以 mesh.scale 套 hitbox 尺寸,故只需一份。 */
  #geometry: THREE.BufferGeometry;
  #shape: 'box' | 'sphere' = 'box';
  readonly #material: THREE.MeshStandardMaterial;
  /** mesh 重用池:index 對應本幀第 n 個顯示中的目標;多出者隱藏留用。 */
  readonly #pool: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.#scene = scene;
    this.#geometry = this.#createGeometry('box');
    this.#material = new THREE.MeshStandardMaterial({
      color: TARGET_COLOR,
      roughness: 0.6,
    });
  }

  /** 建立單位 geometry;'sphere' 半徑 0.5 配合既有 mesh.scale 縮放慣例(三軸相等時仍為正圓球)。 */
  #createGeometry(shape: 'box' | 'sphere'): THREE.BufferGeometry {
    return shape === 'sphere' ? new THREE.SphereGeometry(0.5, 24, 16) : new THREE.BoxGeometry(1, 1, 1);
  }

  /** 切換 pool 共用 geometry(box/sphere);既有 pool mesh 就地換 geometry,不重建/不銷毀 mesh。 */
  setShape(shape: 'box' | 'sphere'): void {
    if (shape === this.#shape) return;
    this.#geometry.dispose();
    this.#geometry = this.#createGeometry(shape);
    this.#shape = shape;
    for (const mesh of this.#pool) mesh.geometry = this.#geometry;
  }

  /**
   * render frame 呼叫(唯讀):把顯示中的目標映射到池內 mesh、其餘隱藏。
   *
   * 顯示條件為 `visible`(是否已 spawn／在視野內——由 sim 於 t_visible 轉換 tick 設,T2);
   * `alive` 撤除語意屬 T3/WP-5,不在 T1b 收斂。
   *
   * **移動目標 render 內插(WP-18 / T3,render-only)**:`alpha ∈ [0,1]` 為 render 在兩 sim tick
   * 快照間的內插係數(比照 player 位置,RenderLoop)。mesh 位置取 `lerp(posPrev, pos, alpha)`——
   * 高 FPS 下移動目標畫面不抖。**絕不寫 state**(唯讀;posPrev/pos 皆由 sim 寫,GD-6/GD-10)。
   * `alpha` 省略＝1 → 讀 `pos`(既有靜止 drill 逐位不變);無 `posPrev`(直接注入目標)亦退回 `pos`。
   */
  sync(targets: readonly TargetState[], alpha = 1): void {
    let used = 0;
    for (const t of targets) {
      if (!t.visible) continue;
      const mesh = this.#acquire(used++);
      // posPrev 存在 → 內插(alpha=1 → pos,零破壞);無 posPrev → 直接讀 pos(向後相容)。
      const prev = t.posPrev;
      if (prev !== undefined) {
        mesh.position.set(lerp(prev.x, t.pos.x, alpha), lerp(prev.y, t.pos.y, alpha), lerp(prev.z, t.pos.z, alpha));
      } else {
        mesh.position.set(t.pos.x, t.pos.y, t.pos.z);
      }
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
