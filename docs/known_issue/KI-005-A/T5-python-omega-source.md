# T5 — Python `omega_deg_s` 新欄位路徑 + `source` 揭露

> 交付 **FR-A-11 / FR-A-12** · 上游:[A README §2.5 D-A3 / §2.6 FM-5](README.md) · 依賴:**T4 已 commit**(或與 T4 合併)。
> 性質:**離線消費端接上新來源**,並讓「用了哪條路」在資料上可見而非隱形。

**In scope**:`research/src/modules/kinematics/algorithms/angular.py` · `research/src/modules/ingest/algorithms/loader.py` · `research/src/report/run_pipeline.py` · `research/src/modules/ingest/algorithms/synthetic.py` + `research/fixtures/exports/synthetic_counterstrafe.json` · 對應 pytest。
**Out of scope**:`epsilon_deg` / `on_target` / `resolve_eye_origin`(KI-004 的構念,**不動**)· `segment_submovements` 與 `seg-v1` 參數(A2-T3)· 文件對帳(T6)。

---

## 設計要點:一個函式、兩個來源、一個 source 旗標

比照 [KI-004 / S1 T5](../KI-004-S1/T5-python-parity-sync.md) 的 `EyeOriginSource` 模式——**不是**寫兩個函式,而是**同一個數學核心 + 具名的來源揭露**:

```python
OmegaSource = Literal["tick-integral", "aim-diff-legacy"]

@dataclass(frozen=True)
class OmegaResult:
    values: np.ndarray          # deg/s,index 0 為 nan(契約不變,見 D-A3)
    source: OmegaSource

def omega_deg_s(
    ticks: pd.DataFrame,
    *,
    strict: bool = False,
) -> OmegaResult: ...
```

**解析優先序**

```
1. ticks 含 d_yaw + d_pitch 兩欄且全為有限值  → source = "tick-integral"
2. 否則退回 yaw/pitch 差分                    → source = "aim-diff-legacy"
   —— 該路徑帶 KI-005 的 ZOH aliasing,僅供讀取 pre-KI-005 匯出
3. strict=True 且落到 (2) → raise ValueError
```

**兩條路徑的數學核心相同**(C-5 / C-D4,FM-5):

| | `tick-integral` | `aim-diff-legacy` |
|---|---|---|
| `delta_yaw` | `d_yaw[i]` | `yaw[i] − yaw[i−1]` |
| `delta_pitch` | `d_pitch[i]` | `pitch[i] − pitch[i−1]` |
| `midpoint_pitch` | `pitch[i] − d_pitch[i] / 2` | `(pitch[i−1] + pitch[i]) / 2` |
| `dt_s` | `(t[i] − t[i−1]) / 1000` | 同左 |
| 速度 | `hypot(delta_yaw × cos(midpoint_pitch), delta_pitch) / dt_s` | 同左 |

> 兩者只差「delta 從哪來」。`midpoint_pitch` 的兩個式子在 `tick-integral` 下**是同一個量**(因為 `pitch[i] − d_pitch[i]` 就是 `pitch[i−1]`,守恆閘保證),故無第二定義。

**D-A3 明文**:`tick-integral` 下 `omega[0]` 其實**有定義**(tick 0 有自己的窗),但契約維持 `nan`——[analysis-segments.md](../../operational/analysis-segments.md) 與 D-28.12(`omega[1:]`)已凍結,為一個樣本改契約會連動 `seg-v1` 與全部既有測試。該樣本**刻意捨棄**,登錄為 TD-3,於 `seg-v2` 重掃(A2-T3)時一併決定。

---

## Steps

### 1. `loader.py`(FR-A-12)

- [ ] `TICK_COLUMNS` 在 `pitch` 之後插入 `d_yaw`、`d_pitch`(對應匯出 JSON 的 `dYaw` / `dPitch`)。
- [ ] tick 驗證:兩欄**缺席時填 `nan` 且不報錯**(pre-KI-005 匯出);存在時須為有限數。
- [ ] ⚠️ 欄位命名走 Python 側的 snake_case 慣例(與既有 `yaw`/`pitch` 由 `aim.yaw`/`aim.pitch` 展平同理),映射關係寫進 loader 的 docstring。
- [ ] `Export.meta` 原樣保留 `mouseIntegration`(dict 直通,無需驗證——loader 的既有慣例)。

