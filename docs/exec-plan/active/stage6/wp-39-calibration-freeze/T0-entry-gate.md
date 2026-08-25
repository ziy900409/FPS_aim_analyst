# T0 — entry-gate:驗上游 exit + pilot-candidate 清單彙整

> Part of [WP-39 calibration-freeze](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | WP-33+34+35+36+37+38 全部 T-exit |
| **Risk / Cplx** | Low / Low(**進度阻塞風險 High**——見下) |
| **Touches** | 無程式碼;產出決策記錄於 `progress.md` + 本 WP README §7 覆核 |
| **狀態** | ⬜ |

## Objective

機械驗證 WP-33~38 六個上游 WP 是否全部 T-exit;**現況(2026-08-25)WP-38 僅 T0~T2 完成,T3/T-exit 未交付**,故本 task 的第一步就是確認這個阻塞是否已解除。若未解除,本 task 在「記錄阻塞狀態」後即結束,不得跳過阻塞繼續 T1。若已解除,則彙整六個測試家族程式碼中所有 `pilot candidate`/`WP-39` 標記成一份權威清單(README §0 已列出讀碼結果,本 task 需要逐條在當下程式碼重新 grep 確認未被其他並行修改推翻),並拍板 OQ-S6-24/OQ-S6-25。

## In scope

1. **驗 WP-33~38 T-exit**:讀各 WP 的 `task-checklist.md`,確認全部列為 ✅。**特別檢查 [wp-38 task-checklist.md](../wp-38-diagnosis-recommendation/task-checklist.md) 的 T3/T-exit 兩列**;若非 ✅,記錄阻塞原因與預期解除條件,本 task 到此為止。
2. **重新 grep 六個 pilot-candidate 標記**:`grep -rn "pilot candidate\|WP-39" src/` 確認 README §0 讀碼發現的位置(`hold_track_v1.ts`、`spider_shot_v1.ts`、`diagnosisRules.ts`)未被其他並行工作改動出乎意料的形狀;若新增了其他標記(例如 WP-38 T3 落地時新增的 `windowSize`/`minN` 具名候選常數),一併收錄進清單。
3. **拍板 OQ-S6-24**:`diagnosisRules.ts` 的 `PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS` 是否需要回頭補登 stage6 README §7,或直接在本 WP 收斂即可(README 建議後者)。
4. **拍板 OQ-S6-25**:`counterstrafe-reversal-v1` 的 `holdDurationMs` 是單一固定值還是分層條件格(讀 `counterstrafe_reversal_v1.ts` 現況與 [analysis-counterstrafe.md](../../../../operational/analysis-counterstrafe.md) 是否有分層線索)。
5. **確認 pilot seed roster 候選範圍不與既有四個協定的 assessment seed 相撞**:grep 既有 `*_v1.ts` 的 `seed:` 欄位,列出目前已使用區間,供 T1 選定 `PILOT_SEED_ROSTER_START`。

## Out of scope

- 任何程式碼實作(T1/T2/T3)。
- 代替 WP-38 完成 T3/T-exit。

## Steps

- [ ] 讀 [wp-33](../wp-33-assessment-contract/task-checklist.md)/[wp-34](../wp-34-hold-click-visibility/task-checklist.md)/[wp-35](../wp-35-hold-track/task-checklist.md)/[wp-36](../wp-36-spider-shot/task-checklist.md)/[wp-37](../wp-37-counterstrafe-protocols/task-checklist.md)/[wp-38](../wp-38-diagnosis-recommendation/task-checklist.md) 六份 task-checklist,記錄逐一狀態。
- [ ] 若 WP-38 T3/T-exit 未 ✅:記錄阻塞於 progress.md,**本 task 到此停止**,待重新排程。
- [ ] 若全部 ✅:grep 六個 pilot-candidate 標記,對照 README §0 逐條確認仍成立。
- [ ] 拍板 OQ-S6-24、OQ-S6-25,寫決策記錄(D-39.1)。
- [ ] 列出既有四個協定的 assessment seed 區間,供 T1 選定 pilot seed roster。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | WP-33~38 全部 T-exit 已驗證(或明確記錄阻塞) | progress.md 記錄逐一狀態 |
| ② | 六個 pilot-candidate 標記重新覆核 | progress.md 記錄 grep 結果 |
| ③ | OQ-S6-24/25 拍板 | Decision Log D-39.1 |
| ④ | Pilot seed roster 候選區間列出 | progress.md 記錄 |
| ⑤ | 零程式碼、零測試改動 | `git diff` 為空(僅 `docs/`) |

## Commit

`docs(wp-39): T0 — entry-gate(上游 T-exit 覆核 + pilot-candidate 清單彙整)`
