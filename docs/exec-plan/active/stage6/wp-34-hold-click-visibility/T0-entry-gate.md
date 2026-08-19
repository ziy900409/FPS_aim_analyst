# T0 — 讀碼 spike:可見度計算候選方案評估 + occlusion-aware 政策拍板(零程式碼)

> Part of [WP-34 hold-click-visibility](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | — (獨立 spike,依 [DECISIONS.md](../../../DECISIONS.md) GD-22 決議,可提前於 WP-33 完成前執行) |
| **Risk / Cplx** | — / Low(讀碼調查,非實作) |
| **Touches** | 僅本 WP 文件(README/checklist/progress);**零程式碼** |
| **狀態** | ✅ 完成(2026-08-19) |

## Objective

在展開 T1~T3 之前,先回答一個會決定整個 WP-34 task 切分與估時的問題:「連續可見度時間線([../README.md §2.3(a)](../README.md) 列的三個候選)在這個 codebase 裡實際要花多少工?」以及一個政策問題:「遮蔽物驗證的既有不變式(全程零遮蔽)要怎麼跟 hold-click 的『刻意遮蔽』設計目標並存?」兩題都先想清楚,才不會像 WP-32 一樣讀碼後才發現整條隱藏鏈。

## In scope

### ① 三個可見度計算候選方案逐一讀碼評估

- 讀 [`src/scene/clearance.ts`](../../../../../src/scene/clearance.ts)(`segmentIntersectsAabb`/`sampleAabb`/`PropBound` 既有實作)。
- 讀 [`src/scene/eyePose.ts`](../../../../../src/scene/eyePose.ts) + [`src/metrics/eyeOrigin.ts`](../../../../../src/metrics/eyeOrigin.ts)(`eyeOriginForTick`/`resolveEyeOrigin` 既有純函式)。
- 讀 [`src/data/RingBuffer.ts`](../../../../../src/data/RingBuffer.ts)(`TickRecord.tx/ty/tz` 是否已記錄目標世界座標)。
- 讀 [`src/scene/SceneConfig.ts`](../../../../../src/scene/SceneConfig.ts) + 至少一份 `*.props.json`(`field-low.props.json`),確認 propBounds 是否有配套的視覺方塊生成管線(授權/資產成本)。
- 讀 `docs/operational/schema.md` 對 `meta.scene.eye` 的既有警告(render-interpolated 值不得進匯出),確認候選①(render 逐幀 raycast)的決定性風險是否成立。

### ② Occlusion 政策衝突讀碼

- 讀 [`field-low.props.json`](../../../../../src/scene/scenes/field-low.props.json) 的作者註解,確認既有場景是否刻意避開遮蔽。
- 讀 `clearance.test.ts` 確認 `validateClearance` 現行不變式的測試斷言範圍。

### ③ 產出並記錄

- [progress.md](progress.md) `D-34.1`:三候選逐一判定,附讀碼證據位置。
- [progress.md](progress.md) `D-34.2`:occlusion-aware 政策決議(選項①,使用者拍板)+ 兩條不變式。
- [README.md](README.md) §0/§1/§2:把 spike 結論與修正後 task 切分寫回。
- [../README.md](../README.md) §3/§6:WP-34 估時與 task 表更新(由本 spike 觸發)。

## Out of scope

- 任何 `src/` 程式碼變更。
- occlusion-aware `validateClearance` 的具體介面實作(留給 T2)。
- `visibleFraction` 演算法的精確步驟(留給 T1)。

## Steps

- [x] 讀碼四個候選相關既有模組(`clearance.ts`/`eyePose.ts`/`eyeOrigin.ts`/`RingBuffer.ts`/`SceneConfig.ts`),確認候選②所需元件是否已存在。
- [x] 確認候選①(render 逐幀 raycast)的決定性風險(對照 `schema.md` 既有警告),判定排除。
- [x] 讀 `field-low.props.json` 與 `clearance.test.ts`,確認 occlusion 政策衝突成立。
- [x] 產出 occlusion-aware 政策三選項,交使用者拍板(結果:選項①)。
- [x] 寫入 `progress.md` D-34.1/D-34.2、更新 `README.md` §0~§2、回頭更新 `../README.md` §3/§6。
- [x] 執行 `npm run test:ci` 取得證據(含與本 WP 無關的既有紅燈說明,見 `progress.md` S-34.1)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 三個可見度候選方案逐一有讀碼證據與判定 | `progress.md` D-34.1 存在,含檔案/行號引用 |
| ② | Occlusion-aware 政策拍板並記錄兩條不變式 | `progress.md` D-34.2 存在 |
| ③ | WP-34 README 與 stage6 README 皆已回寫修正後的 task 切分/估時 | 兩份 README 的 §6/§3 無「待 T0 產出」字樣殘留 |
| ④ | **零程式碼變更** | `git diff --stat` 只含 `docs/` 路徑 |
| ⑤ | `npm run test:ci` 證據已貼(含既有紅燈說明) | `progress.md` Progress 表有輸出摘要 + 根因排查記錄 |

## Commit

`docs(wp-34): T0 — 可見度計算候選方案 spike(候選②拍板)+ occlusion-aware clearance 政策(選項①)`
