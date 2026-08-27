# WP-51 T0 — Entry and Upstream Handoff Gate

## Objective

以當時HEAD與客觀evidence確認WP-48～50可進入整合驗收，凍結browser/manual政策與測試邊界；缺少必要contract時明確blocked，不以WP-51 helper取代上游功能。

## Entry conditions

- WP-48／49／50各自README、checklist、progress與T-exit可讀。
- worktree既有變更已辨識並由各owner保留；本task不清除或重寫他人工作。
- Stage 10 README §10仍代表目前M18範圍。

## Work

1. 讀取三個WP的實際types/routes/test commands與最新exit evidence，建立`requirement → provider → contract/version → evidence → status`矩陣。
2. 確認Assessment-only、exact `drillId`、strict payload、History API/typed client、metric registry/cohort、Replay support/seek/ownership/return contract均已交付。
3. 重跑並記錄當時baseline：browser+Node typecheck、Vitest、Playwright與build；保留test counts、runtime、browser/backend，不把舊數字當gate。
4. 檢查Playwright/Vite server、ports、root injection、DEV hooks、COOP/COEP與temp helpers；標出可重用seam及需由owning WP修正的缺口。
5. 對每個將修改的既有symbol執行CodeGraph impact；config/script以直接inspection記錄cross-process blast radius。
6. 取得OQ-51.1～3結論，記owner/date/rationale；未決但影響release的項目保持blocked狀態。
7. 凍結M18 acceptance matrix、evidence種類、reference hardware/browser與synthetic fixture roster。

## Failure modes and response

| Failure | Response |
|---|---|
| 上游exit未完成／evidence過期 | 標blocked與owner；可進行T1純harness工作，但不得開始依賴該contract的T2 scenario |
| planned DTO與actual implementation不同 | 以actual type為準回到owning WP更新文件/contract；不複製adapter掩蓋 |
| baseline已有失敗 | 分類pre-existing或Stage10 regression並記evidence；未處理前不得宣告T0完整通過 |
| OQ未決 | 依README recommended default只做可逆準備；T-exit仍受deadline約束 |

## Definition of Done

- [ ] WP-48～50 handoff矩陣每個必要contract有actual location、version/status與exit evidence。
- [ ] baseline commands、test counts、environment與既有失敗已記錄。
- [ ] dev/preview/manual、browser matrix、root與failure injection策略已凍結。
- [ ] OQ-51.1～3有決策，或有owner/deadline/blocked impact。
- [ ] T1 targets與T2 entry blockers明確，沒有把planned feature當delivered。
- [ ] progress、checklist與上層Stage 10狀態同步。

## Suggested commit

```text
docs(stage10): freeze WP-51 integration entry gate
```

