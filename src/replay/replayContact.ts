import type { TrackingContactArtifact } from '../metrics/trackingContactArtifact.ts';
import type { TrackingContactBlockedReason, TrackingContactSample, TrackingWindow } from '../metrics/trackingContact.ts';

export const REPLAY_CONTACT_TRACE_SCHEMA_VERSION = 'replay-contact-trace-v1' as const;

export type ReplayContactUnavailableReason =
  | 'empty-samples'
  | 'before-first-sample'
  | 'missing-sample'
  | 'blocked-artifact';

export type ReplayContactFrame =
  | {
      readonly status: 'available';
      readonly replayTimeMs: number;
      readonly sampleIndex: number;
      readonly t: number;
      readonly targetId: string;
      readonly target: { readonly x: number; readonly y: number; readonly z: number };
      readonly aim: { readonly yaw: number; readonly pitch: number };
      readonly onTarget: boolean;
      readonly epsilonDeg: number;
      readonly presentationIndex: number;
      readonly trackingWindow: TrackingWindow;
    }
  | {
      readonly status: 'unavailable';
      readonly replayTimeMs: number;
      readonly sampleIndex: null;
      readonly t: null;
      readonly targetId: null;
      readonly target: null;
      readonly aim: null;
      readonly onTarget: null;
      readonly epsilonDeg: null;
      readonly presentationIndex: null;
      readonly trackingWindow: null;
      readonly reason: ReplayContactUnavailableReason;
      readonly reasons?: readonly TrackingContactBlockedReason[];
    };

export interface ReplayContactTraceOptions {
  readonly replayTimesMs?: readonly number[];
}

export interface ReplayContactTrace {
  readonly traceSchemaVersion: typeof REPLAY_CONTACT_TRACE_SCHEMA_VERSION;
  readonly generatedFrom: 'tracking-contact-artifact';
  readonly contactArtifact: TrackingContactArtifact;
  readonly frames: readonly ReplayContactFrame[];
}

const EPSILON = 1e-9;

export function sampleReplayContact(samples: readonly TrackingContactSample[], replayTimeMs: number): ReplayContactFrame {
  const ordered = samples.slice().sort((a, b) => a.t - b.t || a.presentationIndex - b.presentationIndex);
  if (ordered.length === 0) return unavailable(replayTimeMs, 'empty-samples');
  if (replayTimeMs + EPSILON < ordered[0].t) return unavailable(replayTimeMs, 'before-first-sample');

  const sampleIndex = lowerBoundIndex(ordered, replayTimeMs);
  const sample = ordered[sampleIndex];
  const next = ordered[sampleIndex + 1];
  if (
    next !== undefined &&
    replayTimeMs > sample.t + EPSILON &&
    replayTimeMs < next.t - EPSILON &&
    (sample.presentationIndex !== next.presentationIndex || sample.targetId !== next.targetId)
  ) {
    return unavailable(replayTimeMs, 'missing-sample');
  }

  return {
    status: 'available',
    replayTimeMs,
    sampleIndex,
    t: sample.t,
    targetId: sample.targetId,
    target: sample.target,
    aim: sample.aim,
    onTarget: sample.onTarget,
    epsilonDeg: sample.epsilonDeg,
    presentationIndex: sample.presentationIndex,
    trackingWindow: sample.trackingWindow,
  };
}

export function sampleReplayContactArtifact(artifact: TrackingContactArtifact, replayTimeMs: number): ReplayContactFrame {
  if (artifact.status === 'blocked') {
    return {
      ...unavailable(replayTimeMs, 'blocked-artifact'),
      reasons: artifact.reasons,
    };
  }
  return sampleReplayContact(artifact.samples, replayTimeMs);
}

export function buildReplayContactTrace(
  artifact: TrackingContactArtifact,
  options: ReplayContactTraceOptions = {},
): ReplayContactTrace {
  const replayTimesMs = options.replayTimesMs ?? (artifact.status === 'ok' ? artifact.samples.map((sample) => sample.t) : [0]);
  return {
    traceSchemaVersion: REPLAY_CONTACT_TRACE_SCHEMA_VERSION,
    generatedFrom: 'tracking-contact-artifact',
    contactArtifact: artifact,
    frames: replayTimesMs.map((timeMs) => sampleReplayContactArtifact(artifact, timeMs)),
  };
}

