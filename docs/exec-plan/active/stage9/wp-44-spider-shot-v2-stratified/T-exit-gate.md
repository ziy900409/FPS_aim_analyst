# T-exit — 驗收 + 文件對帳

> Part of [WP-44](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 + T2 + T3 |
| **Risk / Cplx** | — |
| **Touches** | MODIFY `docs/operational/analysis-spider-shot.md`;本 WP 文件狀態收尾 |
| **狀態** | ✅ |

## Objective

驗收 WP-44 全部交付內容,補齊 `spider-shot-v2` 的契約文件,並誠實記錄哪些跨文件對帳動作被有意延後。

## Steps

- [x] `npm run test:ci`(`tsc --noEmit` + `vitest run` 995 測試 + `playwright test` 24 e2e)全綠。
- [x] `docs/operational/analysis-spider-shot.md` 新增「`spider-shot-v2` — stratified peripheral schedule」一節,說明排程用 quadrant/tier 分箱與既有 `SpiderQuadrant` 呈現層標籤是兩套不同分類;補上 v2 的 Verified test evidence 條目。
- [x] `task-checklist.md`/`progress.md`/本 WP `README.md` §4 文件對帳清單狀態更新。
- [ ]（有意延後,見下方)`docs/exec-plan/DECISIONS.md`/`docs/exec-plan/README.md` §2/§4/§6/`docs/MAP.md`:正式 WP/GD/里程碑編號指派——比照 stage8(WP-43)先例,留給使用者決定何時正式採納。

## 誠實記錄:本次刻意不做的事

`docs/exec-plan/README.md` 目前顯示 GD-24 為最新已寫入決策、stage8 提案暫用 GD-25(尚未正式寫入 `DECISIONS.md`)。若本 WP 現在就佔用一個具體 GD 編號,會與 stage8 尚未定案的「暫用 GD-25」產生衝突風險(兩個提案不能共用同一個號碼,而先例是「先正式採納者得號」,見 `DECISIONS.md` GD-15)。因此本 T-exit **不**寫入 `DECISIONS.md`/`exec-plan/README.md` §2/§4/§6/`docs/MAP.md` 的正式索引項,只在 `stage9/README.md` 與本 WP 文件內用「暫用 WP-44」標記——這與 stage8 WP-43 完全相同的處置方式,留待使用者確認要正式開工/編號時一次性補上。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `npm run test:ci` 全綠 | 執行輸出(tsc 0 error、995 vitest 測試、24 e2e 測試) |
| ② | `spider-shot-v2` 有對應契約文件,且明確點名排程分箱與呈現層標籤是兩套分類 | `analysis-spider-shot.md` diff |
| ③ | 本 WP 內部文件(task-checklist/progress/README)狀態一致,全部 ✅ | 本檔 diff |
| ④ | 誠實記錄延後的跨文件對帳項,不擅自佔用編號 | 本檔「誠實記錄」段 |

## Commit

`docs(wp-44): T-exit — 驗收 + spider-shot-v2 契約文件 + 文件對帳(WP/GD 編號正式指派延後)`
