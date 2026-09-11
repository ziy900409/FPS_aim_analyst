# WP-66 T5 — 零 importer 掃描、focused e2e、A/B frame-time、全量回歸

> FR-66.12 · NFR-66.2 / 66.4 / 66.7 · FM-3 / FM-5 / FM-6

## Objective

把三件只有在**組裝完成後**才能證明的事釘死：① 命中回饋確實沒有洩漏進資料層或指標層（C-D3/C-D4 紅線）；② 四個 wiring 點在真實瀏覽器裡全部生效（FM-3）；③ 啟用回饋沒有讓 frame-time 退步（NFR-66.4）。最後跑全量回歸。

## Steps

1. **零 importer 掃描（FR-66.12 / FM-5）**——寫成**測試**而非一次性指令，這樣它會一直守著：
   - 新增 `tests/regression/wp66-hit-feedback-isolation.test.ts`，掃 `src/data/`、`src/metrics/`、`research/` 三個目錄的原始檔，斷言**零出現** `targetHits` / `TargetHitRing` / `pushTargetHit` / `HIT_FEEDBACK_HOLD_MS`。
   - 比照 WP-63 NFR-63.4 的符號掃描慣例（同 repo 既有作法）。
   - 同一檔再加一條：`exportPayloadSchema` 的 event union **不含**任何命中回饋相關 type。
2. **focused e2e**（新檔 `tests/e2e/hit-feedback-live.spec.ts`）：
   - ⚠️ **前置**：本 WP 之後的 live e2e 一律需要先解除 WP-65 的待命閘。使用既有 arm helper [`tests/e2e/support/arm.ts`](../../../../../tests/e2e/support/arm.ts)（WP-65 T6 交付，已在版本庫）。**不得**再自行寫一份取鎖模擬——WP-65 的 Package DoD 明訂全 repo 只有一份。
   - ⚠️ **drill 選擇限制**：live spec 必須**同時綁 drill id 與 sceneId**，否則 unpinned drill 會撞 field-low 的 clearance 檢查；且 drill 即使無人瞄準也會自行結束，斷言要在時限內完成。
   - ⚠️ **埠衝突**：`reuseExistingServer` 會讓 e2e 靜默測到 5173 上的別人（外部 app、遺留 dev server、或 worktree 主 checkout）。跑之前先以 HTTP 探針確認打到的是本次 build。
   - ⚠️ **長時測量**：若 spec 需要跨數分鐘，先 route-block `/@vite/client`——平行 session 觸發的 vite full reload 會悄悄把狀態歸零，且 reload 後 drill 會退回預設值。
   - 斷言（透過 `window.__fps` 或 `javascript_tool` 讀 `scene.children` 的材質）：
     - 啟用的 tracking drill：命中後某個目標 mesh 的 `material.emissive` 非零；經過 `HIT_FEEDBACK_HOLD_MS` 後回零。
     - **換 drill 後仍生效**（FM-3 wiring #2）。
     - **換場景後仍生效**（FM-3 wiring #3/#4）——這條是四個 wiring 點中最容易漏的。
     - 未啟用的 drill：命中後 `emissive` 恆為零。
3. **A/B frame-time（NFR-66.4 / FM-6）**：沿用 WP-60 F6 的量測法，同一 drill 跑開／關各一場，比較 frame-time p95 與 over-budget window 數；**額外記錄「第一次命中所在的那一幀」的 frame-time**（FM-6 的 pipeline 重編若發生，會在這一幀現形）。數值記入 `progress.md`。
4. **draw call 對照（NFR-66.5）**：同兩場各記 `renderer.info.render.drawcalls`，斷言相同。
5. **全量回歸**：
   - `npm run typecheck` ×2 → exit 0。
     > ⚠️ `npm run typecheck` **只掃 `src/` 與 `server/`**；本 task 新增的 e2e spec 與掃描測試不在其中，須另以對應 tsconfig 或實際執行把關。
   - `npx vitest run` → passed 數 ≥ T4 後基線，`0 failed`。
   - `npx vitest run tests/regression` → 與 T4 的分類結論一致（只有 T4 已具名說明的 fixture digest 變動）。
   - `npx playwright test --workers=1` → passed 數 ≥ T0 基線，`0 failed`。跑之前先數 `.playwright-tmp/history-dev/` 的 participant 目錄數，必要時清理。
   - `npm run build` → exit 0。
6. **既有 e2e 影響面盤點**：列出本 WP 是否讓任何既有 spec 需要修改。**預期為零**——命中回饋不改 DOM、不改 HUD、不改匯出鍵面（除了啟用 drill 多一個 `meta` 鍵）。若有 spec 需改，逐條在 `progress.md` 說明理由，並確認**沒有任何既有斷言被放寬或刪除**。

## Invariants

- 本 task **不修改任何 `src/` 檔案**（純測試與量測）。若量測過程發現缺陷 ⇒ 回到對應 task 修，不在本 task 夾帶產品碼變更。
- 不得放寬或刪除任何既有斷言。
- `research/` diff 為空。

## Definition of Done

- [ ] `tests/regression/wp66-hit-feedback-isolation.test.ts` 存在且綠：`src/data/`、`src/metrics/`、`research/` 三處對四個符號皆零出現
- [ ] `tests/e2e/hit-feedback-live.spec.ts` 存在且綠，含四條斷言：啟用亮／衰減／**換 drill 後仍生效**／**換場景後仍生效**；另含一條未啟用 drill 恆不亮
- [ ] e2e 執行前的埠探針結果與 `.playwright-tmp/history-dev/` 目錄數已記入 `progress.md`
- [ ] A/B frame-time：開啟相對關閉的 p95 增量 **≤ 0.2 ms**，over-budget window 數不增加；**第一次命中那一幀**的 frame-time 亦記錄且未見尖峰（FM-6）
- [ ] 開／關兩場的 `renderer.info.render.drawcalls` 相同（NFR-66.5）
- [ ] `npm run typecheck` ×2、`npx vitest run`、`npx vitest run tests/regression`、`npx playwright test --workers=1`、`npm run build` 五項 exit 0，各自通過數與基線的差額逐條說明於 `progress.md`
- [ ] 既有 e2e 影響面盤點完成：需改的 spec 數（預期 0）與逐條理由記入 `progress.md`，並明確聲明無斷言被放寬
- [ ] `git diff --stat src/` 為空

## Commit

```text
test(wp-66): cover hit feedback end to end
```
