# WP-6 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 執行中（T2 ✅）

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-02） |
| T1 DrillConfig schema | ✅ 完成（2026-07-02） |
| T2 Drill 載入器 | ✅ 完成（2026-07-02） |
| T3 Counter-strafe drill 檔 | ⬜ 待執行 |
| T4 Drill 生命週期 | ⬜ 待執行 |
| T5 Exit gate | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-6.1 schema 欄位 | ✅ 鎖定（T0） | `DrillConfig` = drillId/targets/sequence/timing/endCondition；TS 型別 + JSON Schema 雙重約束（T1）。`targets.motion?` 省略=static（F5 接縫）、`timing.spawnDelayMs?` 預設 0、`peekTimeoutMs?` 防卡、`endCondition` 雙閘 targetCount/timeLimit。 |
| OQ-6.2 位置定義 | ✅ 鎖定（T0） | 階段 A 用 L/R peek 槽位 + 距離抽象（貼合 counter-strafe，對齊現有 `TargetManager.sideX`）；絕對座標延後。 |
| OQ-6.3 結束條件預設 | ✅ 鎖定（T0） | 預設 `targetCount`（目標數達標）；`timeLimit` 為可選後援閘（防生命週期卡 phase）。 |
| OQ-6.4 載入失敗處理 | ✅ 鎖定（T0） | `loadDrill` 載入時驗證（型別 + 必填）；不合 → throw 明確錯誤、**不啟動 drill**（避免污染量測資料）。 |

---

## Log

### 2026-07-02 — T2 Drill 載入器（config 驅動 TargetManager）✅
- **產出**：`src/drill/DrillLoader.ts`（`loadDrill` 包 `validateDrill`）、`src/drill/DrillLoader.test.ts`（5 tests）；MODIFY `src/sim/TargetManager.ts`（`createTargetManager(config?)` 由 config 驅動）、`TargetManager.test.ts`（+7 config 驅動 tests，含兩 config 解耦驗收）。
- **驗證**：`vitest run` 123 passed（+12 新）；`tsc --noEmit` 綠燈。**F4 解耦驗收綠**：`runDrill(count=2,LR)` → `['L','R']`、`runDrill(count=4,RL)` → `['R','L','R','L']`,純由 config 差異驅動、同一 `createTargetManager`、零 `.ts` 改動。WP-4 t_visible/交替/決定性回歸全綠（TargetManager 18 tests 含原 11）。
- **Decision — `createTargetManager(config?)` config 為選填,退回 WP-4 佔位行為**：既有 WP-4 測試與 `main.ts` `createTargetManager()` 呼叫零改動即續綠(向後相容)。有 config → `targets.distance`(位置)、`sequence.alternation[0]`(首側)、`targets.count`(spawn 上限)驅動;無 config → 預設距離 4、首側 'R'、無限補生。*Alternatives*：強制必填 config(須改 WP-4 測試 + main,破壞回歸);獨立 config-driven 子類(過度抽象,違 Rule 0)。
- **Decision — spawn 上限用 `targets.count`;`endCondition` phase 語意留給 T4**：TargetManager 職責保持純粹「生成至多 count 個、首側交替、固定距離」;drill running→ended 判定屬 DrillRunner(T4)。README T2「結束（endCondition）取代 WP-4 內建佔位」解讀為「由無限補生改為有限 count 上限」,已滿足。*Alternatives*：TargetManager 內判 endCondition 雙閘(耦合 phase 邏輯,侵入 T4 範圍)。
- **Decision — `loadDrill` 接受 JSON 字串或已解析物件**：`import x.json`(Vite 給物件)與 `fetch().text()`(給字串)兩路走同一驗證;字串解析失敗 throw `載入失敗: JSON 解析錯誤`(OQ-6.4 不啟動 drill)。
- **Surprise — `reset` 預設參數語意調整**：原 `reset(state, seq='RL')` 硬編預設;改為 `reset(state, seq?)`,省略時退回 config 首側(無 config 則 'R')。既有顯式 `reset(state,'LR')` 呼叫不受影響('LR'[0]='L');`reset` 亦歸零 `spawnedCount`,使 restart 後可重跑滿額(T4 restart 相容)。
- **F5 接縫**：config.targets.motion 提供時 spawn 複製寫入目標(非共用參考),階段 A 不驅動移動(WP-6.5 接管)。
- **Next**：**T3** Counter-strafe drill 檔（[T3-counterstrafe-drill.md](T3-counterstrafe-drill.md)）— 產出 `drills/counterstrafe_ad_v1.json`,經 `loadDrill` + `createTargetManager` 驗證可玩;**T4** 生命週期(可並行)。

