# WP-65 T0 — Entry gate：編號重查、基線凍結、OQ 收斂

## Objective

在動任何 production code 之前，把三件會讓後續 task 白做的事釘死：① WP/GD 編號是否仍可用（平行 session 可能已取用）；② 本 WP 前的**基線數字**（測試通過數、e2e 通過數、既有匯出鍵面），沒有基線就無法宣稱「逐位不變」；③ 四個 OQ 是否照 README 預設關閉。

本 WP **無上游 exit-gate 相依**（與 WP-60～64 全數正交），故本 T0 不做上游驗閘，改做基線與編號。

## Steps

1. **編號重查**（[GD-35](../../../DECISIONS.md) ② 紀律，不可略過）：
   - 讀 `docs/exec-plan/README.md §2`，記下當下最大 WP 編號。
   - `ls docs/exec-plan/active/*/` 列出所有 WP 資料夾，取實際最大編號（**索引可能落後於資料夾**——規劃當下 §2 停在 WP-63，但 `active/stage13/` 已有 wp-64）。
   - 讀 `docs/exec-plan/DECISIONS.md`，記下當下最大 GD 編號，並確認 GD-40 是否已被 WP-64 落帳。
   - 若 `WP-65` 或 `GD-41` 任一已被取用 ⇒ 依 [GD-15](../../../DECISIONS.md)「先採納先得」順延，**不爭號**；順延後同步改本資料夾名與全部內部連結，並在 `progress.md` 記錄改號前後值。
2. **基線凍結**（全部輸出貼進 `progress.md §T0`，只記數字不記感想）：
   - `npm run typecheck` ×2 → 記 exit code。
   - `npx vitest run` → 記 `N passed / M skipped` 與耗時。
   - `npx playwright test --workers=1` → 記 `N passed / M failed` 與耗時。**先數 `.playwright-tmp/history-dev/` 下的 participant 目錄數**；若已累積上千個，先清理再跑，否則 history-library spec 會以無關原因轉紅。
   - `npm run build` → 記 exit code。
3. **既有匯出鍵面 digest**：以研究員模式跑一場最短的 drill（建議 `counterstrafe_cued_v1`，`targetCount: 20`），匯出 JSON，記錄 `meta` 的**鍵集合**（排序後）與 `meta.validity` 的鍵集合。這是 T5 宣稱「additive 不動既有鍵面」的唯一對照基準。
4. **待命期 arena 消耗實測**（FM-2 的量化前提）：在目前的 `main` 上開著 app 不點任何東西 **10 分鐘**，然後匯出並記錄 `meta.recorderOverflow` 與 `ticks.length`。這證明「若不做 D-65-5 的 `recorder.reset()` 會發生什麼」，是 T2 DoD 的對照組。
5. **OQ 收斂**：逐條確認 README §1.4 的 OQ-65.1～65.4 是否照預設關閉。任一被使用者推翻 ⇒ 先改 README 對應章節再開 T1，不得讓 task 檔與 README 分歧。
6. **決策草稿**：在 `progress.md` 寫下 GD-41 的草稿內容（D-65-1～D-65-5 五條），標明**本體於 T-exit 入帳**（比照 WP-63 D-63-P6 的先例，規劃期只留草稿）。

## Invariants

- 本 task **不修改任何 `src/` 檔案**。
- 基線數字必須是**實際執行輸出**，不得引用其他 WP 的 progress.md 記載（那些跑在不同 commit 上）。

## Definition of Done

- [ ] `progress.md §T0` 記載編號重查的四項來源與當下最大值，且明確寫出 `WP-65` / `GD-41` 可用或已順延為何值
- [ ] `npm run typecheck` ×2、`npx vitest run`、`npx playwright test --workers=1`、`npm run build` 四項的 exit code 與通過數全數記入 `progress.md §T0`
- [ ] Playwright 執行前的 `.playwright-tmp/history-dev/` 目錄數已記錄；若曾清理，清理前後數字皆記錄
- [ ] 基線匯出的 `meta` 鍵集合（排序後）與 `meta.validity` 鍵集合已逐字記入 `progress.md §T0`
- [ ] 10 分鐘待命實測的 `meta.recorderOverflow` 與 `ticks.length` 已記錄（FM-2 對照組）
- [ ] OQ-65.1～65.4 各有一行「照預設關閉」或「使用者改判為 X，README 已同步」
- [ ] GD-41 草稿五條已寫入 `progress.md`，並標註「本體 T-exit 入帳」

## Commit

```text
docs(wp-65): T0 entry gate for drill arming and countdown
```
