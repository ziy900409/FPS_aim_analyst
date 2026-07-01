# WP-3 — Master Task Checklist

> 每 task 一個自足檔案。Spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 頂層索引：[../../README.md](../../README.md)
> **前置**：M1（WP-2）必須已達成。

| Done | Task | File | Depends on | Risk |
|------|------|------|------------|------|
| ✅ | **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | WP-2（M1） | Low |
| ✅ | **T1** 鍵盤採集 + timeStamp | [T1-keyboard.md](T1-keyboard.md) | T0 | Low |
| ✅ | **T2** 滑鼠 coalesced 採集 | [T2-mouse-coalesced.md](T2-mouse-coalesced.md) | T0 | Med |
| ✅ | **T3** 開火事件採集 | [T3-fire.md](T3-fire.md) | T0 | Low |
| ✅ | **T4** sim 依時序消費 + 排空 | [T4-sim-consume.md](T4-sim-consume.md) | T1, T2, T3 | Med |
| ✅ | **T4b** 固定欄位 ring buffer + 溢位 | [T4b-ring-buffer-overflow.md](T4b-ring-buffer-overflow.md) | T4 | Med |
| ⬜ | **T5 / T-exit** Exit gate | [T5-exit-gate.md](T5-exit-gate.md) | T1–T4（含 T4b） | Low |

## Execution rules
- 一個 task = 一個切片 = 一個原子 commit；先驗證再 commit。
- task 完成更新 [progress.md](progress.md) 並翻 Done box。
- WP-3 全綠 → 翻 [頂層索引](../../README.md) §2 WP-3 狀態。
- 順序：T0 →（T1 ∥ T2 ∥ T3）→ T4 → **T4b** → T5。（T4b 為 T4 拆分後的 ring buffer + 溢位收尾，見 T4 範圍拆分註記。）
