import * as THREE from 'three/webgpu';
import type { TargetState } from '../state/types.ts';

/**
 * HitDetector — WP-5 / T1（FR-5.1）
 *
 * sim 職責（CONTEXT.md「HitDetector」）：開火事件在**排序串流的該點** inline 評估，用 Raycaster
 * 從 **camera 正向（螢幕中心 NDC (0,0)）** 射線對 active 目標 hitbox 求交（**階段 A 單一 hitbox，H1**：
 * 命中/未命中；`part` 選填保留、頭/身分解延後）。命中即由呼叫端（SimLoop）觸發 `markKilled`（OQ-5.4）。
 *
 * **判定與 mesh 同來源**：hitbox 由 `TargetState.hitbox`(box:width/height/depth)衍生 `Box3`，與
 * TargetView 的 `BoxGeometry`+scale 同一來源，確保視覺與判定不漂移（README failure-mode「射線未命中近
 * hitbox」）。射線起點/方向取自 camera：準心固定螢幕中心（WP-4 T4），故 NDC 恆為 (0,0)。
 *
 * GC 紀律（CLAUDE.md §4）：Raycaster / Box3 / Vector 皆**模組層級重用**，開火判定熱路徑零配置。
 * 開火為低頻事件（滑鼠點擊），但仍守紀律避免抖動。
 *
 * **時間源/雙迴圈邊界**：本函式唯讀 camera（朝向由 CameraController 走輸入路徑寫入，非 sim）與
 * `targets`，不寫 render 物件、不讀時鐘、不碰 DOM——與 simStep 純函式紀律（OQ-2.4）相容。
 * ⚠️ 呼叫端須確保 `camera.matrixWorld` 已更新（render loop 每幀維護；測試須顯式 `updateMatrixWorld`）。
 */

/** NDC 螢幕中心（準心固定螢幕中心，WP-4 T4）——恆 (0,0)。 */
const NDC_CENTER = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
const box = new THREE.Box3();
const boxMin = new THREE.Vector3();
const boxMax = new THREE.Vector3();
const hitPoint = new THREE.Vector3();
const cameraWorld = new THREE.Vector3();
const cameraForward = new THREE.Vector3();
const targetCenter = new THREE.Vector3();
const cameraToTarget = new THREE.Vector3();

export interface RaycastResult {
  hit: boolean;
  targetId?: string;
  part?: 'head' | 'body';
}

/**
 * 從 camera 中心射線對 active（`visible && alive`）目標 hitbox 求交。多目標時取**最近**命中
 * （階段 A 通常單一 active 目標，但仍以最近者為準）。回傳 `{hit, targetId?, part?}`。
 */
export function raycastFromCenter(
  camera: THREE.Camera,
  targets: readonly TargetState[],
): RaycastResult {
  raycaster.setFromCamera(NDC_CENTER, camera);

  let nearestId: string | undefined;
  let nearestPart: 'head' | 'body' | undefined;
  let nearestDistSq = Infinity;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (!t.visible || !t.alive) continue;

    const hw = t.hitbox.width / 2;
    const hh = t.hitbox.height / 2;
    const hd = t.hitbox.depth / 2;
    boxMin.set(t.pos.x - hw, t.pos.y - hh, t.pos.z - hd);
    boxMax.set(t.pos.x + hw, t.pos.y + hh, t.pos.z + hd);
    box.set(boxMin, boxMax);

    const point = raycaster.ray.intersectBox(box, hitPoint);
    if (point === null) continue; // 射線未穿過此 hitbox

    const distSq = raycaster.ray.origin.distanceToSquared(point);
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestId = t.id;
      nearestPart = t.hitbox.part;
    }
  }

  if (nearestId === undefined) return { hit: false };
  return { hit: true, targetId: nearestId, part: nearestPart };
}

/** Camera forward ray vs target center angular offset in degrees; canonical source for WP-8 aim offset. */
export function targetCenterOffsetDeg(camera: THREE.Camera, target: TargetState): number {
  camera.getWorldPosition(cameraWorld);
  camera.getWorldDirection(cameraForward);
  targetCenter.set(target.pos.x, target.pos.y, target.pos.z);
  cameraToTarget.subVectors(targetCenter, cameraWorld);
  if (cameraToTarget.lengthSq() === 0) return 0;
  cameraToTarget.normalize();
  return THREE.MathUtils.radToDeg(cameraForward.angleTo(cameraToTarget));
}
