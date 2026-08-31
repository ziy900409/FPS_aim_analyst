/**
 * WP-49 T3 — read-only historical Assessment Result (README §2.9 FR-49.5). Renders through the
 * exact same `ResultDetailBody` the current in-session `ResultScreen` uses (D-49.P4); the only
 * actions here are Back, Download JSON/CSV bound to *this* route's loaded payload (never the live
 * in-flight recorder — FM-49.8), and an optional typed `onReplay` port (FR-49.13) that renders no
 * button at all when absent — wired to a real, working handler by WP-50 T6.
 */

import type { AsyncState, HistoricalRunPresentation } from '../../history/HistoryLibraryController.ts';
import { downloadCSV, downloadJSON } from '../../data/export.ts';
import { exportBasename } from '../../results/ResultPresentation.ts';
import { createResultDetailBody } from '../ResultDetailBody.ts';

export interface HistoricalRunDetailOptions {
  readonly onBack: () => void;
  readonly onRetry: () => void;
  readonly onReplay?: (runId: string) => void;
}

export interface HistoricalRunDetailInput {
  readonly runDetail: AsyncState<HistoricalRunPresentation>;
  readonly runId: string;
}

export interface HistoricalRunDetailHandle {
  readonly element: HTMLElement;
  render(input: HistoricalRunDetailInput): void;
  dispose(): void;
}

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

export function createHistoricalRunDetail(options: HistoricalRunDetailOptions): HistoricalRunDetailHandle {
  const root = document.createElement('div');
  root.dataset.section = 'historical-run-detail';

  const actions = document.createElement('div');
  actions.dataset.section = 'historical-run-actions';
  actions.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap';

  const backButton = makeButton('返回 Run 列表');
  backButton.dataset.historyAction = 'back';
  backButton.addEventListener('click', () => options.onBack());

  const exportJSONButton = makeButton('匯出 JSON');
  exportJSONButton.dataset.historyAction = 'export-json';
  const exportCSVButton = makeButton('匯出 CSV');
  exportCSVButton.dataset.historyAction = 'export-csv';

  actions.append(backButton, exportJSONButton, exportCSVButton);

  let replayButton: HTMLButtonElement | undefined;
  if (options.onReplay !== undefined) {
    replayButton = makeButton('3D 重播');
    replayButton.dataset.historyAction = 'replay';
    actions.appendChild(replayButton);
  }

  const status = document.createElement('div');
  status.dataset.section = 'historical-run-status';
  status.setAttribute('aria-live', 'polite');

  const body = createResultDetailBody();
  body.element.style.display = 'none';

  root.append(actions, status, body.element);

  let currentPayload: HistoricalRunPresentation['payload'] | undefined;
  let currentRunId = '';

  exportJSONButton.addEventListener('click', () => {
    if (currentPayload === undefined) return;
    downloadJSON(currentPayload, { basename: exportBasename(currentPayload) });
  });
  exportCSVButton.addEventListener('click', () => {
    if (currentPayload === undefined) return;
    downloadCSV(currentPayload, { basename: exportBasename(currentPayload) });
  });
  replayButton?.addEventListener('click', () => {
    if (options.onReplay === undefined) return;
    options.onReplay(currentRunId);
  });

  function setActionsEnabled(enabled: boolean): void {
    exportJSONButton.disabled = !enabled;
    exportCSVButton.disabled = !enabled;
    if (replayButton !== undefined) replayButton.disabled = !enabled;
  }

  function render(input: HistoricalRunDetailInput): void {
    currentRunId = input.runId;
    const state = input.runDetail;
    status.dataset.historyStatus = state.status;

    if (state.status === 'idle' || state.status === 'loading') {
      currentPayload = undefined;
      setActionsEnabled(false);
      body.element.style.display = 'none';
      const message = document.createElement('p');
      message.textContent = '載入中…';
      status.replaceChildren(message);
      return;
    }

    if (state.status === 'empty') {
      currentPayload = undefined;
      setActionsEnabled(false);
      body.element.style.display = 'none';
      const message = document.createElement('p');
      message.textContent = '找不到這筆 Assessment run。';
      status.replaceChildren(message);
      return;
    }

    if (state.status === 'error') {
      currentPayload = undefined;
      setActionsEnabled(false);
      body.element.style.display = 'none';
      const message = document.createElement('p');
      message.textContent = `讀取失敗：${state.message}`;
      const children: HTMLElement[] = [message];
      if (state.retryable) {
        const retryButton = makeButton('重試');
        retryButton.addEventListener('click', () => options.onRetry());
        children.push(retryButton);
      }
      status.replaceChildren(...children);
      return;
    }

    currentPayload = state.value.payload;
    setActionsEnabled(true);
    status.replaceChildren();
    body.element.style.display = '';
    body.render(state.value.result);
  }

  return {
    element: root,
    render,
    dispose(): void {
      body.dispose();
      root.remove();
    },
  };
}
