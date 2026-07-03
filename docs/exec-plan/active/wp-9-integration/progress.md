# WP-9 — Progress Log ★M4（階段 A 交付）

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 T1/T2/T3/T4 complete; T5 exit gate 待執行（達成即 M4 階段 A 交付）

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-03） |
| T1 E2E 整合 | ✅ 完成（2026-07-03） |
| T2 計時效度 | ✅ 完成（2026-07-03，實玩分布中位數為手動驗收補項→T4） |
| T3 決定性回歸 | ✅ 完成（2026-07-03，`test:ci` exit-code 閘生效） |
| T4 緩衝 + 附錄 E | ✅ 完成（2026-07-03，附錄 E 10 項對照證據；整合期無新缺陷） |
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

### 2026-07-03 12:52Z — T4 緩衝 + 附錄 E 驗收 ✅
- **交付**：[`docs/operational/acceptance-stage-a.md`](../../../operational/acceptance-stage-a.md)——規格附錄 E 階段 A **10 項硬閘**逐項對照證據（自動 A / 手動 M 標註，OQ-9.4）＋非阻塞項（F5 接縫 + 2 個階段 A+ 移動目標項）＋手動驗收補項清單。
- **緩衝（FR-9.4）**：於乾淨工作樹全套重跑作驗收基線——`tsc --noEmit` 乾淨；`vitest run` → **26 files / 185 tests passed**；`playwright test` → **7 passed（Edge）**；`test:ci` → **exit 0**。整合期**未暴露新缺陷**，無需小修（歷史整合修正 `6c4cbe9` switch-time / `7fd80d8` HUD 版位已於 WP-8 落地）。
- **附錄 E 10 項對照**：COI(1)→isolation/full-drill e2e；後端 metadata(2)→backend e2e + metadata.test；128Hz 決定性(3)→regression/determinism(15) + loop determinism(9)；A/D 急停 gate(4)→MovementController/firstShot；目標交替 t_visible(5)→TargetManager(18)；首發不稀釋(6)→firstShot(8)/HitDetector；完整 drill(7)→full-drill e2e + 實機 `4eb1926`；JSON/CSV schema(8)→export.test(serializeCSV ticks+events) + schema.md；§5 統計(9)→metrics/compute + 統計＝匯出斷言；反應分布(10)→reaction-time.test(計算) + 實玩中位數(手動)。**10 項全有證據、無漏項**。
- **Decision（涵蓋範圍：10 硬閘 vs 全附錄 E 13 項）**：doc 主表列 T0-lock 定的階段 A **10 項硬閘**；F5 接縫與 2 個「階段 A+／延後」移動目標項另立**非阻塞**節，僅記狀態不阻 M4。*Why*：T0 lock 已定移動目標項非階段 A 交付閘。*Alternatives*：把 13 項全列為硬閘——否決（與 T0 lock 及規格「階段 A+／延後」標註矛盾，會誤將延後項當交付阻塞）。
- **F5 接縫查核**：`targets.motion?` 選填欄 + `TargetMotion` 型別已就位（`schema.ts` `validateMotion`、`state/types.ts`、`schema.test.ts` 覆蓋「無 motion 向後相容」）；階段 A 目標恆靜止，SimLoop per-tick 位置更新為階段 A+ 消費點——與規格附錄 G「先立型別、階段 A 不實作移動」一致。
- **Surprise**：無。緩衝步驟預期可能暴露整合 bug，實測全綠——三道計時防線（COI e2e / 反應 sanity / 決定性回歸）＋各 WP exit-gate 已把關，T4 緩衝落為純驗收對照。
- **Open Questions**：實玩反應中位數 + 原生輸入手感仍為手動補項（OQ-9.2/9.4），列於 acceptance doc §3，於 T5 exit gate 由研究者確認回填。
- **Next**：T5 Exit gate——宣告 **M4 階段 A 交付**，翻頂層索引 WP-9 ✅ + M4 達成。

