# 驗證路由與引擎契約

程式、設定或資料契約變更時讀本檔。下列路徑相對 repo root；它們是選測入口，不代表整列都必須執行。執行前確認檔案存在、assertion 覆蓋本次主張，並從實際影響面補足漏項。

## 決定 gate

以 task DoD／FR／NFR 及最新適用決策為準。沿 [AGENTS.md](../../../../AGENTS.md) 使用圖譜查影響面；若環境只提供 `codegraph_explore`，用其 source/blast-radius 結果並註明工具差異，不假裝呼叫不可用的工具。圖譜缺席時遵循 AGENTS 的初始化流程，同時可繼續已知路徑的非依賴工作。圖譜不是測試、JSON 或動態接線的完整覆蓋清單。

跨模組脊椎如 SharedState、SimLoop、DataRecorder、DrillLoader 與 export schema 改動，沿 consumers 擴大檢查；沒有圖譜 caller 不足以判定局部變更。純文件修改不需展開這張表。

| 變更區域 | 要驗證的契約 | 候選測試入口（相對 repo root） |
|---|---|---|
| `src/input/`、`src/loop/`、`src/state/` | 時鐘域、事件排序／半開窗、late/overflow、固定 tick、跨 render cadence 一致性 | 相鄰 tests；`src/loop/__tests__/`、`tests/regression/`、`tests/validity/`；實際輸入接線加 `tests/e2e/input-sampler.spec.ts`、`tests/e2e/raw-mouse-sampling.spec.ts` |
| `src/sim/`、`src/weapon/`、`src/recoil/`、`src/ballistics/` | seeded RNG、固定步長、recoil 子節奏、首發／hit 關聯、hitscan/projectile gating | 相鄰 tests；fire／spray／projectile determinism；需要 UI 接線時加 `tests/e2e/weapon-select.spec.ts`、`tests/e2e/spray-drill.spec.ts` |
| `src/drill/`、`drills/`、session config | default 相容性、seed/spawn/schedule、frozen protocol、Practice/Assessment 隔離 | drill schema／family tests、`src/pilot/protocolFreeze.test.ts`、`src/session/` tests；對應 drill／session E2E |
| `src/render/`、`src/view/`、`src/scene/`、`src/display/`、`src/main.ts` | backend、相機／幾何、resolution/ADS 接線、效果與資源釋放 | 相鄰 tests、`src/scene/architecture.test.ts`、`tests/e2e/backend.spec.ts`、`tests/e2e/isolation.spec.ts`、相關 live／replay E2E；視覺／效能主張另補對應證據 |
| `src/data/`、recorder、export schema | JSON round-trip、順序、overflow、metadata、舊格式與下游相容 | data tests、`tests/e2e/full-drill.spec.ts`、`tests/golden/research/`；受影響 Python loader、History／Replay 另加其 gate |
| `src/metrics/`、`research/`、parity/golden | 權威端、單位／eye origin、容差、flag/n/verdict、缺資料語意 | 相鄰 tests、`tests/golden/research/`、research pytest；幾何／計算主張用封閉解或獨立 oracle；構念主張另核資料證據 |
| `src/session/`、`src/pilot/`、`src/ui/` | start/rest/retry/abort、重新進入、武器／seed 重設、焦點、實際接線 | 相鄰 tests；`tests/e2e/session-orchestrator.spec.ts`、`tests/e2e/tracking-pilot-live.spec.ts`、`tests/e2e/tracking-pilot-operator.spec.ts` 等受影響流程 |
| `server/history/`、`src/history/`、`src/replay/` | 原子保存、cohort 分離、重啟、race/cancel、seek purity、生命週期 | `tests/history/`、`tests/replay/`、`tests/stage10/`；`test:stage10` 與相關 History／Replay E2E；效能要求適用時才加 scale benchmark |
| scripts、依賴、工具設定 | 命令／exit code、選測、build、dev/preview、cleanup | 受影響 runner/config 的測試與實際命令；沿其 consumers 擴展 |

