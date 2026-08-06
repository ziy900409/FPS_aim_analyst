import type { ExportPayload } from '../data/export.ts';
import { SIM_TO_WORLD } from '../loop/constants.ts';
import type { EyeWorldBase } from '../scene/eyePose.ts';

/**
 * eyeOrigin — KI-004 / S1 T4(FR-S1-5/6/7)。
 *
 * ε(t) / on-target 幾何的**唯一** TS 實作,`trackingDerivation.ts` 與 `detectionDerivation.ts`
 * 共用。解析射線原點(world domain)所需的兩個量 —— eye world base 與 sim→world 換算 ——
 * 依優先序 `explicit` → `meta` → `legacy-default` 決定,並在結果中具名揭露來源(D2a 的復發面
 * 在資料上可見,而非隱形)。
 */

export interface EyeOriginOptions {
  /** 顯式 eye world base;優先級最高。 */
  eyeBase?: EyeWorldBase;
  /** world unit per source unit;省略時取 SIM_TO_WORLD。 */
  simToWorld?: number;
  /** @deprecated 相容別名 —— 等價於 `eyeBase.y`,僅在未給 `eyeBase` 時生效。 */
  eyeHeight?: number;
  /** true 時,解析落到 `legacy-default` 即拋錯(研究側入口必開)。 */
  strictEyeOrigin?: boolean;
}

export type EyeOriginSource = 'explicit' | 'meta' | 'legacy-default';

export interface ResolvedEyeOrigin {
  base: EyeWorldBase;
  simToWorld: number;
  /** 揭露原點從哪來 —— 'legacy-default' 表示 base.z 是猜的(D2a 的復發面)。 */
  source: EyeOriginSource;
}

/**
 * 解析優先序:
 *   1. `options.eyeBase`(+ `options.simToWorld`)                    → source = 'explicit'
 *   2. `meta.scene.eye` + `meta.simToWorld`(T2 起的 S1 匯出皆有)    → source = 'meta'
 *      —— 兩者**都**要有效才成立;只拿到一半視為 miss(不得半猜半讀)
 *   3. legacy fallback `{ x: 0, y: eyeHeight ?? 1.6, z: 0 }` + `simToWorld`
 *                                                                    → source = 'legacy-default'
 * 注意:fallback **仍套用 `simToWorld`**(D2b 的因子是全域引擎常數,可知)。
 * 只有 `base.z`(D2a)無法從 pre-S1 匯出還原 —— 故以 source 旗標 + strict 模式讓它可見/可擋。
 */
export function resolveEyeOrigin(payload: ExportPayload, options: EyeOriginOptions = {}): ResolvedEyeOrigin {
  const simToWorld = options.simToWorld ?? SIM_TO_WORLD;

  if (options.eyeBase !== undefined) {
    return { base: options.eyeBase, simToWorld, source: 'explicit' };
  }

  const metaEye = payload.meta.scene?.eye;
  const metaSimToWorld = payload.meta.simToWorld;
  if (metaEye !== undefined && isFiniteNumber(metaSimToWorld) && metaSimToWorld > 0) {
    return {
      base: { x: metaEye.x, y: metaEye.y, z: metaEye.z },
      simToWorld: metaSimToWorld,
      source: 'meta',
    };
  }

  if (options.strictEyeOrigin === true) {
    throw new Error(
      'resolveEyeOrigin: this export has no meta.scene.eye / meta.simToWorld (pre-S1); ' +
        'please supply an explicit eyeBase (see KI-004 §2.3)',
    );
  }

  return {
    base: { x: 0, y: options.eyeHeight ?? 1.6, z: 0 },
    simToWorld,
    source: 'legacy-default',
  };
}

/** eyeOrigin(tick) = base + (px, 0, pz) × simToWorld。純函式,逐 tick 呼叫。 */
export function eyeOriginForTick(
  tick: { px: number; pz: number },
  resolved: ResolvedEyeOrigin,
): { x: number; y: number; z: number } {
  return {
    x: resolved.base.x + tick.px * resolved.simToWorld,
    y: resolved.base.y,
    z: resolved.base.z + tick.pz * resolved.simToWorld,
  };
}

export interface TargetPoint {
  x: number;
  y: number;
  z: number;
}

export function aimForward(yaw: number, pitch: number): TargetPoint {
  const cosPitch = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cosPitch,
  };
}

/** ε(t):aim ray 與 target center 的無號夾角(度),原點 = `eyeOriginForTick`。 */
export function angularEccentricityDeg(
  tick: { px: number; pz: number; aim: { yaw: number; pitch: number } },
  target: TargetPoint,
  resolved: ResolvedEyeOrigin,
): number {
  const eye = eyeOriginForTick(tick, resolved);
  const aim = aimForward(tick.aim.yaw, tick.aim.pitch);
  const dx = target.x - eye.x;
  const dy = target.y - eye.y;
  const dz = target.z - eye.z;
  const len = Math.hypot(dx, dy, dz);
  if (len === 0) return 0;

  const dot = aim.x * (dx / len) + aim.y * (dy / len) + aim.z * (dz / len);
  return radToDeg(Math.acos(clamp(dot, -1, 1)));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}
