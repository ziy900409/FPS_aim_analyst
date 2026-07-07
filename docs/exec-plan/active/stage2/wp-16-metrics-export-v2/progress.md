# WP-16 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T2 ideal path metric PASS; T3 result overlay next

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ 2026-07-07 |
| T1 schema v2 | ✅ 2026-07-07 |
| T2 理想路徑指標 | ✅ 2026-07-07 |
| T3 結果頁對照 | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-3 感度語意/schema 斷代(`sensitivityModel` 已由 WP-12 落地;`schemaVersion` bump 政策本 WP 收尾) | ✅ closed(T0) | v2 斷代政策固定:`sensitivityModel: 'cs2-0.022deg'` 已由 WP-12 落地;T1 一次 bump `schemaVersion` 至 v2 並把 `sensitivityModel` 納入 v2 meta 對帳。舊匯出缺 `sensitivityModel` 視為 stage A 佔位模型 `0.0022 rad/count`;舊資料不回溯轉換,分析端以 schema/model 斷代分流。 |
| 稽核不確定清單 #4:`targetCenterOffsetDeg` 語意(相對誰的中心/正負號)定稿 | ✅ closed(T0) | `targetCenterOffsetDeg` = fire 當下 `camera.getWorldDirection()` 正向射線與 active target **中心點**(`target.pos`)的角距離,單位 degrees。值域為無號非負角度(0 = camera 正對 target center),不帶左右/上下正負號;若需方向性誤差,須另立欄位,不得重解釋 `offsetDeg`。 |

---

## Log

### 2026-07-07 — T2 ideal path metric PASS(理想壓槍路徑 + 補償誤差)

**結論:** FR-B15 的純計算路徑已落地。`buildIdealPath(punchSeq)` 產生 `-aimPunch*2` 的 pitch/yaw 理想補償序列;
`compensationError(aimSeq, idealSeq)` 回傳 `{ meanDeg, rmsDeg }`;`computeMetrics(...)` 現在輸出
`recoilCompensationError` 供 T3 結果頁直接消費。

**實作摘要:**
- [compute.ts](../../../../../src/metrics/compute.ts):新增 `AimOffset` / `PunchSample` / `CompensationError` 型別與
  `buildIdealPath`、`compensationError` 純函式。
- [compute.ts](../../../../../src/metrics/compute.ts):fire event 同時具備
  `viewYaw/viewPitch/aimPunchPitch/aimPunchYaw` 時,以第一筆有效 fire view 作 baseline,將實際 view 序列轉成度數偏移,
  再與理想路徑比較;缺 v2 欄位的舊資料安全回傳 `{ meanDeg:0, rmsDeg:0 }`。
- [compute.test.ts](../../../../../src/metrics/compute.test.ts):新增完美補償、零補償解析對照與
  `computeMetrics` 整合測試。

**Decision Log:**
- **實際 aim path 使用第一筆有效 fire view 作 baseline:**理想路徑是 offset 序列而非世界絕對角度,所以實際
  `viewYaw/viewPitch` 先轉成相對第一發的角度偏移。`yaw` 使用 shortest-angle delta 避免跨 `±pi` wrap。
  *Alternatives considered:*直接比較絕對 view rad 與 ideal deg 會混用單位且受初始朝向污染;改讀逐 tick aim 會違反
  T2 out-of-scope 的「記錄而非重建」邊界。
- **T2 指標只掛統計物件、不擴匯出 schema:**目前匯出仍是原始 ticks/events;補償指標可由 v2 fire 欄位離線重算。
  *Alternatives considered:*把 mean/RMS 另寫入 export payload;否決,避免在 T2 擴張 schema 契約,T3 可直接讀結算物件。

**驗證證據:**
- `npm.cmd run typecheck` → exit 0。
- `npx.cmd vitest run src/metrics/compute.test.ts src/ui/ResultScreen.test.ts`
  → **2 files / 11 tests passed**。
- `npx.cmd vitest run` → **42 files / 317 tests passed**。
- `graphify update .` → rebuilt **768 nodes / 1651 edges / 50 communities**。

**Surprises & Discoveries:**
- 沙盒內直接跑 targeted Vitest 仍在載入 Vite config 時遇到父層 access denied;提升後同一指令通過。

**Open Questions:** none。

**Next:** T3([T3-result-overlay.md](T3-result-overlay.md))—結果頁軌跡對照(實際 vs 理想)。

### 2026-07-07 — T1 schema v2 PASS(fire/meta 擴欄 + arena 容量重估)

