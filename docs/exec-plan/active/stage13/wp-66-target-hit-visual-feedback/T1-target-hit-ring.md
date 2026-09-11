# WP-66 T1 — `TargetHitRing` 進 `SharedState`，`SimLoop` 兩處寫入

> FR-66.1 / FR-66.2 / FR-66.3 / FR-66.12 · NFR-66.1 / 66.2 / 66.3 · FM-5 / FM-8 · D-66-1 / D-66-2

## Objective

開出本 WP 唯一的 sim → render 通道：一個固定佈局的命中環形格，由 `SimLoop` 在**既有**的兩個命中分支各寫一筆。本 task **完全不碰 render 與 config**——它的成敗只由單元測試與決定性斷言判定，這樣「寫入條件與既有命中事件逐條相同」與「未命中一律不寫」在接上任何視覺之前就已經被證明。

這是全 WP 唯一觸及 `SimLoop` 命中路徑的切片。

## Steps

1. **`src/state/SharedState.ts`**——比照 `ImpactRing`／`ShotRayRing` 的既有段落位置與註解密度：
   - `export const TARGET_HIT_CAP = 64;`（緊鄰 `IMPACT_CAP` / `TRACER_CAP`）。
   - `export interface TargetHitRing { readonly id: string[]; readonly seq: Float64Array; total: number; cursor: number; }`——註解須寫明：sim 唯寫 / render 唯讀、**不帶時間戳的理由**（D-66-2）、`seq=0` 為空槽哨兵、`id` 槽位存的是既有 `TargetState.id` 的**參考**（不組字串）。
   - `createTargetHitRing()`：`id` 以 `new Array<string>(TARGET_HIT_CAP).fill('')` 預配置；`seq` 為 `new Float64Array(TARGET_HIT_CAP)`。
   - `pushTargetHit(ring, targetId)`：`targetId === ''` 為 no-op；否則 `i = ring.cursor`、`ring.id[i] = targetId`、`ring.seq[i] = ++ring.total`、`ring.cursor = (i + 1) % TARGET_HIT_CAP`。**逐字比照** `pushImpact` 的形狀。
   - `resetTargetHitRing(ring)`：原地 `id[i] = ''`／`seq.fill(0)`／`total = 0`／`cursor = 0`，**不 realloc**。
   - `createSharedState()` 增 `targetHits: createTargetHitRing()`（放在 `shotRays` 之後，維持既有 ring 相鄰）。
   - `resetState()` 增 `resetTargetHitRing(state.targetHits)`（緊接 `resetShotRayRing(...)` 之後，附一行註解說明重開 drill → 命中回饋清）。
