# T-exit — 驗收 + 文件定稿

> Part of [WP-38 diagnosis-recommendation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T3 |
| **Risk / Cplx** | — |
| **Touches** | `docs/operational/analysis-diagnosis.md`、[CONTEXT.md](../../../../../CONTEXT.md)、本 WP README/task-checklist、[../README.md](../README.md) |
| **狀態** | ✅(2026-08-25) |

## Objective

收斂 WP-38:驗證框架 v1 對診斷/推薦/歷史的驗收條件——「結果頁對每個診斷顯示來源指標/`n`/flags/版本」與「不相容 session 不會產生進步/退步結論」——在最終落地的程式碼上成立;定稿 `analysis-diagnosis.md`;完成文件對帳;把 stage6 README 的 WP-38 狀態翻 ✅,滿足 WP-39(M16)entry 的最後一個測試家族/診斷層條件。

## In scope

1. 逐一覆核框架 v1 §"v1 驗收條件"清單中與診斷/歷史相關的條目,附證據連結。
2. 定稿 `docs/operational/analysis-diagnosis.md`:七模式規則表 + 優先序規則 + 門檻版本化紀律、`recommendationVersion` 與 `protocolVersion` 的獨立關係(OQ-S6-25 結論)、個人歷史聚合定義 + speed/accuracy 家族對照表(OQ-S6-26 結論)、OQ-S6-23 落點決策的最終記載。
3. [CONTEXT.md](../../../../../CONTEXT.md) 補新術語:`DiagnosisLabel`、`recommendationVersion`、`SessionSummary`、`SessionHistoryResult`。
4. [../README.md](../README.md) §3 WP 索引:WP-38 狀態翻 ✅;確認 WP-39 entry 條件表述已涵蓋本 WP。
5. 覆核 §7 Open Questions 是否全部關閉或明確移交 WP-39。

## Out of scope

- WP-39 calibration pilot 與 `protocolVersion = 1.0.0` 凍結(下一個 WP)。
- `docs/operational/acceptance-stage-f.md` 本體(WP-39 T-exit 建立);本 task 只確保本 WP 對應驗收條目有可引用的證據。

## Steps

- [x] 逐一覆核框架 v1 診斷/歷史相關驗收條件,附證據連結(測試檔案/合成 fixture 名稱)。
- [x] 定稿 `analysis-diagnosis.md`。
- [x] 回寫 CONTEXT.md 新術語。
- [x] 翻 stage6 README §3 WP-38 狀態。
- [x] 覆核 §7 OQ(S6-23~26)逐條關閉或移交狀態。
- [x] 最終 `npm run test:ci`(+ 視候選另加 `uv run pytest`)全綠證據貼 progress.md。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 「來源指標/`n`/flags/版本」與「不相容 session 不產生結論」驗收條件通過 | T1/T2/T3 端到端合成測試 + 本 task 覆核連結 |
| ② | `analysis-diagnosis.md` 定稿 | 文件存在且涵蓋 §Objective 列出的四項內容 |
| ③ | CONTEXT.md 新術語回寫 | diff 可見 |
| ④ | stage6 README WP-38 狀態翻 ✅ | diff 可見 |
| ⑤ | 兩閘(或單閘,依候選)全綠 | 貼原始輸出到 progress.md |

## Commit

`docs(wp-38): T-exit — diagnosis-recommendation 驗收 + analysis-diagnosis.md 定稿 + 文件對帳`
