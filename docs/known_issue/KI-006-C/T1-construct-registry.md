# T1 — `construct.py`:registry `construct-v1` + 家族解析 + 檢查純函式

> 上游:[C README §2.5](README.md)(interface contract)· §2.3(門檻證據)· §2.4(三個查碼發現)
> 交付:**FR-C-1 ~ FR-C-6 · FR-C-9 · FR-C-10(詞彙常數部分)**

**In scope**:`research/src/modules/ingest/algorithms/` 下的新模組與測試。
**Out of scope**:`run_pipeline` 佈線(T2)、任何文件(T3)、任何 `src/` 改動。

---

## Steps

### 1. 新增 `research/src/modules/ingest/algorithms/construct.py`

依 [README §2.5](README.md) 的簽名實作,逐項對照:

- [ ] `CONSTRUCT_PARAMS_VERSION = "construct-v1"`。
- [ ] `CONSTRUCT_FLAG_VOCABULARY = ("construct_absent:<construct>", "construct_unknown")` + `is_known_construct_flag()`(比照 [apply.py](../../../research/src/modules/segments/algorithms/apply.py) 的 `is_known_quality_flag`,templated 形式的後綴必須非空)。
  - ⚠️ **刻意不合併進 `QUALITY_FLAG_VOCABULARY`**:那是 peek/segment 級詞彙且住在 `segments` 模組,合併會讓 `ingest` 反向依賴 `segments`(R-6)。兩者於 T3 在同一張文件表以 **Level** 欄區隔。
- [ ] `ConstructRule` / `ConstructReport` 兩個 `frozen=True` dataclass,欄位逐條照契約。
- [ ] `CONSTRUCT_REGISTRY`:**只註冊 `counterstrafe`**(`min_counter_events=1`、`min_moving_tick_ratio=0.05`)。§2.4 ③ 已確認另兩家族的宣告值不在 meta,硬寫等於猜(TD-1)。
- [ ] `resolve_drill_family(drill_id)`:先剝 `synthetic_` 前綴 → 取第一個底線前 token → 比對 registry → 無對應回 `None`。
- [ ] `check_construct_presence(export)`:單次 O(n),只讀 `meta['drillId']` / `events['type']` / `ticks['vx']`。

**判定邏輯(逐條釘死)**

```
family = resolve_drill_family(drillId)
family is None                      → present=None,  flags=("construct_unknown",)
tick_count == 0                     → present=False, flags=("construct_absent:<construct>",)   # FM-2
counter >= min_counter_events
  and ratio >= min_moving_tick_ratio → present=True,  flags=()
否則                                 → present=False, flags=("construct_absent:<construct>",)
```

- [ ] `moving_tick_ratio` 在 `tick_count == 0` 時為 `nan`(**不是 0**);`present` 仍判 `False`。
- [ ] `counter` 事件**只計數**,不從 `keys`/`vx` 重新推導(C-4 / D-C4)。
- [ ] 純度:零 `print`、零 file I/O、零 matplotlib、不讀時鐘、不讀 `random`(C-D2)。

### 2. 公開符號

- [ ] `research/src/modules/ingest/algorithms/__init__.py` 匯出 `ConstructReport` / `ConstructRule` / `CONSTRUCT_REGISTRY` / `CONSTRUCT_PARAMS_VERSION` / `CONSTRUCT_FLAG_VOCABULARY` / `check_construct_presence` / `resolve_drill_family`,並補進 `__all__`。

### 3. 新增 `tests/test_construct.py`

**四份 committed fixture 的端到端判定(FR-C-11 的 T1 半)** —— 期望值取自 T0 重現的數字:

- [ ] `...08_03_45.617Z` → `present is False`、`flags == ("construct_absent:counter-strafe",)`、`counter_event_count == 0`、`moving_tick_ratio == 0.0`、`tick_count == 3507`。
- [ ] `...09_39_06.031Z` → `present is True`、`flags == ()`、`counter_event_count == 24`、`moving_tick_count == 1415`。
- [ ] `synthetic_counterstrafe.json` → **`family == "counterstrafe"`**(FM-6:不得是 `None`)、`present is True`、`counter_event_count == 2`。
- [ ] `synthetic_timeline.json` → `family is None`、`present is None`、`flags == ("construct_unknown",)`。

**家族解析(FR-C-3 / FM-1)**

- [ ] `resolve_drill_family("counterstrafe_ad_v1") == "counterstrafe"`
- [ ] `resolve_drill_family("synthetic_counterstrafe_v2") == "counterstrafe"`
- [ ] `resolve_drill_family("synthetic_timeline_v1") is None`
- [ ] `resolve_drill_family("tracking_longrange_v1") is None`、`resolve_drill_family("detection_popin_v1") is None`(TD-1 的現況釘死——**日後這兩條轉綠時必須同時升版**)
- [ ] `resolve_drill_family("") is None`

**邊界案(以 `make_synthetic_export` 或就地構造的最小 `Export`)**

- [ ] `tick_count == 0` → `present is False`、`moving_tick_ratio` 為 `nan`(FM-2)。
- [ ] `counter == 0` 但橫移佔比達標 → `present is False`(AND 語意)。
- [ ] `counter > 0` 但橫移佔比 `< 0.05` → `present is False`(AND 語意)。
- [ ] 佔比**恰為** `0.05` → `present is True`(`>=`,邊界含入)。

**契約與詞彙**

- [ ] `ConstructReport.params_version == "construct-v1"`;`thresholds` 在 unknown 時為 `None`、已知家族時等於 registry 中的物件。
- [ ] 任何被產出的 flag 皆通過 `is_known_construct_flag()`。
- [ ] `ConstructRule` / `ConstructReport` 為 frozen(嘗試賦值拋 `FrozenInstanceError`)。

### 4. 純度與回歸

- [ ] `research/src/modules/ingest/algorithms/tests/test_purity.py` 涵蓋新模組(若其掃描的是整個 `algorithms/` 目錄則自動涵蓋;否則補進清單)。
- [ ] `uv run pytest` exit 0;**既有案的期望值零改寫**(NFR-C-4)。

---

## Definition of Done

- [ ] `construct.py` 的公開符號與 [README §2.5](README.md) 契約**逐條相符**(欄位名、型別、`present: bool | None` 三態)。
- [ ] 四份 committed fixture 的判定測試全綠,數字與 T0 重現值**逐格相同**。
- [ ] `synthetic_counterstrafe_v2` 解析出家族 `counterstrafe`(FM-6 專屬案存在且綠)。
- [ ] `synthetic_timeline_v1` 判 `construct_unknown` 且 `present is None`(不是 `False`)。
- [ ] 四個邊界案(空 ticks / counter=0 / 佔比不足 / 佔比恰等於門檻)皆有測試。
- [ ] `test_purity.py` 綠;新模組零 print / 零 I/O。
- [ ] `uv run pytest` exit 0,案數增量記入 [progress.md](progress.md);既有案期望值零改寫。
- [ ] `git diff --stat` **不含任何 `src/` 路徑**,且不含 `run_pipeline.py`(那是 T2)。

## Commit message

```
feat(ki-006): C T1 — construct presence gate 純函式 + construct-v1 凍結 registry

在 research/src/modules/ingest/algorithms/construct.py 新增 drill 家族構念存在性
判定:counterstrafe 家族要求 counter 事件 ≥ 1 且橫移 tick 佔比 ≥ 0.05(construct-v1,
門檻證據見 KI-006-C/README §2.3)。未註冊家族回 construct_unknown 而非靜默通過。
四份 committed fixture 全數受測:08:03 absent、09:39 present、synthetic_counterstrafe
present(家族經 synthetic_ 剝離解析)、synthetic_timeline unknown。
```
