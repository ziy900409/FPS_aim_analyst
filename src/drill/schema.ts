import {
  MAX_TARGET_HITBOX_U,
  type DrillConfig,
  type CueScheduleConfig,
  type SpawnAreaConfig,
  type SpiderShotScheduleConfig,
  type TargetHitboxConfig,
} from './DrillConfig.ts';
import type { AssessmentMode } from './assessmentContract.ts';
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
  const mode = root.mode === undefined ? undefined : requireAssessmentMode(root.mode, 'mode');
  const weaponId =
    root.weaponId === undefined ? undefined : requireNonEmptyString(root.weaponId, 'weaponId');
  const cue = root.cue === undefined ? undefined : validateCueSchedule(root.cue);

  // targets — count 正整數、distance 正有限數、hitbox / spawnArea / motion 選填。
  const targets = requireObject(root.targets, 'targets');
  const count = requirePositiveInt(targets.count, 'targets.count');
  const distance = requirePositiveNumber(targets.distance, 'targets.distance');
  const hitbox = targets.hitbox === undefined ? undefined : validateHitbox(targets.hitbox);
  const spawnArea = targets.spawnArea === undefined ? undefined : validateSpawnArea(targets.spawnArea);
  const motion = targets.motion === undefined ? undefined : validateMotion(targets.motion);

  // sequence — alternation 列舉、seed 與 seeded spawn delay 選填。
  const sequence = requireObject(root.sequence, 'sequence');
  const alternation = sequence.alternation;
  if (alternation !== 'LR' && alternation !== 'RL') {
    throw err('sequence.alternation', "必須為 'LR' 或 'RL'");
  }
  const seed = sequence.seed === undefined ? undefined : requireFiniteNumber(sequence.seed, 'sequence.seed');
  const spawnDelayMsRange =
    sequence.spawnDelayMsRange === undefined
      ? undefined
      : requireNonNegativeRange(sequence.spawnDelayMsRange, 'sequence.spawnDelayMsRange');
  const spiderShot = root.spiderShot === undefined ? undefined : validateSpiderShotSchedule(root.spiderShot);
  if (spawnArea !== undefined && seed === undefined) {
    throw err('targets.spawnArea', '需搭配 sequence.seed');
  }
  if (spawnDelayMsRange !== undefined && seed === undefined) {
    throw err('sequence.spawnDelayMsRange', '需搭配 sequence.seed');
  }
  if (spiderShot !== undefined) {
    if (spawnArea !== undefined) throw err('targets.spawnArea', '不可與 spiderShot 同時提供');
    if (spawnDelayMsRange !== undefined) throw err('sequence.spawnDelayMsRange', '不可與 spiderShot 同時提供');
    if (seed !== undefined) throw err('sequence.seed', '不可與 spiderShot 同時提供');
  }
  if (mode === 'assessment' && seed === undefined && spiderShot === undefined) {
    throw err('sequence.seed', "mode='assessment' 時必填");
  }

  // timing — countdownMs 非負必填;其餘非負選填。
  const timing = requireObject(root.timing, 'timing');
  const countdownMs = requireNonNegativeNumber(timing.countdownMs, 'timing.countdownMs');
  const spawnDelayMs =
    timing.spawnDelayMs === undefined ? undefined : requireNonNegativeNumber(timing.spawnDelayMs, 'timing.spawnDelayMs');
  const peekTimeoutMs =
    timing.peekTimeoutMs === undefined ? undefined : requirePositiveNumber(timing.peekTimeoutMs, 'timing.peekTimeoutMs');
  const timeLimitMs =
    timing.timeLimitMs === undefined ? undefined : requirePositiveNumber(timing.timeLimitMs, 'timing.timeLimitMs');
  // presentationMs（WP-18 / T3）:追蹤 drill 每目標呈現時長,正有限（比照 peekTimeoutMs 驗證）。
  const presentationMs =
    timing.presentationMs === undefined ? undefined : requirePositiveNumber(timing.presentationMs, 'timing.presentationMs');
  const trackingStopMs =
    timing.trackingStopMs === undefined ? undefined : requirePositiveNumber(timing.trackingStopMs, 'timing.trackingStopMs');
  if (presentationMs !== undefined && trackingStopMs !== undefined) {
    throw err('timing', 'presentationMs 與 trackingStopMs 不可同時提供');
  }

  // endCondition — type 列舉、value 正數（雙閘,OQ-6.3）。
  const endCondition = requireObject(root.endCondition, 'endCondition');
  const type = endCondition.type;
  if (type !== 'targetCount' && type !== 'timeLimit') {
    throw err('endCondition.type', "必須為 'targetCount' 或 'timeLimit'");
  }
  const value = requirePositiveNumber(endCondition.value, 'endCondition.value');

  return {
    drillId,
    ...(mode !== undefined ? { mode } : {}),
    ...(weaponId !== undefined ? { weaponId } : {}),
    ...(cue !== undefined ? { cue } : {}),
    targets: {
      count,
      distance,
      ...(hitbox ? { hitbox } : {}),
      ...(spawnArea ? { spawnArea } : {}),
      ...(motion ? { motion } : {}),
    },
    sequence: {
      alternation,
      ...(seed !== undefined ? { seed } : {}),
      ...(spawnDelayMsRange !== undefined ? { spawnDelayMsRange } : {}),
    },
    ...(spiderShot !== undefined ? { spiderShot } : {}),
    timing: {
      countdownMs,
      ...(spawnDelayMs !== undefined ? { spawnDelayMs } : {}),
      ...(peekTimeoutMs !== undefined ? { peekTimeoutMs } : {}),
      ...(timeLimitMs !== undefined ? { timeLimitMs } : {}),
      ...(presentationMs !== undefined ? { presentationMs } : {}),
      ...(trackingStopMs !== undefined ? { trackingStopMs } : {}),
    },
    endCondition: { type, value },
  };
}

