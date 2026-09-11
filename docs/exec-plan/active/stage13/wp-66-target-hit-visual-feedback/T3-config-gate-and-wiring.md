# WP-66 T3 — `targets.hitFeedback?` 設定、schema、metadata 與 `main.ts` 四處 wiring

> FR-66.8 / FR-66.9 / FR-66.10 · NFR-66.2 / 66.6 · FM-1 / FM-3 / FM-7 · D-66-3

## Objective

把 T2 的能力關進 drill config，並確保它在**四條**進入路徑都生效。本 task 是 WP-65 FM-1 教訓的直接對應：`targetView` 在 `main.ts` 有一個初始建構點、兩個 `setShape()` 呼叫點、一個場景重載重建點——**漏一處就會出現「換 drill／換場景後回饋消失或殘留」的情境性不一致**。

本 task 仍**不啟用任何 drill**（值變更屬 T4）；交付後全 repo 行為應與 T2 後**逐位相同**。

## Steps

1. **`src/drill/DrillConfig.ts`**：在 `DrillConfig['targets']` 內新增
   ```ts
   /** WP-66：命中視覺回饋（render-only）。省略＝不顯示，且不寫入匯出 metadata（既有 drill 逐位不變）。 */
   readonly hitFeedback?: 'flash';
   ```
   註解須寫明**不得**影響命中判定、目標推進、hitbox 或任何指標（C-D3/C-D4）。
2. **`src/drill/schema.ts`**（依 T0 對假設 #3 的讀碼結論；若確認為白名單重組 ⇒ **本步驟為必要**，否則 JSON drill 設了會被靜默丟棄）：
   - 於 targets 驗證段加 `const hitFeedback = targets.hitFeedback === undefined ? undefined : requireHitFeedback(targets.hitFeedback, 'targets.hitFeedback');`
   - `requireHitFeedback` 只接受字面量 `'flash'`，否則拋出帶欄位名的錯誤（**逐字比照**既有 `requireHitboxShape`）。
   - 於重組物件處加 `...(hitFeedback ? { hitFeedback } : {})`（比照 [schema.ts:173](../../../../../src/drill/schema.ts#L173) 既有寫法）。
3. **`src/data/metadata.ts`**：`Meta['targets']` 增 `hitFeedback?: 'flash'`；寫入處比照 [metadata.ts:622](../../../../../src/data/metadata.ts#L622) 的 `hitbox` 慣例 ——
   ```ts
   ...(targets.hitFeedback !== undefined ? { hitFeedback: targets.hitFeedback } : {}),
   ```
   ⚠️ **optional-in**：省略時**不寫入該鍵**，既有 payload 的 canonical 位元組不移動。同步更新 `exportPayloadSchema.ts` 的 parser 以 additive 方式接受此鍵。
4. **`src/main.ts` 四處 wiring（FM-3，窮舉）**：
   | # | 位置 | 動作 |
   |---|---|---|
   | 1 | [main.ts:346-347](../../../../../src/main.ts#L346-L347) 初始建構 | 緊接 `setShape(...)` 後加 `targetView.setHitFeedback(activeDrillConfig.targets.hitFeedback === 'flash');` |
   | 2 | `activateDrill()` 內的 `setShape(...)` | 同上，以 `nextDrillConfig` 為來源 |
   | 3 | [main.ts:1537](../../../../../src/main.ts#L1537) `loadSceneById()` | 同上 |
   | 4 | `installSceneLoad()` 內 `new TargetView(...)` | view 重建後**必須**重設 shape **與** hitFeedback，否則換場景後回饋消失 |
   - `liveFrame` 的呼叫改為 `targetView.sync(sharedState.targets, alpha, sharedState.targetHits, now);`（`now` 已在手，比照相鄰的 `tracerView.sync(sharedState.shotRays, now)`）。
   - **窮舉證據**：以 `grep -n "targetView" src/main.ts` 列出全部參考點，逐一在 `progress.md` 標記「已處理／不需處理＋理由」。
5. **抽出單一來源**（避免四處各寫一次布林運算）：新增一個 3 行的小 helper（例如 `resolveHitFeedback(config?: DrillConfig): boolean`，放在 `DrillConfig.ts`，比照 `resolveTargetHitbox` 的位置與命名慣例），四處共用。**不得**在 `main.ts` 內重複寫四次比較式。
6. **測試**：
   - `schema.test.ts`：`'flash'` 通過並保留在重組結果中；非法值（`'blink'`／`true`／`1`）拋出且錯誤訊息含 `targets.hitFeedback`；省略時結果物件**不含**該鍵。
   - `metadata` 測試：啟用 ⇒ `meta.targets.hitFeedback === 'flash'`；省略 ⇒ **`meta.targets` 的鍵集合與 T0 基線逐字相同**（FR-66.8）。
   - `exportPayloadSchema` round-trip：帶新鍵的 payload 可 parse；**不帶**新鍵的舊 payload 仍可 parse（NFR-66.6）。
   - `resolveHitFeedback()` 的 4 個分支（config 省略／`targets.hitFeedback` 省略／`'flash'`／非法值由 schema 攔下）。
7. **Python 相容檢查（C-D1 / NFR-66.6）**：以帶新鍵的匯出 JSON 跑 `research/` 既有的 `load_export()`，確認**零修改可讀**；`research/` 的 `git diff` 必須為空。結果記入 `progress.md`。

## Invariants

- 省略 `hitFeedback` 時：`meta` 與 `meta.targets` 的**鍵集合與 T0 基線逐字相同**；`TargetView` 輸出逐位相同。
- 本 task **不修改任何 drill config 的值**（`src/drill/*.ts` 的 drill 定義與 `drills/*.json` 皆零修改）。
- `research/` diff 為空。
- `TargetState`、`HitDetector`、命中判定路徑零修改。
- `ReplayTargetView` 與 replay contracts 零修改。

## Definition of Done

- [ ] `DrillConfig['targets'].hitFeedback?` 已定義；`resolveHitFeedback()` 已匯出且四處 wiring 共用同一個 helper
- [ ] `schema.ts` 接受 `'flash'`、拒絕非法值（錯誤訊息含欄位名）、省略時結果不含該鍵——三條斷言全綠
- [ ] `meta.targets.hitFeedback` 在啟用時出現、省略時**不出現**；`meta.targets` 省略時的鍵集合與 T0 基線**逐字相同**
- [ ] 不帶新鍵的舊匯出 payload 仍可被 `parseExportPayload()` parse（斷言存在且綠）
- [ ] Python `load_export()` 對帶新鍵的 payload 零修改可讀，且 `git diff research/` 為空
- [ ] `progress.md §T3` 附 `grep -n "targetView" src/main.ts` 的完整輸出，逐行標記「已處理／不需處理＋理由」——**四個 wiring 點全部到位**
- [ ] `git status` 顯示 `src/drill/*.ts` 的 drill 定義與 `drills/*.json` **零修改**（值變更屬 T4）
- [ ] `npx vitest run tests/regression` exit 0，passed 數與 T0 基線一致且 fixture 零修改
- [ ] `npm run typecheck` ×2 exit 0；全量 `npx vitest run` exit 0 且 passed 數 ≥ T2 後基線；`npm run build` exit 0

## Commit

```text
feat(drill): gate hit feedback behind drill config
```
