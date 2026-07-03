# WP-9 — Progress Log ★M4（階段 A 交付）

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 T1 complete; T2/T3 ready（達成即 M4 階段 A 交付）

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-03） |
| T1 E2E 整合 | ✅ 完成（2026-07-03） |
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

### 2026-07-03 12:12Z — T1 E2E 整合 ✅
- **交付**：`window.__fpsTest` 測試掛點（`src/testharness/fpsTestHarness.ts`，dev-only）＋ `tests/e2e/full-drill.spec.ts`。全鏈路：COI 斷言 → `startDrill` → `runCounterStrafeRound(20)` → `forceExportJSON` → schema/事件/metadata 斷言 → 統計＝匯出。
- **驗證**：`playwright test full-drill` → **1 passed（Edge, 1.5s）**；`tsc` 乾淨；`vitest --run` → 24 files / 164 tests 仍全綠；`vite build` 成功且 **dist 無 harness 符號**（production 剝除已驗）。
- **斷言涵蓋**：`crossOriginIsolated===true`；phase 到 `ended`（endCondition targetCount=20）；meta 16 欄齊全且值合法（drillId/backend/simHz=128/unit=source/vStrafe=250/maxDrillSeconds=300/suspect=false…）；ticks 非空且全有限；events 含 20 visible + 20 counter + 20 fire，fire 欄位齊全、20 首發命中；firstShotHitRate=100、counterReactionMs.n=20（mean>0）、residualSpeed.n=20、L+R 對稱 n=20；`getMetrics()` 與 JSON round-trip 後 `metricsFromExport()` 逐欄一致。
- **Decision（harness 架構：獨立決定性管線 vs. 驅動 live 單例）**：採**獨立管線**——harness 以注入合成 clock 自建與生產同源的 sim 管線（`createSimLoop`/`createDrillRunner`/`createTargetManager`/`createDataRecorder` + `three/webgpu` camera + `collectMeta`/`buildExportPayload`/`computeMetrics`），不驅動 main.ts 由 rAF 每幀 pump 的 live 單例。*Alternatives considered*：(a) 驅動 live 單例——但 live `simLoop` 綁 `realClock` 且被 render loop 每幀推進，注入合成輸入會與 rAF 競態、且 tick 窗時間域（內部 `simTimeMs`）不可控 → 無法決定性重現；(b) 純 timestamp 驅動的 `feedInput`——spawn 時機（countdown/kill→respawn）難與固定相對時間戳對齊、脆弱。獨立管線 + 狀態同步的 `runCounterStrafeRound`（等目標可見才動作）得到零競態、exact 的全鏈路，且 E2E 相對 node 決定性單元測試的加值（真瀏覽器 COI / 真 `navigator` metadata / 真 drill JSON / 真 export+metrics 程式路徑）完整保留。
- **Surprise**：合成 clock 每次 `advanceOneTick()` 推進恰一個 `tickMs` 且 pump 恰跑 1 tick（`accSec += tickSec`），故 `clockMs === 內部 simTimeMs`（皆從 0 起、同步推進）——輸入事件 push 於 `t = clockMs`（= 上一 tick 末），下一 tick 的半開窗（嚴格 `<`）即精準消費，無需 epsilon 猜測。counter 事件需「移動中（vx<0，A 已按下並經 ≥1 movement tick）再按反向鍵 D」；急停穿越 tick 後 vx→0，開火 residualSpeed=0。
- **Open Questions**：無（OQ-9.1 harness 合成輸入 + COI/匯出斷言路徑已落地驗證）。
- **Next**：T2（計時效度 150–250 ms）/ T3（決定性回歸自動化 + `test:ci` 閘）可並行。

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
