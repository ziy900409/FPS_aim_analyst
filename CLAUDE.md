# CLAUDE.md — 專案執行協議與導航

> 本檔每個 session 開場即載入,是 agent 的**程序記憶 (procedural memory)**:固化「怎麼在這個 repo 做事」與「去哪找知識」。保持精簡。
> 文件語言:**繁體中文,技術術語保留英文原文**(決策 D4)。

---

## 1. 專案一句話

瀏覽器中執行的第一人稱 **counter-strafe(反向急停)瞄準訓練器**(Three.js `WebGPURenderer` + TypeScript + Vite)。精準採集鍵鼠輸入與遊戲狀態,量測「急停時機」與「首發命中」,匯出資料供研究分析。階段 A 交付 F1–F4 + 1 個 counter-strafe drill。

---

## 2. 文件導航(知識去哪找)

| 想知道 | 看這裡 |
|---|---|
| 全部文件目錄 / 導航 | [docs/MAP.md](docs/MAP.md) ← **先看這個** |
| 專有名詞 / 正規術語(semantic memory) | [CONTEXT.md](CONTEXT.md) |
| 需求 / ADR-1~9 / WBS(source of truth) | [docs/規格書_Three.js_WebGPU_反向急停瞄準訓練器.md](docs/規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) |
| 大框架計畫 / 決策 D1–D5 / 架構總覽 | [docs/PLAN.md](docs/PLAN.md) |
| 可執行任務(要做什麼) | [docs/exec-plan/README.md](docs/exec-plan/README.md) → `active/wp-N-*/` |
| 全域決策 / 跨文件矛盾帳本(feature/WP) | [docs/exec-plan/DECISIONS.md](docs/exec-plan/DECISIONS.md) |
| 已知 bug / 修 bug 決策帳本 | [docs/known_issue/](docs/known_issue/) → 診斷計畫 `KI-NNN-*.md` · 決策 [BUGFIX-DECISIONS.md](docs/known_issue/BUGFIX-DECISIONS.md) |

**命名任何東西前**(變數/函式/類別/檔案/欄位),先對齊 [CONTEXT.md](CONTEXT.md) 的正規術語。

---

## 3. 執行協議(怎麼做事)

> 沿用 [exec-plan/README.md §5](docs/exec-plan/README.md)。違反這幾條 = 破壞專案的記憶與可稽核性。

1. **一個 task = 一個垂直切片 = 一個原子 commit**。先驗證再 commit;當前 task 未 commit 不開下一個。
2. **只開你正在做的 task 檔**(+ 指名原始檔)。單 task context 應 < 40%。
3. 每個 task 檔自帶 **Steps / Definition of Done / Commit message**,照著走。
4. task 完成時:
   - 更新該 WP 的 `progress.md`(Progress / Decision Log / Surprises / Open Questions),與切片一起 stage。
   - 把該 WP `task-checklist.md` 的 **Done** box 翻 ✅。
5. WP 完成:把 [exec-plan/README.md §2](docs/exec-plan/README.md) 該 WP 狀態翻 ✅,視需要把資料夾移入 `completed/`。
6. **跨 WP 先驗上游 exit-gate 已綠燈**(entry-gate task 的職責)。
7. **跨 WP / 跨文件的決策或矛盾** → 寫進 [DECISIONS.md](docs/exec-plan/DECISIONS.md)(per-WP 的寫 `progress.md`,跨界的寫全域帳本)。
8. 里程碑門控:**M1(WP-2 脊椎)未過,不展開 WP-3 之後**。
9. **修 bug(known issue)**:診斷 + 修改計畫寫 `docs/known_issue/KI-NNN-*.md`(tech spec);修復**決策**(選了哪個修法、為何、偏離協議、遺留 OQ)寫 [known_issue/BUGFIX-DECISIONS.md](docs/known_issue/BUGFIX-DECISIONS.md)(編號 `BD-n` 對應 `KI-NNN`)。落地時同步翻 KI doc 狀態 + 帳本索引。純 feature/WP 決策仍走 §7 的 DECISIONS.md。

