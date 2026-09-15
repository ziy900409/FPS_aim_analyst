# WP-70 T1 — per-run fullscreen 旗標與 export 路徑切換

> 本 task 是整個 WP 的**根**：缺陷 A 的修復點。做完這一個，跨 run 污染就停止。
> T2–T4 都是它的延伸（一致性、呈現、恢復入口）。

## Objective

把 `meta.suspect` 的 fullscreen 成分從 session 級 sticky 改為 per-run，作法**逐字比照 WP-65 T5**
對 `pointerLockLostDuringRun` 的既有 pattern，不發明新機制。

## Steps

1. `src/state/SharedState.ts`：
   - `validity` 加 `fullscreenExitedDuringRun: boolean`（固定欄位，不新增配置）；
   - 初值 `false`；`resetState()` 內歸零，註解比照 `pointerLockLostDuringRun` 的「每場重新起算」。
2. `src/main.ts` 的 `fullscreenchange` 處理器：在既有 `recording` 判準內把旗標置真。
   ⚠️ **沿用同一個 `recording` 運算式**（`phase === 'countdown' || phase === 'running'`），
   不得複製出第二套判準（C-D4）。
3. `src/data/metadata.ts`：`Meta['validity']` 加 `fullscreenExited: boolean`（required-out）；
   `collectMeta()` 讀 `sharedState.validity.fullscreenExitedDuringRun`。
   ⚠️ `validity` 是**逐欄手抄**而非展開（WP-65 T5 已在該處註解警告）——漏抄會讓旗標永遠匯出 false
   且離線不可察覺（FM-70.2）。
4. `src/data/exportPayloadSchema.ts`：`validity?.fullscreenExited?: boolean` optional-in
   （缺席 = `false`）；拒絕非布林值（optional-in 不等於 lenient-in，比照 WP-65／WP-69）。
5. **切斷舊路徑**：`collectMeta()` 的 suspect 組裝不再讀 `experimentSession.suspect`
   （非 protocol 分支改讀新旗標）。依 OQ-70.2 決定 `experimentSession.suspect` 是刪除或保留；
   若保留，在 `progress.md` 記下觸發清理的條件。
6. 測試：
   - SharedState 層：置真 → `resetState()` → 歸零；
   - **端到端**（FM-70.2 的反證）：旗標為真 ⇒ `meta.validity.fullscreenExited === true` 且
     `meta.suspect === true`；旗標為假且 perf 正常 ⇒ 兩者皆 false；
   - **跨 run 不繼承**（FR-70.1 的核心）：run N 置真 → `DrillRunner.start()` → run N+1 的 meta 為 false；
   - **run 內未被放寬**（風險分析的明帳項）：同一 run 內退出 ⇒ 仍標記；
   - schema round-trip 三條（帶旗標 / 缺席預設 false / 非布林拒絕）；
   - source-scan：`collectMeta()` 內不再出現 `experimentSession.suspect`（FM-70.1）。

## Definition of Done

- [ ] `npx vitest run` exit 0；新增測試數記入 `progress.md`
- [ ] **跨 run 不繼承**有具名測試（測試檔名 + 案例名），且該測試在改動前會紅（反證其有效性）
- [ ] **端到端旗標→匯出**有具名測試（不只測 SharedState 層，FM-70.2）
- [ ] **run 內偵測未被放寬**有具名測試（風險分析要求的反方向證據）
- [ ] source-scan 斷言 `collectMeta()` 不再讀 `experimentSession.suspect`（FM-70.1）
- [ ] canonical digest 實際移動筆數**與 T0 預測逐筆吻合**；第 N+1 筆變動 ⇒ 回頭修程式，不改表（NFR-70.2）
- [ ] `npx vitest run tests/regression` 計數與 T0 baseline **逐數相同**（NFR-70.1）
- [ ] 新增程式碼的 `Date.now` / `Math.random` 掃描為 **0**
- [ ] OQ-70.2 已關閉，結論（刪除或保留＋清理觸發條件）記入 `progress.md`

## Commit

```text
fix(validity): scope fullscreen suspect to the run
```
