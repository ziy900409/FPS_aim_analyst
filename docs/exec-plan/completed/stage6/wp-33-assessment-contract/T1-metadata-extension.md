# T1 — `DrillConfig.mode` + `Meta.assessment` additive 型別/驗證

> Part of [WP-33 assessment-contract](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0 |
| **Risk / Cplx** | Low / Low |
| **Touches** | `src/drill/DrillConfig.ts`、`src/drill/assessmentContract.ts`(新)、`src/drill/schema.ts`、`src/data/metadata.ts` |
| **狀態** | ✅ 完成(2026-08-19) |

## Objective

把 T0 凍結的「`DrillConfig.mode` 與 `Meta.assessment` 是本 WP 唯二真正新增的欄位」落地成可驗證的 TypeScript 型別 + 執行期驗證,且不動任何既有欄位的語意。

## In scope

1. `src/drill/assessmentContract.ts`(新檔):`export type AssessmentMode = 'assessment' | 'practice';`。
2. `src/drill/DrillConfig.ts`:`DrillConfig` 新增 `mode?: AssessmentMode`(additive,省略 = 既有行為)。
3. `src/drill/schema.ts`:`validateDrill` 新增 `mode` 驗證——存在時必須是 `'assessment'|'practice'` 之一;`mode==='assessment'` 時必須同時提供 `sequence.seed`(FR-F1 隨機性軸的存在性檢查,不驗證 schedule 內容,見 README §2 契約⑤)。
4. `src/data/metadata.ts`:
   - 新增 `export interface AssessmentMeta { protocolVersion: string; assessmentFeedbackPolicy: 'minimal-end-of-block' | 'unrestricted'; }`。
   - `Meta`/`CollectMetaArgs` 新增 `assessment?: AssessmentMeta`(additive,跟隨既有 `session?`/`protocol?` 的相同模式:`requireAssessmentMeta()` guard + `collectMeta()` 內 spread 條件式組裝)。
   - **不**新增 `gameMovementProfile`/`sessionId`/`recommendationVersion`/`qualityGateStatus` 欄位(T0 D-33.1/D-33.2 已凍結)。

## Out of scope

- `checkCompatibility`/`checkQualityGate`(T3)。
- 事件時間線型別(T2)。
- `DrillRunner`/`main.ts` 對 `mode` 的行為分支(五軸契約的難度/回饋/歷史比較/重試由各下游 WP 落地,本 task 只驗證存在性)。

## Steps

- [ ] 新增 `src/drill/assessmentContract.ts`,定義 `AssessmentMode`。
- [ ] `DrillConfig` 加 `mode?: AssessmentMode`;確認既有 16 個呼叫端(`tracking_br_v1.ts`/`main.ts`/`fpsTestHarness.ts` 等)不需要改動(純型別擴充)。
- [ ] `schema.ts` 的 `validateDrill` 加 `mode` 驗證分支 + `mode==='assessment'` 缺 `sequence.seed` 時 throw。
- [ ] `metadata.ts` 加 `AssessmentMeta` 型別 + `requireAssessmentMeta()` guard + `Meta`/`CollectMetaArgs` additive 欄位 + `collectMeta()` 組裝分支。
- [ ] 單元測試:
  - `schema.ts`:省略 `mode` → 通過(既有行為);`mode:'practice'` 無 seed → 通過;`mode:'assessment'` 無 seed → 拋錯;`mode:'assessment'` 有 seed → 通過;非法字串 → 拋錯。
  - `metadata.ts`:省略 `assessment` → `collectMeta()` 輸出不含該欄位(逐位等同現行);提供合法 `assessment` → 正確 round-trip;`assessmentFeedbackPolicy` 非法值 → 拋錯。
- [ ] 確認既有 `DrillRunner.test.ts`/`clearance.test.ts`/`metadata.test.ts`/`export.test.ts` **零修改**全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `AssessmentMode`/`DrillConfig.mode`/`AssessmentMeta` 型別落地 | `tsc --noEmit` 通過 |
| ② | `mode` 存在性驗證(assessment 需 seed)綠 | 新增單元測試 5 案例全綠 |
| ③ | `Meta.assessment` additive round-trip 綠 | 新增單元測試覆蓋省略/合法/非法三案例 |
| ④ | **既有測試零修改全綠** | `DrillRunner.test.ts`/`clearance.test.ts`/`metadata.test.ts`/`export.test.ts` 等既有測試檔 `git diff` 為空,執行結果全綠 |
| ⑤ | 未新增 `gameMovementProfile`/`sessionId`/`recommendationVersion`/`qualityGateStatus` 欄位 | code review 檢查點;`grep` `Meta`/`AssessmentMeta` 定義處確認 |
| ⑥ | `npm run test:ci` 全綠 | 貼原始輸出到 progress.md |

## Commit

`feat(wp-33): T1 — DrillConfig.mode + Meta.assessment additive 型別/驗證(zero engine logic,既有匯出零回溯相容成本)`
