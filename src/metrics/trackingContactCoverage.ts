import type { ExportPayload } from '../data/export.ts';
import {
  buildTrackingContactArtifact,
  type TrackingContactArtifact,
  type TrackingContactArtifactOptions,
} from './trackingContactArtifact.ts';
import type { TrackingContactBlockedReason, TrackingContactSample } from './trackingContact.ts';

export interface TrackingContactCoverageOptions extends TrackingContactArtifactOptions {}

export interface TrackingContactPresentationSummary {
  readonly presentationIndex: number;
  readonly targetId: string;
  readonly sampleCount: number;
  readonly acquisitionFailure: boolean;
  readonly tFirstOnTargetMs?: number;
  readonly tAcquireMs?: number;
  readonly trackingWindowSampleCount?: number;
  readonly onTargetTickCount?: number;
  readonly totPercent?: number;
  readonly rmsEpsilonDeg?: number;
  readonly medianEpsilonDeg?: number;
  readonly p95EpsilonDeg?: number;
}

export interface TrackingContactPureSummary {
  readonly presentationCount: number;
  readonly sampleCount: number;
  readonly acquisitionFailureCount: number;
  readonly acquisitionFailureRate: number;
  readonly trackingWindowSampleCount: number;
  readonly onTargetTickCount: number;
  readonly totPercent?: number;
  readonly rmsEpsilonDeg?: number;
  readonly medianEpsilonDeg?: number;
  readonly p95EpsilonDeg?: number;
  readonly presentations: readonly TrackingContactPresentationSummary[];
}

export interface TrackingContactBrCompanion {
  readonly ads: {
    readonly tickCount: number;
    readonly eventCount: number;
    readonly downEventCount: number;
  };
  readonly aimRay: {
    readonly sampleCount: number;
    readonly onTargetSampleCount: number;
    readonly onTargetRate: number;
  };
  readonly ballistic: {
    readonly fireEventCount: number;
    readonly hitscanFireHitCount: number;
    readonly projectileHitEventCount: number;
    readonly weaponBulletModel: 'projectile' | 'none';
  };
}

export type TrackingContactCoverageRun =
  | {
      readonly status: 'included';
      readonly drillId: string;
      readonly contactArtifact: Extract<TrackingContactArtifact, { status: 'ok' }>;
      readonly pureSummary: TrackingContactPureSummary;
      readonly brCompanion?: TrackingContactBrCompanion;
    }
  | {
      readonly status: 'excluded';
      readonly drillId: string;
      readonly contactArtifact: Extract<TrackingContactArtifact, { status: 'blocked' }>;
      readonly reasons: readonly TrackingContactBlockedReason[];
    };

export interface TrackingContactCoverageReport {
  readonly runCount: number;
  readonly includedRunCount: number;
  readonly excludedRunCount: number;
  readonly exclusionReasonCounts: Readonly<Partial<Record<TrackingContactBlockedReason, number>>>;
  readonly runs: readonly TrackingContactCoverageRun[];
}

export function buildTrackingContactCoverageReport(
  payloads: readonly ExportPayload[],
  options: TrackingContactCoverageOptions = {},
): TrackingContactCoverageReport {
  const runs = payloads.map((payload) => buildCoverageRun(payload, options));
  const excludedRuns = runs.filter((run): run is Extract<TrackingContactCoverageRun, { status: 'excluded' }> => run.status === 'excluded');

  return {
    runCount: runs.length,
    includedRunCount: runs.length - excludedRuns.length,
    excludedRunCount: excludedRuns.length,
    exclusionReasonCounts: countExclusionReasons(excludedRuns),
    runs,
  };
}

export function summarizeTrackingContactSamples(samples: readonly TrackingContactSample[]): TrackingContactPureSummary {
  const presentations = summarizePresentations(samples);
  const acquired = presentations.filter(
    (presentation): presentation is TrackingContactPresentationSummary & {
      readonly trackingWindowSampleCount: number;
      readonly onTargetTickCount: number;
    } => !presentation.acquisitionFailure,
  );
  const windowSamples = samples.filter((sample) => sample.trackingWindow === 'pursuit');
  const onTargetTickCount = windowSamples.filter((sample) => sample.onTarget).length;
  const epsilons = windowSamples.map((sample) => sample.epsilonDeg);

  return {
    presentationCount: presentations.length,
    sampleCount: samples.length,
    acquisitionFailureCount: presentations.length - acquired.length,
    acquisitionFailureRate: presentations.length > 0 ? (presentations.length - acquired.length) / presentations.length : 0,
    trackingWindowSampleCount: windowSamples.length,
    onTargetTickCount,
    ...(windowSamples.length > 0
      ? {
          totPercent: (onTargetTickCount / windowSamples.length) * 100,
          rmsEpsilonDeg: rms(epsilons),
          medianEpsilonDeg: percentile(epsilons, 50),
          p95EpsilonDeg: percentile(epsilons, 95),
        }
      : {}),
    presentations,
  };
}

