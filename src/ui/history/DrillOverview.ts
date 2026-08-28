/**
 * WP-49 T3/T5 — exact-drill overview: metric/cohort trend (README §2.9 FR-49.4's trend half, T5)
 * above the full Assessment run list (T3's run-list half). Runs render in the order the WP-48
 * repository already returns them — `startedAt desc`, tied broken by `runId` ascending
 * (`HistoryRepository.listRuns`) — this component never re-sorts client-side.
 *
 * The trend section is driven by `HistoryLibraryController.state.observations` (auto-paginated,
 * README §2.6/OQ-49.4) plus a client-side `DrillMetricRegistry` lookup for descriptors — the
 * registry is a pure, network-free module shared with the server-side analysis service (T4), so
 * looking up `registrationForExactDrill(drillId)` here needs no round-trip. Metric/cohort selection
 * and the `all | trend-eligible | excluded` run filter (README §2.3 `HistoryRoute['drill']`) all
 * live in the route (FR-49.6 — reload/Back-Forward must reproduce the same view); until T4's
 * eligibility signal is per-run-classifiable in the run list itself, `trend-eligible`/`excluded`
 * still render a pending-analysis notice for the run list (T3 Steps §4 decision, unchanged by T5).
 */

import type { AsyncState, HistoryLibraryController, HistoryObservationCollection } from '../../history/HistoryLibraryController.ts';
import type { HistoryRunSummary } from '../../history/contracts.ts';
import type { HistoryNavigator } from '../../history/navigation/HistoryNavigator.ts';
import type { HistoryRunFilter } from '../../history/navigation/HistoryRoute.ts';
import type { DrillMetricRegistry, DrillMetricRegistration, MetricDescriptor } from '../../history/DrillMetricRegistry.ts';
import { buildHistoryTrend, listCompatibilityCohorts, type CompatibilityCohort } from '../../history/HistoryTrend.ts';
import { createTrendChart } from './TrendChart.ts';

export interface DrillOverviewOptions {
  readonly navigator: HistoryNavigator;
  readonly controller: HistoryLibraryController;
  readonly registry: DrillMetricRegistry;
}

export interface DrillOverviewInput {
  readonly runs: AsyncState<readonly HistoryRunSummary[]>;
  readonly observations: AsyncState<HistoryObservationCollection>;
  readonly participantId: string;
  readonly drillId: string;
  readonly runFilter: HistoryRunFilter;
  readonly metricId?: string;
  readonly cohortId?: string;
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

const activeButtonCss = `${buttonCss};border-color:#7cc7ff;color:#7cc7ff`;

function makeButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cssText = buttonCss;
  return button;
}

function makeMessage(text: string): HTMLParagraphElement {
  const message = document.createElement('p');
  message.textContent = text;
  return message;
}

const FILTERS: readonly { readonly value: HistoryRunFilter; readonly label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'trend-eligible', label: '可納入趨勢' },
  { value: 'excluded', label: '已排除' },
];

const EXCLUSION_REASON_LABELS: Readonly<Record<string, string>> = {
  'not-ready': '無法計算（projection 失敗或不支援）',
  'quality-gate': '未通過 quality gate',
  'other-cohort': '屬於其他 compatibility cohort',
  'missing-metric': '缺少此指標的有效資料',
};

const TREND_EMPTY_REASON_LABELS: Readonly<Record<string, string>> = {
  'unregistered-drill': '此 drill 尚未註冊歷史指標，暫無趨勢可顯示。',
  'no-finite-values': '所選指標目前沒有可用的有效數值。',
  'insufficient-data': '目前沒有足夠的合格資料可產生趨勢（可能都被 quality gate 排除，或所選 cohort 沒有符合的 run）。',
};

function formatStartedAt(iso: string): { readonly local: string; readonly title: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { local: iso, title: iso };
  return { local: date.toLocaleString(), title: iso };
}

