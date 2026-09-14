# T0 — Entry gate：編號重查、上游驗證、基線實測、OQ-68.2 收斂

> WP：[WP-68](README.md) · 估時 0.5 d · 相依：—
> 產出全部落在 [progress.md](progress.md)；本 task **不改任何 `src/`**。

## Steps

1. **編號重查**（[GD-35](../../../DECISIONS.md) ② 紀律；規劃期的數字可能已被平行 session 取用）：
   - `docs/exec-plan/README.md §2` 的當下最大採納 WP 號 → 確認 **WP-68** 未被取用；被取用則依 [GD-15](../../../DECISIONS.md)「先採納先得」順延並改資料夾名。
   - `docs/exec-plan/DECISIONS.md` 的當下最大已落帳 GD 號 → 確認 **GD-45** 未被取用（注意 `GD-43` 由 [WP-67](../wp-67-export-opening-protocol-marker/README.md) 預約）。
   - 兩個結果**逐字**記入 `progress.md §T0`。
2. **上游 exit-gate 驗證**：[WP-63 T-exit](../wp-63-micro-flick-v8-measurement-foundation/progress.md) 已 ✅（2026-09-14，v0.1.1）。確認以下三項仍成立並記錄當下 HEAD：
   - `src/metrics/targetWindows.ts` 與 `src/metrics/microFlickMetrics.ts` 存在且測試綠；
   - `src/loop/__tests__/wp63-v8-metrics-determinism.test.ts` 綠（T2 要複用它的 harness 形狀）；
   - `DECLARED_WEAPON_BY_DRILL_ID` 已含 v8（`drillFamily.ts:169` 附近）。
3. **NFR-68.4 基線實測**（未修改任何 `src/` 的 HEAD 上跑，**數字**入帳，不是「通過」）：
   ```powershell
   npm.cmd run typecheck
   npm.cmd test
   npm.cmd run test:e2e:fast -- --workers=1
   npm.cmd run test:e2e -- --workers=1
   npm.cmd run build
   ```
   ⚠️ 兩層 Playwright 依 [GD-44](../../../DECISIONS.md) 分層，**不得**用舊的裸 `npx playwright test`（它會把 `@realgpu` 拉進 chromium-ci 而必然失敗）。
   ⚠️ 跑 headed Edge 期間**不要**平行跑其他重指令 —— [WP-66 T-exit](../wp-66-target-hit-visual-feedback/progress.md) 與 WP-63 T2 都記錄過因此掉焦點而產生的 flake。
4. **CodeGraph impact 重跑**（規劃期的 blast radius 可能落後 HEAD）：
   ```
   codegraph.cmd impact deriveOutcome -j -p .
   codegraph.cmd callers deriveOutcome -j -l 1000 -p .
   codegraph.cmd callers deriveMicroFlickMetrics -j -l 1000 -p .
   ```
   把 caller 條目數、非檔案符號數、distinct file 數記入 `progress.md`。
   **特別確認**：`deriveOutcome`／`deriveMicroFlickMetrics` **未**被 `DrillMetricRegistry` 或任何晉升指標路徑消費（C-D5 邊界，README §2b）。若被消費，T2 的改動立刻升級為晉升指標語意變更，須先入帳再動。
5. **親自複核兩條規劃期的機制宣稱**（不得只引用 README）：
   - `micro_flick_three_target_test_v9.ts` 確實**無** `weaponId` 鍵，且 `MICRO_FLICK_V9_TARGET_DIAMETER_U` 由 v8 常數推導；
   - `microFlickMetrics.ts` 的 `validSpanMs` 確實為 `lastKillMs - firstVisibleMs`，並記下當下行號。
6. **`endCondition` 是否在匯出 schema 內** —— 逐欄掃 `src/data/metadata.ts` 的 `Meta`，把結論記入 `progress.md`。這決定 T2 走 README §2.2 的路徑 A 還是 B，**T0 就要有答案**，不要留給 T2 現場發現（比照 [D-63.T5-1](../wp-63-micro-flick-v8-measurement-foundation/progress.md) 的教訓）。
7. **OQ-68.2 收斂**：向研究者確認既有 v9 匯出是否為 frozen cohort。有回覆則照辦；無回覆則以 README §1.4 的非阻塞預設「否」**明帳**推進，並在 `progress.md` 寫明「這不是研究者的肯定回覆」。
8. **GD-45 草稿**寫入 `progress.md`（**不**入 `DECISIONS.md`，T-exit 才落帳並再重查號）。

## Definition of Done

- [ ] WP-68 / GD-45 兩個號的重查結果逐字記入 `progress.md`
- [ ] WP-63 三項上游證據連結齊全，當下 HEAD 已記錄
- [ ] 五項基線指令 exit 0 且**實測數字**（檔數／測試數／時間／modules）入帳
- [ ] `deriveOutcome` 的 CodeGraph impact 已記錄，且 C-D5 邊界有明確結論
- [ ] `endCondition` 是否進匯出 schema 有明確答案，並指定 T2 走哪條路徑
- [ ] OQ-68.2 有答案或以預設假設明帳推進
- [ ] GD-45 草稿已寫入 `progress.md`

## Commit

```
docs(wp-68): T0 entry-gate
```