### 2026-07-03 12:36Z — T3 決定性回歸（自動化）✅
- **交付**：`tests/regression/determinism.test.ts`（15 tests）＋ `package.json` `test:ci`（`tsc --noEmit && vitest run && playwright test`，exit code 為閘）。
- **升級（vs WP-2 T4 純 movement）**：驅動與生產同源的**完整管線**——`createSimLoop + MovementController + consume + TargetManager + DrillRunner + DataRecorder`（不注入 camera）——在 60/144/240Hz + 抖動 ±50% 幀序列下斷言四層：(1) 逐 tick 狀態 `{x,z,vx,vz,stopped}` exact 對齊 canonical per-tick 軌跡；(2) **整份記錄資料集**（`DataRecorder` snapshot：ticks + events〔visible/counter/fire〕+ overflow）跨 FPS **bit-exact**（＝匯出資料 render-FPS 無關，強於 WP-2 只比 `{x,z,vx,vz}`）；(3) countdown→running 以 sim clock 判定故轉換 tick 與 FPS 無關；(4) 反向鍵急停兩方向（counter 'A'/'D'）於固定 t、急停 tick vx=0/stopped=true；(5) 重播 + 大 gap/多小幀切分 bit-exact（守無 `Date.now`/`Math.random` 洩漏）。
- **驗證**：`vitest run tests/regression/determinism.test.ts` → **15 passed**；全套 `vitest run` → **26 files / 185 tests passed**（前 25/170，+1 file/+15）；`tsc --noEmit` 乾淨；`npm run test:ci` → tsc + vitest(185) + playwright(7 e2e) 全綠、**exit 0**（閘生效）。
- **Decision（檔名 `.spec.ts`→`.test.ts`）**：計畫（README §2 / T3 Touches）寫 `tests/regression/determinism.spec.ts`，實作改 `tests/regression/determinism.test.ts`。*Why*：Vitest `include=['src/**/*.test.ts','tests/**/*.test.ts']`、Playwright `testDir=tests/e2e`——`.spec.ts` 放 `tests/regression/` 會被**兩個 runner 都不收**（靜默不跑，正是 T2 決策 log 警告的反模式）。FR-9.3 明指 Vitest，故沿 T2 已定的副檔名分工（單元/驗證 `.test.ts` / e2e `.spec.ts`）改 `.test.ts`。*Alternatives*：(a) 照字面用 `.spec.ts` 並擴 Vitest include 收 `tests/regression/*.spec.ts`——否決：與既有分工衝突、且 Playwright glob 未來若擴 testDir 易誤收；(b) 放 `tests/e2e/`——否決：這是 node 決定性單元測試、非瀏覽器 e2e。
- **Decision（不注入 camera / 範圍）**：完整 sim 決定性斷言逐 tick **sim 狀態** + 記錄資料集，**不**含 hit-detection。*Why*：命中依 camera 朝向，是每-幀外部耦合（生產由 render loop 每幀更新、非 per-tick sim 狀態），本質不屬「同輸入序列跨 FPS 一致」的 sim 決定性範疇；真瀏覽器 per-tick 瞄準的命中鏈路已由 T1 E2E 覆蓋。故此處 fire 事件記錄但 `hit=false`。與 CLAUDE.md §4「sim 狀態(position/velocity/命中)一致」不衝突：該處「命中」指 sim 內 markKilled 後的狀態流轉（需 camera，屬 T1），此回歸守的是其上游 movement/急停/輸入/目標時間源的 FPS 無關性。
- **Surprise**：`drillRunner.start(config)` 內部 `resetState` 會 **clear 輸入 ring**——首版把合成輸入在 `start()` **之前** push（沿 WP-2 T4 習慣），被 reset 清光 → 3 個涵蓋斷言紅燈（無 counter/fire、vx 恆 0），但 12 個決定性斷言反而「全綠」（各 FPS 一致同意「什麼都沒發生」）。修正：改在 `start()` **之後**才 up-front push 全部合成輸入。教訓：determinism 斷言「跨 FPS 一致」與「有沒有真的跑到邏輯」是兩件事，需獨立的涵蓋斷言把關（本檔第三個 describe）。
- **CI**：repo 仍無 `.github/`（OQ-9.3），故只落 `test:ci` 本機 exit-code 閘、不加 workflow。
- **Open Questions**：無新增。
- **Next**：T4（緩衝 + 附錄 E 驗收：階段 A 10 項自動/手動證據對照；回填 T2 實玩分布中位數手動項）。

### 2026-07-03 12:23Z — T2 計時效度驗證 ✅
- **交付**：`tests/validity/reaction-time.test.ts`（6 tests）＋ `docs/operational/timing-validity.md`（方法論 + 誤差界線）。
- **兩層守護**：(1) **確定性驗算**——餵已知間隔 → `counterReactionMs` 精確等於該間隔（150/200/250）；斷言基準為量測時鐘域相對差（整體平移 clock origin +9,876,543 後反應值不變）；左右 peek 反應時間各自歸位（left [190,210] / right [160,170] / diff 35）。(2) **分布量級 sanity**——`withinReactionBand([150,250])` 把 OQ-9.2 判準寫成可執行邏輯：文獻量級樣本中位數落帶內 ✓；系統性偏離（<50 ms、>1 s）落帶外 → 示警查計時管線。
- **驗證**：`vitest run tests/validity/reaction-time.test.ts` → **6 passed**；全套 `vitest run` → **25 files / 170 tests passed**（前 24/164，+1 file/+6）；`tsc --noEmit` 乾淨。
- **Decision（新測試檔的 vitest 收錄）**：擴 `vite.config.ts` `test.include` 為 `['src/**/*.test.ts','tests/**/*.test.ts']`。*Alternatives*：(a) 把測試放 `src/` 下——但 T2 計畫明列路徑 `tests/validity/`，且此為跨模組**驗證**測試（非單一元件），語意上屬 `tests/`；(b) 維持只收 `src/`——則計畫路徑的檔不被收、靜默不跑。副檔名分工不變（單元/驗證 `.test.ts` / e2e `.spec.ts`）；Playwright `testDir=tests/e2e` 不會誤收 `tests/validity`（已驗全套仍綠且 e2e 未受影響）。
- **Decision（實玩分布中位數歸屬）**：反應時間**計算正確性**（FR-9.2 核心）已由確定性測試自動守護；**實玩樣本中位數落 ~150–250 ms** 需真人運動-知覺反應，無法在此 headless session 合成，歸為**手動驗收補項**（OQ-9.2/9.4 一致），於 T4 附錄 E 手動項執行並回填此 log。*Alternatives*：合成一組「看起來合理」的假樣本填數字——否決（造假，無效度意義）。
- **Surprise**：`buildPeekWindows` 對反應時間單位/基準完全由 `counter.t − visible.t` 決定，故 clock-origin 不變性可用「整體平移時間戳」單一斷言精準覆蓋，無需 mock `performance.now()`。
- **Open Questions**：OQ-9.2 的實玩中位數（手動）待 T4；其餘無。
- **Next**：T3（決定性回歸自動化 + `test:ci` 閘）。

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
