# FPS Aim Analyst verification skill 設計研究

日期：2026-09-10。研究基線：`035a6373ebceb6b4e56331ed51a00a6405bd1941`。

本文件是設計提案，含可落地的 skill 草稿；尚未安裝 skill，也未修改引擎或 CI。文中「現況」來自本次檢查，「建議」是待採納設計，歷史驗收紀錄不代表本次重新驗收。

## 1. 建議定位

建立專案專用的 **`fps-verification`**，負責把「這項變更應該保證什麼」轉成可執行驗證與可追溯證據。輸入是 task／WP／KI、工作樹變更或指定 commit range；輸出是需求對照、實際命令結果、證據限制與未完成項。

核心價值是四個判斷：**選哪些 gate、測試能證明什麼、執行環境是否可信、完成聲明是否超出證據**。本專案需要分別回答：

- 遊戲模擬是否符合固定步長、事件順序與 seeded determinism 契約？
- 瀏覽器裡的實際接線、畫面、輸入與操作流程是否成立？
- 匯出、離線分析、結果頁與歷史重播是否保留相同語意？
- 這份量測資料是否支持所聲稱的研究構念？

第一版採 instruction-only skill，重用 Vitest、Playwright、Python pytest 與 Stage10 acceptance runner。等實際使用證明命令選擇或證據整理反覆出錯，再抽 helper script。

## 2. 現有能力與設計依據

| 本次確認的現況 | 對 skill 的影響 | 來源 |
|---|---|---|
| Three.js WebGPURenderer、TypeScript、Vite；另有 Python 3.12 離線分析層 | 驗證跨越瀏覽器、Node 與 Python；不可只檢查前端 build | [README](../README.md)、[research 設定](../research/pyproject.toml) |
| `typecheck` 檢查 browser 與 Node 兩套 tsconfig；`test` 是 Vitest；`test:ci` 串接 typecheck、Vitest、Playwright | 直接引用現有 scripts；不要發明不存在的 lint gate | [package.json](../package.json) |
| GitHub workflow 只執行 `npm ci`、`typecheck`、`test` | GitHub CI 綠燈只支持這些範圍；E2E、Python、實機驗收仍須另外提供證據 | [ci.yml](../.github/workflows/ci.yml) |
| Vitest 收 `src/**/*.test.ts` 與 `tests/**/*.test.ts`；Playwright 收 `tests/e2e/*.spec.ts` | 測試選擇需區分 runner，避免把 `.spec.ts` 丟給 Vitest | [vite.config.ts](../vite.config.ts)、[playwright.config.ts](../playwright.config.ts) |
| Playwright 唯一 project 是系統 Edge，dev/preview 使用 5173/4173，local 允許 reuse | 要記錄真實 browser、server 來源、history root；不能宣稱已有多瀏覽器覆蓋 | [playwright.config.ts](../playwright.config.ts) |
| Python gate 獨立；TS 消費 committed parity/golden JSON | TS golden 綠燈不能代替修改後 Python 的 pytest；兩端共用錯誤也可能 parity 通過 | [research/README.md](../research/README.md)、[CONTEXT](../CONTEXT.md) |
| Stage10 已有隔離 root、程序管理、fixture factory、evidence reporter | History／Replay 整合驗收優先沿用；全域 skill 不必另建 framework | [Stage10Runner](../tests/stage10/Stage10Runner.ts)、[Stage10EvidenceReporter](../tests/stage10/Stage10EvidenceReporter.ts)、[T1 契約](../docs/exec-plan/active/stage10/wp-51-m18-integration-and-acceptance/T1-acceptance-harness.md) |
| 現有 code-review skill 提供五軸 review，incremental skill 提供切片交付 | verification 應補足執行證據與領域判準；不承擔所有 review 或交付工作 | [code-review-and-quality](../.claude/skills/code-review-and-quality/SKILL.md)、[incremental-implementation](../.claude/skills/incremental-implementation/SKILL.md) |

