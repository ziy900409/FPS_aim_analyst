/**
 * WP-49 T3 — exact-drill Assessment run list (README §2.9 FR-49.4's run-list half; the trend half
 * is T4/T5's `DrillMetricRegistry`/analysis-endpoint work and is not implemented here). Runs render
 * in the order the WP-48 repository already returns them — `startedAt desc`, tied broken by `runId`
 * ascending (`HistoryRepository.listRuns`) — this component never re-sorts client-side.
 *
 * The `all | trend-eligible | excluded` filter (README §2.3 `HistoryRoute['drill'].runFilter`) is
 * exposed here per T3 Steps §4, but until T4's metric registry exists there is no eligibility
 * signal to classify a run by — `trend-eligible`/`excluded` render a pending-analysis notice rather
 * than guessing or silently degrading to `all`.
 */

import type { AsyncState, HistoryLibraryController } from '../../history/HistoryLibraryController.ts';
import type { HistoryRunSummary } from '../../history/contracts.ts';
import type { HistoryNavigator } from '../../history/navigation/HistoryNavigator.ts';
import type { HistoryRunFilter } from '../../history/navigation/HistoryRoute.ts';

export interface DrillOverviewOptions {
  readonly navigator: HistoryNavigator;
  readonly controller: HistoryLibraryController;
}

export interface DrillOverviewInput {
  readonly runs: AsyncState<readonly HistoryRunSummary[]>;
  readonly participantId: string;
  readonly drillId: string;
  readonly runFilter: HistoryRunFilter;
}

export interface DrillOverviewHandle {
  readonly element: HTMLElement;
  render(input: DrillOverviewInput): void;
  dispose(): void;
}

// Mirrors ParticipantBrowser/DrillBrowser's chunk size (NFR-49.1 first-paint DOM bound) — a single
// exact drill can carry hundreds to thousands of Assessment runs (README §0 "Scale target").
const CHUNK_SIZE = 100;

const buttonCss = [
  'height:30px',
  'padding:0 12px',
  'border:1px solid rgba(255,255,255,0.18)',
  'border-radius:6px',
  'font:650 12px/1 system-ui,sans-serif',
  'color:#e6e9ec',
  'background:rgba(24,27,30,0.96)',
  'cursor:pointer',
].join(';');

function makeButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cssText = buttonCss;
  return button;
}

const FILTERS: readonly { readonly value: HistoryRunFilter; readonly label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'trend-eligible', label: '可納入趨勢' },
  { value: 'excluded', label: '已排除' },
];

function formatStartedAt(iso: string): { readonly local: string; readonly title: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { local: iso, title: iso };
  return { local: date.toLocaleString(), title: iso };
}

