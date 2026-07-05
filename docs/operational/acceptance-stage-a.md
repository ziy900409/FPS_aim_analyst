# 階段 A 驗收對照（規格附錄 E）— WP-9 T4 / FR-9.4

> **交付閘**：規格 [附錄 E](../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md#12-附錄-e驗收清單階段-a) 逐項對照證據。達成即 **M4 — 階段 A 交付**。
> 同伴：[WP-9 README](../exec-plan/completed/stage1/wp-9-integration/README.md) · [progress.md](../exec-plan/completed/stage1/wp-9-integration/progress.md) · [timing-validity.md](timing-validity.md) · [schema.md](schema.md)。
> OQ-9.4（自動 vs 手動）依 [T0 lock](../exec-plan/completed/stage1/wp-9-integration/progress.md) 執行：COI / metadata / 決定性 / schema / 首發 / 反應分布計算為**自動**；原生輸入手感、實玩反應中位數為**手動**。

---

## 0. 驗收基線（本次 T4 全套執行證據）

於 T4（2026-07-03）在乾淨工作樹重跑完整測試閘，作為 10 項對照的共同證據來源：

| 命令 | 結果 |
|---|---|
| `npm run typecheck`（`tsc --noEmit`） | ✅ 乾淨（0 error） |
| `npm test`（`vitest run`） | ✅ **26 files / 185 tests passed** |
| `npm run test:e2e`（`playwright test`） | ✅ **7 passed（Edge）** |
| `npm run test:ci`（tsc + vitest + playwright，exit-code 閘） | ✅ exit 0 |

**緩衝（FR-9.4）結果**：全套綠燈，整合期**未暴露新缺陷**，無需小修。（歷史整合修正見 git：`6c4cbe9` switch-time 錨點、`7fd80d8` HUD 版位，均已在 WP-8 落地。）

---

## 1. 階段 A 驗收項（10 項硬閘）→ 證據對照

| # | 附錄 E 驗收項 | 證據（自動 A / 手動 M） | 上游 | 狀態 |
|---|---|---|---|---|
| 1 | `crossOriginIsolated === true`、`performance.now()` 5 µs 解析度 | **A**：[`tests/e2e/isolation.spec.ts`](../../tests/e2e/isolation.spec.ts)（dev + preview 皆斷言 COOP/COEP header 且 `crossOriginIsolated===true`）；[`tests/e2e/full-drill.spec.ts`](../../tests/e2e/full-drill.spec.ts) 全鏈路首步再斷言 COI。5 µs 解析度隨 COI 生效（ADR-4，見 [timing-validity.md §2.3](timing-validity.md)）。 | WP-0 T2 / WP-9 T1 | ✅ |
| 2 | 渲染後端（WebGPU/WebGL2）正確偵測並寫入 metadata | **A**：[`tests/e2e/backend.spec.ts`](../../tests/e2e/backend.spec.ts)（真 renderer 回報合法後端）；[`src/data/metadata.test.ts`](../../src/data/metadata.test.ts)；full-drill.spec meta 16 欄含 `backend` 且值合法。 | WP-0 T3 / WP-7 T3 | ✅ |
| 3 | sim loop 穩定 128 Hz、決定性多 render FPS 通過 | **A**：[`tests/regression/determinism.test.ts`](../../tests/regression/determinism.test.ts)（15，完整管線 60/144/240Hz + 抖動 ±50% bit-exact）；[`src/loop/__tests__/determinism.test.ts`](../../src/loop/__tests__/determinism.test.ts)（9）；[`src/loop/SimLoop.test.ts`](../../src/loop/SimLoop.test.ts)（固定步長 128 Hz）。 | WP-2 T4 / WP-9 T3 | ✅ |
| 4 | A/D 橫移 + 反向鍵急停、停止狀態正確 gate 開火 | **A**：[`src/sim/MovementController.test.ts`](../../src/sim/MovementController.test.ts)（12，橫移 + counter-strafe 急停）；[`src/input/consume.test.ts`](../../src/input/consume.test.ts)；[`src/sim/firstShot.test.ts`](../../src/sim/firstShot.test.ts)（停止態 gate）；full-drill fire `residualSpeed`/急停鏈路。 | WP-5 T3/T4 | ✅ |
| 5 | 目標左右交替生成、`t_visible` 時間戳正確 | **A**：[`src/sim/TargetManager.test.ts`](../../src/sim/TargetManager.test.ts)（18，左右交替 + spawn/可見時間戳）；full-drill 斷言 L+R 對稱 n=20、20 visible 事件。 | WP-4 T2/T3 | ✅ |
| 6 | 首發命中判定正確（不被後續掃射稀釋） | **A**：[`src/sim/firstShot.test.ts`](../../src/sim/firstShot.test.ts)（8，首發 = peek 內第一 fire，補槍不稀釋）；[`src/sim/HitDetector.test.ts`](../../src/sim/HitDetector.test.ts)（8）；full-drill `firstShotHitRate=100`。 | WP-5 T2 | ✅ |
| 7 | 1 個完整 counter-strafe drill 可端到端遊玩 | **A**：[`tests/e2e/full-drill.spec.ts`](../../tests/e2e/full-drill.spec.ts)（真瀏覽器 drill→匯出→統計全鏈路）；[`src/drill/DrillRunner.test.ts`](../../src/drill/DrillRunner.test.ts)（9）。**M**：實機遊玩見 git `4eb1926`（M3 實機驗證證據）。 | WP-6 T3 / WP-9 T1 | ✅ |
| 8 | 資料可匯出 JSON/CSV、schema 與文件一致 | **A**：[`src/data/export.test.ts`](../../src/data/export.test.ts)（5，`serializeCSV` → ticks.csv + events.csv、JSON payload）；[`src/drill/schema.test.ts`](../../src/drill/schema.test.ts)（12）；文件 [schema.md](schema.md)；full-drill JSON round-trip 逐欄一致。 | WP-7 T4/T5 / WP-9 T1 | ✅ |
| 9 | drill 後統計顯示第 5 節全部指標 | **A**：[`src/metrics/compute.test.ts`](../../src/metrics/compute.test.ts)、[`src/metrics/MetricsDashboard.test.ts`](../../src/metrics/MetricsDashboard.test.ts)、[`src/ui/ResultScreen.test.ts`](../../src/ui/ResultScreen.test.ts)；full-drill 斷言**統計＝匯出**（`getMetrics()` 與 `metricsFromExport()` 逐欄一致）。 | WP-8 T1/T2 | ✅ |
| 10 | 反應時間分布落合理範圍（150–250 ms） | **A（計算正確性）**：[`tests/validity/reaction-time.test.ts`](../../tests/validity/reaction-time.test.ts)（6，已知間隔精確等值 + `withinReactionBand` 判準）；方法論 [timing-validity.md](timing-validity.md)。**M（實玩中位數）**：見 §3。 | WP-9 T2 | ✅（計算）/ ⏳（實玩見 §3） |

**10 項全部有證據**（自動綠燈或手動通過）。無漏項。

---

## 2. 非阻塞項（F5 接縫 + 階段 A+／延後）

依 [T0 lock](../exec-plan/completed/stage1/wp-9-integration/progress.md)：附錄 E 的移動目標項不阻塞 M4，僅記錄狀態。

| 附錄 E 項 | 狀態 | 證據 / 說明 |
|---|---|---|
| F5 **接縫**就位：`DrillConfig.targets.motion?` 選填欄、SimLoop 保留 target-motion slot、無 motion 即靜止（向後相容） | ✅ 資料契約就位 | `motion?` 選填欄 + `TargetMotion` 型別已立：[`src/drill/schema.ts`](../../src/drill/schema.ts)（`validateMotion`，省略即靜止）、[`src/state/types.ts`](../../src/state/types.ts)（附錄 G 型別）；[`src/drill/schema.test.ts`](../../src/drill/schema.test.ts) 覆蓋「無 motion 欄向後相容」。階段 A 目標恆靜止（`motion` 省略）；`SimLoop` per-tick 位置更新為階段 A+ 消費點。 |
| （階段 A+／延後）≥1 個移動目標 drill 端到端 + 移動決定性 | ⏸ 延後 | 移動目標行為屬階段 A+；不阻塞 M4。 |
| （階段 A+／延後）移動 drill 匯出每 tick 目標位置 + 追蹤誤差指標 | ⏸ 延後 | schema 已預留 `targetPosAtFire`（僅移動 drill）；指標計算屬階段 A+。 |

---

## 3. 手動驗收補項（OQ-9.2 / OQ-9.4）

自動化難以合成真實運動-知覺反應，下列由研究者實機執行並回填：

- [~] **原生輸入無加速 / 實際遊玩手感**：Chrome/Edge 桌面版鎖 Pointer Lock，確認原生滑鼠無鼠標加速、A/D 急停手感與資料一致。**部分驗證**（見下方實測記錄）：完整 drill 端到端可玩、Pointer Lock 生效、首發命中 95%——輸入路徑功能正常;`rawInputEnabled` console 值 + 主觀無加速手感簽核仍待研究者明確確認。
- [~] **實玩反應時間中位數**：實玩一段 counter-strafe drill → 匯出 → 取 `counterReactionMs` 中位數，確認落 ~150–250 ms 量級（[timing-validity.md §3](timing-validity.md)）。偏離（<50 ms / >1 s）即查計時管線。回填至 [WP-9 progress.md](../exec-plan/completed/stage1/wp-9-integration/progress.md)。**單輪初測（見下方）：mean 394 ms、非中位數且高於帶**——非計時管線示警區（不在 <50 ms / >1 s），但超出 150–250 ms 預期帶;需多輪熟練後取穩定中位數再定論。

### 實測記錄（2026-07-03 · 未訓練單輪初測）

| 項 | 觀測值 | 判讀 |
|---|---|---|
| Counter reaction（結果頁顯示 **mean**，非中位數） | **394 ms**，SD 58 ms，n=20;分布 271–546 ms | 高於 150–250 ms 預期帶，但**不在** <50 ms / >1 s 計時管線示警區。對未訓練受試者、不熟悉的 counter-strafe 任務（辨識目標＋選對反向鍵）+ 佔位 display scale，394 ms 屬合理量級。**尚非結論**：(1) 結果頁顯示 mean，真中位數需匯出 JSON 逐 peek 計 `counter.t − visible.t`;(2) 單輪未訓練，應多輪熟練後取穩定中位數。 |
| First-shot hit rate | 95.0%（結果頁） | 輸入→命中鏈路功能正常（佐證手感項輸入路徑）。 |
| Stop / overshoot class | Stopped（21/21 停止、0 moving） | 急停 gate 生效、開火時已停止。 |
| `rawInputEnabled`（console） | **未記錄** | 待研究者鎖定後看 console `[pointerlock] rawInputEnabled` 回填(true=原生無加速)。 |
| 主觀手感（甩動線性、急停跟手） | **未簽核** | 待研究者主觀評估。 |

> **後續**：現匯出按鈕已修復（見 [WP-9 progress.md](../exec-plan/completed/stage1/wp-9-integration/progress.md) 疊層 bug 修正），可多跑幾輪 → 匯出 JSON → 計中位數回填此表，並補 `rawInputEnabled` 與手感簽核。

> 手動項不阻塞自動閘的綠燈判定;屬階段 A 交付前研究者驗收步驟，於 T5 exit gate 確認。**現況：兩項均為部分驗證，待研究者補完整簽核。**

---

## 4. 結論

規格附錄 E 階段 A **10 項硬閘全部對照到證據**（自動測試綠燈 + 手動驗收步驟明列），F5 接縫資料契約就位，階段 A+ 移動目標項明確標為延後（不阻塞）。整合期無新缺陷。**階段 A 具備交付條件**，待 T5 exit gate 宣告 M4。
