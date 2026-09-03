import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import {
  deriveTrackingSamples,
  type TrackingDerivationOptions,
  type TrackingSample,
} from './trackingDerivation.ts';

export const TRACKING_CONTACT_ANALYSIS_VERSION = 'tracking-contact-v1' as const;

export type TrackingWindow = 'pre-acquire' | 'pursuit' | 'none';

export interface TrackingContactSample {
  readonly t: number;
  readonly targetId: string;
  readonly target: { readonly x: number; readonly y: number; readonly z: number };
  readonly aim: { readonly yaw: number; readonly pitch: number };
  readonly onTarget: boolean;
  readonly epsilonDeg: number;
  readonly presentationIndex: number;
  readonly trackingWindow: TrackingWindow;
}

export type TrackingContactBlockedReason =
  | 'schema-version-unsupported'
  | 'missing-visible-event'
  | 'missing-target-telemetry'
  | 'missing-eye-origin'
  | 'invalid-hitbox'
  | 'no-tracking-drill'
  | 'protocol-incompatible';

export interface TrackingContactDerivationOptions extends TrackingDerivationOptions {
  /**
   * Contact artifacts are research evidence, so the default is fail-closed when
   * pre-S1 exports lack a deterministic eye origin. Tests may opt into legacy
   * behavior explicitly for backward-compatibility checks.
   */
  readonly strictEyeOrigin?: boolean;
}

export type TrackingContactDerivationResult =
  | {
      readonly status: 'ok';
      readonly analysisVersion: typeof TRACKING_CONTACT_ANALYSIS_VERSION;
      readonly drillId: string;
      readonly samples: readonly TrackingContactSample[];
    }
  | {
      readonly status: 'blocked';
      readonly analysisVersion: typeof TRACKING_CONTACT_ANALYSIS_VERSION;
      readonly reasons: readonly TrackingContactBlockedReason[];
    };

type VisibleEvent = Extract<ExportPayload['events'][number], { type: 'visible' }>;
type ScoredStartEvent = Extract<ExportPayload['events'][number], { type: 'scored_start' }>;

const EPSILON = 1e-9;

export function deriveTrackingContactSamples(
  payload: ExportPayload,
  options: TrackingContactDerivationOptions = {},
): TrackingContactDerivationResult {
  const preflightReasons = preflight(payload, options);
  if (preflightReasons.length > 0) return blocked(preflightReasons);

  const strictOptions: TrackingContactDerivationOptions = { strictEyeOrigin: true, ...options };
  let derived: ReturnType<typeof deriveTrackingSamples>;
  try {
    derived = deriveTrackingSamples(payload, strictOptions);
  } catch (error) {
    return blocked([reasonFromDerivationError(error)]);
  }

  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const visibleEvents = visibleEventsFor(payload);
  const scoredStarts = scoredStartEventsFor(payload);
  const samples: TrackingContactSample[] = [];

  for (let presentationIndex = 0; presentationIndex < derived.presentations.length; presentationIndex++) {
    const presentation = derived.presentations[presentationIndex];
    const visible = visibleEvents[presentationIndex];
    const scoredStart = scoredStartForPresentation(scoredStarts, presentation.targetId, visible, presentation.windowEndMs);
    const windowStart = scoredStart?.t ?? presentation.tVisibleMs;
    const activeRows = activeRowsForPresentation(presentation.samples, ticks, windowStart);
    if (activeRows.length === 0) return blocked(['missing-target-telemetry']);

    const firstOnTarget = activeRows.find((row) => row.sample.onTarget)?.sample.t;
    for (const row of activeRows) {
      const targetId = row.tick.replayTargetId ?? presentation.targetId;
      samples.push({
        t: row.sample.t,
        targetId,
        target: { x: row.tick.tx!, y: row.tick.ty!, z: row.tick.tz! },
        aim: { yaw: row.tick.aim.yaw, pitch: row.tick.aim.pitch },
        onTarget: row.sample.onTarget,
        epsilonDeg: row.sample.epsilonDeg,
        presentationIndex,
        trackingWindow: trackingWindowFor(row.sample, firstOnTarget),
      });
    }
  }

  if (samples.length === 0) return blocked(['missing-target-telemetry']);
  return {
    status: 'ok',
    analysisVersion: TRACKING_CONTACT_ANALYSIS_VERSION,
    drillId: payload.meta.drillId,
    samples,
  };
}

