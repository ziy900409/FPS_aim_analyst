/**
 * Current-run Result dialog chrome (title, restart/export actions, history-save-status embed).
 * WP-49 T3 split this file: the read-only metrics/diagnosis/quality-flags body now lives in
 * `ResultDetailBody.ts` so a historical Assessment Result (`ui/history/HistoricalRunDetail.ts`)
 * can render through the exact same code path (D-49.P4) without owning any restart/save action.
 */

import { createResultDetailBody } from './ResultDetailBody.ts';
import type { ResultPresentation } from '../results/ResultPresentation.ts';

export interface ResultScreenHandle {
  readonly visible: boolean;
  show(result: ResultPresentation): void;
  hide(): void;
  dispose(): void;
}

export interface ResultScreenOptions {
  parent?: HTMLElement;
  /** WP-48 T5 — `HistorySaveStatus.element`. Presentation-only embed; this screen owns no payload or client. */
  saveStatusView?: HTMLElement;
  /** Starts a clean run of the currently selected drill. */
  onRestart?: () => void | Promise<void>;
  /** Exports the current result before the user starts another run. */
  onExportJSON?: () => void | Promise<void>;
  /** Exports the current result before the user starts another run. */
  onExportCSV?: () => void | Promise<void>;
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

  const body = createResultDetailBody();

  // Results may be long enough to scroll. Keep the next actions in the dialog itself so the
  // user does not need to discover the separate, dimmed drill-controls overlay underneath.
  const actions = document.createElement('footer');
  actions.dataset.section = 'result-actions';
  actions.style.cssText = [
    'position:sticky',
    'bottom:-20px',
    'display:flex',
    'flex-wrap:wrap',
    'align-items:center',
    'gap:8px',
    'margin:18px -20px -20px',
    'padding:12px 20px',
    'background:rgba(24,27,30,0.98)',
    'border-top:1px solid rgba(255,255,255,0.12)',
  ].join(';');

  const restartHint = document.createElement('span');
  restartHint.textContent = '重新測試會清除目前畫面結果；請先匯出需要保留的資料。';
  restartHint.style.cssText = 'flex:1 1 260px;color:#c8d0d8;font:500 12px/1.35 system-ui,sans-serif';

  const restartButton = makeResultActionButton('再測目前 Drill', 'restart', true);
  const exportJSONButton = makeResultActionButton('匯出 JSON', 'export-json');
  const exportCSVButton = makeResultActionButton('匯出 CSV', 'export-csv');
  const closeButton = makeResultActionButton('返回設定', 'close');
  const actionButtons = [restartButton, exportJSONButton, exportCSVButton, closeButton];

  restartButton.style.display = options.onRestart === undefined ? 'none' : '';
  exportJSONButton.style.display = options.onExportJSON === undefined ? 'none' : '';
  exportCSVButton.style.display = options.onExportCSV === undefined ? 'none' : '';
  if (options.onRestart === undefined && options.onExportJSON === undefined && options.onExportCSV === undefined) {
    restartHint.style.display = 'none';
  }

  restartButton.addEventListener('click', () => {
    if (options.onRestart === undefined) return;
    if (!window.confirm('重新測試會清除目前這輪結果。若需要保留，請先匯出 JSON 或 CSV。要重新開始嗎？')) return;
    void runResultAction(actionButtons, options.onRestart);
  });
  exportJSONButton.addEventListener('click', () => {
    if (options.onExportJSON !== undefined) void runResultAction(actionButtons, options.onExportJSON);
  });
  exportCSVButton.addEventListener('click', () => {
    if (options.onExportCSV !== undefined) void runResultAction(actionButtons, options.onExportCSV);
  });
  closeButton.addEventListener('click', () => {
    visible = false;
    root.style.display = 'none';
  });

  actions.append(restartHint, restartButton, exportJSONButton, exportCSVButton, closeButton);

  panel.append(
    title,
    body.element,
    ...(options.saveStatusView === undefined ? [] : [options.saveStatusView]),
    actions,
  );
  root.appendChild(panel);
  parent.appendChild(root);

  return {
    get visible(): boolean {
      return visible;
    },
    show(result: ResultPresentation): void {
      body.render(result);
      visible = true;
      root.style.display = 'flex';
    },
    hide(): void {
      visible = false;
      root.style.display = 'none';
    },
    dispose(): void {
      body.dispose();
      root.remove();
    },
  };
}

function makeResultActionButton(label: string, action: string, primary = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.resultAction = action;
  button.style.cssText = [
    'height:34px',
    'padding:0 12px',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:6px',
    'font:750 12px/1 system-ui,sans-serif',
    'color:#e6e9ec',
    `background:${primary ? '#176b9c' : 'rgba(15,18,21,0.96)'}`,
    'cursor:pointer',
  ].join(';');
  return button;
}

async function runResultAction(
  buttons: readonly HTMLButtonElement[],
  action: () => void | Promise<void>,
): Promise<void> {
  for (const button of buttons) button.disabled = true;
  try {
    await action();
  } catch (error) {
    console.error('[result-screen]', error);
    window.alert(error instanceof Error ? error.message : 'Result action failed');
  } finally {
    for (const button of buttons) button.disabled = false;
  }
}