function validateCueSchedule(json: unknown): CueScheduleConfig {
  const cue = requireObject(json, 'cue');
  if (cue.kind === 'single') {
    if (cue.holdDurationMs !== undefined) {
      throw err('cue.holdDurationMs', "kind='single' 時不可提供");
    }
    return { kind: 'single' };
  }
  if (cue.kind === 'hold-reversal') {
    return { kind: 'hold-reversal', holdDurationMs: requirePositiveNumber(cue.holdDurationMs, 'cue.holdDurationMs') };
  }
  throw err('cue.kind', "必須為 'single' 或 'hold-reversal'");
}

function validateSpiderShotSchedule(json: unknown): SpiderShotScheduleConfig {
  const spiderShot = requireObject(json, 'spiderShot');
  if (spiderShot.kind !== 'center-peripheral') {
    throw err('spiderShot.kind', "必須為 'center-peripheral'");
  }
  const peripheral = requireObject(spiderShot.peripheral, 'spiderShot.peripheral');
  return {
    kind: 'center-peripheral',
    seed: requireFiniteNumber(spiderShot.seed, 'spiderShot.seed'),
    centerDistanceU: requirePositiveNumber(spiderShot.centerDistanceU, 'spiderShot.centerDistanceU'),
    peripheral: {
      angularRadiusDegRange: requirePositiveDegreeRange(
        peripheral.angularRadiusDegRange,
        'spiderShot.peripheral.angularRadiusDegRange',
      ),
      azimuthDegRange: requireNonNegativeDegreeRange(
        peripheral.azimuthDegRange,
        'spiderShot.peripheral.azimuthDegRange',
      ),
      distanceURange: requirePositiveRange(peripheral.distanceURange, 'spiderShot.peripheral.distanceURange'),
    },
  };
}

function validateHitbox(json: unknown): TargetHitboxConfig {
  const hitbox = requireObject(json, 'targets.hitbox');
  return {
    widthU: requireHitboxDimension(hitbox.widthU, 'targets.hitbox.widthU'),
    heightU: requireHitboxDimension(hitbox.heightU, 'targets.hitbox.heightU'),
    depthU: requireHitboxDimension(hitbox.depthU, 'targets.hitbox.depthU'),
  };
}

