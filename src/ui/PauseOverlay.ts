/**
 * WP-69 / T3（FR-69.4/69.5）— 暫停面板的 DOM overlay。
 *
 * 本檔是受試者/操作員唯一會看到的 pause 介面，因此它的**文案就是產品規則本身**：一旦錄製中掉鎖，
 * 這一場 attempt 永久失去實驗效力（sticky，見 [RunAttemptController.ts](../attempt/RunAttemptController.ts)），
 * 「繼續」只是把它跑完供稽核，只有「重新測試」會建立新的 candidate。把這件事講清楚是 overlay
 * 存在的主要理由——只提供兩個按鈕而不解釋，操作員會以為繼續就沒事了。
 *
 * **呈現層，零狀態**（比照 [DrillStartOverlay.ts](./DrillStartOverlay.ts)）：只吃一個 `PauseOverlayView`
 * 並回撥兩個意圖，不讀 `SharedState`、不讀 `DrillConfig`、不碰 Pointer Lock、不自己計時（ADR-2）。
 * pause 生命週期的權威在 `RunAttemptController`，倒數由 `main.ts` 在 rAF 內算好傳進來。
 *
 * ⚠️ **Resume 的 user gesture 紀律（FM-4）**：`onResume` 由 click listener **同步**呼叫，中間不
 * `await`、不 `setTimeout`、不排程。瀏覽器只在 user gesture stack 內接受 `requestPointerLock()`，
 * 任何非同步跳板都會讓取鎖靜默失敗。呼叫端（main.ts）必須維持同樣的同步紀律。
 */

export type PauseOverlayView =
  | { readonly kind: 'hidden' }
  /** 等待操作員決定。`error` = 上一次取鎖失敗的可重試訊息（FR-69.5）。 */
  | { readonly kind: 'paused'; readonly error?: string }
  /** 已送出 `requestPointerLock()`，等 `pointerlockchange`／`pointerlockerror` 收斂。 */
  | { readonly kind: 'locking' }
  /** 已取回鎖，跑恢復倒數；此期間 gameplay input 與 camera 仍被阻斷（FR-69.5）。 */
  | { readonly kind: 'resume-countdown'; readonly remainingMs: number };

export interface PauseOverlayOptions {
  parent?: HTMLElement;
  /** 由 click listener 同步呼叫 —— 呼叫端必須在此同步發出 `requestPointerLock()`（見檔頭）。 */
  onResume: () => void;
  onRestart: () => void;
}

export interface PauseOverlayHandle {
  /** 每 rAF 呼叫一次。只在值改變時才寫 DOM ⇒ 穩態每幀零 DOM 寫入、零配置（NFR-69.5）。 */
  update(view: PauseOverlayView): void;
  dispose(): void;
}

/**
 * 文案常數。這三句被 T3 DoD 逐字釘住（overlay 必須含這幾個字串），所以它們不是隨手寫的提示文字，
 * 而是 GD-46 產品規則的使用者可見表述：改動等於改規則，必須回頭改 WP 文件與 DoD。
 */
const TITLE = '已暫停 — 本次已失去實驗效力';
const BODY_INVALID = '繼續仍無效：重新取得滑鼠鎖定後可以把這一場跑完，但資料只會留作稽核，不會進入正式紀錄。';
const BODY_RESTART = '只有完整重新測試才能再次接受門檻。';
const RESUME_LABEL = '繼續（本次仍無效）';
const RESTART_LABEL = '重新測試';
const LOCKING_TEXT = '正在重新取得滑鼠鎖定…';
const COUNTDOWN_PROMPT = '恢復中';

/** 數字行留空的哨兵（`paused`／`locking` 沒有數字可顯示）。比照 DrillStartOverlay 的 NO_DIGITS。 */
const NO_DIGITS = 0;

