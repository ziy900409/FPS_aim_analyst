# WP-58 T3 — SessionRunner 游標化與 runtime 接線

## Objective

把 `SessionRunner` 從「家族狀態機」改造為「`ProgramStep[]` 上的游標」，讓 frozen 與 custom 兩軌走同一個 runtime；收斂 `main.ts` 完成分支鏈，並落地 OQ-58.1 的逐輪 seed 決議（FR-58.9～58.11、FR-58.17）。**本 WP 風險最高的 task。**

## Steps

1. 改 `SessionRunnerPhase` 為 `idle | run | rest | done`（README §2.5）；`warmup` 併入 `run`。
2. 改 `SessionPlan` 攜帶編譯好的 `program: readonly ProgramStep[]`（以及稽核用的 `mode`、`items`）；`start()` 不再自行決定 drill。
3. 移除模組級 `restDurationMs`，`poll()` 改讀 `phase.step.seconds`；倒數起點與 `remainingMs` 語意不變。
4. `advance()` 改為游標推進；保留 `runTransition()` 的 promise 序列化與 `.catch()` bookkeeping。
5. 保留 `poll()` 自動推進的**載入失敗復原**：中止 session、status 顯示原因、進 `done`、overlay 隱藏。
6. frozen 路徑改為：`buildFamilyOrder()` → `families.map(resolveFamilyDrillId)` + `reps=1` → `compileSessionProgram()`；`includeWarmup` 為真時把熱身 drill 編為 program 第 0 個 `run`。
7. `main.ts`：完成分支鏈由「pilot / warmup / family / protocol」收斂為「pilot / run / protocol」；metadata 注入條件由 `phase.kind==='family'` 改為 `phase.kind==='run'`。
8. 依 OQ-58.1 決議落地逐輪 seed：若採逐輪變化，實作決定性純函式 `seedForRep(baseSeed, itemIndex, repIndex)` 並把該輪 seed 傳入 drill 載入路徑。
9. 撰寫 frozen 行為等價測試：既有 `SessionRunner.test.ts` / `SessionRunnerPoll.test.ts` 的情境改寫為新 phase union 的等價斷言，語意不得放寬。
10. 撰寫「frozen program = N 個 run + (N-1) 個 family rest」的編譯期斷言。
11. 撰寫 `poll()` 零配置量測（NFR-58.3）與三次連續 restart 的 sim 起始狀態逐位一致測試。

## Invariants

- frozen 路徑的可觀測行為（家族順序、休息時長、熱身解析、匯出內容）與本 WP 之前逐位一致。
- `SessionRunner` 不 import `SharedState`／`SimLoop`／`InputSampler`／`DataRecorder`／Three（ADR-2）。
- 休息倒數只用傳入的 `nowMs`；模組內無 `Date.now()`。
- `poll()` 每幀零配置、`O(1)`。
- `main.ts` 不得新增第五路完成分支；不得以 `if (customPlan)` 散落多處。

## Definition of Done

- [ ] frozen 行為等價測試全綠，且「frozen program 形狀」有編譯期斷言。
- [ ] `restDurationMs` 模組級變數已移除；兩級休息各自正確倒數有測試。
- [ ] 載入失敗復原測試保留並全綠（overlay 不殘留、phase 進 `done`）。
- [ ] `poll()` 零配置有量測證據；`O(1)` 由讀碼與測試共同確認。
- [ ] 三次連續 `loadDrillById(sameId)` 的 sim 起始狀態逐位一致有測試。
- [ ] OQ-58.1 決議已落地；逐輪 seed（若採變化）為決定性純函式且有測試。
- [ ] `main.ts` 完成分支鏈為三路，metadata 注入在 `run` phase 生效。
- [ ] 既有決定性回歸測試**零修改**全綠（NFR-58.2）。
- [ ] progress 記錄 CodeGraph impact、測試數與行為等價證據。

## Commit

```text
refactor(session): drive session plan from a compiled program cursor
```
