# WP-66 T0 — Entry gate：編號重查、基線凍結、OQ 收斂

> OQ-66.1 / 66.2 / 66.3 / 66.4 · 假設 #3

## Objective

在動任何 production code 之前釘死三件會讓後續 task 白做的事：① WP/GD 編號是否仍可用（平行 session 可能已取用，且 stage14 有三個未採納候選壓在 WP-66 上）；② 本 WP 前的**基線數字**與**既有 `meta` 鍵面**，沒有基線就無法宣稱「逐位不變」；③ 四個 OQ 是否照 README 預設收斂——其中 **OQ-66.1（啟用哪些 drill）直接決定 T4 的範圍與效度斷代的寬度**，不收斂不得開 T1。

本 WP **無上游 exit-gate 相依**（與 WP-60～65 全數正交），故本 T0 不做上游驗閘。

## Steps

1. **編號重查**（[GD-35](../../../DECISIONS.md) ② 紀律，不可略過）：
   - 讀 `docs/exec-plan/README.md §2`，記下當下最大 WP 編號。
   - `ls docs/exec-plan/active/*/` 列出所有 WP 資料夾，取實際最大編號（**索引可能落後於資料夾**）。
   - 讀 `docs/exec-plan/DECISIONS.md`，記下當下最大 GD 編號。
   - **特別確認 [stage14 §3](../../stage14/README.md) 的三個候選（規劃期為 WP-66/67/68）是否已被採納**——本 WP 取用 WP-66 會使其順延為 WP-67/68/69；若 stage14 已先採納，依 [GD-15](../../../DECISIONS.md)「先採納先得」**本 WP 順延、不爭號**。
   - 若順延 ⇒ 同步改本資料夾名與全部內部連結，並在 `progress.md` 記錄改號前後值。
2. **基線凍結**（全部輸出貼進 `progress.md §T0`，只記數字不記感想）：
   - `npm run typecheck` ×2 → 記 exit code。
     > ⚠️ `npm run typecheck` **只掃 `src/` 與 `server/`**；寫在 `scripts/` 或 `tests/` 的東西不會被它檢查。T5 的 e2e helper 須自行以 `npx tsc --noEmit -p <對應 tsconfig>` 或執行時錯誤把關。
   - `npx vitest run` → 記 `N passed / M skipped` 與耗時。
   - `npx vitest run tests/regression` → 單獨記 passed 數（NFR-66.2 的對照基準）。
   - `npx playwright test --workers=1` → 記 `N passed / M failed` 與耗時。**先數 `.playwright-tmp/history-dev/` 下的 participant 目錄數**；若已累積上千個，先清理再跑，否則 history-library spec 會以無關原因轉紅。
   - `npm run build` → 記 exit code。
3. **既有匯出鍵面 digest**：以研究員模式跑一場 `tracking_br_v1`（OQ-66.1 預設啟用名單內、且是本 WP 唯一會改到的家族），匯出 JSON，記錄 `meta` 的**鍵集合**（排序後）與 `meta.targets` 的鍵集合。這是 T3 宣稱「additive 不動既有鍵面」與 T4 宣稱「只多一欄」的唯一對照基準。
4. **A/B frame-time 基線**（NFR-66.4 的對照組）：同一場 `tracking_br_v1` 記錄 frame-time p95 與 over-budget window 數（沿用 WP-60 F6 的量測腳本與判讀法）。
5. **OQ 收斂**（**阻塞項**）：
   - **OQ-66.1**：請使用者逐一確認啟用清單。預設 = `tracking_br_v1` 八個 variant + WP-64 策展的兩個 Tracking Pilot config，**排除** `hold_track_v1`。把最終清單以 **drill id 逐字列表**寫進 `progress.md §T0` 與 README §1.4 —— T4 只能動這份清單上的 id。
   - **OQ-66.2**：確認 `HIT_FEEDBACK_HOLD_MS`（預設 120）。
   - **OQ-66.3**：確認以 `emissive` 呈現（預設是）。
   - **OQ-66.4**：確認不需要 `meta` 版本標記（預設否）。若改判為是 ⇒ 本 WP 改為相依於該 schema WP，暫停並記錄。
   - 任一被推翻 ⇒ **先改 README 對應章節再開 T1**，不得讓 task 檔與 README 分歧。
