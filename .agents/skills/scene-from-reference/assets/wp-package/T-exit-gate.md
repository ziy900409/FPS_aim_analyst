# T-exit — exit-gate:`<scene-id>` 四項證據宣告

> Part of [WP-NN `<scene-id>`](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T5 |
| **Risk / Cplx** | — / Low |
| **Touches** | 文件(README 狀態、task-checklist、progress、必要時 `docs/exec-plan/README.md`) |
| **狀態** | ⬜ |

## Objective

用**證據**宣告 `<scene-id>` 上線,而不是宣稱「做完了」。

## 四項證據(逐項貼指令與輸出)

| # | 證據 | 指令 / 斷言 | 結果 |
|---|---|---|---|
| 1 | **置換**:場景可從 UI 選單切入,drill 可跑完 | 實機 + `meta.scene.sceneId` round-trip 測試 | |
| 2 | **拒載**:違規幾何被淨空驗證擋下,訊息指名 prop id | T3 對抗性 fixture(恰相交/恰不相交) | |
| 3 | **決定性**:同輸入序列跨場景 sim 狀態逐位一致 | `<測試檔名 + 案例名>` | |
| 4 | **attribution**:`ATTRIBUTIONS.md` 與資產目錄一一對應,repo 內無非 CC0/CC-BY 檔 | 目錄比對 + 重生指令可重跑 | |

## Steps

- [ ] 四項證據逐項填表(貼真實輸出,不是「通過」)
- [ ] `npm run test:ci` exit 0
- [ ] `README.md` 狀態翻 ✅;`task-checklist.md` Done box 全 ✅
- [ ] `progress.md` 補 Surprises / 遺留 OQ
- [ ] 視需要翻 `docs/exec-plan/README.md` 該 WP 狀態(協議 §3.5)

## Definition of Done

四項證據皆有可重跑的指令與貼出的輸出;`test:ci` exit 0;上述文件狀態全部同步。

## Commit

`docs(wp-NN): T-exit — <scene-id> 上線四項證據`
