# WP-21 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 未開始

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 seeded spawn | ⬜ |
| T2 偵測 drill config | ⬜ |
| T3 離線推導 spec + fixture | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S3-2 t_detect 參數起點(θ_v 倍率 / k tick;spec 標「暫定」) | ⬜ open | — |
| OQ-21.1 `spawnArea` 幾何範圍預設(yawDegRange/distanceURange 與房間/場景/走廊的相容範圍) | ⬜ open | — |
| OQ-21.2 seeded 取樣次序定稿(計畫預設:delay → yaw → distance)+ spawn 事件位置欄落點(v2 additive) | ⬜ open | — |

---

## Log

### 2026-07-06 — Plan authored
- 由 stage3 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T3 + T-exit)。
- 決議依據:GD-8(pop-in 刺激 `t_visible`=spawn tick 語意不變;t_detect = 瞄準 onset
  離線推導;偏心度共變數)、GD-7(原始資料全記錄——推導輸入 = v2 逐 tick 欄)、
  GD-5(spawn 隨機化一律 seeded,重用 `createRan1`)。
- 設計要點:**零破壞不變式**(無 seed 路徑逐位不變)是 T1 的 DoD 首項;
  t_detect 推導完全離線(引擎零新計算),spec 即分析端介面。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD 收斂 + spawnArea 決議,docs-only。
