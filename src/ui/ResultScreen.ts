/**
 * Current-run Result dialog chrome (title, restart/export actions, history-save-status embed).
 * WP-49 T3 split this file: the read-only metrics/diagnosis/quality-flags body now lives in
 * `ResultDetailBody.ts` so a historical Assessment Result (`ui/history/HistoricalRunDetail.ts`)
 * can render through the exact same code path (D-49.P4) without owning any restart/save action.
 */

import { createResultDetailBody } from './ResultDetailBody.ts';
import type { ResultPresentation } from '../results/ResultPresentation.ts';

/** WP-49 T5 (FR-49.12) — where "查看此 Drill 歷史" navigates: the exact Participant/drill this
 * result was saved under. Never a runId — the button only becomes visible once the run is known to
 * be saved (`setHistoryTarget`), so there is nothing to guess (T5 high-risk failure mode table). */
export interface HistoryDrillTarget {
  readonly participantId: string;
  readonly drillId: string;
}

/**
 * WP-69 / T4（FR-69.8，OQ-69.1 / D-69-T0-3）— 一場 `invalid-retained` 的 Result 說明與**唯一**的
 * 保留動作。自動下載已在 T0 被使用者推翻，所以這份稽核檔只有操作員按下去才存在；那讓「按鈕看不到
 * 或點不到」等同於資料遺失，因此位置是硬性要求而非美學：
 *
 * T0.6 實測 `#drill-controls`（z-index 32）疊在 `#result-screen`（30）之上，會蓋住面板下緣置中
 * 一帶——正是 `result-actions` 那條 sticky footer 的所在。所以這顆鈕**不**進 footer，而是長在面板
 * 最上方的警示條裡：既避開被蓋住的區域，也讓「本次無效、此檔僅供稽核」在看到任何數字之前就讀到。
 */
export interface InvalidAttemptNotice {
  readonly text: string;
  readonly downloadLabel: string;
  readonly onDownload: () => void | Promise<void>;
}

export interface ResultScreenHandle {
  readonly visible: boolean;
  show(result: ResultPresentation): void;
  /**
   * `null` = 這是一場可採納的 candidate（既有行為，逐位不變）。非 `null` = 不可採納：顯示警示條與
   * 稽核檔下載鈕，並收起正式匯出／3D 重播入口——後兩者會產出看起來像正式紀錄的東西。
   * 與 `setValidityWarning` 同紀律：呼叫端每次 `show()` 後都必須明確設定一次（含 `null`）。
   */
  setInvalidAttempt(notice: InvalidAttemptNotice | null): void;
  /** Shows "查看此 Drill 歷史" once `target` is known (a successful Assessment save), hides it
   * otherwise — including for the whole lifetime of a Practice result, which never calls this with
   * a defined target (FR-49.12 "Practice Result不顯示歷史入口"). */
  setHistoryTarget(target: HistoryDrillTarget | undefined): void;
  /**
   * WP-65 / T5（FR-65.11）— `null` 清除警示；字串顯示於結果數值**之上**的警示條。
   * 純呈現：本畫面不擁有 payload、不決定 `suspect`，呼叫端每次 `show()` 都必須呼叫一次
   * （含傳 `null`），否則上一場的警示會殘留到下一場。
   */
  setValidityWarning(text: string | null): void;
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
  /** WP-49 T5 (FR-49.12) — navigates to this result's exact Participant/drill history. The button
   * that triggers this stays hidden until `setHistoryTarget` supplies a target. */
  onOpenHistory?: (target: HistoryDrillTarget) => void;
  /** WP-50 T6 (FR-50.14) — opens the first-person 3D Replay for the payload backing the currently
   * shown result. Unlike `onOpenHistory`, this is available immediately (Assessment or Practice,
   * saved or not — OQ-50.2/D-50-P9): the caller already has the full in-memory `ExportPayload` the
   * moment `show()` is called, so there is no target to wait for. Full/partial/unsupported is
   * decided by the Replay screen itself after entry, not here. */
  onReplay?: () => void;
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

  // WP-65 / T5（FR-65.11）— 效度警示條。建構期一次配置、預設隱藏；`role="alert"` 讓螢幕閱讀器在
  // 內容寫入時朗讀。放在 `body` **之上**：受試者掃過數字之前就該知道這場可能要重測。
  const validityWarning = document.createElement('p');
  validityWarning.dataset.section = 'result-validity-warning';
  validityWarning.setAttribute('role', 'alert');
  validityWarning.hidden = true;
  validityWarning.style.cssText = [
    'margin:0 0 12px',
    'padding:10px 12px',
    'border:1px solid rgba(229,124,58,0.55)',
    'border-radius:6px',
    'background:rgba(120,58,12,0.32)',
    'color:#ffd9b0',
    'font:650 12px/1.45 system-ui,sans-serif',
  ].join(';');

  function setValidityWarning(text: string | null): void {
    if (text === null) {
      validityWarning.hidden = true;
      validityWarning.textContent = '';
      return;
    }
    validityWarning.textContent = text;
    validityWarning.hidden = false;
  }