**結論:** schema v2 已落地。匯出 meta 固定 `schemaVersion:2`，新增 `weaponId/weaponSeed/rngSeed/movementModel`；
fire 事件由唯一產彈點 `fireOneShot` 寫入 view/punch/spread/recoilIndex/ammo；tick arena 新增
`px/pz/tx/ty/tz`；`docs/operational/schema.md` 已更新 v2 欄位、容量公式與 FPSci 對映附錄。

**實作摘要:**
- [RingBuffer.ts](../../../../../src/data/RingBuffer.ts):`TickRecord` 新增玩家位置與 active target center；無 active target 時
  `tx/ty/tz = null`。`capacityForDrill` 改為
  `ceil(maxDrillSeconds * (simHz + maxFireHz)) + ceil(extraTicks)`，預設 `maxFireHz=10`(AK 1/cycletime)。
- [SimLoop.ts](../../../../../src/loop/SimLoop.ts):`fireOneShot` 在 `recoilOnFire` 前記錄本發 pre-kick
  `viewYaw/viewPitch/aimPunchPitch/aimPunchYaw/spreadX/spreadY/recoilIndex/ammo`，沿用 T0 語意決議。
- [metadata.ts](../../../../../src/data/metadata.ts):`collectMeta` 固定輸出 v2 meta，並保留
  `spawn/scene/display/frames/session` optional block 縫。
- [DrillConfig.ts](../../../../../src/drill/DrillConfig.ts)+[schema.ts](../../../../../src/drill/schema.ts):新增 additive
  `weaponId?`；省略時由呼叫端使用預設 AK-47。
- [main.ts](../../../../../src/main.ts)+[fpsTestHarness.ts](../../../../../src/testharness/fpsTestHarness.ts):
  export meta 寫入 active weapon 與 `sequence.seed ?? DEFAULT_RNG_SEED`，sim loop 也依 `weaponId?` 取 weapon。

**Decision Log:**
- **active target 欄位 nullable:** `tx/ty/tz` 在無 active visible/alive target 時輸出 `null`(CSV 空欄)，而非填 0。
  *Alternatives considered:*填 0 會與世界原點混淆；省略欄位會使逐 tick schema 不固定。
- **容量公式納入 fire 率上限:** 以 `simHz + maxFireHz` 估算預留空間，預設 `maxFireHz=10` 對齊 AK-47
  `1/cycletimeSec`。*Alternatives considered:*只維持 tick-only 容量會無法反映 T1 per-fire 欄位增加後的保守容量政策。
- **`DrillConfig.weaponId?` 僅驗非空字串:** 實際 weapon 解析仍由 `getWeapon` 負責。*Alternatives considered:*在
  drill schema 重複 weapon enum；否決，避免 weapon registry 雙寫漂移。

**驗證證據:**
- `npm.cmd run typecheck` → exit 0。
- `npx.cmd vitest run src/data/DataRecorder.test.ts src/data/export.test.ts src/data/metadata.test.ts src/drill/schema.test.ts src/loop/SimLoop.test.ts`
  → **5 files / 53 tests passed**。
- `npm.cmd test` → **42 files / 314 tests passed**。
- `graphify update .` → rebuilt **761 nodes / 1636 edges / 49 communities**。

**Surprises & Discoveries:**
- 沙盒內直接跑 Vitest 仍會在載入 Vite config 時遇到父層 access denied；依權限規則提升後測試乾淨通過。

**Next:** T2([T2-ideal-path-metric.md](T2-ideal-path-metric.md))—理想壓槍路徑 + 補償誤差 mean/RMS。

### 2026-07-07 — T0 entry gate PASS(WP-13 exit 驗證 + schema v2 斷代/欄位語意決議)

**閘門結論:** WP-13 exit 已完成且本地基準測試乾淨;T1 可開始實作 schema v2 擴欄。本切片為 docs-only,
`git diff --stat` 不含 `src/`。

**1. 上游 WP-13 exit 證據:**
- [WP-13 task-checklist](../wp-13-sim-camera-integration/task-checklist.md) T0/T1/T2/T3/T-exit 全 ✅。
- [WP-13 progress](../wp-13-sim-camera-integration/progress.md) 宣告 M6 於 2026-07-06 完成:
  `test:ci` 三段全綠(typecheck、38 files / 288 tests、Playwright 9 passed)且手動壓槍四項已由使用者確認通過。
- T4 follow-up 後 WP-13 追加驗證:`npm run test` 38 files / 289 tests passed、`npx playwright test` 9 passed。

