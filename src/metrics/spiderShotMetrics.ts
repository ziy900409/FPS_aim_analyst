import type { ExportPayload } from '../data/export.ts';
import { omegaDegPerSec } from './angularKinematics.ts';
import { deriveDetectionMetrics, type DetectionDerivationOptions } from './detectionDerivation.ts';
import { angularEccentricityDeg, resolveEyeOrigin } from './eyeOrigin.ts';
import { buildPeekWindows } from './peekWindows.ts';
import { deriveTrackingSamples, type TrackingDerivationOptions } from './trackingDerivation.ts';
import { deriveTrackingTransitions } from './trackingTransitions.ts';

export interface SpiderShotMetricsOptions {
  readonly detection?: DetectionDerivationOptions;
  readonly tracking?: TrackingDerivationOptions;
}

export interface SpiderShotMetrics {
  readonly switchReaction: readonly { targetId: string; tDetectMs?: number; reactionMs?: number }[];
  readonly movementExecution: readonly { targetId: string; movementTimeMs?: number; peakOmegaDegPerSec?: number }[];
  readonly stopControl: readonly {
    targetId: string;
    overshootDeg?: number;
    dropCount?: number;
    microAdjustCount?: number;
  }[];
  readonly firstShot: readonly { targetId: string; hit?: boolean; fireAngleErrorDeg?: number }[];
  readonly rhythm: { readonly transitionIntervalMs: readonly number[]; readonly medianMs: number; readonly p95Ms: number };
}

type VisibleEvent = Extract<ExportPayload['events'][number], { type: 'visible' }>;

/**
 * Assemble Spider Shot's five construct-level metrics from the canonical derivations.
 *
 * The per-target constructs apply only to center-to-peripheral arrivals; returns to center
 * remain anchors for the rhythm distribution. `movementTimeMs` is the execution interval
 * from sustained movement detection to the first on-target sample, so it is distinct from
 * the visual-motor reaction proxy.
 */
export function deriveSpiderShotMetrics(
  payload: ExportPayload,
  options: SpiderShotMetricsOptions = {},
): SpiderShotMetrics {
  const visible = sortedVisible(payload);
  const peripheral = visible.filter((event) => event.zone === 'peripheral');
  const detection = deriveDetectionMetrics(payload, options.detection).presentations;
  const tracking = deriveTrackingSamples(payload, options.tracking).presentations;
  const windows = buildPeekWindows(payload);
  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const omega = omegaDegPerSec(ticks).values;
  const eyeOrigin = resolveEyeOrigin(payload, options.tracking);

  const detectionByTarget = new Map(detection.map((presentation) => [presentation.targetId, presentation]));
  const trackingByTarget = new Map(tracking.map((presentation) => [presentation.targetId, presentation]));
  const windowByTarget = new Map(windows.map((window) => [window.targetId, window]));

  return {
    switchReaction: peripheral.map((event) => {
      const presentation = detectionByTarget.get(event.targetId);
      return {
        targetId: event.targetId,
        ...(presentation?.tDetectMs !== undefined ? { tDetectMs: presentation.tDetectMs } : {}),
        ...(presentation?.reactionMs !== undefined ? { reactionMs: presentation.reactionMs } : {}),
      };
    }),
    movementExecution: peripheral.map((event) => {
      const detected = detectionByTarget.get(event.targetId)?.tDetectMs;
      const firstOnTarget = trackingByTarget.get(event.targetId)?.samples.find((sample) => sample.onTarget)?.t;
      const window = windowByTarget.get(event.targetId);
      return {
        targetId: event.targetId,
        ...(detected !== undefined && firstOnTarget !== undefined ? { movementTimeMs: firstOnTarget - detected } : {}),
        ...(window !== undefined ? peakOmega(omega, window.tickRange.start, window.tickRange.end) : {}),
      };
    }),
    stopControl: peripheral.map((event) => {
      const presentation = trackingByTarget.get(event.targetId);
      if (presentation === undefined) return { targetId: event.targetId };
      const transitions = deriveTrackingTransitions(presentation.samples, event.targetId);
      const overshootDeg = postAcquireOvershoot(presentation.samples);
      return {
        targetId: event.targetId,
        ...(overshootDeg !== undefined ? { overshootDeg } : {}),
        dropCount: transitions.dropCount,
        microAdjustCount: transitions.reacquireMs.length,
      };
    }),
    firstShot: peripheral.map((event) => {
      const window = windowByTarget.get(event.targetId);
      if (window?.tFirstShot === undefined) return { targetId: event.targetId };
      const tick = firstTickAtOrAfter(ticks, window.tFirstShot);
      const target = targetForFirstShot(tick, window.visible);
      return {
        targetId: event.targetId,
        hit: window.outcome === 'hit',
        ...(tick !== undefined && target !== undefined
          ? { fireAngleErrorDeg: angularEccentricityDeg(tick, target, eyeOrigin) }
          : {}),
      };
    }),
    rhythm: rhythmFor(visible),
  };
}

function sortedVisible(payload: ExportPayload): VisibleEvent[] {
  return payload.events
    .filter((event): event is VisibleEvent => event.type === 'visible')
    .slice()
    .sort((a, b) => a.t - b.t);
}

function peakOmega(values: readonly number[], start: number, end: number): { peakOmegaDegPerSec?: number } {
  const finite = values.slice(start, end).filter(Number.isFinite).map(Math.abs);
  return finite.length === 0 ? {} : { peakOmegaDegPerSec: Math.max(...finite) };
}

function postAcquireOvershoot(
  samples: readonly { readonly onTarget: boolean; readonly epsilonDeg: number }[],
): number | undefined {
  const firstOnTarget = samples.findIndex((sample) => sample.onTarget);
  if (firstOnTarget < 0) return undefined;
  const escaped = samples.slice(firstOnTarget + 1).filter((sample) => !sample.onTarget).map((sample) => sample.epsilonDeg);
  return escaped.length === 0 ? undefined : Math.max(...escaped);
}

function firstTickAtOrAfter<T extends { readonly t: number }>(ticks: readonly T[], t: number): T | undefined {
  return ticks.find((tick) => tick.t + 1e-9 >= t);
}

function targetForFirstShot(
  tick: ExportPayload['ticks'][number] | undefined,
  visible: VisibleEvent,
): { x: number; y: number; z: number } | undefined {
  if (tick?.tx !== null && tick?.tx !== undefined && tick.ty !== null && tick.ty !== undefined && tick.tz !== null && tick.tz !== undefined) {
    return { x: tick.tx, y: tick.ty, z: tick.tz };
  }
  if (isFiniteNumber(visible.targetX) && isFiniteNumber(visible.targetY) && isFiniteNumber(visible.targetZ)) {
    return { x: visible.targetX, y: visible.targetY, z: visible.targetZ };
  }
  return undefined;
}

function rhythmFor(visible: readonly VisibleEvent[]): SpiderShotMetrics['rhythm'] {
  const transitionIntervalMs = visible.slice(1).map((event, index) => event.t - visible[index].t);
  return {
    transitionIntervalMs,
    medianMs: percentile(transitionIntervalMs, 50),
    p95Ms: percentile(transitionIntervalMs, 95),
  };
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