### 2.1 高影響區域與圖譜限制

`graphify-out/GRAPH_REPORT.md` 的高連結節點包括 `createSharedState`（110 edges）、`load_export`（74）、`createDataRecorder`（73）、`createTargetManager`（70）、`loadDrill`（64）、`createSimLoop`（62）。這些是擴大驗證範圍的導航線索，不是風險分數或測試通過證明。[Graph report](../graphify-out/GRAPH_REPORT.md)

該報告標示建立於 `5f258f03`，與本次 HEAD 不同；不能把上述數字當成當前完整影響面。本次沒有 `graphify-out/wiki/index.md`，因此使用報告與 CodeGraph 原始碼結果導航。當前 MCP 只暴露 `codegraph_explore`，可取得原始碼與 blast radius；未假裝呼叫不存在的 `codegraph_status`／`codegraph_impact`。

建議 skill 遵循專案 AGENTS 的圖譜工作流，依實際可用工具選用；遇到 pending files 直接讀列出的檔案。圖譜 edge 不涵蓋的 DOM 接線、JSON schema、fixture、環境變數契約仍須明列，不能因「沒有 caller」就判定不需要驗證。[AGENTS.md](../AGENTS.md)

### 2.2 最值得寫入 skill 的歷史教訓

| 案例 | verification 應保留的檢查 |
|---|---|
| [KI-004：sim/world 單位與 eye base 錯位](../docs/known_issue/KI-004-sim-world-unit-domain-mismatch.md) | 幾何測試納入非零玩家位移、非零 eye base；僅在原點靜止的 fixture 可能隱藏尺度錯誤。 |
| [KI-005：render/sim aliasing](../docs/known_issue/KI-005-omega-render-sim-aliasing.md) | 總角位移正確仍可能逐 tick 歸屬錯誤；輸入量測修改須驗 tick-window integral 與跨 render cadence。 |
| [KI-006：樣本沒有 counter-strafe](../docs/known_issue/KI-006-m14-sample-no-counterstrafe.md) | schema、dt 正確不代表核心行為存在；construct gate 必須另判。 |
| [KI-028：孤兒 server 被 E2E 重用](../docs/known_issue/KI-028-capture-script-orphans-dev-server-hijacking-e2e-history-root.md) | 同一 app 在錯誤 root 上也可能全綠；執行環境與程序歸屬是證據的一部分。 |
| [Stage10 acceptance dossier](../docs/operational/acceptance-stage-j.md) | automated pass、實機 walkthrough、owner waiver 分別記錄；里程碑不能由測試數量自動宣告。 |

這些案例用作選測理由與 skill 評估題，不代表本次重新確認所有歷史問題的當前修復狀態。

### 2.3 文件權威需要按範圍與日期判讀

`CLAUDE.md` 仍有「場景幾何永不進入命中判定」的早期摘要，但 GD-25 已批准 `hitscanOcclusion` additive context 與共用 `occlusionGeometry`；省略 context 的既有路徑保留，projectile 不讀該 context。[DECISIONS：GD-25](../docs/exec-plan/DECISIONS.md)

因此，skill 的 reference 應指向當前適用決策，保留例外的作用範圍；不要複製整段舊約束變成永久 denylist。文件衝突時，列出衝突與已明確採納的決策；程式碼用來確認實作現況，不能自行取代需求權威。

## 3. 建議的工作流程

