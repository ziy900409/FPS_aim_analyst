# WP-17 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T1 PASS(2026-07-07):punch/spread/impact 決定性 baseline 已入 repo;T2 全鏈路 E2E 可開

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ PASS 2026-07-07 |
| T1 決定性回歸擴充 | ✅ PASS 2026-07-07 |
| T2 全鏈路 E2E | ⬜ |
| T-exit(M8) | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| (無新 OQ;上游 OQ 應於各自 WP 收斂,T0 驗證) | — | — |

---

## Log

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
