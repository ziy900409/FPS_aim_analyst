# CI 兩層驗證閘（Tier 1 / Tier 2）

> 對象：維護這個 repo 的人。回答一個問題 —— **什麼時候、在哪台機器上、跑哪些測試，才算通過。**
> 權威：本檔。workflow 實作在 [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) 與
> [`.github/workflows/e2e-full.yml`](../../.github/workflows/e2e-full.yml)。

---

## 1. 為什麼要分兩層

**這個 e2e suite 的環境就是量測儀器的環境。** 階段 A 鎖 Chrome/Edge 桌面版、要求
`crossOriginIsolated === true`、要求 `WebGPURenderer` 真的走 WebGPU 而非 fallback
（[ADR-4](../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) / [CLAUDE.md §4](../../CLAUDE.md)）。
GitHub-hosted runner **沒有 GPU**，`WebGPURenderer` 會依
[`createRenderer.ts`](../../src/render/createRenderer.ts) 的設計靜默 fallback 成 WebGL2 ——
那正是 `resolveBackend()` 存在的理由。所以 cloud runner 在原理上無法產生「這是合格量測環境」
的證據。

加上兩個現實條件：

- **長跑測試無法平行化掉**：5 個標了 `@slow` 的測試在等**真實的** rest 秒數與 sim 秒數，
  最長單一測試 5.4 分鐘。加 worker 不會讓它變快。
- **[KI-030](../known_issue/KI-030-history-e2e-flaky-under-parallel-workers.md) 未修**：
  history e2e 在多 worker 下 flaky，根因未定。把全套丟進每個 PR 的 CI，最可能的結果是
  一個常態紅、大家學會忽略的 CI —— 那比沒有更糟。

因此：**Tier 1 抓迴歸，Tier 2 才是定版閘。**

---

## 2. 兩層的分工

| | Tier 1 `e2e-fast` | Tier 2 `e2e-full` |
|---|---|---|
| 何時跑 | 每個 PR / push to main | tag push（`v*`）、每日 02:00 (Asia/Taipei)、手動 |
| 機器 | `ubuntu-latest`（hosted，無 GPU） | `[self-hosted, windows, real-gpu]`（研究者機器，真 GPU + Edge） |
| 瀏覽器 | Playwright 內建 chromium + `--enable-unsafe-swiftshader` | 系統安裝的 Microsoft Edge（`channel: 'msedge'`） |
| Playwright project | `chromium-ci`（`metadata.realGpu: false`） | `edge`（`metadata.realGpu: true`） |
| 範圍 | 103 tests（排除 `@slow` + `@realgpu`） | typecheck ×2 + Vitest 全量 + 115 tests（全部） |
| 指令 | `npm run test:e2e:fast` | `npm run test:ci` |
| 它證明什麼 | 邏輯／DOM／UI 沒有迴歸 | **量測效度環境成立**：webgpu backend、真實時序、完整 session 流程 |
| 它**不**證明什麼 | backend 是不是 webgpu、真實時序 | — |

### 兩個 tag，兩種**不同**的理由

| tag | 意思 | 為什麼 Tier 1 不跑 | 目前 |
|---|---|---|---|
| `@slow` | **在等真實時間**（rest 秒數、sim 秒數），不是「碰巧比較慢」 | 加 worker 不會變快，只會把 CI 分鐘數撐爆 | 5 個：`session-orchestrator` ×4、`tracking-pilot-live` ×1 |
| `@realgpu` | **斷言的對象就是環境本身**：效能預算、真實算繪迴圈驅動的探測、資源生命週期 | 在 SwiftShader 上斷言「1,500 ms P95」不是驗證產品，是驗證 runner —— 結果無意義 | 7 個：`hit-feedback-live` ×3、`micro-flick-live` ×1、`replay` ×1、`stage10-accessibility` ×1、`stage10-lifecycle-scale` ×1 |

**兩者都仍然在 Tier 2 全量執行**，覆蓋率沒有減少，只是搬家。

新增測試時自己判斷：

- 耗時主要來自 `waitForTimeout` / 真實 drill 時長 → `@slow`
- 斷言裡有時間預算（`toBeLessThan(ms)`）、要靠算繪迴圈把準心導到目標、或量 listener/rAF/canvas
  的資源增長 → `@realgpu`
