# WP-17 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ✅ M8 交付(2026-07-07):驗收清單 B 全 10 項通過、`test:ci` exit 0、兩層索引收斂 → **stage2 交付達成**

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ PASS 2026-07-07 |
| T1 決定性回歸擴充 | ✅ PASS 2026-07-07 |
| T2 全鏈路 E2E | ✅ PASS 2026-07-07 |
| T-exit(M8) | ✅ PASS 2026-07-07 |

---

## stage2 Outcomes 總結(M8 交付,2026-07-07)

**交付內容(WP-10~17):** CS2 後座力系統(seeded 彈道表 + HybridDecay punch 動力學 + 三成分 inaccuracy)、武器層(`WeaponConfig` + cycletime/彈匣/full-auto)、階段 B 真急停物理(friction/accelerate integrator + 連續 velocity gate ~88 u/s)、輸入接縫(CS2 0.022°/count 感度 + 射線方向注入)、相機視覺/彈道 punch 分離 + 彈孔 InstancedMesh、校準(M7 caveated)、匯出 schema v2 + 壓槍指標(補償 vs 理想路徑)+ 結果頁對照、全鏈路 E2E + punch/彈著 × 3 FPS 決定性回歸 + 驗收清單 B(附錄 E-B)。

**里程碑:** M5(2026-07-05)· M6(2026-07-06)· M7 caveated(2026-07-07)· **M8(2026-07-07)= stage2 交付**。

**Surprises(跨 WP):**
- M7 為 **caveated PASS**:速度用 sim cadence surrogate(非 `cl_showpos` 實錄),第三方 Aiming.Pro pattern 逐彈差異(yaw maxAbs 3.941°)歸因為來源模型不匹配、研究者接受(GD-14);外部實錄行為級真值仍列 caveat。
- `DataRecorder.ticks` 不含 recoil 逐 tick 欄位 → 決定性回歸鎖 fire 產彈點 punch/spread + `ImpactRing` 彈著序列(以 tick index 對齊),而非擴充 schema。
- `__fpsTest` 自建決定性管線(不驅動 live `DrillRunner`)→ T2 以 dev-only `showResult()` 橋接 harness metrics 到 production `ResultScreen`。

**Technical debt(有意識妥協,stage3 既知起點;照抄 [../README.md §7](../README.md)):**
1. **視角「記錄而非重建」**(§2.5):每發 fire 完整記錄 `viewYaw/viewPitch + aimPunch + spread + recoilIndex`,彈道可離線精確重建;觸發重構條件 = 研究需逐 tick 視角**重播**。
2. **crouch 欄保留不實作**:訓練器無蹲輸入,inaccuracy 用 stand 值,`WeaponConfig` 保留 crouch 欄。
3. **`view_recoil_tracking` 值未確認**(OQ-S2-4):僅視覺、不影響彈著/資料;先做開關 + 可調常數。
4. **fire 排程 1 sim tick 量化誤差**(7.8ms):`nextFireT += cycletime` 累加制,cycletime 0.1s = 12.8 sim tick 非整數,誤差 ≤ 1 tick,記為已知誤差界線。
5. **Valorant 移動僅留接口**:`MovementProfile` 注入 + meta `movementModel` 斷代;1D→2D、settle timer、Valorant 校準隨後續 WP(研究立案觸發)。

**stage2 資料夾移 `completed/`:** 暫緩(WP-18 F5 仍在 `active/stage2/`,entry 僅餘 M8 現已達成;整包 stage2 尚未全數交付)。待 WP-18 收斂或使用者指示再整體移入(協議 §5,待使用者確認)。

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| (無新 OQ;上游 OQ 應於各自 WP 收斂,T0 驗證) | — | — |

---

## Log

### 2026-07-07 — T-exit PASS(M8 stage2 交付:驗收清單 B 全 10 項通過)

**閘門結論:** PASS。驗收清單 B(規格書**附錄 E-B**,10 項客觀可勾)逐項執行 + 勾選;`npm run test:ci` **exit 0**;兩層索引 M8 標 ✅ + 日期;technical debt 落帳為 stage3 入口。本切片 docs-only + 驗證,不改 `src/` / `tests/`。

**1. 驗收清單 B 逐項證據:**

