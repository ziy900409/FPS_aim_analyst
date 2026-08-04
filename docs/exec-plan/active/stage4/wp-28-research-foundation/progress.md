# WP-28 — Progress Log

> Running log。每個 task 完成時補一段(Progress / Decision Log / Surprises / Open Questions),與該切片一起 stage。
> Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

---

## Progress

| 日期 | Task | 結果 | 證據 |
|---|---|---|---|
| 2026-08-04 | (計畫展開) | WP-28 子資料夾建立;stage4 採納(GD-19/GD-20) | [../README.md](../README.md) · [DECISIONS.md](../../../DECISIONS.md) GD-19/GD-20 |

---

## Decision Log

| # | 決策 | 理由 | 出處 |
|---|---|---|---|
| D-28.0 | research 層 = Python 3.12 + uv;Python 閘不進 `test:ci`,改雙向 parity/golden fixture 進 `test:ci` + 獨立 `uv run pytest` | 移植對象是 performance_analysis Python 實作(scipy 生態必要);`test:ci` 是每 stage 的引擎不變式閘,加 Python 相依會讓純引擎工作在無 uv 機器上卡住;跨語言漂移仍由 fixture 對表捕捉 | 使用者確認(2026-08-04)· GD-19 · [../README.md §2.4a](../README.md) |

---

## Surprises

| # | 意外 | 影響 | 處理 |
|---|---|---|---|
| S-28.0 | ε(t)/on-target/t_acquire/peek 窗界**已有 TS 權威實作**(`trackingDerivation.ts` + `analysis-tracking.md`),草稿誤認為本 stage 新推導 | 若只做單向 parity,全部逐段指標建在未對表的 ε 上,M14 綠燈是假的 | 採納時改為 **parity 雙向**,並把 ε 對表列為 T2 DoD 首項(GD-19) |
| S-28.1 | schema 沒有 `kill`/`timeout` 事件;`counter` 事件是**條件性**的(僅在反向鍵按下且 `vx` 反號時記錄) | peek outcome 與 Sync 族的缺事件是常態語意,不是資料缺失 | outcome/t_hit 改為推導(`fire.hit` / `hit` 事件);缺事件一律走 `flags`,不吞成 NaN(WP-29 T1/T2) |

---

## Open Questions

| # | 問題 | 狀態 | Owner | Deadline |
|---|---|---|---|---|
| OQ-S4-8(樣本) | 真實 drill 匯出樣本(≤30s、匿名)未取得 | 🟡 使用者後補;**M14 ①④ 阻塞項**;T1 以合成匯出產生器解鎖開發 | 使用者 | T3 掃參前 |
| OQ-S4-2 | 分段閾值 / SG window 的 128Hz 起點數值 | 🟡 T3 掃參後 pre-register 凍結 | 研究者 | WP-28 T3 |
