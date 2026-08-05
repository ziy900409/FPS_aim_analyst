# T1 — 逐 peek 時間軸 + 與 compute.ts 交叉驗證 + 窗界實作消重

> Part of [WP-29 coach-timeline](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(基準凍結)+ WP-28 T1(ingest) |
| **Risk / Cplx** | **Med** / Med — 風險不在演算法難度,而在**假綠**:真實 fixture 上 counter/sync 樣本數為 0,對表可能以 `n=0 vs n=0` 通過 |
| **Touches** | ADD `research/src/modules/metrics/algorithms/{peek,timeline}.py` + tests;ADD `research/fixtures/parity/timeline-*.json`;ADD `tests/golden/research/timeline-parity.test.ts`;ADD `docs/operational/analysis-peek-timeline.md`;MODIFY `research/src/report/run_pipeline.py`、`research/src/modules/kinematics/notebooks/t2/generate_epsilon_parity.py`(消重) |
| **狀態** | ⬜ |

## Objective

FR-D7 + FR-D8:交付**教練第一線要的東西**——每個 peek 一條事件時間軸,以及一張 drill 級摘要表;並用**與 [compute.ts](../../../../../src/metrics/compute.ts) 的逐量對表**證明 Python 側的窗界與錨點語意與結果頁完全一致。順帶把 research 層現存的兩份 peek 窗切片收斂成一份(消重是本 task 的義務,不是可選清理)。

## In scope

- **`build_peek_windows(export) -> list[PeekWindow]`**(簽名見 [README.md §5](README.md)):
  - 窗界 `[t_visible, nextVisible.t)`,末筆 `+inf`;切片容差沿用既有 `_WINDOW_EPSILON_MS = 1e-9`(與 [run_pipeline.py](../../../../../research/src/report/run_pipeline.py) / t2 parity generator 現行行為逐位一致)。
  - `t_counter` / `counter_key`:窗內第一個 `counter` 事件(不分鍵)。
  - **`t_release` / `release_key`**(新構念):原方向鍵 = `counter_key` 的反向鍵(`A`↔`D`);`t_release` = 窗內**最後一個仍持有原方向鍵的 tick 之 t**(即 held→released 轉換前一 tick);
    - 無 counter 事件時 fallback = 窗內最後一次任一 A/D 由 held→released 的 tick,並加 flag `release_inferred_no_counter`;
    - 窗內完全無鍵狀態轉換 → `None` + flag `no_key_transition`。
  - `t_first_shot` / `fires`:`fires` = 窗內全部 `fire.t` 升序;`t_first_shot` 取**第一個** `firstShot === true` 且(`targetId` 缺席或等於 `visible.targetId`)者——**與 `compute.ts` 的 `firstFire` 選取邏輯同語意**。
  - `t_hit` 與 `outcome`:
    - hitscan:`fire.hit === true` → `t_hit = fire.t`;
    - projectile:以 `fire.shotSeq` 關聯 `hit` 事件 → `t_hit = hit.t`;**關聯不受窗界限制**,`hit.t ≥ t_end` 時加 flag `hit_outside_window` 但仍算命中(與 `compute.ts` `fireHitOutcome` 同語意);
    - `outcome` = `no_shot`(窗內無 fire)/ `hit`(窗內任一 shot 命中)/ `timeout`(有 shot 全未命中)。
  - `ads`:窗內 `ticks.ads` 是否曾為 `True`(條件分層鍵;窗內無 tick → `None` + flag `empty_window`)。
  - `flags`:封閉詞彙表(見下方文件項),比照 D-28.9 的封閉驗證紀律。
- **`timeline_metrics(export) -> TimelineMetrics`**:逐位重現 T0 凍結的五條語意(`counterReactionMs`/`fireTimingAlignmentMs`/`firstShotHitRate`/`firstFire` 選取/`stat()` 的 p50 線性插值 + 母體 sd)。
- **parity 產出**:`timeline_parity_payload()` → `fixtures/parity/timeline-<fixture>.json`(逐量 `mean/p50/sd/n` + `firstShotHitRate` + 逐 peek 的 `targetId`/`tVisible`/`tEnd`/`outcome` + 來源檔名 + `version`)。**寫檔只在 notebooks/**(C-D2)。
- **對表閘(TS 側)**:`tests/golden/research/timeline-parity.test.ts` — 讀同一份匯出 JSON,就地組 `DataRecorderSnapshot({ ticks, events, recorderOverflow })` → 呼叫既有 `computeMetrics()`,逐量對表 ≤1e-9。**零新 TS API**(比照 [epsilon-parity.test.ts](../../../../../tests/golden/research/epsilon-parity.test.ts))。
- **反 vacuous 保護**:合成 fixture 必須讓三個量都有樣本。現有 [`SyntheticSpec`](../../../../../research/src/modules/ingest/algorithms/synthetic.py) 已支援 `missing_counter_peeks` / `missing_release_peeks` / `dropped_tick_indices` 與 hitscan/projectile 交替,足以產生涵蓋「有 counter / 無 counter / 命中 / 未命中 / 跨窗 projectile 命中」的 fixture;必要時新增 fixture 檔,**不改既有 `synthetic_counterstrafe.json`**(它被 M14 ② 引用)。
- **窗界消重**:`run_pipeline._presentation_windows`(其註解已指名本 WP)與 t2 parity generator 的切片改呼叫 `peek.build_peek_windows`(或其共享底層 slicing 函式)。
- **`docs/operational/analysis-peek-timeline.md`**(新):新構念 registry — `t_release` 定義與兩條路徑、`outcome` 判定表、`t_hit` 關聯規則、**flags 封閉詞彙表**、`version` 字串、已知限制(±1 tick 量化、單樣本效度、無 strafe 樣本)。
- **時間軸圖 + drill 摘要表**(notebooks/t1/outputs/):每 peek 一條事件軸(visible/counter/release/fire×n/hit 標記)+ drill 級摘要(逐 peek 一列:side/outcome/三個錨點差/flags)。

## Out of scope

- Sync 族三指標與精度評估(T2)。
- 動任何 TS 生產碼:本 task **只新增測試檔**;對表不一致一律先修 Python,判定為 TS 側 bug/spec 分歧則停手入帳(DoD ④)。
- 改動 `synthetic_counterstrafe.json` 或 `epsilon-*.json` 的內容(消重後必須逐位不變)。

## Steps

- [ ] `peek.py`:`PeekWindow` + `build_peek_windows`(窗界/錨點/outcome/flags)。
- [ ] 單元測試:窗界(末筆 +∞、邊界 tick 歸屬)、`firstFire` 的 targetId 過濾、缺 counter、缺 release、亂序事件、空窗、projectile 跨窗命中、`outcome` 三分類。
- [ ] `timeline.py`:`Stat` + `timeline_metrics` + `timeline_parity_payload`;`stat()` 定義以獨立測試釘死(p50 插值 / 母體 sd / 空集合)。
- [ ] 建反 vacuous 合成 fixture(三量 `n ≥ 2`、命中與未命中各 ≥1、含一個 projectile 跨窗命中)。
- [ ] parity 產生腳本(notebooks)→ `fixtures/parity/timeline-*.json`(合成 + 真實各一份)。
- [ ] `tests/golden/research/timeline-parity.test.ts`;`npm run test:ci` 全綠。
- [ ] 消重:`run_pipeline.py` + t2 parity generator 改用共享窗界;重跑兩者確認產物逐位不變。
- [ ] `analysis-peek-timeline.md` 落地(定義 + flags 詞彙表 + version + 限制)。
- [ ] 時間軸圖 + 摘要表產出(合成 + 真實各一組)。
- [ ] 兩閘輸出貼 progress(`uv run pytest` / `npm run test:ci`)。

## Definition of Done

1. **對表閘綠**:`npm run test:ci` exit 0,且 `timeline-parity.test.ts` 對**合成與真實兩份 fixture**逐量(`counterReactionMs`/`fireTimingAlignmentMs` 各自 `mean/p50/sd/n` + `firstShotHitRate`)相對誤差 ≤ 1e-9。
2. **反 vacuous 斷言綠**:測試自身斷言合成 fixture 的 `counterReactionMs.n ≥ 2`、`fireTimingAlignmentMs.n ≥ 2`,且首發集合同時含命中與未命中(否則測試失敗)。真實 fixture 允許 `n = 0`,但 `firstShotHitRate` 必須為 `100` 且 peek 數 = 20。
3. **窗界與 outcome 單元測試綠**:上列 Steps 第 2 點八個情境各有測試;`build_peek_windows` 回傳長度恆等於 `visible` 事件數。
4. **不一致處置**:若對表出現差異 → 先修 Python;若判定為 TS 側 bug 或 spec 分歧,入 [DECISIONS.md](../../../DECISIONS.md) 或開 [KI](../../../../known_issue/) 並取得結論後,本 task 才可標 PASS。
5. **消重零漂移**:重跑 parity 產生器與 `run_pipeline.py` 後,`git diff --exit-code research/fixtures/parity/epsilon-*.json` 乾淨,且 `research/out/pipeline-summary.json` 的 `segmentation`/`dtReport` 區塊與消重前逐位一致(證據貼 progress)。
6. **文件**:`analysis-peek-timeline.md` 含 `t_release` 兩條路徑、`outcome` 判定表、`t_hit` 關聯規則、封閉 flags 詞彙表、`version`、三項已知限制。
7. **產物**:合成與真實各一組時間軸圖 + drill 摘要表落 `notebooks/t1/outputs/`;真實那組明文標註「零 strafe 樣本:counter/release 錨點全缺」。
8. `uv run pytest` exit 0;`research/` 零 TS import(C-D1);`algorithms/` 純度測試綠(C-D2);**未動任何 `src/` 生產碼**。

## Commit

`feat(wp-29): T1 逐 peek 時間軸 + compute.ts 交叉驗證閘(≤1e-9,含反 vacuous 斷言)+ 窗界實作消重`
