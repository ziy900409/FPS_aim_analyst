# WP-61 T0 — Entry Gate ／ 構念歸屬 ／ 評估契約 pre-registration

## Objective

在寫任何 production code 或看任何特徵分布之前，把四件事釘死：① 構念歸屬（OQ-61.1，WP-60 交不出來的第四項 handoff）；② 評估契約的**全部數字**（README §2.4，pre-registration）；③ WP-60 四項 handoff 的實際可用性覆驗；④ 錄製硬體的 go／no-go。**T0 未通過不得開始 T1～T4。**

> ⚠️ 本 task 的產出**不是**「看起來合理的門檻」，而是**在看資料之前就寫死、事後不得調整**的一組數字。GD-20 的 pre-registration 紀律在此適用：先凍門檻再看資料，是避免「調門檻直到指標好看」的唯一機制。

## Inputs to read

- 本 WP [README.md](README.md) §0～3（特別是 §0.1 的 R1／R2 基線與 §2.4 的契約形狀）。
- [WP-60 T-exit-gate.md](../wp-60-raw-mouse-sample-capture/T-exit-gate.md) + [progress.md](../wp-60-raw-mouse-sample-capture/progress.md) 的 §T0 R1／§T0 R2／§TF1／§TF2／§WP-61 handoff（四項）。
- [WP-57 progress §T5-real](../../stage12/wp-57-spider-shot-wide-flick/progress.md) 與 [`src/metrics/spiderShotRepositioning.ts`](../../../../../src/metrics/spiderShotRepositioning.ts)（既有構念的**精確**語意，OQ-61.1 的一邊）。
- [`src/metrics/mouseSampleGaps.ts`](../../../../../src/metrics/mouseSampleGaps.ts) 檔頭註解（中性語彙的界線）。
- [`CONTEXT.md`](../../../../../CONTEXT.md) 的「時間間隙」「取樣區段」「抬滑鼠疑慮旗標」三條。
- [`docs/operational/spider-wide-recording-spec.md`](../../../../operational/spider-wide-recording-spec.md) §2（錄製前的硬性設定）。
- [`docs/exec-plan/DECISIONS.md`](../../../DECISIONS.md) GD-20（reliability gate）／GD-36（WP-60 的匯出邊界與 C-D4 歸屬）。
- `performance_analysis` 的 `contracts/modules/input/lod_v3_default_config.json` 與 `docs/architecture/adr/002_lod_v3_design.md`（Stage 2／3 的原始定義，FR-61.10 的記名對象）。

## Steps

1. **Baseline**：記錄 HEAD、`git status --short`、`npm run typecheck`（兩個 tsconfig）、全量 `npx vitest run`、`npx vite build` 的實際 exit code 與數字。不處理與本 WP 無關的既存紅燈，但要**具名歸因**。
2. **Discovery 覆驗**：逐項覆讀 README §0 的十四條，特別是 ⑦⑧⑨（`KEY_CODE` 封閉集、`applyInput` 只消費 `KeyD`／`KeyA`、`TickRecord.keys` 為固定四 bit）。任何一條不成立 ⇒ T1 的「結構性 inert」論證失效，必須重新設計標註通道。
3. **CodeGraph impact 重跑**：對 `KEY_CODE`、`CODE_KEY`、`keyMaskFromKeys`、`applyInput`、`DrillEvent`、`createDataRecorder`、`parseExportPayload` 取實測 caller 數與 production／test 觸及面，回填 README §0.2。**不得沿用 WP-60 T0 的數字**。
4. **OQ-61.1 覆核（已於 2026-09-09 由使用者拍板 = D-61.U1「並存但語意分離」，構念名 = 感測器離地／sensor lift）**：本 step 不再是「取得決定」，而是把決定**落成可執行的命名**：新構念的英文識別名、型別名前綴、模組檔名，以及兩者在 `CONTEXT.md` 的敘述草稿（必須互相指名並列出差異：訊號來源、時間粒度、可回答與不可回答的問題）。**草稿未寫不得進 T1**（事件型別名直接取決於此）。
5. **OQ-61.2 落地（已拍板 = D-61.U2「自報鍵 + block 設計冗餘」）+ OQ-61.3 收斂**：寫下 block 的定義（一個 run 一種指示？還是 run 內分段？）與 trial 邊界的推導來源（`visible`／`hit` 事件），並凍結標註鍵 code（recommended default `KeyL`）。
   - ⚠️ 一併把 D-61.U2 的**宣稱界線**寫進 §Pre-registration：自報鍵支撐**事件級匹配**，**不**支撐起點精度宣稱。這條界線是 step 7 匹配容差的設計前提。
6. **OQ-61.5 覆核（已拍板 = D-61.U3：cohort 錄在 240 Hz）**：
   - 逐項記錄該機器的實際規格：`meta.displayHz`、滑鼠型號／DPI／輪詢率、瀏覽器與版本、解析度模式。**DPI 必填**（缺 DPI 是既有 blocker）。
   - ⚠️ **不要把 ≥ 120 與 ≥ 144 統一成一個數字** —— 規劃期一度誤判為文件矛盾，實際是兩個門檻：120 = 資格閘地板（`PERF_FLOOR_MS`），144 = KI-031 完全緩解點（aim ≥ 128 Hz；120 Hz 仍約 6% 零樣本）。本 gate 的工作是**在兩處索引文件把依據補上**（[`../README.md`](../README.md) §4、[`docs/exec-plan/README.md`](../../../README.md) §2），而非改數字。此事列為 **GD-37 的一個條目**（不另開 GD）。
   - 把「**cohort 一律 240 Hz、禁止與 60 Hz 混批**」寫成 T2 的逐份作廢條件（`meta.displayHz` 不等於 240 即作廢）。240 Hz 同時清掉兩個門檻，故 T2 不引用任何下限、只比對 240。
