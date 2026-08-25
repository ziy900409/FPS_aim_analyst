import type { SessionHistoryFile } from '../data/sessionHistoryLoader.ts';
import type { SessionHistoryResult } from '../metrics/sessionHistory.ts';

export interface HistoryViewHandle {
  readonly element: HTMLElement;
  render(result: SessionHistoryResult | undefined): void;
  dispose(): void;
}

export interface HistoryViewOptions {
  readonly onFilesSelected?: (files: Iterable<SessionHistoryFile>) => Promise<SessionHistoryResult>;
}

/**
 * Browser-only personal-history presentation. It never persists files: every comparison begins
 * when the participant explicitly selects prior Assessment JSON exports.
 */
export function createHistoryView(options: HistoryViewOptions = {}): HistoryViewHandle {
  const root = document.createElement('section');
  root.dataset.section = 'session-history';
  root.style.cssText = 'margin-top:18px;display:grid;gap:10px';

  const title = document.createElement('h3');
  title.textContent = 'Personal session history';
  title.style.cssText = 'margin:0;font:700 14px/1.25 system-ui,sans-serif;letter-spacing:0';

  const description = document.createElement('p');
  description.textContent = 'Select prior Assessment JSON exports to calculate a compatible recent baseline. Files stay in this browser session only.';
  description.style.cssText = 'margin:0;color:#b8c4cf;font:500 12px/1.4 system-ui,sans-serif';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.multiple = true;
  input.dataset.historyFileInput = 'true';

  const output = document.createElement('div');
  output.style.cssText = 'display:grid;gap:8px';
  root.append(title, description, input, output);

  const render = (result: SessionHistoryResult | undefined): void => {
    output.replaceChildren(renderHistoryResult(result));
  };

  input.addEventListener('change', () => {
    const files = input.files;
    if (files === null || files.length === 0 || options.onFilesSelected === undefined) return;
    output.replaceChildren(renderHistoryMessage('Loading selected Assessment exports…'));
    void options.onFilesSelected(Array.from(files)).then(render, (error: unknown) => {
      render({ status: 'insufficient-data', reason: error instanceof Error ? error.message : 'Could not load history exports' });
    });
  });

  render(undefined);
  return { element: root, render, dispose: () => root.remove() };
}

function renderHistoryResult(result: SessionHistoryResult | undefined): HTMLElement {
  if (result === undefined) return renderHistoryMessage('No history loaded. Select prior Assessment exports to compare compatible sessions.');
  if (result.status === 'insufficient-data') return renderHistoryMessage(`資料不足: ${result.reason}`);

  const node = document.createElement('div');
  node.dataset.historyStatus = 'ok';
  node.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(174px,1fr));gap:10px';
  node.append(
    historyCard('history-speed', `Speed — ${result.eligible[0]?.speedMetric.id ?? 'metric'}`, result.medianSpeed, result.variabilitySpeed, result.eligible.length),
    historyCard(
      'history-accuracy',
      `Accuracy — ${result.eligible[0]?.accuracyMetric.id ?? 'metric'}`,
      result.medianAccuracy,
      result.variabilityAccuracy,
      result.eligible.length,
    ),
  );
  return node;
}

function historyCard(id: string, title: string, median: number, variability: number, n: number): HTMLElement {
  const node = document.createElement('article');
  node.dataset.metricId = id;
  node.style.cssText = [
    'box-sizing:border-box',
    'padding:12px',
    'background:rgba(255,255,255,0.055)',
    'border:1px solid rgba(255,255,255,0.10)',
    'border-radius:6px',
  ].join(';');
  const heading = document.createElement('div');
  heading.textContent = title;
  heading.style.cssText = 'color:#aeb9c4;font:650 12px/1.25 system-ui,sans-serif';
  const value = document.createElement('div');
  value.textContent = `median ${formatNumber(median)}`;
  value.style.cssText = 'margin-top:8px;font:750 22px/1.12 system-ui,sans-serif;font-variant-numeric:tabular-nums';
  const detail = document.createElement('div');
  detail.textContent = `population SD ${formatNumber(variability)} · n=${n}`;
  detail.style.cssText = 'margin-top:6px;color:#c8d0d8;font:500 12px/1.35 system-ui,sans-serif';
  node.append(heading, value, detail);
  return node;
}

function renderHistoryMessage(text: string): HTMLElement {
  const node = document.createElement('div');
  node.dataset.historyStatus = 'insufficient-data';
  node.textContent = text;
  node.style.cssText = 'box-sizing:border-box;padding:12px;background:rgba(255,207,110,0.09);border:1px solid rgba(255,207,110,0.22);border-radius:6px;color:#f4d78a;font:600 12px/1.4 system-ui,sans-serif';
  return node;
}

function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\.0+$/, '');
}