1. **界定待證明的行為。** 從 task DoD／FR／NFR 提取 observable outcome，例如「同 seed 與 input，60/144/240 Hz render schedule 的逐 tick sim state 相同」。只說「測試全綠」不足以定義驗收。
2. **確定變更範圍。** 記錄 repo root、HEAD、dirty state，涵蓋 staged、unstaged、untracked；使用者指定 range 時使用該 range，不自行假設 `HEAD~1` 或已同步的 `origin/main`。task 的受影響契約也納入，不能只按副檔名選測。
3. **建立影響與驗證對照。** CodeGraph 找受影響 production symbols 與 consumers；對照 schema、config、UI 接線、fixture 與已知問題。產生「需求 → 不變量 → 選用 gate → 期望證據」。
4. **執行最小充分驗證。** 先相關 tests；跨模組脊椎、出口契約或 task exit-gate 再擴到全套必要檢查。既有 DoD 要求的 gate 不能以省時為由省略。純文件研究只驗文件與引用。
5. **辨認失敗性質。** assertion fail、環境未就緒、runner 啟動失敗、已知問題、測試缺口分開記錄。修復在原任務授權內則修復後重跑受影響項；驗證專用請求不得改期待值或功能語意來換取綠燈。
6. **發出範圍明確的結論。** 彙總通過、失敗、尚未執行、阻塞、適用 waiver；把 command、exit code 與 artifact 對上同一份工作樹。後續修改相關程式或 fixture 後，原證據失效，需重跑受影響項。

通過判準：本次範圍內必需的 gate 有有效通過證據，沒有未解失敗或必需但缺失的證據。已有 waiver 只處理其明定範圍；`waived` 不等於 `pass`。

## 4. 變更到驗證的路由矩陣

下列路徑是選測入口；實際執行前確認檔案存在並查看 assertion。以「契約被影響」為準，多列可同時成立。TS 程式變更通常加 `typecheck`；bundle、入口、相依或 preview 行為涉及時加 `build`；既有 exit-gate 要求優先。

| 變更區域 | 必須回答的問題 | 主要驗證入口 |
|---|---|---|
| `input/`、`loop/`、`state/` | 時鐘域、事件排序／半開窗、late/overflow、固定 tick、render cadence 不變性 | 相鄰 unit tests；`src/loop/__tests__/`、`tests/regression/`、`tests/validity/`；實際輸入接線用 `input-sampler.spec.ts`、`raw-mouse-sampling.spec.ts` |
| `sim/`、`weapon/`、`recoil/`、`ballistics/` | seeded RNG、128 Hz step、64 Hz recoil 子節奏、首發／命中事件關聯、hitscan/projectile gating | 相鄰 tests；fire／spray／projectile determinism；需要 UI 接線時加 `weapon-select.spec.ts`、`spray-drill.spec.ts` |
| `drill/`、`drills/`、session config | default 行為是否相容、seed/spawn/schedule、frozen protocol、Practice/Assessment 隔離 | drill schema、family tests、`src/pilot/protocolFreeze.test.ts`、`src/session/` tests；對應 drill 或 session E2E |
| `render/`、`view/`、`scene/`、`display/`、`main.ts` | 真實 backend、場景/相機/命中幾何一致、resolution/ADS 接線、資源釋放 | render/scene tests、`src/scene/architecture.test.ts`、`backend.spec.ts`、`isolation.spec.ts`、相關 live/replay E2E；視覺或效能要求另附實機證據 |
| `data/`、export schema、recorder | JSON round-trip、tick/event 順序、overflow、metadata、舊格式邊界、下游可讀性 | data tests、`full-drill.spec.ts`、`tests/golden/research/`；Python loader 受影響時加 pytest；history/replay consumers 受影響時加整合驗證 |
| `metrics/`、`research/`、parity/golden | 權威端、單位/eye origin、已凍結容差、flag/n/verdict、缺資料語意 | 相鄰 tests、`tests/golden/research/`、`research` pytest；可算封閉解或獨立 oracle；視乎主張另驗真實資料 |
| `session/`、`pilot/`、`ui/` | start/rest/retry/abort、重複進入、武器/seed 重設、鍵盤焦點、實際接線 | session/pilot/UI tests；`session-orchestrator.spec.ts`、`tracking-pilot-live.spec.ts`、`tracking-pilot-operator.spec.ts`、相關 public UI flow |
| `server/history/`、`history/`、`replay/` | 原子保存、相容 cohort、重啟、race/cancel、seek purity、資源生命週期 | `tests/history/`、`tests/replay/`、`tests/stage10/`；`test:stage10` 與受影響 history/replay E2E；scale 僅在效能要求適用時執行 |
| scripts、工具設定、依賴、文件 | script exit code/cleanup、runner 選測、dev/preview 差異；文件指令與引用是否存在 | 驗改動後的命令／設定；依受影響 runtime 擴展。純文字修改不自動要求遊戲全套驗收 |

