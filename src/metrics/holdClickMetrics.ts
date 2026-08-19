import type { ExportPayload } from '../data/export.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import { angularEccentricityDeg, eyeOriginForTick, resolveEyeOrigin, type EyeOriginOptions } from './eyeOrigin.ts';
import { deriveDetectionMetrics, type DetectionDerivationOptions } from './detectionDerivation.ts';
import { buildPeekWindows } from './peekWindows.ts';
import { deriveTrackingMetrics, type TrackingDerivationOptions } from './trackingDerivation.ts';
import { deriveVisibilityTimeline, type VisibilityDerivationOptions, type VisibilitySample } from './visibilityDerivation.ts';

type Tick = ExportPayload['ticks'][number];
type VisibleEvent = Extract<ExportPayload['events'][number], { type: 'visible' }>;

export interface HoldClickMetricsOptions extends EyeOriginOptions {
  readonly sampleCount?: VisibilityDerivationOptions['sampleCount'];
  readonly onsetThreshold: number;
  readonly detection?: DetectionDerivationOptions;
  readonly tracking?: TrackingDerivationOptions;
}

export interface HoldClickPreAimMetrics {
  readonly tMs: number;
  readonly eccentricityDeg: number;
  readonly yawErrorDeg: number;
  readonly pitchErrorDeg: number;
}

export interface HoldClickPresentationMetrics {
  readonly targetId: string;
  readonly tVisibleMs: number;
  readonly tFirstVisibleMs?: number;
  readonly tMeasurementOnsetMs?: number;
  readonly tFullExposureMs?: number;
  readonly preAim?: HoldClickPreAimMetrics;
  readonly tDetectMs?: number;
  readonly detectionLatencyFromOnsetMs?: number;
  readonly tFirstOnTargetMs?: number;
  readonly acquisitionFromDetectMs?: number;
  readonly tFirstShotMs?: number;
  readonly firstShotAfterOnTargetMs?: number;
  readonly firstShotHit?: boolean;
  readonly anticipation: boolean;
  readonly fireBeforeFirstVisible: boolean;
  readonly fireBeforeMeasurementOnset: boolean;
  readonly flags: readonly string[];
}

export interface HoldClickMetrics {
  readonly presentations: readonly HoldClickPresentationMetrics[];
  readonly anticipationRate: number;
}

const EPSILON = 1e-9;
const RAD_TO_DEG = 180 / Math.PI;

export function deriveHoldClickMetrics(
  payload: ExportPayload,
  scene: SceneConfig,
  options: HoldClickMetricsOptions,
): HoldClickMetrics {
  const visibility = deriveVisibilityTimeline(payload, scene, {
    ...options,
    onsetThreshold: options.onsetThreshold,
  });
  const detection = deriveDetectionMetrics(payload, { ...options, ...options.detection });
  const tracking = deriveTrackingMetrics(payload, { ...options, ...options.tracking });
  const peeks = buildPeekWindows(payload);
  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const visibleEvents = payload.events
    .filter((event): event is VisibleEvent => event.type === 'visible')
    .slice()
    .sort((a, b) => a.t - b.t);
  const eyeOrigin = resolveEyeOrigin(payload, options);

  const presentations = visibleEvents.map((visible, index) => {
    const nextVisible = visibleEvents[index + 1];
    const windowEnd = nextVisible?.t ?? Infinity;
    const windowVisibility = visibility.samples.filter(
      (sample) => sample.t + EPSILON >= visible.t && sample.t < windowEnd - EPSILON,
    );
    const visibilityTimes = crossingTimes(windowVisibility, options.onsetThreshold);
    const detectionPresentation = detection.presentations[index];
    const trackingPresentation = tracking.presentations[index];
    const peek = peeks[index];
    const fireTimes = peek?.fires ?? [];
    const tFirstShotMs = peek?.tFirstShot;
    const fireBeforeFirstVisible = fireBefore(fireTimes, visibilityTimes.tFirstVisibleMs);
    const fireBeforeMeasurementOnset = fireBefore(fireTimes, visibilityTimes.tMeasurementOnsetMs);
    const flags: string[] = [];

    if (visibilityTimes.tMeasurementOnsetMs === undefined) flags.push('no_measurement_onset');
    if (detectionPresentation?.tDetectMs === undefined) flags.push('no_detection');
    if (trackingPresentation?.tFirstOnTargetMs === undefined) flags.push('no_acquisition');
    if (tFirstShotMs === undefined) flags.push('no_first_shot');

    return {
      targetId: visible.targetId,
      tVisibleMs: visible.t,
      ...(visibilityTimes.tFirstVisibleMs !== undefined ? { tFirstVisibleMs: visibilityTimes.tFirstVisibleMs } : {}),
      ...(visibilityTimes.tMeasurementOnsetMs !== undefined
        ? { tMeasurementOnsetMs: visibilityTimes.tMeasurementOnsetMs }
        : {}),
      ...(visibilityTimes.tFullExposureMs !== undefined ? { tFullExposureMs: visibilityTimes.tFullExposureMs } : {}),
      ...preAimForPresentation(
        ticks,
        visible,
        visibilityTimes.tMeasurementOnsetMs ?? visibilityTimes.tFirstVisibleMs,
        eyeOrigin,
      ),
      ...(detectionPresentation?.tDetectMs !== undefined ? { tDetectMs: detectionPresentation.tDetectMs } : {}),
      ...(detectionPresentation?.tDetectMs !== undefined && visibilityTimes.tMeasurementOnsetMs !== undefined
        ? { detectionLatencyFromOnsetMs: detectionPresentation.tDetectMs - visibilityTimes.tMeasurementOnsetMs }
        : {}),
      ...(trackingPresentation?.tFirstOnTargetMs !== undefined
        ? { tFirstOnTargetMs: trackingPresentation.tFirstOnTargetMs }
        : {}),
      ...(detectionPresentation?.tDetectMs !== undefined && trackingPresentation?.tFirstOnTargetMs !== undefined
        ? { acquisitionFromDetectMs: trackingPresentation.tFirstOnTargetMs - detectionPresentation.tDetectMs }
        : {}),
      ...(tFirstShotMs !== undefined ? { tFirstShotMs } : {}),
      ...(tFirstShotMs !== undefined && trackingPresentation?.tFirstOnTargetMs !== undefined
        ? { firstShotAfterOnTargetMs: tFirstShotMs - trackingPresentation.tFirstOnTargetMs }
        : {}),
      ...(peek?.firstFire !== undefined ? { firstShotHit: peek.firstFire.hit } : {}),
      anticipation: fireBeforeFirstVisible || fireBeforeMeasurementOnset,
      fireBeforeFirstVisible,
      fireBeforeMeasurementOnset,
      flags,
    };
  });

  const anticipationCount = presentations.filter((presentation) => presentation.anticipation).length;
  return {
    presentations,
    anticipationRate: presentations.length > 0 ? anticipationCount / presentations.length : 0,
  };
}

