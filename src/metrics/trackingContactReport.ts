import type { ReplayContactTrace } from '../replay/replayContact.ts';
import type { TrackingContactArtifact } from './trackingContactArtifact.ts';
import type { TrackingContactBlockedReason, TrackingContactSample } from './trackingContact.ts';
import type {
  TrackingContactBrCompanion,
  TrackingContactCoverageReport,
  TrackingContactCoverageRun,
  TrackingContactPresentationSummary,
  TrackingContactPureSummary,
} from './trackingContactCoverage.ts';

export const TRACKING_CONTACT_REPORT_SCHEMA_VERSION = 'tracking-contact-report-v1' as const;

export type TrackingContactReportMetricUnit = 'count' | 'ms' | 'percent' | 'ratio' | 'deg';

export interface TrackingContactReportMetric {
  readonly value: number;
  readonly unit: TrackingContactReportMetricUnit;
  readonly n: number;
  readonly durationMs: number;
  readonly condition: string;
  readonly drillId: string;
  readonly analysisVersion: string;
  readonly sourceId: string | null;
  readonly sourceRunId?: string;
  readonly exportBasename?: string;
}

export interface TrackingContactReportIdentity {
  readonly condition: string;
  readonly drillId: string;
  readonly analysisVersion: string;
  readonly sourceId: string | null;
  readonly sourceIdKind?: 'sourceRunId' | 'exportBasename';
  readonly sourceRunId?: string;
  readonly exportBasename?: string;
}

export interface TrackingContactReportPresentation {
  readonly presentationIndex: number;
  readonly targetId: string;
  readonly acquisitionFailure: boolean;
  readonly sampleCount: TrackingContactReportMetric;
  readonly tFirstOnTargetMs?: TrackingContactReportMetric;
  readonly tAcquireMs?: TrackingContactReportMetric;
  readonly trackingWindowSampleCount?: TrackingContactReportMetric;
  readonly onTargetTickCount?: TrackingContactReportMetric;
  readonly totPercent?: TrackingContactReportMetric;
  readonly rmsEpsilonDeg?: TrackingContactReportMetric;
  readonly medianEpsilonDeg?: TrackingContactReportMetric;
  readonly p95EpsilonDeg?: TrackingContactReportMetric;
}

export interface TrackingContactReportPureSummary {
  readonly presentationCount: TrackingContactReportMetric;
  readonly sampleCount: TrackingContactReportMetric;
  readonly acquisitionFailureCount: TrackingContactReportMetric;
  readonly acquisitionFailureRate: TrackingContactReportMetric;
  readonly trackingWindowSampleCount: TrackingContactReportMetric;
  readonly onTargetTickCount: TrackingContactReportMetric;
  readonly totPercent?: TrackingContactReportMetric;
  readonly rmsEpsilonDeg?: TrackingContactReportMetric;
  readonly medianEpsilonDeg?: TrackingContactReportMetric;
  readonly p95EpsilonDeg?: TrackingContactReportMetric;
  readonly presentations: readonly TrackingContactReportPresentation[];
}

export interface TrackingContactTimelinePoint {
  readonly t: number;
  readonly targetId: string;
  readonly onTarget: boolean;
  readonly epsilonDeg: number;
  readonly trackingWindow: string;
}

export interface TrackingContactReportTimeline {
  readonly source: 'tracking-contact-artifact.samples';
  readonly n: number;
  readonly durationMs: number;
  readonly condition: string;
  readonly drillId: string;
  readonly analysisVersion: string;
  readonly sourceId: string;
  readonly samples: readonly TrackingContactTimelinePoint[];
}

export interface TrackingContactReportBrCompanion {
  readonly interpretation: 'companion-only-not-pure-tracking';
  readonly adsTickCount: TrackingContactReportMetric;
  readonly adsEventCount: TrackingContactReportMetric;
  readonly adsDownEventCount: TrackingContactReportMetric;
  readonly aimRayOnTargetSampleCount: TrackingContactReportMetric;
  readonly aimRayOnTargetRate: TrackingContactReportMetric;
  readonly ballisticFireEventCount: TrackingContactReportMetric;
  readonly ballisticHitscanFireHitCount: TrackingContactReportMetric;
  readonly ballisticProjectileHitEventCount: TrackingContactReportMetric;
  readonly weaponBulletModel: 'projectile' | 'none';
}

