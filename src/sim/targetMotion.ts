import type { TargetMotion, Vec3 } from '../state/types.ts';

/**
 * targetMotion — WP-18 / T1（FR-B17 前置；規格 §1.3 階段 B(4)、附錄 G）
 *
 * 移動目標位置的**純函式**核心:給定 `motion` 與 `age`（自 spawn 起累加的邏輯秒數）算出目標
 * 相對 spawn 原點的**位移**（displacement），與 render FPS 無關(CLAUDE.md §4「以 age 純函式演進」)。
 *
 * **決定性根源**:`motionOffset` 只依 `(motion, age)`——不讀時鐘(`Date.now`/`performance.now`)、
 * 不碰 DOM、不用 `Math.random`（GD-5）。相同 `age` 序列 → 相同位移序列（逐位)。
 *
 * **原點語意**:所有 type 皆滿足 `offset(_, 0) = 0`（spawn 位置即原點）。`TargetManager` 據此以
 * **每 tick 位移差**（`offset(age) − offset(age−tickSec)`）就地更新 `target.pos`，免存原點、免額外配置
 * （GC 紀律 §4;等價「pos = 原點 + offset(age)」的增量形式，見 [TargetManager.ts](./TargetManager.ts)）。
 *
 * **速度語意**（u/s,source unit;T0 OQ-18.1 界定 `speed ∈ [1,4]`、`range ∈ [0.5,1.5]` 半幅）:
 * - `linear`:沿 axis 等速位移 `speed·age`（無界;行程 ≤ `range` 由 config 短時長保證,非 runtime clamp）。
 * - `pingpong`:三角波,恆定速率 `speed`,在 `[−range, +range]` 往返（`range` = 擺盪半幅/振幅）。
 * - `sine`:正弦,`range·sin(ω·age)`,`ω = speed/range` 使**峰值速率 = speed**、峰值位移 = `range`。
 * - `static` / `waypoints` / 省略:位移恆 0（T1 不驅動 `waypoints`;既有靜止 drill 零破壞)。
 *
 * `axis` 預設 `horizontal`（位移落在 x）;`vertical` 落在 y。z 恆不動（走廊縱深不變,GD-6 相容)。
 */

/** 三角波:距離 `d`(u)沿週期 `4·range` 折返,值域 `[−range, +range]`,`wave(0)=0` 且起步往 +。 */
function triangleWave(d: number, range: number): number {
  if (range <= 0) return 0;
  const period = 4 * range;
  let p = d % period;
  if (p < 0) p += period; //                負 age 防呆(age 恆 ≥ 0,但保純函式全域正確)
  if (p < range) return p; //               0 → +range
  if (p < 3 * range) return 2 * range - p; // +range → −range
  return p - period; //                     −range → 0（p∈[3range,4range) → 值∈[−range,0))
}

/**
 * 目標相對 spawn 原點的位移(就地寫入 `out`,GC 紀律)。`out` 由呼叫端提供並重用。
 * `age` = 自 spawn 起邏輯秒數(sim tick 累加 tickSec)。
 */
export function motionOffset(motion: TargetMotion, age: number, out: Vec3): void {
  out.x = 0;
  out.y = 0;
  out.z = 0;
  const speed = motion.speed ?? 0;
  const range = motion.range ?? 0;

  let displacement = 0;
  switch (motion.type) {
    case 'linear':
      displacement = speed * age;
      break;
    case 'pingpong':
      displacement = triangleWave(speed * age, range);
      break;
    case 'sine': {
      // ω = speed/range → 峰值速率 range·ω = speed;range=0 或 speed=0 時退化為靜止。
      const omega = range === 0 ? 0 : speed / range;
      displacement = range * Math.sin(omega * age);
      break;
    }
    // 'static' / 'waypoints' / 未知:位移恆 0（T1 範圍;waypoints 驅動另立）。
  }

  if (motion.axis === 'vertical') out.y = displacement;
  else out.x = displacement; // 預設 horizontal
}

/**
 * T1 是否驅動此 motion（`linear`/`pingpong`/`sine`）。`static`/`waypoints`/省略 → false（pos 不動,
 * 既有 drill 逐位不變）。`TargetManager` 以此跳過零位移 type,穩態零計算。
 */
export function isDrivenMotion(motion: TargetMotion | undefined): motion is TargetMotion {
  return motion !== undefined && (motion.type === 'linear' || motion.type === 'pingpong' || motion.type === 'sine');
}
