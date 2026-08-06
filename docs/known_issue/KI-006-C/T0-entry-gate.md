# T0 — Entry gate:基線量測 + fixture 構念統計重現

> 上游:[C README](README.md) · [KI-006](../KI-006-m14-sample-no-counterstrafe.md) · [BD-006](../BUGFIX-DECISIONS.md)
> 目標:在動任何程式碼**之前**,把 §2.3 的門檻證據表**獨立重現一次**。T1 的所有測試期望值都取自這張表——表錯,閘就會凍結在錯的門檻上,而且看起來是綠的。

**In scope**:量測、盤點、寫入 `progress.md`。**Out of scope**:任何 `research/` / `src/` 程式碼改動。

---

## Steps

### 1. 決策前提確認(讀,不改)

- [ ] [BD-006](../BUGFIX-DECISIONS.md) §2 條目存在,且「A 已出局、B 唯一路徑、C 建議無論如何都做」可逐條引用。
- [ ] [KI-006 §4](../KI-006-m14-sample-no-counterstrafe.md) 的選項 C 表與本計畫 [README §2.5](README.md) 的 registry 對得上(**注意**:§2.4 ③ 已確認只有 `counterstrafe_*` 那一列今日可實作)。
- [ ] 確認尚未有任何程式碼改動:`git status` 乾淨。

### 2. 基線紅綠燈(三條指令,記錄實際輸出)

```bash
npx tsc --noEmit
```

```bash
npm run test:ci
```

```bash
uv run pytest
```

逐條記下 **exit code + 檔數/案數**。`npm run test:ci` 的數字是 **G-5「引擎零改動」** 的對照基準(C 階段結束時必須逐條相同)。

> Windows 註記:KI-004/S1 的 T-exit 曾遇到 `uv run pytest` 因 `AppData\Local\Temp` ACL 而 PermissionError,解法是設 workspace 內的 `TEMP`/`TMP`。若重現,照辦並記入 progress,**不視為紅**。

### 3. 重現 §2.3 的構念統計表(本 task 的核心動作)

寫一支**臨時**腳本(放 scratchpad,**不進 repo**),對 `research/fixtures/exports/` 下四份 committed fixture 各輸出:

- `meta.drillId`
- `len(ticks)`、`count(ticks.vx != 0)`、兩者的比值
- `count(events.type == 'counter')`、`count(events.type == 'visible')`
- `count(ticks.keys != [])`(輔助交叉檢查,不是判準)

- [ ] 與 [README §2.3](README.md) 表逐格比對:

  | fixture | 佔比 | counter |
  |---|---:|---:|
  | `...08_03_45.617Z` | 0.0000 | 0 |
  | `...09_39_06.031Z` | 0.5196 | 24 |
  | `synthetic_counterstrafe.json` | 0.2917 | 2 |
  | `synthetic_timeline.json` | 0.4062 | 3 |

- [ ] **對不上就先停** —— 代表對 fixture 或口徑的理解有誤,門檻不可在此基礎上凍結。
- [ ] 順帶記下 `synthetic_counterstrafe.json` 的 `drillId` 確為 **`synthetic_counterstrafe_v2`**(§2.4 ① 的家族解析陷阱來源)。

### 4. 消費者盤點(R-3 / FM-4 的前置)

- [ ] `grep -rn "run_pipeline" --include=*.py --include=*.yml --include=*.yaml --include=*.json --include=*.md .` —— 確認目前**沒有** CI job / npm script / 其他腳本消費 `run_pipeline` 的 exit code。若有,列出並評估 exit 2 的衝擊。
- [ ] 記下 `research/src/report/tests/test_run_pipeline.py` 的現有案數與涵蓋範圍(T2 只能**新增**斷言,不得改寫既有期望值,NFR-C-4)。
- [ ] 記下 `QUALITY_FLAG_VOCABULARY`([apply.py:21](../../../research/src/modules/segments/algorithms/apply.py#L21))的完整內容與 [analysis-segments.md](../../operational/analysis-segments.md) flag 表的現有形狀(T1/T3 要加 Level 欄)。
- [ ] 確認 `research/src/modules/ingest/algorithms/tests/test_purity.py` 檢查了哪些條件(新模組必須通過同一組)。

### 5. 剩餘 OQ 確認(不阻塞 T0)

- [ ] **OQ-C-4**(exit code 用 2)於 T2 開工前確認。
- [ ] **OQ-C-1**(tracking/detection 家族條件)與 **OQ-C-2**(n ≥ 2 session)屬研究者決策,**不阻塞本階段**——本階段一律 `construct_unknown`。

---

## Definition of Done

- [ ] 三條基線指令的 **exit code 與案數**已記入 [progress.md](progress.md)。
- [ ] §2.3 的四份 fixture 統計**獨立重現成功**且與 README 表逐格相符(佔比取到小數點後四位)。
- [ ] `synthetic_counterstrafe.json` 的 `drillId = synthetic_counterstrafe_v2` 已確認並記錄。
- [ ] `run_pipeline` 的 exit code 消費者盤點完成,結論寫入 progress(預期:無外部消費者)。
- [ ] `test_run_pipeline.py` 現有案數、`QUALITY_FLAG_VOCABULARY` 內容、`test_purity.py` 檢查項皆已抄錄。
- [ ] `git status` 顯示只有 `docs/known_issue/KI-006-C/` 下的文件變動,`src/` 與 `research/` 零改動。

## Commit message

```
docs(ki-006): C T0 entry gate — 基線紅綠燈 + 四份 fixture 構念統計重現 + 消費者盤點
```
