# T0 — entry-gate:覆核讀碼發現 + FR-G7 判定拍板

> Part of [WP-41 seeded-counterbalance](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | 無 |
| **Risk / Cplx** | Med(無新程式碼,但要正式拍板本 WP 唯一的範圍未知數 FR-G7) |
| **Touches** | 無程式碼;決策記錄於 `progress.md` |
| **狀態** | ⬜ 待開工 |

## Objective

在動筆前重新覆核 [README.md §0](README.md) 的讀碼發現在當下 `src/` 上仍然成立(尤其是四個協定的 `sequence.seed`/`spiderShot.seed`、`TargetManager.ts` 的 RNG 消費點、`compatibilityKey.ts` 的欄位清單,若在規劃後被其他並行 WP 改動);正式拍板 §2②(FR-G7 三協定關閉、Spider Shot 分支去留)。零程式碼,零測試異動。

## In scope

1. **重新覆核 §0 表格的行號與程式碼片段**:`hold_click_v1.ts`/`hold_track_v1.ts`/`counterstrafe_reversal_v1.ts`/`spider_shot_v1.ts` 的 `sequence`/`spiderShot` 欄位、`TargetManager.ts` 的 `usesSeededSpawn`/`sampleDelayMs`/`sampleSpawnPose`/`sampleSpiderShotPose`、`compatibilityKey.ts` 的 `CompatibilityKey` 欄位清單——若行號或欄位已變動,更新 README §0/§5 對應內容並記錄差異。
2. **拍板 hold-click/hold-track/counterstrafe 三協定關閉**:確認三者的 `spawnArea`/`spawnDelayMsRange` 仍是退化值(min=max 或未提供),沒有新增任何多層級條件格。若讀碼發現有並行 WP(WP-39 之後的維護性修改)已經改變這個現況,必須重新評估,不得直接照抄 README 結論。
3. **拍板 Spider Shot 分支去留**:權衡「新增 seed 覆寫函式」的複雜度(clone config、schema 驗證、匯出 metadata 同步)是否在本 WP 1–2d 估時內值得做;若判定值得,記錄粗略工時;若判定不值得,記錄理由並正式關閉 FR-G7 剩餘範圍。
4. **確認 `buildFamilyOrder` 的 Latin-square 輪轉設計方向(§2①)** 仍然是合理的預設實作路線,若讀碼發現有更適合的既有先例可沿用,記錄調整。

## Out of scope

- 任何程式碼實作(T1/T2)。
- `src/drill/*.ts` 四個協定本體的任何修改。

## Steps

- [ ] 重新讀取 `src/drill/hold_click_v1.ts`、`hold_track_v1.ts`、`counterstrafe_reversal_v1.ts`、`spider_shot_v1.ts` 的 `sequence`/`spiderShot`/`targets` 欄位,確認 README §0-1/§0-2/§0-3 逐行仍成立。
- [ ] 重新讀取 `src/sim/TargetManager.ts` 的 RNG 消費點(`usesSeededSpawn`/`sampleDelayMs`/`sampleSpawnPose`/`sampleSpiderShotPose`),確認 §0-3 的「三協定無可觀測隨機性、Spider Shot 方位角是唯一真實維度」結論仍成立。
- [ ] 重新讀取 `src/metrics/compatibilityKey.ts` 的 `CompatibilityKey` 欄位清單,確認 seed 覆寫不影響相容性判定(§0-4)。
- [ ] 寫決策記錄 `D-41.1`(FR-G7 三協定關閉拍板)、`D-41.2`(Spider Shot 分支去留拍板)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | README §0 讀碼發現已重新覆核(或明確記錄差異) | progress.md 記錄核對結果 |
| ② | FR-G7 三協定關閉 + Spider Shot 分支去留已拍板 | Decision Log D-41.1/D-41.2 |
| ③ | 零程式碼、零測試改動 | `git diff` 為空(僅 `docs/`) |

## Commit

`docs(wp-41): T0 — entry-gate(讀碼覆核 + FR-G7 判定拍板)`
