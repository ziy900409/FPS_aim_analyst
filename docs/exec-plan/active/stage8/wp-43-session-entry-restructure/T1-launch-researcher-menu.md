# T1 — 啟動畫面兩分岔 + `ResearcherMenu.ts` + `Controls.ts` 顯隱條件

> Part of [WP-43 session-entry-restructure](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0 |
| **Risk / Cplx** | Med(重組既有事件監聽;需覆核既有 e2e 對啟動按鈕/`#drill-controls` 可見性的斷言) |
| **Touches** | `src/main.ts`(MODIFY)、`src/ui/ResearcherMenu.ts`(ADD) |
| **狀態** | ⬜ 待開工 |

## Objective

交付 FR-H1(啟動畫面兩分岔)+ FR-H4(研究員子選單收納既有三個工具,`Controls.ts` 顯隱新增 `appMode` 條件)。不新增任何協定/引擎邏輯,只重組既有事件監聽與顯隱條件。

## In scope

1. `main.ts` 新增 `appMode: 'launch' | 'session' | 'researcher'`(依 T0 D-43.1 決定的具體設計)。
2. 啟動畫面改為兩顆按鈕:「選手測試 Session」(沿用既有 `sessionPlanButton` 行為:`pendingSessionMode='session-plan'` + 開 `sessionSetupForm`)、「研究員模式」(開 `ResearcherMenu`)。
3. `src/ui/ResearcherMenu.ts` 新增,三個入口分別呼叫既有 `protocolButton`/`brProtocolButton` 的既有 click handler 內容,以及顯示 `Controls.ts` 面板。
4. `syncControlsVisibility()` 改為 `(!pointerLock.locked || drillRunner.phase === 'ended') && appMode === 'researcher'`。
5. 依 T0 D-43.5(OQ-S8-5 回覆)處理既有「實驗 session」(`experimentButton`)按鈕:若使用者已拍板去向,依決定實作;若未拍板,保留原按鈕、暫不歸類到任一分岔,維持現有可見範圍(task-checklist.md 紀律 4)。

## Out of scope

- `src/ui/SessionPlanSetup.ts`/`src/session/SessionRunner.ts`/`src/data/metadata.ts` 的任何改動(T2 範圍)。
- `Controls.ts` 元件本體的任何邏輯改動——只改變呼叫端如何控制其顯隱,不改 `createControls()` 內部實作。
- `resolutionDetectionProtocol`/`brTrackingProtocol` 的既有行為——原樣移入選單,零邏輯改動。

## Steps

- [ ] 依 D-43.1 在 `main.ts` 新增 `appMode` 變數與其 setter。
- [ ] 重組 `sessionLaunchControls` 的按鈕群:兩顆主按鈕 + (依 D-43.5)實驗 session 按鈕的去向。
- [ ] 新增 `src/ui/ResearcherMenu.ts`(依 README §6 interface contract),三個回呼分別接線既有邏輯。
- [ ] 修改 `syncControlsVisibility()` 加入 `appMode === 'researcher'` 條件。
- [ ] 覆核既有 Playwright/e2e 測試對啟動按鈕文字/`#drill-controls` 可見性的斷言,同步調整。
- [ ] 新增/調整單元測試:`appMode` 切換時,`ResearcherMenu`/`Controls` 面板顯隱正確;既有選手測試 Session 入口行為零改變。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 啟動畫面只有兩顆主按鈕(+ 依 D-43.5 可能保留的第三個未歸類按鈕) | 手動驗證 + 測試覆蓋按鈕文字/數量 |
| ② | 研究員模式子選單三個入口皆可正確觸發既有行為(單一 drill 調整顯示 `Controls.ts`、解析度/BR protocol 行為不變) | 單元/整合測試 + 手動驗證 |
| ③ | `Controls.ts` 面板只在 `appMode==='researcher'` 且既有可見條件成立時顯示 | 單元測試覆蓋四種組合(mode×既有條件) |
| ④ | 既有 e2e 對啟動按鈕/`#drill-controls` 的斷言零破壞或已同步更新並記錄 | `npm run test:ci` 全綠 |
| ⑤ | `git diff` 對 `src/ui/Controls.ts`(元件本體)、`src/display/resolutionDetectionProtocol.ts`、`src/display/brTrackingProtocol.ts` 為空 | code review |

## Commit

`feat(wp-43): T1 — 啟動畫面兩分岔 + ResearcherMenu + Controls 顯隱條件`