### 4.1 引擎特有的不變量

- **決定性與計時效度分開。** 對同 seed／input 比逐 tick 狀態；量測時鐘驗 monotonic、相對差與事件歸屬，不要求不同 render FPS 的 wall-clock timestamps 相等。單執行緒 rAF 的卡頓限制需要另述。[DESIGN](../docs/DESIGN.md)、[timing-validity](../docs/operational/timing-validity.md)
- **幾何／座標單一語意。** 比較 source units、world units、rad/deg 邊界，驗非零 player offset 與 eye base；hitbox、on-target、visibility 依目前適用的權威 kernel。tracer muzzle 的視覺原點與彈道判定原點仍須分清。[CONTEXT](../CONTEXT.md)
- **熱路徑與容量邊界。** 輸入 ring 可繞圈、recorder arena 在 drill 內不可繞圈；涉及容量或寫入時驗證 overflow 與資料保留語意。新增逐 tick 配置、I/O 或離線指標運算要檢查其必要性與成本；render/replay effect 不應意外回寫 authoritative sim state。[CONTEXT](../CONTEXT.md)
- **資料是下游契約。** Result、JSON round-trip、History detail、Replay 與 Python 的相同構念應相容；缺資料應返回約定的 blocked/flag/empty-state，不能補零或靜默換成 legacy 估計。
- **parity 與獨立正確性分開。** P3 既有容差：SG 係數 ≤1e-12、一般浮點 ≤1e-9、整數／flag／verdict 精確相等；僅適用該 golden 契約。parity 證明兩端一致；封閉解、獨立 oracle 與構念驗證提供其他層的證據。[CONTEXT](../CONTEXT.md)
- **先保存失敗證據。** 禁止為了通過而放寬容差、重錄 golden、取消 skip 條件或修改凍結 protocol。經授權的語意變更應同步更新版本、權威產生流程與受影響比較，不把舊證據套到新語意。

## 5. 執行方式與環境證據

### 5.1 現有命令

從 repo root 執行；Windows PowerShell 使用 `npm.cmd`／`npx.cmd`。以下是可選入口，不是每次都要跑的固定序列。

```powershell
npm.cmd run typecheck
npm.cmd test -- src/loop/__tests__/determinism.test.ts tests/validity/reaction-time.test.ts
npm.cmd test
npm.cmd run build
npx.cmd playwright test --list
npx.cmd playwright test tests/e2e/full-drill.spec.ts --project=edge --retries=0
npm.cmd run test:ci
npm.cmd run test:stage10
```

Python gate 的工作目錄是 `research/`：

```powershell
uv run pytest
```

效能 gate 僅於適用的 task 使用，遵循原 benchmark 的 opt-in、樣本數、warmup 與 reference-machine 契約：

```powershell
npm.cmd run test:stage10:scale
```

`test:ci` 執行 Playwright 時，其 webServer 設定會要求 build + preview；local reuse 可能採用既有 server，因此不得僅憑命令名稱宣稱已驗過「這次修改重新建置的 bundle」。[本地設定](../playwright.config.ts)

### 5.2 可歸因的 E2E 與效能執行