7. **凍結評估契約（本 task 的核心產出）**：把 README §2.4 表的每一格填成**具體數字**，寫進 [progress.md](progress.md) 的 §Pre-registration 一節：
   - 候選事件定義（含 θ sweep 集合）；
   - 正例／負例的**字面**判定規則；
   - 匹配容差（ms）與其依據（不得只寫「感覺合理」—— 要引 WP-57 的 lift 事件長度 180–225 ms 與反應時間量級）；
   - 分割規則（哪些 session 進校準、哪些 held-out；n 不足時的退化規則）；
   - 指標清單與**每一個**的通過門檻（含 pause 組與 oneshot 組的誤報率上限，分開報）；
   - 決策規則的字面條件（達標 ⇒ T4；未達 ⇒ FR-61.8）；
   - NFR-61.7 的資料量下限與 F2 的標註完整性上限（差額幾次算作廢）。
8. **OQ-61.4 收斂**（Engineering）：實作落點 = Python 探索 → T4 條件式 TS 晉升；Stage 1 切段由 TS 產 committed golden（D-61.P4／P5）。
   **OQ-61.6 已拍板**（D-61.U4）：宣稱上限 = 本操作者 × 本硬體 × 本 drill，一律 `research_only`。本 step 只需把它落成 T4 的**終局條件** —— `src/` 對新判準的 importer 數為 0 **不是暫時措施**，而是本 WP 的最終狀態，T4 的 DoD 與 T-exit 的 A-61.20 據此驗收。
9. 未收斂的 OQ **標明 owner 與 deadline**，不把 recommended default 寫成已定案。
10. Production code diff 必須為 **0**；本 task 只動 `docs/`。

## Required audit artifact

| 項目 | 方法 | 門檻 | 實測 |
|---|---|---|---|
| WP-60 handoff ① 事件率分布 | 讀 WP-60 progress §T0 R1 | 連續移動期間 ≥ 500 Hz | — |
| WP-60 handoff ② 空洞長度分布 | 讀 §T0 R2 | 已知為**負面結論**（D-60.R2-1）—— 覆驗其限制四條仍成立 | — |
| WP-60 handoff ③ PA 十四參數 | 讀 §PA LOD v3 parameter source copy | 三個 px/s 空間參數已具名標註 | — |
| WP-60 handoff ④ 構念歸屬 | 本 task step 4 | **必須交付**（WP-60 交不出來的那一項） | — |
| 錄製硬體：顯示更新率 | 使用者回報 + `meta.displayHz` | ✅ 門檻 **≥ 120 Hz**；cohort 錄在 **240 Hz**（D-61.U3）。本 step 只覆核實測值 | — |
| 錄製硬體：滑鼠輪詢率／DPI | 使用者回報 | ≤ 1000 Hz 輪詢；DPI 必填 | — |
| `crossOriginIsolated` | `npm run dev`／`preview` 下實測 | `true` | — |
| 評估契約凍結 | step 7 | §2.4 表**零留白** | — |
| Baseline 三閘 | step 1 | typecheck ×2 ／ 全量 Vitest ／ build 各自 exit 0 或具名歸因 | — |

## Definition of Done

- [ ] Baseline 三閘有**指令 + 實際輸出**（非「已通過」）；既存紅燈逐條具名歸因。
- [ ] README §0 的十四條 discovery 逐條覆驗；不成立者已具名並說明對 T1 設計的影響。
- [ ] README §0.2 的 blast radius 已用**本次** CodeGraph 實測數字回填（不是 WP-60 的數字）。
- [ ] **OQ-61.1 已落成可執行命名**：使用者已拍板「並存 + 感測器離地／sensor lift」（D-61.U1）；本 gate 補齊型別名前綴、模組檔名與 `CONTEXT.md` 兩條互相指名的敘述草稿。
- [ ] OQ-61.3／61.4 有 Engineering 結論；**OQ-61.1／61.2／61.5／61.6 覆核為已收斂**（D-61.U1～U4）且其**衍生條件**已落地：D-61.U2 的宣稱界線進 §Pre-registration、D-61.U3 的 240 Hz 作廢條件進 T2、D-61.U4 的零 importer 終局條件進 T4。
- [ ] **兩個顯示更新率門檻的依據已在兩處索引文件補上**（120 = 資格閘地板／144 = KI-031 完全緩解點），**數字未被統一或改寫**；此事列為 GD-37 條目。
- [ ] **README §2.4 的評估契約表零留白**，每一格是具體數字或字面規則，且各自附「依據」欄；已抄進 `progress.md` §Pre-registration 並標註「凍結於 <日期>，事後只能升版不得改值」。
- [ ] 錄製硬體 go／no-go 已判定；若 < 120 Hz，降級路徑與其限制已取得使用者確認並入 Decision Log。
- [ ] Production code diff = 0（`git diff --stat -- src/ scripts/ tests/` 為空）。
- [ ] `progress.md` 的 Progress／Decision Log／Surprises／Open Questions 四節已更新；[task-checklist.md](task-checklist.md) 的 T0 box 已翻。

## Commit

```text
docs(stage13): complete WP-61 lift-off validation entry gate
```
