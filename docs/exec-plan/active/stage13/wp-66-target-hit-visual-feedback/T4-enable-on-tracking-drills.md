# WP-66 T4 — 在指名的 tracking drill 啟用，並把效度斷代寫成明帳

> FR-66.11 · FM-7 · D-66-4 / D-66-5 · 風險 §3.1

## Objective

把 T3 的開關在 **T0 收斂的清單**上打開，並讓「這是一次效度斷代」這件事在三個地方同時留下可稽核的痕跡：逐 run 的 `meta`、WP 的 `progress.md`、stage 層 README。

程式上這是全 WP 最小的切片（改幾個 config 值）；**風險最高的也是它**——一旦啟用，該 drill 在本次 commit 前後收的資料**不可混池比較**。

## Steps

1. **讀回 T0 清單**：從 `progress.md §T0` 取出 OQ-66.1 收斂的 **drill id 逐字列表**。只能動這份清單上的 id；**不得**順手多開一個。
   - 預設清單（若 T0 未推翻）：
     - `tracking_br_v1` 八個 variant（[tracking_br_v1.ts:94-103](../../../../../src/drill/tracking_br_v1.ts#L94-L103) 的 `trackingBrVariants`）——在 `makeVariant()` 的 `targets` 物件加 `hitFeedback: 'flash'`，**一處生效八個**。
     - WP-64 策展的兩個 Tracking Pilot config。
   - **排除**：`hold_track_v1`（stage6 `protocolVersion = 1.0.0` 凍結，[GD-23](../../../DECISIONS.md)）、所有 formal assessment drill、所有非 tracking 家族。
2. **逐一比對啟用後的 config 快照**：對清單上每個 id，確認 `loadDrill()` 後的 config 除了多出 `targets.hitFeedback: 'flash'` 之外**逐欄不變**（尤其 `hitbox`／`motion`／`trackingTrajectory`／`timing`／`sequence.seed`／`weaponId`）。
3. **效度斷代明帳（FM-7）**——三處同時寫：
   - `progress.md §T4`：啟用清單（drill id 逐字）、生效 commit hash、生效日期、**一行白話**說明「此日期之後的這些 drill 帶命中回饋，與之前的資料不可混池」。
   - [stage13 README](../README.md) 的 WP-66 列狀態欄：同一句摘要 + 連結。
   - GD-42 草稿的 D-66-4 補上實際清單（本體仍於 T-exit 入帳）。
4. **live 實機驗證**（每個被啟用的家族至少各一場）：
   - 跑一場 `tracking_br_v1`（hitscan variant）：命中時目標亮起、停火後 ≤ `HIT_FEEDBACK_HOLD_MS` 熄滅、刻意打偏時**不亮**。截圖或錄影證據記入 `progress.md`。
   - 跑一場 projectile variant：確認亮起**晚於**扣板機一個飛行時間，且該延遲與匯出 `hit` 事件的 `timeOfFlightMs` 數量級相符（D-66-5 的實地確認；**不做**逐毫秒對帳——那會落入 sim clock 與 wall clock 相減的陷阱）。
   - 匯出兩場的 JSON，確認 `meta.targets.hitFeedback === 'flash'`。
5. **對照組**：跑一場**未啟用**的 drill（例如 `counterstrafe_ad_v1`），確認目標命中時**不亮**，且匯出的 `meta.targets` 鍵集合與 T0 基線**逐字相同**。這條是 FR-66.8 的實機證據，不能只靠單元測試。
6. **既有 fixture 檢查**：確認 `tests/regression/` 內是否有以 `tracking_br_v1` config 為輸入的 golden fixture；若有，確認其 digest **是否應該**變動——`hitFeedback` 是 additive 且只進 `meta`，若該 fixture 涵蓋 `meta` 鍵面則 digest 會變紅，**那是預期的**（只動到這一個鍵）。逐筆在 `progress.md` 說明哪些變、哪些沒變、為什麼。

## Invariants

- 只動 **T0 清單**上的 drill；其餘 drill config 逐位不變。
- 除了 `targets.hitFeedback` 之外，被啟用 drill 的任何 config 欄位**零變更**。
- `src/state/`、`src/loop/`、`src/render/`、`src/drill/schema.ts`、`src/data/` 本切片**零修改**（全部應已於 T1–T3 落地）。
- `hold_track_v1` 與任何 formal assessment 協定的 `protocolVersion` **零變更**。

## Definition of Done

- [ ] `progress.md §T4` 列出**實際啟用的 drill id 逐字清單**，且與 `progress.md §T0` 的 OQ-66.1 收斂結果**逐字相同**
- [ ] 每個被啟用 drill 的 `loadDrill()` 後 config 快照已與啟用前逐欄比對，差異**恰為** `targets.hitFeedback`（比對輸出記入 `progress.md`）
- [ ] `tracking_br_v1` hitscan 實機證據：命中亮／打偏不亮／停火後熄滅三項各有截圖或錄影，記入 `progress.md`
- [ ] projectile variant 實機證據：亮起延遲與該場匯出 `hit` 事件的 `timeOfFlightMs` 數量級相符（記下兩者數值）
- [ ] 兩場 tracking 匯出的 `meta.targets.hitFeedback === 'flash'`
- [ ] 未啟用對照 drill 的實機證據：命中**不亮**，且其匯出 `meta.targets` 鍵集合與 T0 基線**逐字相同**
- [ ] `tests/regression/` 的 golden fixture 逐筆分類完成：哪些 digest 變動、哪些不變、各自理由已寫入 `progress.md`；未涉及 `meta` 鍵面的 fixture **必須**零變動
- [ ] 效度斷代已同時寫入 `progress.md §T4`、[stage13 README](../README.md) 的 WP-66 列、GD-42 草稿 D-66-4
- [ ] `git diff --stat` 顯示本切片只動 drill config 檔（+ 兩份 doc），`src/state/`、`src/loop/`、`src/render/`、`src/data/` 零改動
- [ ] `npm run typecheck` ×2 exit 0；全量 `npx vitest run` exit 0

## Commit

```text
feat(drill): turn on hit feedback for the tracking family
```
