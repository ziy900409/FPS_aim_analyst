# KI-006 / C — construct presence gate 落地(tech spec)

> **範圍**:[KI-006](../KI-006-m14-sample-no-counterstrafe.md) §4 的**選項 C**(構念存在性閘)。診斷(08:03 樣本 `vx ≡ 0` / `keys` 全空 / `counter` = 0)與「A 已出局、B 為唯一效度路徑」的結論為上游權威,本檔**不重述診斷**,只定義「C 要做什麼、介面長什麼樣、怎麼證明它擋得住」。
> **決策帳本**:[BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) BD-006 · **協議**:[CLAUDE.md §3](../../../CLAUDE.md) · **術語**:[CONTEXT.md](../../../CONTEXT.md)
> **狀態**:⬜ 計畫已定,尚未動任何程式碼。
> 語言:繁體中文,技術術語保留英文(D4)。
>
> **選項 B(重新採樣)不在本檔**。2026-08-06 拍板:B 委派給 [KI-005-A / A2](../KI-005-A/A2-blocked-plan.md)(兩個 KI 的採集已收斂為同一次),本檔只**補上該次採集必須滿足的 KI-006 條件**並回寫其前置清單(T3)。見 §1.4 與 §6 註。

---

## 0. 一句話

補上專案目前**完全缺席的內容層正確性閘**:讓每個 drill 家族宣告自己的核心構念,ingest 時斷言「這份 counter-strafe 匯出裡真的有 counter-strafe」,構念缺席時產出 **session 級** flag 並讓 `run_pipeline` 以非零 exit code 拒絕,使該 session 不能被當作該 drill 的效度證據。

此閘若早存在,08:03 第一天就會被擋下——它補的與 [KI-004 / S1](../KI-004-S1/README.md) 的 `fire.offsetDeg` oracle 是**同一類**缺口:既有閘門全部只驗**形式**(schema / dt / 純度 / parity),沒有任何一關會問「量到的是不是要量的那個東西」。

---

## 1. 需求壓縮 (Requirements)

### 1.1 Functional Requirements

| # | 需求 | 來源 |
|---|---|---|
| **FR-C-1** | 系統必須提供**純函式** construct presence 檢查:輸入一份已驗證的 `Export`,輸出該匯出是否含其 drill 家族所宣告的核心構念。 | KI-006 §4-C |
| **FR-C-2** | 構念條件必須以**具版本的凍結 registry**(`construct-v1`)宣告;調整任何門檻或條件必須**升版**,不得原地改值(比照 `seg-v1` / D-28.7 與 `sync-v1` 的 pre-register 慣例)。 | OQ-KI6-3 |
| **FR-C-3** | drill 家族解析必須是**具名純函式**,且必須正確處理合成 drillId 的 `synthetic_` 前綴(`synthetic_counterstrafe_v2` → 家族 `counterstrafe`)。 | §2.4 ① |
| **FR-C-4** | 家族**未註冊**時必須回傳 `construct_unknown` 判定,**不得靜默通過**。 | KI-006 §3.1(既有閘全部不問構念) |
| **FR-C-5** | `counterstrafe` 家族的條件必須為:`count(events.type == 'counter') ≥ 1` **且** 橫移 tick 佔比 `count(ticks.vx ≠ 0) / len(ticks) ≥` 凍結下限。 | KI-006 §4-C 表 |
| **FR-C-6** | 檢查結果必須**具名揭露判定依據**(實測 counter 數、橫移佔比、所用門檻、registry 版本、家族來源),不得只回布林。 | 比照 KI-004 FR-S1-6 `EyeOriginSource` |
| **FR-C-7** | `run_pipeline` 必須把結果寫入 `pipeline-summary.json` 的 **session 級** `constructPresence` 區塊,並**仍寫出全部三個 artifact**(診斷資料不得因閘紅而消失)。 | FR-C-8 的互補條件 |
| **FR-C-8** | 構念**缺席**時 `run_pipeline` 必須以**專屬非零 exit code** 結束,且 stderr 明示「本 session 不得用於該 drill 的效度宣告」;該 exit code 必須與既有的 schema/IO 失敗(exit 1)**可區分**。 | C-D3 · R-3 |
| **FR-C-9** | 構念**未知**(家族未註冊)時必須以 flag 揭露,但**不得**讓 `run_pipeline` 非零退出——未知不等於缺席。 | FR-C-4 的必然配套 |
| **FR-C-10** | 新增的 flag 必須納入**封閉詞彙**並在 [analysis-segments.md](../../operational/analysis-segments.md) 的 flag 表登錄,且標明其**層級為 session**(既有 flag 皆為 peek/segment 級)。 | 既有 `QUALITY_FLAG_VOCABULARY` 慣例 |
| **FR-C-11** | 四份 committed fixture 必須全數受測且判定符合預期:08:03 = **缺席**、09:39 = **存在**、`synthetic_counterstrafe` = **存在**、`synthetic_timeline` = 依家族解析結果(見 §2.4 ②)。 | §2.3 的分離證據 |
| **FR-C-12** | 文件對帳:[analysis-segments.md](../../operational/analysis-segments.md) 的 “Real-export validation” 段必須加註「所述樣本不含 counter-strafe」;[research/README.md](../../../research/README.md) 的 fixture 表必須標明兩份真實匯出的構念判定。 | KI-006 §5 |
| **FR-C-13** | 帳本對帳:KI-006 狀態、BD-006(OQ-KI6-2 關閉 + C 落地段)、[KI-005-A / A2](../KI-005-A/A2-blocked-plan.md) 前置條件清單回寫「KI-006 條件」。 | CLAUDE.md §3.9 |
| **FR-C-14** | 必須把「新採集必須滿足的 KI-006 條件」**明文化為可驗收清單**(counter > 0、橫移佔比 ≥ 門檻、n ≥ ? session),供 A2-T1 直接引用。 | OQ-KI6-4 · §1.4 |