2. **`src/loop/SimLoop.ts`**——**只加兩行寫入，不改任何判定**：
   - **projectile 分支**（[SimLoop.ts:343-361](../../../../../src/loop/SimLoop.ts#L343-L361)）：在 `if (target.persistent !== true) targetManager?.markKilled(...)` **相鄰處**加 `pushTargetHit(state.targetHits, target.id);`。位置必須落在 `if (hitIndex >= 0 && arena.accurate[i] === 1)` 區塊**內**——`accurate === 0` 的彈不算命中、不得亮。
   - **hitscan 分支**（[SimLoop.ts:455-461](../../../../../src/loop/SimLoop.ts#L455-L461)）：在既有 `if (hit && result.targetId !== undefined) { ... }` 區塊**內**加 `pushTargetHit(state.targetHits, result.targetId);`。`hit` 已經是 `accurate && result.hit && blocker === undefined` ⇒ **速度閘與 occlusion 免費繼承**（README §0.1 #5）。
   - ⚠️ **不得**在 `pushImpact` / `pushShotRay` 旁無條件加——那兩者脫靶也會寫（README §0.1 #4）。
3. **窮舉檢查**：確認 `SimLoop` 內沒有第三條會產生 `hit` 事件的路徑（搜 `recordEvent({ type: 'hit'` 與 `hit =`），結論記入 `progress.md`。
4. **零 importer 紀律**（FR-66.12 / FM-5）：確認 `targetHits` / `TargetHitRing` / `pushTargetHit` 在 `src/data/`、`src/metrics/`、`research/` 全數零 importer；`DataRecorder` 與 `exportPayloadSchema` diff 為空。結論記入 `progress.md`（T5 會以自動掃描再釘一次）。
5. **測試**（`src/state/SharedState.test.ts` 擴充 + `src/loop/__tests__/` 新檔）：
   - ring 原語：`push` 後 `total`/`cursor`/`seq` 值正確；繞圈（push `TARGET_HIT_CAP + 3` 次）後最舊槽被覆寫且 `seq` 單調；`reset` 後三欄歸零且**陣列為同一個物件參考**（不 realloc 斷言）。
   - **hitscan 命中 → 恰寫一筆**，且 `id` 等於被命中目標的 `id`。
   - **hitscan 脫靶 → 零筆**（`state.impacts.total > 0` 但 `state.targetHits.total === 0`——這條同時證明「彈著格不是命中訊號」）。
   - **occlusion blocker 擋下 → 零筆**（沿用既有 WP-45 測試的 fixture 佈置）。
   - **未過速度閘（`accurate === false`）→ 零筆**。
   - **projectile 命中 → 恰寫一筆**，且發生在 `hit` 事件同一 tick。
   - **projectile 逾 `maxRangeU` 消滅 → 零筆**。
   - **persistent 目標連續命中 N 次 → `total === N`**（命中不撤除，回饋要能重複觸發；這是本 WP 的主要使用情境）。
6. **決定性測試**（新檔 `src/loop/__tests__/wp66-hit-ring-determinism.test.ts`）：以同一輸入序列在 ≥ 4 種 render FPS（比照既有 `wp22-determinism.test.ts` 的 FPS 集合）下跑完，斷言結束時 `targetHits.total`、`targetHits.cursor` 與**逐槽** `id`/`seq` 皆 `Object.is` 相同。

## Invariants

- `HitDetector`／`ballisticRaycast`／`targetAabb`／`sweptHitTest`／`markKilled` 的簽名與語意**零修改**。
- `TargetState` **零修改**。
- `DataRecorder`／`exportPayloadSchema`／`metadata.ts` **本切片零修改**。
- `src/render/`、`src/drill/`、`src/main.ts` **本切片零修改**。
- 新增程式碼不讀時鐘、不呼叫 `Math.random()`、熱路徑零堆配置（無 `push`、無物件字面值、無 `new`）。
- 環形格語意**不宣稱零丟失**（FM-8，比照 `ImpactRing` 的環狀覆寫）。

## Definition of Done

- [ ] `TargetHitRing` / `createTargetHitRing` / `pushTargetHit` / `resetTargetHitRing` / `TARGET_HIT_CAP` 皆已匯出，且 `createSharedState()` 與 `resetState()` 各含一處對應
- [ ] `reset` 不 realloc 斷言存在且綠（`id` 與 `seq` 於 reset 前後為同一物件參考）
- [ ] 六條「不得寫入」反證測試全綠：脫靶、occlusion blocker、未過速度閘、projectile 逾 `maxRangeU`、`accurate === 0` 的彈、無存活目標
- [ ] 「脫靶時 `impacts.total > 0` 且 `targetHits.total === 0`」斷言存在且綠
- [ ] persistent 目標連續命中 N 次 → `total === N` 斷言存在且綠
- [ ] `src/loop/__tests__/wp66-hit-ring-determinism.test.ts` 在 ≥ 4 種 render FPS 下 `total`/`cursor`/逐槽 `id`/`seq` 逐位一致斷言通過
- [ ] `npx vitest run tests/regression` exit 0，passed 數與 T0 基線**一致**，且 `git status` 顯示 `tests/regression/` 下 fixture **零修改**
- [ ] `git diff --stat` 顯示 `src/render/`、`src/drill/`、`src/main.ts`、`src/data/`、`research/` 五者零改動
- [ ] `npm run typecheck` ×2 exit 0；全量 `npx vitest run` exit 0 且 passed 數 ≥ T0 基線
- [ ] `progress.md §T1` 記錄：`SimLoop` 內產生 `hit` 的路徑窮舉清單（證明只有兩條）+ 零 importer 檢查結果 + `TARGET_HIT_CAP` 餘裕估算（射速 vs CAP）

## Commit

```text
feat(sim): record which target each landed shot hit
```
