/**
 * WP-49 T5 (README §2.9) — small purpose-built trend chart: an SVG line/points plot plus an
 * accessible data table rendering the exact same points (NFR-49.5 "趨勢 SVG 必須有同資料的文字摘要或
 * table fallback"). Direction/delta are always rendered as text (進步/退步/上升/下降/持平ヽ never
 * color alone (README §2.9 "不以顏色單獨表達 improvement")). This is a single-metric time-series
 * renderer only (Conscious debt §3.2 point 3) — no multi-axis, confidence band, or cross-run overlay.
 */

import type { MetricDescriptor } from '../../history/DrillMetricRegistry.ts';
import type { TrendPoint } from '../../history/HistoryTrend.ts';

export interface TrendChartInput {
  readonly descriptor: MetricDescriptor;
  readonly points: readonly TrendPoint[]; // oldest -> newest
}

export interface TrendChartHandle {
  readonly element: HTMLElement;
  render(input: TrendChartInput): void;
  dispose(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const CHART_WIDTH = 560;
const CHART_HEIGHT = 160;
const CHART_PADDING = 20;

function decimalsFor(format: MetricDescriptor['format']): number {
  switch (format) {
    case 'integer':
      return 0;
    case 'decimal-1':
      return 1;
    case 'decimal-2':
      return 2;
    case 'percent':
      return 1;
  }
}

function formatMetricValue(descriptor: MetricDescriptor, value: number): string {
  const numberText = value.toFixed(decimalsFor(descriptor.format));
  return descriptor.unit === '%' ? `${numberText}%` : `${numberText} ${descriptor.unit}`;
}

/** Never "下降" is bad or "上升" is good on its own — the word is chosen from `descriptor.direction`
 * so a lower-is-better metric's decrease reads as an improvement (T5 high-risk failure mode table:
 * "lower-is-better metric | direction/delta 文字正確,不把下降標惡化"). */
function directionWordFor(descriptor: MetricDescriptor, delta: number): string {
  if (delta === 0) return '持平';
  if (descriptor.direction === 'higher-is-better') return delta > 0 ? '進步' : '退步';
  if (descriptor.direction === 'lower-is-better') return delta < 0 ? '進步' : '退步';
  return delta > 0 ? '上升' : '下降';
}

function formatDelta(descriptor: MetricDescriptor, delta: number): string {
  if (delta === 0) return `持平（${formatMetricValue(descriptor, 0)}）`;
  const sign = delta > 0 ? '+' : '-';
  const magnitude = formatMetricValue(descriptor, Math.abs(delta));
  return `${sign}${magnitude}（${directionWordFor(descriptor, delta)}）`;
}

function formatStartedAt(iso: string): { readonly local: string; readonly title: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { local: iso, title: iso };
  return { local: date.toLocaleDateString(), title: iso };
}

function tableHeader(labels: readonly string[]): HTMLTableRowElement {
  const row = document.createElement('tr');
  for (const label of labels) {
    const th = document.createElement('th');
    th.textContent = label;
    th.scope = 'col';
    th.style.cssText = 'text-align:left;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.18)';
    row.appendChild(th);
  }
  return row;
}

function tableCell(text: string, title?: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.textContent = text;
  if (title !== undefined) cell.title = title;
  cell.style.cssText = 'padding:4px 8px';
  return cell;
}

export function createTrendChart(): TrendChartHandle {
  const root = document.createElement('div');
  root.dataset.section = 'trend-chart';

  const summary = document.createElement('p');
  summary.dataset.section = 'trend-chart-summary';

  const svg = document.createElementNS(SVG_NS, 'svg') as unknown as SVGSVGElement;
  svg.setAttribute('role', 'img');
  svg.setAttribute('viewBox', `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`);
  (svg as unknown as HTMLElement).style.cssText = 'width:100%;max-width:560px;height:auto;display:block';

  const table = document.createElement('table');
  table.dataset.section = 'trend-chart-table';
  table.style.cssText = 'border-collapse:collapse;width:100%;margin-top:8px;font:500 12px/1.4 system-ui,sans-serif';

  root.append(summary, svg as unknown as Node, table);

  function renderEmpty(): void {
    summary.textContent = '尚無資料。';
    svg.setAttribute('aria-label', '尚無資料');
    (svg as unknown as { replaceChildren(...nodes: unknown[]): void }).replaceChildren();
    table.replaceChildren();
  }

  function renderSinglePoint(descriptor: MetricDescriptor, point: TrendPoint): void {
    const { local, title } = formatStartedAt(point.startedAt);
    const text = `目前僅 1 筆資料：${formatMetricValue(descriptor, point.value)}（${local}）。尚無變化資料。`;
    summary.textContent = text;
    svg.setAttribute('aria-label', text);
    (svg as unknown as { replaceChildren(...nodes: unknown[]): void }).replaceChildren();

    const caption = document.createElement('caption');
    caption.textContent = `${descriptor.label}（${descriptor.unit}）— 僅 1 筆資料`;
    const row = document.createElement('tr');
    row.append(tableCell(local, title), tableCell(formatMetricValue(descriptor, point.value)));
    table.replaceChildren(caption, tableHeader(['時間', '數值']), row);
  }

  function renderMultiPoint(descriptor: MetricDescriptor, points: readonly TrendPoint[]): void {
    const first = points[0];
    const last = points[points.length - 1];
    const overallDelta = last.value - first.value;
    const summaryText = `${points.length} 筆資料，從 ${formatMetricValue(descriptor, first.value)} 到 ${formatMetricValue(
      descriptor,
      last.value,
    )}（整體 ${formatDelta(descriptor, overallDelta)}）。`;
    summary.textContent = summaryText;
    svg.setAttribute('aria-label', summaryText);

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const plotWidth = CHART_WIDTH - CHART_PADDING * 2;
    const plotHeight = CHART_HEIGHT - CHART_PADDING * 2;

    const xFor = (index: number): number => CHART_PADDING + (plotWidth * index) / (points.length - 1);
    // This plots the raw value, not a "goodness" score — a lower-is-better metric's line still
    // rises with a larger number. Direction only changes the text (`formatDelta`), never the plot.
    const yFor = (value: number): number =>
      range === 0 ? CHART_PADDING + plotHeight / 2 : CHART_PADDING + plotHeight * (1 - (value - min) / range);

    const polyline = document.createElementNS(SVG_NS, 'polyline') as unknown as SVGPolylineElement;
    polyline.setAttribute('points', points.map((p, i) => `${xFor(i)},${yFor(p.value)}`).join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', '#7cc7ff');
    polyline.setAttribute('stroke-width', '2');

    const circles = points.map((p, i) => {
      const circle = document.createElementNS(SVG_NS, 'circle') as unknown as SVGCircleElement & {
        appendChild(node: unknown): void;
      };
      circle.setAttribute('cx', String(xFor(i)));
      circle.setAttribute('cy', String(yFor(p.value)));
      circle.setAttribute('r', '3');
      circle.setAttribute('fill', '#e6e9ec');
      const pointTitle = document.createElementNS(SVG_NS, 'title') as unknown as { textContent: string };
      const { local: pointLocal } = formatStartedAt(p.startedAt);
      pointTitle.textContent = `${pointLocal}：${formatMetricValue(descriptor, p.value)}`;
      circle.appendChild(pointTitle);
      return circle as unknown as Node;
    });

    (svg as unknown as { replaceChildren(...nodes: unknown[]): void }).replaceChildren(polyline, ...circles);

    const caption = document.createElement('caption');
    caption.textContent = `${descriptor.label}（${descriptor.unit}）— ${points.length} 筆資料`;
    const rows = points.map((p) => {
      const { local: pointLocal, title } = formatStartedAt(p.startedAt);
      const row = document.createElement('tr');
      row.append(
        tableCell(pointLocal, title),
        tableCell(formatMetricValue(descriptor, p.value)),
        tableCell(p.deltaFromPrevious === undefined ? '—' : formatDelta(descriptor, p.deltaFromPrevious)),
      );
      return row;
    });
    table.replaceChildren(caption, tableHeader(['時間', '數值', '較前一筆']), ...rows);
  }

  function render(input: TrendChartInput): void {
    const { descriptor, points } = input;
    if (points.length === 0) renderEmpty();
    else if (points.length === 1) renderSinglePoint(descriptor, points[0]);
    else renderMultiPoint(descriptor, points);
  }

  return {
    element: root,
    render,
    dispose(): void {
      root.remove();
    },
  };
}
