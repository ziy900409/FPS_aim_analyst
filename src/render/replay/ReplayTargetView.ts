import * as THREE from 'three/webgpu';
import type { ReplayTargetState } from '../../replay/contracts.ts';
import { DEFAULT_TARGET_HITBOX, type TargetHitboxConfig, type TargetHitboxSize } from '../../drill/DrillConfig.ts';

/**
 * ReplayTargetView — WP-50 / T4（README §2.9/T4 Steps #1，GD-7）
 *
 * 隔離 replay scene 的目標渲染：唯讀消費 `ReplaySample.targets`（`sampleReplay.ts` 已依 D-50-P8
 * scalar-target 契約、same-ID-segment 規則插值/離散 hold 完畢——本層不再插值、不判斷 lifecycle
 * 邊界，只負責「顯示中的目標 → mesh」）。mesh 重用池（比照 live `TargetView`），GC 紀律（CLAUDE.md
 * §4）：共用一份單位 geometry/material，pool 內多出的 mesh 隱藏而非銷毀。
 *
 * hitbox 單一來源（GD-7 / WP-46）：`recording.targetHitbox`（`Meta.targets.hitbox` 的 pass-through）
 * 缺席時逐位等同 `DEFAULT_TARGET_HITBOX`（`resolveTargetHitbox` 的同一後援），與 live 命中判定
 * （`HitDetector`）跟這裡的視覺共用同一顆常數，不新增第二套尺寸/shape 慣例。hitbox 對整份錄影固定
 * 一次（replay 不會中途換 drill），故不像 live `TargetView.setShape` 需要動態換 geometry。
 */
const TARGET_COLOR = 0xd94f4f;

export function resolveReplayTargetHitbox(hitbox: TargetHitboxConfig | undefined): TargetHitboxSize {
  if (hitbox === undefined) return DEFAULT_TARGET_HITBOX;
  return {
    width: hitbox.widthU,
    height: hitbox.heightU,
    depth: hitbox.depthU,
    shape: hitbox.shape ?? 'box',
  };
}

export class ReplayTargetView {
  readonly #scene: THREE.Scene;
  readonly #geometry: THREE.BufferGeometry;
  readonly #material: THREE.MeshStandardMaterial;
  readonly #hitbox: TargetHitboxSize;
  readonly #pool: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, hitbox: TargetHitboxConfig | undefined) {
    this.#scene = scene;
    this.#hitbox = resolveReplayTargetHitbox(hitbox);
    this.#geometry =
      this.#hitbox.shape === 'sphere' ? new THREE.SphereGeometry(0.5, 24, 16) : new THREE.BoxGeometry(1, 1, 1);
    this.#material = new THREE.MeshStandardMaterial({ color: TARGET_COLOR, roughness: 0.6 });
  }

  /** render frame 呼叫（唯讀）：把已插值/離散 hold 完的 sampled targets 映射到池內 mesh，其餘隱藏。 */
  sync(targets: readonly ReplayTargetState[]): void {
    let used = 0;
    for (const t of targets) {
      const mesh = this.#acquire(used++);
      mesh.position.set(t.x, t.y, t.z);
      mesh.scale.set(this.#hitbox.width, this.#hitbox.height, this.#hitbox.depth);
      mesh.visible = true;
    }
    for (let i = used; i < this.#pool.length; i++) this.#pool[i].visible = false;
  }

  /** 目前池大小（測試/診斷用；bound 住的上限 = 歷史上單幀最多顯示過的目標數，官方 6 個 profile 恆 ≤1）。 */
  get poolSize(): number {
    return this.#pool.length;
  }

  #acquire(i: number): THREE.Mesh {
    let mesh = this.#pool[i];
    if (mesh === undefined) {
      mesh = new THREE.Mesh(this.#geometry, this.#material);
      this.#pool.push(mesh);
      this.#scene.add(mesh);
    }
    return mesh;
  }

  dispose(): void {
    for (const mesh of this.#pool) this.#scene.remove(mesh);
    this.#pool.length = 0;
    this.#geometry.dispose();
    this.#material.dispose();
  }
}
