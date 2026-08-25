# T2 — FR-G7 落地(依 T0 判定分岔)

> Part of [WP-41 seeded-counterbalance](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(§2② 判定結果決定本 task 走哪個分支) |
| **Risk / Cplx** | Low(關閉分支)~Med(採納分支,新增 seed 覆寫 + metadata 稽核) |
| **Touches** | 關閉分支:僅 `docs/`;採納分支:`src/session/sessionSchedule.ts` + 對應測試 |
| **狀態** | ⬜ 待開工(分支未定,待 T0) |

## Objective

依 T0(README §2②)的判定結果二選一執行:

- **分支 A(關閉)**:hold-click/hold-track/counterstrafe 三協定 + Spider Shot 皆判定「無值得做的區塊隨機化」→ 只在 `docs/operational/*.md` 記錄 FR-G7 的現況與關閉理由,不新增任何程式碼。
- **分支 B(採納 Spider Shot)**:Spider Shot 判定值得覆寫 → 新增 `buildSpiderShotOverrideSeed()` + `withOverriddenSpiderShotSeed()`,並確保匯出 metadata 反映實際覆寫值。

**執行前必須先讀 `progress.md` 的 `D-41.2`,確認走哪個分支,不得自行假設。**

## In scope

### 分支 A(關閉)

1. 在 `docs/operational/`(沿用既有 `analysis-*.md` 慣例,或於 README 已存在的相關文件新增一節)記錄:三協定 + Spider Shot 為何被判定無值得做的區塊隨機化,附讀碼證據(引用本 WP README §0 的行號)。
2. 更新 `progress.md` 的 Open Questions 狀態表,正式關閉 OQ-S7-1。

### 分支 B(採納 Spider Shot)

1. 在 `src/session/sessionSchedule.ts` 新增(additive,不動 T1 已交付的 `buildFamilyOrder`):
   - `buildSpiderShotOverrideSeed(participantId, sessionIndex): number`(純算術,比照 `pilotSeed()` 風格)。
   - `withOverriddenSpiderShotSeed(config: DrillConfig, seed: number): DrillConfig`(clone,只替換 `spiderShot.seed`,不修改傳入物件、不修改其餘欄位)。
2. 測試覆蓋:clone 後的 config 通過既有 `validateDrill()`;原始傳入 config 物件未被 mutate;覆寫值确实反映在回傳物件的 `spiderShot.seed`。
3. 在 `docs/operational/*.md` 記錄覆寫機制的契約(誰呼叫、何時呼叫、匯出 metadata 稽核要求)。

## Out of scope

- WP-42 `SessionRunner.ts` 實際呼叫 `withOverriddenSpiderShotSeed()` 並接線進 `loadDrillById()` 流程——那是 WP-42 T3 的職責,本 task 只交付函式本體。
- `src/drill/spider_shot_v1.ts` 本體的任何修改。

## Steps(依分支)

- [ ] 讀 `progress.md` 的 `D-41.2`,確認分支。
- [ ] (分支 A)撰寫文件記錄 + 關閉 OQ-S7-1。
- [ ] (分支 B)實作兩個函式 + 測試 + 文件契約。
- [ ] `npm run test:ci` 全綠(分支 B)或確認測試套件無新增異動(分支 A)。

## Definition of Done

| # | 條件(分支 A) | 判定方式 |
|---|---|---|
| ① | 文件記錄 FR-G7 關閉理由 + 讀碼證據 | 文件審閱 |
| ② | 零程式碼、零測試改動 | `git diff` 僅 `docs/` |

| # | 條件(分支 B) | 判定方式 |
|---|---|---|
| ① | `buildSpiderShotOverrideSeed`/`withOverriddenSpiderShotSeed` 純函式,不使用 `Math.random()`/`Date.now()` | 單元測試 + `rg` 覆核 |
| ② | clone 後的 config 通過 `validateDrill()`,原始物件未被 mutate | 單元測試 |
| ③ | `git diff` 對 `src/drill/spider_shot_v1.ts` 為空 | `git diff` 覆核 |
| ④ | 覆寫機制的匯出 metadata 稽核要求已記錄於契約文件 | 文件審閱 |

## Commit

- 分支 A:`docs(wp-41): T2 — FR-G7 判定關閉（記錄現況,不實作二次排程）`
- 分支 B:`feat(wp-41): T2 — Spider Shot peripheral seed 覆寫（additive,不動協定本體）`