啟動前確認 5173/4173 的占用與來源；未知 owner 的 server 不能直接當驗收環境，也不要自行停止他人的程序。dev／preview history roots 必須區分且為 synthetic 測試目錄。對既有 server 的 reuse 應記錄可核對的 build/config/root 來源；無法核對時該證據不足。Playwright 官方確認 `reuseExistingServer` 會使用既有 server，與此專案 KI-028 的失真機制相符。[Playwright webServer](https://playwright.dev/docs/test-webserver)

History／Replay 的整合路徑優先使用已有 Stage10 runner。其他 suite 在 v1 使用原命令與前置檢查，不全域更改 local reuse 規則；若之後確實需要通用 isolated runner，再以獨立需求擴展既有 helper。

E2E 報告記錄 project、browser version、觀測到的 backend、dev/preview、server 是否 reuse、root alias 與工作樹版本。`backend.spec.ts` 目前明確要求 `webgpu`；WebGL2 環境失敗需依該 gate 要求解釋，不能為了過測將期待值任意放寬。[backend.spec.ts](../tests/e2e/backend.spec.ts)

效能測量獨立執行，不與 build／全量測試競爭；記錄 OS/GPU/driver、display Hz、resolution、backend、warmup、樣本數與分位數。threshold 從該 FR/NFR 讀取，不為整個專案制定新的單一 FPS 或 ms 門檻。

### 5.3 synthetic harness、live wiring 與真人證據

`fpsTestHarness` 建立自己的 sim 管線，可自動瞄準、以人工 clock 推 tick；protocol 路徑的 `passedHarnessGate()` 直接回傳 pass，`harnessFrameLog()` 只建立一筆合成 delta。它適合驗證 config→simulation→export→metrics，但不提供真實 fullscreen、240 Hz frame pacing、實體滑鼠或人的反應時間證據。[fpsTestHarness.ts](../src/testharness/fpsTestHarness.ts)

skill 應分辨每個 case 的實際證據來源：獨立 harness、production live wiring、public preview UI、真實硬體／真人操作。同樣叫 E2E，證據範圍也不同。`*-live.spec.ts` 等 production 接線測試有價值，但若注入 synthetic input 或使用 DEV hook，仍須揭露其邊界。

本專案已有 M18 專用 Chrome/WebGL2 waiver；只能沿用在既定 prototype scope，不能寫成永久全域豁免，也不能把 waived browser 標成已測。[acceptance-stage-j §3.1](../docs/operational/acceptance-stage-j.md)

## 6. 證據格式與完成判定

第一版沿用 Stage10 的四種 evidence kind：`automated`、`measurement`、`inspection`、`manual`，及四種 status：`pass`、`fail`、`blocked`、`not-applicable`。通用報告可先寫 Markdown，不需修改既有 TypeScript schema。[Stage10EvidenceReporter](../tests/stage10/Stage10EvidenceReporter.ts)

| 欄位 | 最少內容 |
|---|---|
| Scope | task/WP/KI、基準 HEAD、dirty files／diff 識別、查核時間 |
| Contract | requirement／invariant 與當前適用決策 |
| Evidence | kind、runner、command、cwd、exit code、pass/fail/skipped 數、artifact 路徑 |
| Environment | Node/Python、browser/backend；E2E 的 server/root provenance；效能的硬體條件 |
| Verdict | status、限制、尚未執行項、有效 waiver、下一個必要動作 |

尚未執行項另列 `not run`；必需而無法執行的 gate 記 `blocked` 並保留原因。`not-applicable` 需要與本次範圍相關的理由，不能用來掩蓋失敗。waiver 獨立引用，不擴充或冒用現有狀態。

失敗後 retry 成功須記錄 `flaky` 事實；不能改寫為首次全綠。Playwright 本身區分 passed、flaky、failed，skill 應保留此資訊。[Playwright retries](https://playwright.dev/docs/test-retries)

既有 KI 僅作線索。宣稱「pre-existing failure」前，需要相同環境下的 base comparison 或可引用且足夠相同的紀錄；找不到證據就保留未知歸因。受測行為修復後只重跑受影響 gate，除非新變更、失敗或既有 DoD 要求擴大。

建議摘要範本：

```text
Verification: <task 與本次範圍>
Baseline: <HEAD + dirty/diff identity>
已通過: <需求／gate、命令、數量、artifact>
失敗或阻塞: <實際原因、是否有 base comparison>
尚未執行: <gate、原因、是否為本次必需>
適用 waiver: <來源與範圍；沒有則省略>
結論: <目前證據支持的行為與交付邊界>
```

正式 evidence 引用本次 artifact；一般開發只需簡短輸出。不要把完整受試者 payload 或真實 history 絕對路徑寫進報告；採現有忽略目錄保存本機 artifact，正式 WP 只引用可分享的結果。

## 7. Skill 封裝與草稿

建議位置為 repo 的 `.agents/skills/fps-verification/`，使規則隨專案版本演進。官方文件列出此路徑為 repository skill 來源，並支援依 description 自動選用及漸進載入 references。因為這是本專案流程，第一版只需本地 skill；跨 repo 發佈需求出現後再考慮 plugin。[OpenAI：Build skills](https://learn.chatgpt.com/docs/build-skills)

```text
.agents/skills/fps-verification/
├── SKILL.md
└── references/
    ├── verification-matrix.md   # 本文 §4：路由、當前決策與必要來源
    ├── runtime-evidence.md      # 本文 §5：server/root、harness、實機限制
    └── evidence.md              # 本文 §6：狀態、結果格式與證據歸屬
```

`SKILL.md` 保留短流程；references 保存專案特有判斷與來源，避免再複製整份 CONTEXT／DECISIONS。`agents/openai.yaml` 是可選的 UI metadata，實際封裝時再按需要生成。

以下是建議入口草稿；其中 references 為上列規劃檔案，尚未建立：

````markdown
---
name: fps-verification
description: 驗證 FPS Aim Analyst 的程式變更、bug 修復與 task/WP exit-gate，依影響範圍選擇引擎、瀏覽器、資料與研究分析檢查，輸出可追溯證據。適用於「驗證這次修改」「確認修好了」「交付前驗收」；純架構問答或文案修改不啟動完整 runtime 驗收。
---

# FPS verification

將本次需求對應到可觀察行為，執行足以支持結論的檢查，清楚區分程式正確性、操作表現與研究效度。

先讀本次 task 的 DoD 與適用 AGENTS。沿專案圖譜工作流確認受影響 symbols、consumers、config/schema 與 fixture；按日期和作用範圍核對 CONTEXT、DECISIONS 或 BUGFIX-DECISIONS。已採納例外不得被舊摘要覆蓋。

## 選擇驗證

- 記錄 repo root、HEAD、staged/unstaged/untracked 變更；使用指定 range，不假設 HEAD~1。
- 讀 [verification-matrix.md](references/verification-matrix.md)，從契約與 blast radius 選 gate；說明每項要排除的錯誤。
- 從 package.json、runner config 與 research/pyproject.toml 確認目前可執行命令。相鄰測試優先；跨模組脊椎、匯出契約或既有 exit-gate 要求時擴大驗證。
- 純文件修改驗引用與命令一致性；不要為低影響修改創造無關測試。

## 執行與判讀

- 要跑瀏覽器或效能時才讀 [runtime-evidence.md](references/runtime-evidence.md)。核對 server owner、dev/preview、synthetic history roots、實際 browser/backend。
- 同 input/seed 的逐 tick 決定性與 wall-clock 量測效度分開驗；synthetic harness 的自動瞄準、固定 clock、合成 gate/frame log 不是真人或硬體證據。
- metrics/parity 修改需指認權威端與適用容差；Python 修改另跑 Python gate。parity 一致不自動證明構念效度。
- 保存第一次失敗與退出碼。環境阻塞、assertion failure、flaky 與已證實的既有問題分開記錄。零測試、skip 與未執行不可當 pass。
- 沿原任務授權處理修復；不可僅為通過測試改 golden、容差或 frozen protocol。修改受測行為後重跑受影響 gate。

## 結果

依 [evidence.md](references/evidence.md) 報告範圍、執行命令與結果、artifact、限制及未完成項。失敗或必需證據不足時不宣稱完成。既有 waiver 只沿用其明定範圍；manual、research 或 owner gate 尚缺證據時如實保留。

完成必要且已授權的驗證；環境限制只影響依賴它的 gate。版本、程式或 fixture 改動後，不能引用舊結果為新狀態背書。Commit、merge、發佈與里程碑狀態更新依原任務授權處理。
````

## 8. 如何驗證 skill 自己有效

先檢查 frontmatter、命名、reference 連結與可用命令，再用現實案例測試決策品質。`skill-creator` 的 `quick_validate.py` 只驗結構，不證明選測或結論正確。

建議將下列案例作為第一版驗收；表格是預期行為，尚未進行獨立 agent forward-test：

| 情境 | skill 應有的行為 |
|---|---|
| 只修改操作手冊的文字 | 檢查引用與指令，不啟動 GPU、Python、全量 E2E。 |
| 修改 input tick 分配，總角位移仍相同 | 選 tick-window、cadence 與 clock-domain regression；不能僅驗總位移。 |
| 修改 eye origin，靜止 fixture 全綠 | 選非零位移／eye base 與封閉解幾何；檢查 export/metrics/replay 影響。 |
| 只改 Python 演算法，舊 committed TS golden 仍綠 | 要求 Python pytest 及適用的 golden/version 流程；不宣稱兩端新語意已驗證。 |
| `npm run test:ci` exit 0，但 local 重用了未知 server | 將 build/config/root 歸屬不足列出；補足環境證據後才能引用相關 E2E。 |
| 所有 harness tests 通過，要求宣告 240 Hz 量測合格 | 僅宣告 synthetic 測試範圍；實機 frame pacing 與真人輸入仍缺證據。 |
| 把 reaction sanity 的 150–250 ms 當每人硬閾 | 回到量級 sanity 的原義，不創造個人合格／不合格標準。 |
| hitscan 遮擋讀取 propBounds，被舊 GD-6 摘要判錯 | 核對 GD-25 additive context 與適用範圍，不盲目套舊禁令。 |
| 一次失敗、retry 通過；另有歷史 KI 名稱相似 | 保留 flaky，沒有 base 證據不斷言是 pre-existing。 |
| 把 M18 Chrome waiver 延伸到正式跨瀏覽器發布 | 判定原 waiver 超出適用範圍，不把未測 browser 標為通過。 |

評估重點是必要 gate 是否漏選、證據是否超額解讀、環境/資料是否隔離、低風險修改是否被過度驗證。先要求這些案例沒有關鍵誤判，再視實際使用補最小修正；不以 skill 字數或測試覆蓋率百分比作為品質代理。

## 9. 本次研究的實際驗證

本機 Node `v25.9.0`、npm `11.12.1`、uv `0.9.18`。GitHub CI 設定 Node `20`，因此下列執行僅是本機入口 smoke，不代表 CI 環境或全專案驗收。

實跑命令：

```powershell
npm.cmd test -- src/loop/__tests__/determinism.test.ts src/loop/__tests__/sim-clock-drift.test.ts tests/validity/reaction-time.test.ts tests/golden/research/epsilon-closed-form-geometry.test.ts tests/golden/research/promoted-kinematics.test.ts tests/stage10/Stage10EvidenceReporter.test.ts
```

第一次因沙箱權限，esbuild 無法讀上層目錄而在載入 Vite config 時失敗，沒有執行測試；依權限流程在沙箱外重跑後 **6 files／32 tests passed，exit 0**。這是環境阻塞後成功執行，不是測試 assertion flake。

`npx.cmd playwright test --list` 成功，列出 **28 files／106 tests**。這只確認 test discovery；本次未啟動瀏覽器執行 E2E，也未執行 full Vitest、typecheck、build、Python pytest、Stage10 runner、benchmark 或人工 walkthrough。

下一個落地切片可只建立上列 skill 與三份 references，完成結構檢查及情境演練；CI 擴充、通用 runner、效能基準調整各自需要獨立需求，不作為 instruction-only v1 的前置工程。
