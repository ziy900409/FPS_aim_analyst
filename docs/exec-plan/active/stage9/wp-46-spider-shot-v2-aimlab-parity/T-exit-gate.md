# T-exit — 驗收 + 文件對帳

> Part of [WP-46](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 + T2 + T3 + T4 + T5 |
| **Risk / Cplx** | — |
| **Touches** | MODIFY `docs/operational/analysis-spider-shot.md`、`../README.md`(stage9 頂層 §5);本 WP 文件狀態收尾 |
| **狀態** | ✅ |

## Objective

驗收 WP-46 全部交付內容,補齊 `spider-shot-v2` 球體/時序契約的文件說明,並誠實記錄哪些跨文件對帳動作被有意延後(比照 WP-44/45 前例)。

## Steps

- [x] `npm run test:ci`(`tsc --noEmit` + `vitest run` + `playwright test`)全綠。137 test files / 1074 vitest tests + 25 playwright tests,exit code 0。
- [ ] 手動/實機驗證(建議,非自動閘阻塞項,留給使用者實機測試):實跑 `spider-shot-v2`,目視確認目標為球體、擊殺中心後外圍目標無感知延遲出現、整場 60 秒後自然結束。
- [x] `docs/operational/analysis-spider-shot.md` 新增「`spider-shot-v2` — sphere hitbox / 60s time limit / center exempt from timeout (WP-46)」一節,說明:①`shape:'sphere'` 的命中判定與渲染同幾何來源;②`centerExemptFromTimeout` 只影響 v2,v1 逐位不變;③hitbox 直徑公式(視角直徑 2.0° @ 距離 8u)與 Aim Lab 對齊的候選值聲明(未經真人 pilot 校準)。
- [x] `task-checklist.md`/`progress.md`/本 WP `README.md` 狀態全部翻 ⬜→✅。
- [x] `../README.md`(stage9 頂層)§5 WP 索引新增 WP-46 列狀態更新為 ✅。
- [x](有意延後,見下方)`docs/exec-plan/DECISIONS.md`/`docs/exec-plan/README.md` §2/§4/§6/`docs/MAP.md`:正式 WP/GD/里程碑編號指派——本次仍不執行,見下方誠實記錄段(未變更)。

## 誠實記錄:本次刻意不做的事

`docs/exec-plan/README.md` 目前顯示 GD-24 為最新已寫入決策、stage8 提案暫用 GD-25(尚未正式寫入 `DECISIONS.md`)。本 WP 對 GD-7 的第二次幾何擴充(box→box|sphere)若現在就佔用一個具體 GD 編號,會與 stage8 尚未定案的「暫用 GD-25」產生衝突風險(先例:`DECISIONS.md` GD-15「先採納先得」)。因此本 T-exit **不**寫入 `DECISIONS.md`/`exec-plan/README.md` §2/§4/§6/`docs/MAP.md` 的正式索引項,只在 `stage9/README.md` 與本 WP 文件內用「暫用 WP-46」標記——與 WP-44/WP-45 完全相同的處置方式,留待使用者確認要正式開工/編號時一次性補上(屆時 `DECISIONS.md` 的 GD-7 條目需要補一段「附錄:已於 WP-46 擴充為 box|sphere」的向前參照)。

`CLAUDE.md §4` 例外處理:本 WP 的 GD-7 措辭更新已於 T1 直接落地(比照 WP-23 前例——CLAUDE.md 的硬約束描述先於正式 GD 編號更新即可生效,因為它是給未來 session 讀的程序記憶,不是決策帳本本身)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `npm run test:ci` 全綠 | 執行輸出(137 test files / 1074 vitest tests + 25 playwright tests,exit code 0) |
| ② | `spider-shot-v2` 有對應契約文件,明確點名球體 hitbox / 60 秒時限 / 中心免逾時三項 | `analysis-spider-shot.md` diff |
| ③ | 本 WP 內部文件(task-checklist/progress/README)狀態一致,全部 ✅ | 本檔 diff |
| ④ | 誠實記錄延後的跨文件對帳項,不擅自佔用編號 | 本檔「誠實記錄」段 |

## Commit

`docs(wp-46): T-exit — 驗收 + spider-shot-v2 球體/時序契約文件 + 文件對帳(WP/GD 編號正式指派延後)`