### 2. `angular.py`(FR-A-11)

- [ ] 新增 `OmegaSource` / `OmegaResult`,改寫 `omega_deg_s` 如上。
- [ ] **簽名破壞性變更**:回傳型別由 `np.ndarray` 改為 `OmegaResult`。呼叫端須全部更新(§3)。
  - 刻意**不留**「回傳裸 ndarray」的相容路徑——留著就等於留著「靜默用到帶 aliasing 的 ω 而不自知」的入口(與 [KI-004 T5](../KI-004-S1/T5-python-parity-sync.md) 對 `eye_height` 位置參數的處理同一理由)。
- [ ] `strict=True` 落到 `aim-diff-legacy` → `raise ValueError`,錯誤訊息指出「此匯出缺 `dYaw`/`dPitch`,ω 帶 KI-005 的 render/sim aliasing;見 docs/known_issue/KI-005-*」。
- [ ] 保留既有的 `t` 嚴格遞增檢查與 index 0 = `nan` 契約。

### 3. 呼叫端更新

- [ ] `research/src/report/run_pipeline.py`:改吃 `OmegaResult`;**走 `strict=False`**(仍要能對舊匯出跑診斷),但把 `source` 寫進 `pipeline-summary.json` 的頂層 identity 區塊 ⇒ **每次跑都自曝用了哪條路**(R-5)。
  - 若 `source == "aim-diff-legacy"`,summary 額外帶一個 human-readable 警示字串,指向 KI-005。
- [ ] `research/src/modules/segments/notebooks/t3-sweep/run_sweep.py`(若引用 `omega_deg_s`)同步更新。
- [ ] `research/src/modules/kinematics/algorithms/tests/test_angular.py` 全面改新回傳型別。

### 4. 合成 fixture 補欄

- [ ] `research/src/modules/ingest/algorithms/synthetic.py` 的 `make_synthetic_export`:同時產出 `ticks[].dYaw/dPitch` 與 `meta.mouseIntegration`,且**與 `aim` 序列自洽**(`d_yaw[i] == yaw[i] − yaw[i−1]`,`d_yaw[0] == yaw[0] − 初始 yaw`)。
- [ ] `research/fixtures/exports/synthetic_counterstrafe.json` 同步重產。
  - ⚠️ 合成路徑**不經過 render path**,故新舊兩條 ω 路徑在此 fixture 上**應逐位相同**——這正好是 FM-5 的「無第二定義」證據(見 §5 測試)。
- [ ] ⚠️ 兩份**真實** fixture(08:03 / 09:39)**不補欄**——它們是歷史匯出,必須保留為 `aim-diff-legacy` 的回歸樣本,證明 fallback 路徑與 strict 拋錯真的會發生(比照 [KI-004 T2](../KI-004-S1/T2-export-meta-additive.md) 對兩份 fixture 的處理)。

### 5. 測試

- [ ] **無第二定義**(FM-5):對補欄後的合成 fixture,`tick-integral` 與 `aim-diff-legacy` 兩路徑的 ω 陣列 **逐位相同**(`np.allclose` 不夠,用 `array_equal` 或 ≤ 1e-15 相對誤差)。
- [ ] `source` 三種情境:補欄 fixture → `"tick-integral"`;08:03 真實 fixture → `"aim-diff-legacy"`;只有 `d_yaw` 沒有 `d_pitch`(半欄)→ **視為 miss**,退 legacy(不得半猜半讀,比照 KI-004 的 `'meta'` 分支規則)。
- [ ] `strict=True`:對真實 fixture 拋 `ValueError`;對補欄 fixture 不拋。
- [ ] `omega[0]` 在**兩條路徑**下皆為 `nan`(D-A3 契約)。
- [ ] `loader`:缺欄舊匯出載入不報錯且兩欄為 `nan`;補欄匯出兩欄為有限值。
- [ ] `run_pipeline`:`pipeline-summary.json` 含 `source`;對真實 fixture 帶警示字串。
- [ ] C-D1 複驗:`test_purity.py` 通過(新增 docstring 措辭避開 `.ts` 子字串——[KI-004 S1-D17](../KI-004-S1/progress.md) 的既知坑)。

