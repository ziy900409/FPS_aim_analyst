import type { ExportPayload } from '../data/export.ts';
import { DEFAULT_TARGET_HITBOX, type TargetHitboxSize } from '../drill/DrillConfig.ts';
import { visibleFractionForTarget } from '../scene/occlusionGeometry.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import {
  eyeOriginForTick,
  resolveEyeOrigin,
  type EyeOriginOptions,
  type ResolvedEyeOrigin,
} from './eyeOrigin.ts';

export interface VisibilitySample {
  readonly t: number;
  readonly visibleFraction: number;
}

export interface VisibilityTimeline {
  readonly samples: readonly VisibilitySample[];
  readonly tFirstVisible?: number;
  readonly tMeasurementOnset?: number;
  readonly tFullExposure?: number;
}

export interface VisibilityDerivationOptions extends EyeOriginOptions {
  readonly sampleCount?: 1 | 9;
  readonly onsetThreshold: number;
  readonly hitbox?: TargetHitboxSize;
}

interface ResolvedVisibilityOptions {
  readonly sampleCount: 1 | 9;
  readonly onsetThreshold: number;
  readonly hitbox: TargetHitboxSize;
  readonly eyeOrigin: ResolvedEyeOrigin;
}

type Tick = ExportPayload['ticks'][number];

const EPSILON = 1e-9;
const DEFAULT_SAMPLE_COUNT = 9;

export function deriveVisibilityTimeline(
  payload: ExportPayload,
  scene: SceneConfig,
  options: VisibilityDerivationOptions,
): VisibilityTimeline {
  const resolved = resolveOptions(payload, options);
  const samples = payload.ticks
    .slice()
    .sort((a, b) => a.t - b.t)
    .map((tick) => ({
      t: tick.t,
      visibleFraction: visibleFractionForTick(tick, scene, resolved),
    }));

  return {
    samples,
    ...firstCrossingTimes(samples, resolved.onsetThreshold),
  };
}

function visibleFractionForTick(tick: Tick, scene: SceneConfig, options: ResolvedVisibilityOptions): number {
  if (tick.tx === null || tick.ty === null || tick.tz === null) return 0;

  const eye = eyeOriginForTick(tick, options.eyeOrigin);
  return visibleFractionForTarget(
    eye,
    { x: tick.tx, y: tick.ty, z: tick.tz },
    options.hitbox,
    scene.propBounds,
    options.sampleCount,
  );
}

function firstCrossingTimes(
  samples: readonly VisibilitySample[],
  onsetThreshold: number,
): Omit<VisibilityTimeline, 'samples'> {
  const firstVisible = samples.find((sample) => sample.visibleFraction > EPSILON);
  const measurementOnset = samples.find((sample) => sample.visibleFraction + EPSILON >= onsetThreshold);
  const fullExposure = samples.find((sample) => sample.visibleFraction + EPSILON >= 1);

  return {
    ...(firstVisible !== undefined ? { tFirstVisible: firstVisible.t } : {}),
    ...(measurementOnset !== undefined ? { tMeasurementOnset: measurementOnset.t } : {}),
    ...(fullExposure !== undefined ? { tFullExposure: fullExposure.t } : {}),
  };
}

function resolveOptions(payload: ExportPayload, options: VisibilityDerivationOptions): ResolvedVisibilityOptions {
  const sampleCount = options.sampleCount ?? DEFAULT_SAMPLE_COUNT;
  if (sampleCount !== 1 && sampleCount !== 9) {
    throw new Error('visibilityDerivation: sampleCount must be 1 or 9');
  }
  if (!Number.isFinite(options.onsetThreshold) || options.onsetThreshold <= 0 || options.onsetThreshold > 1) {
    throw new Error('visibilityDerivation: onsetThreshold must be in (0, 1]');
  }

  const hitbox = hitboxFromMeta(payload) ?? options.hitbox ?? DEFAULT_TARGET_HITBOX;
  return {
    sampleCount,
    onsetThreshold: options.onsetThreshold,
    hitbox: {
      width: positiveFinite(hitbox.width, 'hitbox.width'),
      height: positiveFinite(hitbox.height, 'hitbox.height'),
      depth: positiveFinite(hitbox.depth, 'hitbox.depth'),
    },
    eyeOrigin: resolveEyeOrigin(payload, options),
  };
}

function hitboxFromMeta(payload: ExportPayload): TargetHitboxSize | undefined {
  const hitbox = payload.meta.targets?.hitbox;
  if (hitbox === undefined) return undefined;
  return { width: hitbox.widthU, height: hitbox.heightU, depth: hitbox.depthU };
}

function positiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
  return value;
}
