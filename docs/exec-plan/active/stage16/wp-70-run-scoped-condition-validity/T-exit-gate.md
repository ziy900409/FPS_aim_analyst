# WP-70 T-exit — 驗收閘

## Objective

逐條證明「條件失效的效力單位是 run」已成立，且恢復入口確實不推進任何 orchestrator。
不得以「測試全綠」取代具名行為證據 —— KI-040 §5 已經示範過全綠而漏判的情況。

## Steps

1. 對 FR-70.1～70.11、NFR-70.1～70.6 建 acceptance matrix，每列連到**逐字測試名**、命令、exit code
   與（若有）實機證據。空白代表沒有該面，不是沒有證據 —— 沒有證據的列不得標完成。
2. 以 grep 重跑 blast radius，確認：
   - `experimentSession.suspect` 不再出現在 export 路徑；
   - fullscreen 退出判準在 session 與 protocol 兩條路徑上是**同一個**值（C-D4）；
   - 恢復流程對五個推進/保存/下載入口零呼叫。
   ⚠️ CodeGraph 涵蓋不足（D-68.T0-4，WP-69 T-exit 二度複現）⇒ **以 grep 為權威**。
3. 執行全量閘並記錄**精確計數**、瀏覽器版本、COI、git SHA：typecheck / build / `npx vitest run` /
   `tests/regression` / Edge full e2e。
4. 專項驗證：
   - **跨 run 不繼承**（FR-70.1 核心）：run N 標記 → run N+1 乾淨；
   - **run 內未放寬**：同一 run 內退出仍標記；
   - **protocol 收緊方向**（T2）：非錄製窗退出不再標記、錄製窗退出仍標記；
   - canonical digest 實際移動筆數 vs T0 預測**逐筆吻合**；
   - `tests/regression` 零漂移。
5. 翻 `GD-47`／KI-040 狀態，更新 stage16 index、top index、checklist、progress，
   確認 OQ-70.1～70.4 全部關閉或具名遺留（含 owner）。

## Definition of Done

- [ ] FR-70.1～70.11 與 NFR-70.1～70.6 **無任何「完成」但無證據的列**
- [ ] 跨 run 不繼承、run 內未放寬 —— **兩個方向都有證據**（只證一邊不合格）
- [ ] T2 的收緊方向有成對證據，且期望值變動的既有測試逐條有理由
- [ ] 恢復入口對 `start`／`advance`／`completeCurrentCondition`／`downloadJSON`／`save` 的零呼叫
      有 spy 證據；cursor／conditionIndex／`exports[]` 逐位不變
- [ ] canonical digest 移動筆數與 T0 預測吻合；`tests/regression` 計數零漂移
- [ ] 全量驗證綠；**任何 skip 或替代證據有 owner、原因、後續處置**
      （特別是 OQ-70.1 若判不可行，T5 的手動替代證據必須在此明帳）
- [ ] `GD-47`、GD-10 處置、KI-040 狀態、stage16 index、top index、checklist、progress 七處狀態一致

## Commit

```text
docs(wp-70): T-exit evidence for run-scoped validity
```