function crossingTimes(
  samples: readonly VisibilitySample[],
  onsetThreshold: number,
): Pick<HoldClickPresentationMetrics, 'tFirstVisibleMs' | 'tMeasurementOnsetMs' | 'tFullExposureMs'> {
  const firstVisible = samples.find((sample) => sample.visibleFraction > EPSILON);
  const measurementOnset = samples.find((sample) => sample.visibleFraction + EPSILON >= onsetThreshold);
  const fullExposure = samples.find((sample) => sample.visibleFraction + EPSILON >= 1);
  return {
    ...(firstVisible !== undefined ? { tFirstVisibleMs: firstVisible.t } : {}),
    ...(measurementOnset !== undefined ? { tMeasurementOnsetMs: measurementOnset.t } : {}),
    ...(fullExposure !== undefined ? { tFullExposureMs: fullExposure.t } : {}),
  };
}

function preAimForPresentation(
  ticks: readonly Tick[],
  visible: VisibleEvent,
  referenceTime: number | undefined,
  eyeOrigin: ReturnType<typeof resolveEyeOrigin>,
): { readonly preAim?: HoldClickPreAimMetrics } {
  if (referenceTime === undefined) return {};
  const referenceTick = firstTickAtOrAfter(ticks, referenceTime);
  const target = targetFromTick(referenceTick) ?? targetFromVisible(visible);
  if (target === undefined) return {};
  const preAimTick = lastTickBefore(ticks, referenceTime) ?? referenceTick;
  if (preAimTick === undefined) return {};

  const eye = eyeOriginForTick(preAimTick, eyeOrigin);
  const targetYaw = Math.atan2(-(target.x - eye.x), -(target.z - eye.z));
  const dy = target.y - eye.y;
  const distance = Math.hypot(target.x - eye.x, dy, target.z - eye.z);
  const targetPitch = distance > 0 ? Math.asin(dy / distance) : 0;

  return {
    preAim: {
      tMs: preAimTick.t,
      eccentricityDeg: angularEccentricityDeg(preAimTick, target, eyeOrigin),
      yawErrorDeg: normalizeRad(preAimTick.aim.yaw - targetYaw) * RAD_TO_DEG,
      pitchErrorDeg: (preAimTick.aim.pitch - targetPitch) * RAD_TO_DEG,
    },
  };
}

function fireBefore(fireTimes: readonly number[], boundary: number | undefined): boolean {
  if (fireTimes.length === 0) return false;
  if (boundary === undefined) return true;
  return fireTimes.some((t) => t + EPSILON < boundary);
}

function firstTickAtOrAfter(ticks: readonly Tick[], t: number): Tick | undefined {
  return ticks.find((tick) => tick.t + EPSILON >= t);
}

function lastTickBefore(ticks: readonly Tick[], t: number): Tick | undefined {
  for (let i = ticks.length - 1; i >= 0; i--) {
    if (ticks[i].t < t - EPSILON) return ticks[i];
  }
  return undefined;
}

function targetFromTick(tick: Tick | undefined): { x: number; y: number; z: number } | undefined {
  if (tick === undefined || tick.tx === null || tick.ty === null || tick.tz === null) return undefined;
  return { x: tick.tx, y: tick.ty, z: tick.tz };
}

function targetFromVisible(visible: VisibleEvent): { x: number; y: number; z: number } | undefined {
  if (
    typeof visible.targetX === 'number' &&
    typeof visible.targetY === 'number' &&
    typeof visible.targetZ === 'number' &&
    Number.isFinite(visible.targetX) &&
    Number.isFinite(visible.targetY) &&
    Number.isFinite(visible.targetZ)
  ) {
    return { x: visible.targetX, y: visible.targetY, z: visible.targetZ };
  }
  return undefined;
}

function normalizeRad(value: number): number {
  let out = value;
  while (out <= -Math.PI) out += Math.PI * 2;
  while (out > Math.PI) out -= Math.PI * 2;
  return out;
}
