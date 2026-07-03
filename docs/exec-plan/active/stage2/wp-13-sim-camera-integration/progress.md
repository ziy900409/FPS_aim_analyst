# WP-13 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 未開始

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 simStep 佈線 | ⬜ |
| T2 相機/彈道合成 | ⬜ |
| T3 彈孔 + overlay | ⬜ |
| T-exit(M6) | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-4 `view_recoil_tracking` CS2 值(僅視覺;先做開關 + 可調常數,預設關) | ⬜ open(不阻塞) | — |
| OQ-13.1 spread RNG 的 `DEFAULT_RNG_SEED` 值與 drill seed 分流(drill.sequence.seed 兼用 or 獨立欄) | ⬜ open | T1 設計時定案,seed 記錄交 WP-16 |

---

## Log

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md))展開;整合點承稽核 A2(punch 每幀重組)、
  A6(deg/rad + pitch 符號單點轉換)與研究計畫 Phase 2(視覺≠實際分離)。
- **M5 未過不得開工**(T0 把關);T1/T2 為 High risk,failure modes 見 README §3。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))。