### 1.2 Non-functional Requirements

| # | 需求 | 量化指標 |
|---|---|---|
| **NFR-C-1** | **引擎零改動** | 整個 C 階段 `git diff` **不觸及 `src/`**(選項 C 為 Python registry,見 §2.2 D-C1)。`npm run test:ci` 案數與期望值**逐條不變** |
| **NFR-C-2** | 判定分離度(門檻非事後擬合的證據) | 缺席樣本橫移佔比 = **0.0000**;最小通過樣本 = **0.2917**。凍結下限 **0.05** 距最小通過樣本 ≥ **5.8×** 邊際,距缺席樣本為**無窮大**(見 §2.3) |
| **NFR-C-3** | `algorithms/` 純度 | 新模組零 `print` / 零 file I/O / 零 matplotlib(C-D2);`test_purity.py` 既有兩項檢查綠 |
| **NFR-C-4** | 既有測試零期望值變更 | 除 `test_run_pipeline.py` 因新增 `constructPresence` 區塊而擴充斷言外,`uv run pytest` **無任何既有案的期望值被改寫** |
| **NFR-C-5** | 回歸零紅 | `npx tsc --noEmit` exit 0 · `npm run test:ci` exit 0 · `uv run pytest` exit 0 |
| **NFR-C-6** | 複雜度 | 檢查為**單次 O(n) 掃描**已載入的 `ticks`/`events` DataFrame,不重讀檔案、不新增 I/O;3,507 tick 的真實匯出上不得成為 `run_pipeline` 的可觀測開銷 |

### 1.3 Constraints(不可違反)

