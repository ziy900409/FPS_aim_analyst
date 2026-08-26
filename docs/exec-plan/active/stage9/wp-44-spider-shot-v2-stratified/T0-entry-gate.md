# T0 — entry gate:覆核讀碼假設,無程式碼

> Part of [WP-44](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | 無 |
| **Risk / Cplx** | Low / Low |
| **Touches** | 無程式碼;僅覆核 [README.md §0](README.md#0-讀碼對帳已於brainstorming對話完成摘要見-readme)/[../README.md §0](../README.md#0-背景與現況讀碼2026-08-26-對話中確認) |
| **狀態** | ✅ |

## Objective

在動 T1 之前,把 brainstorming 對話中做過的讀碼結論(§0 五項)實際對照一次現行程式碼,確認假設仍成立——尤其確認 `spider-shot-v1` 沒有在對話之後被其他工作變更過。

## Steps

- [x] 確認 `src/drill/spider_shot_v1.ts` 仍是 `centerDistanceU=8`、`angularRadiusDegRange=[15,15]`、`distanceURange=[8,8]`(WP-39 凍結值未被改動)。
- [x] 確認 `src/sim/TargetManager.ts` 的 `sampleSpiderShotPose()` 仍是對話中讀到的形狀(azimuth → radius → distance 依序 `randomFloat`,無 spawn delay 分支介入 spiderShot 路徑)。
- [x] 確認 `main.ts:160` 的 `spider-shot-v1` 註冊仍是 `sceneId: 'placeholder-room'`(KI-011 修法)。
- [x] 確認 `spiderShotConditions.ts`/`spiderShotMetrics.ts` 仍只消費匯出資料(`ExportPayload`),沒有任何路徑讀 `DrillConfig.spiderShot` 本身。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 四項讀碼假設逐一覆核仍成立 | 本檔 Steps 勾選 + 對照現行檔案內容 |
| ② | 未發現與 [README.md §0](README.md) 矛盾的新事實 | 若有矛盾,先更新 README §0 再繼續 T1 |

## Commit

無程式碼變更;本 task 於 T1 commit 中一併記錄(entry gate 純讀碼確認,比照 wp-40/wp-43 T0 慣例可與下一個 task 合併 commit 訊息，若需要獨立記錄則不強制單獨 commit)。
