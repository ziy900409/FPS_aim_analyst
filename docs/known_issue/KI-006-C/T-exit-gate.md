# T-exit — C Exit gate:交付判定

> 上游:[C README §5](README.md) · [KI-006 §4-C](../KI-006-m14-sample-no-counterstrafe.md)
> 依賴:T0–T3 全數 commit。本檔為**證據回填表**,不新增改動。

---

## 1. 硬閘(G-1 ~ G-8)

| # | 條件 | 驗證方式 | 結果 | 證據 |
|---|---|---|---|---|
| **G-1** | **閘擋得住**:08:03 判定 `present == false` + `construct_absent:counter-strafe`,`run_pipeline` **exit 2** | `uv run pytest` + 實跑 | ✅ | `test_construct.py`/`test_run_pipeline.py` 綠(見 G-6)。實跑:`uv run python src/report/run_pipeline.py --export "fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json" --out <tmp>` → `EXIT=2`;`pipeline-summary.json.constructPresence == {drillId: "counterstrafe_ad_v1", family: "counterstrafe", construct: "counter-strafe", present: false, paramsVersion: "construct-v1", counterEventCount: 0, tickCount: 3507, movingTickCount: 0, movingTickRatio: 0.0, thresholds: {minCounterEvents: 1, minMovingTickRatio: 0.05}, flags: ["construct_absent:counter-strafe"]}`;stderr 明示「this session must not be used for a validity claim about 'counterstrafe_ad_v1'」 |
| **G-2** | **閘不誤殺**:09:39 與 `synthetic_counterstrafe` 皆 `present == true`、exit 0;後者 `family == "counterstrafe"`(非 unknown,FM-6) | `uv run pytest` | ✅ | 實跑 09:39 → `EXIT=0`,`constructPresence.present == true`,`counterEventCount=24`,`movingTickRatio≈0.5196`。實跑 `synthetic_counterstrafe.json`(= `DEFAULT_EXPORT`)→ `EXIT=0`,`family == "counterstrafe"`(非 unknown)、`present == true`、`counterEventCount=2`、`movingTickRatio≈0.2917`,驗證 FM-6(`synthetic_` 前綴剝離在預設路徑上生效) |
| **G-3** | **未知不阻擋**:`synthetic_timeline_v1` → `present == null` + `construct_unknown`,exit **0** | `uv run pytest` | ✅ | 實跑 `synthetic_timeline.json` → `EXIT=0`,`constructPresence == {family: null, construct: null, present: null, thresholds: null, flags: ["construct_unknown"]}`(`counterEventCount=3`/`movingTickRatio≈0.4062` 僅供揭露,不影響判定) |
| **G-4** | **artifacts 不因閘紅而消失**:08:03 跑完後 `pipeline-summary.json` / `peek-quality.csv` / `peek-segments.csv` 皆存在且 summary 含 `constructPresence` | 實跑輸出 | ✅ | 08:03 exit 2 的同一次執行,三個 artifact 皆寫出(`.exit_gate_runs/08_03/{pipeline-summary.json,peek-quality.csv,peek-segments.csv}`,含 20 peeks / 19 segments);summary 含完整 `constructPresence` 區塊(見 G-1) |
| **G-5** | **引擎零改動**:`git diff --stat`(T0 基線 → T-exit)不含任何 `src/` 路徑;`npm run test:ci` 檔數/案數與 T0 基線**逐條相同** | `git diff --stat` + `npm run test:ci` | ✅ | `git diff --stat ce47bec~1 HEAD` 17 個檔全數落在 `docs/`、`research/README.md`、`research/src/...`(ingest/algorithms、report),**無任何 `^src/` 路徑**(頂層引擎目錄零 diff)。`npm run test:ci`:Vitest **89 files / 739 tests** 全綠 + Playwright **20 tests** 全綠,與 T0 基線(progress.md §2)逐條相同 |
| **G-6** | 全套回歸:`npx tsc --noEmit` · `npm run test:ci` · `uv run pytest` 三條 exit 0;`test_purity.py` 綠 | 三條指令 | ✅ | `npx tsc --noEmit` → exit 0(無輸出)。`npm run test:ci` → exit 0(見 G-5)。`TMP=<research>/.pytest_tmp TEMP=<research>/.pytest_tmp uv run pytest` → **221 passed**(0 error,Windows tmp 權限問題已用 T0 同一解法繞開);`test_purity.py` 位於 collect 清單第一批,綠 |
| **G-7** | **版本可稽核**:每份 summary 含 `paramsVersion == "construct-v1"` 與完整 `thresholds` | 實跑產物 | ✅ | 四次實跑(08:03/09:39/synthetic_counterstrafe/synthetic_timeline)的 `constructPresence.paramsVersion` 皆為 `"construct-v1"`;已知家族(08:03/09:39/synthetic_counterstrafe)三者 `thresholds == {minCounterEvents: 1, minMovingTickRatio: 0.05}`;未知家族(synthetic_timeline)`thresholds == null` 屬預期(無門檻可稽核,FR-C-9) |
| **G-8** | **文件不誤導**:`grep` 複查無「C 落地 ⇒ M14 ④⑤ 可重新宣告」意涵;KI-006 §5 影響表已加註;三條 entry blocker 理由敘述一致 | `grep -rn` 輸出 | ✅ | `grep -rnE "construct.{0,20}(gate|閘).{0,40}(重新宣告|解除|恢復效度|可宣告)" docs/` 命中 4 處,全為本次/T3 新寫入的**否定句**(「已落地…但不解除撤回」)或本檢查項目自身的敘述,無誤導 claim。`grep M14` 22+ 檔一致載明「④⑤ 因 KI-005/KI-006 撤回,C 已落地但不解除撤回」;僅 `BUGFIX-DECISIONS.md` 兩則**歷史日期戳記**(2026-08-06 A1/S1 落地段)含「處置待拍板」字樣,屬撰寫當下(C 尚未計畫)的忠實時間點記錄,非現況敘述 —— 現況權威(KI-006 頂部狀態列 / BD-006 索引列)已改為「C 已落地,B 待新採樣」。三條 entry blocker 理由現況一致:KI-004 已解除、KI-005 待 A2、KI-006 待 B(新採樣) |

