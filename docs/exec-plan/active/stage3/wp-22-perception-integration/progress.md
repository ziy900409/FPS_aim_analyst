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
| OQ-22.2 pilot protocol 文件範圍(是否含受試者 ID/同意書行政欄 → 與 WP-20 T4 表單對帳) | 🟡 部分解 | 受試者 ID 已提前落 WP-20 T4(`participantId`/`sessionLabel` → meta `session` 區塊,GD-12/R3,2026-07-07);餘同意書行政欄待 T0 對帳 |

---

## Log

### 2026-07-07 — FPSci R3/R4/R6 對齊(grill,GD-12)
- OQ-22.2 部分解:受試者 ID 提前至 WP-20 T4(`participantId` 必填/`sessionLabel` 選填,
  meta `session` 區塊)——本 WP T2 protocol 執行器與 E2E 應消費/斷言該欄;
  同意書行政欄仍歸 pilot protocol 文件層(T0 對帳)。
- **R4**:T3 的 `pilot-protocol-stage3.md` 納 FPSci 論文反應時間分布(150–250ms)作
  效度 baseline 引用(GD-11 紅線:引論文數據,不碰程式碼)。
- **R6 觸發點**:pilot protocol 題組定案時再議問卷模組(屆時複用 WP-20 T4 DOM 表單模式);
  過渡期可外部問卷 + `participantId` 離線串接。

### 2026-07-06 — Plan authored
- 由 stage3 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T3 + T-exit)。
- 決議依據:GD-7(追蹤 × 場景的消費面)、GD-10(受試者內 protocol 三道防線的整合點)。
- 設計要點:protocol 執行器為 **config 資料驅動**(對抗平衡順序 = 研究者排定的資料,
  非引擎邏輯);條件失效採**條件級 suspect**(非整 session 丟棄)。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— 四上游 exit 驗證,docs-only。
  ⚠️ entry 條件:M9(WP-19)+ WP-20/21 exit + **WP-18 exit(stage2 M8 後)**。
