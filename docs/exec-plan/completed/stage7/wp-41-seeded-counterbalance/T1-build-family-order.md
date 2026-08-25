# T1 — `sessionSchedule.ts`:`TestFamilyId` + `buildFamilyOrder()`

> Part of [WP-41 seeded-counterbalance](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(概念上;實作本身不需要 T0 判定結果,可並行草擬) |
| **Risk / Cplx** | Low(零協定依賴的純函式) |
| **Touches** | 新增 `src/session/sessionSchedule.ts` + `sessionSchedule.test.ts` |
| **狀態** | ✅ 已完成（2026-08-25） |

## Objective

交付 FR-G6:新增 `TEST_FAMILY_IDS`/`TestFamilyId`(封閉四家族詞彙表)與 `buildFamilyOrder(participantId, sessionIndex)`——決定性 Latin-square 輪轉,同一參與者跨 `sessionIndex` 走完 4 種輪轉位,不同參與者因確定性雜湊起點不同而錯開順序。禁用 `Math.random()`/`Date.now()`。

## In scope

1. 新增 `src/session/sessionSchedule.ts`:
   - `export const TEST_FAMILY_IDS = ['hold-click', 'hold-track', 'spider-shot', 'counterstrafe'] as const;`
   - `export type TestFamilyId = (typeof TEST_FAMILY_IDS)[number];`
   - 一個確定性字串雜湊函式(內部,不 export;例如 FNV-1a 或簡單字元碼加總 mod 4),把 `participantId` 映射到 `[0, 4)` 的起始輪轉位。
   - `export function buildFamilyOrder(participantId: string, sessionIndex: number): readonly TestFamilyId[]`:回傳對 `TEST_FAMILY_IDS` 做 `(start + sessionIndex) mod 4` cyclic rotate 的結果。
2. 新增 `src/session/sessionSchedule.test.ts`:覆蓋 DoD 表列的所有情境。

## Out of scope

- Spider Shot seed 覆寫(T2,依 T0 判定)。
- `src/drill/*.ts`、`TargetManager.ts`、`main.ts` 的任何修改——本 task 純新增獨立模組,零接線(WP-42 T3 才接線消費)。

## Steps

- [x] 新增 `TEST_FAMILY_IDS`/`TestFamilyId`。
- [x] 實作確定性字串雜湊(純算術,不使用 `crypto`/外部套件)。
- [x] 實作 `buildFamilyOrder()`。
- [x] 撰寫決定性測試(見 DoD)。
- [x] `npm run test:ci` 全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 同一 `participantId` + `sessionIndex` 兩次呼叫結果逐位相等 | 單元測試 |
| ② | 同一 `participantId`,`sessionIndex = 0/1/2/3` 產生 4 種不同排列,且每個家族在每個位置各出現一次(Latin-square 性質) | 單元測試 |
| ③ | `sessionIndex = 4/5/6/7` 分別與 `0/1/2/3` 產生相同排列(週期性 wrap,任意非負整數合法) | 單元測試(對應 README §3 失效模式表第四項) |
| ④ | 不同 `participantId`、相同 `sessionIndex = 0` 至少在一組測試 fixture 上產生不同排列 | 單元測試 |
| ⑤ | 回傳值恆為 `TEST_FAMILY_IDS` 的排列(無重複、無遺漏) | 單元測試,對任意合成輸入斷言 `new Set(result).size === 4` |
| ⑥ | `rg "Math.random\|Date.now" src/session/sessionSchedule.ts` 零命中 | CI/手動檢查 |
| ⑦ | `git diff` 對 `src/drill/*.ts`、`src/sim/TargetManager.ts`、`src/main.ts` 為空 | `git diff` 覆核 |

## Commit

`feat(wp-41): T1 — sessionSchedule.ts buildFamilyOrder（Latin-square 輪轉）`
