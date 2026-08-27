/**
 * WP-49 T2 — Participant search + browse list (README §2.9, FR-49.2). Owns the `participants`
 * `AsyncState` end to end (loading/empty/search-empty/error/ready) plus the non-blocking health
 * exclusion-count banner (OQ-49.5); `HistoryScreen` only decides *when* this component is visible.
 *
 * Search is a client-side substring filter over already-loaded summaries (README §1.4
 * Assumptions) — it must never trigger a re-fetch. The input is kept in sync with
 * `HistoryRoute['participants'].query` via `navigator.replace()` (no new history entry per
 * keystroke) so the search term survives reload/Back-Forward (FR-49.6); the raw `participantId`
 * itself is never normalized or rewritten (FR-49.2).
 */

import type { AsyncState, HistoryLibraryController } from '../../history/HistoryLibraryController.ts';
import type { HistoryIndexReport, HistoryParticipantSummary } from '../../history/contracts.ts';
import type { HistoryNavigator } from '../../history/navigation/HistoryNavigator.ts';

export interface ParticipantBrowserOptions {
  readonly navigator: HistoryNavigator;
  readonly controller: HistoryLibraryController;
}

export interface ParticipantBrowserInput {
  readonly participants: AsyncState<readonly HistoryParticipantSummary[]>;
  readonly query: string;
  readonly health?: HistoryIndexReport;
}

export interface ParticipantBrowserHandle {
  readonly element: HTMLElement;
  render(input: ParticipantBrowserInput): void;
  dispose(): void;
}

// A batch of 100 keeps first-paint DOM node count bounded (NFR-49.1) regardless of how many
// participants matched; "顯示更多" reveals the next batch on demand rather than ever appending
// the full result set at once (T2 Steps §3).
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

/** Local display string + a full-precision UTC `title` for hover/inspection (README §1.4
 * Assumptions: "UI 顯示 browser local time,同時提供完整 UTC ISO"). Falls back to the raw ISO
 * string on an unparsable value rather than showing "Invalid Date". */
function formatStartedAt(iso: string): { readonly local: string; readonly title: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { local: iso, title: iso };
  return { local: date.toLocaleString(), title: iso };
}

