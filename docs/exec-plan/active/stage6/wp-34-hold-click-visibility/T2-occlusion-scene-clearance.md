# T2 — Occlusion-aware `validateClearance` + 新 occlusion 場景內容

> Part of [WP-34 hold-click-visibility](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(occlusion-aware 政策選項①拍板);可與 T1 並行(不同檔案) |
| **Risk / Cplx** | Med / Med |
| **Touches** | `src/scene/clearance.ts`(additive)、新場景 `src/scene/scenes/*.ts` + `*.props.json` |
| **狀態** | 🟡 Implementation done; full `npm run test:ci` gate blocked by existing Playwright app-ready timeout(S-34.3,2026-08-19) |

## Objective

落地 [progress.md D-34.2](progress.md) 拍板的政策(選項①):新增 occlusion-aware 驗證模式,並建一個真正會遮蔽目標 emergence 前路徑的新場景,供 T3 的 `hold-click-v1` 使用。

## In scope

1. `src/scene/clearance.ts`:新增 `ClearanceOptions`([README §5](README.md))additive 參數:
   - `allowedOcclusionPropIds?: readonly string[]` —— 這些 prop 允許遮蔽 emergence 前的完整 envelope。
   - `exposedRestEnvelope?: TargetEnvelope` —— 曝光後靜止子範圍,必須對**全部** prop(含允許遮蔽的)零遮蔽。
   - 具體驗證流程:對 envelope 排除 `allowedOcclusionPropIds` 後跑既有邏輯(其餘 prop 仍要求零遮蔽);額外對 `exposedRestEnvelope` 跑一次全 prop 零遮蔽檢查(不排除任何 prop)。
2. 新場景(暫名 `peek-corridor`,OQ-S6-13 待拍板是否需要獨立 `clutterTier` 語意):
   - `src/scene/scenes/peek-corridor.props.json`:至少一個 prop 作為「遮蔽牆」,位置介於玩家走廊與目標 emergence 前 spawn 點之間。
   - 沿用既有 `gen-*-gltf.mjs` 生成模式,產生對應視覺方塊(零新資產授權疑慮,GD-9)。
   - `src/scene/scenes/peek-corridor.ts`:`SceneConfig` 組裝,對齊既有場景檔案結構(參考 `field-low.ts`)。

## Out of scope

- `visibilityDerivation.ts`(T1,不同檔案,可並行)。
- `hold-click-v1` drill config 本身(T3)。

## Steps

- [x] 設計 `ClearanceOptions` 的驗證流程(排除清單 + 曝光後範圍雙重檢查)。
- [x] 既有 `clearance.test.ts` 全部案例(既有三場景 + 既有 drill)跑一遍,確認零修改全綠(機械判準)。
- [x] 新增 `peek-corridor.props.json` + 生成腳本呼叫 + `peek-corridor.ts`。
- [x] 新場景搭配一個示範 drill(`targets.spawnArea` + `motion: 'linear'`)驗證:emergence 前 `allowedOcclusionPropIds` 遮蔽成立、曝光後 `exposedRestEnvelope` 零遮蔽成立。
- [x] 單元測試:`allowedOcclusionPropIds` 省略時逐位等同現行行為(既有 63+ drill 零回溯相容成本)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 既有 `clearance.test.ts` 零修改全綠 | `git diff` 顯示 `clearance.test.ts` 無變更 |
| ② | 新 occlusion 場景通過 occlusion-aware 驗證(emergence 前遮蔽成立 + 曝光後零遮蔽成立) | 新增測試綠 |
| ③ | `ClearanceOptions` 省略時逐位等同現行行為 | 既有測試 + 新負例測試綠 |
| ④ | 新場景資產零授權疑慮(程序化生成,非下載模型) | `ATTRIBUTIONS.md` 無需新增條目;code review 檢查點 |
| ⑤ | `npm run test:ci` 全綠 | 貼原始輸出到 progress.md |

## Commit

`feat(wp-34): T2 — occlusion-aware validateClearance + peek-corridor 場景(FR-F5)`
