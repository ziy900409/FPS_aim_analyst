# T-exit — Exit gate：FR／NFR 逐條對帳、diff 稽核、帳本與索引更新

> WP：[WP-63](README.md) · 估時 0.5 d · 相依：T0–T7
> 本 WP 無獨立里程碑，**本 gate 即交付判定**（比照 WP-60／62）。

## 判定原則

每一條 FR／NFR 必須對應**指令 + 輸出**、**斷言檔名 + 案例名**、或**記入 `progress.md` 的實測數值**。
「已完成」「運作正常」「看起來沒問題」一律不合格。

允許的交付形態：
- **✅ 完全交付**：全部 FR／NFR 有證據
- **✅ 帶具名缺口**：某項因需要真人資料或真瀏覽器而無法在本 WP 關閉 ⇒ 逐條具名並歸因（比照 WP-60 的三項具名缺口），**不得**改寫成「尚未完成」

## Steps

1. **FR 對帳**：FR-63.1 ~ FR-63.15 逐條在 `progress.md` 列出證據（測試檔 + 案例名）。
2. **NFR 對帳**：NFR-63.1 ~ NFR-63.7 逐條列出指令與實際輸出數字。
3. **硬約束複核**：重走 [README §2b](README.md) 的表，確認每一列的判定在實作後仍成立。特別檢查：
   - C-D4：五個 canonical 檔案的 `git diff` 為空
   - GD-7：L2 角半徑與命中判定同源，且未經 `targetHitboxRadius()`
   - GD-5：新增的合成 fixture 若有隨機性，seed 已寫入
   - ADR-2：新程式碼零 `SharedState` 讀寫
4. **診斷式錨點複核**（§2.2 的硬紀律）：掃描 `targetWindows.ts` 與 `microFlickMetrics.ts`，確認未出現任何自訂的 movement-onset 判準（掃 `onset`／`sustained`／`firstSustained`）。
5. **入帳 GD-39**（T0 草稿 → `docs/exec-plan/DECISIONS.md`）：
   - ① 編號與落點（WP-63／GD-39，stage13 落點偏離的明帳）
   - ② v8 指標一律**事件錨定**，不引入第二個 movement-onset 判準（C-D4 邊界）
   - ③ GD-38 ②(b) 的機制事實更正（`spawn()` 補滿彈匣），與 ②(a) 對 v8 不適用的範圍界定
     ✅ **已於 2026-09-10 提前單獨落帳**（直接寫入 GD-38 ② 的 inline 更正段，比照該條 `T0 對帳修正` 的既有慣例）。理由：WP-62 T4 是建立武器選單文案的 task 且已迫近（T2 完成於 2026-09-10），等到本 WP T-exit（12–16.5 d 後）會讓誤導文案先出貨。
     ⇒ T-exit 只需**複核**該段是否仍在、是否與本 WP 實作後的事實一致，**不要重複入帳**；GD-39 本體只寫 ①②④⑤ 並在 ③ 處指回 GD-38 的更正段。
   - ④ v8 換武器的斷代宣告與稽核方式（`meta.weaponId`）
   - ⑤ 本 WP 交付宣稱上限 = 「可算、可重現、可稽核」，**不含效度**；C-D3 閘未過 ⇒ 不得進教練報告
   - **入帳前必須重查** `DECISIONS.md` 當下最大 GD 號（GD-35 ② 紀律；前四次規劃期預留號都被撞過）
6. **索引更新**：
   - [stage13 README §2](../README.md) 加／翻 WP-63 列
   - [`exec-plan/README.md §2`](../../../README.md) 階段 M 區塊加／翻 WP-63 列
   - [stage14 README §3](../../stage14/README.md) 的候選編號順延註記
   - [`docs/MAP.md`](../../../../MAP.md)（若 T7 未做完）
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
   npx.cmd playwright test --workers=1
   npm.cmd run build
   graphify update .
   ```
9. **交接清單**：在 `progress.md` 寫明後續 WP 需要接手的東西 —— 至少包含：
   - 真人 pilot 的最小規格（[README §5](README.md) 的五項非真人不可）
   - `?rawMouse=1` cohort 取得後，如何量免閾值描述子的漏檢率（§3.2 的觸發條件）
   - KI-031／KI-034 修復後，可補 `movementTimeMs`／`peakOmega` 的路徑

## Definition of Done

- [ ] FR-63.1–15 逐條在 `progress.md` 有測試檔 + 案例名
- [ ] NFR-63.1–7 逐條有指令與**實際數字**，並與 T0 基線對照
- [ ] README §2b 硬約束表逐列複核，四項具名檢查（C-D4／GD-7／GD-5／ADR-2）皆有證據
- [ ] onset 判準掃描（三個字串）count === 0
- [ ] `GD-39` 已入 `DECISIONS.md`，且入帳前的重查結果記入 `progress.md`
- [ ] stage13 README §2、`exec-plan/README.md §2`、stage14 README §3、`docs/MAP.md` 四處索引已更新
- [ ] `git diff --cached --name-only` 只含預期檔案
- [ ] 四項全量閘 exit 0；`graphify update .` 已執行
- [ ] 交接清單三項齊全

## Commit

```
docs(wp-63): T-exit gate and evidence reconciliation
```
