# T0 — entry-gate:覆核讀碼發現 + 四個小決策拍板

> Part of [WP-40 quality-flag-visibility](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | 無 |
| **Risk / Cplx** | Low(無新程式碼,純覆核 + 四個範圍很小的決策) |
| **Touches** | 無程式碼;決策記錄於 `progress.md` |
| **狀態** | ✅ 已完成(2026-08-25) |

## Objective

在動筆前重新覆核 [README.md §0](README.md) 的讀碼發現在當下 `src/` 上仍然成立(尤其是 `ResultScreen.ts`/`metadata.ts`/`SessionSetup.ts` 若在規劃後被其他並行 WP 改動);拍板 §2①②③④ 四個小決策(quality-flag 卡片與 WP-38 診斷卡片的邊界、兩層嚴重度的旗標分類、`--warn` 顏色取值方式、`dpi` 表單邊界);零程式碼,零測試異動。

## In scope

1. **重新 grep 覆核 §0 表格的行號與程式碼片段**:`ResultScreen.ts` 的 `DIAGNOSIS_METRIC_IDS`/`createDiagnosisSummary()`/`show()` 簽名、`metadata.ts` 的 `Meta`/`CollectMetaArgs`、`SessionSetup.ts` 的 `SessionSetupValues`、`main.ts` 兩個 `resultScreen.show()` 呼叫點與 `collectMeta()` 呼叫點——若行號或簽名已變動,更新 README §0/§5 對應內容並記錄差異。
2. **拍板 §2①**:確認「quality-flag 卡片是獨立於 WP-38 診斷卡片的新呈現單元」這個邊界判斷仍然正確(即 `diagnosis-quality-gate-status` 語意上確實是「診斷評估的前置條件」而非「原始匯出旗標的即時呈現」)。
3. **拍板 §2②**:六個旗標的兩層嚴重度分類(README 表格)是否維持初判,或依讀碼發現調整(例如是否需要更細的第三層)。
4. **拍板 §2③(OQ-S7-6)**:`--warn` 顏色取值用具名常數複製,還是引入 `tokens.css` 變數。
5. **拍板 §2④(OQ-S7-7)** 的表單邊界方向(不必是最終數字,但要決定「這是 T2 執行時自訂即可的 UI 防呆」還是「需要研究者核准的邊界」)。

## Out of scope

- 任何程式碼實作(T1/T2)。
- `docs/operational/*.md` 是否需要新增契約文件——留給 T-exit 判斷(README §8)。

## Steps

- [x] (2026-08-25) 重新讀取 `src/ui/ResultScreen.ts`(`DIAGNOSIS_METRIC_IDS`、`createDiagnosisSummary`、`ResultScreenHandle.show`)、`src/data/metadata.ts`(`Meta`、`CollectMetaArgs`、`collectMeta`)、`src/ui/SessionSetup.ts`(`SessionSetupValues`)、`src/main.ts`(兩個 `resultScreen.show(` 呼叫點 + `collectMeta({` 呼叫點),確認 README §0 表格逐行仍成立。
- [x] (2026-08-25) 行號與簽名仍與 README §0/§5 一致;無須更新。
- [x] (2026-08-25) 寫決策記錄 `D-40.1`(§2①邊界確認)、`D-40.2`(§2②嚴重度分類拍板)、`D-40.3`(OQ-S7-6 拍板)、`D-40.4`(OQ-S7-7 方向拍板)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | README §0 讀碼發現已重新覆核(或明確記錄差異) | progress.md 記錄核對結果 |
| ② | §2①(WP-38 邊界)、§2②(嚴重度分類)、§2③(OQ-S7-6)、§2④(OQ-S7-7 方向)四項拍板 | Decision Log D-40.1~D-40.4 |
| ③ | 零程式碼、零測試改動 | `git diff` 為空(僅 `docs/`) |

## Commit

`docs(wp-40): T0 — entry-gate(讀碼覆核 + 四個小決策拍板)`
