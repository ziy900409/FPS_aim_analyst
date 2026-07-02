# WP-7 — Master Task Checklist ★M3

> 每 task 一個自足檔案。Spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 頂層索引：[../../README.md](../../README.md)

| Done | Task | File | Depends on | Risk |
|------|------|------|------------|------|
| ✅ | **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | WP-2, WP-4, WP-5 | Low |
| ✅ | **T1** Ring buffer tick 記錄 | [T1-ring-buffer.md](T1-ring-buffer.md) | T0 | Med |
| ✅ | **T2** 事件記錄（t_visible/命中/首發/急停） | [T2-event-recording.md](T2-event-recording.md) | T1 | Med |
| ✅ | **T3** 環境 metadata | [T3-metadata.md](T3-metadata.md) | T0 | Low |
| ✅ | **T4** JSON/CSV 匯出 | [T4-export.md](T4-export.md) | T1, T2, T3 | Med |
| ✅ | **T5** Schema 文件 | [T5-schema-doc.md](T5-schema-doc.md) | T4 | Low |
| ⬜ | **T6 / T-exit** Exit gate（宣告 M3） | [T6-exit-gate.md](T6-exit-gate.md) | T1–T5 | Med |

## Execution rules
- 一個 task = 一個切片 = 一個原子 commit；先驗證再 commit。
- task 完成更新 [progress.md](progress.md) 並翻 Done box。
- WP-7 全綠 → 翻 [頂層索引](../../README.md) §2 WP-7 ✅ 並標記 **M3 達成**。
- 順序：T0 →（T1 → T2）∥（T3）→ T4 → T5 → T6。