### 2026-07-02 — T1 DrillConfig schema ✅
- **產出**：`src/drill/DrillConfig.ts`（型別）、`src/drill/schema.ts`（`validateDrill` 手寫 guard）、`src/drill/schema.test.ts`（12 tests）。
- **驗證**：`vitest run` 111 passed（+12 新）；`tsc --noEmit` 綠燈。
- **Decision — 手寫 guard 而非 JSON Schema 函式庫**：專案零 runtime 依賴（僅 three）+「純 TS」紀律（D1）。手寫 guard 逐欄回傳收斂型別、失敗即 throw `DrillConfig 驗證失敗: <path> <原因>`,定位精準。*Alternatives*：ajv/zod（引入依賴,違背階段 A 極簡）；純 TS 型別無執行期驗證（不合法 JSON 會污染量測,違 OQ-6.4）。
- **Decision — reuse `state/types.ts` 既有 `TargetMotion`/`Vec3`**：WP-4 已立這兩型別（F5 接縫）;DrillConfig 直接 import,避免雙定義漂移。
- **Surprise — spec 附錄 G 已有 `TargetMotion` 且 `state/types.ts` 也已定義**：非本 task 新建。T1 僅在 `targets.motion?` 引用並於 `validateMotion` 淺驗（type 列舉 + 數值範圍;`waypoints` 深驗延後 WP-6.5）。
- **範圍語意**：`count` 正整數、`distance`/`peekTimeoutMs`/`timeLimitMs`/`endCondition.value` 正數、`countdownMs`/`spawnDelayMs` 非負（0 合法,對齊 counter-strafe 即時補生 spawnDelayMs=0）。
- **Next**：**T2** Drill 載入器（[T2-drill-loader.md](T2-drill-loader.md)）— `loadDrill` 包 `validateDrill` + 由 config 驅動 `TargetManager`。

### 2026-07-02 — T0 Entry gate ✅
- **PASS**：M2 ✅（頂層索引 §3 M2 ✅ 2026-07-02）；WP-4 ✅ / WP-5 ✅（§2）。上游 exit-gate 全綠 → WP-6 可展開。
- **TargetManager 可承接 config 驅動**：`src/sim/TargetManager.ts` 具 `tick`/`markKilled`/`reset`，已 `opts.distance` 參數化、L/R 槽位 (`sideX`) + `nextSide` 交替純內部驅動（無隨機源，決定性）。原始碼已註明「佔位，WP-6 drill config 接管」。
- OQ-6.1~6.4 全部 🟡→✅ 鎖定（見上表）。位置抽象採 L/R 槽位（對齊現有 `sideX`），結束條件預設 `targetCount`。
- 分支：`wp-6-drill-system`（base `main`）。
- **Next**：**T1** DrillConfig schema（[T1-drill-config.md](T1-drill-config.md)）— 型別 + JSON Schema + 範例。

### （規劃）— WP-6 計畫產出
- 依 PLAN WP-6（6.1–6.4）+ F4 + 附錄 C 展開為 T0–T5。
- 核心：把 WP-4 內建佔位序列換成 **config 驅動**，新增 drill = 新增 JSON（零引擎改動）。生命週期 idle→countdown→running→ended + restart 全 reset。
