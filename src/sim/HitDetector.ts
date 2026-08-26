import * as THREE from 'three/webgpu';
import type { TargetState } from '../state/types.ts';

/**
 * HitDetector — WP-5 / T1（FR-5.1）
 *
 * sim 職責（CONTEXT.md「HitDetector」）：開火事件在**排序串流的該點** inline 評估，用 Raycaster
 * 從注入射線對 active 目標 hitbox 求交（**階段 A 單一 hitbox，H1**：
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
const sphere = new THREE.Sphere();
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
 * 命中點回填的**呼叫端重用**欄位（WP-13 / T3）：plain number x/y/z（world coord，非 Vector）+ `valid`
 * 旗標。呼叫端（SimLoop）持一份重用實例傳入，`raycastWithRay` 命中時就地寫入、未命中置 `valid=false`
 * ——熱路徑零配置（CLAUDE.md §4）、且不改 `RaycastResult` 形狀（既有等值測試不受影響）。
 * 命中點供 T3 彈孔（`ImpactView`）在牆/目標面繪製；階段 A 僅目標命中回填。
 */
export interface HitPointOut {
  valid: boolean;
  x: number;
  y: number;
  z: number;
}

/**
 * 從注入射線對 active（`visible && alive`）目標 hitbox 求交。多目標時取**最近**命中
 * （階段 A 通常單一 active 目標，但仍以最近者為準）。回傳 `{hit, targetId?, part?}`。
 *
 * `hitPointOut` 選填（WP-13 / T3）：提供時把**最近命中**的 world 座標就地寫入該重用物件
 * （`valid=true`），未命中則置 `valid=false`——呼叫端零配置取彈著點（見 `HitPointOut`）。
 *
 * `subAlpha` 選填（WP-18 / T2，FR-B17：目標 sub-tick 命中內插）：提供時，hitbox 中心取
 * `lerp(t.posPrev, t.pos, subAlpha)`——目標在 fire 時間戳（tick 窗內比例 `subAlpha`）的內插位置,
 * 取代「tick 末位置」偏差。**向後相容**:`subAlpha` 省略或目標無 `posPrev`（如靜止/直接注入目標）
 * 時退回讀 `t.pos`（既有 WP-5/WP-13 路徑逐位不變）。靜止目標 `posPrev == pos` → 內插逐位等價。
 * 內插用純 scalar 暫存（零配置,GC 紀律 §4）；`subAlpha` 為 `(t, tickStart, tickMs)` 純函式。
 */
export function raycastWithRay(
  origin: THREE.Vector3,
  dirNormalized: THREE.Vector3,
  targets: readonly TargetState[],
  hitPointOut?: HitPointOut,
  subAlpha?: number,
): RaycastResult {
  raycaster.set(origin, dirNormalized);

  let nearestId: string | undefined;
  let nearestPart: 'head' | 'body' | undefined;
  let nearestDistSq = Infinity;
  // 最近命中 world 座標（純 scalar 暫存，避免每目標配置 Vector；GC 紀律 §4）。
  let nearestX = 0;
  let nearestY = 0;
  let nearestZ = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (!t.visible || !t.alive) continue;

    const hw = t.hitbox.width / 2;
    const hh = t.hitbox.height / 2;
    const hd = t.hitbox.depth / 2;
    // hitbox 中心:預設讀 tick 末 `t.pos`;有 subAlpha + posPrev 時取 fire 時間戳的內插位置
    // （sub-tick,FR-B17）。posPrev==pos（靜止）或無 subAlpha → cx/cy/cz == t.pos（逐位等價）。
    let cx = t.pos.x;
    let cy = t.pos.y;
    let cz = t.pos.z;
    if (subAlpha !== undefined && t.posPrev !== undefined) {
      cx = t.posPrev.x + (t.pos.x - t.posPrev.x) * subAlpha;
      cy = t.posPrev.y + (t.pos.y - t.posPrev.y) * subAlpha;
      cz = t.posPrev.z + (t.pos.z - t.posPrev.z) * subAlpha;
    }
    let point: THREE.Vector3 | null;
    if (t.hitbox.shape === 'sphere') {
      sphere.center.set(cx, cy, cz);
      sphere.radius = t.hitbox.width / 2;
      point = raycaster.ray.intersectSphere(sphere, hitPoint);
    } else {
      boxMin.set(cx - hw, cy - hh, cz - hd);
      boxMax.set(cx + hw, cy + hh, cz + hd);
      box.set(boxMin, boxMax);
      point = raycaster.ray.intersectBox(box, hitPoint);
    }
    if (point === null) continue; // 射線未穿過此 hitbox

    const distSq = raycaster.ray.origin.distanceToSquared(point);
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestId = t.id;
      nearestPart = t.hitbox.part;
      nearestX = point.x;
      nearestY = point.y;
      nearestZ = point.z;
    }
  }

  if (nearestId === undefined) {
    if (hitPointOut !== undefined) hitPointOut.valid = false;
    return { hit: false };
  }
  if (hitPointOut !== undefined) {
    hitPointOut.valid = true;
    hitPointOut.x = nearestX;
    hitPointOut.y = nearestY;
    hitPointOut.z = nearestZ;
  }
  return { hit: true, targetId: nearestId, part: nearestPart };
}

/**
 * 從 camera 中心射線對 active 目標 hitbox 求交；WP-13 recoil/spread 可改呼叫注入式 raycastWithRay。
 */
export function raycastFromCenter(
  camera: THREE.Camera,
  targets: readonly TargetState[],
): RaycastResult {
  raycaster.setFromCamera(NDC_CENTER, camera);
  return raycastWithRay(raycaster.ray.origin, raycaster.ray.direction, targets);
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
