# WP-58 T2 — Session Program 純函式編譯器

## Objective

建立 `src/session/sessionProgram.ts`：把 `(drillId, reps)[]` + 兩個休息秒數編譯成有序 `ProgramStep[]`，五條規則全部在編譯期決定（FR-58.4～58.8）。本 task **不接線**，只交付可獨立測試的純函式。

## Steps

1. 定義 `SessionProgramItem`、`SessionProgramPlan`、`ProgramBoundary`、`ProgramStep`（README §2.4 契約）。
2. 實作 `compileSessionProgram()`：展開 reps → 判定相鄰邊界 → 取秒數 → 省略 0 秒 rest → 頭尾不補 rest。
3. 實作輸入驗證（FR-58.7），每種違反丟出具名錯誤：空 `items`、未登記 `drillId`、`reps` 非正整數、秒數非有限非負。
4. 實作 `summarizeProgram()`：`runCount` 與 `totalRestSeconds`，供 T4 預覽表使用。
5. 撰寫五條規則的表格測試，每條至少一組正例與一組邊界例。
6. 撰寫 **golden 案例**：`[(A,3),(B,3),(C,3)]`、`drillRest=30`、`familyRest=60`、A/B/C 三個不同家族 → 逐元素斷言 17 個 step。
7. 撰寫同家族相鄰案例：兩個 counterstrafe drill 相鄰 → 中間為 `boundary='drill'` 的 30s（釘死 R-58.8 的行為是**設計**而非 bug）。
8. 撰寫 0 秒省略、單 item 單 rep（program 長度 1、無 rest）、A-B-A 交錯三組案例。
9. 執行 400 run steps benchmark（NFR-58.4）。
10. 模組邊界掃描：無 `document`／`window`／`three`／`node:`／`Date.now`／`performance.now`／`Math.random`。

## Invariants

- 相同輸入恆產生逐位相同輸出（無時鐘、無亂數、無外部狀態）。
- `program[0].kind === 'run'` 且 `program.at(-1)!.kind === 'run'`（`items` 合法時恆成立）。
- 任兩個相鄰 `run` 之間至多一個 `rest`；不存在相鄰兩個 `rest`。
- `rest.seconds > 0`（0 秒已於編譯期省略）。
- 驗證失敗時**不回傳部分結果**，一律丟錯。

## Definition of Done

- [ ] 五條編譯規則各有表格測試，全綠。
- [ ] 使用者情境 17 步 golden 逐元素斷言通過（含 `boundary` 與 `seconds`）。
- [ ] 同家族相鄰、0 秒省略、單步 program、A-B-A 交錯四組案例全綠。
- [ ] 非法輸入的具名錯誤矩陣全綠，且無「靜默補預設值」路徑。
- [ ] 400 run steps P95 < 1 ms 有可重現量測數據。
- [ ] 模組邊界掃描通過（NFR-58.1）。
- [ ] progress 記錄測試數、benchmark 與實際契約。

## Commit

```text
feat(session): compile session plans into ordered program steps
```
