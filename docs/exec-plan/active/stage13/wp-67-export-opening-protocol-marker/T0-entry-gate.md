# WP-67 T0 — Entry gate：編號重查、上游驗證、基線凍結、OQ 收斂

> [README.md](README.md) §1.4 · [GD-15](../../../DECISIONS.md)／[GD-35](../../../DECISIONS.md) ② · 協議 [CLAUDE.md §3.6](../../../../../CLAUDE.md)

## Objective

在動任何一行 production code 之前，把**四件會讓後續全部白做的事**釘死：號碼沒被搶走、上游真的綠燈、基線數字有紀錄可比、Open Question 全部收斂。

## 為什麼這個 gate 不能省

本 WP 的驗收核心是「**某些數字必須不動、某些必須動**」（README §0.4）。沒有 T0 凍結的基線，T4 的「digest 位移三格、其餘八筆不動」就無法宣稱——只能說「看起來對」。

## Steps

1. **編號重查**（[GD-35](../../../DECISIONS.md) ② 紀律）。逐一記下當下值到 `progress.md §T0`：
   - `docs/exec-plan/README.md §2` 的最大 WP
   - `docs/exec-plan/active/*/` 實際存在的最大 WP 資料夾
   - `docs/exec-plan/DECISIONS.md` 已落帳的最大 GD
   - 其他 WP 的 `progress.md` 中已預約但未落帳的 GD（規劃期 WP-66 預約了 GD-42）
   
   規劃期取得的是 **WP-67 / GD-43**。若任一號已被平行 session 取用 ⇒ **依 GD-15 順延、不爭號**，並**同步更新本資料夾全部文件的連結與號碼**（含 stage13 README、`exec-plan/README.md`）。
2. **驗上游 exit-gate 綠燈**：[WP-65 T-exit](../wp-65-drill-arming-and-countdown/T-exit-gate.md) 的 DoD 八條、[stage13 README §2](../README.md) 的 WP-65 列、[GD-41](../../../DECISIONS.md) 本體，三處皆已 ✅。把連結記入 `progress.md`。
3. **凍結基線**（四項，逐項貼實際輸出，不寫「已跑過」）：
   - `npm run typecheck` → exit code
   - `npx vitest run` → `N passed / M skipped`（T-exit 的差額全部從這裡算起）
   - `npx vitest run tests/regression` → `N passed`
   - `npx playwright test --workers=1` → `N passed / 0 failed` ＋ 耗時
4. **凍結兩組 digest 的當下值**（這是本 WP 最關鍵的基線，抄進 `progress.md §T0` 表格）：
   - [exportPayloadSchema.test.ts](../../../../../src/data/exportPayloadSchema.test.ts) 的 **8 筆** `CANONICAL_DIGEST_BEFORE_T5`（逐筆檔名 + 值）→ **T4 必須逐筆相同**
   - [session-orchestrator.spec.ts](../../../../../tests/e2e/session-orchestrator.spec.ts) 的 **3 格** `FROZEN_META_KEY_DIGESTS` → **T4 必須全部改變**
5. **記錄 e2e 環境現況**：執行前 `.playwright-tmp/history-dev/` 的目錄數（該目錄從不清理，累積到一定量後 history-library e2e 會無故轉紅；先數再懷疑程式）。
6. **OQ 收斂**：README §1.4 的 OQ-67.1～67.4 逐條在 `progress.md` 寫下關閉值（照預設關閉亦須具名寫下，不得留空）。
7. **GD-43 草稿**：把 D-67-1～D-67-6（見 [progress.md](progress.md)）寫入 `progress.md`，標註「**本體 T-exit 入帳**」。
8. **覆核假設 1**：`grep -rn "createDrillRunner" src/ --include=*.ts | grep -v test` 列出全部 production 建構點，逐點確認是否傳 `requireArm: true`。若出現第三個以外的點、或有一點沒傳 ⇒ README §3.2 的中間窗指紋推論失效，**當場在 `progress.md` 改標為 `unknown` 並通知使用者**。

## Definition of Done

- [ ] `progress.md §T0` 記載編號重查的四項來源與當下最大值，並明確寫出 `WP-67` / `GD-43` 是否仍可用；若順延，本資料夾全部文件的號碼與連結已同步改完
- [ ] WP-65 T-exit 綠燈的三處證據連結已記錄
- [ ] 四項基線指令的**實際輸出**已貼入（exit code / passed 數 / 耗時）
- [ ] 8 筆 canonical digest ＋ 3 格 frozen meta digest 的當下值已逐筆抄入 `progress.md §T0` 表格
- [ ] `.playwright-tmp/history-dev/` 執行前目錄數已記錄
- [ ] OQ-67.1～67.4 四條全數具名關閉
- [ ] GD-43 草稿六條已寫入 `progress.md`，標註「本體 T-exit 入帳」
- [ ] production 的 `createDrillRunner()` 呼叫點已逐點列出並確認 `requireArm` 傳遞狀況

## Commit

```text
docs(wp-67): T0 entry gate for export opening protocol marker
```
