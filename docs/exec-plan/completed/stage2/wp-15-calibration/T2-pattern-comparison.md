# T2 — Pattern 圖逐彈比對 + 擴散雲換算檢查

> Part of [WP-15 calibration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(資料就緒)、WP-13 exit(M6 整合鏈) |
| **Risk / Cplx** | Med / Med |
| **Touches** | NEW `tests/golden/calibration/ak47-pattern.json`、`tests/calibration/pattern.test.ts` |
| **狀態** | 🟡 RED/STOP(2026-07-07):可重跑比對與 10m 換算單測已落地;AK pattern yaw 偏差超 OQ-S2-2 |

## Objective

AK 30 發理論彈道(rawPunch×2 累積)與社群 pattern 圖逐彈比對(FR-B13 後半),
並驗證 10m 牆面擴散雲的角度→公分換算——研究輸出的空間單位自此可信。

## In scope
- pattern 圖數位化:像素座標 → 角度(標定方法與係數記 fixture meta);
  30 點 `{i, pitchDeg, yawDeg}[]`。
- 逐彈比對測試:sim 合成 30 發、**取純 punch 軌跡**(spread 注入常數 0 RNG 或記錄後扣除)
  → 誤差表(per-彈 Δpitch/Δyaw + max/mean),斷言容差內(OQ-S2-2 ±0.05°);全表記 progress。
- 換算單測:`偏移公分 = tan(角度) × 1000`(10m 牆);≥ 3 個樣本點解析對照
  (例:10 發 punch pitch −10.18° → 牆面公分)。

## Out of scope
- 含 spread 的統計雲比對(pattern 圖為期望路徑,spread 是隨機分布——僅比 punch 軌跡);
  其他武器 pattern(方法落地後另開 task)。

## Steps

- [x] pattern 圖標定 + 數位化 → fixture(meta 記來源 URL 與標定係數)。
- [x] 純 punch 軌跡萃取(合成 30 發 held,spread 隔離手法記測試註解)。
- [x] 逐彈誤差表測試 + 容差斷言;誤差全表輸出記 progress。
- [x] 換算單測(≥ 3 樣本解析對照)。
- [x] `npx vitest run tests/calibration` 全綠(或 STOP + 歸因報告,分層同 T1)。

## Definition of Done

- 30 發逐彈誤差表產出且容差內(或歸因報告 + 決策紀錄);換算單測綠;
  fixture 附標定方法可複核。

## Commit

`test(wp-15): T2 AK pattern 逐彈比對 + 10m 擴散雲角度→公分換算檢查`
