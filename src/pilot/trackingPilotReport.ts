import type { TrackingPilotEvidence } from './trackingPilotEvidence.ts';

/**
 * trackingPilotReport — WP-54 / T4 (checklist "self-contained HTML report", no prior precedent in
 * this repo — new design, see `docs/operational/analysis-tracking.md`).
 *
 * `renderTrackingPilotReportHtml()` is a pure function: given a `TrackingPilotEvidence`, it returns
 * one self-contained HTML document (inline CSS, inline vanilla JS, no external script/stylesheet
 * requests) that a researcher can open directly from disk.
 *
 * **Parity-by-construction, not parity-by-comparison**: the canonical `evidence` object is
 * serialized verbatim into a `<script type="application/json" id="evidence-data">` block; every
 * number the page displays is read back out of that same embedded JSON by the page's own render
 * script — nothing is recomputed. A JSON/HTML numeric-parity test therefore only needs to extract
 * that script's text, `JSON.parse` it, and deep-equal it against the original `evidence` argument;
 * it never has to scrape rendered DOM text or re-derive a number to compare against.
 */

export function renderTrackingPilotReportHtml(evidence: TrackingPilotEvidence): string {
  const embeddedJson = JSON.stringify(evidence).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>WP-54 Tracking Pilot Evidence Report</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div id="app">Loading…</div>
<script type="application/json" id="evidence-data">${embeddedJson}</script>
<script>${REPORT_SCRIPT}</script>
</body>
</html>
`;
}

const REPORT_CSS = `
:root { color-scheme: light dark; }
body { margin: 0; padding: 24px; font: 14px/1.5 -apple-system, Segoe UI, system-ui, sans-serif; }
h1 { font-size: 20px; margin: 0 0 4px; }
h2 { font-size: 16px; margin: 28px 0 8px; }
.meta { color: #666; font-size: 12px; margin-bottom: 16px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
th, td { border: 1px solid #8884; padding: 4px 8px; text-align: left; font-size: 12px; vertical-align: top; }
th { background: #8882; }
.status-eligible { color: #1a7f37; font-weight: 600; }
.status-blocked { color: #b3261e; font-weight: 600; }
.reasons { font-family: ui-monospace, monospace; font-size: 11px; }
.run-block { border: 1px solid #8884; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; }
.run-block h3 { font-size: 13px; margin: 0 0 6px; }
.trace-svg { display: block; background: #8881; }
.no-trace { color: #888; font-style: italic; font-size: 12px; }
`;

/**
 * Vanilla JS (no bundler, no external deps — offline self-contained file). Reads the embedded
 * `#evidence-data` JSON and renders every section from it directly; never displays `0` for a
 * blocked/undefined metric — always the reason string or an explicit "n/a" placeholder instead.
 */
const REPORT_SCRIPT = `
(function () {
  var evidence = JSON.parse(document.getElementById('evidence-data').textContent);
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

  function qualityNode(quality) {
    if (quality.status === 'eligible') {
      return el('span', { class: 'status-eligible' }, [
        'eligible (n=' + quality.validScoredTicks + ', ' + fmt(quality.durationMs, 0) + 'ms)',
      ]);
    }
    return el('span', { class: 'status-blocked' }, [
      'blocked: ',
      el('span', { class: 'reasons' }, [quality.reasons.join(', ')]),
    ]);
  }

  function p0Node(p0) {
    if (p0 === undefined) return el('span', {}, ['n/a']);
    if (p0.acquisitionFailure) return el('span', { class: 'status-blocked' }, ['acquisition failure']);
    return el('span', {}, [
      'RMS(\\u03b5)=' + fmt(p0.rmsEpsilonDeg) + 'deg  TOT=' + fmt(p0.totPercent, 1) +
        '%  tAcquire=' + fmt(p0.tAcquireMs, 0) + 'ms',
    ]);
  }

  function p1Node(p1) {
    if (p1 === undefined) return el('span', {}, ['n/a']);
    if (p1.status === 'blocked') return el('span', { class: 'status-blocked' }, ['blocked: ' + p1.reason]);
    return el('span', {}, [
      'lag=' + fmt(p1.lagMs, 1) + 'ms  gain=' + fmt(p1.velocityGain) +
        '  drop/s=' + fmt(p1.dropRatePerSec) + '  reacquired=' + p1.completedReacquireCount +
        '  terminalDrops=' + p1.terminalDropCount + '  longestOffTarget=' + fmt(p1.longestOffTargetMs, 0) + 'ms',
    ]);
  }

  function traceNode(trace) {
    if (trace === undefined || trace.length === 0) return el('p', { class: 'no-trace' }, ['no trace recorded']);
    var width = 480;
    var height = 120;
    var maxT = trace[trace.length - 1].t - trace[0].t;
    var maxEps = trace.reduce(function (m, s) { return Math.max(m, s.epsilonDeg); }, 0.001);
    var points = trace
      .map(function (s) {
        var x = maxT > 0 ? ((s.t - trace[0].t) / maxT) * width : 0;
        var y = height - (s.epsilonDeg / maxEps) * height;
        return x.toFixed(1) + ',' + y.toFixed(1);
      })
      .join(' ');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'trace-svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    var polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', 'currentColor');
    polyline.setAttribute('stroke-width', '1');
    svg.appendChild(polyline);
    return svg;
  }

  app.appendChild(el('h1', {}, ['WP-54 Tracking Pilot Evidence Report']));
  app.appendChild(
    el('p', { class: 'meta' }, [
      'metricVersion=' + evidence.metricVersion + '  protocolVersion=' + evidence.protocolVersion +
        (evidence.analysisCommit ? '  analysisCommit=' + evidence.analysisCommit : ''),
    ]),
  );

  app.appendChild(el('h2', {}, ['Condition matrix']));
  var matrix = el('table', {}, [
    el('tr', {}, [
      el('th', {}, ['condition']),
      el('th', {}, ['runs']),
      el('th', {}, ['eligible']),
      el('th', {}, ['total scored duration (ms)']),
      el('th', {}, ['seeds']),
    ]),
  ]);
  evidence.conditions.forEach(function (condition) {
    matrix.appendChild(
      el('tr', {}, [
        el('td', {}, [condition.condition]),
        el('td', {}, [String(condition.runCount)]),
        el('td', {}, [String(condition.eligibleRunCount)]),
        el('td', {}, [fmt(condition.totalDurationMs, 0)]),
        el('td', {}, [condition.seeds.join(', ') || 'n/a']),
      ]),
    );
  });
  app.appendChild(matrix);

  evidence.conditions.forEach(function (condition) {
    app.appendChild(el('h2', {}, ['Condition: ' + condition.condition]));
    condition.runs.forEach(function (run) {
      var block = el('div', { class: 'run-block' }, [
        el('h3', {}, [run.runId]),
        el('p', {}, ['quality: ', qualityNode(run.quality)]),
        el('p', {}, ['RMS/TOT/acquisition: ', p0Node(run.p0)]),
        el('p', {}, ['lag/gain/drop/recovery: ', p1Node(run.p1)]),
      ]);
      block.appendChild(el('p', {}, ['target/aim trace (\\u03b5 over time):']));
      block.appendChild(traceNode(run.trace));
      app.appendChild(block);
    });
  });
})();
`;
