# WP-65 T5 — Pointer Lock 掉鎖的效度旗標 → `meta.validity` → Result 警示

> FR-65.9 / FR-65.10 / FR-65.11 / FR-65.12 · NFR-65.5 · FM-3 · D-65-3 / D-65-4 · OQ-65.1

## Objective

使用者需求 ③：drill 錄製中掉 Pointer Lock（ESC／alt-tab／退出全螢幕）→ 本場資料標記有問題、Result 建議重測。**sim 不中斷**，drill 一路跑到自然結束（使用者 2026-09-11 拍板）。

本 task 補的是 README §0.3 的兩個缺口：現有 fullscreen suspect 機制 ①只在 eligibility gate 通過的實驗 session 內武裝、②Chromium 單次 ESC 根本不退全螢幕所以整條鏈不動。

## Steps

1. **`src/state/SharedState.ts`**：`validity` 增 `pointerLockLostDuringRun: boolean`。
   - `createSharedState()` 初始 `false`；`resetState()` 原地設 `false`（緊鄰既有 `state.validity.playerCorridorExceeded = false`）。
   - 註解寫明與 `experimentSession.suspect` **並存不合併**的理由（D-65-4）：前者管「輸入是否進得來」、後者管「顯示條件是否成立」。
2. **`src/main.ts` 偵測點**：擴充 T2 新增的 `pointerLock.onChange` 訂閱：
   ```ts
   if (!locked) {
     const p = drillRunner.phase;
     if (p === 'countdown' || p === 'running') sharedState.validity.pointerLockLostDuringRun = true;
   }
   ```
   - 判準**刻意與 [main.ts:581](../../../../../src/main.ts#L581) 的 `fullscreenchange` recording 判準逐字相同**（KI-007 已論證過這個窗界：`idle`/`ended` 的退出屬正常操作），不另立第二套。
   - **不**以 `experimentSession.active` 為前提（缺口 G1）。
   - `'armed'` 不在窗內 ⇒ T2 步驟 2 的主動 `exitPointerLock()` 恆不觸發（FR-65.12 / FM-3）。
3. **`src/data/metadata.ts`**：`requireValidity()` 增第五欄，採 **optional-in / required-out**（D-65-3）：
   ```ts
   pointerLockLost: validity.pointerLockLost === undefined
     ? false
     : requireBoolean(validity.pointerLockLost, 'validity.pointerLockLost'),
   ```
   既有四欄維持 required（不動）。`Meta['validity']` 型別同步加欄。
4. **併入 `suspect`**（FR-65.10 / OQ-65.1 預設）：`collectMeta()` 的 [metadata.ts:427](../../../../../src/data/metadata.ts#L427) 改為
   ```ts
   suspect: explicitSuspect || bufferOverflow || recorderOverflow || frameFloorSuspect || pointerLockLost,
   ```
   其中 `pointerLockLost` 取自已解析的 `validity`（`validity?.pointerLockLost === true`）。
   > **注意**：`corridorExceeded` 目前**不**併入 `suspect`，本 WP **不動它**——兩者性質不同（走出走廊是行為觀測，掉鎖是條件失效）。這個不對稱是刻意的，記入 `progress.md` 免得後人「順手統一」。
5. **`src/data/export.ts`**：[export.ts:33-34](../../../../../src/data/export.ts#L33-L34) 現行以 `{ ...meta.validity, recorderOverflow }` 覆寫 `recorderOverflow`。展開語法會自動帶上新欄，**確認無需修改**並在 `progress.md` 記錄此確認（不是「沒改所以沒事」，是「讀過並確認展開涵蓋」）。
6. **`src/data/exportPayloadSchema.ts`**：`parseValidity()` 同步 optional-in（缺欄→`false`），使既有 golden／fixture payload **零修改**仍可解析。
7. **`src/main.ts` → 匯出**：確認 `buildCurrentExportPayload()` 傳給 `collectMeta` 的 `validity` 已帶上新欄（現行應是直接傳 `sharedState.validity` 的投影——若是逐欄手抄則必須補上，這是最容易漏的一處）。
8. **`src/ui/ResultScreen.ts`**：新增 `setValidityWarning(text: string | null): void`。
   - 建構期預建一個隱藏的警示條節點，插在結果數值**之上**。
   - `null` → `hidden = true`；字串 → 寫 `textContent` 並顯示。
   - `role="alert"`，配色比照既有警示慣例（紅／琥珀），不新增資產。
9. **`src/main.ts` → Result 接線**：在 `showResultAndTrackHistory(payload)` 呼叫前後，依 `payload.meta.validity?.pointerLockLost` 呼叫
   ```ts
   resultScreen.setValidityWarning(
     payload.meta.validity?.pointerLockLost === true
       ? '本場測試中途失去滑鼠鎖定（ESC／切換視窗），期間的滑鼠移動未被記錄，本場資料可能失效——建議重新測試。'
       : null,
   );
   ```
   **每次都呼叫**（含傳 `null`），否則上一場的警示會殘留到下一場。
10. **Python 相容驗證**（NFR-65.5 / C-D1）：把一份帶新欄的匯出丟給 `research/` 的 `load_export()` 實跑，確認不拋 `SchemaError`。**不改任何 Python 程式**——這是驗證，不是修改。
11. **測試**：
    - `src/state/SharedState.test.ts`：`resetState()` 清除新旗標。
    - `src/data/metadata.test.ts`：缺欄→`false`（向後相容）；`true`→`meta.suspect === true`；`false` 且其他旗標皆 false → `meta.suspect === false`。
    - `src/data/exportPayloadSchema` 既有 round-trip 測試：帶新欄與不帶新欄各一條。
    - `src/ui/ResultScreen.test.ts`：`setValidityWarning('x')` 顯示且含文字；`setValidityWarning(null)` 隱藏；連續呼叫不殘留。

## Invariants

- `experimentSession.ts` **零修改**（D-65-4）。
- `DrillRunner.ts`／`SimLoop.ts`／`TargetManager.ts` 零修改——sim 完全不知道有這個旗標。
- 掉鎖**不改變** drill 結束時機：`endCondition` 三條判定式逐位不變。
- 既有四個 validity 旗標的 required 語意與錯誤訊息零變更。
- `meta` 的既有鍵集合零增減（只在 `validity` 物件內 additive 一欄）。
- `research/` 下零修改。

## Definition of Done

- [ ] `src/data/metadata.test.ts` 新增 ≥ 3 條斷言全綠（缺欄預設 false、true 併入 suspect、false 不併入）
- [ ] 既有 golden／fixture payload **零修改**通過 `parseExportPayload()`（`npx vitest run tests/` exit 0，通過數 ≥ T4 之後）
- [ ] **FM-3 反證（必要）**：連續三場**乾淨** run（含一次 restart、一次換 drill）匯出後 `meta.validity.pointerLockLost` 皆為 `false`。三個值逐一記入 `progress.md`——旗標若每場都亮就等於沒有
- [ ] **正向**：一場 drill 跑到一半按 ESC，確認 ① drill **繼續跑到自然結束**（目標繼續 spawn、Time 繼續走）② 匯出 `meta.validity.pointerLockLost === true` ③ `meta.suspect === true` ④ Result 出現警示文字。四項各有截圖或數值佐證
- [ ] **FR-65.12**：待命期間（尚未 arm）與 Result 顯示後（`ended`）各手動掉鎖一次，確認旗標仍為 `false`
- [ ] `meta` 鍵集合與 T0 步驟 3 的基線**逐字相同**；`meta.validity` 鍵集合恰多一個 `pointerLockLost`
- [ ] Python `load_export()` 對帶新欄的匯出不拋錯，指令與輸出記入 `progress.md`
- [ ] `src/ui/ResultScreen.test.ts` 新增 3 條全綠（顯示／隱藏／不殘留）
- [ ] `npm run typecheck` ×2 exit 0；全量 `npx vitest run` exit 0
- [ ] `progress.md §T5` 記錄：`corridorExceeded` 不併入 `suspect` 的不對稱為何刻意保留；步驟 5 的 `export.ts` 展開確認

## Commit

```text
feat(data): flag runs that lost pointer lock while recording
```