| # | 項目 | 證據 |
|---|---|---|
| ① | [M5] recoil 數學 golden | `src/recoil/recoilTable.test.ts`(6)+ `spread.test.ts`(6)綠;seed 223 前 8 筆彈道表 + 10 發 punch(−10.18°/−1.56° ±0.01°)+ 前 4 發抑制係數。 |
| ② | [M6] 壓槍手感全鏈路分離 | `tests/e2e/full-drill.spec.ts`「recoil 分離:held 10 發 → rawPunch 漂移(上+右)+ M5 向量」綠;M6 手動視覺 4 項使用者確認(2026-07-06)。 |
| ③ | [M7 caveated] 校準 | `tests/calibration/showpos.test.ts`(3)綠;速度 surrogate ±1 u/s、AK pattern 對 CS2 golden 釘死;第三方 Aiming.Pro 差異(yaw maxAbs 3.941°)分層歸因接受(GD-14),外部實錄真值列 caveat。 |
| ④ | schema v2 對帳 + 溢位保護 | `src/data/export.test.ts`/`metadata.test.ts`/`DataRecorder.test.ts` 綠;`meta.schemaVersion===2` + fire 8 欄;`metricsFromExport` round-trip 逐欄一致;30 發 spray baseline `recorderOverflow:false`。 |
| ⑤ | 決定性 punch/彈著 × 3 FPS | `tests/regression/spray-determinism.test.ts`(6)+ `determinism.test.ts`(15)綠;60/144/240 FPS pump `final.ticks===expectedTicks`,30 發序列 bit-exact。 |
| ⑥ | COI 三計時防線 | `tests/e2e/isolation.spec.ts`(dev+preview COOP/COEP)+ `full-drill.spec.ts` + `spray-drill.spec.ts` 內 `crossOriginIsolated===true` 綠。 |
| ⑦ | sim/recoil 無 `Math.random()` | `grep Math.random src/sim src/recoil` → 呼叫數 0(僅 `TargetManager.ts:21` 註解提及禁用,非呼叫)。2026-07-07 抽查。 |
| ⑧ | 彈孔單一 draw call | `src/render/ImpactView.ts` 單一 `InstancedMesh(IMPACT_CAP)` render-only + `ImpactView.test.ts`(6)綠。 |
| ⑨ | 壓 30 發不掉 tick(NFR) | `spray-determinism.test.ts`:60/144/240 FPS pump `final.ticks===expectedTicks`(accumulator 全處理、無缺口)、`impactTotal===30`。 |
| ⑩ | `test:ci` exit 0 | 本機 run 2026-07-07:`tsc --noEmit` + Vitest **43 files/326 tests** + Playwright **10 passed**;`$LASTEXITCODE=0`。 |

**Verification:**

- `npm run test:ci` → **exit 0**:Vitest **43 files / 326 tests passed**;Playwright **10 passed**(含 `spray-drill.spec.ts`)。
- `grep Math.random src/sim src/recoil` → 僅 `src/sim/TargetManager.ts:21` 註解命中,零實際呼叫。
- 兩層索引已同步:[../README.md](../README.md)(WP-17 ✅ / M8)、[../../../README.md](../../../README.md) §2/§3(WP-17 ✅ / M8 ✅ + 日期 / 頂層狀態)、規格書附錄 E-B 落地。

**Decision Log:**
- **stage2 資料夾暫不移 `completed/`。** Alternatives Considered:M8 達成即整包移入 `completed/stage2/`。否決,WP-18(F5)仍在 `active/stage2/` 且其 entry 僅餘 M8(現已達成);整個 stage2 尚未全數交付,提前移動會割裂 WP-18。待 WP-18 收斂或使用者指示再整體移入(協議 §5,待使用者確認)。
- **驗收清單 B 落規格書附錄 E-B(非改寫附錄 E)。** Alternatives Considered:併入既有附錄 E(階段 A)。否決,兩階段驗收語意獨立、階段 A 清單須保留為 M4 交付憑證;新增 E-B 節不動 E,對帳更清楚。

**Surprises & Discoveries:**
- 無新 blocker,無全鏈路暴露的上游缺口(範圍紀律未觸發)。
- test:ci 於沙盒仍受既知 Vite config access denied 限制;提升權限後 exit 0(與 T0/T1/T2 一致)。

**Next:** stage2 交付完成。後續:WP-18(F5,門控解除,entry 僅餘 M8 ✅)或 stage3(WP-19~22)。

