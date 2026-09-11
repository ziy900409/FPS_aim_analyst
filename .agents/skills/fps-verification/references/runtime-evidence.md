# 瀏覽器、效能與實機證據

跑 E2E、視覺或效能驗收時讀本檔；路徑相對 repo root。先看當前 [playwright.config.ts](../../../../playwright.config.ts) 與該 task 的驗收文件。

## 執行環境歸屬

本專案現有 Playwright 使用系統 Edge project `edge`；dev/preview 為 5173/4173，各自注入不同的 `FPS_HISTORY_ROOT`。local `reuseExistingServer` 可能讓既有 server 繞過此次 command/env，包括 build+preview。`npm run test:ci` 的名稱本身不會設定 `CI` 環境變數。

1. 記錄 workspace/HEAD/受測 diff、dev 或 preview、browser/version、觀測到的 renderer backend；實際值未知就標示未知。
2. 檢查會用到的 port 及 server owner。reuse 既有 server 時，核對並記錄 workspace、build/config、history root 來源；無法核對就不能把相關結果當成本次變更的可靠驗收證據。
3. dev/preview 使用不同的 synthetic roots；避免落入真實 `data/session-history/`。若啟動了其他 app 或未知 root 的服務，停止依賴它的測試；不要終止不屬於本次 run 的程序。
4. 使用既有 runner 管理其程序。自啟 helper 時追蹤 owner、失敗/中斷 cleanup 及子程序樹；只清理已確認屬於本次 run 的 temporary paths/processes。

對純文件或 unit gate，不必為了填這些欄位啟動瀏覽器。環境 gate 阻塞時，仍可完成其他不依賴它的必要驗證。

[KI-028](../../../../docs/known_issue/KI-028-capture-script-orphans-dev-server-hijacking-e2e-history-root.md) 曾出現同一 app 的孤兒 server 被重用，測試全綠但 root/config 不同；「server 有回應」不足以識別環境。不要全域更改 local reuse 規則來處理一次驗收；優先選用既有隔離 runner 或本次已核對的服務。

## Stage10 路徑

History／Replay 整合需要隔離 roots、程序生命週期與 evidence 時，優先沿用 `npm.cmd run test:stage10`，查閱 [T1 acceptance harness](../../../../docs/exec-plan/active/stage10/wp-51-m18-integration-and-acceptance/T1-acceptance-harness.md) 及 [Stage10Runner](../../../../tests/stage10/Stage10Runner.ts)。它的 gate 範圍不等於整個專案；按本次 DoD 補其他測試。

在啟動前確認 ports 可用、當前 runner 契約與 synthetic fixture；未知 port owner 屬環境阻塞。不要為了測試清空或覆寫真實 history，也不要從 participant 資料推導新的可提交 fixture。

## 證據來源的邊界

| 來源 | 能支持的主張 | 仍需補充的證據 |
|---|---|---|
| Unit／regression／golden | 已列出的行為、決定性、計算或雙端一致性 | public app 接線、硬體／真人表現 |
| 獨立 `fpsTestHarness` | config→sim→export→metrics 管線 | production live wiring、真實 display gate、frame pacing、實體輸入 |
| live E2E／DEV driver | 實際 app 接線中被 assertion 覆蓋的路徑 | 仍須揭露 synthetic input／DEV hook；不能推定真人反應 |
| public preview UI | 該 build 在 production UI 路徑的行為 | 未測 backend、hardware、操作／效能要求 |
| 實機量測／真人操作 | 記錄環境、步驟與樣本內的結果 | 不能任意外推其他硬體、樣本或研究構念 |

`fpsTestHarness` 建立獨立 sim、可自動瞄準、用人工 clock 推 tick；protocol 路徑的 `passedHarnessGate()` 直接回 pass，`harnessFrameLog()` 建立合成 delta。故其 pass 不能用來宣告真實 fullscreen／240 Hz frame pacing 合格。[fpsTestHarness.ts](../../../../src/testharness/fpsTestHarness.ts)

目前 [backend.spec.ts](../../../../tests/e2e/backend.spec.ts) 要求實際 backend 為 `webgpu`。`navigator.gpu` 存在或偵測到合法 backend，不能代替這項 assertion。WebGL2 環境與此 gate 不符時，按需求記錄，不任意放寬期待值。

## 效能、視覺與研究驗收

- 效能主張才啟動 benchmark；一般 correctness run 不自動觸發。Stage10 入口為 `npm.cmd run test:stage10:scale`，執行前讀當前 script／task 的 opt-in 與量測契約。threshold、warmup、樣本數與分位數沿用 FR/NFR，不新增全域 FPS/ms 門檻。
- 不讓 benchmark 與 build／全量測試競爭。記錄 OS、GPU/driver、browser/backend、display Hz、resolution、背景負載與必要的 cold/warm 條件。
- 截圖、影片或目視只能證明被觀察的畫面／步驟；不能替代數值、輸入或延遲量測。`t_visible` 也不能自動視為光子到達眼睛的時刻。[timing-validity](../../../../docs/operational/timing-validity.md)
- 真人 reaction distribution 的 150–250 ms 是既有量級 sanity 說明，不是每位受試者的硬性 pass band；不要把超出範圍直接解讀成操作失敗或引擎錯誤。
- 需要真人／實機而環境無法操作時，保留具體步驟、環境欄位與缺失證據。可執行的自動部分照常完成；不能代填 manual pass。
- [M18 dossier §3.1](../../../../docs/operational/acceptance-stage-j.md) 的 Chrome/WebGL2 waiver 只適用其明定 prototype scope；不能擴成正式跨瀏覽器發布的永久豁免，也不能把 waived 寫成已測。
