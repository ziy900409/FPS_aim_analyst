/**
 * WP-49 T2 — exact-`drillId` browse cards for a single Participant (README §2.9, FR-49.3). Owns
 * the `drills` `AsyncState` end to end (loading/empty/error/ready); `HistoryScreen` only decides
 * *when* this component is visible. Cards group strictly by exact `drillId` as returned by the API
 * — no prefix/family merge (D-49.P3): `drill-a` and `drill-a-v2` always render as two cards.
 */

import type { AsyncState, HistoryLibraryController } from '../../history/HistoryLibraryController.ts';
import type { HistoryDrillSummary } from '../../history/contracts.ts';
import type { HistoryNavigator } from '../../history/navigation/HistoryNavigator.ts';

export interface DrillBrowserOptions {
  readonly navigator: HistoryNavigator;
  readonly controller: HistoryLibraryController;
}

export interface DrillBrowserInput {
  readonly drills: AsyncState<readonly HistoryDrillSummary[]>;
  readonly participantId: string;
}

export interface DrillBrowserHandle {
  readonly element: HTMLElement;
  render(input: DrillBrowserInput): void;
  dispose(): void;
}

// Mirrors ParticipantBrowser's chunk size (NFR-49.1 first-paint DOM bound) — defensive even
// though a single Participant is unlikely to have hundreds of exact drills.
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

function formatStartedAt(iso: string): { readonly local: string; readonly title: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { local: iso, title: iso };
  return { local: date.toLocaleString(), title: iso };
}

export function createDrillBrowser(options: DrillBrowserOptions): DrillBrowserHandle {
  const { navigator, controller } = options;

  const root = document.createElement('div');
  root.dataset.section = 'drill-browser';

  const status = document.createElement('div');
  status.dataset.section = 'drill-status';
  status.setAttribute('aria-live', 'polite');
  root.appendChild(status);

  function renderRows(participantId: string, rows: readonly HistoryDrillSummary[]): HTMLUListElement {
    const list = document.createElement('ul');
    list.style.cssText = 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px';
    for (const row of rows) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.style.cssText = `${buttonCss};width:100%;height:auto;padding:8px 12px;text-align:left;display:flex;justify-content:space-between;gap:12px`;

      const idLabel = document.createElement('span');
      idLabel.textContent = row.drillId;
      idLabel.style.cssText = 'font-weight:700;word-break:break-all';

      const { local, title } = formatStartedAt(row.latestStartedAt);
      const meta = document.createElement('span');
      meta.textContent = `${row.runCount} runs・最近 ${local}`;
      meta.title = title;
      meta.style.cssText = 'opacity:0.75;white-space:nowrap';

      button.append(idLabel, meta);
      button.addEventListener('click', () =>
        navigator.push({ kind: 'drill', participantId, drillId: row.drillId, runFilter: 'all' }),
      );
      item.appendChild(button);
      list.appendChild(item);
    }
    return list;
  }

  let lastValue: readonly HistoryDrillSummary[] | undefined;
  let lastParticipantId: string | undefined;
  let visibleCount = CHUNK_SIZE;

  function renderReadyBody(participantId: string, value: readonly HistoryDrillSummary[]): HTMLElement[] {
    if (lastValue !== value || lastParticipantId !== participantId) {
      visibleCount = CHUNK_SIZE;
      lastValue = value;
      lastParticipantId = participantId;
    }

    const summary = document.createElement('p');
    summary.textContent = `共 ${value.length} 筆。`;

    const visible = value.slice(0, visibleCount);
    const elements: HTMLElement[] = [summary, renderRows(participantId, visible)];

    if (visibleCount < value.length) {
      const loadMore = makeButton(`顯示更多（已顯示 ${visible.length}／${value.length}）`);
      loadMore.addEventListener('click', () => {
        visibleCount += CHUNK_SIZE;
        status.replaceChildren(...renderReadyBody(participantId, value));
      });
      elements.push(loadMore);
    }
    return elements;
  }

  function render(input: DrillBrowserInput): void {
    const state = input.drills;
    status.dataset.historyStatus = state.status;

    if (state.status === 'idle' || state.status === 'loading') {
      const message = document.createElement('p');
      message.textContent = '載入中…';
      const previous = state.status === 'loading' ? state.previous : undefined;
      status.replaceChildren(message, ...(previous !== undefined ? renderReadyBody(input.participantId, previous) : []));
      return;
    }

    if (state.status === 'empty') {
      const message = document.createElement('p');
      message.textContent = '這位 Participant 尚無 Assessment drill 紀錄。';
      status.replaceChildren(message);
      return;
    }

    if (state.status === 'error') {
      const message = document.createElement('p');
      message.textContent = `讀取失敗：${state.message}`;
      const children: HTMLElement[] = [message];
      if (state.retryable) {
        const retryButton = makeButton('重試');
        retryButton.addEventListener('click', () => controller.retry('drills'));
        children.push(retryButton);
      }
      status.replaceChildren(...children);
      return;
    }

    status.replaceChildren(...renderReadyBody(input.participantId, state.value));
  }

  return {
    element: root,
    render,
    dispose(): void {
      root.remove();
    },
  };
}
