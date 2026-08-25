# WP-42 — Progress Log

> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)
> 本檔記錄:Progress(每 task 完成證據)、Decision Log(`D-42.n`,per-WP 決策)、Surprises(讀碼意外)、Open Questions(承 README §7,執行期更新狀態)。

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry gate | ⬜ | — | — |
| T1 session plan + runner | ⬜ | — | — |
| T2 rest overlay | ⬜ | — | — |
| T3 family order wiring | ⬜ | — | — |
| T-exit 驗收 + 文件定稿 | ⬜ | — | — |

## Decision Log

_(尚無;T0 開工後記入 `D-42.1` 起,首項預期是 §2①引擎選擇。)_

## Surprises

- 規劃階段讀碼(README §0-2)發現:stage7 README 原文把「四個測試家族的既有能力」當作既定事實,但 `main.ts` 的 `availableDrills` 實際上只登記了 hold-click/hold-track 兩個家族——spider-shot 與 counterstrafe 三個變體全部只存在於 unit test 與 `pilotConfigs.ts`,從未被 `loadDrillById()` 實際載入過。這不是 stage7 README 或 WP-41 讀碼已發現的落差,是本 WP 規劃階段新發現,已反映進估時上修(2–3d → 3–4.5d)。

## Open Questions 狀態

承 [README.md §7](README.md);執行期於此表更新狀態(不修改 README 的原始建議文字,只在此追記結論)。

| # | 問題 | 狀態 |
|---|---|---|
| OQ-S7-2 | 三個家族是否需要新增 Practice-mode 變體供熱身使用 | 🟡 待 T0 正式拍板(README §0-7/§2③ 已備妥讀碼證據,建議方向:不新增,降級為「無熱身」) |
| OQ-S7-11 | SessionRunner 引擎:新建 vs 重用 `ProtocolRunner` | 🟡 待 T0 正式拍板(README §0-3/§2① 建議新建) |
| OQ-S7-12 | Counterstrafe assessment 步驟載入 reversal 還是同時涵蓋 cued | 🟡 待 T0/研究者確認(初判只載入 reversal) |
| OQ-S7-13 | `perFamilyTrialShape` 實際數值來源 | 🟡 待 T1 執行時讀碼確認 |
