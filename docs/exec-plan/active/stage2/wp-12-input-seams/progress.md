# WP-12 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ✅ 完成(2026-07-06;T0/T1/T2/T-exit 全綠)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ 2026-07-06 |
| T1 感度 CS2 化 | ✅ 2026-07-06 |
| T2 射線注入 | ✅ 2026-07-06 |
| T-exit | ✅ 2026-07-06 |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-3 感度語意斷代標注:`sensitivityModel` 欄 vs `schemaVersion` bump(建議:先加前者,後者 WP-16 一併) | ✅ closed | T1 先加 `sensitivityModel: 'cs2-0.022deg'` 字串欄;舊匯出無此欄即代表階段 A 佔位語意 `0.0022 rad/count`;`schemaVersion` bump 留給 WP-16 schema v2,避免 WP-12 與 WP-16 兩次 schema 斷代;舊資料不回溯轉換。 |

---

## Log

### 2026-07-06 — T-exit gate PASS(WP-12 收斂)

**回歸全綠(直接證據):**
- `npm run typecheck`(`tsc --noEmit`)= exit 0。
- `npx vitest run` = **33 files / 250 tests passed**(含 `CameraController.test.ts` 2、`HitDetector.test.ts` 13、`metadata.test.ts` 5、`export.test.ts` 5)。

**手感抽查(建構 + 測試等價證據;非互動 session 無法實跑 dev server):**
- `RAD_PER_COUNT = THREE.MathUtils.degToRad(0.022)` = CS2 m_yaw 原值。360° 所需滑鼠位移:
  @sens 1.0 = 360/0.022 = **16363.6 counts**;@sens 2.0 = **8181.8 counts**——與 CS2 同 sensitivity 完全一致(同一 0.022°/count 模型)。
- `CameraController.test.ts` 鎖換算:1000 counts × sens1 → `-degToRad(22)`、× sens2 → `-degToRad(44)`(線性 2×)。
- 設定面板([SettingsPanel.ts:15-18](../../../../../src/ui/SettingsPanel.ts))sensitivity 值域 **0.1–5.0(step 0.1)**,涵蓋 CS2 慣用 **1.5–2.5**,值域充足 → **無 OQ**。
- 主觀「手感像 CS2」實機確認屬 **pilot scope**(量化校準,T-exit 已註明),不阻擋本 gate。

**匯出抽查(真實路徑追蹤 + round-trip 測試;非互動無法實跑 drill 下載):**
- 真實匯出路徑:[main.ts:133-148](../../../../../src/main.ts) `buildCurrentExportPayload → collectMeta`(固定寫 `sensitivityModel:'cs2-0.022deg'`,[metadata.ts:72](../../../../../src/data/metadata.ts))`→ buildExportPayload`(spread `...meta` 保留欄位,[export.ts:20-31](../../../../../src/data/export.ts))`→ serializeJSON`(`JSON.stringify`)。故實機匯出 JSON 必含該欄,by construction。
- `export.test.ts:61` round-trip(`JSON.stringify`→`parse`)斷言 `parsed.meta.sensitivityModel === 'cs2-0.022deg'`。

**Code review(五軸,T1/T2 差異):** 無 BLOCKER。correctness——換算/射線注入皆有精度斷言與等價測試;readability——常數具名、GD-5 註解到位;architecture——`raycastFromCenter` 收斂為薄包裝、呼叫端零改動,雙迴圈邊界不變;security——n/a(無外部輸入面新增);performance——熱路徑物件重用維持(`#qYaw/#qPitch`、模組層級 Raycaster/Box3/Vector)。

**Outcomes:** 兩接縫就緒——感度為 CS2 語意且匯出有標記、射線可注入且 camera-center 舊路徑等價。WP-13 可在不再動這兩處的前提下接彈道(punch/spread 改呼叫 `raycastWithRay`)。