export type TrackingContactReportRun =
  | (TrackingContactReportIdentity & {
      readonly status: 'included';
      readonly summary: TrackingContactReportPureSummary;
      readonly timeline: TrackingContactReportTimeline;
      readonly replayTraceFrameCount?: TrackingContactReportMetric;
      readonly brCompanion?: TrackingContactReportBrCompanion;
    })
  | (TrackingContactReportIdentity & {
      readonly status: 'blocked';
      readonly reasons: readonly TrackingContactBlockedReason[];
      readonly blocked: {
        readonly vocabulary: 'tracking-contact-blocked-reason-v1';
        readonly reasons: readonly TrackingContactBlockedReason[];
      };
    });

export interface TrackingContactReportConditionAggregate {
  readonly condition: string;
  readonly drillId: string;
  readonly includedRunCount: number;
  readonly excludedRunCount: number;
  readonly sourceIds: readonly string[];
  readonly excludedSourceIds: readonly (string | null)[];
}

export interface TrackingContactReportArtifact {
  readonly reportSchemaVersion: typeof TRACKING_CONTACT_REPORT_SCHEMA_VERSION;
  readonly generatedFrom: 'tracking-contact-coverage';
  readonly runCount: number;
  readonly includedRunCount: number;
  readonly excludedRunCount: number;
  readonly exclusionReasonCounts: Readonly<Partial<Record<TrackingContactBlockedReason, number>>>;
  readonly aggregate: {
    readonly conditions: readonly TrackingContactReportConditionAggregate[];
  };
  readonly runs: readonly TrackingContactReportRun[];
}

export interface TrackingContactReportOptions {
  readonly replayTraces?: readonly ReplayContactTrace[];
}

export function buildTrackingContactReport(
  coverage: TrackingContactCoverageReport,
  options: TrackingContactReportOptions = {},
): TrackingContactReportArtifact {
  const runs = coverage.runs.map((run) => projectRun(run, options.replayTraces ?? []));
  return {
    reportSchemaVersion: TRACKING_CONTACT_REPORT_SCHEMA_VERSION,
    generatedFrom: 'tracking-contact-coverage',
    runCount: coverage.runCount,
    includedRunCount: coverage.includedRunCount,
    excludedRunCount: coverage.excludedRunCount,
    exclusionReasonCounts: coverage.exclusionReasonCounts,
    aggregate: { conditions: conditionAggregates(runs) },
    runs,
  };
}

