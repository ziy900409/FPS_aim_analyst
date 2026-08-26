# T0 — entry gate:覆核讀碼假設,無程式碼

> Part of [WP-46](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | 無 |
| **Risk / Cplx** | Low / Low |
| **Touches** | 無程式碼;僅覆核 [README.md §0](README.md#0-讀碼對帳brainstorming-對話2026-08-26) |
| **狀態** | ✅(2026-08-26) |

## Objective

在動 T1 之前,把 brainstorming 對話中做過的讀碼結論(§0 六項)實際對照一次現行程式碼,確認假設仍成立——尤其確認 WP-44/WP-45 交付後 `TargetManager.ts`/`HitDetector.ts`/`spider_shot_v2.ts`/`DECISIONS.md` 沒有被其他工作變更過。

## Steps

- [x] 確認 `src/sim/TargetManager.ts` 的 `sampleSpiderShotPose()`/`markKilled()` 仍是 WP-44 交付的形狀(center↔peripheral 交替、`spiderZoneQueue` 12 格佇列)。**成立**——`sampleSpiderShotPose()`(L208)、`markKilled()`(L347)、`spiderZoneQueue`(L176)皆在,`spiderShot !== undefined ? sampleSpiderShotPose() : sampleSpawnPose()`(L251)分支未變。
- [x] 確認 `src/drill/spider_shot_v2.ts` 仍是 WP-44 交付的候選值(`angularRadiusDegRange=[10,25]`、`grid:{4,3}`、seed `260826`),尚未被其他工作改動。**成立**——三個值逐位相符。
- [x] 確認 `src/sim/HitDetector.ts` 目前仍只有 box(`Box3`)相交路徑,`raycastWithRay` 簽名未變。**成立**——僅 `raycaster.ray.intersectBox(box, hitPoint)` 一條路徑,簽名 `(origin, dirNormalized, targets, hitPointOut?, subAlpha?)` 未變。
- [x] 確認 `src/loop/SimLoop.ts` 的 WP-45 `hitscanOcclusion` 分支(`firstBlockingIntersection`)仍是命中判定**之後**的獨立二次檢查,不在 `HitDetector.raycastWithRay` 內部——確認新增 sphere 分支不會與其交錯。**成立**——`firstBlockingIntersection` 只在 `result.hit && hitscanOcclusion !== undefined && ballisticHitPoint.valid` 後、`SimLoop.ts` 內被呼叫,`HitDetector.ts` 未 import 任何 occlusion 相關模組。
- [x] 確認 `src/scene/scenes/placeholder-room.ts` 的 `propBounds: []` 未變(spider-shot 系列的遮擋判定恆不觸發,§0-2 讀碼結論的前提)。**成立**。
- [x] 確認 `docs/exec-plan/DECISIONS.md` GD-7 條目原文仍是「on-target = 準心射線 ∩ H1 hitbox(Box3)」,尚未被其他工作修改過。**部分修正**——該逐字句實際出處是 `CLAUDE.md §4`(「命中判定與 on-target 離線推導必須使用同一 AABB 來源…不得新增另一套閾值或尺寸常數,WP-23/GD-7」),非 `DECISIONS.md`(`DECISIONS.md` 的 GD-7 條目主題是 WP-18 追蹤指標定義,非 hitbox);語意/約束實質不變,T1 要改的是 `CLAUDE.md §4` 措辭,與計畫一致,不影響後續 task。
- [x] 確認 `docs/exec-plan/README.md` 目前最新已寫入的 GD 為 GD-24,GD-25 狀態仍是「stage8 暫用、未正式落帳」(§0-3 決策的數字依據)。**不成立,已修正**——`docs/exec-plan/README.md` 確實仍只寫到 GD-24;但 `DECISIONS.md` 本身 GD-25 已於 2026-08-26 隨 WP-45(stage9,非 stage8)T-exit 正式落帳為完整決議,非「暫用/未落帳」佔位。已更新本 WP `README.md` Constraints 段落與 `progress.md` D-46.2/Surprises 修正此認知落差;下一個可用號為 GD-26。結論(本 WP 延後入帳)不變。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 七項讀碼假設逐一覆核仍成立 | 本檔 Steps 勾選 + 對照現行檔案內容 —— 六項成立,第七項發現並修正 |
| ② | 未發現與 [README.md §0](README.md) 矛盾的新事實 | 發現 GD-25 狀態矛盾,已更新 README Constraints 段落 |

## Commit

本 task 隨 T0 讀碼覆核產生的文件修正(README.md Constraints、progress.md、task-checklist.md、本檔)獨立成一個 commit(entry gate 覆核發現並修正了實質矛盾,值得獨立記錄,不与 T1 合併)。