function preflight(
  payload: ExportPayload,
  options: TrackingContactDerivationOptions,
): TrackingContactBlockedReason[] {
  const reasons: TrackingContactBlockedReason[] = [];
  if (payload.meta.schemaVersion !== 2) reasons.push('schema-version-unsupported');
  if (!payload.meta.drillId.startsWith('tracking_')) reasons.push('no-tracking-drill');
  if (visibleEventsFor(payload).length === 0) reasons.push('missing-visible-event');
  if (!hasResolvableEyeOrigin(payload, { strictEyeOrigin: true, ...options })) reasons.push('missing-eye-origin');
  if (!hasValidHitbox(payload, options)) reasons.push('invalid-hitbox');
  return uniqueReasons(reasons);
}

function hasResolvableEyeOrigin(payload: ExportPayload, options: TrackingContactDerivationOptions): boolean {
  if (options.strictEyeOrigin === false) return true;
  if (options.eyeBase !== undefined) return true;
  const eye = payload.meta.scene?.eye;
  return (
    eye !== undefined &&
    isFiniteNumber(eye.x) &&
    isFiniteNumber(eye.y) &&
    isFiniteNumber(eye.z) &&
    isFiniteNumber(payload.meta.simToWorld) &&
    payload.meta.simToWorld > 0
  );
}

function hasValidHitbox(payload: ExportPayload, options: TrackingContactDerivationOptions): boolean {
  const metaHitbox = payload.meta.targets?.hitbox;
  if (metaHitbox !== undefined) {
    return (
      positiveFinite(metaHitbox.widthU) &&
      positiveFinite(metaHitbox.heightU) &&
      positiveFinite(metaHitbox.depthU) &&
      (metaHitbox.shape === undefined || metaHitbox.shape === 'box')
    );
  }
  const optionHitbox = options.hitbox;
  if (optionHitbox === undefined) return true;
  return positiveFinite(optionHitbox.width) && positiveFinite(optionHitbox.height) && positiveFinite(optionHitbox.depth);
}

function activeRowsForPresentation(
  samples: readonly TrackingSample[],
  ticks: readonly TickRecord[],
  windowStart: number,
): Array<{ readonly sample: TrackingSample; readonly tick: TickRecord }> {
  const rows: Array<{ readonly sample: TrackingSample; readonly tick: TickRecord }> = [];
  for (const sample of samples) {
    if (sample.t + EPSILON < windowStart) continue;
    const tick = ticks.find((candidate) => Math.abs(candidate.t - sample.t) <= EPSILON);
    if (tick === undefined || tick.tx === null || tick.ty === null || tick.tz === null) continue;
    rows.push({ sample, tick });
  }
  return rows;
}

function trackingWindowFor(sample: TrackingSample, firstOnTarget: number | undefined): TrackingWindow {
  if (firstOnTarget === undefined || sample.t + EPSILON < firstOnTarget) return 'pre-acquire';
  return 'pursuit';
}

function scoredStartForPresentation(
  events: readonly ScoredStartEvent[],
  targetId: string,
  visible: VisibleEvent | undefined,
  windowEndMs: number,
): ScoredStartEvent | undefined {
  return events.find(
    (event) =>
      event.targetId === targetId &&
      (visible === undefined || event.t + EPSILON >= visible.t) &&
      event.t < windowEndMs - EPSILON,
  );
}

function visibleEventsFor(payload: ExportPayload): VisibleEvent[] {
  return payload.events
    .filter((event): event is VisibleEvent => event.type === 'visible')
    .slice()
    .sort((a, b) => a.t - b.t);
}

function scoredStartEventsFor(payload: ExportPayload): ScoredStartEvent[] {
  return payload.events
    .filter((event): event is ScoredStartEvent => event.type === 'scored_start')
    .slice()
    .sort((a, b) => a.t - b.t);
}

function reasonFromDerivationError(error: unknown): TrackingContactBlockedReason {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('resolveEyeOrigin')) return 'missing-eye-origin';
  if (message.includes('hitbox')) return 'invalid-hitbox';
  if (message.includes('target position is missing')) return 'missing-target-telemetry';
  return 'protocol-incompatible';
}

function blocked(reasons: readonly TrackingContactBlockedReason[]): TrackingContactDerivationResult {
  return {
    status: 'blocked',
    analysisVersion: TRACKING_CONTACT_ANALYSIS_VERSION,
    reasons: uniqueReasons(reasons),
  };
}

function uniqueReasons(reasons: readonly TrackingContactBlockedReason[]): TrackingContactBlockedReason[] {
  return Array.from(new Set(reasons));
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
