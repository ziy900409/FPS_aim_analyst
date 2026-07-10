# WP-24 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 未開始

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 EV_ADS 輸入鏈 | ⬜ |
| T2 WeaponConfig.ads + zoom | ⬜ |
| T3 overlay + 記錄 | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S5-1 ADS 感度換算模型(CS2 zoom_sensitivity_ratio vs monitor-distance match)→ **GD-16** | 🟡 待 T0 | 計畫預設:CS2 式 `sensitivity × sensitivityRatio × (adsFov/hipFov)`,ratio 預設 1.0;拍板後入 DECISIONS.md GD-16 並 pre-registered 凍結 |
| OQ-S5-6 ADS 操作語意(hold vs toggle) | 🟡 待 T0 | 計畫預設:hold(右鍵按住;stuck-ads 防護簡單);toggle 留 config 候補 |
| OQ-24.1 ads FOV 過渡時長(render 內插)與 overlay 淡入語意 | 🟡 待 T2 | 預設:120ms 線性(render-only,不進 sim/記錄;記錄的是 heldAds 事件與 flag,非視覺過渡) |

---

## Log

### 2026-07-10 — Plan authored

- 由 stage5 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T3 + T-exit)。
- 決議依據:GD-4(aim 僅觀測——ADS gain 落 `CameraController.applyDelta`,sim 零改動)、
  GD-5(0.022°/count 感度慣例)、WP-11 fire down/up 事件模式(EV_ADS 全面比照:packed b=down、
  held 旗標、stuck 防護、分桶消費)。
- 設計要點:**記錄 = 效度必要條件**——aim 資料已含 gain,分析端必須靠 tick `ads` flag +
  ads 事件還原構念,缺記錄該 drill 分析無效(FR-E6 為硬 DoD)。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD-16 拍板,docs-only。