export function createParticipantBrowser(options: ParticipantBrowserOptions): ParticipantBrowserHandle {
  const { navigator, controller } = options;

  const root = document.createElement('div');
  root.dataset.section = 'participant-browser';

  const healthBanner = document.createElement('div');
  healthBanner.dataset.section = 'history-health-banner';
  healthBanner.setAttribute('role', 'status');
  healthBanner.style.cssText = [
    'display:none',
    'margin-bottom:12px',
    'padding:8px 10px',
    'border-radius:6px',
    'background:rgba(255,193,7,0.12)',
    'border:1px solid rgba(255,193,7,0.4)',
    'font:500 12px/1.4 system-ui,sans-serif',
  ].join(';');

  const searchRow = document.createElement('div');
  searchRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = '輸入 Participant ID 的一部分';
  searchInput.setAttribute('aria-label', '搜尋 Participant');
  searchInput.style.cssText = [
    'flex:1 1 auto',
    'height:30px',
    'padding:0 8px',
    'border-radius:6px',
    'border:1px solid rgba(255,255,255,0.18)',
    'background:rgba(24,27,30,0.96)',
    'color:#e6e9ec',
    'font:500 13px/1 system-ui,sans-serif',
  ].join(';');

  const clearButton = makeButton('清除搜尋');
  clearButton.style.display = 'none';

  searchRow.append(searchInput, clearButton);

  const status = document.createElement('div');
  status.dataset.section = 'participant-status';
  status.setAttribute('aria-live', 'polite');

  root.append(healthBanner, searchRow, status);

  function pushSearch(nextQuery: string): void {
    const current = navigator.current;
    if (current === undefined || current.kind !== 'participants') return;
    if (current.query === nextQuery) return;
    navigator.replace({ kind: 'participants', query: nextQuery });
  }

  searchInput.addEventListener('input', () => pushSearch(searchInput.value));
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    pushSearch('');
    searchInput.focus();
  });

  function renderHealth(health: HistoryIndexReport | undefined): void {
    if (health === undefined) {
      healthBanner.style.display = 'none';
      healthBanner.replaceChildren();
      return;
    }
    const flaggedCount = health.invalidFileCount + health.unsupportedFileCount + health.excludedPracticeFileCount;
    if (flaggedCount === 0) {
      healthBanner.style.display = 'none';
      healthBanner.replaceChildren();
      return;
    }
    const message = document.createElement('p');
    message.style.cssText = 'margin:0';
    message.textContent = `有 ${flaggedCount} 個檔案未列入歷史（不支援格式 ${health.unsupportedFileCount}、無法解析 ${health.invalidFileCount}、Practice ${health.excludedPracticeFileCount}）。`;
    healthBanner.replaceChildren(message);
    healthBanner.style.display = '';
  }

  function renderRows(rows: readonly HistoryParticipantSummary[]): HTMLUListElement {
    const list = document.createElement('ul');
    list.style.cssText = 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px';
    for (const row of rows) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.style.cssText = `${buttonCss};width:100%;height:auto;padding:8px 12px;text-align:left;display:flex;justify-content:space-between;gap:12px`;

      const idLabel = document.createElement('span');
      idLabel.textContent = row.participantId;
      idLabel.style.cssText = 'font-weight:700;word-break:break-all';

      const { local, title } = formatStartedAt(row.latestStartedAt);
      const meta = document.createElement('span');
      meta.textContent = `${row.drillCount} drills・${row.runCount} runs・最近 ${local}`;
      meta.title = title;
      meta.style.cssText = 'opacity:0.75;white-space:nowrap';

      button.append(idLabel, meta);
      button.addEventListener('click', () => navigator.push({ kind: 'drills', participantId: row.participantId }));
      item.appendChild(button);
      list.appendChild(item);
    }
    return list;
  }

  // Reset the reveal-on-demand cursor whenever the underlying dataset identity or the active
  // search term changes, so a stale chunk count from a previous filter never leaks in.
  let lastValue: readonly HistoryParticipantSummary[] | undefined;
  let lastQuery: string | undefined;
  let visibleCount = CHUNK_SIZE;

  function renderReadyBody(value: readonly HistoryParticipantSummary[], query: string): HTMLElement[] {
    if (lastValue !== value || lastQuery !== query) {
      visibleCount = CHUNK_SIZE;
      lastValue = value;
      lastQuery = query;
    }

    const needle = query.trim().toLowerCase();
    const filtered = needle.length === 0 ? value : value.filter((p) => p.participantId.toLowerCase().includes(needle));

    const summary = document.createElement('p');
    summary.textContent = `共 ${filtered.length} 筆。`;

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = '搜尋無結果。';
      return [summary, empty];
    }

    const visible = filtered.slice(0, visibleCount);
    const elements: HTMLElement[] = [summary, renderRows(visible)];

    if (visibleCount < filtered.length) {
      const loadMore = makeButton(`顯示更多（已顯示 ${visible.length}／${filtered.length}）`);
      loadMore.addEventListener('click', () => {
        visibleCount += CHUNK_SIZE;
        status.replaceChildren(...renderReadyBody(value, query));
      });
      elements.push(loadMore);
    }
    return elements;
  }

  function render(input: ParticipantBrowserInput): void {
    renderHealth(input.health);

    if (document.activeElement !== searchInput && searchInput.value !== input.query) {
      searchInput.value = input.query;
    }
    clearButton.style.display = input.query.length > 0 ? '' : 'none';

    const state = input.participants;
    status.dataset.historyStatus = state.status;

    if (state.status === 'idle' || state.status === 'loading') {
      const message = document.createElement('p');
      message.textContent = '載入中…';
      const previous = state.status === 'loading' ? state.previous : undefined;
      status.replaceChildren(message, ...(previous !== undefined ? renderReadyBody(previous, input.query) : []));
      return;
    }

    if (state.status === 'empty') {
      const message = document.createElement('p');
      message.textContent = '尚無 Participant 紀錄。';
      status.replaceChildren(message);
      return;
    }

    if (state.status === 'error') {
      const message = document.createElement('p');
      message.textContent = `讀取失敗：${state.message}`;
      const children: HTMLElement[] = [message];
      if (state.retryable) {
        const retryButton = makeButton('重試');
        retryButton.addEventListener('click', () => controller.retry('participants'));
        children.push(retryButton);
      }
      status.replaceChildren(...children);
      return;
    }

    status.replaceChildren(...renderReadyBody(state.value, input.query));
  }

  return {
    element: root,
    render,
    dispose(): void {
      root.remove();
    },
  };
}
