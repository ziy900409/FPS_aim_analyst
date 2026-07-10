# T2 — br-field 場景上線(SceneConfig + 淨空 + perf + 跨場景決定性;零引擎碼)

> Part of [WP-26 br-scene-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(資產)+ WP-23 M11(遠距檔位定案) |
| **Risk / Cplx** | Med / Low(機制全部既有——本 task 是「換場景零引擎碼」承諾的第三次驗證) |
| **Touches** | ADD br-field SceneConfig(資料);MODIFY `src/main.ts`(場景選單掛載,比照 field-low/urban-high);測試(淨空/決定性/perf 皆沿既有模式) |
| **狀態** | ⬜ |

## Objective

`br-field` 成為可切換場景(FR-E11 後半):SceneConfig 資料 + 選單掛載 +
淨空驗證(含 WP-23 遠距走廊)+ render 負載驗證 + 跨場景 sim 決定性——
**全程零引擎碼**(做不到 = 機制缺口,停手記 DECISIONS)。

## In scope

- SceneConfig:`sceneId: 'br-field'`(中性命名)、`assetPackVersion`、
  `clutterTier`(OQ-26.1 決議)、asset URL + displayScale、propBounds(T1 同源)、
  `playerCorridor`;`validateScene` 通過。
- 選單掛載 + `meta.scene` 自動生效(既有機制)。
- **淨空驗證**:`tracking_longrange_v1` × br-field 通過 `validateClearance`
  (遠距走廊 + 運動包絡);對抗性 fixture(在走廊內故意放 prop 的變體 config → 拒載
  且指名 prop)。
- **perf 驗證**(沿 WP-19 T5 模式):br-field + 移動目標 + tracer 下 sim 128Hz
  不掉 tick;frame-time 分佈記錄與 field-low 對比;p95 vs 效能地板(8.33ms)證據。
- **跨場景決定性**:同輸入序列 br-field vs 佔位房間 sim 狀態逐位一致
  (收編既有跨場景回歸參數化,零新機制)。

## Out of scope

- drill/protocol(T3);資產修改(回 T1 迭代);引擎改動(**紅線**)。

## Steps

- [ ] SceneConfig + validateScene 測試 + 選單掛載。
- [ ] 淨空驗證(遠距 drill 通過 + 對抗性拒載)測試。
- [ ] perf 證據(frame log 對比表)記 progress。
- [ ] 跨場景決定性收編 + 既有 baseline 零重錄。
- [ ] 手動 smoke(切到 br-field、視覺/尺度/準心置中)記 progress。
- [ ] `npm run test:ci` exit 0。

## Definition of Done

- 淨空(通過 + 拒載)綠;perf 對比在地板內;跨場景決定性綠 + baseline 零重錄;
  `git diff` 中引擎碼(`src/` 除 main.ts 掛載與 config 資料外)零改動;
  `test:ci` exit 0。

## Commit

`feat(wp-26): T2 br-field 場景上線(SceneConfig/淨空/perf/跨場景決定性;零引擎碼)`