export function createDrillOverview(options: DrillOverviewOptions): DrillOverviewHandle {
  const { navigator, controller, registry } = options;

  const root = document.createElement('div');
  root.dataset.section = 'drill-overview';

  // ---------------------------------------------------------------------
  // Trend section (README §2.9 — above the run list)
  // ---------------------------------------------------------------------

  const trendSection = document.createElement('section');
  trendSection.dataset.section = 'drill-trend';
  trendSection.setAttribute('aria-label', '趨勢');
  trendSection.style.cssText = 'margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.12)';

  const metricRow = document.createElement('div');
  metricRow.setAttribute('role', 'group');
  metricRow.setAttribute('aria-label', '選擇指標');
  metricRow.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap';

  const cohortRow = document.createElement('div');
  cohortRow.setAttribute('role', 'group');
  cohortRow.setAttribute('aria-label', '選擇 compatibility cohort');
  cohortRow.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap';

  const progressLine = document.createElement('p');
  progressLine.dataset.section = 'trend-progress';
  progressLine.style.cssText = 'margin:0 0 8px;opacity:0.75';

  const trendBody = document.createElement('div');
  trendBody.dataset.section = 'trend-body';
  trendBody.setAttribute('aria-live', 'polite');

  const trendChart = createTrendChart();

  trendSection.append(metricRow, cohortRow, progressLine, trendBody);
  root.appendChild(trendSection);

  // ---------------------------------------------------------------------
  // Run list section (T3, unchanged)
  // ---------------------------------------------------------------------

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
  let currentMetricId: string | undefined;
  let currentCohortId: string | undefined;
  let currentRunFilter: HistoryRunFilter = 'all';

  for (const [value, button] of filterButtons) {
    button.addEventListener('click', () => {
      navigator.replace({
        kind: 'drill',
        participantId: currentParticipantId,
        drillId: currentDrillId,
        metricId: currentMetricId,
        cohortId: currentCohortId,
        runFilter: value,
      });
    });
  }

  function pushDrillRoute(overrides: { readonly metricId?: string; readonly cohortId?: string }): void {
    navigator.replace({
      kind: 'drill',
      participantId: currentParticipantId,
      drillId: currentDrillId,
      metricId: 'metricId' in overrides ? overrides.metricId : currentMetricId,
      cohortId: 'cohortId' in overrides ? overrides.cohortId : currentCohortId,
      runFilter: currentRunFilter,
    });
  }

  function renderMetricSelector(registration: DrillMetricRegistration, selectedDescriptor: MetricDescriptor): void {
    const buttons = registration.descriptors.map((descriptor) => {
      const button = makeButton(`${descriptor.label}（${descriptor.unit}）`);
      button.dataset.metricId = descriptor.id;
      const active = descriptor.id === selectedDescriptor.id;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.style.cssText = active ? activeButtonCss : buttonCss;
      button.addEventListener('click', () => pushDrillRoute({ metricId: descriptor.id }));
      return button;
    });
    metricRow.replaceChildren(...buttons);
  }

  function renderCohortSelector(cohorts: readonly CompatibilityCohort[], selectedCohortId: string | undefined): void {
    if (cohorts.length <= 1) {
      cohortRow.replaceChildren();
      return;
    }
    const buttons = cohorts.map((cohort) => {
      const button = makeButton(`${cohort.label}（n=${cohort.runCount}）`);
      button.title = cohort.id;
      button.dataset.cohortId = cohort.id;
      const active = cohort.id === selectedCohortId;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.style.cssText = active ? activeButtonCss : buttonCss;
      button.addEventListener('click', () => pushDrillRoute({ cohortId: cohort.id }));
      return button;
    });
    cohortRow.replaceChildren(...buttons);
  }

  function renderProgress(collection: HistoryObservationCollection): void {
    const loaded = collection.items.length;
    const parts = [`已載入 ${loaded}／${collection.total} 筆 run 的分析資料`];
    if (collection.loadingMore) parts.push('（背景載入中…）');
    progressLine.replaceChildren(document.createTextNode(parts.join('')));
    if (collection.loadMoreError !== undefined) {
      const errorLine = document.createElement('span');
      errorLine.textContent = `　部分資料載入失敗：${collection.loadMoreError.message}　`;
      progressLine.appendChild(errorLine);
      if (collection.loadMoreError.retryable) {
        const retryButton = makeButton('重試載入更多');
        retryButton.addEventListener('click', () => controller.loadNextObservationPage());
        progressLine.appendChild(retryButton);
      }
    }
  }

  function renderExclusionSummary(excludedCounts: Readonly<Record<string, number>>): HTMLElement | undefined {
    const entries = Object.entries(excludedCounts).filter(([, count]) => count > 0);
    if (entries.length === 0) return undefined;
    const summary = document.createElement('p');
    summary.dataset.section = 'trend-exclusion-summary';
    const parts = entries.map(([reason, count]) => `${EXCLUSION_REASON_LABELS[reason] ?? reason}：${count} 筆`);
    summary.textContent = `已排除：${parts.join('、')}。`;
    return summary;
  }

  function renderTrendSection(input: DrillOverviewInput): void {
    currentMetricId = input.metricId;
    currentCohortId = input.cohortId;

    const registration = registry.registrationForExactDrill(input.drillId);
    if (registration === undefined) {
      metricRow.replaceChildren();
      cohortRow.replaceChildren();
      progressLine.replaceChildren();
      trendBody.replaceChildren(makeMessage(TREND_EMPTY_REASON_LABELS['unregistered-drill']));
      return;
    }

    const obsState = input.observations;

    if (obsState.status === 'idle' || obsState.status === 'loading') {
      metricRow.replaceChildren();
      cohortRow.replaceChildren();
      progressLine.replaceChildren();
      trendBody.replaceChildren(makeMessage('趨勢資料載入中…'));
      return;
    }

    if (obsState.status === 'empty') {
      metricRow.replaceChildren();
      cohortRow.replaceChildren();
      progressLine.replaceChildren();
      trendBody.replaceChildren(makeMessage(TREND_EMPTY_REASON_LABELS['insufficient-data']));
      return;
    }

    if (obsState.status === 'error') {
      metricRow.replaceChildren();
      cohortRow.replaceChildren();
      progressLine.replaceChildren();
      const children: HTMLElement[] = [makeMessage(`趨勢資料讀取失敗：${obsState.message}`)];
      if (obsState.retryable) {
        const retryButton = makeButton('重試');
        retryButton.addEventListener('click', () => controller.retry('observations'));
        children.push(retryButton);
      }
      trendBody.replaceChildren(...children);
      return;
    }

    const collection = obsState.value;
    renderProgress(collection);

    const cohorts = listCompatibilityCohorts(collection.items);
    const trend = buildHistoryTrend({
      projections: collection.items,
      registration,
      metricId: input.metricId,
      cohortId: input.cohortId,
    });

    const selectedDescriptor =
      trend.status === 'ready' ? trend.descriptor : (registration.descriptors.find((d) => d.id === input.metricId) ?? registration.descriptors.find((d) => d.primary) ?? registration.descriptors[0]);
    renderMetricSelector(registration, selectedDescriptor);
    renderCohortSelector(cohorts, trend.status === 'ready' ? trend.cohort.id : input.cohortId);

    if (trend.status === 'empty') {
      trendBody.replaceChildren(makeMessage(TREND_EMPTY_REASON_LABELS[trend.reason] ?? trend.reason));
      return;
    }

    trendChart.render({ descriptor: trend.descriptor, points: trend.points });
    const exclusionSummary = renderExclusionSummary(trend.excludedCounts);
    trendBody.replaceChildren(trendChart.element, ...(exclusionSummary === undefined ? [] : [exclusionSummary]));
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
    currentRunFilter = input.runFilter;

    renderTrendSection(input);

    for (const [value, button] of filterButtons) {
      const active = value === input.runFilter;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.style.cssText = active ? activeButtonCss : buttonCss;
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
      trendChart.dispose();
      root.remove();
    },
  };
}
