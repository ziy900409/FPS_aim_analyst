# WP-22 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T0 entry gate blocked(2026-07-09):WP-19/20/21 exit verified;WP-18 尚未交付

| Task | 狀態 |
|---|---|
| T0 entry gate | 🟡 blocked(WP-18 exit/交付形狀缺口;`test:ci` baseline green) |
| T1 追蹤 × 場景 | ⬜ |
| T2 protocol 執行器 + E2E | ⬜ |
| T3 決定性 + 驗收清單 C | ⬜ |
| T-exit(M10) | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S3-5 WP-18 交付形狀對帳(presentation policy / 追蹤 drill config 型 / 目標內插) | 🟡 blocked | Current main 只有 [WP-18 stub](../../stage2/wp-18-f5-subtick/README.md):entry 全達成但「未展開、待排程」,無 task/progress/T-exit,因此沒有實際交付形狀可對帳。T1 不得開跑;WP-18 exit 後重跑本對帳。 |
| OQ-22.1 protocol 條件標記落點(meta 何欄標記「本 drill 屬哪個條件/序位」) | ✅ resolved | `meta.protocol = { protocolId, conditionIndex, conditionLabel }`。`conditionIndex` 為 0-based config array index,`conditionLabel` 為檔名/人工檢查用 human label;v2 additive optional 區塊,比照 `scene`/`display`/`spawn`。 |
| OQ-22.2 pilot protocol 文件範圍(是否含受試者 ID/同意書行政欄 → 與 WP-20 T4 表單對帳) | ✅ resolved | App 只收 WP-20 T4 已落地的 `participantId`(必填)/`sessionLabel`(選填)並寫 `meta.session`;同意書、納排條件簽核、moderator 備註等行政欄不進 app,寫入 T3 `pilot-protocol-stage3.md` 文件層。 |

---

## Log

### 2026-07-09 10:52 local — T0 entry gate BLOCKED(WP-18 未交付;三上游 exit verified)

**Gate conclusion**:不得宣告 T0 PASS。WP-19/M9、WP-20、WP-21 三條工程上游已可追溯並且本次 `test:ci` baseline 綠;但 WP-18 目前仍只有 stage2 stub,狀態為 entry 全達成但未展開,沒有 tracking drill config、timed presentation policy、target render interpolation、`t_acquire`/TOT 結果頁欄位或 T-exit 證據可供 OQ-S3-5 對帳。因此 WP-22 T1 必須等待 WP-18 exit 後重跑 T0;T2 的 WP-20/21 技術上游已就緒,但仍不得把整體 T0 標 PASS。

| 上游 | Gate result | Evidence |
|---|---|---|
| WP-19 scene-system / M9 | ✅ verified | [wp-19 T-exit](../wp-19-scene-system/T-exit-gate.md) 宣告 M9 2026-07-08;四證據:場景置換、淨空拒載、跨場景決定性、ATTRIBUTIONS 稽核;`test:ci` 當時 typecheck + Vitest 48 files / 356 tests + Playwright 10 tests。 |
| WP-20 display-pipeline | ✅ verified | [wp-20 T-exit](../wp-20-display-pipeline/T-exit-gate.md) 宣告四件套交付;解析度模式、資格閘、frame log、session setup 皆有測試證據;`test:ci` 當時 typecheck + Vitest 55 files / 412 tests + Playwright 10 tests。 |
| WP-21 detection-drill | ✅ verified | [wp-21 T-exit](../wp-21-detection-drill/T-exit-gate.md) 宣告 2026-07-09;零破壞、seed 重現、t_detect round-trip 三證據;`test:ci` 當時 typecheck + Vitest 58 files / 438 tests + Playwright 11 tests。 |
| WP-18 f5-subtick / tracking drill | 🟡 blocked | [WP-18 README stub](../../stage2/wp-18-f5-subtick/README.md) 明示「entry 全達成、未展開、待排程」;`rg --files docs\exec-plan | rg "wp-18\|f5\|subtick"` 只找到 README,無 progress/task/T-exit。 |

**Baseline verification(本切片)**:
- `npm.cmd run test:ci` sandbox 內先被既有 Vite/esbuild 上層目錄讀取權限擋住。
- 提升權限重跑同一條 `npm.cmd run test:ci` → exit 0:`tsc --noEmit` pass;Vitest **58 files / 438 tests pass**;Playwright **11 tests pass**。