export function createDrillOverview(options: DrillOverviewOptions): DrillOverviewHandle {
  const { navigator, controller } = options;

  const root = document.createElement('div');
  root.dataset.section = 'drill-overview';

  const filterRow = document.createElement('div');
  filterRow.setAttribute('role', 'group');
  filterRow.setAttribute('aria-label', 'Run 篩選');
  filterRow.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap';

  const filterButtons = new Map<HistoryRunFilter, HTMLButtonElement>();
  for (const filter of FILTERS) {
    const button = makeButton(filter.label);
    button.dataset.runFilter = filter.value;
    button.setAttribute('aria-pressed', 'false');
    filterButtons.set(filter.value, button);
    filterRow.appendChild(button);
  }

  const status = document.createElement('div');
  status.dataset.section = 'run-list-status';
  status.setAttribute('aria-live', 'polite');

  root.append(filterRow, status);

  let currentParticipantId = '';
  let currentDrillId = '';

  for (const [value, button] of filterButtons) {
    button.addEventListener('click', () => {
      navigator.replace({ kind: 'drill', participantId: currentParticipantId, drillId: currentDrillId, runFilter: value });
    });
  }

  function renderRows(participantId: string, drillId: string, rows: readonly HistoryRunSummary[]): HTMLUListElement {
    const list = document.createElement('ul');
    list.style.cssText = 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px';
    for (const row of rows) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.style.cssText = `${buttonCss};width:100%;height:auto;padding:8px 12px;text-align:left;display:flex;justify-content:space-between;gap:12px`;

      const idLabel = document.createElement('span');
      idLabel.textContent = row.runId;
      idLabel.style.cssText = 'font-weight:700;word-break:break-all';

      const { local, title } = formatStartedAt(row.startedAt);
      const meta = document.createElement('span');
      meta.textContent = row.suspect ? `${local}・suspect` : local;
      meta.title = title;
      meta.style.cssText = 'opacity:0.75;white-space:nowrap';

      button.append(idLabel, meta);
      button.addEventListener('click', () => navigator.push({ kind: 'run', participantId, drillId, runId: row.runId }));
      item.appendChild(button);
      list.appendChild(item);
    }
    return list;
  }

  let lastValue: readonly HistoryRunSummary[] | undefined;
  let visibleCount = CHUNK_SIZE;

  function renderReadyBody(participantId: string, drillId: string, value: readonly HistoryRunSummary[]): HTMLElement[] {
    if (lastValue !== value) {
      visibleCount = CHUNK_SIZE;
      lastValue = value;
    }

    const summary = document.createElement('p');
    summary.textContent = `共 ${value.length} 筆（依開始時間新到舊）。`;

    const visible = value.slice(0, visibleCount);
    const elements: HTMLElement[] = [summary, renderRows(participantId, drillId, visible)];

    if (visibleCount < value.length) {
      const loadMore = makeButton(`顯示更多（已顯示 ${visible.length}／${value.length}）`);
      loadMore.addEventListener('click', () => {
        visibleCount += CHUNK_SIZE;
        status.replaceChildren(...renderReadyBody(participantId, drillId, value));
      });
      elements.push(loadMore);
    }
    return elements;
  }

  function renderPendingAnalysis(): void {
    const message = document.createElement('p');
    message.textContent = '趨勢分級尚未提供（等待 metric registry，WP-49 T4）；請切換回「全部」查看所有 run。';
    status.replaceChildren(message);
  }

  function render(input: DrillOverviewInput): void {
    currentParticipantId = input.participantId;
    currentDrillId = input.drillId;

    for (const [value, button] of filterButtons) {
      const active = value === input.runFilter;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.style.cssText = active ? `${buttonCss};border-color:#7cc7ff;color:#7cc7ff` : buttonCss;
    }

    if (input.runFilter !== 'all') {
      status.dataset.historyStatus = 'pending-analysis';
      renderPendingAnalysis();
      return;
    }

    const state = input.runs;
    status.dataset.historyStatus = state.status;

    if (state.status === 'idle' || state.status === 'loading') {
      const message = document.createElement('p');
      message.textContent = '載入中…';
      const previous = state.status === 'loading' ? state.previous : undefined;
      status.replaceChildren(message, ...(previous !== undefined ? renderReadyBody(input.participantId, input.drillId, previous) : []));
      return;
    }

    if (state.status === 'empty') {
      const message = document.createElement('p');
      message.textContent = '這個 drill 尚無 Assessment run 紀錄。';
      status.replaceChildren(message);
      return;
    }

    if (state.status === 'error') {
      const message = document.createElement('p');
      message.textContent = `讀取失敗：${state.message}`;
      const children: HTMLElement[] = [message];
      if (state.retryable) {
        const retryButton = makeButton('重試');
        retryButton.addEventListener('click', () => controller.retry('runs'));
        children.push(retryButton);
      }
      status.replaceChildren(...children);
      return;
    }

    status.replaceChildren(...renderReadyBody(input.participantId, input.drillId, state.value));
  }

  return {
    element: root,
    render,
    dispose(): void {
      root.remove();
    },
  };
}