---

## 4. 不可違反的硬約束(技術)

> 這些是研究效度的前提,任何 task 都不得破壞。出處見規格 ADR。

- **禁用 `Date.now()`**:一律 `performance.now()`(量測時鐘域,ADR-4)。
- **`import * as THREE from 'three/webgpu'`**(非 `'three'`),否則拿不到 `WebGPURenderer`;bootstrap 必須 async(`await renderer.init()`)。
- **cross-origin isolation 必須生效**(`crossOriginIsolated === true`,COOP/COEP),否則計時精度不足、量測資料失效(ADR-4)。
- **決定性 (determinism)**:同一輸入序列在不同 render FPS 下,sim **狀態**(tick index 對應的 position/velocity/命中)一致;**不**斷言 wall-clock 時間戳。
- **移動目標位置一律以 `age`(sim tick 累加的邏輯秒數)驅動的純函式演進**,不代入變動 dt、不讀時鐘(`Date.now`/`performance.now`/rAF frame time)——與逐 tick 決定性契約相容;`static`/省略 motion 逐位不變(WP-18/GD-7,規格 FR-B17 / 附錄 G)。
- **三迴圈只透過 `SharedState` 溝通**,互不直接呼叫(ADR-2)。
- **固定佈局紀律**:**輸入緩衝 = 真 ring**(消費後繞圈)、**`DataRecorder` = preallocated arena**(非環狀、drill 內不繞圈);兩者皆固定欄位、物件重用、不 `push` 物件(避免 GC 卡頓)。
- **UI = 純 TS + DOM overlay**(D1),階段 A 不引入 React/Vue/Lit。
- **階段 A 鎖 Chrome/Edge 桌面版**;`event.timeStamp` 與 `performance.now()` 同源可減僅 Chromium 成立。
- **sim/recoil 禁 `Math.random()`**:所有隨機性一律注入 seeded RNG,seed 寫入資料/metadata(GD-5)。
- **spawn 隨機化一律 seeded**:`sequence.seed` → `createRan1`;spawn 位置/延遲取樣與 seed 必須寫入匯出 metadata(GD-5/GD-8)。
- **recoil 衰減以 1/64s 步長定義**:128Hz sim 內以 64Hz 子節奏呼叫,不得用變動 dt 代入(GD-5)。
- **FPSci 授權紅線**:NVlabs/FPSci 為 CC BY-NC-SA 4.0——**禁止複製/改寫其任何程式碼或 config 進本 repo**(share-alike 傳染 + 禁商用);允許參考方法學與 schema 欄位語意(GD-11)。
- **場景幾何永不進 sim runtime**:`propBounds`/GLTF mesh/場景 collision 只可被 render/scene validation 層讀取;`src/sim`、`SharedState`、`HitDetector`、`TargetManager` 不得引用任何場景資料(GD-6)。
- **場景資產授權白名單**:可 commit 的場景資產僅限 CC0 或 CC-BY 且需在 `ATTRIBUTIONS.md` 可稽核;CC-BY-NC、遊戲抽取資產、付費包原始檔禁止進 repo(GD-9)。
- **解析度/場景切換不改 sim**:解析度模式、fullscreen、場景切換與 frame log 僅可落在 render/UI/data/validation 層;不得改變 `SIM_HZ`、sim 狀態演進、輸入鏈或命中判定(GD-6/GD-10)。
- **目標 hitbox 單一來源**:`DrillConfig.targets.hitbox?` 省略時必須逐位等同現行 H1 `{1,2,1}`;命中判定(`HitDetector`)與 on-target 離線推導(`trackingDerivation`)必須使用同一 AABB 來源(`TargetState.hitbox` / export `meta.targets.hitbox`),不得新增另一套閾值或尺寸常數(WP-23/GD-7)。
- **ADS 只落輸入/render/data 層**:`EV_ADS`/`heldAds` 可影響 `CameraController` FOV 與滑鼠 gain,但不得改 `SIM_HZ`、目標演進、命中幾何或彈道語意;ads 狀態必須同時記錄事件與逐 tick flag,否則 ADS drill 分析無效(WP-24/GD-16)。
- **彈道模型必須 config-gated**:`WeaponConfig.bullet` 省略時必須走現行 hitscan 路徑且逐位不變;projectile 演進只能是固定 128Hz 步長純函式,禁時鐘、禁 `Math.random`,參數由 config 注入(WP-25/GD-17)。
- **子彈永不與場景幾何互動**:projectile / hitscan 只可測目標 hitbox;不得讓 `propBounds`、GLTF mesh 或場景 collision 進入彈道命中語意,以維持 GD-6 純裝飾場景本體論(WP-25/GD-6)。
- **tracer/軌跡顯示為 render-only**:sim 產彈點最多寫 `SharedState` preallocated ring;`TracerView` 只能唯讀 ring 繪製,不得回寫 sim 狀態、不得記錄 export、不得改命中/指標語意(WP-25)。
- **tracer origin 為 muzzle 偏移,與命中/彈道原點分離**:muzzle 只寫 `shotRays` / `BulletArena.m*`,不得進入 raycast 原點、`arena.o*`(maxRange/落地基準)或 `pushImpact`(WP-27/GD-18)。

