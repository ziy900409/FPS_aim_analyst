import type { DrillPhase } from '../drill/DrillRunner.ts';

/**
 * WP-65 / T3（FR-65.6）— 待命提示與倒數數字的 DOM overlay。
 *
 * 倒數（`timing.countdownMs`，全 roster = 3000 ms）在本 WP 之前**完全沒有畫面呈現**：即使
 * T1/T2 把起算時機修對了，受試者看到的仍是「畫面卡住三秒然後目標突然出現」。本檔補上那三秒的
 * 可見性，並在其前的待命相位告訴受試者要做什麼。
 *
 * **呈現層，零狀態**：只吃 `phase` 與 `countdownRemainingMs` 兩個 sim 唯讀值（由 `liveFrame`
 * 在 rAF 內傳入），不讀 `SharedState`、不讀 `DrillConfig`、不寫任何狀態（ADR-2）。
 */
export interface DrillStartOverlayHandle {
  /**
   * 每 rAF 呼叫一次。`armed` → 開始提示；`countdown` → 剩餘整數秒；其餘相位 → 隱藏。
   * 文字節點於建構期一次配置、此處只寫 `textContent`／`style.display`，且只在值**改變時**才寫
   * ⇒ 穩態下每幀零 DOM 寫入、零堆配置（NFR-65.7）。
   */
  update(phase: DrillPhase, countdownRemainingMs: number): void;
  dispose(): void;
}

export interface DrillStartOverlayOptions {
  parent?: HTMLElement;
}

const ARM_PROMPT = '點擊左鍵開始';
const COUNTDOWN_PROMPT = '準備';

/**
 * 待命提示與倒數數字的垂直落點不同，理由是既有的 `#lock-hint`（main.ts，`inset:0` + 置中，
 * 文字「點擊以鎖定滑鼠視角（Esc 解除）」）在**未鎖定時**才顯示——那正好是待命相位。兩者都置中
 * ⇒ 文字逐字疊在一起，兩句都讀不出來（T3 實機截圖抓到）。
 *
 * 倒數相位不受影響：那時受試者已取得鎖，`#lock-hint` 自己就隱藏了 ⇒ 數字可以安心置中。
 * 故 `armed` 把提示推到中線下方，`countdown` 維持置中。
 */
type Layout = 'center' | 'below-center';

/** 數字行留空的哨兵（`armed` 相位沒有數字可顯示）。真實倒數秒數恆 ≥ 1，見 `update()` 註解。 */
const NO_DIGITS = 0;

export function createDrillStartOverlay(options: DrillStartOverlayOptions = {}): DrillStartOverlayHandle {
  const parent = options.parent ?? document.body;

  const root = document.createElement('section');
  root.id = 'drill-start-overlay';
  // 倒數是有時限的資訊，晚播報等於沒播報 ⇒ assertive 而非 polite（比照 RestOverlay 的 polite
  // 是因為休息倒數不影響動作時機，此處相反）。
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
    'gap:10px',
    // **本檔最關鍵的一行**：待命期的點擊必須穿透到 canvas 才能取鎖，而取鎖正是解除待命的訊號
    // （D-65-1）。漏掉這條，overlay 會吃掉那一次點擊 ⇒ 待命閘永遠解不開、drill 再也開不了。
    'pointer-events:none',
    'user-select:none',
    // HUD（18）與 rest-overlay 的半透明 backdrop（20）之上 —— 提示若被 backdrop 壓灰就失去作用；
    // Result dialog（30）與 drill-controls（32）之下 —— 結果頁與控制項必須永遠蓋過本 overlay。
    'z-index:22',
    'color:#edf2f7',
    'text-shadow:0 2px 14px rgba(0,0,0,0.7)',
  ].join(';');

  const prompt = document.createElement('div');
  prompt.style.cssText = 'font:700 clamp(20px,3.6vmin,34px)/1.2 system-ui,sans-serif;color:#dbe4ee';

  const digits = document.createElement('div');
  digits.style.cssText = [
    'font:800 clamp(64px,16vmin,180px)/1 system-ui,sans-serif',
    // 3→2→1 時字寬不得跳動（同 HUD renderMetric 的數值樣式）。
    'font-variant-numeric:tabular-nums',
    'color:#f6d365',
  ].join(';');

  root.appendChild(prompt);
  root.appendChild(digits);
  parent.appendChild(root);

  // 已呈現值的快取：避免每幀重寫相同的 textContent（也就避開每幀一次 `String(n)` 配置）。
  let shownPrompt = '';
  let shownDigits = NO_DIGITS;
  let shownLayout: Layout | null = null;
  let visible = false;

  function show(promptText: string, seconds: number, layout: Layout): void {
    if (layout !== shownLayout) {
      // 只在相位切換時寫（每場至多兩次），不是每幀。
      root.style.justifyContent = layout === 'center' ? 'center' : 'flex-end';
      root.style.paddingBottom = layout === 'center' ? '0px' : '22vh';
      shownLayout = layout;
    }
    if (!visible) {
      root.style.display = 'flex';
      root.setAttribute('aria-hidden', 'false');
      visible = true;
    }
    if (promptText !== shownPrompt) {
      prompt.textContent = promptText;
      shownPrompt = promptText;
    }
    if (seconds !== shownDigits) {
      digits.textContent = seconds === NO_DIGITS ? '' : String(seconds);
      shownDigits = seconds;
    }
  }

  function hide(): void {
    if (!visible) return;
    root.style.display = 'none';
    root.setAttribute('aria-hidden', 'true');
    visible = false;
  }

  return {
    update(phase: DrillPhase, countdownRemainingMs: number): void {
      if (phase === 'armed') {
        show(ARM_PROMPT, NO_DIGITS, 'below-center');
        return;
      }
      if (phase === 'countdown') {
        // `Math.max(1, …)` 的用途**不是**修飾真實倒數：`DrillRunner` 在 `nowMs - countdownStartMs
        // >= countdownMs` 當下就轉 `running`，故 `countdown` 期間剩餘值恆 > 0，3000→3、1→1，
        // clamp 對 3/2/1 為 no-op。它擋的是唯一會回 0 的退化窗——`countdownStartMs === null`
        // （phase 已是 `countdown` 但第一個 sim tick 還沒跑）時 getter 回 0，此時顯示「0」會被
        // 讀成「倒數已結束」，恰恰在它還沒開始的那一刻。`requireArm` 路徑下相位轉換與起算同在
        // 一個 tick，該窗不可達；此處仍 clamp 是因為 overlay 不該依賴呼叫端的相位來源。
        show(COUNTDOWN_PROMPT, Math.max(1, Math.ceil(countdownRemainingMs / 1_000)), 'center');
        return;
      }
      hide();
    },
    dispose(): void {
      root.remove();
    },
  };
}
