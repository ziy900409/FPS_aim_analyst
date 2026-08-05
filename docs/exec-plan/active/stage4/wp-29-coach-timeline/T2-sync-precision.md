# T2 — Release-to-Click Sync 族 + 量化精度評估(pre-registered 判定)

> Part of [WP-29 coach-timeline](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(`PeekWindow` 錨點齊備) |
| **Risk / Cplx** | Med / Low–Med — 演算法簡單,風險在**判定**:判準若被事後調整,T3(動引擎)就失去正當性 |
| **Touches** | ADD `research/src/modules/metrics/algorithms/sync.py` + tests;ADD `research/src/modules/metrics/notebooks/t2/outputs/`(精度評估報告);MODIFY `docs/operational/analysis-peek-timeline.md`(Sync 族定義段) |
| **狀態** | ⬜ |

## Objective

FR-D9:把 counter-strafe 的本質——「**鬆原方向鍵 → 按反向鍵 → 開槍**」三元組時序——變成可聚合的指標族,並對 `t_release` 的 ±1 tick 量化給出**依 T0 凍結判準的明確判定**(`sufficient` / `insufficient` / `blocked-by-data`),作為 T3 是否觸發的唯一依據。

## In scope

- **三個指標**(逐 peek 一列,欄位見 [README §5](README.md) `sync_metrics`):
  | 欄位 | 定義 | 精度 |
  |---|---|---|
  | `release_to_fire_ms` | `t_first_shot − t_release` | **±1 tick**(t_release 自 `ticks[].keys`) |
  | `counter_hold_ms` | counter 鍵自 `t_counter` 起連續持有的時長(自 `ticks[].keys` 找 held→released) | **±1 tick**(結束端量化) |
  | `counter_to_fire_ms` | `t_first_shot − t_counter` | **sub-tick**(兩端皆 input `timeStamp`);= `compute.ts` 的 `fireTimingAlignmentMs`,**不得另立定義**(C-D4) |
- **缺錨點 = flag,不是 NaN**:任一端缺席 → 該列該欄為 `None` + flag(`missing_release` / `missing_counter` / `missing_first_shot` / `release_inferred_no_counter` / `no_key_transition`);**帶 flag 的列不進聚合分母**。flags 沿用 T1 的封閉詞彙表(新增者必須同步 `analysis-peek-timeline.md`)。
- **條件分層欄位**:每列帶 `side`(L/R)、`ads`、`weapon_mode`(hitscan/projectile,自 `meta.weapon.bullet` 有無推導),供 T-exit 報告 `group_by`;**分層不改任何參數**(stage4 §2.4c)。
- **量化精度評估 `evaluate_release_precision`**:
  - `quantization_sd_ms = (1000 / sim_hz) / √12`(128 Hz → ≈ 2.2551 ms),來源為均勻量化誤差,寫入報告 metadata。
  - 對 `release_to_fire_ms` 與 `counter_hold_ms` **各自**依 T0 凍結的 `SyncParams`(`min_samples` / `sd_ratio_threshold` / `version = sync-v1`)輸出三分支判定之一,附 `n` / `sample_sd_ms` / `reason`。
  - `counter_to_fire_ms` **不參與**此判定(非量化來源),但報告中並列作為對照。
- **精度評估報告**(notebooks/t2/outputs/,靜態產物):每指標的 `n`、樣本 SD、量化 SD、判定與理由;`blocked-by-data` 時明列缺樣本的成因(引用 [README §0](README.md) 的資料現況)與解除條件(OQ-S4-9)。
- **`analysis-peek-timeline.md` 補 Sync 族段**:三個指標定義、精度層級、`SyncParams` 凍結值、判定三分支表。

## Out of scope

- `DataRecorder` 的 `key` 事件(T3;**只有本 task 判定 `insufficient` 才展開**)。
- 任何依真實資料回頭調整 `SyncParams` 的行為(D-29 凍結條款:只能升版重跑)。
- 教練報告組裝(T-exit)。

## Steps

- [ ] `sync.py`:`SyncParams`(讀 T0 凍結值)+ `sync_metrics` + `PrecisionVerdict` + `evaluate_release_precision`。
- [ ] 單元測試:正常三錨點齊、缺 release、缺 counter、缺 first shot、亂序事件、鍵在窗界上跨窗、`counter_hold` 延伸到窗外(取窗內截斷 + flag)。
- [ ] 判定測試:三分支各一個合成情境(樣本 SD 大 → `sufficient`;樣本 SD 小 → `insufficient`;n 不足 → `blocked-by-data`),斷言 `quantization_sd_ms` 精確等於 `(1000/128)/√12`。
- [ ] 聚合排除測試:帶 flag 的列不進 `n`、不影響 SD。
- [ ] 對合成 fixture 與真實 fixture 各跑一次評估,產報告至 `notebooks/t2/outputs/`。
- [ ] 判定與證據寫 progress(**判定值 + n + SD + 是否觸發 T3**);`analysis-peek-timeline.md` 補 Sync 段。
- [ ] `uv run pytest` 輸出貼 progress。

## Definition of Done

1. 單元測試綠:上列七個 `sync_metrics` 情境 + 三個判定分支 + 聚合排除,全數有測試。
2. **量化 SD 常數正確**:測試斷言 `quantization_sd_ms == (1000/128)/sqrt(12)`(相對誤差 ≤ 1e-12)。
3. **判定明確**:`evaluate_release_precision` 對三份 fixture(合成 / 真實 08:03 / 真實 09:39)各輸出 `sufficient` / `insufficient` / `blocked-by-data` 之一,**無「待定」狀態**;判定值 + `n` + `sample_sd_ms` + `reason` 寫入 progress 與 `notebooks/t2/outputs/` 報告。**判定以 09:39 為準**(唯一有 Sync 樣本的真實資料,預期 n ≈ 20);08:03 預期 `blocked-by-data`(n=0),用來證明三分支邏輯在零樣本下不會硬給結論。
4. **T3 觸發條件二值化**:progress 明文記「T3 觸發 = 是/否」及依據 —— 依 09:39 的判定。若 09:39 亦落 `blocked-by-data`(例如有效樣本 < `min_samples`)→ T3 標 **deferred** 並記錄還缺多少樣本;`sufficient` → skipped;`insufficient` → 展開 T3。
5. **判準未被事後調整**:`SyncParams` 的三個值與 T0 Decision Log 逐位一致(diff 證據貼 progress);任何改動須升 `version` 並重跑全鏈。
6. `analysis-peek-timeline.md` 含 Sync 族三指標定義、精度層級表、判定三分支表、`sync-v1` 凍結值。
7. `uv run pytest` exit 0;**未動任何 `src/` 生產碼**;`algorithms/` 純度測試綠。

## Commit

`feat(wp-29): T2 Release-to-Click Sync 族 + 量化精度 pre-registered 判定(sync-v1,三分支)`