function validateSpawnArea(json: unknown): SpawnAreaConfig {
  const spawnArea = requireObject(json, 'targets.spawnArea');
  return {
    yawDegRange: requireRange(spawnArea.yawDegRange, 'targets.spawnArea.yawDegRange'),
    distanceURange: requirePositiveRange(spawnArea.distanceURange, 'targets.spawnArea.distanceURange'),
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
  // waypoints 形狀驗證:逐元素有限數 Vec3——clearance 淨空展開讀 x/y/z（WP-19 T3),非 Vec3 元素會讓
  // envelope 變 NaN 而靜默跳過檢查（PR #10 review）。偏移相對 target center,可負可零,故只驗有限。
  // 語意深驗（點數下限/speed 配套）仍延後至 WP-6.5（實作 waypoints 移動時）。
  if (m.waypoints !== undefined) {
    if (!Array.isArray(m.waypoints)) throw err('targets.motion.waypoints', '必須為陣列');
    motion.waypoints = m.waypoints.map((point, i) => {
      const p = requireObject(point, `targets.motion.waypoints[${i}]`);
      return {
        x: requireFiniteNumber(p.x, `targets.motion.waypoints[${i}].x`),
        y: requireFiniteNumber(p.y, `targets.motion.waypoints[${i}].y`),
        z: requireFiniteNumber(p.z, `targets.motion.waypoints[${i}].z`),
      };
    });
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

function requireNonEmptyString(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0) throw err(path, '必須為非空字串');
  return v;
}

function requireAssessmentMode(v: unknown, path: string): AssessmentMode {
  if (v !== 'assessment' && v !== 'practice') throw err(path, "必須為 'assessment' 或 'practice'");
  return v;
}

function requireNonNegativeNumber(v: unknown, path: string): number {
  const n = requireFiniteNumber(v, path);
  if (n < 0) throw err(path, '必須 ≥ 0');
  return n;
}

function requireRange(v: unknown, path: string): [number, number] {
  if (!Array.isArray(v) || v.length !== 2) throw err(path, '必須為 [min, max] 陣列');
  const min = requireFiniteNumber(v[0], `${path}[0]`);
  const max = requireFiniteNumber(v[1], `${path}[1]`);
  if (min > max) throw err(path, '必須 min ≤ max');
  return [min, max];
}

function requireNonNegativeRange(v: unknown, path: string): [number, number] {
  const range = requireRange(v, path);
  if (range[0] < 0 || range[1] < 0) throw err(path, '必須 ≥ 0');
  return range;
}

function requirePositiveRange(v: unknown, path: string): [number, number] {
  const range = requireRange(v, path);
  if (range[0] <= 0 || range[1] <= 0) throw err(path, '必須 > 0');
  return range;
}

function requirePositiveDegreeRange(v: unknown, path: string): [number, number] {
  const range = requirePositiveRange(v, path);
  if (range[1] > 360) throw err(path, '必須 ≤ 360');
  return range;
}

function requireNonNegativeDegreeRange(v: unknown, path: string): [number, number] {
  const range = requireNonNegativeRange(v, path);
  if (range[1] > 360) throw err(path, '必須 ≤ 360');
  return range;
}

function requirePositiveNumber(v: unknown, path: string): number {
  const n = requireFiniteNumber(v, path);
  if (n <= 0) throw err(path, '必須 > 0');
  return n;
}

function requireHitboxDimension(v: unknown, path: string): number {
  const n = requirePositiveNumber(v, path);
  if (n > MAX_TARGET_HITBOX_U) throw err(path, `必須 ≤ ${MAX_TARGET_HITBOX_U}`);
  return n;
}

function requirePositiveInt(v: unknown, path: string): number {
  const n = requireFiniteNumber(v, path);
  if (!Number.isInteger(n) || n <= 0) throw err(path, '必須為正整數');
  return n;
}