6. **假設 #3 讀碼確認**：確認 `src/drill/schema.ts` 是否以白名單重組 config（未驗證的新欄位被靜默丟棄）。把結論寫進 `progress.md`——這決定 T3 是否必須同時改 `schema.ts`。
7. **決策草稿**：在 `progress.md` 寫下 GD-42 的草稿（D-66-1～D-66-6，見下），標明**本體於 T-exit 入帳**。

### GD-42 草稿條目

| # | 草稿內容 |
|---|---|
| **D-66-1** | 命中回饋走**獨立環形格**（`targetHits`），不放 `TargetState`——render-only 訊號不污染 sim 契約，承 WP-25 `shotRays` 先例 |
| **D-66-2** | 環形格**不帶時間戳**，衰減一律以 render 的 rAF `now` 起算——從結構上消除 sim clock ↔ wall clock 相減 |
| **D-66-3** | 回饋為 `DrillConfig.targets.hitFeedback?`，省略＝逐位不變且**不寫 metadata**（optional-in 不移動 canonical 位元組） |
| **D-66-4** | 啟用清單逐一列名（OQ-66.1），**排除**已凍結的 assessment 協定；啟用即構成**效度斷代**，由 `meta.targets.hitFeedback` 逐 run 自述 |
| **D-66-5** | projectile 條件的回饋延遲（飛行時間）為**已知且已接受**的條件差異——使用者 2026-09-11 決定 |
| **D-66-6** | replay **先不同步**（使用者 2026-09-11 決定）；觸發補齊的條件 = replay 被用於向受試者回放 |

## Invariants

- 本 task **不修改任何 `src/` 檔案**。
- 基線數字必須是**實際執行輸出**，不得引用其他 WP 的 `progress.md` 記載（那些跑在不同 commit 上）。
- OQ-66.1 的清單必須是 **drill id 逐字列表**，不得寫成「tracking 家族」這種會被後續讀者擴大解釋的描述。

## Definition of Done

- [ ] `progress.md §T0` 記載編號重查的四項來源與當下最大值，且明確寫出 `WP-66` / `GD-42` 可用或已順延為何值；**stage14 三個候選的採納狀態已逐一確認並記錄**
- [ ] `npm run typecheck` ×2、`npx vitest run`、`npx vitest run tests/regression`、`npx playwright test --workers=1`、`npm run build` 五項的 exit code 與通過數全數記入 `progress.md §T0`
- [ ] Playwright 執行前的 `.playwright-tmp/history-dev/` 目錄數已記錄；若曾清理，清理前後數字皆記錄
- [ ] 基線 `tracking_br_v1` 匯出的 `meta` 鍵集合（排序後）與 `meta.targets` 鍵集合已逐字記入 `progress.md §T0`
- [ ] 同一場的 frame-time p95 與 over-budget window 數已記錄（NFR-66.4 對照組）
- [ ] OQ-66.1 的**啟用 drill id 逐字清單**已寫入 `progress.md §T0` 與 README §1.4；OQ-66.2／66.3／66.4 各有一行「照預設關閉」或「使用者改判為 X，README 已同步」
- [ ] 假設 #3（`schema.ts` 白名單行為）的讀碼結論已記錄，並標明 T3 是否必須改 `schema.ts`
- [ ] GD-42 草稿六條已寫入 `progress.md`，並標註「本體 T-exit 入帳」

## Commit

```text
docs(wp-66): T0 entry gate for target hit visual feedback
```
