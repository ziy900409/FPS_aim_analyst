import type { TargetHitboxSize } from '../drill/DrillConfig.ts';
import type { Vec3 } from '../state/types.ts';
import type { PropBound } from './SceneConfig.ts';

/**
 * occlusionGeometry — WP-45 / T1（FR-P45-2/3）
 *
 * `visibilityDerivation`（曝光比例）與 `SimLoop` hitscan wall-block gate 共用的純幾何 segment/AABB
 * kernel——避免兩套遮擋判定各自實作而在邊界（tangent/endpoint）漂移（FM-P45-2）。純函式：不讀時鐘、
 * 不碰 DOM、不依賴 THREE（plain `{x,y,z}` 運算，呼叫端可直接餵 THREE.Vector3，結構相容）。
 *
 * GC 紀律（CLAUDE.md §4）：`segmentAabbEntryAlpha`/`isSegmentBlocked` 全程 scalar 運算，唯一物件
 * 配置是 `firstBlockingIntersection` 命中時回傳的單一 `BlockingIntersection`（比照 `RaycastResult`
 * 既有低頻開火事件慣例）；`visibleFractionForTarget` 全程零配置（不建立 `Vec3[]`）。
 */

export interface BlockingIntersection {
  readonly propId: string;
  /** segment `from`→`to` 上的進入比例，`[0,1]`。 */
  readonly alpha: number;
  readonly point: Vec3;
}

// segment/AABB slab clip 的模組層級重用暫存（零配置；單執行緒同步呼叫故可安全重用）。
let clipTMin = 0;
let clipTMax = 1;

function clipAxis(origin: number, delta: number, min: number, max: number): boolean {
  if (delta === 0) {
    return origin >= min && origin <= max;
  }
  const inv = 1 / delta;
  let t1 = (min - origin) * inv;
  let t2 = (max - origin) * inv;
  if (t1 > t2) {
    const tmp = t1;
    t1 = t2;
    t2 = tmp;
  }
  if (t1 > clipTMin) clipTMin = t1;
  if (t2 < clipTMax) clipTMax = t2;
  return clipTMin <= clipTMax;
}

/** 回傳線段 `(fx,fy,fz)→(tx,ty,tz)` 進入 `box` 的比例（`[0,1]`），未相交回 `null`。 */
function segmentAabbEntryAlpha(
  fx: number,
  fy: number,
  fz: number,
  tx: number,
  ty: number,
  tz: number,
  box: PropBound,
): number | null {
  clipTMin = 0;
  clipTMax = 1;
  if (!clipAxis(fx, tx - fx, box.min.x, box.max.x)) return null;
  if (!clipAxis(fy, ty - fy, box.min.y, box.max.y)) return null;
  if (!clipAxis(fz, tz - fz, box.min.z, box.max.z)) return null;
  return clipTMin;
}

function isSegmentBlocked(
  ex: number,
  ey: number,
  ez: number,
  px: number,
  py: number,
  pz: number,
  props: readonly PropBound[],
): boolean {
  for (let i = 0; i < props.length; i++) {
    if (segmentAabbEntryAlpha(ex, ey, ez, px, py, pz, props[i]) !== null) return true;
  }
  return false;
}

/**
 * 對 `props` 求線段 `from`→`to` **最近**的阻擋交點；無相交回 `undefined`。`alpha` 相同時依 `props`
 * 原順序決定最近者（deterministic tie-break）。`props=[]` 立即回 `undefined`，不做任何運算。
 */
export function firstBlockingIntersection(
  from: Readonly<Vec3>,
  to: Readonly<Vec3>,
  props: readonly PropBound[],
): BlockingIntersection | undefined {
  let bestAlpha = Infinity;
  let bestIndex = -1;
  for (let i = 0; i < props.length; i++) {
    const alpha = segmentAabbEntryAlpha(from.x, from.y, from.z, to.x, to.y, to.z, props[i]);
    if (alpha !== null && alpha < bestAlpha) {
      bestAlpha = alpha;
      bestIndex = i;
    }
  }
  if (bestIndex === -1) return undefined;
  const prop = props[bestIndex];
  return {
    propId: prop.id,
    alpha: bestAlpha,
    point: {
      x: from.x + (to.x - from.x) * bestAlpha,
      y: from.y + (to.y - from.y) * bestAlpha,
      z: from.z + (to.z - from.z) * bestAlpha,
    },
  };
}

/**
 * `eye`→目標 hitbox 的可見比例：`sampleCount===1` 只測中心；`sampleCount===9` 測中心 + 8 角
 * （與既有 `visibilityDerivation` 取樣序一致，惟結果只看比例、序不影響輸出）。`sampleCount` 非
 * 1/9 時 runtime throw（JS/JSON 邊界防護；非有限座標由上游 schema/scene validation 拒絕）。
 */
export function visibleFractionForTarget(
  eye: Readonly<Vec3>,
  center: Readonly<Vec3>,
  hitbox: Readonly<TargetHitboxSize>,
  props: readonly PropBound[],
  sampleCount: 1 | 9,
): number {
  if (sampleCount !== 1 && sampleCount !== 9) {
    throw new Error('visibleFractionForTarget: sampleCount must be 1 or 9');
  }

  const centerVisible = isSegmentBlocked(eye.x, eye.y, eye.z, center.x, center.y, center.z, props) ? 0 : 1;
  if (sampleCount === 1) return centerVisible;

  let visible = centerVisible;
  let total = 1;
  const halfW = hitbox.width / 2;
  const halfH = hitbox.height / 2;
  const halfD = hitbox.depth / 2;
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sy = -1; sy <= 1; sy += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        total++;
        const px = center.x + sx * halfW;
        const py = center.y + sy * halfH;
        const pz = center.z + sz * halfD;
        if (!isSegmentBlocked(eye.x, eye.y, eye.z, px, py, pz, props)) visible++;
      }
    }
  }
  return visible / total;
}
