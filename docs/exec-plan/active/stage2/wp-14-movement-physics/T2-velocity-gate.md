# T2 — Velocity gate 連續模型(88 u/s)

> Part of [WP-14 movement-physics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **跨 WP 相依**:需 [WP-11 T3](../wp-11-weapon-fire/T3-cycletime-scheduler.md) 的 `fireOneShot` 已落地(先驗該 task Done ✅)。

| | |
|---|---|
| **相依** | T1、**WP-11 T3**(fireOneShot 產彈點) |
| **Risk / Cplx** | Med / Med |
| **Touches** | MODIFY `src/loop/SimLoop.ts`(fireOneShot 內 accurate/residualSpeed)、`src/state/SharedState.ts`(欄位/註解)+ 測試 |
| **狀態** | ⬜ |

## Objective

開火精準判定從二元 `stopped` 升級為連續速度模型(FR-B12):`accurate = |v| < 88`、
`residualSpeed` 記連續 u/s;spread 移動項接上真實速度。

## In scope
- `fireOneShot` 內:`accurate = |vx| < ACCURACY_THRESHOLD(88)`;
  `residualSpeed = |vx|`(連續 u/s,取代分類值)。
- spread 移動項:`speedRatio = |vx| / vMax(250)` 接真速度——介面 WP-13 T1 已留
  (`sampleSpread(…, speedRatio, rng)`,integrator 上線後 ratio 自然成為連續值),本 task 驗證其效果。
- 88 門檻常數單一所有權:與 T1 的 `stopped` 門檻同源 import,不得兩處各寫一次。

## Out of scope
- 呈現層(T3);匯出擴欄(WP-16 T1;residualSpeed 落匯出欄位的 schema 對帳在彼處)。

## Steps

- [ ] accurate/residualSpeed 判定落 `fireOneShot`;門檻常數與 T1 同源。
- [ ] 88 邊界測試:構造 |vx| 略低/略高於 88 的開火時點 → accurate 翻轉正確(成對案例)。
- [ ] 統計斷言:固定 seed 下「移動中(~250 u/s)spread ≫ 急停後(<88)spread」
      (兩組取樣半徑分布,均值比大於既定倍數;倍數由 weapon inaccuracy 參數解析推出)。
- [ ] 決定性:同 seed 同輸入 → accurate/residualSpeed 序列兩次執行一致。
- [ ] `npx vitest run` 全綠(含既有回歸)。

## Definition of Done

- 88 邊界成對測試綠;移動 vs 急停 spread 統計斷言綠;門檻常數 grep 僅一處定義;
  既有回歸綠。

## Commit

`feat(wp-14): T2 velocity gate 連續模型(accurate=|v|<88 + residualSpeed 連續 u/s)`
