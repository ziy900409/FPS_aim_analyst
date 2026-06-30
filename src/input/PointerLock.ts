/**
 * PointerLock — WP-1 / T2+T3（FR-1.2/1.3）
 *
 * 以使用者手勢（canvas click）取得 Pointer Lock；Esc / 失焦自動解除並可重取。
 * 屬「輸入」層（notes-fps-controls §lifecycle）：封裝 lock 生命週期，視角（T4）與
 * 設定面板（T5）訂閱其狀態，互不直接相依。
 *
 * 權威狀態來源 = document 級事件（`pointerlockchange` / `pointerlockerror`），
 * **不**靠 `requestPointerLock()` 的回傳（MDN：Promise 形狀非所有瀏覽器一致）。
 *
 * 取鎖時先試 `requestPointerLock({ unadjustedMovement: true })`（關 OS 加速 → 原始輸入），
 * catch `NotSupportedError` 後 fallback 一般 `requestPointerLock()`（T3 / FR-1.3，附錄 B）；
 * `rawInputEnabled` 旗標標記是否真的啟用原始輸入，供 WP-7 metadata 記錄可重現性。
 * 滑鼠來源用 `mousemove`（WP-1 baseline）；`getCoalescedEvents()` 是 WP-3 升級路徑
 * （notes R3 / OQ-T5.b）。
 */

export interface PointerLockHandle {
  /** 必須在使用者手勢（click handler）內呼叫。 */
  request(): Promise<void>;
  readonly locked: boolean;
  /**
   * 最近一次成功取鎖是否啟用原始輸入（`unadjustedMovement`，關 OS 加速）。
   * `false` = 走了 `NotSupportedError` fallback（非 Chromium / 不支援），影響可重現性，
   * 需由 WP-7 寫入匯出 metadata。取鎖前為初始值 `false`。
   */
  readonly rawInputEnabled: boolean;
  onChange(cb: (locked: boolean) => void): void;
  /** 鎖定中轉發 movementX/Y；解鎖不轉發（避免殘留 delta）。 */
  onMove(cb: (dx: number, dy: number) => void): void;
}

export function createPointerLock(canvas: HTMLCanvasElement): PointerLockHandle {
  const doc = canvas.ownerDocument;
  const win = doc.defaultView ?? window;

  const changeCbs = new Set<(locked: boolean) => void>();
  const moveCbs = new Set<(dx: number, dy: number) => void>();
  let locked = false;
  let rawInputEnabled = false;

  function onMouseMove(e: MouseEvent): void {
    if (!locked) return; // 解鎖後不轉發殘留 delta（Esc / 失焦後）
    for (const cb of moveCbs) cb(e.movementX, e.movementY);
  }

  function setLocked(next: boolean): void {
    if (next === locked) return; // 僅在狀態翻轉時動作，避免重複通知
    locked = next;
    if (next) doc.addEventListener('mousemove', onMouseMove);
    else doc.removeEventListener('mousemove', onMouseMove);
    for (const cb of changeCbs) cb(next);
  }

  // `pointerLockElement === canvas` 為權威狀態；Esc 解除亦經此事件回報。
  doc.addEventListener('pointerlockchange', () => {
    setLocked(doc.pointerLockElement === canvas);
  });
  // request 失敗（缺手勢 / 權限）→ 維持 unlocked，UI 續顯示「點擊以鎖定」。
  doc.addEventListener('pointerlockerror', () => {
    setLocked(false);
  });
  // 失焦（alt-tab）：瀏覽器通常自動 exitPointerLock；防禦性停止轉發 delta。
  win.addEventListener('blur', () => {
    setLocked(false);
  });

  return {
    async request(): Promise<void> {
      // 先試原始輸入（unadjustedMovement，關 OS 加速，ADR-5）。判定「是否支援」的唯一可靠途徑
      // = requestPointerLock 回傳的 Promise 是否 reject（NotSupportedError）。不同瀏覽器可能
      // 回 Promise 或 void（D-T2.1）；最終 lock 狀態仍以 pointerlockchange 為準。
      try {
        const attempt = canvas.requestPointerLock({ unadjustedMovement: true }) as unknown;
        if (attempt instanceof Promise) {
          await attempt;
          rawInputEnabled = true; // Promise resolve ⟹ unadjustedMovement 生效（spec）。
        } else {
          // 舊版 Chromium 回 void：無 Promise 可判定支援與否，保守記為未啟用。
          rawInputEnabled = false;
        }
      } catch (e) {
        // 僅「環境不支援原始輸入」才降級；其餘錯誤（缺手勢 SecurityError 等）不吞，交回 caller。
        if ((e as DOMException).name !== 'NotSupportedError') throw e;
        rawInputEnabled = false;
        const fallback = canvas.requestPointerLock() as unknown;
        if (fallback instanceof Promise) await fallback;
      }
    },
    get locked(): boolean {
      return locked;
    },
    get rawInputEnabled(): boolean {
      return rawInputEnabled;
    },
    onChange(cb): void {
      changeCbs.add(cb);
    },
    onMove(cb): void {
      moveCbs.add(cb);
    },
  };
}