---

## 5. 記憶分層(這個 repo 如何記憶)

| 層 | 載體 | 寫入時機 |
|---|---|---|
| Working(短期) | 當前 `Tn-*.md` + 指名原始檔 | 執行中,不落盤 |
| Semantic(概念) | [CONTEXT.md](CONTEXT.md) / 規格書 | 新術語或架構概念定案時 |
| Episodic(發生過) | per-WP `progress.md` + git history | 每個 task 完成 |
| 全域決策/矛盾(feature) | [DECISIONS.md](docs/exec-plan/DECISIONS.md) | 跨 WP/跨文件的決策或不一致 |
| 除錯決策(bug 修復) | [known_issue/](docs/known_issue/):`KI-NNN-*.md` + [BUGFIX-DECISIONS.md](docs/known_issue/BUGFIX-DECISIONS.md) | 每個 bug 診斷/修復定案 |
| 程序(怎麼做) | 本檔 + task 內建 DoD | 協議變更時 |

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

<!-- CODEGRAPH_START -->
## codegraph — Code Intelligence

This project has a **codegraph** MCP server (`codegraph_*` tools, config in `.mcp.json`): a tree-sitter-parsed knowledge graph of every symbol / edge / file. Reads are sub-millisecond and return structural info grep cannot. Use it for **structural** questions; use native grep/read only for literal text (string contents, comments) or after a file is already open.

| Question | Tool |
|---|---|
| "Where is X defined?" / find symbol by name | `codegraph_search` |
| "What calls Y?" / "What does Y call?" | `codegraph_callers` / `codegraph_callees` |
| "How does X reach Y?" (trace a flow) | `codegraph_trace` (one call = whole path) |
| "What breaks if I change Z?" | `codegraph_impact` |
| "Show Y's signature / source" | `codegraph_node`（多個符號一次 → `codegraph_explore`） |
| "Focused context for a task/area" | `codegraph_context` |
| "Is the index healthy?" | `codegraph_status` |

Rules:
- **Trust codegraph results** (full AST parse) — 不要再用 grep 覆驗。查符號別先 grep：`codegraph_search` 一次回 kind + location + signature。
- 回答架構/「X 如何運作」問題直接答：`codegraph_context` → 一次 `codegraph_explore` 取源碼，別另開 sub-agent 或 grep+read 迴圈重做索引已做的事。
- **Staleness**：回應開頭若有 "⚠️ … edited since the last index sync" banner，列出的檔案待重索引 → 直接 Read 那幾個檔;未列出的檔 codegraph 為權威。`codegraph_status` 亦列 pending。
- **改檔後**：`codegraph sync .`（或 daemon 自動同步）保持索引最新。`.codegraph/` 不存在時 MCP 回 "not initialized" → 問使用者是否 `codegraph init`。
<!-- CODEGRAPH_END -->