---

### 2026-07-07 — T2 PASS(spray drill full chain E2E:fire(30) → export v2 → metrics → result DOM + COI)

**閘門結論:** PASS。新增 `tests/e2e/spray-drill.spec.ts`,以真瀏覽器經 `window.__fpsTest` 啟動 `counterstrafe_ad_v1`,合成 held-fire 30 發,再對匯出 v2 / 統計=匯出 / 結果頁 recoil path DOM / COI 做同一 spec 斷言。

**覆蓋內容:**

| 項目 | 證據 |
|---|---|
| 合成 fire(30) | `fireRecoilBurst(30)` 產生 30 筆 fire event;`shotsFired=30`,`recoilIndex=30`;事件序列 `recoilIndex=0..29`,`ammo=30..1`。 |
| 匯出 v2 欄位 | `meta.schemaVersion=2`,含 `weaponId/weaponSeed/rngSeed/sensitivityModel/movementModel`;每筆 fire 皆有 `viewYaw/viewPitch/aimPunchPitch/aimPunchYaw/spreadX/spreadY/recoilIndex/ammo` 且有限。 |
| 統計=匯出 | `getMetrics()` 與 JSON round-trip 後 `metricsFromExport(payload)` 逐欄一致;`recoilCompensationPath.actual/ideal` 長度皆為 30。 |
| 結果頁 DOM | dev-only `__fpsTest.showResult()` 以 harness metrics 呼叫 production `ResultScreen.show()`;斷言 `#result-screen` 顯示且 `data-metric-id="recoilCompensationPath"` / recoil path SVG 存在。 |
| COI | spec 內重申 `window.crossOriginIsolated === true`;匯出 meta 亦為 true。 |

**Verification:**

- `npm.cmd run typecheck` → exit 0,`tsc --noEmit` clean。
- 沙盒內 `npx.cmd playwright test tests/e2e/spray-drill.spec.ts` 仍受既知 Vite config access denied 限制;提升權限重跑 → exit 0,**1 passed**。
- 沙盒內 `npm.cmd run test:ci` 同樣受既知 Vite config access denied 限制;提升權限重跑 → exit 0:
  - Vitest:**43 files / 326 tests passed**。
  - Playwright:**10 passed**(新增 `spray-drill.spec.ts` 已納入)。

**Decision Log:**
- **T2 不新增獨立 `fire(n)` API;沿用 `fireRecoilBurst(shots)`。** Alternatives Considered:新增 `fire(30)` wrapper。否決,既有 dev/test-only API 已精確表達 held-fire burst 並回傳 recoil readout;新增別名只增加 surface。
- **以 dev-only `showResult()` 橋接 harness metrics 到既有 ResultScreen。** Alternatives Considered:只斷言初始 `#result-screen` 容器或在測試中偽造 recoil path DOM。否決,初始容器不能證明 WP-16 T3 recoil path 真的 render;測試偽造 DOM 不能驗 production UI。採 `main.ts` DEV guard 下的小包裝,production build 仍剝除。

**Surprises & Discoveries:**
- `__fpsTest` 自建 deterministic sim 管線,不驅動 `main.ts` live `DrillRunner`,因此原本不會自動顯示結果頁。Evidence:`src/testharness/fpsTestHarness.ts` 註解與實作皆明示自建管線以避開 rAF 競態。
- T2 在沙盒內仍重現 T0 記錄的 Vite config access denied;提升權限後目標 spec 與完整 CI 全綠。

**Next:** T-exit([T-exit-gate.md](T-exit-gate.md))— M8 門:驗收清單 B + 宣告。

### 2026-07-07 — T1 PASS(punch / spread / impact 決定性回歸 × 60/144/240 FPS)

**閘門結論:** PASS。新增 `tests/regression/spray-determinism.test.ts` 與 fixture,鎖定 `tests/golden/recoil/spray-baseline.json`。同 seed / 同 fire 時刻表下,canonical per-tick、重播兩次、60/144/240 FPS pump 的 30 發序列皆 bit-exact 一致。

**覆蓋內容:**