TS 程式變更通常加 `typecheck`；bundle、入口、依賴或 preview 行為涉及時加 `build`。本地相關 tests 通過後仍須完成 task 指定的完整 exit-gate；不要以 targeted run 代替必需的全套。

## 命令權威與範例

先核對 [package.json](../../../../package.json)、[vite.config.ts](../../../../vite.config.ts)、[playwright.config.ts](../../../../playwright.config.ts)、[CI workflow](../../../../.github/workflows/ci.yml)。不要假設名為 `test:ci` 的 script 等於 GitHub 實際執行範圍，也不要新增不存在的 lint gate。

Windows PowerShell 在 repo root 使用以下入口；其他 shell 用對應的 `npm`／`npx`。它們是選項，不是固定執行清單。

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

Vitest 與 Playwright 的 include 以當前設定為準：既有慣例是 `.test.ts`／`.spec.ts` 分工。`--list` 只證明 discovery；不要將它回報成執行成功。

Python 依 [research/pyproject.toml](../../../../research/pyproject.toml) 與 [research/README.md](../../../../research/README.md)，以 `research/` 為工作目錄：

```powershell
uv run pytest
```

Python runtime/dependencies 未就緒屬環境問題；舊 TS fixture 的 pass 不能填補修改後 Python 未測的缺口。

## 引擎與資料判準

相關變更才讀 [CONTEXT.md](../../../../CONTEXT.md) 對應術語與 [DECISIONS.md](../../../../docs/exec-plan/DECISIONS.md)／[BUGFIX-DECISIONS.md](../../../../docs/known_issue/BUGFIX-DECISIONS.md)。本檔是導航，數值與例外仍以適用契約為準。

- **決定性／計時：** 同 input/seed 比逐 tick state，不要求不同 render FPS 的 wall-clock timestamps 相等。驗時間相對差、單位、事件歸屬；量測 monotonic clock 與 session 的日曆 metadata 用途不同。[DESIGN](../../../../docs/DESIGN.md)、[timing-validity](../../../../docs/operational/timing-validity.md)
- **輸入：** 總角位移正確仍可能逐 tick 歸屬錯；變更 tick-window integral 時測 cadence 與時間邊界。[KI-005](../../../../docs/known_issue/KI-005-omega-render-sim-aliasing.md)
- **幾何：** 測非零 player offset 與 eye base，核對 source/world units、rad/deg、hitbox/on-target 權威；只用原點靜止 fixture 可能掩蓋錯誤。[KI-004](../../../../docs/known_issue/KI-004-sim-world-unit-domain-mismatch.md)
- **場景例外：** 舊摘要的 GD-6 禁令需對照 GD-25：`hitscanOcclusion` 是已採納的 additive context；既有省略路徑與 projectile 邊界要保留。不能把某一歷史例外擴大到所有場景／武器。
- **熱路徑：** 輸入 ring 可繞圈、recorder arena 在 drill 內不可繞圈；容量變更驗 overflow/保留語意。新增逐 tick allocation、I/O 或離線運算需評估成本。tracer muzzle 原點、彈道原點與 render/replay 對 sim 的寫入邊界分清楚。
- **資料：** 匯出／Result／History／Replay／Python 的相同構念維持契約；缺資料依規格輸出 blocked/flag/empty-state，不補零或靜默回退 legacy 算法。
- **parity：** 指認權威端、fixture 產生來源與版本。既有 promoted P3 契約是 SG 係數 ≤1e-12、一般浮點 ≤1e-9、整數/flag/verdict 精確一致；不可把這組容差泛用到其他測試。共用錯誤可能兩端都綠，仍需適用的獨立 oracle。
- **構念：** schema/dt 通過不代表資料包含待量測行為；保留 construct/reliability gates、n/n_flagged 與 research-only 邊界。[KI-006](../../../../docs/known_issue/KI-006-m14-sample-no-counterstrafe.md)、[research/README.md](../../../../research/README.md)

遇到文件衝突，列出衝突與已明確採納的決策；code 說明實作現況，不能自動取代需求。仍未解決且會改變驗收判準時，保留該項待釐清並繼續其他 gate。
