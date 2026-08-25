# T-exit — 驗收 + 文件定稿

> Part of [WP-40 quality-flag-visibility](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 + T2 |
| **Risk / Cplx** | — |
| **Touches** | [CONTEXT.md](../../../../CONTEXT.md)、[../README.md](../README.md)、`docs/operational/*.md`(視 §0-5/§8 判定)、本 WP README/task-checklist |
| **狀態** | ⬜ 待執行 |

## Objective

驗證 FR-G1(quality-flag 卡片讀真實旗標、非硬編、`--warn` 觸發正確)與 FR-G2(`dpi` additive 落地、既有匯出零重錄)在最終落地程式碼上成立;判定是否需要新增/擴充 `docs/operational/*.md` 契約文件;CONTEXT.md 新增 §L(修正 stage7 README §8 原「§K」描述,因 §K 已被 WP-39 佔用,OQ-S7-8);把 stage7 README §3 的 WP-40 狀態列翻 ✅。

## In scope

1. 逐一覆核 FR-G1/FR-G2 的驗收條件,附證據連結(測試檔案/合成 fixture 名稱)。
2. 判定 §0-5/§8 提到的 `docs/operational/*.md` 是否需要新文件或擴充既有文件;若判定不需要,記錄理由於 progress.md。
3. [CONTEXT.md](../../../../CONTEXT.md) 新增 §L(`QualityFlagId`、`QualityFlagSeverity`、`dpi`)。
4. [../README.md](../README.md) §3:WP-40 狀態翻 ✅;若 §8 文件對帳清單提到「§K」的描述影響到 WP-41/42,順手註記修正為「§L 起」。
5. 覆核 §7 Open Questions(OQ-S7-6/7/8)是否全部關閉。

## Out of scope

- WP-41/WP-42 本身的任何實作。
- `docs/operational/acceptance-stage-g.md` 本體(WP-42 T-exit 建立)。

## Steps

- [ ] 覆核 FR-G1 驗收條件(六旗標即時反應、非硬編、`--warn` 正確、兩層嚴重度)附測試證據連結。
- [ ] 覆核 FR-G2 驗收條件(`dpi` additive、既有匯出零重錄)附測試證據連結。
- [ ] 判定並記錄 `docs/operational/*.md` 文件需求(新增或不需要,附理由)。
- [ ] CONTEXT.md 新增 §L。
- [ ] stage7 README §3 WP-40 狀態翻 ✅;§8 章節號描述若需修正一併處理。
- [ ] 覆核 OQ-S7-6/7/8 逐條關閉狀態記入 progress.md。
- [ ] 最終 `npm run test:ci` 全綠證據貼 progress.md。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | FR-G1/FR-G2 驗收條件通過 | T1/T2 端到端測試 + 本 task 覆核連結 |
| ② | CONTEXT.md §L 新增 | diff 可見 |
| ③ | stage7 README §3 WP-40 狀態翻 ✅ | diff 可見 |
| ④ | OQ-S7-6/7/8 逐條關閉或明確移交 | progress.md 記錄 |
| ⑤ | `npm run test:ci` exit 0 | 貼原始輸出到 progress.md |

## Commit

`docs(wp-40): T-exit — quality-flag-visibility 驗收 + 文件對帳`
