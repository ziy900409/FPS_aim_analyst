# WP-9 — Progress Log ★M4（階段 A 交付）

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 T0 entry gate complete; T1/T2/T3 ready（達成即 M4 階段 A 交付）

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-03） |
| T1 E2E 整合 | ⬜ 待執行 |
| T2 計時效度 | ⬜ 待執行 |
| T3 決定性回歸 | ⬜ 待執行 |
| T4 緩衝 + 附錄 E | ⬜ 待執行 |
| T5 Exit gate（M4） | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-9.1 E2E 模擬 Pointer Lock/原生 | ✅ Locked | harness 合成輸入做自動鏈路 + COI/匯出斷言；Pointer Lock / 原生無加速手動補 |
| OQ-9.2 計時效度判準 | ✅ Locked | 已知間隔確定性測試 + 實玩分布落 ~150–250 ms 量級 sanity（非單值硬閾） |
| OQ-9.3 決定性回歸 CI | ✅ Locked | 先加 `test:ci` 本機 exit-code 閘；repo 目前無 `.github/`，workflow 由 T3 條件性新增 |
| OQ-9.4 附錄 E 自動 vs 手動 | ✅ Locked | 階段 A 10 項：自動覆蓋 COI/metadata/決定性/schema/首發/反應分布等；原生手感手動；階段 A+ 移動目標項非阻塞 |

---

## Log

### 2026-07-03 09:53Z — T0 Entry gate ✅
- **上游 gate**：頂層索引 §2 確認 WP-0~8 皆 ✅；§3 確認 **M1 ✅（2026-07-01）**、**M2 ✅（2026-07-02）**、**M3 ✅（2026-07-03）**。WP-0~8 task-checklist 無剩餘 `⬜` 待辦列。
- **測試基線**：Vitest `npm.cmd test -- --run` → **24 files / 164 tests passed**（含 determinism 9 tests）。Playwright `npm.cmd run test:e2e` → **6 passed**（Edge；isolation dev/preview、backend、InputSampler E2E）。
- **OQ lock**：OQ-9.1~9.4 已翻 ✅。T1 使用 dev/test harness + 合成輸入；T2 採已知間隔測試 + 150-250 ms 分布 sanity；T3 先落 `test:ci` 本機閘；T4 將附錄 E 分為階段 A 10 項硬閘、手動驗收補項、階段 A+ 非阻塞項。
- **Surprise**：`npm` 在 PowerShell 受 execution policy 擋住；改用 `npm.cmd`。Playwright 首次在 sandbox 內啟動 webServer 時因 Vite/esbuild 讀取上層目錄被拒，批准後同一命令綠燈。
- **Next**：T1/T2/T3 可開始；依風險優先，建議先做 T3 `test:ci` + 完整 sim determinism，讓後續整合有單一閘。

### （規劃）— WP-9 計畫產出
- 依 PLAN WP-9（9.1–9.4）+ 規格附錄 E/F + §9.2 + §14 展開為 T0–T5。
- **M4 = 階段 A 交付**：附錄 E 驗收清單全綠為硬閘。三道計時效度防線：COI E2E 斷言 + 反應分布 sanity + 決定性回歸。
- **Next**：確認 WP-0~8 全 exit ✅ 後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
