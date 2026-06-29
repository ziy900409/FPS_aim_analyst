# T2 — 計時效度驗證（反應時間 150–250 ms）

> Part of [WP-9 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `tests/validity/reaction-time.test.ts`、`docs/operational/timing-validity.md` |
| **Status** | ⬜ TODO |

## Objective
驗證量測管線產出的急停反應時間落在文獻合理量級（~150–250 ms），作為計時管線未被破壞（誤用 Date.now / frame）的 sanity（FR-9.2，§9.2/§14）。

## In scope
- 以合成或實測輸入序列（已知 t_visible → t_counter 間隔）驗 `counterReactionMs` 計算正確、單位/基準無誤。
- 分布 sanity：實際遊玩樣本中位數落 ~150–250 ms 量級（記錄，非單值硬閾）。
- `timing-validity.md`：方法論 + 顯示延遲誤差界線提醒（§14）。

## Out of scope
- 絕對硬體到光子延遲（瀏覽器本質測不到，附錄 F）；pilot 實驗設計（研究者）。

## Design notes
- 先**確定性**驗算：餵已知間隔 → `counterReactionMs` 等於該間隔（排除計算 bug）。
- 再**分布** sanity：偏離 150–250 ms 量級（如系統性 <50ms 或 >1s）即查 Date.now/frame 誤用。
- 呈現附「受試者內相對值 + 顯示延遲誤差界線」（§14）。

## Steps
- [ ] `reaction-time.test.ts`：已知間隔 → 反應時間精確（單位/基準正確）。
- [ ] 蒐集一段實玩樣本，記錄中位數/分布於 progress.md（量級 sanity）。
- [ ] 寫 `docs/operational/timing-validity.md`（方法論 + 誤差界線）。
- [ ] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [ ] 反應時間計算確定性正確；實玩分布落合理量級；方法論文件含誤差界線提醒。

## Commit
`test(wp-9): 計時效度驗證（反應時間 150–250 ms sanity）（FR-9.2）`