| 項目 | 證據 |
|---|---|
| 合成輸入 fixture | `SPRAY_FIRE_DOWN_MS=3100`, `SPRAY_FIRE_UP_MS=6100`, neutral fixed aim;fire window 覆蓋 AK 30 發滿匣。 |
| tick-index keyed baseline | `spray-baseline.json` 逐發記錄 `tick`, `aimPunch*`, `rawPunch*`, `spreadX/Y`, `impactX/Y/Z`, `recoilIndex`, `ammoBefore`。 |
| 多 FPS 決定性 | `sprayFrameSequences` 覆蓋 60/144/240 FPS;測試斷言 shots/final 完全等於 canonical baseline。 |
| M5 sanity | baseline 第 10 發 rawPunch 與 `ak47-10shot-punch.json` 方向一致且向量近似(pitch 容差 0.25°,yaw 容差 0.1°),確認 M5 recoil 接線仍可辨識。 |

**Verification:**

- `npx.cmd vitest run tests/regression` → exit 0,**2 files / 21 tests passed**。
- `npm.cmd run typecheck` → exit 0,`tsc --noEmit` clean。

**Decision Log:**
- **T1 不擴充 `DataRecorder` tick schema。** Alternatives Considered:為逐 recoil tick punch 新增 tick 欄位或 debug-only recorder hook。否決,WP-17 T1 是回歸防線而非 schema 新功能;WP-16 已定 v2 export 欄位。採測試 fixture 直接鎖定 fire event 產彈點的 punch/spread + `ImpactRing` 彈著序列,以 tick index 對齊 FPS 決定性。

**Surprises & Discoveries:**
- `DataRecorder.ticks` 目前不含 recoil 欄位,逐 tick punch 無法不改 schema 直接從 export snapshot 取出。Evidence:`src/data/RingBuffer.ts` 的 `TickRecord` 僅含 t/vx/vz/position/target/aim/keys。
- M5 pure recoil golden 與 SimLoop 產彈點存在 64Hz recoil tick 相位差;第 10 發 rawPunch 可辨識但不應用 0.01° 純公式等值容差。Evidence:T1 baseline 第 10 發 rawPunch 約 `(-10.4069,-1.6072)`,M5 golden final `(-10.18,-1.56)`。

**Next:** T2([T2-e2e-full-chain.md](T2-e2e-full-chain.md))— 壓槍 drill 全鏈路 E2E(含 COI)。

### 2026-07-07 — T0 entry gate PASS(M7 / WP-16 雙上游收斂驗證)

**閘門結論:** PASS。WP-15(M7)與 WP-16 均已完成,整合前 `npm run test:ci` 全綠;`__fpsTest` debug API 與 v2 匯出欄位可供 T1/T2 消費。本切片 docs-only,不改 `src/` / `tests/`。

**1. 上游 WP-15 / WP-16 exit 證據:**

| 上游 | checklist | exit 證據 |
|---|---|---|
| WP-15(M7) | [../wp-15-calibration/task-checklist.md](../wp-15-calibration/task-checklist.md) 全 ✅ | [../wp-15-calibration/T-exit-gate.md](../wp-15-calibration/T-exit-gate.md) 與 [progress.md](../wp-15-calibration/progress.md) 宣告 **M7 caveated PASS 2026-07-07**:速度曲線 surrogate 對表通過,recoil 對 CS2 golden 釘死,第三方 Aiming.Pro pattern 差異已分層歸因並由研究者接受(GD-14)。兩層索引 [../README.md](../README.md) 與 [../../../README.md](../../../README.md) 皆已標 M7 caveated。 |
| WP-16 | [../wp-16-metrics-export-v2/task-checklist.md](../wp-16-metrics-export-v2/task-checklist.md) 全 ✅ | [../wp-16-metrics-export-v2/T-exit-gate.md](../wp-16-metrics-export-v2/T-exit-gate.md) 與 [progress.md](../wp-16-metrics-export-v2/progress.md) 宣告 **T-exit PASS 2026-07-07**:schema v2 + 壓槍指標交付,不變式/溢位/對帳全綠,WP-17 T2 可直接消費 v2 匯出。 |

**2. T0 乾淨基準:**

- 沙盒內 `npm.cmd run test:ci` 啟動 Vitest 時失敗:`Cannot read directory "../../../..": Access is denied` / 無法解析 `vite.config.ts`。此為既知沙盒限制,與 WP-16 progress 的 Vite config access denied 記錄一致。
- 提升權限重跑 `npm.cmd run test:ci` → **exit 0**:
  - `tsc --noEmit` exit 0。
  - Vitest:**42 files / 320 tests passed**。
  - Playwright:**9 passed**(含 `full-drill.spec.ts` 的 `crossOriginIsolated + 全鏈路:schema / 事件 / metadata / 統計＝匯出` 與 `recoil 分離:held 10 發 → rawPunch 漂移方向 + M5 向量`)。

