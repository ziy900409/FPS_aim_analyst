# WP-19 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 未開始

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 SceneConfig schema | ⬜ |
| T2 GLTF 管線 + field-low | ⬜ |
| T3 淨空驗證器 | ⬜ |
| T4 場景切換 + meta | ⬜ |
| T5 urban-high + perf | ⬜ |
| T-exit(M9) | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S3-3 場景資產選型(3 候選比 draw calls/授權/雜亂度對應) | ⬜ open | — |
| OQ-19.1 `CLEARANCE_MARGIN_U` 起點值(計畫預設 0.5u)與玩家走廊 `halfWidthU` 預設 | ⬜ open | — |
| OQ-19.2 meta.scene 落點確認:WP-16 已留 optional 區塊縫?(未留 → T4 與 WP-16 對帳) | ⬜ open | — |

---

## Log

### 2026-07-06 — Plan authored
- 由 stage3 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T5 + T-exit)。
- 決議依據:GD-6(純裝飾 + 淨空驗證;prop-bounds 永不進 sim)、GD-9(寫實原創 + CC0/CC-BY;
  `sceneId` 中性命名、`assetPackVersion` 斷代)。
- 設計要點:佔位房間收編為 `SceneConfig`(`asset: null`)使 fallback 與正常路徑同構;
  `src/sim` 不得 import `src/scene`(GD-6 架構閘)。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD 收斂驗證 + 資產選型,docs-only。