---

## 2. FR 覆蓋複查

| FR | Task | 交付證據 | 結果 |
|---|---|---|---|
| FR-C-1 純函式判定 | T1 | `check_construct_presence` + `test_construct.py`(20 案綠) | ✅ |
| FR-C-2 凍結 registry `construct-v1` | T1 | G-7;`analysis-segments.md`/`research/README.md` 參數登錄段(T3) | ✅ |
| FR-C-3 家族解析(含 `synthetic_` 剝離) | T1 | G-2 的 FM-6 專屬案(實跑 `synthetic_counterstrafe_v2` → family=`counterstrafe`) | ✅ |
| FR-C-4 未註冊回 unknown,不靜默通過 | T1 | G-3(`synthetic_timeline_v1` → `present=null`) | ✅ |
| FR-C-5 counterstrafe 家族條件(AND) | T1 | 四個邊界案(空 ticks / 未知家族 / counter=0 佔比達標 / counter>0 佔比不足)綠於 `test_construct.py` | ✅ |
| FR-C-6 具名揭露實測值 | T1 | `ConstructReport` 欄位 + summary `constructPresence` 區塊(G-1/G-7 實測值) | ✅ |
| FR-C-7 summary session 級區塊 + artifacts 照常寫出 | T2 | G-4 | ✅ |
| FR-C-8 專屬非零 exit code + stderr 訊息 | T2 | G-1(exit 2 + stderr 拒絕訊息) | ✅ |
| FR-C-9 未知不阻擋 | T1 · T2 | G-3(exit 0) | ✅ |
| FR-C-10 flag 封閉詞彙 + 文件登錄(含 Level 欄) | T1 · T3 | `CONSTRUCT_FLAG_VOCABULARY` + [analysis-segments.md](../../operational/analysis-segments.md) flag 表新增 Level 欄與兩列 session 級 flag(T3,已 commit `6811779`) | ✅ |
| FR-C-11 四份 fixture 判定符合預期 | T1 · T2 | G-1/G-2/G-3(四次實跑逐格相符 §2a 基線) | ✅ |
| FR-C-12 analysis-segments / research README 加註 | T3 | 文件 diff(`6811779`);“Real-export validation” 段加註、fixture 表補構念判定欄 | ✅ |
| FR-C-13 KI-006 / BD-006 / A2 前置條件對帳 | T3 | 帳本 diff(`6811779`);KI-006 頂部狀態、BD-006 段、A2-blocked-plan 前置清單引用 | ✅ |
| FR-C-14 A2-T1 驗收清單(B-1~B-5) | T3 | [README §6](README.md) + [A2-blocked-plan.md](../KI-005-A/A2-blocked-plan.md) 已改為引用 | ✅ |