**3. `__fpsTest` 入口 + v2 欄位可讀性抽查(CodeGraph/source):**

- `src/main.ts` / `tests/e2e/full-drill.spec.ts` 已以 `window.__fpsTest` 驅動 dev-only E2E;既有 E2E 等待 harness 掛載後呼叫 `forceExportJSON()` 與 `fireRecoilBurst(10)`。
- `src/testharness/fpsTestHarness.ts` 的 `FpsTestHarness` 已提供:
  - `startDrill(id)` drill 驅動;
  - `feedInput(seq)` 低階合成輸入;
  - `fireRecoilBurst(shots)` 合成 held-fire burst;
  - `forceExportJSON()` 回傳匯出 payload;
  - `getMetrics()` / `metricsFromExport(payload)` 供統計=匯出對帳。
- T2 可能需要 `fire(30)` 便利封裝,但目前 `fireRecoilBurst(shots)` 已覆蓋「合成 fire 能力」;若 T2 要改為 spray drill 專用語意,屬 T2 的最小 debug API 擴充,非 T0 blocker。
- v2 欄位可讀:
  - `docs/operational/schema.md` 定義 `schemaVersion: 2` 與 fire 欄 `aimPunchPitch/aimPunchYaw/spreadX/spreadY/recoilIndex/ammo`。
  - `src/data/export.ts` 的 `ExportPayload` 直通 `{ meta, ticks, events }`,CSV fire header 含 `aimPunchPitch,aimPunchYaw,spreadX,spreadY,recoilIndex,ammo`。
  - `src/data/metadata.ts` 固定輸出 `schemaVersion: 2`;`src/data/export.test.ts` 已斷言 JSON round-trip 與 CSV header。

**4. 上游 OQ 收斂抽查:**

| OQ | 狀態 | 證據 |
|---|---|---|
| OQ-S2-1 recoil tick 節奏 | ✅ closed | [../README.md §8](../README.md#8-open-questions):64Hz 子節奏,偶數 sim tick,WP-10 T0 拍板。 |
| OQ-S2-2 校準容差 | ✅ closed | [../README.md §8](../README.md#8-open-questions):速度 ±1 u/s、AK pattern ±0.05°,T-exit 維持容差;M7 caveated PASS 記明第三方 pattern 差異與 caveat。 |
| OQ-S2-3 感度/schema 斷代 | ✅ closed | [../README.md §8](../README.md#8-open-questions):`sensitivityModel: 'cs2-0.022deg'` + `schemaVersion` v2,舊資料不回溯轉換;WP-16 T0/T-exit 收尾。 |
| OQ-S2-6 彈匣盡行為 | ✅ closed | [../README.md §8](../README.md#8-open-questions):彈匣盡即停火,drill 一 peek ≤ 一匣;WP-10 T0 拍板,WP-11 scheduler 消費。 |

**Decision Log:**
- **T0 不擴充 `__fpsTest` API。** Alternatives Considered:在 T0 補 `fire(30)` 別名。否決,T0 明確 docs-only;現有 `fireRecoilBurst(shots)` 已證明合成 fire 能力存在。若 T2 需要 spray drill 專用 wrapper,應在 T2 以最小範圍處理。

**Surprises & Discoveries:**
- 無新 blocker。沙盒內 Vite config access denied 是既知環境限制;提升權限後 `test:ci` 全綠。

**Next:** T1([T1-determinism-regression.md](T1-determinism-regression.md))— punch/彈著決定性回歸 × 60/144/240 FPS。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md) §6 WP-17 表 + session 補充決定)展開為自足 task 檔(T0–T2 + T-exit)。
- 補充決定:outline 的 **T3(驗收清單 B)併入 T-exit**(比照 issue-26「T7 / T-exit」合併寫法)——
  清單本身就是 exit gate 的內容,不拆兩個 commit。
- 範圍紀律:全鏈路暴露的缺口一律記 blocker 回上游 WP,本 WP 不就地補功能。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— M7 / WP-16 exit 驗證,docs-only。
