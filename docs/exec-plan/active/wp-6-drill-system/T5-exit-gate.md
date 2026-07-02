# T5 / T-exit — Exit gate

> Part of [WP-6 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Low / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)；docs only |
| **Status** | ✅ DONE（2026-07-02） |

## Objective
驗證 F4 整體綠燈、map PLAN WP-6 驗收、更新索引、交棒 WP-7（記錄完整 drill）/ WP-8（結果頁 + 換 drill）。

## Steps
- [x] `npx vitest run` 綠燈（schema/loader/lifecycle + 決定性回歸）：17 files / 135 tests passed。
- [x] `npx tsc --noEmit` exit 0。
- [x] 整合驗：`counterstrafe_ad_v1.json` 可經 `loadDrill` 驅動 `createTargetManager` 跑滿 20 個 L/R 交替目標；第二個 config 換 count/alternation 即換 drill，零引擎改動。UI 手動開始/重來接線仍屬 WP-8。
- [x] map 下方 4 項驗收 → 證據；勾選。
- [x] 翻 [頂層索引](../../README.md) §2 WP-6 ✅。
- [x] progress.md 寫 `Outcomes & Retrospective`（F4 解耦證明：第二個 config 換 drill）。
- [x] 本機證據已記錄於本檔與 [progress.md](progress.md)；未建立 PR。

## Acceptance criteria（PLAN WP-6 / F4）→ evidence
- [x] `DrillConfig` schema（型別 + 範例 JSON）→ T1：`src/drill/DrillConfig.ts` + `src/drill/schema.ts` + schema tests。
- [x] 換 config 即換 drill（零引擎改動）→ T2：`TargetManager.test.ts` 覆蓋 `count=2,LR` 與 `count=4,RL` 兩 config。
- [x] 1 個完整 counter-strafe drill 可玩 → T3：`drills/counterstrafe_ad_v1.json` + `counterstrafe_ad_v1.test.ts` 跑滿 20 target。
- [x] drill 生命週期完整 → T4：`DrillRunner.test.ts` 覆蓋 idle/countdown/running/ended/restart。

## Definition of Done
- 4 項驗收勾選有證據；頂層索引 WP-6 ✅；交棒 note 指向 WP-7 / WP-8。

## Commit
`docs(wp-6): exit gate — F4 驗收 map + 頂層索引狀態 + 交棒 WP-7/8`