- 兩者皆非 → 不標，它會在每個 PR 上被跑到

### 判讀紅燈的順序

Tier 1 紅燈時**先問「是不是環境」再問「是不是迴歸」**：

1. 錯誤是 timeout 或 `Target page... has been closed`？→ 多半是軟體算繪下的資源問題，
   先單獨重跑該測試確認。
2. 錯誤是 `toBeLessThan` 之類的預算？→ 這個測試本來就該標 `@realgpu`。
3. 都不是 → 才是真迴歸。

### `backend === 'webgpu'` 這條斷言

[`backend.spec.ts`](../../tests/e2e/backend.spec.ts) 的 webgpu 斷言由
`testInfo.project.metadata.realGpu` 把關。這**不是放寬斷言**，是把原本隱含的前提
（「受測機 = 有 GPU 的研究者桌機」）寫明。Tier 1 跳過它、Tier 2 強制執行它。

---

## 3. 註冊 self-hosted runner（Tier 2 的前置）

一次性設定。需要 repo 的 admin 權限。

**runner 機器需求**：Windows + 已安裝 Microsoft Edge + 可連外網。建議就用平常跑實測的那台，
因為它的 GPU／顯示器／計時特性才是研究宣稱所在的環境。

1. GitHub → repo → **Settings → Actions → Runners → New self-hosted runner** → 選 Windows x64。
2. 照頁面上給的指令在該機器跑（下載、`config.cmd --url ... --token ...`）。
3. **標籤**：設定過程會問 labels，**必須加上 `real-gpu`**。預設的 `self-hosted` / `Windows` /
   `X64` 會自動帶上，但 `real-gpu` 要自己輸入。workflow 的 `runs-on: [self-hosted, windows, real-gpu]`
   三個都要對上才會被撿走（label 比對不分大小寫）。
   這個 label 不是裝飾：它把「這台機器是合格量測環境」編進 workflow。少了它，日後任何一台
   Windows runner 都可能接走這個 job。
4. 選擇執行方式：
   - `run.cmd` — 前景跑，關掉視窗就停。適合先試。
   - `svc.cmd install` + `svc.cmd start` — 註冊成 Windows 服務，開機自動啟動。**排程跑（每日 02:00）需要這個**。
5. 驗證：GitHub → **Actions → E2E (full, self-hosted) → Run workflow**，看它有沒有被撿走。

**安全提醒**：self-hosted runner **不要**用在會接受外部 PR 的 public repo 上 ——
fork PR 可以在你的機器上執行任意程式碼。本 workflow 的觸發條件刻意只有
`workflow_dispatch` / tag push / schedule，**沒有 `pull_request`**，就是為了這個。
若之後要接 PR 觸發，先在 Settings → Actions 開 "Require approval for all outside collaborators"。

---

## 3.5 失敗證據（trace）

兩層的 workflow 都以 `if: always()` 上傳 `test-results/`，**不是 `if: failure()`**。

理由：**flaky（第一次失敗、重試通過）會讓 job 判定為 success**，但 `trace: 'on-first-retry'`
正是在那一刻錄到東西。用 `failure()` 等於在最需要證據的情況下把它丟掉 ——
[KI-030](../known_issue/KI-030-history-e2e-flaky-under-parallel-workers.md) 的根因至今未定，
就是因為失敗當下的資訊沒被保存。

Tier 2 首跑（2026-09-14）就出現 1 flaky（`hit-feedback-live.spec.ts:541`），trace 有錄到、
卻因為當時是 `failure()` 而沒被上傳 —— 這條規則就是那次的產物。

**綠燈但有 flaky 時，去 run 頁面下載 artifact 看 trace。** 綠燈不等於沒事。

---

## 4. 定版流程裡的位置

發 release 時：

1. `git tag -a vX.Y.Z` → `git push --follow-tags`
2. tag push 自動觸發 **Tier 2 `e2e-full`**
3. **等它綠了**再 `gh release create`
4. 把該次 run 的結論寫進 [CHANGELOG.md](../../CHANGELOG.md) 或 release notes

v0.1.0 是在 Tier 2 存在之前發的，三道閘的結果以人工方式記在 commit `chore(release): v0.1.0`
的 message 裡。下一版起改由 workflow 留痕。
