# T-exit — Exit gate：FR／NFR 逐條對帳、diff 稽核、帳本與索引更新

> WP：[WP-68](README.md) · 估時 0.5 d · 相依：T0–T2
> 本 WP 無獨立里程碑，**本 gate 即交付判定**（比照 WP-60／62／63）。

## 判定原則

每一條 FR／NFR 必須對應**指令 + 輸出**、**斷言檔名 + 案例名**，或**記入 `progress.md` 的實測數值**。
「已完成」「運作正常」「看起來沒問題」一律不合格。

允許的交付形態：
- **✅ 完全交付**：全部 FR／NFR 有證據
- **✅ 帶具名缺口**：某項因需要真人資料或真瀏覽器而無法在本 WP 關閉 ⇒ 逐條具名並歸因，**不得**改寫成「尚未完成」

⚠️ **承 [WP-63 T-exit](../wp-63-micro-flick-v8-measurement-foundation/progress.md) 的 TE.0 教訓**：具名缺口只留給「本 WP 內不可能關閉」的項目。若複核時發現某條斷言守的不是它掛著的那條 NFR（兩側同源、fixture 不覆蓋宣稱的型態等），**就地補齊**，不要寫成缺口。[GD-39](../../../DECISIONS.md) ⑥ 是這條的紀律來源。

## Steps

1. **FR 對帳**：FR-68.1 ~ FR-68.5 逐條在 `progress.md` 列出證據（測試檔 + 案例名）。
2. **NFR 對帳**：NFR-68.1 ~ NFR-68.4 逐條列出指令與實際輸出數字，並與 T0 基線對照。
3. **硬約束複核**：重走 [README §2b](README.md) 的表，確認每一列的判定在實作後仍成立。特別檢查：
   - C-D4：六個 canonical derivation 檔的 `git diff` 為空
   - C-D5：`deriveOutcome` 仍未被任何晉升指標或 `DrillMetricRegistry` 消費
   - GD-5：T1 的 spawn trace 證據與 rng 零消耗仍綠
   - ADR-2：新程式碼零 `SharedState` 讀寫
   - **KI-037 邊界**：`src/history/DrillMetricRegistry.ts` `git diff` 為空
4. **診斷式錨點掃描**（承 [GD-39](../../../DECISIONS.md) ② 的硬紀律）：掃 `microFlickMetrics.ts` 的 `onset`／`sustained`／`firstSustained` 三個字串，count 必須為 0。
5. **入帳 `GD-45`**（T0 草稿 → `docs/exec-plan/DECISIONS.md`）：
   - ① 編號與落點（WP-68／GD-45，stage13 落點偏離的明帳，承 WP-63 先例）
   - ② v9 的零散布武器宣告與**效度斷代**；⚠️ 新事實：v8／v9 自此在 `meta.weaponId` 上**不可分**，分析側必須以 `meta.drillId` 分池
   - ③ 計時制與 kill-budget 兩種計分窗右界的分流決策，含 v9 上的**實測差值**
   - ④ 交付宣稱上限與 [GD-39](../../../DECISIONS.md) ⑤ 相同（可算、可重現、可稽核，不含效度；C-D3 閘未過 ⇒ 不得進教練報告）
   - **入帳前必須重查** `DECISIONS.md` 當下最大 GD 號（GD-35 ② 紀律；WP-63 規劃期預留的號被撞過一次）
6. **索引更新**（五處）：
   - [stage13 README §2](../README.md) 的 WP-68 列翻 ✅ 並補證據（列與 §3 落點註記已於**規劃期採納時**建立）
   - [`exec-plan/README.md §2`](../../../README.md) 階段 M 區塊的 WP-68 列翻 ✅ 並補證據
   - [stage14 README §3](../../stage14/README.md) —— 候選順延為 WP-69／70／71 的註記已於**採納時**寫入（[GD-15](../../../DECISIONS.md)「先採納先得」以採納為準，不是以交付為準）⇒ 本 gate 只**複核**它仍在且仍正確，不重複寫入
   - [`docs/MAP.md`](../../../../MAP.md)
   - [`docs/operational/analysis-micro-flick.md`](../../../../operational/analysis-micro-flick.md) —— 補 v9 的適用性：該契約原文只談 v8，本 WP 後 v9 適用同一份環境硬閘，但**計分窗右界語意不同**，須具名說明
7. **diff 稽核**：
   ```powershell
   git status --short
   git diff --cached --stat
   git diff --cached --name-only
   ```
   確認只含預期檔案；**不得**有非預期的 golden／期望輸出檔異動。
8. **全量閘**：
   ```powershell
   npm.cmd run typecheck
   npm.cmd test
   npm.cmd run test:e2e:fast -- --workers=1
   npm.cmd run test:e2e -- --workers=1
   npm.cmd run build
   npm.cmd run graph:update
   ```
   ⚠️ `graph:update` 走 npm script；**不得**跑裸 `graphify update .`（節點數已過 5000，裸指令會刪掉 `graph.html`）。
9. **交接清單**：在 `progress.md` 寫明後續 WP 需要接手的東西 —— 至少包含：
   - v8／v9 因同武器而不可分，對混池分析的具體操作要求
   - `endCondition` 若日後進匯出 schema，本 WP 的查表應改讀匯出並移除 `unknown_end_condition`
   - v9 的真人 pilot 需求（承 [WP-63 §5](../wp-63-micro-flick-v8-measurement-foundation/README.md)，兩支應一起收而非各收一次）

## Definition of Done

- [ ] FR-68.1–5 逐條在 `progress.md` 有測試檔 + 案例名
- [ ] NFR-68.1–4 逐條有指令與**實際數字**，並與 T0 基線對照
- [ ] README §2b 硬約束表逐列複核，五項具名檢查（C-D4／C-D5／GD-5／ADR-2／KI-037 邊界）皆有證據
- [ ] onset 判準掃描（三個字串）count === 0
- [ ] `GD-45` 已入 `DECISIONS.md`，且入帳前的重查結果記入 `progress.md`
- [ ] 五處索引已更新（含 stage14 候選順延為 69／70／71、`analysis-micro-flick.md` 的 v9 適用性）
- [ ] `git diff --cached --name-only` 只含預期檔案
- [ ] 五項全量閘（含 GD-44 兩層 Playwright）exit 0；`npm run graph:update` 已執行
- [ ] 交接清單三項齊全

## Commit

```
docs(wp-68): T-exit gate and evidence reconciliation
```
