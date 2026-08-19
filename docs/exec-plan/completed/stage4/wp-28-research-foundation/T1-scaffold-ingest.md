# T1 — scaffold + ingest(四目錄制 + load_export/check_dt + 合成匯出產生器)

> Part of [WP-28 research-foundation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(工具鏈與硬約束落地) |
| **Risk / Cplx** | Low / Med(欄位對表面廣:含 stage5 additive 欄) |
| **Touches** | ADD `research/` 四目錄制 + `README.md`;ADD `modules/ingest/algorithms/{loader,dt,synthetic}.py` + tests;ADD `fixtures/exports/`(合成) |
| **狀態** | ✅ 2026-08-04 |

## Objective

FR-D1 + FR-D2:立起 `research/` 四目錄制與 schema v2 loader,並交付**合成匯出產生器**——讓 T2/T3/T4 的演算法與 parity 開發不被「真實樣本尚未取得」堵死,同時保持真實資料項為 M14 的獨立阻塞條件。

## In scope

- **四目錄制 scaffold**(形狀見 [../README.md §2.3](../README.md)):
  `src/modules/{ingest,kinematics,segments,metrics}/`,每模組 `algorithms/` + `algorithms/tests/` + `notebooks/<task>/outputs/`;`src/shared/filters/`;`src/report/`;`fixtures/{exports,parity,golden}/`。
- **`research/README.md`**:閘門指令(`uv run pytest`)、**fixture 體積上限(≤30s ≈3840 ticks、participantId 匿名)**、參數 registry 連結佔位(`docs/operational/analysis-segments.md`)、C-D1/C-D2 一句話提醒。
- **`load_export(path) -> Export`**(簽名見 [../README.md §2.5](../README.md)):
  - JSON → `meta: dict` + `ticks: pd.DataFrame` + `events: pd.DataFrame`;
  - **欄位/單位對表** [schema.md](../../../../operational/schema.md):tick `t,vx,vz,px,pz,tx,ty,tz,aim.yaw,aim.pitch,keys,ads`;events discriminated union(`visible`/`counter`/`ads`/`fire`/`hit`)稀疏欄攤平;
  - **stage5 additive 欄**:`meta.targets.hitbox`、`meta.weapon.{ads,bullet,projectileOverflow}`、`meta.scene/display/session/frames`、event `hit`(`t`/`timeOfFlightMs`/`shotSeq`)、`fire.shotSeq`——缺席 = 該功能未啟用(**非錯誤**,語意自明);
  - `SchemaError(field_path=...)`:`schemaVersion != 2`、缺必填欄、非有限值(NaN/inf)。
- **`check_dt(ticks, sim_hz=128) -> DtReport`**:tick 數、中位間隔、期望間隔(1000/128 = 7.8125ms)、gap 清單(index + 實際間隔)、`uniform` 判定(容差記 doc);移植 performance_analysis `raw_sampling_frequency` 模式。
- **`make_synthetic_export(spec) -> dict`**:schema-faithful v2 payload 產生器,**決定性**(禁 `time`/`random`,需要隨機性一律 seeded);可指定 peek 數、side 序列、每 peek 的 ω 波形(便於 T2/T3 的已知答案 fixture)、缺 counter/缺 release 情境、掉 tick 情境。輸出寫 `fixtures/exports/synthetic_*.json`(由 notebook/script 寫檔,**不在 `algorithms/` 內寫檔**)。
- **純度測試**:斷言 `algorithms/` 模組 import 後 ① 無檔案寫入 ② 未 import matplotlib ③ 無 stdout 輸出。

## Out of scope

- ω(t)/ε(t)(T2)、分段(T3)、flags(T4)、peek 窗重建(WP-29 T1)。
- 真實匯出樣本取得(使用者後補;到位後只需把檔放入 `fixtures/exports/` 並補跑 round-trip)。

## Steps

- [x] scaffold 目錄 + `research/README.md`(含 fixture 上限與閘門指令)。
- [x] `loader.py`:`Export` dataclass + `load_export` + `SchemaError`;欄位對表寫成模組 doc(對照 schema.md 章節)。
- [x] `dt.py`:`DtReport` + `check_dt`。
- [x] `synthetic.py`:`SyntheticSpec` + `make_synthetic_export`(決定性;含缺事件/掉 tick 情境開關)。
- [x] tests:合成 round-trip、缺欄/`schemaVersion!=2`/非有限值三種 field-path 錯誤、dt 報告(均勻 + 掉 tick 各一)、純度三項。
- [x] 產 `fixtures/exports/synthetic_counterstrafe.json`(供 T2/T3 使用)。
- [x] `uv run pytest` 全綠(輸出貼 progress)。

## Definition of Done

- 合成匯出 round-trip 綠:`load_export(make_synthetic_export(spec))` 的 ticks/events 列數與欄位集合等於 spec 宣告值。
- 三種壞輸入 fixture 各拋 `SchemaError` 且 `field_path` 指到正確欄位路徑(如 `ticks[12].aim.pitch`)。
- `DtReport` 對均勻 fixture 回 `uniform=True, gap_count=0`;對掉 tick fixture 回 `uniform=False` 且 gaps 索引正確。
- **stage5 additive 欄缺席時不拋錯**,且 `Export.meta` 保留原樣(測試斷言)。
- 純度測試綠(無寫檔、無 matplotlib、無 stdout)。
- `uv run pytest` 退出碼 0;**未動任何 `src/` 引擎碼**。
- progress 記:真實匯出 round-trip 為 **M14 ① 阻塞項**(樣本到位後補跑)。

✅ 2026-08-04:全部達成;12 tests passed,真實資料項仍依原計畫保持阻塞。

## Commit

`feat(wp-28): T1 research scaffold + schema v2 ingest(load_export/check_dt + 合成匯出產生器;純度測試綠)`
