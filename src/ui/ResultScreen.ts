import { CS2_PROFILE } from '../sim/MovementController.ts';
import type { AimOffset, CompensationError, Metrics, RecoilCompensationPath, Stat } from '../metrics/compute.ts';
import type { NormalizedCurve, PrecisionVerdict, PromotedMetrics, PromotedStat } from '../metrics/researchMetrics.ts';

export const PROMOTED_METRIC_IDS = [
  'phase-rec-ms',
  'phase-mr-ms',
  'phase-v-ms',
  'sync-release-to-fire-ms',
  'sync-counter-hold-ms',
  'sync-counter-to-fire-ms',
  'curve-omega',
  'curve-epsilon',
] as const;

export type PromotedMetricId = (typeof PROMOTED_METRIC_IDS)[number];

export interface ResultCard {
  id: string;
  title: string;
  value: string;
  detail: string;
  meta?: string;
}

export interface ResultSummary {
  cards: ResultCard[];
  reactionValues: number[];
  recoilCompensation: RecoilCompensationSummary;
  methodNote: string;
}

export interface RecoilCompensationSummary {
  error: CompensationError;
  path: RecoilCompensationPath;
}

export interface RecoilOverlayPoint {
  x: number;
  y: number;
}

export interface RecoilOverlayModel {
  actual: RecoilOverlayPoint[];
  ideal: RecoilOverlayPoint[];
  origin: RecoilOverlayPoint;
  meanText: string;
  rmsText: string;
}

export interface ResultScreenHandle {
  readonly visible: boolean;
  show(metrics: Metrics, promoted?: PromotedMetrics): void;
  hide(): void;
  dispose(): void;
}

export interface ResultScreenOptions {
  parent?: HTMLElement;
}

export function createResultScreen(options: ResultScreenOptions = {}): ResultScreenHandle {
  const parent = options.parent ?? document.body;
  let visible = false;

  const root = document.createElement('section');
  root.id = 'result-screen';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Drill result');
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'padding:28px',
    'box-sizing:border-box',
    'font:500 13px/1.4 system-ui,sans-serif',
    'color:#edf2f7',
    'background:rgba(10,12,14,0.72)',
    'pointer-events:auto',
    'z-index:30',
  ].join(';');

  const panel = document.createElement('div');
  panel.style.cssText = [
    'width:min(980px,100%)',
    'max-height:min(760px,100%)',
    'overflow:auto',
    'box-sizing:border-box',
    'padding:20px',
    'background:rgba(24,27,30,0.96)',
    'border:1px solid rgba(255,255,255,0.14)',
    'border-radius:8px',
    'box-shadow:0 24px 80px rgba(0,0,0,0.42)',
  ].join(';');

  const title = document.createElement('h2');
  title.textContent = 'Drill Results';
  title.style.cssText = 'margin:0 0 6px;font:700 20px/1.2 system-ui,sans-serif;letter-spacing:0';

  const method = document.createElement('p');
  method.style.cssText = 'margin:0 0 16px;color:#b8c4cf;max-width:760px';

  const grid = document.createElement('div');
  grid.style.cssText = [
    'display:grid',
    'grid-template-columns:repeat(auto-fit,minmax(190px,1fr))',
    'gap:10px',
  ].join(';');

  const chartTitle = document.createElement('h3');
  chartTitle.textContent = 'Reaction Time Distribution';
  chartTitle.style.cssText = 'margin:18px 0 8px;font:700 14px/1.25 system-ui,sans-serif;letter-spacing:0';

  const chart = document.createElement('div');
  chart.style.cssText = [
    'height:132px',
    'box-sizing:border-box',
    'padding:10px',
    'background:rgba(255,255,255,0.045)',
    'border:1px solid rgba(255,255,255,0.10)',
    'border-radius:6px',
  ].join(';');

  const recoilTitle = document.createElement('h3');
  recoilTitle.textContent = 'Recoil Compensation Path';
  recoilTitle.style.cssText = 'margin:18px 0 8px;font:700 14px/1.25 system-ui,sans-serif;letter-spacing:0';

  const recoilChart = document.createElement('div');
  recoilChart.style.cssText = [
    'min-height:236px',
    'box-sizing:border-box',
    'padding:12px',
    'background:rgba(255,255,255,0.045)',
    'border:1px solid rgba(255,255,255,0.10)',
    'border-radius:6px',
  ].join(';');

  const promotedSection = document.createElement('section');
  promotedSection.dataset.section = 'research-promoted';
  promotedSection.style.cssText = 'display:none;margin-top:18px';

  const promotedTitle = document.createElement('h3');
  promotedTitle.textContent = 'Research-promoted diagnostics';
  promotedTitle.style.cssText = 'margin:0 0 8px;font:700 14px/1.25 system-ui,sans-serif;letter-spacing:0';

  const promotedBody = document.createElement('div');
  promotedBody.style.cssText = 'display:grid;gap:10px';
  promotedSection.append(promotedTitle, promotedBody);

  panel.append(title, method, grid, chartTitle, chart, recoilTitle, recoilChart, promotedSection);
  root.appendChild(panel);
  parent.appendChild(root);

  function render(summary: ResultSummary, promoted?: PromotedMetrics): void {
    method.textContent = summary.methodNote;
    grid.replaceChildren(...summary.cards.map(renderCard));
    chart.replaceChildren(renderReactionDistribution(summary.reactionValues));
    const recoilModel = createRecoilOverlayModel(summary.recoilCompensation);
    recoilTitle.style.display = recoilModel !== undefined ? '' : 'none';
    recoilChart.style.display = recoilModel !== undefined ? '' : 'none';
    recoilChart.replaceChildren(...(recoilModel !== undefined ? [renderRecoilCompensation(recoilModel)] : []));
    promotedSection.style.display = promoted === undefined ? 'none' : '';
    promotedBody.replaceChildren(...(promoted === undefined ? [] : [renderPromotedMetrics(promoted)]));
  }

  return {
    get visible(): boolean {
      return visible;
    },
    show(metrics: Metrics, promoted?: PromotedMetrics): void {
      render(createResultSummary(metrics), promoted);
      visible = true;
      root.style.display = 'flex';
    },
    hide(): void {
      visible = false;
      root.style.display = 'none';
    },
    dispose(): void {
      root.remove();
    },
  };
}

