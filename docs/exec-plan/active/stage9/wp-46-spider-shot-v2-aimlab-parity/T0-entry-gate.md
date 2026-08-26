# T0 — entry gate:覆核讀碼假設,無程式碼

> Part of [WP-46](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | 無 |
| **Risk / Cplx** | Low / Low |
| **Touches** | 無程式碼;僅覆核 [README.md §0](README.md#0-讀碼對帳brainstorming-對話2026-08-26) |
| **狀態** | ⬜ |

## Objective

在動 T1 之前,把 brainstorming 對話中做過的讀碼結論(§0 六項)實際對照一次現行程式碼,確認假設仍成立——尤其確認 WP-44/WP-45 交付後 `TargetManager.ts`/`HitDetector.ts`/`spider_shot_v2.ts`/`DECISIONS.md` 沒有被其他工作變更過。

## Steps

- [ ] 確認 `src/sim/TargetManager.ts` 的 `sampleSpiderShotPose()`/`markKilled()` 仍是 WP-44 交付的形狀(center↔peripheral 交替、`spiderZoneQueue` 12 格佇列)。
- [ ] 確認 `src/drill/spider_shot_v2.ts` 仍是 WP-44 交付的候選值(`angularRadiusDegRange=[10,25]`、`grid:{4,3}`、seed `260826`),尚未被其他工作改動。
- [ ] 確認 `src/sim/HitDetector.ts` 目前仍只有 box(`Box3`)相交路徑,`raycastWithRay` 簽名未變。
- [ ] 確認 `src/loop/SimLoop.ts` 的 WP-45 `hitscanOcclusion` 分支(`firstBlockingIntersection`)仍是命中判定**之後**的獨立二次檢查,不在 `HitDetector.raycastWithRay` 內部——確認新增 sphere 分支不會與其交錯。
- [ ] 確認 `src/scene/scenes/placeholder-room.ts` 的 `propBounds: []` 未變(spider-shot 系列的遮擋判定恆不觸發,§0-2 讀碼結論的前提)。
- [ ] 確認 `docs/exec-plan/DECISIONS.md` GD-7 條目原文仍是「on-target = 準心射線 ∩ H1 hitbox(Box3)」,尚未被其他工作修改過。
- [ ] 確認 `docs/exec-plan/README.md` 目前最新已寫入的 GD 為 GD-24,GD-25 狀態仍是「stage8 暫用、未正式落帳」(§0-3 決策的數字依據)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 七項讀碼假設逐一覆核仍成立 | 本檔 Steps 勾選 + 對照現行檔案內容 |
| ② | 未發現與 [README.md §0](README.md) 矛盾的新事實 | 若有矛盾,先更新 README §0 再繼續 T1 |

## Commit

無程式碼變更;本 task 於 T1 commit 中一併記錄(entry gate 純讀碼確認,比照 wp-44/wp-45 T0 慣例可與下一個 task 合併 commit 訊息,若需要獨立記錄則不強制單獨 commit)。
