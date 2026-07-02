# T1 — DrillConfig schema（型別 + 驗證）

> Part of [WP-6 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Low / Med |
| **Touches** | NEW `src/drill/DrillConfig.ts`、`src/drill/schema.ts`（驗證） |
| **Status** | ✅ DONE（2026-07-02） |

## Objective
定義 `DrillConfig` TS 型別與執行期驗證（JSON Schema 或手寫 guard），涵蓋目標數/位置/時序/交替/結束條件（FR-6.1，OQ-6.1）。

## In scope
- `DrillConfig` 型別（drillId/targets/sequence/timing/endCondition）。
- `validateDrill(json): DrillConfig`（必填 + 型別 + 範圍檢查）。

## Out of scope
- 驅動 TargetManager（→ T2）；範例檔（→ T3）；生命週期（→ T4）。

## Design notes
- `drillId` 對齊匯出 metadata（附錄 C `"drillId": "counterstrafe_ad_v1"`）。
- 位置用 L/R 槽位 + distance（OQ-6.2），不放絕對座標。
- 驗證失敗 throw 帶欄位訊息（OQ-6.4）。

## Steps
- [x] 建 `DrillConfig.ts` 型別（reuse `state/types.ts` 的 `TargetMotion`/`Vec3`,不重複定義）。
- [x] 建 `schema.ts`：`validateDrill`（缺欄/型別/範圍;手寫 guard,零依賴)。
- [x] Vitest：合法 config 通過；缺 drillId/負目標數/未知 alternation → 明確 throw（12 tests）。
- [x] `vitest run`（111 passed）+ `tsc --noEmit` 綠燈。

## Definition of Done
- [x] 型別完整、驗證涵蓋必填/型別/範圍；失敗訊息可定位欄位（`DrillConfig 驗證失敗: <path> ...`）。

## Commit
`feat(wp-6): DrillConfig 型別 + 驗證 schema（FR-6.1）`