export function createResultSummary(metrics: Metrics): ResultSummary {
  const residual = summarizeResidualSpeed(metrics.residualSpeed);
  return {
    methodNote: 'Subject-relative values only. Interpret changes within the same participant; display-latency error bounds still apply.',
    reactionValues: metrics.counterReactionMs.values ?? [],
    recoilCompensation: {
      error: metrics.recoilCompensationError,
      path: metrics.recoilCompensationPath,
    },
    cards: [
      statCard('counterReactionMs', 'Counter reaction', metrics.counterReactionMs, 'ms', 0),
      {
        id: 'residualSpeed',
        title: 'Residual speed / overshoot',
        value: formatStatMean(metrics.residualSpeed, 'u/s', 1),
        detail: residual.detail,
      },
      statCard('fireTimingAlignmentMs', 'Fire timing alignment', metrics.fireTimingAlignmentMs, 'ms', 0),
      {
        id: 'firstShotHitRate',
        title: 'First-shot hit rate',
        value: formatPercent(metrics.firstShotHitRate),
        detail: 'First-shot hits / visible peeks',
      },
      statCard('crosshairOffset', 'Crosshair offset', metrics.crosshairOffset, 'deg', 2),
      statCard('switchTimeMs', 'Switch time', metrics.switchTimeMs, 'ms', 0),
      {
        id: 'rhythmStability',
        title: 'Rhythm stability',
        value: formatNumber(metrics.rhythmStability, 3),
        detail: 'Cycle coefficient of variation',
      },
      {
        id: 'leftRightSymmetry',
        title: 'Left / right symmetry',
        value: metrics.leftRightSymmetry.left.n > 0 && metrics.leftRightSymmetry.right.n > 0
          ? `${formatNumber(metrics.leftRightSymmetry.diff, 0)} ms`
          : 'N/A',
        detail: `L ${formatStatMean(metrics.leftRightSymmetry.left, 'ms', 0)} · R ${formatStatMean(metrics.leftRightSymmetry.right, 'ms', 0)}`,
      },
    ],
  };
}

