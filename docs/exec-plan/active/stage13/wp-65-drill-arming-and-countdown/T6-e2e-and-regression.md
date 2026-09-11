# WP-65 T6 — Live e2e arm helper、9 個 spec 補接、全量回歸

> NFR-65.6 · FM-4 / FM-5 / FM-6

## Objective

待命閘讓「載入 app 就會自己跑起來」這個假設失效。**9 個不使用 `window.__fps` 合成 harness 的 live spec** 會因此停在待命相位直到 timeout。本 task 交付共用的 arm helper、把這 9 個 spec 接上，並跑完整回歸。

這是本 WP 的第二個 High risk 切片——風險不在難度，在**量**：一次要動 9 個檔，且失敗樣態（測試 timeout）看起來像功能壞掉而非測試沒接。

## Steps

1. **FM-4 可行性驗證（本 task 的第一步，結果決定後續路線）**：
   以 [raw-mouse-sampling.spec.ts:60-73](../../../../../tests/e2e/raw-mouse-sampling.spec.ts#L60-L73) 已驗證的模式寫一個最小 spike——改寫 `document.pointerLockElement` getter 指向 canvas 並派發真實 `pointerlockchange`，走**生產** `PointerLock` 模組 → `main.ts` 的 `onChange` → `armRequested = true` → 相位轉 `countdown`。
   - **成功** ⇒ 走步驟 2，**不新增任何 dev-only 旁路**。
   - **失敗** ⇒ 才退回 dev-only `?autoArm=1` 縫（`import.meta.env.DEV`，production build 剝除）。該縫**只跳過待命**，不偽造倒數、不跳過倒數、不偽造任何量測值——比照記憶中「資格閘 dev-only seam 只跳過拒入、不偽造通過」的既有紀律。無論走哪條，結果與理由都要記入 `progress.md`。
2. **共用 helper**：新增 `tests/e2e/support/arm.ts`（或沿用 repo 既有的 e2e helper 慣例位置，以 `ls tests/e2e/` 當下結構為準）：
   ```ts
   /** 以生產 PointerLock 路徑取鎖，解除 drill 待命閘。回傳解除當下的 phase 供斷言。 */
   export async function armDrill(page: Page): Promise<void>;
   /** 取鎖後等待 countdown 走完並進入 running（不寫死 3000，讀 config 或輪詢 phase）。 */
   export async function armAndWaitRunning(page: Page): Promise<void>;
   ```
   `raw-mouse-sampling.spec.ts` 內既有的 inline 取鎖邏輯**抽進這個 helper 並改用它**，避免兩份取鎖模擬各自演化。
3. **9 個 live spec 逐一補接**（`tracking-pilot-live`、`tracking-pilot-operator`、`raw-mouse-sampling`、`annotation-channel`、`input-sampler`、`isolation`、`backend`、`history-api-health`、`history-navigation`）：
   - 逐檔判斷是否真的驅動 drill runtime。純 HTTP／health 類（`backend`、`history-api-health`）可能根本不進 drill ⇒ **不要盲目全加**，逐檔在 `progress.md` 記「需要／不需要 + 一句理由」。
   - 需要者在「載入頁面之後、斷言 drill 行為之前」插入 `armAndWaitRunning(page)`。
4. **FM-5 等待窗調整**：倒數改為取鎖後起算 ⇒ 所有「載入後等目標出現」的等待窗實際右移約 3 秒。
   - 逐一檢視受影響 spec 的 `waitForFunction` / `expect(...).toPass` timeout。
   - 原則：把「載入後等待」改成「**arm 後**等待」，而不是把 timeout 一律加 3 秒——後者會掩蓋真正變慢的情況。
   - 每個被調整的 timeout 記錄**調整前後值**於 `progress.md`。
5. **19 個 `__fps` spec 的零回歸確認**：這些走合成 harness（不傳 `requireArm`）⇒ 理論上零影響。**實跑確認**，不要用推論代替。任一轉紅即為 FM-1 洩漏，回頭修 T1。
6. **`overlay-layering.spec.ts` 與 `stage10-accessibility.spec.ts`**：T3 的新 overlay 進入這兩個 spec 的斷言範圍。
   - 分層：確認 overlay 不遮 Result dialog、不被 HUD 蓋住。
   - 無障礙：`aria-live` 播報與既有斷言不衝突。
   若既有斷言需要擴充以涵蓋新節點，**擴充而非放寬**。
7. **`typecheck` 覆蓋缺口補償**（FM-6）：`npm run typecheck` 只掃 `src/` 與 `server/`，`tests/` 與 `scripts/` **不在範圍**。故本 task 新增的 helper 與 spec 的型別正確性只能靠 `npx playwright test` 實跑驗證——在 `progress.md` 明記此缺口，避免誤以為 typecheck 綠就代表 e2e 程式碼有被檢查。
8. **全量回歸**：`npm run typecheck` ×2、`npx vitest run`、`npx playwright test --workers=1`、`npm run build`。
   - Playwright 前**先數** `.playwright-tmp/history-dev/` 的 participant 目錄數並與 T0 基線比對；累積過多會讓 history-library spec 以無關原因轉紅。
   - 全量跑前確認 5173 埠上沒有別的 dev server（`reuseExistingServer` 會靜默測到別人的 app）。

## Invariants

- 不改任何 `src/` production code（本 task 純測試層）。若實跑發現 production bug ⇒ 回對應的 T1～T5 修，**不在本 task 夾帶 production 修改**。
- 不放寬任何既有斷言以換取綠燈。
- helper 走生產 `PointerLock` 模組，不直接寫 `sharedState.armRequested`（那會繞過整條接線，測了等於沒測）。

## Definition of Done

- [ ] FM-4 spike 結果（真實取鎖模擬可行／不可行）與採用路線記入 `progress.md`；若走 dev-only 縫，該縫的範圍限制逐條寫明
- [ ] `tests/e2e/support/arm.ts`（或等效位置）存在；`raw-mouse-sampling.spec.ts` 的 inline 取鎖已改用 helper（全 repo 只有一份取鎖模擬）
- [ ] 9 個 live spec 各有一行「需要 arm／不需要 + 理由」記入 `progress.md`；需要者已補接
- [ ] 每個被調整的 e2e timeout 記錄調整前後值
- [ ] 19 個 `__fps` spec **零修改**全綠（實跑證據，非推論）
- [ ] `overlay-layering.spec.ts` 與 `stage10-accessibility.spec.ts` 已涵蓋新 overlay，且斷言為**擴充**而非放寬（diff 記入 `progress.md`）
- [ ] 全量 `npx playwright test --workers=1` **0 failed**，passed 數 ≥ T0 基線；執行前後的 `.playwright-tmp/history-dev/` 目錄數皆記錄
- [ ] `npm run typecheck` ×2 exit 0、`npx vitest run` exit 0、`npm run build` exit 0
- [ ] `progress.md §T6` 記錄 typecheck 不覆蓋 `tests/` 的缺口聲明

## Commit

```text
test(e2e): arm live drills through the production pointer lock
```
