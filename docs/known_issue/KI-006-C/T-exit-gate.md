# T-exit — C Exit gate:交付判定

> 上游:[C README §5](README.md) · [KI-006 §4-C](../KI-006-m14-sample-no-counterstrafe.md)
> 依賴:T0–T3 全數 commit。本檔為**證據回填表**,不新增改動。

---

## 1. 硬閘(G-1 ~ G-8)

| # | 條件 | 驗證方式 | 結果 | 證據 |
|---|---|---|---|---|
| **G-1** | **閘擋得住**:08:03 判定 `present == false` + `construct_absent:counter-strafe`,`run_pipeline` **exit 2** | `uv run pytest` + 實跑 | ⬜ | |
| **G-2** | **閘不誤殺**:09:39 與 `synthetic_counterstrafe` 皆 `present == true`、exit 0;後者 `family == "counterstrafe"`(非 unknown,FM-6) | `uv run pytest` | ⬜ | |
| **G-3** | **未知不阻擋**:`synthetic_timeline_v1` → `present == null` + `construct_unknown`,exit **0** | `uv run pytest` | ⬜ | |
| **G-4** | **artifacts 不因閘紅而消失**:08:03 跑完後 `pipeline-summary.json` / `peek-quality.csv` / `peek-segments.csv` 皆存在且 summary 含 `constructPresence` | 實跑輸出 | ⬜ | |
| **G-5** | **引擎零改動**:`git diff --stat`(T0 基線 → T-exit)不含任何 `src/` 路徑;`npm run test:ci` 檔數/案數與 T0 基線**逐條相同** | `git diff --stat` + `npm run test:ci` | ⬜ | |
| **G-6** | 全套回歸:`npx tsc --noEmit` · `npm run test:ci` · `uv run pytest` 三條 exit 0;`test_purity.py` 綠 | 三條指令 | ⬜ | |
| **G-7** | **版本可稽核**:每份 summary 含 `paramsVersion == "construct-v1"` 與完整 `thresholds` | 實跑產物 | ⬜ | |
| **G-8** | **文件不誤導**:`grep` 複查無「C 落地 ⇒ M14 ④⑤ 可重新宣告」意涵;KI-006 §5 影響表已加註;三條 entry blocker 理由敘述一致 | `grep -rn` 輸出 | ⬜ | |

---

## 2. FR 覆蓋複查

| FR | Task | 交付證據 | 結果 |
|---|---|---|---|
| FR-C-1 純函式判定 | T1 | `check_construct_presence` + `test_construct.py` | ⬜ |
| FR-C-2 凍結 registry `construct-v1` | T1 | G-7;參數登錄段(T3) | ⬜ |
| FR-C-3 家族解析(含 `synthetic_` 剝離) | T1 | G-2 的 FM-6 專屬案 | ⬜ |
| FR-C-4 未註冊回 unknown,不靜默通過 | T1 | G-3 | ⬜ |
| FR-C-5 counterstrafe 家族條件(AND) | T1 | 四個邊界案 | ⬜ |
| FR-C-6 具名揭露實測值 | T1 | `ConstructReport` 欄位 + summary 區塊 | ⬜ |
| FR-C-7 summary session 級區塊 + artifacts 照常寫出 | T2 | G-4 | ⬜ |
| FR-C-8 專屬非零 exit code + stderr 訊息 | T2 | G-1 | ⬜ |
| FR-C-9 未知不阻擋 | T1 · T2 | G-3 | ⬜ |
| FR-C-10 flag 封閉詞彙 + 文件登錄(含 Level 欄) | T1 · T3 | `CONSTRUCT_FLAG_VOCABULARY` + analysis-segments.md flag 表 | ⬜ |
| FR-C-11 四份 fixture 判定符合預期 | T1 · T2 | G-1/G-2/G-3 | ⬜ |
| FR-C-12 analysis-segments / research README 加註 | T3 | 文件 diff | ⬜ |
| FR-C-13 KI-006 / BD-006 / A2 前置條件對帳 | T3 | 帳本 diff | ⬜ |
| FR-C-14 A2-T1 驗收清單(B-1~B-5) | T3 | [README §6](README.md) + A2-blocked-plan 引用 | ⬜ |

---

## 3. NFR 量化達標

| NFR | 指標 | 實測 | 結果 |
|---|---|---|---|
| NFR-C-1 | `git diff` 不觸及 `src/`;`npm run test:ci` 逐條不變 | | ⬜ |
| NFR-C-2 | 缺席 0.0000 vs 最小通過 0.2917,門檻 0.05 邊際 ≥ 5.8× | | ⬜ |
| NFR-C-3 | `algorithms/` 零 print / 零 I/O;`test_purity.py` 綠 | | ⬜ |
| NFR-C-4 | 既有測試期望值零改寫(只增斷言) | | ⬜ |
| NFR-C-5 | 三條回歸指令 exit 0 | | ⬜ |
| NFR-C-6 | 單次 O(n) 掃描,無新增 I/O | | ⬜ |

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
