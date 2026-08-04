# WP-28 — Progress Log

> Running log。每個 task 完成時補一段(Progress / Decision Log / Surprises / Open Questions),與該切片一起 stage。
> Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

---

## Progress

| 日期 | Task | 結果 | 證據 |
|---|---|---|---|
| 2026-08-04 | (計畫展開) | WP-28 子資料夾建立;stage4 採納(GD-19/GD-20) | [../README.md](../README.md) · [DECISIONS.md](../../../DECISIONS.md) GD-19/GD-20 |
| 2026-08-04 | T0 | ✅ entry gate PASS;Python/uv/CI/fixture 決策與 C-D1~C-D4 已落 repo | Python 3.12.10 · uv 0.9.18 · `uv run pytest`:pytest 9.1.1,0 tests,exit 0 |
| 2026-08-04 | T0 upstream | ✅ M4 / WP-16 / M11 / M12 exit-gate 複驗 | [M4](../../../completed/stage1/wp-9-integration/T5-exit-gate.md) · [WP-16](../../../completed/stage2/wp-16-metrics-export-v2/T-exit-gate.md) · [M11](../../../completed/stage5/wp-23-longrange-tracking/T-exit-gate.md) · [M12](../../../completed/stage5/wp-25-ballistics-tracer/T-exit-gate.md) |
| 2026-08-04 | T0 schema baseline | ✅ schema v2 ingest 對表面確認 | [schema.md](../../../../operational/schema.md):tick `aim`/`keys`/`ads`;events `visible`/`counter`/`ads`/`fire`/`hit`;`meta.targets.hitbox`/`meta.weapon.ads|bullet` |
| 2026-08-04 | T0 sample | 🟡 真實匯出樣本仍未取得 | **M14 ① ingest 與 ④ 分段疊圖/成功率維持阻塞**;T1 合成匯出產生器只解鎖開發,不替代真實資料證據 |

---

## Decision Log

| # | 決策 | 理由 | 出處 |
|---|---|---|---|
| D-28.0 | research 層 = Python 3.12 + uv;Python 閘不進 `test:ci`,改雙向 parity/golden fixture 進 `test:ci` + 獨立 `uv run pytest` | 移植對象是 performance_analysis Python 實作(scipy 生態必要);`test:ci` 是每 stage 的引擎不變式閘,加 Python 相依會讓純引擎工作在無 uv 機器上卡住;跨語言漂移仍由 fixture 對表捕捉 | 使用者確認(2026-08-04)· GD-19 · [../README.md §2.4a](../README.md) |
| D-28.1 | committed 真實匯出 fixture 上限 = 30s(約 3840 ticks),`participantId` 匿名化,落 `research/fixtures/exports/` | 控制 repo 體積與個資暴露;長 drill 僅本機分析。Alternatives Considered:commit 完整長 drill(拒絕:repo 膨脹/個資風險)、只用合成資料(拒絕:M14 需真實效度證據) | 使用者確認(2026-08-04)· GD-19 · OQ-S4-8 |
| D-28.2 | T0 使用 `pytest-custom-exit-code` 僅抑制 `NO_TESTS_COLLECTED`,讓指定的零測試空跑為綠 | pytest 9.1.1 原生在 0 tests 回傳非零,與 T0 DoD 衝突;plugin 不抑制 collection error 或 test failure。Alternatives Considered:提前加 smoke test(拒絕:T1 tests tree out of scope)、包 shell `||`(拒絕:不再是指定的 `uv run pytest` 閘) | T0 本機驗證(2026-08-04) |

---

## Surprises

| # | 意外 | 影響 | 處理 |
|---|---|---|---|
| S-28.0 | ε(t)/on-target/t_acquire/peek 窗界**已有 TS 權威實作**(`trackingDerivation.ts` + `analysis-tracking.md`),草稿誤認為本 stage 新推導 | 若只做單向 parity,全部逐段指標建在未對表的 ε 上,M14 綠燈是假的 | 採納時改為 **parity 雙向**,並把 ε 對表列為 T2 DoD 首項(GD-19) |
| S-28.1 | schema 沒有 `kill`/`timeout` 事件;`counter` 事件是**條件性**的(僅在反向鍵按下且 `vx` 反號時記錄) | peek outcome 與 Sync 族的缺事件是常態語意,不是資料缺失 | outcome/t_hit 改為推導(`fire.hit` / `hit` 事件);缺事件一律走 `flags`,不吞成 NaN(WP-29 T1/T2) |
| S-28.2 | pytest 9.1.1 收集 0 tests 時原生退出非零,不是 T0 文案所述的綠燈 | 若不處理,T0 無法同時滿足「不提前開 T1 tests tree」與 `uv run pytest` exit 0 | dev-only `pytest-custom-exit-code` + `--suppress-no-test-exit-code`;實測 0 tests / exit 0 |

---

## Open Questions

| # | 問題 | 狀態 | Owner | Deadline |
|---|---|---|---|---|
| OQ-S4-8(樣本) | 真實 drill 匯出樣本(≤30s、匿名)未取得 | 🟡 使用者後補;**M14 ①④ 阻塞項**;T1 以合成匯出產生器解鎖開發 | 使用者 | T3 掃參前 |
| OQ-S4-2 | 分段閾值 / SG window 的 128Hz 起點數值 | 🟡 T3 掃參後 pre-register 凍結 | 研究者 | WP-28 T3 |