  // WP-69 / T4（FR-69.8）— 不可採納警示條。刻意是**獨立**節點而非沿用 `validityWarning`：
  // `pointerLockLost` 是「這場可能有問題」的觀測，這一條是「這場不會被採納」的結論，兩者可以同時
  // 為真且不可互相取代（FR-69.11 的兩個構念）。紅底／更高對比,且排在最上面。
  const invalidAttemptNotice = document.createElement('div');
  invalidAttemptNotice.dataset.section = 'result-invalid-attempt';
  invalidAttemptNotice.setAttribute('role', 'alert');
  invalidAttemptNotice.hidden = true;
  invalidAttemptNotice.style.cssText = [
    'display:flex',
    'flex-wrap:wrap',
    'align-items:center',
    'gap:10px',
    'margin:0 0 12px',
    'padding:12px 14px',
    'border:1px solid rgba(229,78,78,0.66)',
    'border-radius:6px',
    'background:rgba(104,24,24,0.42)',
    'color:#ffd5d5',
    'font:700 13px/1.45 system-ui,sans-serif',
  ].join(';');

  const invalidAttemptText = document.createElement('span');
  invalidAttemptText.style.cssText = 'flex:1 1 320px';
  const invalidAttemptButton = makeResultActionButton('下載稽核檔', 'export-invalid-diagnostic', true);
  invalidAttemptNotice.append(invalidAttemptText, invalidAttemptButton);

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
  const historyEntryButton = makeResultActionButton('查看此 Drill 歷史', 'open-history');
  const replayButton = makeResultActionButton('3D 重播', 'replay');
  const closeButton = makeResultActionButton('返回設定', 'close');
  const actionButtons = [restartButton, exportJSONButton, exportCSVButton, closeButton, invalidAttemptButton];

  restartButton.style.display = options.onRestart === undefined ? 'none' : '';
  exportJSONButton.style.display = options.onExportJSON === undefined ? 'none' : '';
  exportCSVButton.style.display = options.onExportCSV === undefined ? 'none' : '';
  historyEntryButton.style.display = 'none'; // shown only via setHistoryTarget (FR-49.12)
  replayButton.style.display = options.onReplay === undefined ? 'none' : '';
  if (options.onRestart === undefined && options.onExportJSON === undefined && options.onExportCSV === undefined) {
    restartHint.style.display = 'none';
  }

  let invalidAttempt: InvalidAttemptNotice | null = null;
  function setInvalidAttempt(notice: InvalidAttemptNotice | null): void {
    invalidAttempt = notice;
    invalidAttemptNotice.hidden = notice === null;
    invalidAttemptText.textContent = notice?.text ?? '';
    invalidAttemptButton.textContent = notice?.downloadLabel ?? '下載稽核檔';
    // 正式匯出與 3D 重播會產出/呈現看起來像正式紀錄的東西 ⇒ 不可採納時一併收起。CSV 也不例外:
    // 稽核檔只有 JSON 一種形狀,再開一個 `.invalid-paused.csv` 等於多一份要維護的不可採納格式。
    const adoptable = notice === null;
    exportJSONButton.style.display = adoptable && options.onExportJSON !== undefined ? '' : 'none';
    exportCSVButton.style.display = adoptable && options.onExportCSV !== undefined ? '' : 'none';
    replayButton.style.display = adoptable && options.onReplay !== undefined ? '' : 'none';
    if (!adoptable) historyEntryButton.style.display = 'none';
  }
  invalidAttemptButton.addEventListener('click', () => {
    if (invalidAttempt === null) return;
    void runResultAction(actionButtons, invalidAttempt.onDownload);
  });

  let historyTarget: HistoryDrillTarget | undefined;
  function setHistoryTarget(target: HistoryDrillTarget | undefined): void {
    historyTarget = target;
    // WP-69 / T4：`invalidAttempt` 一票否決。正常流程下不可採納的 run 根本拿不到 target（保存被
    // 排除 ⇒ 沒有 `saved` 狀態），這條是防止未來有人從別處餵 target 進來就把歷史入口開回去。
    historyEntryButton.style.display =
      options.onOpenHistory !== undefined && target !== undefined && invalidAttempt === null ? '' : 'none';
  }
  historyEntryButton.addEventListener('click', () => {
    if (options.onOpenHistory === undefined || historyTarget === undefined) return;
    options.onOpenHistory(historyTarget);
  });
  replayButton.addEventListener('click', () => options.onReplay?.());

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

  actions.append(restartHint, restartButton, exportJSONButton, exportCSVButton, historyEntryButton, replayButton, closeButton);

  panel.append(
    title,
    invalidAttemptNotice,
    validityWarning,
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
      // WP-69 / T4：與 `setValidityWarning(null)` 同一條紀律,且順序重要——先清不可採納狀態,
      // `setHistoryTarget(undefined)` 才不會讀到上一場的旗標。
      setInvalidAttempt(null);
      setHistoryTarget(undefined); // a newly shown result has no known history target yet
      // WP-65 / T5：同一理由——警示屬於**某一場**結果，不屬於這個畫面。呼叫端仍會在 `show()` 之後
      // 依該場的 `meta.validity.pointerLockLost` 明確設定一次；這行只保證「沒設」= 沒有警示，
      // 而不是「沒設」= 沿用上一場（`__fpsTest.showResult()` 等旁路因此也不會殘留）。
      setValidityWarning(null);
      visible = true;
      root.style.display = 'flex';
    },
    setHistoryTarget,
    setValidityWarning,
    setInvalidAttempt,
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
