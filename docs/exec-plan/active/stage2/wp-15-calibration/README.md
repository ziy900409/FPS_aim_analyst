# WP-15 — calibration:cl_showpos 軌跡校準 + pattern 比對(M7)

> stage2 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 驗證方法來源:[研究計畫 Phase 4](../CS2%20壓槍軌跡復刻研究計畫.md)
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 對外部真值校準:CS2 `cl_showpos` 實錄起步/急停序列逐 tick 對表、AK 彈道 vs 社群 pattern 圖逐彈比對、10m 牆面擴散雲角度→公分換算檢查——把「復刻」從公式級升到行為級 |
| **里程碑** | **M7**:曲線 + pattern 比對通過 → 「counter-strafe × 壓槍」研究效度成立 |
| **相依** | WP-13(M6,pattern 需整合鏈)、WP-14(速度曲線) |
| **對應 FR** | FR-B13 |
| **估時** | 1.5–2 dev-days |
| **狀態** | ✅ **M7 caveated PASS(2026-07-07)**:速度曲線 surrogate 於 sim cadence 對表通過 + recoil 對 CS2 vdata golden 釘死;第三方 Aiming.Pro pattern 逐彈差異(yaw maxAbs 3.941°)分層歸因為來源模型不匹配、經研究者接受(GD-14);`cl_showpos` 實錄行為級真值仍為 caveat |

---

## 1. 範圍

**In scope**(測試與 fixture 為主,預期不動 `src/`;T1 速度曲線目前採研究者批准的 theory-derived surrogate,非 `cl_showpos` 實錄):

```
tests/golden/calibration/clshowpos-accel.json  ← NEW CS2 實錄參考序列(起步)        [T1]
tests/golden/calibration/clshowpos-stop.json   ← NEW CS2 實錄參考序列(急停)        [T1]
tests/calibration/showpos.test.ts              ← NEW 逐 tick 對表(容差 = OQ-S2-2)  [T1]
tests/golden/calibration/ak47-pattern.json     ← NEW 社群 pattern 圖數位化 30 點     [T2]
tests/calibration/pattern.test.ts              ← NEW 逐彈誤差表 + 角度→公分換算單測 [T2]
```

**Out of scope**:引擎行為修正(比對不過 → 歸因報告 + 決策,不在本 WP 內盲調參);
M4A4/M4A1-S pattern(AK 先行,方法可複製);subtick 精度追齊(記 caveat)。

## 2. 關鍵契約

- 容差(OQ-S2-2,T0 拍板;計畫預設):速度逐 tick ±1 u/s、彈著逐彈 ±0.05°;首輪跑完可校一次。
- 換算:`偏移公分 = tan(角度) × 1000 cm`(10m 牆);pattern 圖以像素→角度標定後數位化。
- **比對不過的處理是歸因不是調參**:差異分層(公式移植 / 常數假設 / subtick 內插),
  報告入 progress + GD(研究計畫 caveat 已預告 CS:GO 洩漏碼 × CS2 vdata 組合風險)。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| 校準不過(引擎行為假設失效) | golden 基準可信度存疑 | 差異分層歸因(公式/常數/subtick);結果記 progress + GD([../README.md §2.6](../README.md)) |
| 參考資料品質差(錄製 tick 缺漏、pattern 圖無標定尺度) | 對表無意義 | T0 資料備妥檢查為 **STOP 條件**;fixture 附來源與標定方法註記 |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | OQ-S2-2 容差拍板 + **參考資料備妥檢查(STOP 條件)** | — | Low(surrogate PASS;實錄 caveat) |
| **T1** | [T1-clshowpos-calibration.md](T1-clshowpos-calibration.md) | `cl_showpos` 起步/急停逐 tick 對表 | T0、WP-14 exit | Med |
| **T2** | [T2-pattern-comparison.md](T2-pattern-comparison.md) | pattern 逐彈比對 + 擴散雲換算檢查 | T0、WP-13 exit | Med |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | **M7 門**:比對通過宣告 + 歸因報告定稿 | T1, T2 | — |
