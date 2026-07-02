import type { DrillConfig } from './DrillConfig.ts';
import type { TargetMotion } from '../state/types.ts';

/**
 * validateDrill — WP-6 / T1（FR-6.1，OQ-6.4）
 *
 * 執行期驗證未信任的 JSON → `DrillConfig`(手寫 guard,零依賴,對齊專案「純 TS」紀律)。
 * 失敗即 **throw 帶欄位路徑的明確錯誤**,呼叫端（`DrillLoader`,T2）不啟動 drill——避免不合法
 * config 污染量測資料（OQ-6.4）。成功回傳同一物件、型別收斂為 `DrillConfig`。
 *
 * 驗證涵蓋:必填欄位、型別、範圍（正整數/非負/有限數）、列舉值。`motion` 為 F5 接縫,省略即
 * static;若提供則驗證其形狀（規格附錄 G）。
 */
export function validateDrill(json: unknown): DrillConfig {
  const root = requireObject(json, 'root');

  // drillId — 非空字串（對齊匯出 metadata,附錄 C）。
  const drillId = root.drillId;
  if (typeof drillId !== 'string' || drillId.length === 0) {
    throw err('drillId', '必須為非空字串');
  }

  // targets — count 正整數、distance 正有限數、motion 選填。
  const targets = requireObject(root.targets, 'targets');
  const count = requirePositiveInt(targets.count, 'targets.count');
  const distance = requirePositiveNumber(targets.distance, 'targets.distance');
  const motion = targets.motion === undefined ? undefined : validateMotion(targets.motion);

  // sequence — alternation 列舉、seed 選填有限數。
  const sequence = requireObject(root.sequence, 'sequence');
  const alternation = sequence.alternation;
  if (alternation !== 'LR' && alternation !== 'RL') {
    throw err('sequence.alternation', "必須為 'LR' 或 'RL'");
  }
  const seed = sequence.seed === undefined ? undefined : requireFiniteNumber(sequence.seed, 'sequence.seed');

  // timing — countdownMs 非負必填;其餘非負選填。
  const timing = requireObject(root.timing, 'timing');
  const countdownMs = requireNonNegativeNumber(timing.countdownMs, 'timing.countdownMs');
  const spawnDelayMs =
    timing.spawnDelayMs === undefined ? undefined : requireNonNegativeNumber(timing.spawnDelayMs, 'timing.spawnDelayMs');
  const peekTimeoutMs =
    timing.peekTimeoutMs === undefined ? undefined : requirePositiveNumber(timing.peekTimeoutMs, 'timing.peekTimeoutMs');
  const timeLimitMs =
    timing.timeLimitMs === undefined ? undefined : requirePositiveNumber(timing.timeLimitMs, 'timing.timeLimitMs');

  // endCondition — type 列舉、value 正數（雙閘,OQ-6.3）。
  const endCondition = requireObject(root.endCondition, 'endCondition');
  const type = endCondition.type;
  if (type !== 'targetCount' && type !== 'timeLimit') {
    throw err('endCondition.type', "必須為 'targetCount' 或 'timeLimit'");
  }
  const value = requirePositiveNumber(endCondition.value, 'endCondition.value');

  return {
    drillId,
    targets: { count, distance, ...(motion ? { motion } : {}) },
    sequence: { alternation, ...(seed !== undefined ? { seed } : {}) },
    timing: {
      countdownMs,
      ...(spawnDelayMs !== undefined ? { spawnDelayMs } : {}),
      ...(peekTimeoutMs !== undefined ? { peekTimeoutMs } : {}),
      ...(timeLimitMs !== undefined ? { timeLimitMs } : {}),
    },
    endCondition: { type, value },
  };
}

/** motion 形狀驗證（F5 接縫,附錄 G）:type 列舉必填;數值欄位若提供須正/有限。 */
function validateMotion(json: unknown): TargetMotion {
  const m = requireObject(json, 'targets.motion');
  const type = m.type;
  if (type !== 'static' && type !== 'linear' && type !== 'pingpong' && type !== 'sine' && type !== 'waypoints') {
    throw err('targets.motion.type', "必須為 static|linear|pingpong|sine|waypoints 之一");
  }
  const motion: TargetMotion = { type };
  if (m.speed !== undefined) motion.speed = requirePositiveNumber(m.speed, 'targets.motion.speed');
  if (m.axis !== undefined) {
    if (m.axis !== 'horizontal' && m.axis !== 'vertical') {
      throw err('targets.motion.axis', "必須為 'horizontal' 或 'vertical'");
    }
    motion.axis = m.axis;
  }
  if (m.range !== undefined) motion.range = requirePositiveNumber(m.range, 'targets.motion.range');
  if (m.spawnKind !== undefined) {
    if (m.spawnKind !== 'pop-in' && m.spawnKind !== 'slide-in') {
      throw err('targets.motion.spawnKind', "必須為 'pop-in' 或 'slide-in'");
    }
    motion.spawnKind = m.spawnKind;
  }
  // waypoints 深驗延後至 WP-6.5（實作 waypoints 移動時);此處僅接受陣列。
  if (m.waypoints !== undefined) {
    if (!Array.isArray(m.waypoints)) throw err('targets.motion.waypoints', '必須為陣列');
    motion.waypoints = m.waypoints as TargetMotion['waypoints'];
  }
  return motion;
}

// ── 原子 guard（回傳 narrowed 值或 throw 帶路徑錯誤）─────────────────────────────

function err(path: string, msg: string): Error {
  return new Error(`DrillConfig 驗證失敗: ${path} ${msg}`);
}

function requireObject(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw err(path, '必須為物件');
  }
  return v as Record<string, unknown>;
}

function requireFiniteNumber(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw err(path, '必須為有限數字');
  return v;
}

function requireNonNegativeNumber(v: unknown, path: string): number {
  const n = requireFiniteNumber(v, path);
  if (n < 0) throw err(path, '必須 ≥ 0');
  return n;
}

function requirePositiveNumber(v: unknown, path: string): number {
  const n = requireFiniteNumber(v, path);
  if (n <= 0) throw err(path, '必須 > 0');
  return n;
}

function requirePositiveInt(v: unknown, path: string): number {
  const n = requireFiniteNumber(v, path);
  if (!Number.isInteger(n) || n <= 0) throw err(path, '必須為正整數');
  return n;
}
