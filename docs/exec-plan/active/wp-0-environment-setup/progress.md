# WP-0 — Progress Log

> Running log。最新在上。每個打勾的 checklist box 都附指令輸出 / 檔案路徑作為證據。
> 同伴：[README.md](README.md)（tech spec）· [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 規劃完成，待執行（T0–T6 皆未開始）

| Phase | State |
|-------|-------|
| T0 Entry gate | ⬜ 待執行 |
| T1 Scaffold | ⬜ 待執行 |
| T2 Cross-origin isolation | ⬜ 待執行 |
| T3 WebGPU backend 偵測 | ⬜ 待執行 |
| T4 Deploy headers | ⬜ 待執行 |
| T5 Reference notes | ⬜ 待執行 |
| T6 Exit gate | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-0.1 套件管理器 / Node 版本 | 🟡 建議 | npm + Node ≥ 20 LTS（PLAN `npm create vite`）；T0 驗證在場 |
| OQ-0.2 `three` 版本 | 🟡 建議 | 最新 stable ≥ r171（內建 WebGPU + WebGL2 fallback）；鎖 lockfile |
| OQ-0.3 靜態主機 | ⬜ 後定（D3） | 暫不選；T4 產 host-agnostic `_headers` + nginx 文件 |
| OQ-0.4 TS 嚴格度 / lint | 🟡 建議 | `strict: true` + 最小 ESLint；完整規則隨程式成長補 |

---

## Log

### （規劃）— WP-0 計畫產出
- 依 [PLAN.md](../../../PLAN.md) WP-0 與規格 §2 ADR-1/ADR-4 + 附錄 A/D，將 WP-0 展開為 7 個自足 task 檔（T0 entry-gate → T6 exit-gate），格式參照 `performance_analysis` repo 的 `issue-26` exec-plan。
- 確立 WP-0 三件地基：(1) `three/webgpu` 空場景、(2) `crossOriginIsolated===true`、(3) render backend 偵測（為 WP-7 metadata 預備 seam）。
- 記錄 OQ-0.1~0.4 建議解（npm + Node 20、three ≥ r171、host 後定、strict TS + 最小 ESLint），待 T0 在真實環境驗證後翻 ✅。
- **Next**：執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）— read-only 環境驗證，解 OQ-0.1/0.2/0.4，commit 文件。
