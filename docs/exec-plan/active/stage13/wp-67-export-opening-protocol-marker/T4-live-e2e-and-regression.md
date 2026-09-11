# WP-67 T4 — live e2e、四條 start 路徑、digest 重新基線、全量回歸

> FR-67.7 · NFR-67.1／67.2／67.3／67.6 · **FM-3** · [README §0.4](README.md)

## Objective

用**實機匯出**證明欄位真的寫出來了、四條 start 路徑一致，並把兩組 digest 的「一動一不動」變成貼得出來的證據。

## 為什麼需要 live 而不是單元測試

單元測試證明 `collectMeta()` 會轉寫傳進去的東西；它證明不了 production 真的有把 runner 的事實傳進去。四條 start 路徑各自重建 runner（換武器／換場景／換 drill／Session Plan block），**每一條都有自己漏接的可能**——WP-65 T2 的五項實機驗證就是為了同一個理由存在。

## Steps

1. **live 匯出斷言**（沿用 WP-65 的 arm helper `tests/e2e/support/arm.ts`，不要再寫第二份取鎖模擬）：
   - 跑一場 live drill → 攔截匯出 → 斷言 `meta.opening.protocol === 'armed-countdown-v1'` 且 `meta.opening.countdownMs === 3000`
   - ⚠️ 匯出取得方式：download 事件恆 timeout（blob 立刻 revoke），改攔 `createObjectURL`；Result 動作鈕會被 `#drill-controls` 蓋住，用 `dispatchEvent('click')`
2. **FM-3 同生共死斷言**：在同一場 run 中，斷言 protocol 為 armed 時 `#drill-start-overlay` 存在、且倒數期可見。這條把「arming 與可見倒數一起落地」這個目前成立的假設釘成契約——未來有人把兩者拆開時，這裡會先紅。
3. **四條 start 路徑**（FR-67.7）：restart／換武器／換場景／換 drill／Session Plan 的每個 block，各取一份匯出並斷言 `meta.opening` 一致且正確。Session Plan 路徑須確認每個 block 的匯出都帶欄（不只第一個）。
4. **frozen meta 鍵面 digest 重新基線**（[session-orchestrator.spec.ts:1128-1141](../../../../../tests/e2e/session-orchestrator.spec.ts#L1128-L1141)）：
   - 三格 `FROZEN_META_KEY_DIGESTS` **必定改變**（新 live run 多一個 `opening` 鍵）
   - 舊值 → 新值逐格記入 `progress.md`，並在該處註解寫明「WP-67 additive `meta.opening`；`opening` 是唯一新增鍵」
   - **先確認位移只由 `opening` 造成**：在更新常數之前，先印出新舊鍵集合的差集，斷言差集恰為 `['opening']`。差集若不只一鍵 ⇒ 有別的東西跟著漏進去了，**停下來查，不要直接改 digest**
5. **NFR-67.1 反向證據**：`CANONICAL_DIGEST_BEFORE_T5` 的 8 筆仍與 T0 逐筆相同（貼出 `npx vitest run src/data/exportPayloadSchema.test.ts` 的輸出）。**一動一不動**就是本 WP 最強的驗收句。
6. **全量回歸**：`npx vitest run`、`npx vitest run tests/regression`、`npx playwright test --workers=1`、`npm run typecheck` ×2、`npm run build`，逐項貼實際輸出並與 T0 基線比差額。
7. **e2e 環境**：執行前後各數一次 `.playwright-tmp/history-dev/` 目錄數並記錄；若 history-library 相關 spec 轉紅，先檢查目錄累積量再懷疑程式。

## Definition of Done

- [ ] live 匯出的 `meta.opening` 兩欄實測值已貼入 `progress.md`（不是「已驗證」，是數值）
- [ ] FM-3 同生共死斷言已加入並通過（貼案例名）
- [ ] 四條 start 路徑的匯出各一份實測值已列表（含 Session Plan 的**每個** block）
- [ ] 三格 frozen meta digest 的**舊值 → 新值**已逐格記錄，且「鍵集合差集恰為 `['opening']`」的斷言輸出已貼出
- [ ] 8 筆 `CANONICAL_DIGEST_BEFORE_T5` 與 T0 逐筆相同（貼測試輸出）
- [ ] `npx playwright test --workers=1` → `N passed / 0 failed`，與 T0 基線的差額逐條說明
- [ ] `npx vitest run`、`tests/regression`、`typecheck` ×2、`build` 四項輸出已貼入，regression fixture 零修改
- [ ] `.playwright-tmp/history-dev/` 執行前後目錄數已記錄

## Commit

```text
test(wp-67): assert live exports carry the opening protocol on every start path
```
