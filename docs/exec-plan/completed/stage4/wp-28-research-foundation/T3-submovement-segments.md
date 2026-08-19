# T3 — SG 平滑 + submovement 分段(參數 pre-registered 凍結)

> Part of [WP-28 research-foundation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2(ω(t) 已釘死且 ε parity 綠) |
| **Risk / Cplx** | **High** / High — 閾值在 128Hz/deg/s 域是否穩定是全 stage 的地基風險(§3 Failure modes) |
| **Touches** | ADD `research/src/shared/filters/{sg,butter}.py`;ADD `research/src/modules/segments/algorithms/submovement.py` + tests;ADD `modules/segments/notebooks/t3-sweep/`(掃參 + 疊圖) |
| **狀態** | ✅ 合成 DoD(2026-08-04 11:55Z);🟡 真實 drill 成功率/疊圖仍為 M14 blocker |

## Objective

FR-D5:把 performance_analysis 的 submovement 分段骨架移到 128Hz / deg/s 域,並以合成 fixture(已知邊界)+ 真實資料掃參把參數**pre-register 凍結**——之後 WP-30/31 的每個逐段指標才有可歸因的立足點。

## In scope

- **`shared/filters/`**:`sg_filter(x, window, poly)`(Savitzky-Golay,scipy)+ `butter_filter(x, cutoff_hz, fs, order)`(零相位 `filtfilt`,供 WP-30 phase 複用);兩者對退化輸入(樣本數 < window、cutoff ≥ Nyquist)**拋明確錯誤或回 fallback + flag,不靜默出錯**(語意定案寫 doc)。
- **`SegmentParams`**(frozen dataclass,含 `version` 字串)+ **`segment_submovements(omega, params) -> list[Segment]`**:
  - 骨架沿 performance_analysis:peak 門檻 = `max(mean + k·σ, floor)`;段邊界 = peak 的 `low_ratio` / `stop_ratio` 交叉點;
  - `primary_flick` = 首個(或最大)peak 段;其後低幅度段 = `micro_adjustment`;
  - **單位重校**:px/s → deg/s(`peak_floor_deg_s` 起點候選由掃參定,OQ-S4-2);
  - 每段帶 `flags`(如 `truncated_at_window_edge`、`below_floor`)。
- **合成 fixture(已知邊界)**:單一 flick、flick + 1 次 micro、flick + 3 次 micro、零運動、連續等速(無 peak)、雙峰緊鄰(碎段測試)。邊界誤差判準 **≤ 2 tick**。
- **掃參 notebook**(`notebooks/t3-sweep/`):SG window(候選含 w=7 ≈ 55ms)× peak k × low/stop ratio 網格;輸出 ① 合成 fixture 邊界誤差表 ② 真實 drill 分段數/成功率 ③ ω(t) + 分段疊圖(人工檢核用)。**繪圖與寫檔只在 notebook**(C-D2)。
- **參數凍結**:定案值寫入 `SegmentParams` 常數 + `version`(如 `seg-v1`),掃參證據與定案理由記 progress Decision Log;`docs/operational/analysis-segments.md` 於 T-exit 落地。

## Out of scope

- `per_segment_apply` 與 quality flags 聚合(T4)。
- phase 分解(WP-30 T1,雖共用 `butter_filter`)、SPARC(WP-31 T1)。
- 真實樣本取得(使用者後補);樣本未到位時本 task 只能交付合成 fixture 部分(見 DoD 分段)。

## Steps

- [x] `sg.py` / `butter.py` + 退化輸入測試。
- [x] `submovement.py`:`SegmentParams` + `Segment` + `segment_submovements`。
- [x] 六個合成 fixture + 邊界誤差測試(≤2 tick;`seg-v1` 實測 max=1 tick)。
- [x] 掃參 notebook + 合成誤差表(243 組);[ ] 樣本到位後補真實分段成功率 + 疊圖。
- [x] 參數定案 → `DEFAULT_SEGMENT_PARAMS` + `version="seg-v1"`;掃參證據 + 理由記 progress。
- [x] `uv run pytest` 全綠(`53 passed in 4.53s`)。
- [x] `npm run test:ci` 全綠(tsc + Vitest 82 files/641 tests + Playwright 18 tests)。

## Definition of Done

**可立即完成(合成部分)**

- 六個合成 fixture 全綠,`primary_flick`/`micro_adjustment` 邊界誤差 **≤ 2 tick**;零運動與連續等速情境回空段 + 正確 flag(不拋錯)。
- 退化輸入(樣本 < window、cutoff ≥ Nyquist)行為與 doc 一致並有測試。
- `SegmentParams` 為 frozen + 帶 `version`;參數值不散落於呼叫端(grep 證據)。
- `uv run pytest` exit 0。

**M14 阻塞項(真實樣本到位後補跑,不得以合成替代)**

- 真實 drill 分段成功率報告(分段數 / peek 數、無段 peek 比例)+ ω(t) 疊圖產出於 `notebooks/t3-sweep/outputs/`。
- 掃參證據(網格結果表)+ 凍結決定記 progress;參數 `version` 定案。

## Commit

`feat(wp-28): T3 SG 濾波 + submovement 分段(合成 fixture 邊界 ≤2 tick;參數 pre-registered)`
