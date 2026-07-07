# T1 — ran1 RNG + 固定彈道表 + golden

> Part of [WP-10 recoil-core](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> 演算法權威來源:[研究計畫 Phase 1-1](../../../active/stage2/CS2%20壓槍軌跡復刻研究計畫.md)

| | |
|---|---|
| **相依** | T0(OQ-S2-1 已拍板) |
| **Risk / Cplx** | Med / Med |
| **Touches** | NEW `src/recoil/rng.ts`、`src/recoil/recoilTable.ts`、`src/recoil/recoilTable.test.ts`、`tests/golden/recoil/ak47-table.json` |
| **狀態** | ✅ 2026-07-05 |

## Objective

移植 Valve `CUniformRandomStream`(Numerical Recipes ran1)與 `GenerateRecoilTable`,
以固定 seed 決定性生成每武器 64 筆 `(angleDeg, magnitude)`,並用 golden 鎖死。

## In scope
- `createRan1(seed)`:ran1 移植(IA=16807、IM=2147483647;IQ/IR/NTAB 等完整常數組照 `CUniformRandomStream` 原始碼逐字移植,含 RandomFloat 區間映射)。
- `generateRecoilTable(p)`:64 筆;full-auto 兩修正——相鄰彈 `Lerp(0.55)` 平滑、前 4 發抑制係數 `30 × Lerp(j/4, 0.75, 1.0)`(magnitude 30 時 = 22.5 / 24.375 / 26.25 / 28.125)。
- Golden fixture:seed 223(AK-47,magnitude 30 / variance 0 / angleVariance 70)全 64 筆首跑輸出經 T4 形狀 sanity(直升 9 發 → 左右之字)後鎖定;**前 8 筆**於測試中逐位斷言。

## Out of scope
- punch/spread(T2/T3);`WeaponConfig` schema(WP-11);M4A4/M4A1-S golden(值同機制,WP-11 帶 config 時補)。

## Design notes

- 純函式、無模組級可變狀態;`Rng = () => number`([0,1))為跨 T1/T3 共用型別。
- **禁 `Math.random()`**(GD-5 硬約束);本檔案唯一隨機源 = ran1。
- 表為每武器一次性預生成(非熱路徑),但仍不做每彈配置以外的中間陣列。

## Steps

- [x] `rng.ts`:ran1 移植 + 單元測試(同 seed 兩 stream 前 100 值位元級一致;不同 seed 不同)。
- [x] `recoilTable.ts`:`generateRecoilTable` + 前 4 發抑制、Lerp 平滑。
- [x] 抑制係數測試:magnitude 30 → 前 4 發 22.5 / 24.375 / 26.25 / 28.125(**精確相等**,非近似)。
- [x] 產 seed 223 表 → 人工核 T4 前置 sanity(先用測試印出 pitch 累積形狀)→ 存 `tests/golden/recoil/ak47-table.json`。
- [x] Golden 測試:前 8 筆 `(angleDeg, magnitude)` 逐位 === fixture;表長恆 64;同 seed 重呼叫位元級一致。
- [x] `npx vitest run src/recoil` 全綠。

## Definition of Done

- 上述測試全綠(≥ 5 cases);golden fixture 檔已入 repo;`Math.random` 於 `src/recoil/` grep = 0。

## Commit

`feat(wp-10): T1 ran1 RNG + 決定性彈道表(seed 223 golden 前 8 筆鎖定)`
