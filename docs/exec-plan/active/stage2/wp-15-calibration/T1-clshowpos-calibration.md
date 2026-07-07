# T1 — cl_showpos 起步/急停逐 tick 對表

> Part of [WP-15 calibration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(surrogate PASS:容差 + theory-derived 速度曲線 fixture + AK pattern 候選資料)、WP-14 exit(integrator 上線) |
| **Risk / Cplx** | Med / Med |
| **Touches** | NEW `tests/golden/calibration/clshowpos-accel.json`、`clshowpos-stop.json`、`tests/calibration/showpos.test.ts`;附帶觸發 WP-14 `CS2_PROFILE` correctness fix(見 [DECISIONS GD-13](../../../DECISIONS.md)) |
| **狀態** | ✅ GREEN 2026-07-07(128Hz surrogate 對表通過;calibration 抓到並修正 WP-14 CS2_PROFILE 常數 bug。手感回歸與 `cl_showpos` 實錄 caveat 留 T-exit) |

## Objective

以研究者批准的 CS2 movement theory-derived 速度序列作為 surrogate reference,把 WP-14 integrator 的起步與急停曲線
逐 tick 對表(64Hz 對齊),容差 = OQ-S2-2 決議值(FR-B13 前半)。此 task 目前不是 `cl_showpos` 實錄校準;T-exit 須保留 caveat。

## In scope
- 參考序列:theory-derived fixture → `samples[]`(起步 0→max、急停 max→zero-crossing 各一段;
  JSON meta 欄附公式來源、tickrate、常數、surrogate caveat)。
- 對表測試:合成同輸入(按 D / 放開 + 按 A)驅動 sim → 逐 tick |v| 與 fixture 比,
  容差以 T0 定案值為常數(單一定義);tick 對齊規則(第一個非零速度 tick 對齊)寫入測試註解。
- 取樣節奏:fixture 為 CS2 64 tick;sim 為 128 Hz → 每 2 個 sim tick 取 1 點對表(2:1 子節奏,同 OQ-S2-1 慣例)。
- 對齊規則:fixture tick 0 是「input 生效後第一個完整 64Hz movement step」;若未來換成真 `cl_showpos`/demo-derived 資料,第一個 subtick partial sample 不納入 ±1 u/s 斷言,或用 `v0 / fullStep` 反推 subtick fraction 後注入 sim。
- 急停判準:`clshowpos-stop.json` 保存 signed velocity 與 zero-crossing bracket;T1 應斷言 zero-crossing tick/形狀,不可把持續按反向鍵後的 overshoot 誤讀為殘速。
- 差異歸因:最大偏差 tick、形狀差異(時間常數 / 尾段)分析記 progress。

## Out of scope
- pattern 比對(T2);比對不過時的引擎修改(歸因報告 → 決策,見 [README.md §1](README.md) out of scope)。

## Steps

- [x] fixture 載入 + meta 註記檢查(來源、tickrate、常數、surrogate caveat)。
- [x] 對表測試:起步段 + 急停段逐 tick 斷言(容差常數 = OQ-S2-2)。
- [x] 首輪執行:RED → 歸因報告(常數 + cadence 分層)記 progress;與研究者確認後解兩個 blocker
      (OQ-15.2 cadence 選項1、OQ-15.3 遊戲內查證常數)——非動用容差校正,而是修正 production 常數 bug + 重產 128Hz fixture。
- [x] `vitest run tests/calibration` 全綠(3/3;全套 307 tests / tsc exit 0)。

## Definition of Done

- 起步/急停兩段對表測試綠(容差內);fixture 入 repo 且附來源;
  歸因或通過報告記 progress。

## Commit

`test(wp-15): T1 cl_showpos 起步/急停逐 tick 校準對表(容差 OQ-S2-2)`
