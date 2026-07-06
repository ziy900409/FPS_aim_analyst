# WP-22 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 未開始(M9 未過不展開;WP-18 未交付前 T1 不開跑)

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 追蹤 × 場景 | ⬜ |
| T2 protocol 執行器 + E2E | ⬜ |
| T3 決定性 + 驗收清單 C | ⬜ |
| T-exit(M10) | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S3-5 WP-18 交付形狀對帳(presentation policy / 追蹤 drill config 型 / 目標內插) | ⬜ open | — |
| OQ-22.1 protocol 條件標記落點(meta 何欄標記「本 drill 屬哪個條件/序位」) | ⬜ open | — |
| OQ-22.2 pilot protocol 文件範圍(是否含受試者 ID/同意書行政欄 → 與 WP-20 T4 表單對帳) | ⬜ open | — |

---

## Log

### 2026-07-06 — Plan authored
- 由 stage3 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T3 + T-exit)。
- 決議依據:GD-7(追蹤 × 場景的消費面)、GD-10(受試者內 protocol 三道防線的整合點)。
- 設計要點:protocol 執行器為 **config 資料驅動**(對抗平衡順序 = 研究者排定的資料,
  非引擎邏輯);條件失效採**條件級 suspect**(非整 session 丟棄)。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— 四上游 exit 驗證,docs-only。
  ⚠️ entry 條件:M9(WP-19)+ WP-20/21 exit + **WP-18 exit(stage2 M8 後)**。