**2. T0 乾淨基準:**
- `npm run test` 直接跑時被 Windows PowerShell execution policy 擋在 `npm.ps1`。
- 改用 `npm.cmd run test` 後,沙盒內 Vitest/esbuild 讀 Vite config 時遇到父層目錄 access denied。
- 依權限規則提升後重跑 `npm.cmd run test` → **42 files / 310 tests passed(exit 0)**,2.72s。

**3. fire 時點資料形狀抽查(CodeGraph + source read):**
- **punch:** [SharedState.recoilState](../../../../../src/state/SharedState.ts) 持有
  `aimPunchPitchDeg/aimPunchYawDeg` 與 `viewPunchPitchDeg/viewPunchYawDeg`;[SimLoop.ts](../../../../../src/loop/SimLoop.ts)
  `ballisticRaycast` 以 `aimPunch*2` 經 `punchToThreeRad` 組 rawPunch 彈道。現行 `recordEvent({type:'fire'})`
  在 `recoilOnFire` 前執行,所以 T1 若直接讀 `state.recoilState` 寫 fire 欄,語意是**本發 kick 前**的 punch。
- **spread:** `fireOneShot` 於彈道 raycast 前呼叫 `sampleSpread(...)`,並寫入
  `state.recoil.lastSpread.x/y`;同一發 `ballisticRaycast` 讀此暫存作 `forward + x*right + y*up` 偏移。
- **recoilIndex:** `RecoilState.recoilIndex` 存於 `state.recoilState`;`recoilOnFire` 依當前 index 取表後才 `+1`。
  因現行 fire event 在 `recoilOnFire` 前記錄,T1 讀到的是**用於本發的 shot index**而非下一發 index。
- **ammo:** `state.weapon.ammo` 存於 [SharedState.weapon](../../../../../src/state/SharedState.ts);
  [scheduleFire](../../../../../src/loop/SimLoop.ts) 在 `fireOneShot(...)` 返回後才 `state.weapon.ammo--`。
  因此 T1 若於 `fireOneShot` 記錄 `ammo`,語意是**本發開火前剩餘彈數**。

**4. 語意決議:**
- **OQ-S2-3 / schema v2 斷代:** `sensitivityModel: 'cs2-0.022deg'` 已存在且是 stage2 感度語意標記;
  T1 一次 bump `schemaVersion` 至 v2,舊資料不回溯轉換。無 `sensitivityModel` 的舊 export = stage A
  佔位感度模型 `0.0022 rad/count`;研究端以 `schemaVersion` + model 欄分流。
- **`targetCenterOffsetDeg`:** [HitDetector.ts](../../../../../src/sim/HitDetector.ts) 實作為 camera 世界位置到
  active target center(`target.pos`)向量與 camera forward 的 `angleTo`,回傳 degrees。此為無號角距離:
  0 表示準心/camera forward 正對目標中心;不表達左右/上下方向,不帶正負號。

**Next:** T1 schema v2 擴欄 + `schemaVersion` + arena 容量重估。

### 2026-07-07 — FPSci R1 對齊決策(使用者拍板,grill)
- **對映表入 T1**:schema v2 設計時同步產出 FPSci 欄位對映表(schema.md 附錄);
  **命名 CONTEXT.md 正規術語優先、既有欄位不改名**,僅 v2 全新欄位且語意完全相同時採 FPSci 命名——
  可比性由對映表承擔,不由改名承擔(R1 原文「沿用其命名慣例」與 CLAUDE.md §2 命名協議衝突,以後者為準)。
- 授權邊界:GD-11(禁碰 FPSci 程式碼;欄位語意/文件/論文可參考)。
- 出處:[FPSci 評估 R1](../../../../research/FPSci_評估與建議.md)。

### 2026-07-03 — Valorant 接口決策(使用者拍板)
- meta 擴欄追加 **`movementModel`**(移動模型語意斷代,比照 `sensitivityModel`):Valorant 移動
  本階段不實作,資料面先留可比性接口;值對齊 WP-14 `MovementProfile` id。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md) §6 WP-16 表 + session 補充決定)展開為自足 task 檔(T0–T3 + T-exit)。
- 補充決定:`schemaVersion` bump 落 T1(WP-12 只加 `sensitivityModel`);`DrillConfig.weaponId?`
  選填欄與 meta `rngSeed`(WP-13 OQ-13.1 的 seed 記錄)一併落 T1;arena 容量以 fire 事件率上限
  (= magSize/cycletime)重估。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— WP-13 exit 驗證 + 兩條語意決議,docs-only。
