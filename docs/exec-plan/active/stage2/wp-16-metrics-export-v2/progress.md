# WP-16 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 未開始

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 schema v2 | ⬜ |
| T2 理想路徑指標 | ⬜ |
| T3 結果頁對照 | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-3 感度語意/schema 斷代(`sensitivityModel` 已由 WP-12 落地;`schemaVersion` bump 政策本 WP 收尾) | ⬜ open | — |
| 稽核不確定清單 #4:`targetCenterOffsetDeg` 語意(相對誰的中心/正負號)定稿 | ⬜ open | — |

---

## Log

### 2026-07-07 — FPSci R1 對齊決策(使用者拍板,grill)
- **對映表入 T1**:schema v2 設計時同步產出 FPSci 欄位對映表(schema.md 附錄);
  **命名 CONTEXT.md 正規術語優先、既有欄位不改名**,僅 v2 全新欄位且語意完全相同時採 FPSci 命名——
  可比性由對映表承擔,不由改名承擔(R1 原文「沿用其命名慣例」與 CLAUDE.md §2 命名協議衝突,以後者為準)。
- 授權邊界:GD-11(禁碰 FPSci 程式碼;欄位語意/文件/論文可參考)。
- 出處:[FPSci 評估 R1](../../../../research/FPSci_評估與建議.md)。

### 2026-07-03 — Valorant 接口決策(使用者拍板)
- meta 擴欄追加 **`movementModel`**(移動模型語意斷代,比照 `sensitivityModel`):Valorant 移動
  本階段不實作,資料面先留可比性接口;值對齊 WP-14 `MovementProfile` id。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md) §6 WP-16 表 + session 補充決定)展開為自足 task 檔(T0–T3 + T-exit)。
- 補充決定:`schemaVersion` bump 落 T1(WP-12 只加 `sensitivityModel`);`DrillConfig.weaponId?`
  選填欄與 meta `rngSeed`(WP-13 OQ-13.1 的 seed 記錄)一併落 T1;arena 容量以 fire 事件率上限
  (= magSize/cycletime)重估。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— WP-13 exit 驗證 + 兩條語意決議,docs-only。