**OQ decisions that can close now**:
- OQ-22.1:`meta.protocol = { protocolId, conditionIndex, conditionLabel }`;`conditionIndex` = 0-based config index,`conditionLabel` = human/file label。Alternatives Considered:把條件標記塞進 `display` 或 drill id;但 protocol 是跨 display/scene/drill 的實驗層概念,獨立 optional `meta.protocol` 比較不污染既有區塊。
- OQ-22.2:行政欄不進 app;app 只消費 WP-20 T4 `meta.session`。Alternatives Considered:把 consent/moderator 欄加到 setup 表單,但那會把研究行政流程和執行器狀態耦合,也擴大 T2;T3 pilot protocol 文件可明確規範離線簽核。

**Acceptance checklist C draft(T3 定稿骨架)**:

| 條目 | 判定方式草稿 |
|---|---|
| 場景置換 x2 | `field-low` / `urban-high` load + scene metadata;沿用 WP-19 scene tests / smoke。 |
| 淨空拒載 | `DrillLoader` clearance violation fixture 指名 prop id。 |
| 資格閘拒入/放行 | `eligibilityGate` 單元矩陣 + protocol E2E 低解析度拒入。 |
| 三解析度模式 buffer | `resolutionMode.test.ts` + protocol E2E 斷 `meta.display.mode/bufferW/bufferH`。 |
| 受試者內 protocol 全流程 | WP-22 T2 Playwright:gate -> setup -> two conditions -> two exports。 |
| 偵測 round-trip 推導 | `src/metrics/detectionDerivation.test.ts` known onset <= 1 tick。 |
| 追蹤 x 場景 E2E | WP-22 T1 Playwright:tracking_scene_v1 export 含 target/player tick columns,`suspect=false`。 |
| 決定性三不變性 | WP-22 T3 regression:跨場景、跨解析度、同 seed spawn golden。 |
| `test:ci` | `npm.cmd run test:ci` exit 0。 |
| 授權稽核 | `ATTRIBUTIONS.md` 與 `public/assets/scenes/` 一一對應,無 NC/遊戲抽取/付費原始資產。 |

**Surprises & Discoveries**:
- WP-22 README 的相依列原寫 WP-18 ✅,但實際 WP-18 文件只代表 entry gate ready,不是 exit/交付。T0 已把 WP-22 狀態改為 blocked,避免 T1 誤展開。
- `graphify-out/GRAPH_REPORT.md` built commit 仍停在 `fe8aae20`,早於目前 `aa5cb0f`;本切片未改程式碼,但後續 code task 應先 `graphify update .` 後再依 graph 導航。

**Open Questions / Blocker**:
- 等 WP-18 展開並 exit 後,重跑 OQ-S3-5 對帳表:追蹤 drill config 型、motion 欄用法、presentation duration/速度階層、target render alpha interpolation、`t_acquire`/TOT/RMS ε 結果頁/匯出欄位。未完成前 WP-22 T1 不開跑。

### 2026-07-07 — FPSci R3/R4/R6 對齊(grill,GD-12)
- OQ-22.2 部分解:受試者 ID 提前至 WP-20 T4(`participantId` 必填/`sessionLabel` 選填,
  meta `session` 區塊)——本 WP T2 protocol 執行器與 E2E 應消費/斷言該欄;
  同意書行政欄仍歸 pilot protocol 文件層(T0 對帳)。
- **R4**:T3 的 `pilot-protocol-stage3.md` 納 FPSci 論文反應時間分布(150–250ms)作
  效度 baseline 引用(GD-11 紅線:引論文數據,不碰程式碼)。
- **R6 觸發點**:pilot protocol 題組定案時再議問卷模組(屆時複用 WP-20 T4 DOM 表單模式);
  過渡期可外部問卷 + `participantId` 離線串接。

### 2026-07-06 — Plan authored
- 由 stage3 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T3 + T-exit)。
- 決議依據:GD-7(追蹤 × 場景的消費面)、GD-10(受試者內 protocol 三道防線的整合點)。
- 設計要點:protocol 執行器為 **config 資料驅動**(對抗平衡順序 = 研究者排定的資料,
  非引擎邏輯);條件失效採**條件級 suspect**(非整 session 丟棄)。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— 四上游 exit 驗證,docs-only。
  ⚠️ entry 條件:M9(WP-19)+ WP-20/21 exit + **WP-18 exit(stage2 M8 後)**。
