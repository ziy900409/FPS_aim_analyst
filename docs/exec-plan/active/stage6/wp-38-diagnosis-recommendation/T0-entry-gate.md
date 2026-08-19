# T0 — entry-gate:驗上游 exit + OQ-S6-8/OQ-S6-23 拍板

> Part of [WP-38 diagnosis-recommendation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | WP-34 T-exit ✅ + WP-35 T-exit ✅ + WP-36 T-exit + WP-37 T-exit |
| **Risk / Cplx** | Med / Low(無新程式碼,但阻塞於 WP-36/37 進度且要拍板兩個懸而未決的架構決策) |
| **Touches** | 無程式碼;產出決策記錄於 `progress.md` + 本 WP README §2/§7 覆核 |
| **狀態** | ⬜ |

## Objective

驗四個上游 WP(34/35/36/37)exit 皆已綠燈;重新讀取 WP-36/37**最終落地**的 `src/metrics/spiderShotMetrics.ts`/`counterstrafeMetrics.ts`(而非只讀其規劃期 README 草案介面);拍板 OQ-S6-8 的兩個子決策(§2①單次診斷落點、§2②歷史資料來源機制)與 OQ-S6-24(七模式優先序初判);零程式碼,零測試異動。

## In scope

1. **驗四個上游 T-exit**:讀 [WP-34 progress.md](../wp-34-hold-click-visibility/progress.md)、[WP-35 progress.md](../wp-35-hold-track/progress.md)、WP-36/37 各自 `progress.md` 的 T-exit 列,確認四者皆已 ✅。**若 WP-36/37 尚未 T-exit,本 task 到此為止,記錄阻塞狀態,不得往下拍板任何依賴其最終介面的決策。**
2. **重新覆核 WP-36/37 落地介面**:`grep -n "export interface\|export function" src/metrics/spiderShotMetrics.ts src/metrics/counterstrafeMetrics.ts`,對照本 WP README §5 草案的欄位名稱與型別是否一致;若有出入,更新 README §5 為「已覆核,來源:<實際檔案路徑>」並記錄差異到 Decision Log。
3. **拍板 OQ-S6-8(a):單次診斷落點**——覆核 README §2① 的 TS 建議方向仍然成立(檢查 `ResultScreen.ts`/`createPromotedSummary` 是否被其他並行 WP 改動出乎意料的形狀)。
4. **拍板 OQ-S6-8(b)/OQ-S6-23:個人歷史資料來源機制**——調查現有匯出檔案管理慣例(`research/fixtures/` 現況、`docs/operational/` 是否已有教練實際工作流描述),在候選①(TS 多檔上傳)與候選②(Python 目錄掃描)之間拍板,並記錄粗略工時估計(不只是質化理由)。
5. **OQ-S6-24 初判**:讀框架 v1 §"診斷輸出" 表格,確認七個模式的證據鏈是否確實兩兩互斥;若有重疊區,記錄為需要 T1 進一步設計的具體案例。

## Out of scope

- 任何程式碼實作(T1/T2/T3)。
- 診斷門檻的最終凍結數值(WP-39 pilot)。

## Steps

- [ ] 讀 WP-34/35/36/37 四份 `progress.md` 確認 T-exit 狀態;若任一未達,記錄阻塞並停止本 task。
- [ ] `grep -n "export interface\|export function" src/metrics/spiderShotMetrics.ts src/metrics/counterstrafeMetrics.ts` 覆核 README §5 草案介面。
- [ ] 讀 `research/fixtures/` 現有結構與 `docs/operational/` 既有慣例,評估 OQ-S6-23 候選①②的粗略工時。
- [ ] 讀框架 v1 §"診斷輸出" 表格,逐列檢查證據鏈互斥性,記錄 OQ-S6-24 初判。
- [ ] 寫決策記錄 D-38.1(OQ-S6-8 兩個子決策)、D-38.2(OQ-S6-23 候選拍板)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 四個上游 T-exit 已覆核(或明確記錄阻塞) | progress.md 記錄核對結果 |
| ② | WP-36/37 落地介面已覆核,README §5 更新為「已覆核」或差異記錄 | progress.md + README §5 diff |
| ③ | OQ-S6-8(a)(b)/OQ-S6-23 拍板 | Decision Log D-38.1/D-38.2 |
| ④ | OQ-S6-24 初判記錄(即使結論是「留待 T1 定案」) | progress.md 記錄 |
| ⑤ | 零程式碼、零測試改動 | `git diff` 為空(僅 `docs/`) |

## Commit

`docs(wp-38): T0 — entry-gate(OQ-S6-8/OQ-S6-23 拍板 + 上游介面覆核)`