export function renderReplayContactTraceHtml(
  artifact: TrackingContactArtifact,
  options: ReplayContactTraceOptions = {},
): string {
  const embeddedJson = JSON.stringify(buildReplayContactTrace(artifact, options)).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>WP-55 Replay Contact Trace</title>
<style>${TRACE_CSS}</style>
</head>
<body>
<div id="app">Loading...</div>
<script type="application/json" id="replay-contact-trace-data">${embeddedJson}</script>
<script>${TRACE_SCRIPT}</script>
</body>
</html>
`;
}

function lowerBoundIndex(samples: readonly TrackingContactSample[], t: number): number {
  let lo = 0;
  let hi = samples.length - 1;
  if (t <= samples[0].t) return 0;
  if (t >= samples[hi].t) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (samples[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function unavailable(replayTimeMs: number, reason: ReplayContactUnavailableReason): Extract<ReplayContactFrame, { status: 'unavailable' }> {
  return {
    status: 'unavailable',
    replayTimeMs,
    sampleIndex: null,
    t: null,
    targetId: null,
    target: null,
    aim: null,
    onTarget: null,
    epsilonDeg: null,
    presentationIndex: null,
    trackingWindow: null,
    reason,
  };
}

const TRACE_CSS = `
:root { color-scheme: light dark; }
body { margin: 0; padding: 24px; font: 14px/1.5 -apple-system, Segoe UI, system-ui, sans-serif; }
h1 { font-size: 20px; margin: 0 0 4px; }
.meta { color: #666; font-size: 12px; margin-bottom: 16px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #8884; padding: 4px 8px; text-align: left; font-size: 12px; vertical-align: top; }
th { background: #8882; }
.state-on { color: #1a7f37; font-weight: 700; }
.state-off { color: #8a5a00; font-weight: 700; }
.state-unavailable { color: #b3261e; font-weight: 700; }
.mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11px; }
`;

const TRACE_SCRIPT = `
(function () {
  var trace = JSON.parse(document.getElementById('replay-contact-trace-data').textContent);
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

  function fmt(value, digits) {
    if (value === undefined || value === null) return 'n/a';
    if (typeof value !== 'number') return String(value);
    return value.toFixed(digits === undefined ? 3 : digits);
  }

  function vec3(value) {
    if (value === null) return 'n/a';
    return fmt(value.x) + ', ' + fmt(value.y) + ', ' + fmt(value.z);
  }

  function aim(value) {
    if (value === null) return 'n/a';
    return 'yaw=' + fmt(value.yaw, 6) + ' pitch=' + fmt(value.pitch, 6);
  }

  function stateNode(frame) {
    if (frame.status === 'unavailable') {
      var reasons = frame.reasons ? ' (' + frame.reasons.join(', ') + ')' : '';
      return el('span', { class: 'state-unavailable' }, ['unavailable: ' + frame.reason + reasons]);
    }
    return frame.onTarget
      ? el('span', { class: 'state-on' }, ['on-target'])
      : el('span', { class: 'state-off' }, ['off-target']);
  }

  app.appendChild(el('h1', {}, ['WP-55 Replay Contact Trace']));
  app.appendChild(
    el('p', { class: 'meta' }, [
      'traceSchemaVersion=' + trace.traceSchemaVersion +
        '  artifactStatus=' + trace.contactArtifact.status +
        '  drillId=' + trace.contactArtifact.drillId,
    ]),
  );

  var table = el('table', {}, [
    el('tr', {}, [
      el('th', {}, ['replay time (ms)']),
      el('th', {}, ['sample t (ms)']),
      el('th', {}, ['target id']),
      el('th', {}, ['target center']),
      el('th', {}, ['aim']),
      el('th', {}, ['contact state']),
      el('th', {}, ['epsilon deg']),
      el('th', {}, ['window']),
    ]),
  ]);

  trace.frames.forEach(function (frame) {
    table.appendChild(
      el('tr', {}, [
        el('td', { class: 'mono' }, [fmt(frame.replayTimeMs)]),
        el('td', { class: 'mono' }, [fmt(frame.t)]),
        el('td', { class: 'mono' }, [frame.targetId || 'n/a']),
        el('td', { class: 'mono' }, [vec3(frame.target)]),
        el('td', { class: 'mono' }, [aim(frame.aim)]),
        el('td', {}, [stateNode(frame)]),
        el('td', { class: 'mono' }, [fmt(frame.epsilonDeg)]),
        el('td', { class: 'mono' }, [frame.trackingWindow || 'n/a']),
      ]),
    );
  });
  app.appendChild(table);
})();
`;
