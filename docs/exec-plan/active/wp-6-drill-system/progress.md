# WP-6 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 執行中（T1 ✅）

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-02） |
| T1 DrillConfig schema | ✅ 完成（2026-07-02） |
| T2 Drill 載入器 | ⬜ 待執行 |
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
