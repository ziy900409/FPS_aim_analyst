# WP-43(暫用編號)— Progress Log

> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)
> 本檔記錄:Progress(每 task 完成證據)、Decision Log(`D-43.n`,per-WP 決策)、Surprises(讀碼意外)、Open Questions(承 README §7,執行期更新狀態)。

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry gate | ✅ | 2026-08-25 | CodeGraph(current on-disk source)+指定檔案直讀+`rg` 覆核 README §0:六項行為判定仍成立;`main.ts` 三處連結行號漂移但簽名/行為未變。確認 `SessionRunner.test.ts` 有兩項測試直接依賴 `buildFamilyOrder()` 排列,`SessionRunnerPoll.test.ts` 無直接 mock/呼叫斷言但兩個 fixture 均需由 `presetId` 改為 `restSeconds`。完成 D-43.1～D-43.5;T1/T2 可依未決項安全預設開工,使用者後續回覆可在開工前覆寫。 |
| T1 launch + researcher menu | ⬜ 待開工 | — | — |
| T2 session plan reorder + rest | ⬜ 待開工 | — | — |
| T-exit 驗收 + 文件定稿 | ⬜ 待開工 | — | — |

## Decision Log

### D-43.1 — `appMode` 獨立於資格閘的 `pendingSessionMode`;ResearcherMenu 保持 callback-only

- **決定**：T1 新增 `appMode: 'launch' | 'session' | 'researcher'`;`pendingSessionMode` 保留為 session setup/eligibility gate 的低階路由狀態。`ResearcherMenu.ts` 採 README §2② 的 callback-only handle,只負責 `open()`/`close()`/`dispose()`,既有解析度/BR handler 不搬入新模組。`Controls.ts` 的可見性由既有 pointer-lock/ended 條件與 `appMode === 'researcher'` 做 AND。
- **證據**：`main.ts:359-410` 四顆按鈕目前直接設定 `pendingSessionMode` 後開同一表單;`main.ts:1092-1094` 的 `syncControlsVisibility()` 完全不含模式條件。`pendingSessionMode` 在 `EligibilityGateScreen.required()`/`onEnter()` 承擔的是資格閘路由,與純畫面層級不同。
- **Alternatives Considered**：把 `'researcher'` 加進 `pendingSessionMode`。這會把不應進資格閘的畫面狀態混入 eligibility routing,並迫使 `ResearcherMenu` 理解 `main.ts` 的 session lifecycle,沒有降低接線複雜度。

### D-43.2 — 手動 Session Plan 直接信任 family 順序,以 `restSeconds` 取代 runner 的 `presetId`

- **決定**：T2 依 README §6 contract 移除 `SessionPlan.presetId`,新增 finite/non-negative `restSeconds`;`families` 的陣列順序即執行順序,並在 runner 邊界驗證非空、合法且無重複。`Meta`/`CollectMetaArgs` additive 新增 `sessionPlanRestSeconds` 與 `sessionPlanFamilyOrder`;既有 legacy `sessionPlanPreset` 定義與驗證不刪除。
- **影響半徑**：production 需同步 `src/main.ts`、`src/session/SessionRunner.ts`、`src/ui/SessionPlanSetup.ts`、`src/data/metadata.ts`;fixtures/斷言需同步 `SessionRunner.test.ts`(5 個 `presetId` fixture,其中前兩項直接斷言 counterbalance)、`SessionRunnerPoll.test.ts`(2 個 fixture)、`SessionPlanSetup.test.ts`、`metadata.test.ts` 與 `tests/e2e/session-orchestrator.spec.ts`。`sessionSchedule.ts`/`sessionPlanPresets.ts` 本體不修改。
- **證據**：`SessionRunner.ts:127-133` 目前同時以 preset 派生休息秒數並覆寫呼叫端順序;`SessionRunner.test.ts` 的「uses buildFamilyOrder...」與「changes the first scheduled family...」明確鎖住舊語意。`metadata.ts:285-288` 仍以 `findSessionPlanPreset()` 驗證 legacy 欄位。
- **Alternatives Considered**：保留 `presetId` 並增加可選 `restSeconds`,或把自由秒數偽裝成 preset。前者會產生兩個休息來源的優先序問題;後者違反 `sessionPlanPreset` 的封閉清單語意。

### D-43.3 — 排序 UI 採 HTML5 native drag-and-drop

