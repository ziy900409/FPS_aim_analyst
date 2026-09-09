# WP-58 T-exit — Session Program Scheduler 驗收

## Objective

依 README FR／NFR／traceability 驗收 WP-58；證明排程層純函式化、frozen 路徑逐位不變、practice/Assessment 解耦、兩級休息語意與稽核 metadata 皆成立。**本 WP 無獨立里程碑，T-exit 即交付判定。**

## Automated gates

1. Browser 與 Node/server TypeScript typecheck exit 0。
2. 全量 Vitest exit 0，記錄 files/tests 數與編譯器 golden／不變量測試數。
3. 全量 Playwright exit 0，記錄 tests 數、browser 與 backend。
4. `npm run build`、`npm run test:ci` exit 0。
5. 邊界掃描：`sessionProgram.ts` 與 `drillFamily.ts` 無 DOM／Three／`node:*`／`Date.now`／`performance.now`／`Math.random`；`SessionRunner.ts` 無 `SharedState`／`SimLoop`／`InputSampler`／`DataRecorder`／Three。
6. 全 repo grep family id 字面值，確認只有一份 allowlist（KI-016 不重演）。
7. 400 run steps 編譯 P95 < 1 ms、預覽重繪 P95 < 50 ms、`poll()` 零配置量測達 README NFR。

## Acceptance scenarios

| ID | Scenario | Pass condition |
|---|---|---|
| A-58.1 | 使用者情境 program | `[(A,3),(B,3),(C,3)]`、30/60 秒、三個不同家族 → 17 步逐元素正確 |
| A-58.2 | 同家族相鄰 | 兩個 counterstrafe drill 相鄰 → 30s `drill` 邊界，且預覽表顯式標註 |
| A-58.3 | frozen 等價 | 標準 Assessment 的家族順序／休息／熱身／匯出與改造前逐位一致 |
| A-58.4 | 逐輪匯出 | 同一 drill 三輪產生三份唯一檔名，各自可定位 `itemIndex`／`repIndex` |
| A-58.5 | seed 語意 | 依 OQ-58.1 決議：逐輪 seed 行為有測試且寫入 metadata |
| A-58.6 | 解耦 | practice-only drill 可排入 program，但不入 `DrillMetricRegistry`／frozen cohort |
| A-58.7 | 非法輸入 | 未登記 drill／`reps=0`／負秒數 → 具名錯誤、提交禁用、永不到達 runtime |
| A-58.8 | 失效復原 | program 中途載入失敗 → 中止、錯誤可見、overlay 不殘留、phase 進 `done` |
| A-58.9 | 可及性 | 全流程可只用鍵盤完成；reps／秒數有 ARIA 標籤，錯誤訊息可讀 |

## Research/data safety

- [x] `custom` session 不進 frozen protocol 的 trend cohort，判定為 metadata 驅動的顯式規則（GD-20／C-D3）。
- [x] 排程層未修改任何 drill 參數、指標定義或 `research/` 演算法（C-D1～C-D5）。
- [x] 每一輪 rep 的 seed 可稽核並寫入 metadata（GD-5／GD-8）。
- [x] 測試只用 fixtures／validated temp roots，真實 history root 與 Participant 資料無 mutation。

## Architecture regression

- [x] `sessionProgram.ts`／`drillFamily.ts` 為純模組；邊界掃描通過。
- [x] `SessionRunner` 不觸碰三迴圈任何共享狀態（ADR-2）。
- [x] `main.ts` 完成分支鏈為三路，無 `if (customPlan)` 散落。
- [x] 全 repo 只有一份 family allowlist、一個 Session Plan runtime、一條 rest overlay 路徑。
- [x] 既有決定性／hit／recoil／ADS／result／history／replay 回歸零修改全綠。

## Documentation and graph

- [x] README 的 OQ／assumptions／interfaces／歸屬表更新為實際交付。
- [x] ~~GD-33~~ **GD-35** 已在 [DECISIONS.md](../../../DECISIONS.md) 且內容與交付一致（本行原寫 GD-33 —— 該號在 WP-58 T0 執行時已被 WP-57 T3 取用，實際入帳為 GD-35）。另補記影響面 (F)：加一個家族 id 會把其代表 drill 推上 frozen 軌的無人值守載入路徑。
- [x] progress 貼上 test／perf／a11y／acceptance evidence，[task-checklist.md](task-checklist.md) 全 ✅。
- [x] 上層 stage12 README／checklist／progress 更新 WP-58 狀態。
- [x] `docs/exec-plan/README.md` §2 加入 WP-58 列與 stage12 段落。⬜ **殘留（非本 WP）**：該檔多處仍寫「active/stage12：WP-56 ~ WP-58」，未涵蓋後加入的 WP-59；屬 WP-59 owner。
- [x] `graphify update .` 完成；CodeGraph pending 同步或已直接讀。
- [x] `git status --short` 與 staged names 只含預期 code/tests/docs。

## Exit criteria

Automated gates、A-58.1～9、research safety 與 architecture regression 全數有客觀證據才可宣告 WP-58 完成。frozen 等價、17 步 golden、practice/Assessment 解耦或逐輪匯出唯一性任一只有人工敘述、沒有 test/measurement，T-exit 不通過。

## Commit

```text
docs(stage12): close WP-58 session program scheduler
```

---

## 驗收結果（2026-09-09）✅

**全數通過。** 逐項證據見 [progress.md](progress.md) §T-exit：§4 automated gates、§5 acceptance A-58.1～9、§6 architecture regression、§7 research/data safety。

⚠️ **本 T-exit 不是純驗收**：T6 交上來的兩個 open question 由 owner 拍板後在此落地，含 3 個檔案的 production／test 修改與 27 個新測試。

| 項目 | 結果 |
|---|---|
| **OQ-58.6**（blocker） | 採選項 ①：`tracking` 代表 drill → `tracking_scene_v1`；新增不變量 5（代表 drill 必須自綁場景）；frozen live e2e 實跑該家族。規劃時的選項 ②（補 `sceneId`）經查不成立——擋住 `tracking_v1` 的是 motion range 而非缺宣告 |
| **OQ-58.7** | 修，並收斂為單一 `done` 掛點（涵蓋正常收工與中止），而非規劃建議的兩個 catch 各補一次 |
| **gate 5 邊界掃描** | 三份全部寫進 suite（T2 只自動化了 `sessionProgram.ts` 一份）。手 grep 對 `drillFamily.ts` 會噴 8 個假陽性 —— 見 progress §T-exit §2 |
| **build／typecheck／Vitest／Playwright** | `npm run test:ci` exit 0；Vitest **2,688 passed／2 skipped**、Playwright **99 passed** |
| **OQ-58.5** | ⬜ 維持開放（stage12 是否設 M22）——屬 stage 層，非本 WP 交付判定的一部分 |
