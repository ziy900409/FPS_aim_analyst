# T-exit — 三份效度判定收斂 + 教練報告 v2(僅通過者)+ `analysis-advanced-diagnostics.md` 定稿

> Part of [WP-31 advanced-diagnostics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 + T2 + T3 |
| **Risk / Cplx** | — / Med |
| **對應 FR** | FR-D16 第三版(報告 v2) |
| **Touches** | `research/src/report/coach_report.py`(MODIFY)· `research/src/report/tests/test_coach_report*.py`(MODIFY)· `research/src/modules/metrics/notebooks/t-exit/outputs/`(MODIFY committed 範例)· `docs/operational/analysis-advanced-diagnostics.md`(定稿)· [../README.md](../README.md)(§3/§6/§8/§9 對帳) |
| **狀態** | ⬜ |

## Objective

把三個 P2 指標各自的判定收斂成一份**可稽核的進退帳**,並讓教練報告 v2 **只**呈現通過判定者。本 task 的成功條件包含一個違反直覺的情況:**三個指標全部判為研究向、報告 v2 與 v1 的主表逐位相同,也是合格的交付**——只要每一個判定都有證據。

## In scope

### ① 三份判定收斂表(本 task 的核心產出)

| 指標 | 判定來源 | 可能結果 |
|---|---|---|
| SPARC | T1 階梯診斷 verdict + 單樣本效度限制 | `comparable` → 可作逐段分佈呈現(研究向)/ `stratified_only` → 僅限同 `padded_n` bucket 比較,報告須標限制 |
| Key-Velocity xcorr | T2 `gate-v1` 三分支 | `blocked-by-data` / `research_only`(±「訊號非偶然且估計穩定」註記);**`coach_report` 不可達**(T0 上限條款) |
| Fitts | T3 `fitts-v1` 判準 | `ok`(附 D 內生性 + MT 含 RT 兩項限制)/ `blocked-by-data` |

每列須含:判定值、判準出處(T0 凍結的 commit)、實測數值、證據檔案連結、**進報告與否**與其理由。

### ② 教練報告 v2

- `REPORT_VERSION` → `coach-report-v2`。
- **納入規則(C-D3 / GD-20)**:
  - 進**主表**:僅 WP-29/30 已通過對表或已有明示限制的既有量(v1 現況不變)。
  - 進**研究向區塊**(與主表視覺上分離、標題明寫「研究向:不得作為訓練處方依據」):通過各自判定的 P2 指標。
  - **不進報告**:`blocked-by-data` 者;報告改以一行說明「為何沒有這個指標」+ 需要什麼樣本才能有(可行動的缺口說明,不是留白)。
- 每個 P2 區塊帶:`n`、flags 計數、`version` 字串、效度層級句、以及該指標的**限制句**(SPARC 階梯 / xcorr 上限條款 / Fitts 內生性)。
- 沿用 v1 的 `--group-by side|ads|weapon_mode` 分層與參數區塊契約。
- **deterministic 契約不變**:無時鐘、無隨機(gate 的 seed 固定且寫入 metadata)、穩定排序。

### ③ committed 範例報告重跑

- 重跑既有 9 份 committed 範例,逐份確認差異**只**來自新增的研究向區塊與 `REPORT_VERSION`;主表逐位不變(若變了,必須逐項解釋或視為 regression)。
- 新增的範例(若有)沿用 v1 的命名與 deterministic 要求。

### ④ 文件定稿與對帳

- `docs/operational/analysis-advanced-diagnostics.md` 定稿:`sparc-v1` / `xcorr-v1` / `gate-v1` / `fitts-v1` 四個 registry + 封閉 flags 詞彙表 + frozen parameters + golden 出處 + 報告載體契約 + **sample limits**(單一受試者 P001 / 3 session / 同機同 config / 非母體層級)。
- [../README.md](../README.md) 對帳:§3 WP-31 狀態 → ✅(附判定摘要)、§6 task 表最終化、§8 OQ-S4-3 關閉 / OQ-S4-18 / OQ-S4-19 依證據更新、§9 文件對帳清單勾選 `analysis-advanced-diagnostics.md`。
- [CONTEXT.md](../../../../../CONTEXT.md) 回寫新術語:SPARC(spectral arc length)、Key-Velocity Coupling、reliability gate(`gate-v1` 的本專案操作化)、Fitts ID/MT/TP;§B research 層元件列補三個模組。
- **WP-32 的輸入交接**:在 progress 明寫「本 WP 有哪些指標可被 WP-32 T0 納入晉升清單評估」——依 C-D3,**研究向指標不得晉升 dashboard**,故預期交接清單為空或僅含條件性項目;此結論須明確,不得留白讓 WP-32 自行猜測。

## Out of scope

- 依報告需求回頭調整 `gate-v1` / `sparc-v1` / `fitts-v1` 任一凍結值。
- 把研究向指標放進主表或結果頁(WP-32 亦不得,除非另有新樣本 + 新 gate 版本)。
- 互動式報告(OQ-S4-6 升級觸發條件仍未達)。
- 跨 session 併池的效度主張。
- 任何 `src/` 變更。

## Steps

- [ ] 彙整三份判定成收斂表,逐列補證據連結與「進報告與否」理由,寫入 progress。
- [ ] 改 `coach_report.py`:`coach-report-v2` + 研究向區塊 + `blocked-by-data` 的缺口說明。
- [ ] 更新報告契約測試:納入規則(通過者進研究向區塊 / `blocked-by-data` 不進)、版本字串、效度層級句、seed 進 metadata。
- [ ] 重跑 9 份 committed 範例,逐份 diff 檢視並解釋。
- [ ] `analysis-advanced-diagnostics.md` 定稿。
- [ ] [../README.md](../README.md) §3/§6/§8/§9 對帳 + [CONTEXT.md](../../../../../CONTEXT.md) 術語回寫。
- [ ] progress 寫 WP-32 交接結論;task-checklist 全數翻 ✅。

## Definition of Done

1. **三份判定收斂表已產出**,每列含判定值 / 判準出處 commit / 實測數值 / 證據連結 / 進報告與否與理由;**沒有任何一列是「待定」**。
2. **報告 v2 一鍵產出綠**:`coach_report.py` 對三份真實 + 合成 fixture 各產單檔自足靜態 HTML(inline CSS/SVG、零外部資源),exit 0。
3. **納入規則由測試釘死**:① 通過判定者出現在研究向區塊且**不**出現在主表 ② `blocked-by-data` 者不出現在報告的任何指標區塊,但缺口說明存在 ③ 每個 P2 區塊皆帶 `n` / flags 計數 / `version` / 效度層級句 / 限制句(逐項斷言)。
4. **deterministic**:同一 fixture 連續兩次產出的 HTML **byte-for-byte 相同**(含 gate 的 seeded 結果);測試斷言。
5. **既有 9 份 committed 範例的 diff 已逐份解釋**,主表逐位不變(或差異有書面理由);`--group-by` 三種分層皆綠且參數區塊逐位相同。
6. `uv run pytest` 全綠(貼輸出計數)+ `npm run test:ci` exit 0 且 **`src/` 與 `tests/` 零 diff**(貼 `git diff --stat`)。
7. `analysis-advanced-diagnostics.md` 定稿:四個 registry + 封閉 flags + frozen parameters + golden 出處 + 報告載體契約 + sample limits 齊備。
8. [../README.md](../README.md) §3 WP-31 → ✅、§6/§8/§9 已對帳;[CONTEXT.md](../../../../../CONTEXT.md) 新術語已回寫。
9. progress 含 **WP-32 交接結論**(可納入晉升評估的清單;依 C-D3 預期為空或條件性,結論須明確)。

## Commit

`feat(wp-31): T-exit 三指標效度判定收斂 + coach-report-v2(研究向區塊分離)+ analysis-advanced-diagnostics.md 定稿`