### 6. 回歸

- [ ] `uv run pytest`(Windows 下建議 `--basetemp=C:\pytest-tmp`,見 [KI-004 progress S-S1.3](../KI-004-S1/progress.md))
- [ ] `npm run test:ci` —— 合成 fixture 若被 TS 側 golden 引用(`tests/golden/research/`),需一併轉綠。
- [ ] `npx tsc --noEmit`

---

## Definition of Done

- [ ] `omega_deg_s` 回傳 `OmegaResult`,三條解析規則(tick-integral / 半欄 miss / legacy)與 strict 拋錯皆有測試。
- [ ] **無第二定義**:補欄合成 fixture 上兩路徑 ω **逐位相同**,有測試。
- [ ] `omega[0]` 在兩條路徑下皆為 `nan`(D-A3 契約不變)。
- [ ] 三處呼叫端(`run_pipeline.py`、`run_sweep.py`、`test_angular.py`)全部更新;**未留**回傳裸 ndarray 的相容路徑。
- [ ] `pipeline-summary.json` 含 `source`,且 legacy 時帶指向 KI-005 的警示字串。
- [ ] `loader.py` 的 `TICK_COLUMNS` 含兩個新欄;缺欄舊匯出載入不報錯(填 `nan`)。
- [ ] 合成 fixture 已補欄且與 `aim` 序列自洽;**兩份真實 fixture 未被改動**(`git diff` 複查)。
- [ ] `uv run pytest` exit 0;`npm run test:ci` exit 0;`npx tsc --noEmit` exit 0。
- [ ] `test_purity.py` 通過(C-D1)。

## Commit message

> 若 T4 + T5 合併(README §4 的顆粒度說明),使用下列合併版 message;否則刪去 T4 段落。

```
feat(ki-005): tick 窗積分 ω 來源落地 + Python 消費端接上並具名揭露 source

KI-005 / A(FR-A-1/4/7/9/10/11/12;T4+T5 合併為單一已驗證綠的 commit,理由見
KI-005-A/README.md §4 —— 合成 fixture 補欄會讓 Python 測試先紅)。

TS 側:consume() 早已依 event.timeStamp 把滑鼠事件精確分桶到唯一正確的 tick,
只是 applyInput 直接丟棄。補上該分支後,每個事件依自身時間戳落進唯一正確的
tick ⇒ 結構上不可能有 render/sim ZOH aliasing,且與 displayHz 無關。積分器
狀態在 DataRecorder 閉包(data 層),不進 SharedState ⇒ sim 演進零 diff。

Python 側:omega_deg_s 改回傳 OmegaResult(values + source)。優先吃
d_yaw/d_pitch(source="tick-integral"),缺席退 yaw/pitch 差分
(source="aim-diff-legacy",帶 KI-005 的 aliasing),半欄視為 miss;strict=True
落到 legacy 即拋錯。兩條路徑共用同一數學核心,只差 delta 從哪來 —— 以「補欄
合成 fixture 上兩路徑逐位相同」的測試證明無第二定義(C-D4)。

omega[0] 在 tick-integral 下其實已有定義,但契約維持 nan:analysis-segments.md
與 D-28.12 已凍結,為一個樣本改契約會連動 seg-v1 與全部既有測試。該樣本刻意
捨棄,登錄 TD-3,於 seg-v2 重掃時一併決定。

兩份真實 fixture(08:03 / 09:39)刻意不補欄 —— 保留為 aim-diff-legacy 與
strict 拋錯的回歸樣本。
```