export function createRecoilOverlayModel(summary: RecoilCompensationSummary): RecoilOverlayModel | undefined {
  const width = 720;
  const height = 176;
  const margin = 18;
  const actual = finiteOffsets(summary.path.actual);
  const ideal = finiteOffsets(summary.path.ideal);
  if (actual.length === 0 && ideal.length === 0) return undefined;

  const points = [...actual, ...ideal, { pitchDeg: 0, yawDeg: 0 }];
  const minPitch = Math.min(...points.map((point) => point.pitchDeg));
  const maxPitch = Math.max(...points.map((point) => point.pitchDeg));
  const minYaw = Math.min(...points.map((point) => point.yawDeg));
  const maxYaw = Math.max(...points.map((point) => point.yawDeg));
  const pitchSpan = Math.max(maxPitch - minPitch, 1);
  const yawSpan = Math.max(maxYaw - minYaw, 1);
  const plotWidth = width - margin * 2;
  const plotHeight = height - margin * 2;

  const mapPoint = (point: AimOffset): RecoilOverlayPoint => ({
    x: margin + ((point.yawDeg - minYaw) / yawSpan) * plotWidth,
    y: margin + ((point.pitchDeg - minPitch) / pitchSpan) * plotHeight,
  });

  return {
    actual: actual.map(mapPoint),
    ideal: ideal.map(mapPoint),
    origin: mapPoint({ pitchDeg: 0, yawDeg: 0 }),
    meanText: `${formatNumber(summary.error.meanDeg, 2)} deg`,
    rmsText: `${formatNumber(summary.error.rmsDeg, 2)} deg`,
  };
}

export function summarizeResidualSpeed(stat: Stat): { detail: string; withinGate: number; overGate: number } {
  const values = stat.values ?? [];
  if (values.length === 0) return { detail: 'No fire samples', withinGate: 0, overGate: 0 };

  let withinGate = 0;
  let overGate = 0;
  for (const value of values) {
    if (Math.abs(value) < CS2_PROFILE.accuracyThreshold) withinGate++;
    else overGate++;
  }

  const detail = `p50 ${formatNumber(stat.p50, 1)} u/s · SD ${formatNumber(stat.sd, 1)} u/s · n=${stat.n} · ${withinGate}/${values.length} under ${formatNumber(CS2_PROFILE.accuracyThreshold, 0)} u/s gate`;
  return { detail, withinGate, overGate };
}

function statCard(id: string, title: string, stat: Stat, unit: string, decimals: number): ResultCard {
  return {
    id,
    title,
    value: formatStatMean(stat, unit, decimals),
    detail: stat.n > 0 ? `SD ${formatNumber(stat.sd, decimals)} ${unit} · n=${stat.n}` : 'No samples',
  };
}

