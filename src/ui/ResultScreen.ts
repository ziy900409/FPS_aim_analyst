import { CS2_PROFILE } from '../sim/MovementController.ts';
import type { Metrics, Stat } from '../metrics/compute.ts';

export interface ResultCard {
  id: string;
  title: string;
  value: string;
  detail: string;
}

export interface ResultSummary {
  cards: ResultCard[];
  reactionValues: number[];
  methodNote: string;
}

export interface ResultScreenHandle {
  readonly visible: boolean;
  show(metrics: Metrics): void;
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

  panel.append(title, method, grid, chartTitle, chart);
  root.appendChild(panel);
  parent.appendChild(root);

  function render(summary: ResultSummary): void {
    method.textContent = summary.methodNote;
    grid.replaceChildren(...summary.cards.map(renderCard));
    chart.replaceChildren(renderReactionDistribution(summary.reactionValues));
  }

  return {
    get visible(): boolean {
      return visible;
    },
    show(metrics: Metrics): void {
      render(createResultSummary(metrics));
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
  return node;
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
