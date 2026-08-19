# T0 — entry gate(上游複驗 + 讀碼對帳凍結 + 七項契約凍結;無程式碼)

> Part of [WP-33 assessment-contract](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | M4 ✅(schema v2)· WP-20 ✅(`meta.session`/`meta.protocol`/`meta.display` additive 慣例) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 僅本 WP 文件(README/checklist/progress)+ `docs/operational/analysis-assessment-contract.md`(新,起稿);**零程式碼** |
| **狀態** | ✅ 完成(2026-08-19) |

## Objective

把 README §0.1 的讀碼對帳與 §2 的七項契約從「規劃期推論」轉成「T0 覆核後可稽核的凍結決議」。本 task 不寫任何 TypeScript——因為 T1~T3 的正確性完全建立在「`gameMovementProfile`/`sessionId`/`recommendationVersion` 到底該不該是新欄位」這幾個問題先有答案上;若不先凍結,T1 很可能順手把六個 FR-F2 欄位全部字面翻譯成新增欄位,製造 C-D4 違規。

## In scope

### ① 上游複驗(只引用,不重跑)

| 上游 | 引用範圍 | 證據位置 |
|---|---|---|
| **M4**(schema v2) | `SCHEMA_VERSION = 2`、`Meta`/`CollectMetaArgs` 既有 additive 慣例(逐欄位皆 `?:` 選填 + spread 條件式組裝) | [src/data/metadata.ts](../../../../../src/data/metadata.ts) |
| **WP-20** | `meta.session`(`SessionMeta`)、`meta.protocol`(`ProtocolMeta`)、`meta.display` 的既有 additive 落地模式;`pilot-protocol-stage3.md` 的 `protocolId`/`conditionIndex`/`conditionLabel` 實際用法範例 | [docs/operational/schema.md](../../../../operational/schema.md) · [docs/operational/pilot-protocol-stage3.md](../../../../operational/pilot-protocol-stage3.md) |

### ② 讀碼對帳覆核(README §0.1 五項,逐項覆核是否成立)

- 覆核 `Meta.movementModel` 現行型別與 `schema.md` 對它的既有敘述,確認 §0.1(0-1)的「`gameMovementProfile` = 既有欄位」判定成立。
- 覆核 `meta.protocol` 三欄位的既有用途(引 `pilot-protocol-stage3.md` 具體範例),確認 §0.1(0-2)的「不同構念,不共用物件」判定成立。
- 覆核 `SessionMeta` 現有欄位,確認 §0.1(0-3)的「`sessionId` 無既有儲存欄位」屬實。
- 記錄 §0.1(0-4)的「`recommendationVersion`/`qualityGateStatus` 延後到 WP-38」邊界決策,確認未與 stage6 README FR-F2 字面矛盾(若矛盾,本 task 需要在 Decision Log 說明偏離理由,不得默默改)。
- 覆核 `src/` 對 Assessment/Practice 概念零命中(S-33.1),確認 FR-F1 五軸契約在本 repo 無既有型別可延伸。

### ③ 七項契約逐條寫入 Decision Log(對應 README §2 ①~⑦)

在 [progress.md](progress.md) 新增 `D-33.2`,把 README §2 的七項契約(`Meta.assessment` 獨立區塊 / `gameMovementProfile` 不新增 / `sessionId` 推導不落地 / `recommendationVersion`+`qualityGateStatus` 不進 export meta / 五軸契約表 / 事件時間線同名禁改語意 / 相容鍵九欄位封閉)逐條列為「事後只能升版,不得原地改」。

### ④ `analysis-assessment-contract.md` 起稿

新增 `docs/operational/analysis-assessment-contract.md`,至少含:

- §0 讀碼對帳表(從 README §0.1 搬入,含證據位置連結)。
- §1 七項契約(從 README §2 搬入,T1~T3 落地時逐條補「TS 實作位置」欄)。
- §2 Assessment/Practice 五軸契約表(FR-F1)。
- §3(佔位,T-exit 補)驗收清單 F 前置條件覆核記錄。

## Out of scope

- 任何 `src/` 程式碼變更(T1 起)。
- WP-34~38 的欄位落點決策(各自 T0)。
- OQ-S6-10/11 的實際拍板(留給 T3,本 task 只需確認它們已開帳)。

## Steps

- [x] 覆核 M4/WP-20 兩個上游的既有 additive 慣例與具體型別,記錄證據位置(不重跑既有測試)。
- [x] 逐項覆核 README §0.1 五列讀碼對帳,若有出入在 progress.md 記新 Decision 並回頭修 README §0.1(不得默默改而不留痕)。
- [x] 把 README §2 七項契約寫入 progress.md Decision Log `D-33.2`,標注「事後只能升版重跑」。
- [x] 起稿 `docs/operational/analysis-assessment-contract.md`(§0/§1/§2,§3 佔位)。
- [x] 確認 OQ-S6-10/OQ-S6-11 已在 README §7 開帳(owner/deadline/未決影響齊全)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 兩個上游覆核完成 | progress.md 有引用段落 + 證據位置 |
| ② | §0.1 五列讀碼對帳逐項覆核,無未說明的出入 | progress.md `D-33.1` 覆核註記或新增 `D-33.n` 說明偏離 |
| ③ | 七項契約凍結進 Decision Log,含「事後只能升版」字樣 | `D-33.2` 存在且逐條列出 |
| ④ | `analysis-assessment-contract.md` 起稿完成(§0/§1/§2) | 檔案存在,三節有內容(§3 允許佔位) |
| ⑤ | **零程式碼變更** | `git diff --stat` 只含 `docs/` 路徑;`src/` 零 diff |

## Commit

`docs(wp-33): T0 entry gate — 讀碼對帳凍結(gameMovementProfile/sessionId/recommendationVersion 落點)+ 七項契約 pre-registration + analysis-assessment-contract.md 起稿`