- **C-1** — **C-D1**:`research/` 只讀匯出 JSON/CSV 與 golden fixture,**不得 import 任何 TS 模組**;`src/` 不得 import Python 產物。本階段全部落在 `research/`,`src/` 零改動(NFR-C-1)。
- **C-2** — **C-D2**:`algorithms/` 純函式紀律 —— 禁 matplotlib / print / file I/O。閘的**判定**落 `algorithms/`,**輸出與 exit code** 落 `report/`(`run_pipeline.py` 屬 report tier,已明文允許寫檔與 console)。
- **C-3** — **C-D3 / GD-20**:未通過構念驗證的指標不得進教練報告。本閘是該紅線在**資料層**的前置條件:構念不存在時,連「有沒有通過」都不該被問。
- **C-4** — **C-D4 / 不得產生第二定義**:`counter` 事件的語意由引擎([SimLoop.ts:76](../../../src/loop/SimLoop.ts#L76))權威,Python 側**只計數、不重新定義**何謂 counter-strafe。本閘**不**自行從 `keys`/`vx` 推導 counter 事件。
- **C-5** — **與 reliability gate 不得混淆**:[CONTEXT.md](../../../CONTEXT.md) 已有 **reliability gate(構念驗證閘)** = 「指標進教練報告前的信度/效度門檻」(WP-31 T0 pre-register)。本閘是 **construct presence gate(構念存在性閘)** = 「資料裡有沒有這個行為」。**兩者是不同層級、不同時機的閘**,命名與文件必須明確區隔(T3 於 CONTEXT.md 落一條)。
- **C-6** — **凍結參數紀律**:`construct-v1` 一經 commit,門檻只能升版(`construct-v2`)不得原地調整;版本字串必須寫進 `pipeline-summary.json`(比照 `seg-v1` / `sync-v1` / `timeline-v1`)。

### 1.4 In scope / Out of scope

**In scope**

- `research/src/modules/ingest/algorithms/construct.py`(新:registry + 家族解析 + 檢查純函式 + flag 詞彙)
- `research/src/modules/ingest/algorithms/__init__.py`(公開新符號)
- `research/src/modules/ingest/algorithms/tests/test_construct.py`(新)
- `research/src/report/run_pipeline.py`(`constructPresence` 區塊 + exit code + stderr 訊息)
- `research/src/report/tests/test_run_pipeline.py`(擴充)
- `docs/operational/analysis-segments.md`(flag 詞彙表新增 session 級列 + “Real-export validation” 段加註)
- [research/README.md](../../../research/README.md)(fixture 表補構念判定欄)
- [CONTEXT.md](../../../CONTEXT.md)(新增 **construct presence gate** 一條,與既有 reliability gate 區隔)
- 帳本:KI-006 狀態 · BD-006 · [KI-005-A / A2-blocked-plan.md](../KI-005-A/A2-blocked-plan.md) 前置條件回寫 · [MAP.md](../../MAP.md) / [exec-plan/README.md](../../exec-plan/README.md) 的 KI-006 敘述

**Out of scope**(明確排除,防範圍蔓延)

| 排除項 | 歸屬 |
|---|---|
| **選項 B(重新採樣)本身** | **[KI-005-A / A2-T1](../KI-005-A/A2-blocked-plan.md)** —— 兩個 KI 的採集收斂為同一次。本檔只交付 **FR-C-14 的驗收清單**並回寫其前置條件 |
| **M14 ④⑤ 重新宣告** | **A2-T4**;需新採樣 **且** KI-005 的 ω 修法落地。C 落地**不**解除任何 M14 撤回(見 §6 註) |
| 引擎側 `DrillConfig.construct` / `meta.construct` 自我描述欄 | **不做**(2026-08-06 拍板 Python registry;理由與殘餘風險見 §2.2 D-C1 / TD-3) |
| `tracking_*` / `detection_*` 家族的具體條件 | **OQ-C-1** —— 其宣告值(peek 數 / 目標 motion)**今日不在 meta 內**(§2.4 ③),硬寫等於猜。先以 `construct_unknown` 誠實揭露 |
| 把構念判定接進 `coach_report` / `peek-quality.csv` | **OQ-C-3**;C-D3 的紅線目前由 `run_pipeline` 的 exit code 守住已足夠 |
| 對既有兩份匯出做任何回溯清洗或改寫 | 不做(比照 KI-005 OQ-KI5-3 的拍板精神;fixture 是證據,不可修改) |
| 任何 `src/` 改動、schema 版本變更 | 不做(NFR-C-1) |

---

## 2. 技術設計 (Technical Design)

### 2.1 System boundary

```
       既有閘門(全部只驗「形式」)                    本階段新增(驗「內容」)
   ┌────────────────────────────────┐        ┌─────────────────────────────┐
   │ load_export   → schema / 有限值 │        │ check_construct_presence     │
   │ check_dt      → tick 均勻性     │   +    │   ↳ 家族解析 → registry 條件  │
   │ test_purity   → algorithms 無 IO│        │   ↳ session 級判定 + 實測值   │
   │ epsilon-parity→ TS/Py 一致性    │        └─────────────────────────────┘
   └────────────────────────────────┘                     │
              ↑ 沒有任何一關問「量到的是不是要量的東西」      ▼
                                              run_pipeline:summary 區塊 + exit code
```

閘的**判定**是純函式(`algorithms/`,C-D2);**後果**(寫檔、印訊息、非零退出)一律落 `report/`。

### 2.2 關鍵設計決策

| # | 取捨 | 決定(2026-08-06 拍板) | 理由 / 殘餘風險 |
|---|---|---|---|
| **D-C1** | 構念宣告放引擎(`DrillConfig` → `meta.construct` 自我描述)還是 Python registry? | **Python registry** | ① **零引擎改動**,不動 schema、不 bump 版本、`npm run test:ci` 逐條不變;② **可回溯套用到既有匯出** —— 自我描述欄只對「補欄之後」的匯出有效,而本案最需要被擋下的正是既有的 08:03;③ 量化門檻屬**研究口徑**(OQ-KI6-3 的 pre-register 對象),寫進引擎 config 會讓「改門檻」變成「改引擎 + 重採資料」。**殘餘風險**:宣告與 `DrillConfig` 分離,新增 drill 不會被強制宣告 → 以 FR-C-4 的 `construct_unknown`(而非靜默通過)兜底,登錄為 **TD-3** |
| **D-C2** | 閘紅時 `load_export` 直接拋錯,還是 flag + 拒絕效度宣告? | **flag + 拒絕效度宣告** | `load_export` 拋錯會連 08:03 作為「零輸入邊界案例」的**正當用途**一起擋死(該用途現正記載於 [research/README.md](../../../research/README.md) 的 fixture 表)。C-D3 要求的是「不得進教練報告/效度宣告」,不是「不得載入」。故:資料可載入、可診斷,但 `run_pipeline` **非零退出**且 summary 明記 |
| **D-C3** | 構念缺席與家族未知是否共用一個 exit code? | **不共用**(FR-C-8 / FR-C-9) | 「這份資料裡沒有該行為」是**確定的壞消息**;「我不認得這個 drill 家族」是**未知**。把未知當缺席會讓每個新 drill 一上線就紅,閘會被關掉——這是所有品質閘的典型死法 |
| **D-C4** | 是否由 Python 從 `keys` + `vx` 自行推導 counter 事件以加強判定? | **不做**(C-4) | `counter` 的產生條件由 [SimLoop.ts:76](../../../src/loop/SimLoop.ts#L76) 權威。Python 自行推導 = 建立第二定義,踩 C-D4;且本案的診斷已確認**記錄邏輯正確**,問題在樣本 |
| **D-C5** | 門檻是「看了資料才定」,是否違反 pre-register 精神? | **明文揭露,不假裝** | 主判準 `count(counter) ≥ 1` 是**二元、無門檻**,已足以擋下 08:03(counter = 0)。橫移佔比是**輔助判準**,其下限取在**數量級落差**之間(0 vs 0.29),非擬合到決策邊界;§2.3 附完整證據表,任何後續調整必須升版(C-6)。此段須逐字保留於文件,供日後稽核 |

### 2.3 門檻的 pre-registration 證據(FR-C-2 / NFR-C-2 / OQ-KI6-3)

四份 committed fixture 的實測(T0 以可重跑腳本重現):

| fixture | `drillId` | ticks | `vx ≠ 0` | 橫移佔比 | `counter` | `construct-v1` 判定 |
|---|---|---:|---:|---:|---:|---|
| `...08_03_45.617Z` | `counterstrafe_ad_v1` | 3,507 | 0 | **0.0000** | **0** | ❌ **absent** |
| `...09_39_06.031Z` | `counterstrafe_ad_v1` | 2,723 | 1,415 | 0.5196 | 24 | ✅ present |
| `synthetic_counterstrafe.json` | `synthetic_counterstrafe_v2` | 48 | 14 | **0.2917** | 2 | ✅ present(家族經 `synthetic_` 剝離解析) |
| `synthetic_timeline.json` | `synthetic_timeline_v1` | 96 | 39 | 0.4062 | 3 | 見 §2.4 ② |

**凍結值(`construct-v1`)**:`min_counter_events = 1`、`min_moving_tick_ratio = 0.05`。

- 0.05 距**最小通過樣本**(0.2917)有 5.8× 邊際,距**缺席樣本**(0.0000)無窮大 —— 門檻落在數量級空隙,不是擬合到邊界。
- 兩個條件為 **AND**:`counter ≥ 1` 單獨即可擋下 08:03;佔比條件擋的是「按了反向鍵但幾乎沒在動」的退化樣本。

### 2.4 三個在計畫階段查碼才發現的事實

> 性質同 [KI-005-A §2.4](../KI-005-A/README.md)——不先講清楚就會在實作時撞上。

#### ① 合成 drillId 不是家族前綴的子集(FR-C-3)

committed 合成 fixture 的 `drillId` 是 `synthetic_counterstrafe_v2`,**不以 `counterstrafe` 開頭**。若家族解析寫成天真的 `drill_id.startswith('counterstrafe')`,合成 fixture 會落進 `construct_unknown`,閘等於在**唯一預設路徑**(`run_pipeline` 的 `DEFAULT_EXPORT` 就是它)上不生效。解析必須先剝離 `synthetic_` 前綴,並以測試釘死。

#### ② `synthetic_timeline_v1` 的家族歸屬須明示

該 fixture 有 3 個 `counter` 事件與 40.6% 橫移 tick(構念其實存在),但 `timeline` 不是已註冊家族。**不得**為了讓它變綠而擴大家族解析的猜測範圍(那正是「靜默通過」的另一種形式)。決定:歸 `construct_unknown`,並以測試釘死該判定 —— 這正是 FR-C-9「未知不阻擋」存在的理由。

#### ③ `tracking_*` / `detection_*` 家族的宣告值**不在 meta 內**

KI-006 §4-C 的表列了三個家族,但實際核對 `meta` 後:

| 家族 | KI-006 所列條件 | 今日可否實作 |
|---|---|---|
| `counterstrafe_*` | `counter > 0` 且橫移 tick 佔比 ≥ 下限 | ✅ `events` + `ticks.vx` 皆在 |
| `tracking_*` | 「存在具足夠 `age` 的移動目標」 | ❌ 目標 `motion` **不在 meta**(`meta.targets` 僅有 `hitbox`) |
| `detection_*` | 「`visible` 事件數 ≥ **宣告** peek 數」 | ❌ 宣告 peek 數(`endCondition.value`)**不在 meta** |

⇒ 本階段**只實作 `counterstrafe_*`**;另兩家族要嘛等 meta 補宣告值(engine additive,另案),要嘛由研究者改寫成可用今日欄位表達的條件。登錄為 **OQ-C-1 / TD-1**。這也是 D-C1 選 Python registry 的一個副作用被誠實暴露的地方:**registry 只能檢查匯出裡已有的東西**。

### 2.5 Interface contracts — Python

```python
# research/src/modules/ingest/algorithms/construct.py —— 新增

CONSTRUCT_PARAMS_VERSION = "construct-v1"

#: session 級 flag 的封閉詞彙。與 segments 的 QUALITY_FLAG_VOCABULARY 是
#: **不同層級**的兩套詞彙(peek/segment vs session),刻意不合併,以免 ingest
#: 反向依賴 segments。兩者共同登錄於 analysis-segments.md 的 flag 表(FR-C-10)。
CONSTRUCT_FLAG_VOCABULARY = (
    "construct_absent:<construct>",   # 唯一的 templated 形式
    "construct_unknown",
)


@dataclass(frozen=True)
class ConstructRule:
    """一個 drill 家族的核心構念宣告(凍結;調整須升版,C-6)。"""
    construct: str                 # 構念名,如 "counter-strafe"
    min_counter_events: int
    min_moving_tick_ratio: float


@dataclass(frozen=True)
class ConstructReport:
    """session 級判定。`present is None` ⇔ 家族未註冊(未知,非缺席)。"""
    drill_id: str
    family: str | None             # 解析出的家族;未知時 None
    construct: str | None          # 該家族宣告的構念;未知時 None
    present: bool | None
    params_version: str            # = CONSTRUCT_PARAMS_VERSION
    counter_event_count: int       # 實測(FR-C-6)
    tick_count: int
    moving_tick_count: int
    moving_tick_ratio: float       # tick_count == 0 時為 nan
    thresholds: ConstructRule | None
    flags: tuple[str, ...]         # () / ("construct_absent:counter-strafe",) / ("construct_unknown",)


#: 家族 → 條件。新增家族一律在此宣告,並同步升版 + 補測試。
CONSTRUCT_REGISTRY: Mapping[str, ConstructRule] = {
    "counterstrafe": ConstructRule(
        construct="counter-strafe",
        min_counter_events=1,
        min_moving_tick_ratio=0.05,
    ),
}


def resolve_drill_family(drill_id: str) -> str | None:
    """把 drillId 解析成註冊家族名。

    規則(FR-C-3):先剝離 ``synthetic_`` 前綴,再取第一個底線前的 token,
    比對 CONSTRUCT_REGISTRY。無對應者回 ``None``(→ construct_unknown)。
    純函式;不讀檔、不讀時鐘。
    """


def check_construct_presence(export: Export) -> ConstructReport:
    """判定 *export* 是否含其 drill 家族宣告的核心構念(FR-C-1)。

    只讀 ``export.meta['drillId']``、``export.events['type']``、``export.ticks['vx']``;
    單次 O(n) 掃描,無 I/O、無 print(C-D2)。
    ``counter`` 事件**只計數**,不從 keys/vx 重新推導(C-4 / D-C4)。
    """
```

`run_pipeline` 側(report tier,允許 I/O 與 console):

```python
# research/src/report/run_pipeline.py —— 新增

#: 構念缺席的專屬 exit code;與 schema/IO 失敗(1)可區分(FR-C-8 / D-C3)。
EXIT_CONSTRUCT_ABSENT = 2

# summary 新增 session 級區塊(FR-C-7);三個 artifact 照常寫出
summary["constructPresence"] = {
    "drillId": ..., "family": ..., "construct": ...,
    "present": ...,                  # true / false / null(未知)
    "paramsVersion": "construct-v1",
    "counterEventCount": ..., "tickCount": ...,
    "movingTickCount": ..., "movingTickRatio": ...,
    "thresholds": {"minCounterEvents": 1, "minMovingTickRatio": 0.05},
    "flags": [...],
}
```

`main()` 的行為表:

| 情況 | artifacts | stdout | stderr | exit |
|---|---|---|---|---|
| 構念存在 | 寫出 | 照常 + `construct present (construct-v1)` | — | 0 |
| 構念**缺席** | **仍寫出**(FR-C-7) | 照常 + 判定行 | 明示「此 session 不得用於 `<drill>` 的效度宣告」+ 實測值 | **2** |
| 家族**未知** | 寫出 | 照常 + `construct unknown` 警示行 | — | 0(FR-C-9) |
| schema / IO 失敗 | 不寫 | — | 既有訊息 | 1(不變) |

### 2.6 Failure modes

| # | 觸發條件 | 影響 | 處理策略 |
|---|---|---|---|
| **FM-1** | 家族解析對未來 drill 命名失效(如 `cs_ad_v2`、`counterStrafe_*`) | 該 drill 靜默不受閘保護 | 回 `construct_unknown` **而非通過**(FR-C-4);`run_pipeline` stdout 明示未知,人看得見。命名慣例於 T3 寫入 [CONTEXT.md](../../../CONTEXT.md) |
| **FM-2** | `ticks` 為空 ⇒ 佔比為 `0/0` | `nan` 進 JSON(`allow_nan=False` 會拋) | 佔比定義為 `nan`,但 `_json_safe` 既有機制已把非有限數轉 `None`;`present` 在 `tick_count == 0` 時判 **False**(空資料不可能含構念),以測試釘死 |
| **FM-3** | 門檻日後被就地調整以「讓某個樣本過關」 | pre-registration 失效,閘變成事後合理化工具 | C-6 凍結 + `paramsVersion` 寫進每份 summary;T3 於 flag 表與 [analysis-segments.md](../../operational/analysis-segments.md) 的參數登錄段明記「調整須升版」 |
| **FM-4** | exit code 2 讓既有自動化把 pipeline 誤判為壞掉 | 閘被繞過或關掉 | 與 schema 失敗的 1 **刻意分流**(D-C3);stderr 訊息說明「pipeline 正常完成,artifacts 已寫出,拒絕的是效度用途」;`run_pipeline` 目前僅由人手與測試呼叫,無 CI 消費者(T0 複查) |
| **FM-5** | 有人把本閘當成 reliability gate,誤以為「閘綠 = 指標有效」 | C-D3 紅線被稀釋 | C-5:CONTEXT.md 兩條詞條並列且互相指路;summary 區塊命名為 `constructPresence`(非 `validity`);T3 於 KI-006 §5 影響表加註「C 落地不解除任何 M14 撤回」 |
| **FM-6** | 合成 fixture 因家族解析失誤落進 unknown | 閘在預設路徑上不生效,且**測試會綠**(unknown 不阻擋) | §2.4 ① 的專屬測試:`synthetic_counterstrafe_v2` 必須解析出家族 `counterstrafe` 且判 **present**,不得為 unknown |

### 2.7 Concurrency model

**不適用**。全部為單執行緒純函式與既有 `run_pipeline` 的同步流程;不新增 I/O、不新增共享狀態、不觸及引擎三迴圈(ADR-2)。

---

## 3. 風險分析 (Risk Analysis)

### 3.1 風險登錄

| # | 風險 | 等級 | 說明 / 緩解 |
|---|---|---|---|
| **R-1** | 閘只擋得住「已知家族 + 已在匯出裡的量」,給人虛假的全面感 | **Med** | §2.4 ③ 誠實列出 `tracking_*`/`detection_*` 今日不可實作;`construct_unknown` 讓缺口在每次跑 pipeline 時可見,而非靜默 |
| **R-2** | 門檻的 pre-register 正當性(資料已被看過) | Med | D-C5 + §2.3:主判準二元無門檻;輔助門檻落在數量級空隙;證據表逐條保留供稽核 |
| **R-3** | exit code 2 的語意被誤解為「pipeline 壞了」 | Med | FM-4;T0 先複查是否有任何 CI/腳本消費 `run_pipeline` 的 exit code |
| **R-4** | 有人以為 C 落地就能重新宣告 M14 ④⑤ | Med | §6 註 + FM-5:C **不解除任何撤回**。④⑤ 需 A2-T2/T3(新採樣 + `seg-v2`)且 ④ 需 KI-006 自身經由**新樣本**解除 |
| **R-5** | registry 與 `DrillConfig` 分離導致長期漂移(TD-3) | Low | `construct_unknown` 兜底;若日後 drill 數量成長,再評估 D-C1 的 hybrid 方案(engine 宣告構念名 + Python 定門檻) |
| **R-6** | 新 flag 詞彙與既有 `QUALITY_FLAG_VOCABULARY` 混用 | Low | 刻意**不合併**(避免 ingest → segments 反向依賴);兩套詞彙在同一張文件表以 Level 欄區隔(FR-C-10) |

### 3.2 Technical debt(有意識的妥協)

| # | 妥協 | 原因 | 後續處理 | 觸發條件 |
|---|---|---|---|---|
| **TD-1** | 只實作 `counterstrafe_*` 一個家族 | 另兩家族的宣告值不在 meta(§2.4 ③),硬寫等於猜 | **OQ-C-1**:研究者定義可用今日欄位表達的條件,或 engine 補 additive 宣告欄 | `tracking_*` / `detection_*` drill 首次產出 committed 匯出**之前** |
| **TD-2** | 門檻為單一全域值,無 per-drill 覆寫 | 目前只有一個家族、一個 drill,覆寫機制無使用者 | 若第二個 counterstrafe 變體出現且節奏不同,升 `construct-v2` 並引入 per-drill 覆寫 | 新 counterstrafe drill 上線 |
| **TD-3** | 構念宣告不在 `DrillConfig`,新增 drill 不被強制宣告 | D-C1:換取零引擎改動 + 可回溯套用既有匯出 | `construct_unknown` 兜底;drill 數量成長後再評估 hybrid | drill 家族 ≥ 3 或出現「以為有閘其實沒有」的事件 |
| **TD-4** | 構念判定不進 `peek-quality.csv` / `coach_report` | 紅線目前由 `run_pipeline` exit code 守住已足夠 | **OQ-C-3** | 教練報告開始消費真實資料時 |

---

## 4. 任務拆解 (Task Breakdown)

> 每個 task = 一個垂直切片 = 一個原子 commit(CLAUDE.md §3.1)。當前 task 未 commit 不開下一個。
> 完整逐步驟 / DoD / commit message 見各 task 檔;本表為索引與相依。

| Task | 目標 | 相依 | 風險 | 複雜度 | Definition of Done(摘要,權威在 task 檔) |
|---|---|---|---|---|---|
| [T0](T0-entry-gate.md) | Entry gate:基線紅綠燈 · **§2.3 四份 fixture 統計以可重跑腳本重現** · 消費者盤點(exit code / flag 詞彙 / fixture 用途) | — | Low | Low | 三條基線指令 exit 0 與案數記入 `progress.md`;§2.3 表逐格重現(08:03 佔比 0.0000 / counter 0;09:39 0.5196 / 24;合成 0.2917 / 2;timeline 0.4062 / 3),對不上即停;確認無 CI/腳本消費 `run_pipeline` exit code(R-3);`git status` 乾淨 |
| [T1](T1-construct-registry.md) | `construct.py`:registry `construct-v1` + 家族解析 + 檢查純函式 + flag 詞彙(FR-C-1~6, 9) | T0 | Med | Med | 四份 fixture 判定符合 §2.3 表(08:03 **absent**、09:39 present、`synthetic_counterstrafe_v2` **present 且家族 = `counterstrafe`**、`synthetic_timeline_v1` **unknown**);`ConstructReport` 具名揭露實測值與門檻;空 ticks / 未知家族 / counter=0 但佔比達標 / 佔比不足但 counter>0 四個邊界案有測試;`test_purity.py` 綠;`uv run pytest` exit 0 |
| [T2](T2-pipeline-wiring.md) | `run_pipeline` 佈線:`constructPresence` 區塊 + 專屬 exit code + stderr 訊息(FR-C-7/8) | T1 | Low | Low | 以 08:03 跑 `run_pipeline` → **exit 2**、三個 artifact **仍寫出**、summary 含 `constructPresence.present == false` 與 `construct_absent:counter-strafe`;以 09:39 與預設合成 fixture 跑 → exit 0 且 `present == true`;`synthetic_timeline` → exit 0 且 `present == null`;`allow_nan=False` 的 JSON 序列化不拋(FM-2);既有 `test_run_pipeline.py` 案**無期望值改寫**(僅新增斷言) |
| [T3](T3-docs-ledger-reconcile.md) | 文件 / 帳本對帳 + **A2 前置條件回寫**(FR-C-10~14) | T2 | Low | Low | [analysis-segments.md](../../operational/analysis-segments.md) flag 表新增 Level 欄與兩個 session 級 flag + “Real-export validation” 段加註「所述樣本不含 counter-strafe」;[research/README.md](../../../research/README.md) fixture 表補構念判定;[CONTEXT.md](../../../CONTEXT.md) 新增 **construct presence gate** 詞條並與 **reliability gate** 互相指路(C-5);KI-006 狀態 + §4-C 標「已落地」+ §6 OQ-KI6-2 關閉;BD-006 補「C 落地」段;[A2-blocked-plan.md](../KI-005-A/A2-blocked-plan.md) 前置清單改為引用本檔 §6 的驗收清單;`grep` 複查無「C 落地 = M14 解除」字樣 |
| [T-exit](T-exit-gate.md) | Exit gate:C 交付判定 | T3 | Low | Low | §5 的硬閘逐條打勾附證據;NFR 全數量化達標;無 open red |

**相依圖**

```
T0 ──► T1 ──► T2 ──► T3 ──► T-exit
        │       │
        │       └─ 純函式契約是佈線的前提
        └─ T0 的實測表是 T1 測試期望值的唯一來源
```

嚴格序列化。T1 的測試期望值直接取自 T0 的重現數字;T0 對不上就代表對 fixture 或口徑的理解有誤,先停。

**commit 顆粒度**:四個 task 各自一個原子 commit,**無 TDD 偏離**——本階段是「新增一道閘」,新測試從第一次執行就綠(閘擋下 08:03 是**預期行為**,不是既有 bug 轉綠),與 [BD-001](../BUGFIX-DECISIONS.md) 的紅→綠合併情境不同。

**FR → Task 對應完整性檢查**

| FR | Task | | FR | Task |
|---|---|---|---|---|
| FR-C-1 | T1 | | FR-C-8 | T2 |
| FR-C-2 | T1 | | FR-C-9 | T1 · T2 |
| FR-C-3 | T1 | | FR-C-10 | T1 · T3 |
| FR-C-4 | T1 | | FR-C-11 | T1 · T2 |
| FR-C-5 | T1 | | FR-C-12 | T3 |
| FR-C-6 | T1 | | FR-C-13 | T3 |
| FR-C-7 | T2 | | FR-C-14 | T3 |

---

## 5. C Exit Gate(交付判定)

> 逐條可客觀驗證;證據回填 [T-exit-gate.md](T-exit-gate.md)。

| # | 條件 | 驗證方式 |
|---|---|---|
| **G-1** | **閘擋得住**:08:03 匯出判定 `present == false`、flag `construct_absent:counter-strafe`,`run_pipeline` **exit 2** | `uv run pytest` + 實跑 `run_pipeline --export <08:03>` 的 exit code |
| **G-2** | **閘不誤殺**:09:39 與 `synthetic_counterstrafe` 皆 `present == true`、exit 0;後者的家族解析為 `counterstrafe`(非 unknown,FM-6) | `uv run pytest` |
| **G-3** | **未知不阻擋**:`synthetic_timeline_v1` 判 `present == null` + `construct_unknown`,exit **0** | `uv run pytest` |
| **G-4** | **artifacts 不因閘紅而消失**:08:03 跑完後三個 artifact 皆存在且 summary 含 `constructPresence` | 實跑輸出 + 測試 |
| **G-5** | **引擎零改動**:`git diff --stat` 不含任何 `src/` 路徑;`npm run test:ci` 案數與期望值對照 T0 基線逐條不變 | `git diff --stat` + `npm run test:ci` |
| **G-6** | 全套回歸:`npx tsc --noEmit` · `npm run test:ci` · `uv run pytest` 三條 exit 0;`test_purity.py` 綠 | 三條指令的實際輸出(檔數/案數)記入 progress |
| **G-7** | **版本可稽核**:每份 summary 含 `paramsVersion == "construct-v1"` 與完整門檻值 | 實跑產物 |
| **G-8** | **文件不誤導**:`grep` 複查全 repo 無「construct gate 落地 ⇒ M14 ④⑤ 可重新宣告」意涵的敘述;KI-006 §5 影響表已加註 | `grep -rn` 輸出附於 T-exit |

> **C exit gate 明確不包含任何 M14 重新宣告**。C 交付的是「**下次不會再量錯對象**」,不是「這次量對了」。M14 ④⑤ 的解除仍需 [A2-T2/T3/T4](../KI-005-A/A2-blocked-plan.md) 的新採樣 + `seg-v2`,且 ④ 的 KI-006 這條理由**只能由新樣本本身**解除。

---

## 6. 交給 A2-T1 的驗收清單(FR-C-14;選項 B 的 KI-006 條件)

> 選項 B 的執行落在 [KI-005-A / A2-T1](../KI-005-A/A2-blocked-plan.md)。本節是該次採集必須額外滿足的 **KI-006 條件**,T3 會把 A2 的前置清單改為引用此處,避免兩份文件各寫一半。

| # | 條件 | 驗收方式 |
|---|---|---|
| **B-1** | 採集**前**明確要求受試者執行完整 counter-strafe(橫移 → 反向急停 → 停穩首發),而非站樁 flick | 採集條件記錄於 `progress.md` |
| **B-2** | 每份新匯出通過 `check_construct_presence` 且 `present == true` | `run_pipeline` exit 0 + summary `constructPresence` |
| **B-3** | 採完**立即**跑本閘;不合格即當場重採,不得事後才發現 | A2-T1 的 DoD |
| **B-4** | session 數依 **OQ-KI6-4** 決議(建議 n ≥ 2,以免單一 session 的行為特異性再度成為單點故障) | 待研究者拍板;A2-T1 前必須有結論 |
| **B-5** | 同時滿足 KI-005 A2-T1 的條件(240 Hz 機台、匯出含 `meta.mouseIntegration` + `ticks[].dYaw/dPitch`) | 見 [A2-blocked-plan.md](../KI-005-A/A2-blocked-plan.md) |

---

## 7. Open Questions(C 專屬;KI-006 §6 的 OQ-KI6-* 不重複)

| # | 問題 | 現況 / 建議 | Owner | Deadline | 影響 Task |
|---|---|---|---|---|---|
| ~~**OQ-C-0**~~ | ~~構念宣告放引擎還是 Python registry?~~ | ✅ **關閉(2026-08-06)**:**Python registry**(D-C1)。連帶:閘紅為 flag + 非零 exit(D-C2)、選項 B 委派 A2(§6) | 使用者 | — | T1 · T2 |
| **OQ-C-1** | `tracking_*` / `detection_*` 家族的條件如何定義?其宣告值今日不在 meta(§2.4 ③) | 🟡 兩條路:① 研究者改寫成可用今日欄位表達的條件;② engine 補 additive 宣告欄(`meta.targets.motion` / `endCondition.value`)。本階段一律 `construct_unknown` | 研究者 | 該家族 drill **首次產出 committed 匯出前** | 無(TD-1) |
| **OQ-C-2** | **OQ-KI6-4**(n ≥ 2 session)的決議 | 🟡 **未決**;建議 n ≥ 2 並趁 A2-T1 一次滿足。本檔 §6 B-4 已預留欄位 | 研究者 | **A2-T1 前** | 無(§6) |
| **OQ-C-3** | 構念判定是否也要進 `peek-quality.csv` / `coach_report` 的效度層級欄? | 🟡 建議**先不做**(TD-4);紅線目前由 exit code 守住。教練報告開始吃真實資料時再議 | 研究者 | 教練報告消費真實資料前 | 無 |
| **OQ-C-4** | 構念缺席的 exit code 用 `2`,是否與未來其他「資料可用但不可宣告」的閘共用? | 🟡 建議 `2` 保留給**構念層**拒絕;其他類別另取號並在 `run_pipeline` docstring 列表 | 實作者 | **T2 實作時** | T2 |
| **OQ-C-5** | 是否要求 `run_pipeline` 在構念缺席時**額外**拒絕輸出 `peek-segments.csv`(避免有人拿去做分段效度宣告)? | 🟡 建議**不拒絕**(D-C2:資料可診斷、用途才受限);若日後發生誤用再收緊 | 研究者 | — | 無 |

---

## 8. 上游引用

| 文件 | 用途 |
|---|---|
| [KI-006](../KI-006-m14-sample-no-counterstrafe.md) | 診斷、A 出局、B 唯一路徑、§4-C 選項原文(本檔的權威上游) |
| [BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) BD-006 | 決策入帳;架構層結論「一致性閘與目視檢核無法發現量錯了對象」 |
| [KI-005-A / A2-blocked-plan.md](../KI-005-A/A2-blocked-plan.md) | 選項 B 的執行落點;本檔 §6 的驗收清單於 T3 回寫其前置條件 |
| [KI-004 / S1](../KI-004-S1/README.md) | 本檔的結構範本;「補正確性閘」與「凍結參數 + 具名揭露」兩個模式直接沿用 |
| [CLAUDE.md §3 / §4](../../../CLAUDE.md) | 執行協議、硬約束(C-D1/C-D2/C-D3/C-D4) |
| [CONTEXT.md](../../../CONTEXT.md) | 正規術語;**reliability gate** 既有詞條(C-5 必須區隔),T3 新增 **construct presence gate** |
| [analysis-segments.md](../../operational/analysis-segments.md) | quality flag 封閉詞彙與參數登錄的 prose 權威;T3 新增 session 級 flag 與 “Real-export validation” 加註 |
| [research/README.md](../../../research/README.md) | fixture 表(08:03 的「零輸入邊界案例」正當用途,D-C2 的依據);T3 補構念判定欄 |
