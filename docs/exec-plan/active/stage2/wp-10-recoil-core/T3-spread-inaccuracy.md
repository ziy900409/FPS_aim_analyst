# T3 — spread / inaccuracy(三成分隨機不準度)

> Part of [WP-10 recoil-core](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> 演算法權威來源:[研究計畫 Phase 1-3](../CS2%20壓槍軌跡復刻研究計畫.md)

| | |
|---|---|
| **相依** | T1(`Rng` 型別 + ran1) |
| **Risk / Cplx** | Low / Med |
| **Touches** | NEW `src/recoil/spread.ts`、`src/recoil/spread.test.ts` |
| **狀態** | ⬜ |

## Objective

實作開火瞬間的擴散偏移取樣:狀態基礎值 + 每發累積 + 移動附加,RNG 注入式,
輸出 `(x, y)` 供 WP-13 疊到彈道方向(`forward + x·right + y·up`)。

## In scope
- inaccuracy 合成(AK 參考常數 inline 供測試):
  ① 基礎值:站姿 **0.00641**(蹲 0.00481 保留欄、不啟用——訓練器無蹲輸入,stage2 假設);
  ② 累積:`inaccuracyFire`(T2 每發 `+w.fire`,AK **0.0078**)以 `exp(−dt·ln10 / recoveryTime)` 回復——回復步進掛在 `recoilTick`(T2 檔案內補一行,本 task 一併實作與測試);
  ③ 移動附加:`(speedRatio)^0.25 × InaccuracyMove`,`speedRatio = |v| / vMax`(WP-14 前為二元 {0,1} 輸入,介面先行)。
- `sampleSpread(s, w, speedRatio, rng)`:θ = `rng()·2π` 均勻、半徑 = `rng() × inaccuracyTotal`(中心偏置);回傳 `{x, y}`。

## Out of scope
- 彈道方向合成與 raycast(WP-13);真實連續速度(WP-14);crouch 啟用。

## Design notes

- **RNG 注入、禁 `Math.random()`**(GD-5):呼叫端(WP-13)以 drill seed 建 ran1 stream;本模組不持有全域 RNG。
- 每發 2 次 `rng()` 呼叫、次序固定(θ 先、r 後)——決定性契約,測試鎖定呼叫次數。

## Steps

- [ ] `spread.ts`:inaccuracy 合成 + `sampleSpread`;`recoilTick` 補 `inaccuracyFire` 回復步進(修改 `punch.ts`,同 commit)。
- [ ] 決定性測試:同 seed 同序列 → 逐發 `(x,y)` 位元級一致;每發恰 2 次 rng 呼叫(spy 計數)。
- [ ] 分布測試:10k 樣本 θ 直方圖均勻(χ² 粗檢)、半徑 ≤ inaccuracyTotal 且中心偏置(均值 < 上限/2)。
- [ ] 成分測試:`speedRatio=0` 時移動項為 0;`speedRatio=1` 時 = InaccuracyMove;連發 5 發 inaccuracy 單調升、停火後依 recovery 曲線回落(解析值對照)。
- [ ] `npx vitest run src/recoil` 全綠;`Math.random` grep(`src/recoil/`)= 0。

## Definition of Done

- 上述四類測試全綠;`sampleSpread` 為純函式(輸入含 rng,無隱藏狀態);punch.ts 的 recovery 步進有測試覆蓋。

## Commit

`feat(wp-10): T3 spread/inaccuracy 三成分 + seeded RNG 注入(禁 Math.random)`