---

## 3. NFR 量化達標

| NFR | 指標 | 實測 | 結果 |
|---|---|---|---|
| NFR-C-1 | `git diff` 不觸及 `src/`;`npm run test:ci` 逐條不變 | `git diff --stat ce47bec~1 HEAD` 17 檔零 `^src/` 路徑;`npm run test:ci` 89 files/739 tests + 20 e2e,與 T0 基線逐條相同 | ✅ |
| NFR-C-2 | 缺席 0.0000 vs 最小通過 0.2917,門檻 0.05 邊際 ≥ 5.8× | 實跑覆核:08:03 `movingTickRatio=0.0`;synthetic_counterstrafe `movingTickRatio=0.2917`;凍結門檻 `0.05`(0.2917/0.05≈5.83×) | ✅ |
| NFR-C-3 | `algorithms/` 零 print / 零 I/O;`test_purity.py` 綠 | `test_purity.py` 於 `uv run pytest` 221 案中通過(collect 清單第一批);`construct.py` 已納入其匯入清單(T1 commit) | ✅ |
| NFR-C-4 | 既有測試期望值零改寫(只增斷言) | T1/T2 progress.md 記載:`test_run_pipeline.py` 既有 15 案期望值零改寫(僅新增 7 案);T0→T-exit 全程 `uv run pytest` 195→215→221 passed,無既有案改判 | ✅ |
| NFR-C-5 | 三條回歸指令 exit 0 | `npx tsc --noEmit` exit 0;`npm run test:ci` exit 0;`uv run pytest` exit 0(221 passed) | ✅ |
| NFR-C-6 | 單次 O(n) 掃描,無新增 I/O | `check_construct_presence` 只讀已載入的 `export.meta`/`ticks['vx']`/`events['type']`,單次向量化掃描;3,507 tick 的 08:03 實跑未見可觀測開銷(pipeline 完成時間與 T2 記錄一致) | ✅ |

---

## 4. 交付邊界的明文聲明(必須逐字保留)

> **C 交付的是「下次不會再量錯對象」,不是「這次量對了」。**
>
> - C 落地**不解除**任何 M14 撤回。M14 ④ 需 [A2-T2](../KI-005-A/A2-blocked-plan.md) 的新採樣**且** KI-006 這條理由由**新樣本本身**解除;⑤ 需 `seg-v2`(A2-T3)。
> - **WP-30 / WP-31 entry blocker 維持**。三條理由中,KI-004 已解除、KI-005 待 A1+A2、KI-006 待新採樣(選項 B)。
> - 本閘是 **construct presence gate**,不是 **reliability gate**:它回答「資料裡有沒有這個行為」,不回答「這個指標可不可信」(C-5)。

---

## 5. 遺留 Open Questions(結案時的狀態)

| OQ | 狀態 |
|---|---|
| **OQ-C-1** tracking/detection 家族條件 | ⬜ 仍未決(TD-1);兩家族一律 `construct_unknown` |
| **OQ-C-2** n ≥ 2 session(= OQ-KI6-4) | ⬜ 待研究者於 A2-T1 前拍板 |
| **OQ-C-3** 構念判定進 coach_report | ⬜ 建議延後(TD-4) |
| **OQ-C-4** exit code 編號慣例 | ⬜ T2 定案後回填 |
| **OQ-C-5** 缺席時是否拒絕輸出 segments CSV | ⬜ 建議不拒絕 |

## Commit message

```
docs(ki-006): C exit gate — 八道硬閘證據回填 + 交付邊界聲明
```