export function serializeTrackingContactReport(report: TrackingContactReportArtifact): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function renderTrackingContactReportHtml(report: TrackingContactReportArtifact): string {
  const embeddedJson = JSON.stringify(report).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>WP-55 Tracking Contact Report</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div id="app">Loading...</div>
<script type="application/json" id="tracking-contact-report-data">${embeddedJson}</script>
<script>${REPORT_SCRIPT}</script>
</body>
</html>
`;
}

function projectRun(run: TrackingContactCoverageRun, replayTraces: readonly ReplayContactTrace[]): TrackingContactReportRun {
  const identity = identityForArtifact(run.contactArtifact);
  if (run.status === 'excluded') {
    return {
      ...identity,
      status: 'blocked',
      reasons: run.reasons,
      blocked: { vocabulary: 'tracking-contact-blocked-reason-v1', reasons: run.reasons },
    };
  }

  const durationMs = durationOfSamples(run.contactArtifact.samples);
  const replayTrace = replayTraces.find((trace) => trace.contactArtifact.sourceId === run.contactArtifact.sourceId);
  return {
    ...identity,
    status: 'included',
    summary: projectPureSummary(run.pureSummary, run.contactArtifact, durationMs),
    timeline: {
      source: 'tracking-contact-artifact.samples',
      n: run.contactArtifact.samples.length,
      durationMs,
      condition: identity.condition,
      drillId: identity.drillId,
      analysisVersion: identity.analysisVersion,
      sourceId: run.contactArtifact.sourceId,
      samples: run.contactArtifact.samples.map((sample) => ({
        t: sample.t,
        targetId: sample.targetId,
        onTarget: sample.onTarget,
        epsilonDeg: sample.epsilonDeg,
        trackingWindow: sample.trackingWindow,
      })),
    },
    ...(replayTrace !== undefined
      ? {
          replayTraceFrameCount: metric(
            replayTrace.frames.length,
            'count',
            replayTrace.frames.length,
            durationMs,
            identity,
          ),
        }
      : {}),
    ...(run.brCompanion !== undefined ? { brCompanion: projectBrCompanion(run.brCompanion, run.contactArtifact, identity, durationMs) } : {}),
  };
}

function projectPureSummary(
  summary: TrackingContactPureSummary,
  artifact: Extract<TrackingContactArtifact, { status: 'ok' }>,
  durationMs: number,
): TrackingContactReportPureSummary {
  const identity = identityForArtifact(artifact);
  const pursuitDurationMs = durationOfSamples(artifact.samples.filter((sample) => sample.trackingWindow === 'pursuit'));
  return {
    presentationCount: metric(summary.presentationCount, 'count', summary.presentationCount, durationMs, identity),
    sampleCount: metric(summary.sampleCount, 'count', summary.sampleCount, durationMs, identity),
    acquisitionFailureCount: metric(summary.acquisitionFailureCount, 'count', summary.presentationCount, durationMs, identity),
    acquisitionFailureRate: metric(summary.acquisitionFailureRate, 'ratio', summary.presentationCount, durationMs, identity),
    trackingWindowSampleCount: metric(summary.trackingWindowSampleCount, 'count', summary.trackingWindowSampleCount, pursuitDurationMs, identity),
    onTargetTickCount: metric(summary.onTargetTickCount, 'count', summary.trackingWindowSampleCount, pursuitDurationMs, identity),
    ...(summary.totPercent !== undefined
      ? { totPercent: metric(summary.totPercent, 'percent', summary.trackingWindowSampleCount, pursuitDurationMs, identity) }
      : {}),
    ...(summary.rmsEpsilonDeg !== undefined
      ? { rmsEpsilonDeg: metric(summary.rmsEpsilonDeg, 'deg', summary.trackingWindowSampleCount, pursuitDurationMs, identity) }
      : {}),
    ...(summary.medianEpsilonDeg !== undefined
      ? { medianEpsilonDeg: metric(summary.medianEpsilonDeg, 'deg', summary.trackingWindowSampleCount, pursuitDurationMs, identity) }
      : {}),
    ...(summary.p95EpsilonDeg !== undefined
      ? { p95EpsilonDeg: metric(summary.p95EpsilonDeg, 'deg', summary.trackingWindowSampleCount, pursuitDurationMs, identity) }
      : {}),
    presentations: summary.presentations.map((presentation) => projectPresentation(presentation, artifact, identity)),
  };
}

function projectPresentation(
  presentation: TrackingContactPresentationSummary,
  artifact: Extract<TrackingContactArtifact, { status: 'ok' }>,
  identity: TrackingContactReportIdentity,
): TrackingContactReportPresentation {
  const samples = artifact.samples.filter((sample) => sample.presentationIndex === presentation.presentationIndex);
  const durationMs = durationOfSamples(samples);
  const pursuitDurationMs = durationOfSamples(samples.filter((sample) => sample.trackingWindow === 'pursuit'));
  return {
    presentationIndex: presentation.presentationIndex,
    targetId: presentation.targetId,
    acquisitionFailure: presentation.acquisitionFailure,
    sampleCount: metric(presentation.sampleCount, 'count', presentation.sampleCount, durationMs, identity),
    ...(presentation.tFirstOnTargetMs !== undefined
      ? { tFirstOnTargetMs: metric(presentation.tFirstOnTargetMs, 'ms', presentation.sampleCount, durationMs, identity) }
      : {}),
    ...(presentation.tAcquireMs !== undefined
      ? { tAcquireMs: metric(presentation.tAcquireMs, 'ms', presentation.sampleCount, durationMs, identity) }
      : {}),
    ...(presentation.trackingWindowSampleCount !== undefined
      ? { trackingWindowSampleCount: metric(presentation.trackingWindowSampleCount, 'count', presentation.trackingWindowSampleCount, pursuitDurationMs, identity) }
      : {}),
    ...(presentation.onTargetTickCount !== undefined
      ? { onTargetTickCount: metric(presentation.onTargetTickCount, 'count', presentation.trackingWindowSampleCount ?? 0, pursuitDurationMs, identity) }
      : {}),
    ...(presentation.totPercent !== undefined
      ? { totPercent: metric(presentation.totPercent, 'percent', presentation.trackingWindowSampleCount ?? 0, pursuitDurationMs, identity) }
      : {}),
    ...(presentation.rmsEpsilonDeg !== undefined
      ? { rmsEpsilonDeg: metric(presentation.rmsEpsilonDeg, 'deg', presentation.trackingWindowSampleCount ?? 0, pursuitDurationMs, identity) }
      : {}),
    ...(presentation.medianEpsilonDeg !== undefined
      ? { medianEpsilonDeg: metric(presentation.medianEpsilonDeg, 'deg', presentation.trackingWindowSampleCount ?? 0, pursuitDurationMs, identity) }
      : {}),
    ...(presentation.p95EpsilonDeg !== undefined
      ? { p95EpsilonDeg: metric(presentation.p95EpsilonDeg, 'deg', presentation.trackingWindowSampleCount ?? 0, pursuitDurationMs, identity) }
      : {}),
  };
}

function projectBrCompanion(
  companion: TrackingContactBrCompanion,
  artifact: Extract<TrackingContactArtifact, { status: 'ok' }>,
  identity: TrackingContactReportIdentity,
  durationMs: number,
): TrackingContactReportBrCompanion {
  return {
    interpretation: 'companion-only-not-pure-tracking',
    adsTickCount: metric(companion.ads.tickCount, 'count', artifact.samples.length, durationMs, identity),
    adsEventCount: metric(companion.ads.eventCount, 'count', companion.ads.eventCount, durationMs, identity),
    adsDownEventCount: metric(companion.ads.downEventCount, 'count', companion.ads.eventCount, durationMs, identity),
    aimRayOnTargetSampleCount: metric(companion.aimRay.onTargetSampleCount, 'count', companion.aimRay.sampleCount, durationMs, identity),
    aimRayOnTargetRate: metric(companion.aimRay.onTargetRate, 'ratio', companion.aimRay.sampleCount, durationMs, identity),
    ballisticFireEventCount: metric(companion.ballistic.fireEventCount, 'count', companion.ballistic.fireEventCount, durationMs, identity),
    ballisticHitscanFireHitCount: metric(companion.ballistic.hitscanFireHitCount, 'count', companion.ballistic.fireEventCount, durationMs, identity),
    ballisticProjectileHitEventCount: metric(companion.ballistic.projectileHitEventCount, 'count', companion.ballistic.projectileHitEventCount, durationMs, identity),
    weaponBulletModel: companion.ballistic.weaponBulletModel,
  };
}

function metric(
  value: number,
  unit: TrackingContactReportMetricUnit,
  n: number,
  durationMs: number,
  identity: TrackingContactReportIdentity,
): TrackingContactReportMetric {
  return {
    value,
    unit,
    n,
    durationMs,
    condition: identity.condition,
    drillId: identity.drillId,
    analysisVersion: identity.analysisVersion,
    sourceId: identity.sourceId,
    ...(identity.sourceRunId !== undefined ? { sourceRunId: identity.sourceRunId } : {}),
    ...(identity.exportBasename !== undefined ? { exportBasename: identity.exportBasename } : {}),
  };
}

function identityForArtifact(artifact: TrackingContactArtifact): TrackingContactReportIdentity {
  return {
    condition: artifact.drillId,
    drillId: artifact.drillId,
    analysisVersion: artifact.analysisVersion,
    sourceId: artifact.sourceId ?? null,
    ...(artifact.sourceIdKind !== undefined ? { sourceIdKind: artifact.sourceIdKind } : {}),
    ...(artifact.sourceRunId !== undefined ? { sourceRunId: artifact.sourceRunId } : {}),
    ...(artifact.exportBasename !== undefined ? { exportBasename: artifact.exportBasename } : {}),
  };
}

function durationOfSamples(samples: readonly TrackingContactSample[]): number {
  if (samples.length < 2) return 0;
  const first = samples[0].t;
  const last = samples[samples.length - 1].t;
  return Math.max(0, last - first);
}

function conditionAggregates(runs: readonly TrackingContactReportRun[]): TrackingContactReportConditionAggregate[] {
  const byCondition = new Map<string, { drillId: string; sourceIds: string[]; excludedSourceIds: Array<string | null> }>();
  for (const run of runs) {
    const group = byCondition.get(run.condition) ?? { drillId: run.drillId, sourceIds: [], excludedSourceIds: [] };
    if (run.status === 'included') {
      if (run.sourceId !== null) group.sourceIds.push(run.sourceId);
    } else {
      group.excludedSourceIds.push(run.sourceId);
    }
    byCondition.set(run.condition, group);
  }
  return [...byCondition.entries()]
    .map(([condition, group]) => ({
      condition,
      drillId: group.drillId,
      includedRunCount: group.sourceIds.length,
      excludedRunCount: group.excludedSourceIds.length,
      sourceIds: group.sourceIds,
      excludedSourceIds: group.excludedSourceIds,
    }))
    .sort((a, b) => a.condition.localeCompare(b.condition));
}

const REPORT_CSS = `
:root { color-scheme: light dark; }
body { margin: 0; padding: 24px; font: 14px/1.5 -apple-system, Segoe UI, system-ui, sans-serif; }
h1 { font-size: 20px; margin: 0 0 4px; }
h2 { font-size: 16px; margin: 24px 0 8px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
th, td { border: 1px solid #8884; padding: 4px 8px; text-align: left; font-size: 12px; vertical-align: top; }
th { background: #8882; }
.meta { color: #666; font-size: 12px; margin-bottom: 16px; }
.blocked { color: #b3261e; font-weight: 700; }
.companion { color: #5f4b00; font-weight: 700; }
.mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11px; }
`;

const REPORT_SCRIPT = `
(function () {
  var report = JSON.parse(document.getElementById('tracking-contact-report-data').textContent);
  var app = document.getElementById('app');
  app.textContent = '';

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var key in attrs) {
        if (key === 'class') node.className = attrs[key];
        else node.setAttribute(key, attrs[key]);
      }
    }
    (children || []).forEach(function (child) {
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function fmt(metric, digits) {
    if (!metric) return 'n/a';
    var value = typeof metric.value === 'number' ? metric.value.toFixed(digits === undefined ? 3 : digits) : String(metric.value);
    return value + ' ' + metric.unit + ' (n=' + metric.n + ', duration=' + metric.durationMs.toFixed(0) +
      'ms, condition=' + metric.condition + ', drill=' + metric.drillId + ', version=' + metric.analysisVersion +
      ', source=' + (metric.sourceId || 'n/a') + ')';
  }

  app.appendChild(el('h1', {}, ['WP-55 Tracking Contact Report']));
  app.appendChild(el('p', { class: 'meta' }, [
    'reportSchemaVersion=' + report.reportSchemaVersion + '  runs=' + report.runCount +
      '  included=' + report.includedRunCount + '  excluded=' + report.excludedRunCount,
  ]));

  var aggregate = el('table', {}, [
    el('tr', {}, [el('th', {}, ['condition']), el('th', {}, ['included']), el('th', {}, ['excluded']), el('th', {}, ['source ids'])]),
  ]);
  report.aggregate.conditions.forEach(function (condition) {
    aggregate.appendChild(el('tr', {}, [
      el('td', {}, [condition.condition]),
      el('td', {}, [String(condition.includedRunCount)]),
      el('td', {}, [String(condition.excludedRunCount)]),
      el('td', { class: 'mono' }, [condition.sourceIds.join(', ') || 'n/a']),
    ]));
  });
  app.appendChild(aggregate);

  report.runs.forEach(function (run) {
    app.appendChild(el('h2', {}, [run.condition + ' / ' + (run.sourceId || 'unidentified source')]));
    if (run.status === 'blocked') {
      app.appendChild(el('p', { class: 'blocked' }, ['blocked: ' + run.reasons.join(', ')]));
      return;
    }
    app.appendChild(el('p', {}, ['acquisition: ', fmt(run.summary.acquisitionFailureRate)]));
    app.appendChild(el('p', {}, ['pursuit TOT: ', fmt(run.summary.totPercent, 1)]));
    app.appendChild(el('p', {}, ['RMS epsilon: ', fmt(run.summary.rmsEpsilonDeg)]));
    app.appendChild(el('p', {}, ['median epsilon: ', fmt(run.summary.medianEpsilonDeg)]));
    app.appendChild(el('p', {}, ['P95 epsilon: ', fmt(run.summary.p95EpsilonDeg)]));
    app.appendChild(el('p', {}, ['contact timeline rows: ' + run.timeline.n + ' from ' + run.timeline.source]));
    if (run.brCompanion) {
      app.appendChild(el('p', { class: 'companion' }, [
        'BR companion only: aim-ray on-target=' + fmt(run.brCompanion.aimRayOnTargetRate) +
          ' ballistic hitscan hits=' + fmt(run.brCompanion.ballisticHitscanFireHitCount) +
          ' projectile hits=' + fmt(run.brCompanion.ballisticProjectileHitEventCount),
      ]));
    }
  });
})();
`;
