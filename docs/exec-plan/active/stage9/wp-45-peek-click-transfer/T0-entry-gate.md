# WP-45 / T0 — Entry gate:construct、介面與熱區凍結

## Objective

在動 production code 前，確認 README §0 的讀碼結論仍成立、active WP 熱區已錯開，並拍板會改變 T1–T3 介面的 OQ-S9-4。T0 不修改 production code。

## Dependencies

None。

## Steps

1. 記錄 `git rev-parse HEAD`、`git status --short`、CodeGraph pending files。
2. 用 CodeGraph 覆核 `createSimLoop`、`fireOneShot`、`raycastWithRay`、`deriveVisibilityTimeline`、`loadDrillById`、`buildFamilyOrder` 的 callers/impact。
3. 跑 baseline：
   - `npm.cmd test -- src/metrics/visibilityDerivation.test.ts src/sim/HitDetector.test.ts src/loop/SimLoop.test.ts`
   - `npm.cmd test -- src/session/sessionSchedule.test.ts src/session/SessionRunner.test.ts`
4. 確認 WP-44 對 `DrillConfig.ts`/`schema.ts`/`TargetManager.ts`/`main.ts` 的狀態；T3 未達 dependency gate 不開工。
5. 確認 WP-43 T-exit 狀態；T5 未達 dependency gate 不開工。
6. 決議 OQ-S9-4：若選 split timeout，先修訂 README interface/task breakdown，再開始 T1；不得在 T3 臨時擴 scope。
7. 將 baseline commit、命令、結果、決議寫入 `progress.md`。

## Definition of Done

- [ ] README FR/NFR/OQ 逐條仍符合 HEAD。
- [ ] CodeGraph blast radius 已記錄，T1 標記為跨模組 High risk。
- [ ] baseline commands exit code 0；若既有紅燈，具體 test name/owner 已記錄且未誤歸因本 WP。
- [ ] OQ-S9-4 有書面決議。
- [ ] WP-44/WP-43 dependency gate 狀態已記錄。
- [ ] production code diff 為空。

## Commit

文件更新可與 stage9 plan commit 合併；T0 不要求 production commit。