function buildCoverageRun(payload: ExportPayload, options: TrackingContactCoverageOptions): TrackingContactCoverageRun {
  const contactArtifact = buildTrackingContactArtifact(payload, options);
  if (contactArtifact.status === 'blocked') {
    return {
      status: 'excluded',
      drillId: payload.meta.drillId,
      contactArtifact,
      reasons: contactArtifact.reasons,
    };
  }

  const pureSummary = summarizeTrackingContactSamples(contactArtifact.samples);
  return {
    status: 'included',
    drillId: payload.meta.drillId,
    contactArtifact,
    pureSummary,
    ...(isBrTrackingDrill(payload.meta.drillId)
      ? { brCompanion: summarizeBrCompanion(payload, contactArtifact.samples) }
      : {}),
  };
}

function summarizePresentations(samples: readonly TrackingContactSample[]): TrackingContactPresentationSummary[] {
  const byPresentation = new Map<number, TrackingContactSample[]>();
  for (const sample of samples) {
    const group = byPresentation.get(sample.presentationIndex);
    if (group !== undefined) group.push(sample);
    else byPresentation.set(sample.presentationIndex, [sample]);
  }

  return [...byPresentation.entries()]
    .sort(([a], [b]) => a - b)
    .map(([presentationIndex, group]) => summarizePresentation(presentationIndex, group));
}

function summarizePresentation(
  presentationIndex: number,
  samples: readonly TrackingContactSample[],
): TrackingContactPresentationSummary {
  const sorted = samples.slice().sort((a, b) => a.t - b.t);
  const first = sorted.find((sample) => sample.onTarget);
  if (first === undefined) {
    return {
      presentationIndex,
      targetId: sorted[0]?.targetId ?? '',
      sampleCount: sorted.length,
      acquisitionFailure: true,
    };
  }

  const windowSamples = sorted.filter((sample) => sample.trackingWindow === 'pursuit');
  const onTargetTickCount = windowSamples.filter((sample) => sample.onTarget).length;
  const epsilons = windowSamples.map((sample) => sample.epsilonDeg);

  return {
    presentationIndex,
    targetId: first.targetId,
    sampleCount: sorted.length,
    acquisitionFailure: false,
    tFirstOnTargetMs: first.t,
    tAcquireMs: first.t - sorted[0].t,
    trackingWindowSampleCount: windowSamples.length,
    onTargetTickCount,
    totPercent: windowSamples.length > 0 ? (onTargetTickCount / windowSamples.length) * 100 : 0,
    rmsEpsilonDeg: rms(epsilons),
    medianEpsilonDeg: percentile(epsilons, 50),
    p95EpsilonDeg: percentile(epsilons, 95),
  };
}

function summarizeBrCompanion(
  payload: ExportPayload,
  samples: readonly TrackingContactSample[],
): TrackingContactBrCompanion {
  const adsEvents = payload.events.filter((event) => event.type === 'ads');
  const fireEvents = payload.events.filter((event) => event.type === 'fire');
  const projectileHits = payload.events.filter((event) => event.type === 'hit');
  const onTargetSampleCount = samples.filter((sample) => sample.onTarget).length;

  return {
    ads: {
      tickCount: payload.ticks.filter((tick) => tick.ads === true).length,
      eventCount: adsEvents.length,
      downEventCount: adsEvents.filter((event) => event.down).length,
    },
    aimRay: {
      sampleCount: samples.length,
      onTargetSampleCount,
      onTargetRate: samples.length > 0 ? onTargetSampleCount / samples.length : 0,
    },
    ballistic: {
      fireEventCount: fireEvents.length,
      hitscanFireHitCount: fireEvents.filter((event) => event.hit).length,
      projectileHitEventCount: projectileHits.length,
      weaponBulletModel: payload.meta.weapon?.bullet?.model === 'projectile' ? 'projectile' : 'none',
    },
  };
}

function countExclusionReasons(
  runs: readonly Extract<TrackingContactCoverageRun, { status: 'excluded' }>[],
): Partial<Record<TrackingContactBlockedReason, number>> {
  const counts: Partial<Record<TrackingContactBlockedReason, number>> = {};
  for (const run of runs) {
    for (const reason of run.reasons) counts[reason] = (counts[reason] ?? 0) + 1;
  }
  return counts;
}

function isBrTrackingDrill(drillId: string): boolean {
  return drillId === 'tracking_br_v1' || drillId.startsWith('tracking_br_v1__');
}

function rms(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const w = rank - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}