- **決定**：T2 使用原生 `draggable`/`dragstart`/`dragover`/`drop`,不新增外部套件;桌面 Chrome/Edge 是既有支援邊界。
- **證據**：`SessionPlanSetup.ts:40-59` 現為固定 DOM 順序的 checkbox 列表;`package.json` 無拖曳套件。原需求明示「拖曳排序」,native API 可在既有純 TS + DOM 架構內完成。
- **Alternatives Considered**：只提供 ▲/▼ 按鈕。鍵盤操作較直接,但不符合已寫入 FR-H2 的拖曳互動;若日後需要鍵盤替代操作,另以 accessibility slice 增補。

### D-43.4 — 保留 `sessionPlanPresets.ts`/`SESSION_PLAN_PRESETS`

- **決定**：T2 只讓手動 SessionRunner 路徑停止消費 preset;不得修改或刪除 `sessionPlanPresets.ts`。模組同時保留 legacy metadata 驗證能力與未來 OQ-S8-2 自動 counterbalance 模式的復用選項。
- **證據**：T0 的 `rg` 覆核發現 `metadata.ts:285-288` 仍呼叫 `findSessionPlanPreset()`;因此「移除 runner 使用後完全無消費者」的原假設不成立。`metadata.test.ts:155-157` 也鎖住封閉 preset 驗證契約。
- **Alternatives Considered**：連同 preset 模組、legacy metadata 欄位與測試一起移除。這會破壞既有匯出 contract 且擴大到本 WP 明定不處理的歷史資料相容性。

### D-43.5 — 「實驗 session」未獲新歸類前維持獨立入口

- **決定**：已向使用者提交 OQ-S8-5;截至 T0 文件落盤尚未收到歸類回覆。T1 依 task-checklist 紀律 4 的安全預設保留既有 `experimentButton`/`pendingSessionMode === 'session'` 路徑,不刪除、不搬進研究員模式、也不冒充 Session Plan。
- **證據**：`main.ts:359-378` 的入口會通過資格閘後呼叫 `experimentSession.enter(report)`,但不經 Session Plan;其產品語意無法由程式結構單獨判定。
- **Alternatives Considered**：歸入研究員模式、當成選手 Session 舊版路徑,或刪除。三者都會改變使用者可見資訊架構或既有能力,需要產品/研究者明確拍板。

## Surprises

- T0 覆核時 `main.ts` 相較規劃稿有純行號漂移:`sessionLaunchControls` 四按鈕為 359–410(原記 357–407)、`syncControlsVisibility()` 為 1092–1094(原記 1089–1094)、`experimentButton` 為 359–378(原記 357–376);行為與簽名未變,README 連結已校正。
- README §7 原稱 runner 停用 preset 後 `sessionPlanPresets.ts`「完全無消費者」;實際上 `metadata.ts:285-288` 的 legacy `requireSessionPlanPreset()` 仍呼叫 `findSessionPlanPreset()`,且 `metadata.test.ts:155-157` 有契約測試。已修正文案並以 D-43.4 關閉 OQ-S8-7。
- `SessionRunner.test.ts` 不只是可能隱含依賴 counterbalance:第一項直接 mock/斷言 `buildFamilyOrder()` 的呼叫與輸出順序,第二項直接斷言 `sessionIndex` 改變首家族。T2 必須把兩項改寫成「傳入順序逐位保持」與相應邊界驗證;`SessionRunnerPoll.test.ts` 僅需更新 plan fixture/休息秒數來源。

## Open Questions 狀態

承 [README.md §7](README.md);執行期於此表更新狀態(不修改 README 的原始建議文字,只在此追記結論)。

| # | 問題 | 狀態 |
|---|---|---|
| OQ-S8-5 | 「實驗 session」按鈕去向 | 🟡 已於 T0 提交使用者;尚未收到回覆。T1 先依 D-43.5 保留獨立入口。 |
| OQ-S8-6 | 拖曳排序元件選型 | ✅ 已關閉(D-43.3):HTML5 native drag-and-drop,不新增依賴。 |
| OQ-S8-7 | `sessionPlanPresets.ts` 是否保留 | ✅ 已關閉(D-43.4):保留;legacy metadata validator 仍有實際消費。 |
| OQ-S8-8 | 休息秒數輸入邊界 | 🟡 待 T2 執行時定案 |
| OQ-S8-4 | WP/GD 編號正式指派時機 | 🟡 已於 T0 提交使用者;未取得明確指派,暫維持 WP-43/M18/GD-25 暫用編號且不改全域索引。 |