export function createPauseOverlay(options: PauseOverlayOptions): PauseOverlayHandle {
  const parent = options.parent ?? document.body;

  const root = document.createElement('section');
  root.id = 'pause-overlay';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-live', 'assertive');
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'box-sizing:border-box',
    'display:none', // ↔ 'flex'（見 update）
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:14px',
    'padding:24px',
    // 暫停面板必須攔下點擊：它自己的「繼續」鈕是重新取鎖的**唯一**入口，若點擊穿透到 canvas，
    // canvas 的 click handler 會在繞過本 WP 的 resume 流程的情況下直接取鎖（FR-69.5 失守）。
    // 與 DrillStartOverlay 的 `pointer-events:none` 正好相反，理由也正好相反。
    'pointer-events:auto',
    'user-select:none',
    // 高於 drill-controls（32）、ExportPanel（33）、researcher menu（41）與 main.ts 的 40/45 兩層,
    // 低於 Session/Pilot setup（60）與 eligibility gate（70）——後兩者在錄製中不可能開著。
    // 錄製中掉鎖時本面板必須蓋過畫面上的一切,否則操作員會點到被它蓋住的東西（比照 T0.6 抓到的
    // `#drill-controls` 蓋住 `#result-screen` 的既有教訓）。
    'z-index:50',
    'background:rgba(12,14,17,0.82)',
    'color:#edf2f7',
    'font:400 15px/1.6 system-ui,sans-serif',
    'text-align:center',
  ].join(';');

  const title = document.createElement('h2');
  title.textContent = TITLE;
  title.style.cssText = 'margin:0;font:800 clamp(20px,3.2vmin,30px)/1.25 system-ui,sans-serif;color:#f5a3a3';

  const bodyInvalid = document.createElement('p');
  bodyInvalid.textContent = BODY_INVALID;
  bodyInvalid.style.cssText = 'margin:0;max-width:44em;color:#dbe4ee';

  const bodyRestart = document.createElement('p');
  bodyRestart.textContent = BODY_RESTART;
  bodyRestart.style.cssText = 'margin:0;max-width:44em;font-weight:700;color:#f6d365';

  const digits = document.createElement('div');
  digits.style.cssText = [
    'font:800 clamp(48px,12vmin,140px)/1 system-ui,sans-serif',
    'font-variant-numeric:tabular-nums', // 3→2→1 字寬不跳動（同 DrillStartOverlay）
    'color:#f6d365',
    'display:none',
  ].join(';');

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center';

  function makeButton(label: string, accent: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = [
      'padding:10px 18px',
      'border-radius:8px',
      'border:1px solid rgba(255,255,255,0.18)',
      `background:${accent}`,
      'color:#10131a',
      'font:700 15px/1.2 system-ui,sans-serif',
      'cursor:pointer',
    ].join(';');
    return button;
  }

  const resumeButton = makeButton(RESUME_LABEL, '#c9d4e2');
  const restartButton = makeButton(RESTART_LABEL, '#f6d365');
  // 同步回撥，零跳板：`requestPointerLock()` 必須留在這一次 click 的 user gesture stack 內（FM-4）。
  resumeButton.addEventListener('click', () => options.onResume());
  restartButton.addEventListener('click', () => options.onRestart());
  actions.append(resumeButton, restartButton);

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.style.cssText = 'margin:0;min-height:1.6em;color:#f5a3a3;font-weight:600';

  root.append(title, bodyInvalid, bodyRestart, digits, actions, status);
  parent.appendChild(root);

  // 已呈現值的快取：避免每幀重寫相同的 textContent / display（也就避開每幀一次 `String(n)` 配置）。
  let visible = false;
  let shownDigits = NO_DIGITS;
  let shownStatus = '';
  let actionsShown = true;
  let buttonsDisabled = false;

  function setVisible(next: boolean): void {
    if (next === visible) return;
    visible = next;
    root.style.display = next ? 'flex' : 'none';
    root.setAttribute('aria-hidden', next ? 'false' : 'true');
  }

  function setDigits(seconds: number): void {
    if (seconds === shownDigits) return;
    digits.textContent = seconds === NO_DIGITS ? '' : String(seconds);
    digits.style.display = seconds === NO_DIGITS ? 'none' : 'block';
    shownDigits = seconds;
  }

  function setStatus(text: string): void {
    if (text === shownStatus) return;
    status.textContent = text;
    shownStatus = text;
  }

  /**
   * `resumeDisabled` **只**停用「繼續」。Restart 永遠可按：取鎖中重複按「繼續」只會多送一次
   * request，但把 Restart 一起停用就等於在一個可能不會回來的等待裡拿掉唯一的出口。
   */
  function setActions(shown: boolean, resumeDisabled: boolean): void {
    if (shown !== actionsShown) {
      actions.style.display = shown ? 'flex' : 'none';
      actionsShown = shown;
    }
    if (resumeDisabled !== buttonsDisabled) {
      resumeButton.disabled = resumeDisabled;
      buttonsDisabled = resumeDisabled;
    }
  }

  return {
    update(view: PauseOverlayView): void {
      if (view.kind === 'hidden') {
        setVisible(false);
        return;
      }
      setVisible(true);
      if (view.kind === 'paused') {
        setActions(true, false);
        setDigits(NO_DIGITS);
        setStatus(view.error ?? '');
        return;
      }
      if (view.kind === 'locking') {
        // 「繼續」停用（請求已送出）、「重新測試」維持可按。失敗會回到 `paused` 並帶可重試訊息
        // （FR-69.5），但那條路徑靠的是瀏覽器事件；Restart 是不依賴任何事件的保底出口。
        setActions(true, true);
        setDigits(NO_DIGITS);
        setStatus(LOCKING_TEXT);
        return;
      }
      // resume-countdown：鎖已拿回來,此時沒有可點的東西（滑鼠被鎖住），只剩倒數數字。
      // `Math.max(1, …)` 的理由同 DrillStartOverlay：倒數期間剩餘值恆 > 0，顯示 0 會被讀成
      // 「已經結束」,而恰恰在它還沒結束的那一刻。
      setActions(false, false);
      setDigits(Math.max(1, Math.ceil(view.remainingMs / 1_000)));
      setStatus(COUNTDOWN_PROMPT);
    },
    dispose(): void {
      root.remove();
    },
  };
}
