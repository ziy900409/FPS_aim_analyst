# T-exit — `analysis-assessment-contract.md` 定稿 + 文件對帳 + WP-33 收斂

> Part of [WP-33 assessment-contract](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2 + T3 |
| **Risk / Cplx** | Low / Low |
| **Touches** | `docs/operational/analysis-assessment-contract.md`(定稿)、[../README.md](../README.md)、[CONTEXT.md](../../../../../CONTEXT.md)、[DECISIONS.md](../../../DECISIONS.md)(視需要) |
| **狀態** | ✅ |

## Objective

把 T0~T3 的產出收斂成一份 WP-34~37 可以直接引用的定稿契約文件,並完成文件對帳,讓 stage6 的四條並行線(WP-34/35/36/37)可以安全 entry。

## In scope

1. `docs/operational/analysis-assessment-contract.md` 定稿:
   - §0 讀碼對帳(T0)
   - §1 七項契約 + 事件時間線欄位對照表(T0/T2)+ 相容鍵欄位定義表(T3)
   - §2 Assessment/Practice 五軸契約表(T0)
   - §3 驗收前置條件覆核:逐條列出 FR-F1~F4 對應本 WP 交付物的位置(型別/函式簽章 + 測試檔案),供 WP-34~37 T0 entry-gate 直接引用。
2. [../README.md](../README.md) §3:WP-33 狀態 ⬜ → ✅。
3. 若 T0~T3 期間發現任何偏離規劃期讀碼的重大決策(例如 OQ-S6-10/11 拍板結果影響到其他 WP 的既定假設),評估是否需要在 [DECISIONS.md](../../../DECISIONS.md) 新增 GD 編號;若無跨 WP 影響則只需留在本資料夾 `progress.md`。
4. [CONTEXT.md](../../../../../CONTEXT.md):新增本 WP 產出的正規術語(`AssessmentMode`、`CompatibilityKey`、`qualityGateStatus`、`sessionId`(推導,非儲存)等)。

## Out of scope

- WP-34~37 的 entry-gate 本身(各自 T0)。
- 驗收清單 F(`acceptance-stage-f.md`)本身的定稿——那是 WP-39 T-exit 的產出;本 task 只確保 WP-33 交付物本身可被驗收清單 F 引用。

## Steps

- [x] 彙整 T0~T3 的 progress.md 記錄,定稿 `analysis-assessment-contract.md` §0~§3。
- [x] 更新 [../README.md](../README.md) §3 WP-33 狀態為 ✅,並確認 §5 相依圖與實際交付一致(WP-33 完成即開放 WP-34/35/36/37 entry)。
- [x] 評估本 WP 的讀碼收斂(D-33.1/D-33.2)與 OQ-S6-10/11 拍板是否需要升為全域 GD;結論不新增 GD,回寫既有 GD-22 狀態列(見 [progress.md D-33.6](progress.md))。
- [x] 回寫 [CONTEXT.md](../../../../../CONTEXT.md) 新術語(§I,8 項)。
- [x] 執行 `npm run test:ci` 作為最終閘,貼原始輸出到 progress.md。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `analysis-assessment-contract.md` 四節全數定稿(無佔位段落殘留) | 文件檢查 |
| ② | [../README.md](../README.md) §3 WP-33 狀態翻 ✅ | diff 可見 |
| ③ | 文件對帳清單([README.md §8](README.md))全數打勾或明確記錄延後理由 | 逐項核對 |
| ④ | CONTEXT.md 新術語回寫完成 | diff 可見 |
| ⑤ | `npm run test:ci` 全綠(彙總 T0~T3 的全部新增測試) | 貼原始輸出到 progress.md |

## Commit

`docs(wp-33): T-exit — analysis-assessment-contract.md 定稿 + 文件對帳 + WP-33 收斂(開放 WP-34~37 entry)`
