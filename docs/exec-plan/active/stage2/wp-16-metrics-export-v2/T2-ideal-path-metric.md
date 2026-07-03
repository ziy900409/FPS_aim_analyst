# T2 — 理想壓槍路徑 + 補償誤差指標

> Part of [WP-16 metrics-export-v2](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(v2 欄位就緒:aimPunch / view 序列可讀) |
| **Risk / Cplx** | Low / Med |
| **Touches** | MODIFY `src/metrics/compute.ts`(新增純函式)+ `src/metrics/compute.test.ts` |
| **狀態** | ⬜ |

## Objective

FR-B15 的數學落地:理想壓槍路徑 = `−aimPunch×2` 的時間鏡像;補償誤差 =
實際 aim 路徑對理想路徑的 mean/RMS 角度差——壓槍品質自此可量化。

## In scope
- 純函式(零 three/DOM 相依):
  - `buildIdealPath(punchSeq)` → 理想 aim 偏移序列(= `−rawPunch×2`,時間對齊 fire 序列);
  - `compensationError(aimSeq, idealSeq)` → `{ meanDeg, rmsDeg }`(pitch/yaw 合成角距)。
- 掛進 drill 結算統計物件(供 T3 呈現);若指標入匯出,欄名記 schema.md 對帳(T1 機制)。
- 結算路徑非熱路徑,但沿用陣列重用慣例(不在迴圈內配置中間物件)。

## Out of scope
- 呈現(T3);視角逐 tick 重建([../README.md §2.5](../README.md):記錄而非重建,
  輸入一律取自 fire 事件記錄欄)。

## Steps

- [ ] `buildIdealPath` + `compensationError` 實作(純函式 + 型別)。
- [ ] 解析對照測試 ①:**完美補償**合成輸入(aim ≡ −rawPunch×2)→ mean/RMS ≈ 0(< 1e-9)。
- [ ] 解析對照測試 ②:**零補償**(aim 恆定)→ 誤差 = punch 累積解析值(逐點對照)。
- [ ] 掛進結算統計物件 + 既有統計測試不退化。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- 兩個解析對照測試綠;函式為純函式(grep 無 three/DOM import);
  統計物件含 mean/RMS 兩欄(T3 可直接消費)。

## Commit

`feat(wp-16): T2 理想壓槍路徑(−aimPunch×2 鏡像)+ 補償誤差 mean/RMS`