### 2026-07-06 10:36+02:00 — T2 ray injection PASS
- `HitDetector` 新增公開 `raycastWithRay(origin, dirNormalized, targets)`,沿用模組層級 `Raycaster` / `Box3` / `Vector3` 重用物件;既有 `visible && alive` 過濾、最近命中、`part` 回傳語意不變。
- `raycastFromCenter(camera, targets)` 改為薄包裝:先 `setFromCamera(NDC_CENTER, camera)` 取得 camera-center origin/direction,再委派 `raycastWithRay`;`SimLoop` 呼叫端零改動。
- `HitDetector.test.ts` 新增 camera-center 等價測試與注入式 cases:偏移方向命中側目標、反向 miss、多目標取最近、略過 invisible/dead。
- Verification:
  - `npx.cmd vitest run src/sim/HitDetector.test.ts src/sim/firstShot.test.ts src/loop/SimLoop.test.ts` = 3 files / 35 tests passed
  - `npm.cmd run typecheck`
  - `npx.cmd vitest run` = 33 files / 250 tests passed
  - `npm.cmd run build` = built successfully; Vite reported existing chunk-size warning for the main bundle

### 2026-07-06 — T1 cs2 sensitivity PASS
- `CameraController` counts→radians 係數改為 `THREE.MathUtils.degToRad(0.022)`;註解改為 GD-5 / CS2 語意。
- 新增 `src/view/CameraController.test.ts`: `sensitivity=1.0` 時 1000 counts → yaw `-degToRad(22)`, `sensitivity=2.0` → `-degToRad(44)`,驗證線性 2 倍。
- `collectMeta` 固定輸出 `sensitivityModel: 'cs2-0.022deg'`;`Meta` 型別、metadata/export 測試與 `docs/operational/schema.md` 已對齊。舊 export 無此欄 = 階段 A 佔位 `0.0022 rad/count` 語意。
- Verification:
  - `npx.cmd vitest run src/view/CameraController.test.ts src/data/metadata.test.ts src/data/export.test.ts` = 3 files / 12 tests passed
  - `npx.cmd vitest run` = 33 files / 245 tests passed
  - `npm.cmd run typecheck`
  - `git grep 0.0022 src/` = no matches
  - `graphify update .` = 674 nodes / 1365 edges

### 2026-07-06 10:09+02:00 — T0 entry gate PASS
- OQ-S2-3 拍板:`sensitivityModel` 欄名固定,值域先固定為 `'cs2-0.022deg'`;無此欄 = 階段 A 佔位感度模型(`0.0022 rad/count`)。`schemaVersion` bump 延到 WP-16 schema v2 一次處理。
- GD-5 已存在([../../../DECISIONS.md](../../../DECISIONS.md));本 slice 已補標注方式一行。舊匯出資料不做回溯轉換,以欄位缺席區隔。
- T1 插入點盤點:
  - [metadata.ts](../../../../../src/data/metadata.ts):`Meta` 介面第 7/13 行加欄;`CollectMetaArgs` 第 25 行可不加參數,由 `collectMeta` 固定寫入;`collectMeta` 第 46/64 行回傳 `sensitivityModel`。
  - [export.ts](../../../../../src/data/export.ts):`ExportPayload.meta` 第 5/6 行透過 `Meta` 型別承接;`buildExportPayload` 第 20/24 行 spread meta,欄位會自動保留。
  - [schema.md](../../../../../docs/operational/schema.md):`meta` 節第 50 行;`sensitivity` 列第 59 行後新增 `sensitivityModel` 欄位說明與缺席語意。
- CodeGraph blast radius for future T1 `collectMeta`:`src/data/metadata.ts`, `src/main.ts` `buildCurrentExportPayload`, `src/testharness/fpsTestHarness.ts` `createFpsTestHarness`, `src/data/export.ts`, `src/data/export.test.ts`;判定為資料匯出局部路徑,非 gameplay cross-module 行為改動。
- Verification:docs-only;`src/` 未修改。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md))展開;修補稽核 A4(感度佔位 0.0022 rad/count ≈ 5.73× CS2)與 A3(`setFromCamera` 寫死)。
- 兩 task 互不相依,T2 可先行;T1 需 T0 的標注方式決議。
- **Next**:T1([T1-cs2-sensitivity.md](T1-cs2-sensitivity.md))。
