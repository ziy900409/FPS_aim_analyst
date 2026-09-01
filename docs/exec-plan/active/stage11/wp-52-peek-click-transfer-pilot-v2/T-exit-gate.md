# WP-52 / T-exit — Pilot v2 acceptance and WP-53 handoff

> Format mirrors [WP-45's T-exit gate](../../stage9/wp-45-peek-click-transfer/T-exit-gate.md).

## Entry criteria

- T0–T4 checklist 全勾且各 task commit 可追溯（見 [task-checklist.md](task-checklist.md) / [progress.md](progress.md)）。
- WP-45 T-exit dependency gate 已滿足（沿用其 pilot-ready 交付）。

## Automated gate

1. [x] `npm run typecheck`（`tsc --noEmit` + `tsc --noEmit -p tsconfig.node.json`）— exit 0
2. [x] `npx vitest run`（全專案）— 188 files / 1668 tests passed，2 skipped（既有、與本 WP 無關）
3. [x] `npx playwright test`（全專案，edge channel）— 72 passed，含 T2 新增的 transfer-family DOM case 與 WP-45 既有 `peek-click-transfer.spec.ts`
4. [x] targeted determinism：60/120/240 Hz pilot v2 export snapshot deep-equal（`peek_click_transfer_pilot_v2.test.ts`）
5. [x] pilot v1 config/tests 零修改（T0 guard + 全程 baseline 對照）

所有命令 exit code 為 0；無環境性 skip 需要記錄。

## Manual gate

見獨立文件 [T4-manual-pilot-gate.md](T4-manual-pilot-gate.md)。狀態：**尚未由真人研究者回填**——本 gate 不宣稱人工項目已完成，僅宣稱 checklist 文件本身已就緒可供執行。

## Documentation gate

- [x] `docs/operational/analysis-peek-click-transfer.md` 新增 §Pilot v2。
- [x] `CONTEXT.md` 新增 `peek_click_transfer_pilot_v2` 詞條。
- [x] `docs/exec-plan/DECISIONS.md` 新增/解決 GD-26（preset 切換 vs. WP-43 FR-H3 矛盾）。
- [x] `docs/known_issue/KI-016-*.md` 與 [BUGFIX-DECISIONS.md](../../../known_issue/BUGFIX-DECISIONS.md) BD-016 回寫為已修復。
- [x] `docs/exec-plan/active/stage11/README.md`／`task-checklist.md`／`progress.md` 狀態同步。
- [x] `graphify update .` 已於每個有改 production code 的 task 後執行（最終一次：3832 nodes / 9004 edges）。
- [ ] `git status --short`、staged filenames 僅含本次 T-exit 預期檔案。（交由提交前檢查，見下）

## Exit result

Exit 代表：調整後 transfer pilot v2 以獨立版本化 config 存在（不觸碰 v1）；操作端能透過既有自由勾選 Session Plan UI 選入 `'peek-click-transfer'` 家族並匯出，metadata 不再因 KI-016 而 throw；evidence report 聚合工具與 synthetic fixture 就緒；manual gate checklist 文件就緒。

Exit **不代表**：

- 任何真人 pilot trial 已經跑過（[T4-manual-pilot-gate.md](T4-manual-pilot-gate.md) 明文待補）；
- pilot v2 的角尺寸/timeout 已用真人資料驗證或調整——T0 只是延續 v1 現行值，尚未產生新證據；
- WP-53 可以開始 formal freeze（見 D-52.8：**No-go**，待人工執行）。

## Commit

本次 T-exit 只更新文件（status/checklist 同步），無 production code 變更；隨此文件一併 commit。
