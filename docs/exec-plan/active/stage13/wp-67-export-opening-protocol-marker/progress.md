# WP-67 — Progress

> Running log。每個 task 完成時更新 Progress / Decision Log / Surprises / Open Questions，與該切片一起 stage（協議 [CLAUDE.md §3.4](../../../../../CLAUDE.md)）。

## Progress

| Task | 狀態 | 日期 | 摘要 |
|---|---|---|---|
| T0 | ⬜ | — | — |
| T1 | ⬜ | — | — |
| T2 | ⬜ | — | — |
| T3 | ⬜ | — | — |
| T4 | ⬜ | — | — |
| T5 | ⬜ | — | — |
| T-exit | ⬜ | — | — |

---

## 規劃期紀錄（2026-09-11）

### 編號重查（四處來源）

| 來源 | 當下最大值 |
|---|---|
| `docs/exec-plan/README.md §2` | **WP-66** |
| `docs/exec-plan/active/*/` 實際資料夾 | **WP-66**（`wp-66-target-hit-visual-feedback/`） |
| `docs/exec-plan/DECISIONS.md` 已落帳 | **GD-41** |
| 已預約未落帳的 GD | **GD-42**（WP-66 草稿） |

⇒ 規劃期取用 **WP-67 / GD-43**。[stage14 §3](../../stage14/README.md) 的三個候選再順延為 **WP-68/69/70**。

⚠️ 規劃期原本要取 WP-66，寫入前重查發現平行 session 已於 `959b4e3`（`add and update wp-66 plan`）採納該號，依 [GD-15](../../../DECISIONS.md)「先採納先得」順延至 WP-67，**不爭號**。T0 必須再重查一次。

### 來源

[WP-65 T-exit](../wp-65-drill-arming-and-countdown/T-exit-gate.md) 步驟 5 要求確認是否需要 `meta` 版本標記，並明訂「若使用者要求，該標記屬新 WP，不在本 WP 夾帶」。使用者 2026-09-11 確認**需要**。本 WP 即該項工作。

### 規劃期使用者決定（2026-09-11）

| 決定點 | 選定 |
|---|---|
| 標記形狀 | **additive 物件 `meta.opening`**（`protocol` ＋ `countdownMs`），非單一字串、非 `schemaVersion` bump |
| WP-65～WP-67 中間窗 | **離線分類器，不改已錄檔案**（不寫回填 migration） |
| Python `research/` 側 | **納入本 WP**：分類 ＋ 混池 guard |

---

## Decision Log

### GD-43 草稿（本體 T-exit 入帳）

> 承 [WP-63](../wp-63-micro-flick-v8-measurement-foundation/README.md) D-63-P6 與 [WP-66](../wp-66-target-hit-visual-feedback/README.md) D-66-P7 先例：規劃期只留草稿，本體於 T-exit 補上實際結果後寫入 [DECISIONS.md](../../../DECISIONS.md)。

| # | 草稿條目 |
|---|---|
| **D-67-1** | 標記採 **additive 物件 `meta.opening`（`protocol` ＋ `countdownMs`）**，`schemaVersion` 維持 2。理由：`schemaVersion` 是 payload 結構版本而非刺激語意，且 TS／Python 兩側都硬性拒絕非 2，bump 會讓全部既有 fixture 與 `research/` 讀檔一次紅掉；把 `countdownMs` 一併記下，是因為 foreperiod 長度本身就是開場語意的一部分，目前**完全沒有進匯出**，只記 protocol 字串會讓「同一個協定、不同倒數長度」共用同一個標籤。 |
| **D-67-2** | `meta.opening` 走 **optional-in／optional-out**：parse 時**缺席保持缺席**，不補預設值。與 [D-65-3](../../../DECISIONS.md)（`pointerLockLost` 的 optional-in／required-out）**刻意相反**，因為缺席在本欄橫跨兩群性質相反的資料——pre-WP-65（真的是 `immediate-v0`）與 WP-65～WP-67 中間窗（實際是 `armed-countdown-v1`）。補任何一個預設值都會把其中一群標錯。附帶效果：8 筆既有 fixture 的 canonical digest 零位移，成為這條契約被遵守的可執行證據。 |
| **D-67-3** | `protocol` **由 runtime 事實導出**（該 runner 的 `requireArm` ＋ 目前載入的 `config.timing.countdownMs`），不得由硬編字串或版號常數決定；出口是 `DrillRunner` 的唯讀 getter（sim→data 唯讀，比照既有 `phase`／`countdownRemainingMs`，ADR-2）。連帶記錄：arming 與可見倒數目前在 production **同生共死**，以 e2e 斷言釘死；若日後被拆開，必須新增 `'armed-hidden-v2'` 之類的新值，**不得**原地改既有兩值的語意。 |
| **D-67-4** | 中間窗以 `meta.validity.pointerLockLost` 的**原始鍵存在與否**斷代（該鍵自 WP-65 起 required-out）。此判定**只在未經 TS parser 正規化的 meta 上成立**——`parseValidity()` 會把缺欄補 `false`，parse 後 pre-WP-65 與乾淨 post-WP-65 run 逐位相同。失效觸發條件：任何新增的 production `createDrillRunner()` 呼叫點若不傳 `requireArm`，該指紋即失效，中間窗須改標為 `unknown`。 |
| **D-67-5** | 分類規則**只在 Python 側單一實作**（`research/src/modules/ingest/algorithms/opening.py`）。TS 側不做第二份：一來那是 C-D4 禁止的第二定義，二來 TS 端拿到的是 parse 後物件，原始鍵面已消失，**本來就做不到**。C-D1 維持單向：Python 只讀匯出 JSON。 |
| **D-67-6** | **已錄匯出不可變**：不寫回填 migration script 改寫既有 JSON（使用者 2026-09-11 選定）。原始資料一旦落盤即視為證據；改寫會讓檔案不再與當時產出逐位相同，且把「這份資料當時是什麼」與「我們現在認為它是什麼」混為一談。 |

---

## Surprises

*（執行期填寫：與規劃假設不符的實況、被打臉的推論、意外的耦合）*

規劃期已知一則：

- **WP-66 號碼被平行 session 搶先採納**（`959b4e3`，與本 WP 規劃同日）。這正是 [GD-15](../../../DECISIONS.md) 存在的理由；本 WP 順延至 WP-67，T0 仍須再重查一次。

---

## Open Questions

| # | 問題 | 預設 | Owner | Deadline | 狀態 |
|---|---|---|---|---|---|
| **OQ-67.1** | History Library 卡片要不要顯示 opening protocol？ | 不做 | 使用者 | T5 開工前 | ⬜ |
| **OQ-67.2** | harness／e2e 匯出帶 `immediate-v0`，要不要另標「非真人資料」？ | 不另標 | 規劃內定 | T2 開工前 | ⬜ |
| **OQ-67.3** | TS 側要不要也提供舊檔分類器？ | 不做（C-D4 ＋ 技術上做不到） | 規劃內定 | T3 開工前 | ⬜ |
| **OQ-67.4** | 混池 guard 的放行介面要多寬？ | 呼叫點層級的顯式參數，無全域開關 | 規劃內定 | T3 開工前 | ⬜ |