function renderCard(card: ResultCard): HTMLElement {
  const node = document.createElement('article');
  node.dataset.metricId = card.id;
  node.dataset.metricValue = card.value;
  node.style.cssText = [
    'min-height:92px',
    'box-sizing:border-box',
    'padding:12px',
    'background:rgba(255,255,255,0.055)',
    'border:1px solid rgba(255,255,255,0.10)',
    'border-radius:6px',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = card.title;
  title.style.cssText = 'margin-bottom:8px;color:#aeb9c4;font:650 12px/1.25 system-ui,sans-serif';

  const value = document.createElement('div');
  value.textContent = card.value;
  value.style.cssText = 'font:750 22px/1.12 system-ui,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:0';

  const detail = document.createElement('div');
  detail.textContent = card.detail;
  detail.style.cssText = 'margin-top:6px;color:#c8d0d8;font:500 12px/1.35 system-ui,sans-serif';

  node.append(title, value, detail);
  if (card.meta !== undefined) {
    const meta = document.createElement('div');
    meta.textContent = card.meta;
    meta.style.cssText = 'margin-top:6px;color:#91a0ad;font:600 11px/1.35 system-ui,sans-serif';
    node.appendChild(meta);
  }
  return node;
}

export function createPromotedSummary(promoted: PromotedMetrics): { status: 'blocked'; reason: string } | {
  status: 'ok';
  cards: ResultCard[];
  flags: { phase: number; sync: number; curve: number };
  versions: string;
} {
  if (promoted.status === 'blocked') return promoted;

  const phaseFlags = countFlags(promoted.phase.flagCounts);
  const syncFlags = countFlags(promoted.sync.flagCounts);
  const curveFlags = countFlags(promoted.curve.flagCounts);
  const verdictByMetric = new Map(promoted.sync.verdicts.map((verdict) => [verdict.metric, verdict]));

  return {
    status: 'ok',
    flags: { phase: phaseFlags, sync: syncFlags, curve: curveFlags },
    versions: `${promoted.phase.version} / ${promoted.sync.version} / ${promoted.curve.version} / seg-v2 / sg-seg-v2`,
    cards: [
      promotedStatCard('phase-rec-ms', 'REC', promoted.phase.recMs, 'ms', promoted.phase.version, phaseFlags),
      promotedStatCard('phase-mr-ms', 'MR', promoted.phase.mrMs, 'ms', promoted.phase.version, phaseFlags),
      promotedStatCard('phase-v-ms', 'V', promoted.phase.vMs, 'ms', promoted.phase.version, phaseFlags),
      promotedStatCard(
        'sync-release-to-fire-ms',
        'Release to fire',
        promoted.sync.releaseToFireMs,
        'ms',
        promoted.sync.version,
        syncFlags,
        verdictByMetric.get('release_to_fire_ms'),
      ),
      promotedStatCard(
        'sync-counter-hold-ms',
        'Counter hold',
        promoted.sync.counterHoldMs,
        'ms',
        promoted.sync.version,
        syncFlags,
        verdictByMetric.get('counter_hold_ms'),
      ),
      promotedStatCard(
        'sync-counter-to-fire-ms',
        'Counter to fire',
        promoted.sync.counterToFireMs,
        'ms',
        promoted.sync.version,
        syncFlags,
      ),
    ],
  };
}

function renderPromotedMetrics(promoted: PromotedMetrics): HTMLElement {
  if (promoted.status === 'blocked') return renderPromotedBlocked(promoted.reason);
  const summary = createPromotedSummary(promoted);
  if (summary.status === 'blocked') return renderPromotedBlocked(summary.reason);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:grid;gap:10px';

  const cards = document.createElement('div');
  cards.style.cssText = [
    'display:grid',
    'grid-template-columns:repeat(auto-fit,minmax(174px,1fr))',
    'gap:10px',
  ].join(';');
  cards.replaceChildren(...summary.cards.map(renderCard));

  const curves = document.createElement('div');
  curves.style.cssText = [
    'display:grid',
    'grid-template-columns:repeat(auto-fit,minmax(260px,1fr))',
    'gap:10px',
  ].join(';');
  curves.replaceChildren(
    renderCurvePanel(
      'curve-omega',
      'Angular speed',
      promoted.curve.omega.left,
      promoted.curve.omega.right,
      promoted.curve.version,
      summary.flags.curve,
      'deg/s',
    ),
    renderCurvePanel(
      'curve-epsilon',
      'Aim error',
      promoted.curve.epsilon.left,
      promoted.curve.epsilon.right,
      promoted.curve.version,
      summary.flags.curve,
      'deg',
    ),
  );

  const footer = document.createElement('p');
  footer.textContent =
    `Versions ${summary.versions}. Single-drill distributions are pilot diagnostics; read p50/SD/n together.`;
  footer.style.cssText = 'margin:0;color:#aeb9c4;font:600 11px/1.4 system-ui,sans-serif';

  wrapper.append(cards, curves, footer);
  return wrapper;
}

function renderPromotedBlocked(reason: string): HTMLElement {
  const node = document.createElement('article');
  node.dataset.promotedBlocked = 'true';
  node.style.cssText = [
    'box-sizing:border-box',
    'padding:12px',
    'background:rgba(255,207,110,0.09)',
    'border:1px solid rgba(255,207,110,0.22)',
    'border-radius:6px',
    'color:#f4d78a',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'Promoted diagnostics blocked';
  title.style.cssText = 'font:750 13px/1.3 system-ui,sans-serif';

  const detail = document.createElement('div');
  detail.textContent = `${reason}. Re-run with tick-window mouse integration enabled; KI-005 forbids legacy aim-diff fallback.`;
  detail.style.cssText = 'margin-top:6px;color:#e7d7a5;font:600 12px/1.4 system-ui,sans-serif';

  node.append(title, detail);
  return node;
}

function promotedStatCard(
  id: PromotedMetricId,
  title: string,
  stat: PromotedStat,
  unit: string,
  version: string,
  flagged: number,
  verdict?: PrecisionVerdict,
): ResultCard {
  const detail =
    stat.n > 0
      ? `mean ${formatNumber(stat.mean, 0)} ${unit} · SD ${formatNumber(stat.sd, 0)} ${unit} · n=${stat.n}`
      : 'No samples';
  const verdictText = verdict === undefined ? '' : ` · ${verdict.verdict}`;
  return {
    id,
    title,
    value: stat.n > 0 ? `${formatNumber(stat.p50, 0)} ${unit}` : 'No samples',
    detail,
    meta: `${flagged} flagged · ${version}${verdictText}`,
  };
}

function renderCurvePanel(
  id: Extract<PromotedMetricId, 'curve-omega' | 'curve-epsilon'>,
  title: string,
  left: NormalizedCurve,
  right: NormalizedCurve,
  version: string,
  flagged: number,
  unit: string,
): HTMLElement {
  const node = document.createElement('article');
  node.dataset.metricId = id;
  node.style.cssText = [
    'box-sizing:border-box',
    'padding:12px',
    'background:rgba(255,255,255,0.045)',
    'border:1px solid rgba(255,255,255,0.10)',
    'border-radius:6px',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin-bottom:8px';

  const name = document.createElement('div');
  name.textContent = title;
  name.style.cssText = 'color:#aeb9c4;font:700 12px/1.25 system-ui,sans-serif';

  const counts = document.createElement('div');
  counts.textContent = `L n=${left.n} · R n=${right.n}`;
  counts.style.cssText = 'color:#d9e2ec;font:700 11px/1.25 system-ui,sans-serif;font-variant-numeric:tabular-nums';
  header.append(name, counts);

  const meta = document.createElement('div');
  meta.textContent = `${flagged} flagged · ${version}`;
  meta.style.cssText = 'margin-top:8px;color:#91a0ad;font:600 11px/1.35 system-ui,sans-serif';

  node.append(header, renderCurveSvg(left, right, title, unit), meta);
  return node;
}

function renderCurveSvg(left: NormalizedCurve, right: NormalizedCurve, title: string, unit: string): SVGSVGElement {
  const width = 420;
  const height = 150;
  const margin = { left: 28, right: 12, top: 12, bottom: 18 };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '150');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${title} left and right normalized curves with IQR bands`);

  const values = finiteCurveValues(left, right);
  if (values.length === 0 || (left.n === 0 && right.n === 0)) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '14');
    text.setAttribute('y', '78');
    text.setAttribute('fill', '#b8c4cf');
    text.setAttribute('font-size', '12');
    text.textContent = 'No samples';
    svg.appendChild(text);
    return svg;
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = Math.max(maxValue - minValue, 1e-9);
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const mapX = (index: number, count: number): number => margin.left + (index / Math.max(count - 1, 1)) * plotW;
  const mapY = (value: number): number => margin.top + (1 - (value - minValue) / span) * plotH;

  appendGuideLine(svg, margin.left, margin.top + plotH, width - margin.right, margin.top + plotH);
  appendCurveBand(svg, left, mapX, mapY, 'rgba(124,199,255,0.14)');
  appendCurveBand(svg, right, mapX, mapY, 'rgba(255,207,110,0.14)');
  appendCurveLine(svg, left.mean, mapX, mapY, '#7cc7ff');
  appendCurveLine(svg, right.mean, mapX, mapY, '#ffcf6e');

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', String(margin.left));
  label.setAttribute('y', String(height - 4));
  label.setAttribute('fill', '#91a0ad');
  label.setAttribute('font-size', '10');
  label.textContent = `${formatNumber(minValue, 1)}-${formatNumber(maxValue, 1)} ${unit}`;
  svg.appendChild(label);
  return svg;
}

function appendCurveBand(
  svg: SVGSVGElement,
  curve: NormalizedCurve,
  mapX: (index: number, count: number) => number,
  mapY: (value: number) => number,
  color: string,
): void {
  if (curve.n === 0 || curve.lower.length === 0 || curve.upper.length === 0) return;
  const count = Math.min(curve.lower.length, curve.upper.length);
  const upper = [];
  const lower = [];
  for (let i = 0; i < count; i++) {
    if (Number.isFinite(curve.upper[i])) upper.push(`${formatSvgNumber(mapX(i, count))},${formatSvgNumber(mapY(curve.upper[i]))}`);
    if (Number.isFinite(curve.lower[i])) lower.push(`${formatSvgNumber(mapX(i, count))},${formatSvgNumber(mapY(curve.lower[i]))}`);
  }
  if (upper.length === 0 || lower.length === 0) return;

  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', [...upper, ...lower.reverse()].join(' '));
  polygon.setAttribute('fill', color);
  svg.appendChild(polygon);
}

function appendCurveLine(
  svg: SVGSVGElement,
  values: readonly number[],
  mapX: (index: number, count: number) => number,
  mapY: (value: number) => number,
  color: string,
): void {
  const points = values
    .map((value, index) =>
      Number.isFinite(value) ? `${formatSvgNumber(mapX(index, values.length))},${formatSvgNumber(mapY(value))}` : '',
    )
    .filter((point) => point.length > 0);
  if (points.length === 0) return;

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', points.join(' '));
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', color);
  polyline.setAttribute('stroke-width', '2.5');
  polyline.setAttribute('stroke-linecap', 'round');
  polyline.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(polyline);
}

function finiteCurveValues(...curves: readonly NormalizedCurve[]): number[] {
  return curves.flatMap((curve) => [...curve.mean, ...curve.lower, ...curve.upper]).filter(Number.isFinite);
}

function countFlags(flags: Readonly<Record<string, number>>): number {
  return Object.values(flags).reduce((total, count) => total + count, 0);
}

function renderRecoilCompensation(model: RecoilOverlayModel): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.dataset.metricId = 'recoilCompensationPath';
  wrapper.style.cssText = 'display:grid;grid-template-rows:auto auto;gap:10px';

  const stats = document.createElement('div');
  stats.style.cssText = [
    'display:flex',
    'flex-wrap:wrap',
    'gap:12px',
    'align-items:center',
    'color:#d9e2ec',
    'font:650 12px/1.35 system-ui,sans-serif',
  ].join(';');

  stats.append(
    renderLegendItem('Actual aim', '#7cc7ff'),
    renderLegendItem('Ideal -aimPunch x2', '#ffcf6e'),
    renderMetricPill('Mean', model.meanText),
    renderMetricPill('RMS', model.rmsText),
  );

  wrapper.append(stats, renderRecoilSvg(model));
  return wrapper;
}

function renderLegendItem(label: string, color: string): HTMLElement {
  const item = document.createElement('span');
  item.style.cssText = 'display:inline-flex;align-items:center;gap:6px;white-space:nowrap';

  const swatch = document.createElement('span');
  swatch.style.cssText = `width:18px;height:3px;border-radius:2px;background:${color}`;

  const text = document.createElement('span');
  text.textContent = label;

  item.append(swatch, text);
  return item;
}

function renderMetricPill(label: string, value: string): HTMLElement {
  const item = document.createElement('span');
  item.style.cssText = [
    'display:inline-flex',
    'gap:6px',
    'align-items:baseline',
    'padding:4px 8px',
    'border:1px solid rgba(255,255,255,0.12)',
    'border-radius:6px',
    'background:rgba(0,0,0,0.16)',
    'font-variant-numeric:tabular-nums',
  ].join(';');

  const name = document.createElement('span');
  name.textContent = label;
  name.style.cssText = 'color:#aeb9c4';

  const number = document.createElement('span');
  number.textContent = value;

  item.append(name, number);
  return item;
}

function renderRecoilSvg(model: RecoilOverlayModel): SVGSVGElement {
  const width = 720;
  const height = 176;
  const margin = 18;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '176');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Actual recoil compensation path compared with ideal path');

  const plotWidth = width - margin * 2;
  const plotHeight = height - margin * 2;

  const grid = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  grid.setAttribute('x', String(margin));
  grid.setAttribute('y', String(margin));
  grid.setAttribute('width', String(plotWidth));
  grid.setAttribute('height', String(plotHeight));
  grid.setAttribute('rx', '4');
  grid.setAttribute('fill', 'rgba(0,0,0,0.12)');
  grid.setAttribute('stroke', 'rgba(255,255,255,0.10)');
  svg.appendChild(grid);

  appendGuideLine(svg, margin, model.origin.y, width - margin, model.origin.y);
  appendGuideLine(svg, model.origin.x, margin, model.origin.x, height - margin);
  appendPath(svg, model.ideal, '#ffcf6e');
  appendPath(svg, model.actual, '#7cc7ff');

  return svg;
}

function appendGuideLine(svg: SVGSVGElement, x1: number, y1: number, x2: number, y2: number): void {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', formatSvgNumber(x1));
  line.setAttribute('y1', formatSvgNumber(y1));
  line.setAttribute('x2', formatSvgNumber(x2));
  line.setAttribute('y2', formatSvgNumber(y2));
  line.setAttribute('stroke', 'rgba(255,255,255,0.14)');
  line.setAttribute('stroke-width', '1');
  svg.appendChild(line);
}

function appendPath(
  svg: SVGSVGElement,
  points: readonly RecoilOverlayPoint[],
  color: string,
): void {
  if (points.length === 0) return;

  if (points.length > 1) {
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points.map((point) => `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`).join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', color);
    polyline.setAttribute('stroke-width', '3');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(polyline);
  }

  for (const point of points) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', formatSvgNumber(point.x));
    circle.setAttribute('cy', formatSvgNumber(point.y));
    circle.setAttribute('r', '3');
    circle.setAttribute('fill', color);
    svg.appendChild(circle);
  }
}

function finiteOffsets(path: readonly AimOffset[]): AimOffset[] {
  return path.filter((point) => Number.isFinite(point.pitchDeg) && Number.isFinite(point.yawDeg));
}

function formatSvgNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3).replace(/\.?0+$/, '') : '0';
}

function renderReactionDistribution(values: readonly number[]): SVGSVGElement {
  const width = 720;
  const height = 108;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Counter reaction time histogram');

  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '12');
    text.setAttribute('y', '58');
    text.setAttribute('fill', '#b8c4cf');
    text.setAttribute('font-size', '13');
    text.textContent = 'No reaction samples';
    svg.appendChild(text);
    return svg;
  }

  const bins = histogram(finite, 8);
  const max = Math.max(...bins);
  const barGap = 8;
  const barWidth = (width - barGap * (bins.length - 1)) / bins.length;
  for (let i = 0; i < bins.length; i++) {
    const barHeight = max > 0 ? (bins[i] / max) * 74 : 0;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(i * (barWidth + barGap)));
    rect.setAttribute('y', String(84 - barHeight));
    rect.setAttribute('width', String(barWidth));
    rect.setAttribute('height', String(barHeight));
    rect.setAttribute('rx', '3');
    rect.setAttribute('fill', '#7cc7ff');
    svg.appendChild(rect);
  }

  const minLabel = Math.min(...finite);
  const maxLabel = Math.max(...finite);
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', '0');
  label.setAttribute('y', '104');
  label.setAttribute('fill', '#b8c4cf');
  label.setAttribute('font-size', '12');
  label.textContent = `${formatNumber(minLabel, 0)} ms - ${formatNumber(maxLabel, 0)} ms`;
  svg.appendChild(label);

  return svg;
}

function histogram(values: readonly number[], count: number): number[] {
  const bins = new Array<number>(count).fill(0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  for (const value of values) {
    const index = Math.min(count - 1, Math.floor(((value - min) / span) * count));
    bins[index]++;
  }
  return bins;
}

function formatStatMean(stat: Stat, unit: string, decimals: number): string {
  return stat.n > 0 ? `${formatNumber(stat.mean, decimals)} ${unit}` : 'N/A';
}

function formatPercent(value: number): string {
  return `${formatNumber(value, 1)}%`;
}

function formatNumber(value: number, decimals: number): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : 'N/A';
}
