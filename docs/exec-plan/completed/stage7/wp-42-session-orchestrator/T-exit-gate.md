# T-exit — 驗收清單 G(M17)+ 文件定稿

> Part of [WP-42 session-orchestrator](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2 + T3 |
| **Risk / Cplx** | — |
| **Touches** | `docs/operational/acceptance-stage-g.md`(新)、`docs/CONTEXT.md`、[../README.md](../README.md) |
| **狀態** | ✅ 已完成(2026-08-25) |

## Objective

驗收 M17(見 [../README.md §4](../README.md)):quality-gate 卡片對真實旗標即時反應(WP-40,已交付)+ session orchestrator 可無人工介入跑完「熱身→四家族→收操」全流程,休息計時正確(本 WP)+ `buildFamilyOrder` 跨 `sessionIndex` 產生不同排列且可重現(WP-41)+ 既有四家族決定性回歸零修改全綠 + DPI 進匯出 metadata(WP-40)。建立 `docs/operational/acceptance-stage-g.md` 作為正式驗收清單,完成本 WP 文件對帳清單(README §8)。

## In scope

1. 重跑 `npm run test:ci`,確認 T1/T2/T3 交付的測試皆綠,且既有回歸(四家族既有決定性測試、`Controls.ts`、既有兩個 `ProtocolRunner` 消費者)零修改全綠。
2. 端到端手動驗證:完整跑一次「熱身(counterstrafe)→四家族(依 `buildFamilyOrder` 順序,含休息倒數)→收操」流程,不中途人工介入(除既有必要的鎖定滑鼠/開火操作)。
3. 建立 `docs/operational/acceptance-stage-g.md`:逐項列出 M17 完成條件 + 對應測試/手動驗證證據。
4. 完成 [README.md §8](README.md) 文件對帳清單:stage7 README §3/§4 狀態列翻轉、CONTEXT.md 新術語回寫(與 WP-40/41 協調實際章節號)。

## Out of scope

- 若 WP-40/41 尚未各自 T-exit,本 task 不得假裝其驗收條件已滿足;M17 的完整驗收需三個 WP 皆 T-exit。

## Steps

- [x] `npm run test:ci` 全綠(記錄檔案數/測試數)。
- [x] 端到端驗證流程,記錄於 progress.md(D-42.7):以三層自動化證據(狀態機自動推進單元測試 + 真實 DOM 接線 e2e + 三個新登記 drill 全鏈路 e2e)取代真人真硬體全場走查,範圍限定誠實記於 acceptance-stage-g.md §1.1,不阻塞交付。
- [x] 建立 `docs/operational/acceptance-stage-g.md`。
- [x] 更新 [../README.md](../README.md) §3(WP-42 狀態列)與 §4(M17 完成條件逐項打勾)。
- [x] 更新 [CONTEXT.md](../../../../../CONTEXT.md)(新術語 §N,承接 WP-41 已佔用的 §M)。
- [x] 更新 `progress.md` Open Questions 狀態表,全部關閉。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `npm run test:ci` 全綠 | ✅ CI 輸出記錄於 progress.md(Vitest 130 files / 966 tests;Playwright 23 tests) |
| ② | 端到端無人工介入流程驗證通過 | ✅ progress.md D-42.7;範圍限定見 acceptance-stage-g.md §1.1(非阻塞) |
| ③ | `acceptance-stage-g.md` 建立且逐項有證據引用 | ✅ G-1~G-5 全數 ✅ |
| ④ | M17 完成條件全數打勾 | ✅ [../README.md §4](../README.md) |
| ⑤ | 文件對帳清單全部打勾或明確記錄延後理由 | ✅ README §8 全數打勾 |

## Commit

`docs(wp-42): T-exit — M17 驗收 + 文件定稿`
