# WP-0 — Master Task Checklist

> 每 task 一個自足檔案，單 task 執行時 context 用量遠低於 40%——只開你正在做的 task（+ 指名原始檔）。
> Spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 頂層索引：[../../README.md](../../README.md)

| Done | Task | File | Depends on | Risk |
|------|------|------|------------|------|
| ✅ | **T0** Entry gate（驗證 only，no code） | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** Scaffold（Vite+TS+three/webgpu 空場景） | [T1-scaffold.md](T1-scaffold.md) | T0 | Low |
| ✅ | **T2** Cross-origin isolation（COOP/COEP + 斷言） | [T2-coop-coep-isolation.md](T2-coop-coep-isolation.md) | T1 | Med |
| ⬜ | **T3** WebGPU backend 偵測 + fallback + seam | [T3-webgpu-backend-detection.md](T3-webgpu-backend-detection.md) | T1 | Med |
| ⬜ | **T4** Deploy headers（host-agnostic） | [T4-deploy-headers.md](T4-deploy-headers.md) | T2 | Low |
| ⬜ | **T5** Reference notes（WP-1 預備） | [T5-reference-notes.md](T5-reference-notes.md) | — | Low |
| ⬜ | **T6 / T-exit** Exit gate | [T6-exit-gate.md](T6-exit-gate.md) | T1–T5 | Low |

## Execution rules

- 一個 task = 一個切片 = 一個原子 commit。先驗證再 commit；當前 task 未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message。
- task 完成時更新 [progress.md](progress.md)（Progress / Decision Log / Surprises / Open Questions），與切片一起 stage。
- task 落地把上表 **Done** box 翻 ✅。
- WP-0 全綠後，把 [頂層索引](../../README.md) §2 的 WP-0 狀態翻 ✅，並依需要把本資料夾移入 `../../completed/`。
- 建議順序：T0 → T1 →（T2 ∥ T3）→ T4 →（T5 任意時點）→ T6。
