# WP-60 — progress.md

> 主規格：[README.md](README.md) · 清單：[task-checklist.md](task-checklist.md)

## 最新狀態（2026-09-09 T-exit）

**T-exit 與三項 follow-up 已收尾**（見 §T-exit gate）：A-60.1～16 逐條有指令與輸出，
15 ✅／1 ✅ 帶上界告警，無 🟡／❌；typecheck ×2、全量 Vitest（2614 passed）、`vite build` exit 0，
全量 Playwright 單 worker **101 passed／0 failed**。

**TF1／TF2 已於 2026-09-09 補齊**：A/B 可比性五項全過；F6 的 Δp95 = **−0.005 ms** 且
`overBudgetWindows` 未新增，A-60.16 判 **✅**；B 組 `activeRateHz = 708 Hz`，18／30／50 ms sweep
與限制已記錄，T3 DoD 第 9 項判 **✅**。⇒ **T0 與 T3 已轉 ✅**。

**TF3 已於 2026-09-09 補齊**：5173／4173 原本即淨空，未停止任何 server、未碰 5174；
`npx.cmd playwright test --workers=1` **101 passed（13.8m）**，零失敗可歸屬，WP-60 raw-mouse 2／2 passed；
測試 history roots 存在且真實 `data/session-history/` 前後快照未變。⇒ **三項具名缺口全部關閉**。

**合併**：本 WP 已於 2026-09-09 併入 `main`（merge commit `9015610`）。合併後的整棵樹重跑三閘全綠：
typecheck exit 0、`npm test` **249 files / 2764 passed（1 file / 2 tests skipped）**、`vite build` exit 0（195 modules）。
唯一實質衝突是 `src/data/metadata.ts` —— WP-58 的 `SessionPlanItemMeta` 與本 WP 的 `MouseSamplingMeta` 在同一位置各加一個
interface，兩者互不觸及對方欄位，**兩邊都保留**；`graphify-out/` 取 main 側後重新產生。

本 gate 另落地一個修復 **D-60.X1**：T4 的事件率 blocker 讀整段平均率，會把 R2 三組真人 run（417／494／412 Hz）
全部誤判為「事件率不足」，改為讀排除空洞後的連續期間事件率。

較早紀錄：R1 已通過；R2 三組摘要已取得，結論為空洞長度不足以可靠分離 lift/pause。下方較早紀錄中的
「R2 待實機」由 §T0 R2 節更新；T1/T2/T4 既有完成狀態不變。

## T0 R2 實機結果與 WP-61 收斂

來源：本次對話中，使用者依每組 10 次操作協定貼回 `JSON.stringify(__end(label), null, 2)`。環境回報 `{ aimDebug: 'object', rawMouse: true, coi: true }`，pause/oneshot 另回報 `rawInputEnabled = true`。入口為 `http://localhost:5174/?rawMouse=1`，worktree 為 `wp-60-raw-mouse-t1`。本輪未另核對硬體型號、DPI、瀏覽器版本、顯示更新率、drill ID 或執行當時 commit，不以目前 HEAD 充當測試版本。

| 指標 | ④ lift | ⑤ pause | ⑥ oneshot |
|---|---:|---:|---:|
| samples | 11556 | 11597 | 2825 |
| spanSec | 27.72 | 23.47 | 6.86 |
| zeroDelta | 0 | 0 | 14 |
| tinySamples | 6179 | 7765 | 864 |
| tinyPct | 53.5 | 67.0 | 30.6 |
| gapCount（原始 dtUs > 5000） | 65 | 64 | 78 |
| gap p10 / p50 / p90（ms） | 5.1 / 8.4 / 1442.2 | 5.1 / 7.8 / 1071.4 | 5.2 / 21 / 137.3 |
| max gap（ms） | 1850.4 | 1363.3 | 270.4 |
| gap > 1000 ms 的筆數 | 9 | 8 | 0 |

口徑：spanSec 為 dtUs[1:] 總和換算秒；gap 先篩 dtUs > 5000，再換算 ms、四捨五入至一位小數及排序；分位索引為 min(n−1, floor(p×n))。故顯示為 5.0 ms 的值仍可能通過原始 >5 ms 篩選。tiny 定義為 abs(dx)+abs(dy) ≤ 2，涵蓋整段 recorder 樣本；zeroDelta 來自 capture listener 在 Pointer Lock 下的 coalesced events，與 recorder 並非同一母體。

lift 九個 >1 s 空洞為 1257.4、1416.4、1442.2、1490.1、1524.1、1644.8、1745.4、1832.3、1850.4 ms，另有 245.5、347.0 ms。pause 八個 >1 s 空洞為 1066.0、1071.4、1111.7、1143.5、1181.7、1283.0、1294.4、1363.3 ms，另有 859.9 ms。只記統計摘要，真人逐筆軌跡不進 repo。

**D-60.R2-1：本輪無法僅靠空洞長度可靠區分 lift/pause。** 兩組秒級範圍重疊，停住也有無樣本區間；時間間隙不是感測器離地的直接證據。oneshot 無 >1 s 空洞，但最大 270.4 ms，未重現前輪連續移動的 18.2 ms 上限。不能據此凍結 30 ms、1 s 或其他分類門檻，也不能宣稱 PA Stage 2/3 已有效。

限制：每組只有一輪，十次動作依操作協定、無逐次時間標註，不能把九個長空洞當作九次成功偵測。allGapsMs 已排序，無法定位起始空洞，本輪不剔除任何一筆。未取得完整 dtUs/dx/dy 與 Pointer Lock 時序，不能重算全部摘要、判斷 270.4 ms 成因或分析前後運動學。整段 tinyPct 不能代表停頓期間微顫；含停頓的 samples/spanSec 不能替代 R1 活動取樣率。

R2 分離問題已有探索性答案；逐次標註與泛化驗證交給 [WP-61 範圍草案](../wp-61-lift-off-validation/README.md)。F6 與其他 gate 仍依原清單驗收，OQ-60.4 構念歸屬尚待拍板。

## Progress

| Task | Status | Started | Completed | Evidence |
|---|---|---|---|---|
| T0 Entry Gate | ✅ Completed（R1 通過；R2 得負面結論；F6 通過） | 2026-09-08 | 2026-09-09 | 見 §T0 automated audit、§T0 R1 實機量測、D-60.R2-1 與 §TF1。R1：事件率 1005 Hz 瞬時、dt p50 995 µs、零遺漏；R2：空洞長度不足以可靠分離 lift/pause；F6：可比 A/B 下 Δp95 **−0.005 ms** 且未新增 over-budget windows。 |
| T1 Capture Contract | ✅ Completed（依使用者明確指示 override T0 gate；contract-only，不接線） | 2026-09-08 | 2026-09-08 14:31Z | `npm.cmd test -- src/data/mouseSampleArena.test.ts src/data/DataRecorder.test.ts src/data/export.test.ts src/data/exportPayloadSchema.test.ts src/data/metadata.test.ts` exit 0（182 passed）；`npm.cmd run typecheck` exit 0；`npm.cmd test` exit 0（244 files passed, 1 skipped；2561 passed, 2 skipped）；`npm.cmd run build` exit 0（既有 chunk-size warning）；60k `mouseSamples` JSON.stringify：567,316 bytes / p50 1.714 ms / p95 2.377 ms / max 2.546 ms；`rg -n "\bLOD\b" src tests scripts CONTEXT.md` exit 1（0 命中）。 |
| T2 Recorder Wiring | ✅ Completed（依使用者明確指示 override T0 gate；app 佈線層 opt-in 預設關閉） | 2026-09-08 | 2026-09-08 | 見 §T2 implementation audit。`npm.cmd test -- tests/regression/wp60-raw-mouse-capture.test.ts` exit 0（20 passed）；`npm.cmd run typecheck` exit 0；`npm.cmd test` exit 0（245 files passed, 1 skipped；2581 passed, 2 skipped）；`npm.cmd run build` exit 0（`$LASTEXITCODE=0`，193 modules，保留既有 chunk-size warning）；`npx.cmd playwright test tests/e2e/raw-mouse-sampling.spec.ts` **2 passed（真實 Edge）**。 |
| T3 Time-Gap Primitive | ✅ Completed（含真人取樣分布）| 2026-09-09 | 2026-09-09 | 見 §T3 implementation audit 與 §TF2。既有原語／scan／突變證據不變；B 組 31,621 samples、`activeRateHz = 708 Hz`，18／30／50 ms sweep 已實跑並記錄描述性分布，DoD 第 9 項補齊。 |
| T4 Operator Visibility | ✅ Completed | 2026-09-09 | 2026-09-09 | 見 §T4 implementation audit。`npm.cmd test -- tests/regression/spider-wide-repositioning-runner.test.ts` exit 0（**19 passed** = 既有 12 + 新增 7）；`npm.cmd run typecheck` exit 0；`npm.cmd test` exit 0（**246 files passed, 1 skipped；2613 passed, 2 skipped**）；`npm.cmd run build` `$LASTEXITCODE = 0`（bundle hash `index-CcqBc2hD.js` 與 T2 相同 ⇒ `scripts/` 不進 app bundle）；四組突變各被抓到；legacy fixture 與含 `mouseSamples` 的樣本各實跑一次（輸出見下）。 |
| T-exit | ✅ Completed（TF1～TF3 follow-up 全部關閉）| 2026-09-09 | 2026-09-09 | 見 §T-exit gate 與 TF1／TF2／TF3 follow-up。A-60.1～16：**15 ✅ + 1 ✅ 帶上界告警（A-60.10 → OQ-60.7）**，無 🟡／❌；F6、T3 真人分布與全量 Playwright 均已補齊。`--workers=1` 全量 Playwright **101 passed／0 failed**，WP-60 raw-mouse 2／2 passed；三項具名缺口全數關閉。 |

## Decision Log

| ID | Date | Decision | Owner | Evidence |
|---|---|---|---|---|
| D-60.P1 | 2026-09-08 | **本 stage 自 WP-60 起算**。stage12 已用到 WP-59（平行 session 的 micro flick v8 替補間距），依 GD-15「先採納先得」不與之爭號 | 規劃 | [`../README.md`](../README.md) §3 |
| D-60.P2 | 2026-09-08 | **切成 WP-60（schema + 擷取 + 充分性證明）與 WP-61（LOD 判準移植 + 校準）兩個 WP**。<br>理由：LOD 的 Stage 2／3 參數在 px/s 空間、必須以真人標註資料重推，而那批資料**目前不存在**；且 PA 的 ADR-002 自承其 F1 從未對標註資料量測過。把兩者綁在同一個 WP，會讓一個純工程可驗收的切片卡在一個等資料的研究問題上。<br>**Alternatives considered**：(a) 一個大 WP 一路做到判準 —— T-exit 會永遠無法宣告，**駁回**；(b) 只做 schema 不做任何消費者 —— 無法證明 schema 充分（WP-50 T0 的 sufficiency audit 正是為了避免這件事），**駁回**；(c) 先做判準再回頭補 schema —— 沒有資料可以做判準，**技術上不可行** | 規劃 | [`../README.md`](../README.md) §2 |
| D-60.P3 | 2026-09-08 | **錄製點選在 `SimLoop` 的輸入消費點**（既有 `accumulateMouse` 旁），不在 `InputSampler`。<br>理由：① recorder 本來就由 sim loop 呼叫，不新增跨迴圈通道（ADR-2）；② 消費點的事件已依 `timeStamp` 升冪且無遺漏（GD-3），錄下來即為全域時間有序；③ 兩個資料流由**同一批事件**產生 ⇒ FR-60.7 的對齊是結構性成立，不必靠斷言維持。<br>**Alternatives considered**：(a) 在 `InputSampler` 另開一個 arena —— 會讓 input loop 直接寫 data 層，違反 ADR-2 的三迴圈邊界，**駁回**；(b) 從輸入 ring 事後撈 —— ring 是真 ring（消費後繞圈），撈不到已消費的資料，**技術上不可行** | 規劃 | [README.md](README.md) §2.2 |
| D-60.P4 | 2026-09-08 | **不採用 `LOD` 縮寫**，一律拼寫 `liftOff`／時序中性語彙（`gap`／`segment`）。<br>理由：`THREE.LOD`（Level of Detail）是 Three.js 標準類別，而本專案 `import * as THREE from 'three/webgpu'`。在一個 3D 專案裡讓 `LOD` 同時指兩件事，是可預見的閱讀陷阱 | Engineering | [README.md](README.md) §3.1 R7 |
| D-60.P5 | 2026-09-08 | **溢位旗標獨立，不 OR 進 `meta.suspect`**（FR-60.9）。<br>理由：`recorderOverflow` 會設 `suspect` 是因為 tick 資料本身缺了；原始取樣溢位時 tick 資料**仍然完整有效**，只有新增的那一維退化。把它併進 `suspect` 會讓一份完全可用於既有指標的 run 被整份判為不合格 | Engineering | [README.md](README.md) §2.5 |
| D-60.P6 | 2026-09-08 | **arena 滿了丟棄末端，不繞圈**。<br>理由：繞圈會讓匯出的第一筆不是 drill 的第一筆，而 `t0Ms + Σ dtUs` 的重建假設是連續的 ⇒ 繞圈會讓時間軸靜默說謊。丟棄末端 + 明示旗標，語意單純，且與 `TickArena` 的 `recorderOverflow` 同一慣例 | Engineering | [README.md](README.md) §2.5 |

| D-60.P7 | 2026-09-08 | **OQ-60.1 收斂：從 `performance_analysis` 移植無授權問題** —— 使用者為兩個 repo 的作者，同一組織，無第三方權利介入。⇒ R5 關閉、T3 不再被阻塞、GD-11 那一列在本 WP 不構成限制。<br>**連帶解鎖**：PA 的 `lod_v3_default_config.json`（十四個參數）與其 parity fixture 可**直接引用為起點**，不必從零重推 —— 這是原本要放棄的東西。T0 step 7 因此由「拍板」改為「取用並記名」。<br>⚠️ **但工程上仍不直接搬 Go 程式碼，理由改為技術性而非法律性**：`lodclean/service.go` 綁死三個對本專案不成立的前提 —— ① px/s 與 counts 空間（本專案是角度空間）、② 1 ms nominal dt（本專案 tick 為 7.8125 ms、事件率待 T0 實測）、③ 刻意複製 pandas 的 `fillna`／floored-modulo 語意以維持 Python↔Go parity（本專案不參與那個 parity）。硬搬會把三個錯誤前提一起帶進來。<br>**稽核要求仍在**：引用任何 PA 的參數或 fixture 必須記名來源與版本 —— 授權無虞不等於出處可以不寫。| 使用者 | 使用者回覆（2026-09-08）；[README.md](README.md) §1.5 OQ-60.1／§2b GD-11 列／§3.1 R5 |

| D-60.T0-1 | 2026-09-08 | **T0 自動稽核不能替代 R1/R2 實機 gate。** 本 session 能完成 baseline、source re-audit、CodeGraph impact、PA 參數取用與 synthetic serialization PoC；但 `getCoalescedEvents()` 在 Pointer Lock 下是否回 sub-frame 樣本、以及抬起／停頓空洞是否可分離，必須由真實 Chromium/Edge + 實體滑鼠 + 使用者操作量測。沒有這兩組數字時，T0 狀態只能是 Blocked，不能進 T1。<br>**Alternatives considered**：(a) 用 Playwright synthetic mousemove 代替 —— 不會產生真實硬體 coalesced events，駁回；(b) 用 WP-57 真人 export 代替 —— 那些 export 不含 raw samples，且不進 repo，駁回；(c) 先做 T1 schema 再回頭補 gate —— 違反 T0 entry gate，駁回。 | Engineering | §T0 automated audit；[T0-entry-gate.md](T0-entry-gate.md) steps 3/4 |

| D-60.T1-1 | 2026-09-08 | **T1 依使用者明確指示 override T0 gate，只交付擷取契約，不代表 R1/R2 實機 gate 已通過。**<br>理由：本 turn 的使用者指令明確要求建立獨立 worktree、讀 T1 contract、實作 T1；T1 的範圍可維持 contract-only，不接 `SimLoop`，因此不會產生偽裝已可收真人 raw sample 的 runtime 路徑。<br>**Alternatives considered**：(a) 因 T0 blocked 而停止 —— 最符合原 execution rule，但與本 turn 明確指令衝突，駁回；(b) 順手接 T2 runtime path —— 會讓未過 empirical gate 的功能進熱路徑，駁回；(c) 只加型別不加 parser/test —— 無法滿足 FR-60.4，駁回。 | Engineering | 使用者指令（2026-09-08）；本檔 T1 evidence |
| D-60.T1-2 | 2026-09-08 | **T1 凍結 columnar + integer µs delta 格式，並要求 `mouseSamples` 與 `meta.mouseSampling` 成對出現。**<br>理由：60k 樣本序列化實測 567,316 bytes，低於 NFR-60.4 的 1.0 MB；`dtUs` 整數微秒保留 NFR-60.5 的時間精度。成對出現讓資料與 provenance 互相驗證：legacy 兩者都缺席合法；宣稱有其中之一但缺另一者是 typed parser error。<br>**Alternatives considered**：(a) array-of-objects —— T0 synthetic 約 2.16 MB，超出體積預算，駁回；(b) 絕對 `tMs[]` —— 體積較大且不需逐筆絕對時間，駁回；(c) 允許只有 block 或只有 meta —— 會讓離線端無法判定 provenance 或資料位置，駁回。 | Engineering | `src/data/mouseSampleArena.ts`; `src/data/exportPayloadSchema.test.ts`; serialization evidence |
| D-60.T1-3 | 2026-09-08 | **T1 將 Pointer Lock 中斷落地為 additive `pointer_lock` DrillEvent，並將 raw sample 容量預設為 1000 Hz × drill seconds × 1.2 headroom。**<br>理由：Pointer Lock 是離散狀態 edge，比逐 tick boolean 更小且符合既有 `key` event opt-in 紀律；1.2 headroom 在滿足 1000 Hz 預設容量的同時保留事件率抖動空間，高輪詢率仍以 `meta.mouseSampling.overflow` 具名退化，不 OR 進 `meta.suspect`。<br>**Alternatives considered**：(a) tick boolean lock 欄位 —— 會為每個 run 多 128 Hz 連續欄位，駁回；(b) 容量開到 8000 Hz —— RAM/JSON 體積 8 倍，未有實測需求，駁回；(c) raw overflow 併入 `suspect` —— tick 資料仍有效，會錯殺既有指標用途，駁回。 | Engineering | `src/data/DataRecorder.ts`; `src/data/metadata.ts`; `src/data/export.test.ts` |

| D-60.T2-1 | 2026-09-08 | **T2 接線落地，但 app 佈線層的 opt-in 預設關閉，並以 `?rawMouse=1` 顯式開啟。**<br>理由：`recordKeyEvents` 與 `mouseIntegration` 在 main.ts 都是「全域開」，本 task 刻意**不**照抄那個先例 —— 那兩者的前提都已驗證過，而 WP-60 的前提（R1：`getCoalescedEvents()` 在 Pointer Lock 下真的回傳次幀樣本）**至今只有註解宣稱、無實機證據**。全域開等於用一個未驗證的前提換 8.6 MB 常駐 arena 與數 MB 匯出增幅，並讓所有受測者的熱路徑多一條未量測的寫入。<br>**連帶價值**：這個 flag 同時是 T0 缺的那個入口 —— T0 的 R1/R2 需要「真瀏覽器 + 真 COI + 真滑鼠」，在此之前 repo 裡根本沒有任何方法把 raw sample 匯出出來。現在跑一輪 `?rawMouse=1` 即可從 `meta.mouseSampling.observedRateHz` 與 `mouseSamples.dtUs` 的分布結掉 R1/R2。<br>**Alternatives considered**：(a) 比照 `recordKeyEvents` 全域開 —— 讓未過經驗性 gate 的功能成為常態熱路徑，且 T0 若判 no-go 就要回頭拆，駁回；(b) 完全不接 main.ts、只接 API 層 —— T2 DoD 的「Pointer Lock 轉態在真實載入路徑上被記錄」變成不可能滿足，且重演 `recordKeyEvents` 那個「API 有、佈線沒有」的舊傷，駁回;(c) 用 `import.meta.env.DEV` 閘 —— T0 PoC 需要 production build 的 COI 條件，dev-only 會擋掉自己要的量測，駁回。 | Engineering | 使用者指令（2026-09-08）；`src/main.ts`；`tests/e2e/raw-mouse-sampling.spec.ts` |
| D-60.T0-2 | 2026-09-09 | **R1 判為通過；T0 指標③「每 rAF 幀的 coalesced 筆數 > 1」的門檻敘述判為定義錯誤、須更正。**<br>理由：實機量到 `pointermove` 以 **997 events/s** 派發（clean run 10,762 事件 ÷ 10.79 s），遠高於階段 A 顯示更新率上限 240 Hz ⇒ Chromium **逐筆硬體取樣派發**，而非「幀內合併 + `getCoalescedEvents()` 補回」。因此 coalesced p50 = 1、mean = 1.020 代表**該機制沒被用到**，不代表「次幀樣本被丟掉」。指標③要問的是後者，而後者已由 ①② 直接證否（dt p50 = 995 µs、10,475 個間隔、`lockedRaw === recorded === 10,476` 零遺漏）。<br>**門檻改為**：「事件派發率 ≫ 顯示更新率 **或** coalesced p50 > 1，二者其一即可」。<br>**連帶更正**：`InputSampler.ts:125-127` 與 ADR-5／附錄 B 對機制的敘述**對結果正確、對機制不準**。但 coalesced `max: 5` 證明幀變慢時 coalescing 確實會啟動 ⇒ **`getCoalescedEvents()` 呼叫仍必要，程式碼不改**，只改註解／ADR 的機制描述。<br>**Alternatives considered**：(a) 照字面判 R1 失敗、停止本 WP —— 會因為一個寫錯的中介指標否決一個實際成立的前提，駁回；(b) 默默把③重新解釋成過關、不改文件 —— 下一個人會再撞一次同一個錯誤前提，且違反「矛盾必須入帳」，駁回；(c) 改 `InputSampler` 不再呼叫 `getCoalescedEvents()` —— `max: 5` 顯示卡頓時會丟樣本，駁回。 | Engineering | 使用者實機量測（2026-09-09）；本檔 §T0 R1 實機量測；[T0-entry-gate.md](T0-entry-gate.md) §R1 註 |
| D-60.T2-2 | 2026-09-08 | **決定性 trace 涵蓋 `TickRecord` 全欄位，而非只有 DoD 點名的 `replayTargetId`/`tx,ty,tz`/`dYaw,dPitch`。**<br>理由：先按 DoD 字面實作窄 trace，再手動突變 `SimLoop`（在錄製旁路裡加 `state.player.x += 1e-12`）驗證斷言的偵測力 —— **20 個測試全綠通過**。「唯寫旁路」的失效模式包含寫到 player 位置／速度／aim 上，而窄 trace 結構上抓不到那一類。改為攤平全欄位後同一突變被 4 個案例抓到。<br>**Alternatives considered**：(a) 維持窄 trace + 額外加 player 欄位斷言 —— 下一個新欄位又會漏，駁回；(b) 用 `toEqual(snapshot.ticks)` 深比較 —— `toEqual` 不區分 +0/−0，違反 DoD 明文要求的 `Object.is` 級比對，駁回。 | Engineering | `tests/regression/wp60-raw-mouse-capture.test.ts`；本檔 Surprises 4 |

| D-60.T3-1 | 2026-09-09 | **`lockGapIndices` 的值是「間隙前一筆樣本的 block index」，不是「`gaps` 陣列的 index」。**<br>理由：README §2.3 把它寫成「間隙 index」，但同一份文件與 T3 步驟 3 又要求被歸因的間隙**排除在 `gaps` 之外**（不是標記後留著）。兩者不能同時成立於「`gaps` 的 index」這個讀法 —— 那會指向一個不含它們的陣列。改以樣本 index 表示後，兩個要求都成立，且呼叫端可直接在 block 上定位那個空洞。<br>**Alternatives considered**：(a) 讓 lock 間隙留在 `gaps` 並用 index 指它 —— 違反 T3 明文的「留著就會有人忘記過濾」，駁回；(b) 另開 `lockGaps: SampleGap[]` 欄位 —— 偏離 README §2.3 的簽名，而 DoD 明文要求簽名完全一致，駁回。 | Engineering | `src/metrics/mouseSampleGaps.ts`；`mouseSampleGaps.test.ts` F2 案例 |
| D-60.T3-2 | 2026-09-09 | **lock 中斷同樣切段，只改變間隙的「歸因」而不改變切段。**<br>理由：Pointer Lock 中斷是樣本流的**真實**不連續 —— 中斷期間的移動依 FR-A-8 本來就整筆丟棄，兩側樣本並不相鄰。若不切段，呼叫端會拿到一個橫跨中斷的「連續區段」，那才是靜默說謊。<br>**Alternatives considered**：(a) lock 間隙不切段、兩側併成一段 —— 會讓區段內含一個不存在的直線內插，駁回。 | Engineering | `SampleSegmentation.segments` 註解 |
| D-60.T3-3 | 2026-09-09 | **間隙判定在整數 µs 空間比較，並加 `GAP_EPSILON_US = 1e-6`（1 ps）容差；端點相接不算 lock 重疊。**<br>理由：`dtUs` 是整數，唯一浮點來源是 `gapThresholdMs * 1000`。實測 10–60 ms 間所有一位小數門檻，只有 **32.3** 的乘積（32,299.999999999996）落在整數**下方** —— 少了容差，恰在門檻上的 32,300 µs 會因 5.8e-12 µs 的表示誤差被判成間隙。重疊採嚴格（重疊長度 > 0）則是 F2 的要求：恰在間隙起點收掉的中斷不得解釋掉它後面那個真實間隙。<br>**Alternatives considered**：(a) 把門檻 `Math.round()` 成整數 µs —— 會把 30.0005 ms 這類門檻悄悄改掉，駁回；(b) 不加容差 —— 32.3 的案例會判錯，駁回。 | Engineering | `mouseSampleGaps.ts` §GAP_EPSILON_US；同名測試兩例 |
| D-60.T3-4 | 2026-09-09 | **R7 的 scan 對象是「命名」，故模組**連註解都不拼出**那個三字母縮寫**，改以實際檔名 `lod_v3_default_config.json`（小寫）指認來源。<br>理由：初版把方法學來源寫成縮寫寫進 doc comment，`LOD` 掃描立刻紅。可以改成剝註解後再掃（比照 C-D4 那支），但那會**放寬**一條既有紅線去遷就一段可以換句話說的散文。換句話說零成本、出處零損失，掃描維持在最嚴的原文層級。<br>**Alternatives considered**：(a) 掃描改用 `codeOnly()` —— 為了註解方便而弱化 R7，駁回；(b) 不記來源 —— D-60.P7 明文要求記名，駁回。 | Engineering | `mouseSampleGaps.ts` 頭註解；`mouseSampleGaps.test.ts` R7 scan |
| D-60.T4-1 | 2026-09-09 | **四個取樣 blocker 一律閘在 `payload.mouseSamples` 的存在上，`crossOriginIsolated: false` 也不例外。**<br>理由：T4 invariant 明文「缺 `mouseSamples` 是**合法**狀態，不是 blocker」。四個 blocker 講的都是「這份**原始取樣**不可信」——沒有原始取樣時，它們沒有主詞。COI 那條最容易寫錯：它讀的是既有的 `meta.crossOriginIsolated`，看起來像個通用的資料品質問題，但既有的通用管道是 `meta.suspect`（`PERF_FLOOR_MS` 判紅），而 T4 invariant 又明文不得改既有 blocker 的觸發條件。⇒ 不閘就會讓每一份 60 Hz 機器錄的 legacy run 平白多一條 blocker。<br>**Alternatives considered**：(a) COI 不閘、當通用 blocker —— 改變了既有 run 的判定，違反 invariant，駁回；(b) 四個都不閘、缺 block 時當 0 處理 —— 「沒錄」與「錄了但為零」混成一件事，違反 DoD 第 1 項，駁回。 | Engineering | `spiderWideRepositioningRunner.ts` `readSamplingHealth()`；同名測試 legacy 案例；突變 M2 |
| D-60.T4-2 | 2026-09-09 | **`REPORTED_GAP_THRESHOLD_MS = 30` 放在 runner，不放進 `mouseSampleGaps.ts`。**<br>理由：T3 刻意讓 `segmentByTimeGap()` 的門檻**呼叫端必填**（條件於錄製硬體），那條紀律不能因為 T4 需要一個數字就被鬆掉。放在 runner 是既有 `CALIBRATED_STALL_*` 的同一處置：每次分析用同一個數字、換門檻在 diff 裡看得見，而模組本身仍不預設。值取 PA 的 `TIME_GAP_THRESHOLD_MS = 30`（D-60.P7 授權無虞）當 prior，T0 R1 的雜訊底線 18 ms 給它 1.7× headroom。<br>⚠️ **它不是校準值**：T0 R2 已判定空洞長度分不開抬滑鼠與停頓，故報告只出 `gapCountAtThreshold` / `longestGapMs` 這種**描述性**的量，措辭明文不宣稱任何一個空洞是什麼（C-D3／C-D4 的守線）。<br>**Alternatives considered**：(a) 給 `segmentByTimeGap()` 一個預設值 —— 撤銷 D-60.T3 的紀律，且會在別的硬體上說謊，駁回；(b) 不報間隙、只報 samples/rate/overflow —— FR-60.8 明文要求「時間間隙分布」，駁回。 | Engineering | `spiderWideRepositioningRunner.ts` §REPORTED_GAP_THRESHOLD_MS |
| D-60.T4-3 | 2026-09-09 | **取樣健康度是「逐 run」段裡的第二張表（`###`），不是第四段。**<br>理由：T4 步驟 3 明文「不新增第四段」，但把六個新欄位塞進本來已 11 欄的主表會讓它在終端機上不可讀。子表既保住三段結構（測試以 `/^## /gm` 計數釘死為 3），又讓六欄全部可見。全批都沒有 `mouseSamples` 時整張表換成一行說明 —— 一張全是 `—` 的表只會讓人以為壞了。<br>**Alternatives considered**：(a) 四欄併進主表、overflow/lockBreak 只走 blocker —— 那兩欄的「否／0」狀態就看不到了，駁回。 | Engineering | `formatSpiderWideRepositioningSummary()`；同名測試三段結構案例 |
| D-60.T4-4 | 2026-09-09 | **`longestGapMs` 只涵蓋 `gaps`（未被 lock 解釋的），且無間隙時為 `0` 而非 `undefined`。**<br>理由：`undefined` 這個值在本 summary 已經被指派了唯一語意 ——「這份 run 沒有 `mouseSamples`」。若「有錄到但沒有間隙」也回 `undefined`，那個語意就有兩個來源，讀者無從分辨。lock 歸因的間隙不計入，是因為那不是硬體空洞而是量測中斷（FR-60.6）；它已由 `lockBreakCount` 具名。<br>**Alternatives considered**：(a) 無間隙回 `undefined` —— 與「沒錄」撞號，駁回；(b) `longestGapMs` 涵蓋全部空洞（含 lock）—— 一次 alt-tab 就會讓最長間隙變成幾秒，把報告最醒目的數字變成量測假影，駁回（突變 M4 已證這條斷言抓得到）。 | Engineering | `readSamplingHealth()`；同名測試 lock 案例 |
| D-60.X1 | 2026-09-09 | **T4 的事件率 blocker 改看「連續期間事件率」（`activeRateHz`），不再看 `meta.mouseSampling.observedRateHz`。**<br>理由：T-exit 逐條驗收 A-60.8／A-60.15 時把 T0 R2 的實機數字代進 T4 的閘，發現**三組真人 run 全部會被誤判**：R2 的平均率為 ④lift 11556/27.72 s = **417 Hz**、⑤pause 11597/23.47 s = **494 Hz**、⑥oneshot 2825/6.86 s = **412 Hz**，全部低於 `MIN_OBSERVED_RATE_HZ = 500`；而**同一支滑鼠**在 R1 的連續移動期間量到 **1005 Hz**。成因是 `observedRateHz` 依契約是「整段 span 的平均」（README §2.3 明文「實測平均事件率」，arena 以 `(recorded−1)×1000/spanMs` 算），而 F1 要問的是「瀏覽器有沒有退化到 rAF 率」——**受測者停手不是瀏覽器退化**。閘用平均率就會對一份完好的 1000 Hz run 印出「時間間隙判定不可用」，正是 C-D3／GD-20 要防的「會說錯話的指標」。<br>**處置**：`readSamplingHealth()` 另算 `activeRateHz` —— 只把落在 segment 內（即排除所有 > `REPORTED_GAP_THRESHOLD_MS` 空洞）的樣本間隔計入；blocker 改看它，`observedRateHz` 維持為 provenance 並照實印在報告裡。匯出 schema、`MouseSamplingMeta`、arena 與 `segmentByTimeGap()` **一行未動** ⇒ 不觸及決定性、固定佈局或三迴圈邊界。<br>**Alternatives considered**：(a) 改 arena 讓 `observedRateHz` 本身排除空洞 —— 會讓已凍結的 provenance 欄位換語意（FR-60.3 明文「平均」），且需要 arena 知道間隙門檻，把 T3 的「呼叫端必填」紀律拖進 data 層，駁回；(b) 把下限從 500 調到 400 —— 只是把誤判的門檻挪一格（R2 已有 412 Hz 的樣本），且會同時放過真正退化到 rAF 率的 240 Hz 串流，駁回；(c) 只在報告加註「平均率會被停頓拉低」不改閘 —— blocker 是給操作者當紅燈用的，靠腳註修正紅燈等於不修，駁回。<br>**偵測力已實測**：把閘改回 `observedRateHz`（`cp` 備份還原，非 `git checkout`，見 Surprises 8）→ **2 cases failed**；還原後 20 passed。 | Engineering | `scripts/spiderWideRepositioningRunner.ts` §`activeRateHz`；`spider-wide-repositioning-runner.test.ts`（新增 `PAUSED_BLOCK`／`RAF_RATE_BLOCK` 兩個對照 fixture）；本檔 §T-exit |
| D-60.T3-5 | 2026-09-09 | **新增 `deriveUnlockedIntervals()`（README §2.3 未列）把 `pointer_lock` edge 轉成區間。**<br>理由：T3 步驟 3 要求「依 `pointer_lock` 事件推導 `lockIntervals`」，但 README 只給了吃 `lockIntervals` 的簽名。把 edge→interval 這段留給每個呼叫端自己寫，等於為同一個語意開放多套實作（未關閉的中斷該不該收尾、重複 edge 怎麼處理）—— 那正是 C-D4 要避免的形狀。附加函式不改 `segmentByTimeGap()` 的簽名，DoD 的一致性要求不受影響。<br>**Alternatives considered**：(a) 讓呼叫端自推 —— 語意分散，T4 與 WP-61 會各寫一套，駁回。 | Engineering | `mouseSampleGaps.ts`；CONTEXT.md「未取鎖區間」 |

## T0 automated audit（2026-09-08 13:39Z）

### Baseline

| 項目 | 指令 | 結果 |
|---|---|---|
| HEAD | `git rev-parse HEAD` | `715ffcb4d6cbb0168fb260860b796f7a493688f4` |
| Worktree | `git status --short` | 無 tracked/untracked diff；但 sandbox 下有三個既存讀取警告：`~/.config/git/ignore` permission denied ×2、`.pytest_cache/` permission denied |
| Typecheck ×2 | `npm.cmd run typecheck` | exit 0 |
| 全量 Vitest | `npm.cmd test` | exit 0；244 files，2538 passed，2 skipped |
| Build | `npm.cmd run build` | sandbox 內 Vite config 載入因 `../../../..` access denied 失敗；同一指令 escalated 重跑 exit 0。Vite 6.4.3，192 modules，`dist/assets/index-D5suW8qy.js` 1,217.00 kB gzip 346.17 kB；保留既有 chunk-size warning |

### Discovery revalidation

README §0 的十四項 discovery 已逐項覆讀：

| # | T0 覆驗 |
|---|---|
| 1-4 | 對齊目前 source：`InputSampler` 逐筆 `getCoalescedEvents?.() ?? [e]` 入 ring；`SimLoop.applyInput` 於 mouse 分支只呼叫 `recorder.accumulateMouse()`；`DataRecorder` 聚合進 tick `dYaw`/`dPitch` 並在 tick 消費後歸零。 |
| 5 | 對齊：`DrillEvent` union 目前不含 raw mouse sample 或 pointer-lock 狀態事件。 |
| 6-8 | 對齊：`TickArena` 是 preallocated arena；`replayTargetId` plain fixed array 先例存在；`recordKeyEvents?: boolean` 預設 `false`。 |
| 9-11 | 對齊：`PointerLock` 嘗試 `unadjustedMovement: true`；lock 狀態只保留於 handle/onChange；`consume()` 以半開窗 `< untilT`、沿 head 升冪排空。 |
| 12-14 | 對齊：PA config 讀到 14 個 LOD v3 參數；ADR-002 記錄 ground truth dataset missing / F1 unmeasured；PA repo 仍無 LICENSE 檔、`go.mod`/`package.json` 無 license 欄位，但 D-60.P7 已解除授權阻塞。 |

### CodeGraph impact

已回填 [README.md](README.md) §0.2：

| 符號 | 實測影響 |
|---|---|
| `ExportPayload` | 367 callers |
| `createDataRecorder` | 49 callers |
| `DataRecorder` | 19 callers |
| `createSimLoop` | 37 callers |

### Required audit artifact

| 量 | 方法 | 門檻 | 實測 |
|---|---|---|---|
| 觀測事件率（Hz）| 真實瀏覽器 + Pointer Lock + 實體滑鼠 | **≥ 500 Hz**（否則停止）| **BLOCKED**：本 session 無法產生真實硬體 pointer events |
| `dt` p50 / p95 / p99（µs）| 同上 | p50 ≈ 1000 µs（1000 Hz 滑鼠）| **BLOCKED** |
| 每 rAF 幀的 coalesced 筆數 | 同上 | > 1（否則 R1 成立）| **BLOCKED** |
| 抬起的空洞長度 p10/p50/p90（ms）| 使用者實機，`spider-shot-wide-v1`，≥10 次 | 與停頓可分離 | **BLOCKED** |
| 停頓的空洞長度 p10/p50/p90（ms）| 使用者實機，≥10 次 | 與抬起可分離 | **BLOCKED** |
| 一次到位的最長空洞（ms）| 使用者實機，≥10 次 | 應遠小於抬起 | **BLOCKED** |
| 60 s columnar 序列化（bytes / ms）| synthetic 60,000 samples；非 gate 替代品 | **≤ 1.0 MB**（NFR-60.4）| 593,031 bytes / 1.311 ms |
| 60 s array-of-objects（bytes / ms）| synthetic 60,000 samples；非 gate 替代品 | 對照組 | 2,158,328 bytes / 6.167 ms |
| µs 取整誤差（µs）| synthetic jittered dtUs round-trip | **≤ 10**（NFR-60.5）| max 0.369 µs |
| frame p95 開 vs 關（ms）| throwaway consumption-path PoC | 差值 ≤ 0.5 ms 且無新增掉 tick | **BLOCKED**：需真實 input stream 或 T1/T2 throwaway wiring；未在 T0 gate 缺 R1 時執行 |

Synthetic serialization command:

```powershell
node -e "const {performance}=require('node:perf_hooks');const n=60000;const t0Ms=1000.123456;const dtRaw=Array.from({length:n},(_,i)=>i===0?0:1000+((i%7)-3)*0.123);const dtUs=dtRaw.map(x=>Math.round(x));const dx=Array.from({length:n},(_,i)=>(i%11)-5);const dy=Array.from({length:n},(_,i)=>(i%7)-3);const col={t0Ms,dtUs,dx,dy};let t=performance.now();const colJson=JSON.stringify(col);const colMs=performance.now()-t;const rows=Array.from({length:n},(_,i)=>({tMs:t0Ms+dtUs.slice(0,i+1).reduce((a,b)=>a+b,0)/1000,dx:dx[i],dy:dy[i]}));t=performance.now();const rowJson=JSON.stringify(rows);const rowMs=performance.now()-t;const maxErr=Math.max(...dtRaw.map((v,i)=>Math.abs(dtUs[i]-v)));console.log(JSON.stringify({n,columnarBytes:Buffer.byteLength(colJson),columnarMs:+colMs.toFixed(3),arrayObjectBytes:Buffer.byteLength(rowJson),arrayObjectMs:+rowMs.toFixed(3),maxQuantizationErrorUs:+maxErr.toFixed(3)},null,2));"
```

### PA LOD v3 parameter source copy

Source: `..\performance_analysis\contracts\modules\input\lod_v3_default_config.json` at T0 audit time, cross-checked against `..\performance_analysis\docs\architecture\adr\002_lod_v3_design.md` and `..\performance_analysis\backend\modules\input\infrastructure\lodclean\service.go`.

| Parameter | Value | WP-61 note |
|---|---:|---|
| `TIME_GAP_THRESHOLD_MS` | 30.0 | Time-gap Stage 1 candidate; usable as prior, must be checked against FPS real event-rate/gap distributions. |
| `GAP_CONFIRM_MS` | 12.0 | Time-domain context window; usable as prior. |
| `CLICK_IMMUNITY_MS` | 50.0 | Time-domain click immunity; usable as prior if FPS fire events align in same clock domain. |
| `HEAD_SCAN_MS` | 20.0 | Time-domain head trim window; usable as prior. |
| `TAIL_SCAN_MS` | 20.0 | Time-domain tail trim window; usable as prior. |
| `ACCEL_UP_THRESHOLD_PX_S2` | 350000.0 | **px/s² space**; must be re-derived for FPS angular/count space. |
| `ACCEL_DOWN_RATIO` | 3.0 | Dimensionless asymmetry ratio; usable as prior, but threshold it multiplies is not directly portable. |
| `START_SPEED_GATE_PX_S` | 300.0 | **px/s space**; must be re-derived. |
| `HOVER_WINDOW_MS` | 15.0 | Time-domain hover window; usable as prior. |
| `HOVER_VELOCITY_THRESHOLD_PX_S` | 1200.0 | **px/s space**; must be re-derived. |
| `HOVER_VARIANCE_THRESHOLD` | 0.35 | Dimensionless angular variance; usable as prior, but should be validated on FPS traces. |
| `DEADZONE_COUNTS` | 5.0 | Counts space; potentially portable if FPS exports raw counts unchanged, still hardware/DPI sensitive. |
| `MIN_STROKE_POINTS` | 5 | Sample-count threshold; must be checked against actual FPS event rate. |
| `SAMPLE_INTERVAL_US_FALLBACK` | 1000.0 | Assumes 1000 Hz nominal; cannot be frozen before R1 event-rate measurement. |

### Gate result

T0 is **blocked, not failed**. Automated evidence is clean and production code diff remains 0, but the WP-60 entry condition is intentionally empirical. Next required action is a user-operated browser PoC that records:

1. Pointer Lock `getCoalescedEvents()` sample rate / dt distribution / per-rAF coalesced count distribution.
2. Three `spider-shot-wide-v1` operating modes with ≥10 attempts each: deliberate sensor lift, hand-still pause, one-shot uninterrupted movement.
3. Frame-time open/closed comparison only after R1 demonstrates raw sampling is present enough to justify T1/T2.

## T1 implementation audit（2026-09-08 14:31Z）

### Scope

- Added `MouseSampleArena` with preallocated `Float64Array` storage for `dx` / `dy` / `tMs`; snapshot exports `{ t0Ms, dtUs, dx, dy }` where `dtUs[0] = 0` and later entries are integer microsecond deltas.
- Added `DataRecorder.recordMouseSamples` opt-in flag, `recordMouseSample(dx, dy, tMs)`, optional snapshot fields `mouseSamples` / `mouseSampling`, and additive `pointer_lock` event type.
- Added `ExportPayload.mouseSamples?: MouseSampleBlock` and `Meta.mouseSampling?: MouseSamplingMeta`; `buildExportPayload()` adds both only when the snapshot provides them.
- Extended `parseExportPayload()` so legacy absence is legal, while malformed `mouseSamples`, `meta.mouseSampling.recorded > capacity`, block/meta count mismatch, and one-sided block/meta presence return named typed errors.
- Added CONTEXT.md terms: raw mouse sample, time gap, sample segment.

### Verification

| Item | Command / evidence | Result |
|---|---|---|
| Targeted T1 tests | `npm.cmd test -- src/data/mouseSampleArena.test.ts src/data/DataRecorder.test.ts src/data/export.test.ts src/data/exportPayloadSchema.test.ts src/data/metadata.test.ts` | exit 0；5 files；182 passed |
| Typecheck ×2 | `npm.cmd run typecheck` | exit 0 |
| Full Vitest | `npm.cmd test` | exit 0；244 files passed, 1 skipped；2561 passed, 2 skipped |
| Build | `npm.cmd run build` | exit 0；Vite 6.4.3；193 modules；`dist/assets/index-C9c4bVj9.js` 1,219.73 kB gzip 346.86 kB；保留既有 chunk-size warning |
| 60 s columnar serialization | Node synthetic 60,000-sample `mouseSamples` block, 20 `JSON.stringify()` iterations | 567,316 bytes；p50 1.714 ms；p95 2.377 ms；max 2.546 ms |
| LOD naming scan | `rg -n "\bLOD\b" src tests scripts CONTEXT.md` | exit 1；0 命中 |
| Graph update | `graphify update .` | exit 0；4590 nodes / 11243 edges / 278 communities |

### Contract Notes

- `recordMouseSamples` defaults to `false`; disabled snapshots are byte-shape identical to pre-WP-60 snapshots.
- Raw sampling overflow is represented only by `meta.mouseSampling.overflow`; it does not change `meta.suspect` or `recorderOverflow`.
- T1 did not modify `SimLoop`; no runtime raw capture path is enabled until T2.

## T2 implementation audit（2026-09-08）

### Scope

生產側改動只有三處，合計 6 行程式碼 + 註解：

| 檔案 | 改動 |
|---|---|
| [`src/loop/SimLoop.ts`](../../../../../src/loop/SimLoop.ts) | `applyInput` 的 mouse 分支在既有 `accumulateMouse()` **之後**加一行 `recorder.recordMouseSample(ev.dx, ev.dy, ev.t)`，以 `recorder?.recordMouseSamples === true` 閘住。不改既有呼叫的順序或參數、不消費回傳值、不讀／不寫 `state`。 |
| [`src/main.ts`](../../../../../src/main.ts) | ① `?rawMouse=1` opt-in（預設關閉，D-60.T2-1）；② recorder 顯式帶 `maxDrillSeconds: DEFAULT_MAX_DRILL_SECONDS`（raw arena 容量來源；tick arena 容量本來就用同一預設值，故結果不變）；③ 開啟時訂閱 `pointerLock.onChange` 記 `pointer_lock` 事件，只在 `countdown`/`running` 記錄（比照 KI-007 對 `fullscreenchange` 的同一判準）；④ dev-only `__aimDebug` 加唯讀 `drillPhase()`。 |
| — | `DataRecorder.accumulateMouse()` 與 `MouseSampleArena` **一行未動**（T1 已交付即足夠）。 |

測試側：[`tests/regression/wp60-raw-mouse-capture.test.ts`](../../../../../tests/regression/wp60-raw-mouse-capture.test.ts)（新，20 cases）、
[`tests/e2e/raw-mouse-sampling.spec.ts`](../../../../../tests/e2e/raw-mouse-sampling.spec.ts)（新，2 cases）、
[`tests/regression/spiderWideDeterminismFixture.ts`](../../../../../tests/regression/spiderWideDeterminismFixture.ts)（additive `mouseCapture` 選項 + `WideTickSample.dYaw/dPitch` + `FIXTURE_MOUSE_GAIN`；省略 `mouseCapture` 時既有 WP-57 run 逐位不變，`spider-wide-spawn-determinism` / `spider-wide-export-roundtrip` 19 passed 未改一個期望值）。

### Verification

| Item | Command / evidence | Result |
|---|---|---|
| Targeted T2 tests | `npm.cmd test -- tests/regression/wp60-raw-mouse-capture.test.ts` | exit 0；20 passed |
| 既有 fixture consumers 零回歸 | `npm.cmd test -- tests/regression/spider-wide-spawn-determinism.test.ts tests/regression/spider-wide-export-roundtrip.test.ts` | exit 0；19 passed（期望值零修改）|
| Typecheck ×2 | `npm.cmd run typecheck` | exit 0 |
| Full Vitest | `npm.cmd test` | exit 0；**245 files passed, 1 skipped；2581 passed, 2 skipped** |
| Build | `npm.cmd run build` | `$LASTEXITCODE = 0`；Vite 6.4.3；193 modules；`dist/assets/index-CcqBc2hD.js` 1,220.06 kB gzip 346.97 kB；保留既有 chunk-size warning |
| E2E（真實 Edge, dev 5173）| `npx.cmd playwright test tests/e2e/raw-mouse-sampling.spec.ts` | **2 passed (48.5s)** |
| 架構掃描 | 同檔 `import.meta.glob('../../src/input/**','../../src/render/**', ?raw)` → `/mouseSampleArena/` | 0 命中（掃到 > 10 個模組，非空掃）|

**全量差額歸屬**：T1 baseline 為 244 files / 2561 passed → T2 為 245 files / 2581 passed。差額 = **+1 檔（`wp60-raw-mouse-capture.test.ts`）、+20 cases（該檔全部）**，無其他檔案的 case 數變動，故與平行 session 無交集。

### NFR-60.1 / FR-60.7 的斷言設計

- **開／關對照**：四個既有 FPS 幀序列（穩定 60/144/240 Hz + 抖動 144 Hz ±50%）各跑兩次，唯一差異是 `recordMouseSamples`。兩組餵入**同一條** 1,200 筆合成 sub-frame 樣本流。
- **比對粒度**：`TickRecord` 全欄位攤平成單一序列後逐格 `Object.is`（D-60.T2-2），非 `toEqual`／`toBeCloseTo`。
- **跨 FPS**：開啟錄製後，四個幀序列的逐 tick trace **與 canonical「每幀一 tick」逐位一致**，且 `mouseSamples` 區塊與 `meta.mouseSampling` 亦逐位一致 —— 幀切法不改變擷取結果（GD-3）。
- **FR-60.7 對齊**：以生產的 `createAimIntegrator()` + 同一個 `resolveMouseGain()` 結果，按 consume 的半開窗 `[.., tick.t)` 重播落在各 tick 窗內的 raw 樣本，逐位重現每個 tick 的 `dYaw`/`dPitch`（1,200 筆全數落在已記錄的 tick 窗內）。同時斷言 `t0Ms + Σ dtUs`（在 µs 整數空間累加）逐位還原每筆事件自身時間戳。
- **合成樣本的時間戳網格**：一律落在 **0.125 ms** 網格（dyadic ⇒ 相鄰差與其 ×1000 皆為精確整數 µs ⇒ arena 的 `Math.round()` 量化無損）。這讓「還原時間戳」成為**逐位**斷言而非近似斷言；真實硬體的量化誤差仍待 T0 實機量測，本檔不假裝量到。
- **斷言偵測力已實測**：兩組手動突變各自被抓到 —— ① 在錄製旁路加 `state.player.x += 1e-12` → 4 cases failed；② `MouseSampleArena.record` 寫 `dx + 1` → 1 case failed。突變後皆已還原（`git diff` 確認）。

### F6 — sim 熱路徑 per-tick 成本對照（node，1000 Hz 事件率）

throwaway harness：直呼 `simStep()`（無 targetManager／camera／drillRunner），30 s sim ＝ 3,840 ticks ＝ 30,000 筆樣本（每 tick 約 8 筆，對齊 README §3.3 的量級）；先跑 512 ticks 暖機。四次重複：

| 量（ms） | 關閉 | 開啟 | Δ |
|---|---:|---:|---:|
| p50 | 0.0020 / 0.0014 / 0.0020 / 0.0016 | 0.0014 / 0.0013 / 0.0012 / 0.0011 | −0.0004 ～ −0.0008 |
| p95 | 0.0057 / 0.0032 / 0.0063 / 0.0060 | 0.0028 / 0.0039 / 0.0019 / 0.0024 | **−0.0044 ～ +0.0007** |
| p99 | 0.0150 / 0.0090 / 0.0153 / 0.0159 | 0.0084 / 0.0098 / 0.0061 / 0.0063 | −0.0096 ～ +0.0008 |
| tick 預算 | 7.8125 | 7.8125 | — |

**結論**：Δp95 的**符號在四次重複之間會翻轉**（−0.0044 ～ +0.0007 ms），即 run 間噪音大於任何系統性差異；per-tick 成本本身為 tick 預算的 < 0.1%。⇒ 每筆樣本 3 次 `Float64Array` 索引寫入在此量級不可觀測，與 NFR-60.2 的 push 計數證據一致（0 次額外 `push`）。掉 tick 數在注入式合成 clock 下恆為 0（accumulator 由傳入時間驅動），故此欄在 node 側無意義。

⚠️ **仍 BLOCKED 的部分**：**瀏覽器 frame log 的 p50/p95/p99 與真實掉 tick 數**需要真實輸入流，與 T0 的 R1 同一個經驗性 gate。本 task 不宣稱量到它；`?rawMouse=1` 已是它的入口。

## T0 R1 實機量測（2026-09-09，使用者操作）

環境：worktree `codex/wp-60-raw-mouse-t1` @ `a7b17a5`，`npm run dev -- --port 5174`，Edge，
`http://localhost:5174/?rawMouse=1`；`crossOriginIsolated === true`、`rawInputEnabled === true`
（`unadjustedMovement` 生效 ⇒ `dx/dy` 為關掉 OS 加速的原始 counts）；1000 Hz 滑鼠。
量測管道 = `__aimDebug.recorder.snapshot()` + console `pointermove` 探針（throwaway，不進 repo）。

### Run B（clean，權威）—— 連續移動 10.79 s

| 量 | 值 | 說明 |
|---|---:|---|
| `pointermove` 事件數 | 10,762 | ÷ 10.79 s ≈ **997 events/s** ⇒ 逐筆派發，非 rAF 對齊 |
| 瀏覽器交付原始樣本（`raw`）| 10,978 | mean coalesced = 10,978/10,762 = **1.020** |
| 取鎖期間原始樣本（`lockedRaw`）| 10,476 | |
| **arena `recorded`** | **10,476** | **與 `lockedRaw` 完全相等 ⇒ 零遺漏** |
| `raw − lockedRaw` | 502 | 未取鎖樣本被正確丟棄 ⇒ FR-A-8 閘門有效 |
| `bufferOverflow` / `ring` 殘留 | 0 / 0 | **512 槽輸入 ring 在 1000 Hz 下不會滿** |
| `lateEventCount` | 0 | |
| `zeroDelta`（`dx===0 && dy===0`）| **0** | 見下方「未測到 ≠ 否證」|
| `dtUs` n / span | 10,475 / 10.79 s | |
| `dtUs` p50 / p95 / p99 / max | **995** / 1660 / 2235 / 151,305 µs | |
| 空洞（> 5 ms）| **11 個**，合計 ≈ 249 ms | 與 span 加總自洽 ⇒ 無不可解釋的洞 |
| 空洞明細（ms）| 6.8, **151.3**, 9.0, 18.2, 8.3, 6.0, 7.0, 10.0, 8.1, 15.2, 9.3 | 151.3 在 `atSec 0.22` = 取鎖後尚未開始動的起始靜止段 |

### Gate 結論

**R1 通過。** 次幀解析度存在且被完整保留至匯出。判定不依賴 console 探針 —— `dtUs` 的百分位來自
arena 本身。指標③的字面門檻不成立但**其目的已滿足**，門檻敘述須更正（見
[T0-entry-gate.md](T0-entry-gate.md) §R1 註）。

### Run A（先跑，供對照；探針計數不可用）

recorded 13,754／span 17.14 s／`observedRateHz` 802.28／`dtUs` p50 1000・p95 1550・p99 3890・
max 291,300 µs／coalesced max **5**。
⚠️ Run A 的探針事件數（17,996 → 21,816）**不可作為證據**：當時 window 上同時掛著兩支
`pointermove` listener（第一支未加鎖判斷），取鎖期間重複計數。因此曾出現「瀏覽器交付 ~18,356 筆
但 arena 只有 13,754 筆」的 25% 假缺口 —— Run B 以單一探針重測後證實**缺口不存在**。
coalesced 的 p50/p95/max 不受重複計數影響（每個值被複製一次，分布形狀與極值不變），故可引用。

### 副產品：`gapThresholdMs` 的雜訊底線（WP-61 handoff 第 1 項）

剔除取鎖起始靜止段（151.3 ms）後，**連續移動期間的空洞上限為 18.2 ms**，其餘落在 6–15 ms
（甩鏡之間、換向瞬間的手部微停頓）。⇒ 本硬體上以時間間隙切段的**雜訊底線 ≈ 18 ms**，PA 的
`TIME_GAP_THRESHOLD_MS = 30` 約有 1.7× headroom，可直接當 prior。
⚠️ 樣本僅一輪 10.8 s / n = 11 個空洞 ⇒ **prior，非校準值**；正式分布仍待 R2。

### 容量與體積的實機推算

| 量 | 值 | 門檻 |
|---|---|---|
| arena capacity | 360,000（= 1000 Hz × 300 s × 1.2）| — |
| 以 1005 Hz 可撐 | **358 s** > `maxDrillSeconds` 300 s | ✅ NFR-60.3 |
| `overflow` | false | ✅ |
| 60 s run 匯出體積 | 9.46 bytes/sample × 60,300 ≈ **571 KB** | ✅ ≤ 1.0 MB（NFR-60.4）|
| 滿 300 s run | ≈ **2.85 MB** | ⚠️ 對現行 3.4–3.8 MB 匯出為 +75%，超出 NFR-60.4 敘述的「增幅 ≤ 30%」框 |

⇒ **NFR-60.4 的 60 s 規格通過，但其「≤ 30% 增幅」的框只在短 drill 成立。** 實際 drill 長度遠短於
300 s（`spider-shot-wide-v1` 約 60–120 s ⇒ 0.57–1.1 MB），故非 blocker；但這個上界必須寫明，
T-exit 需決定是否要為長 drill 加容量政策（OQ 候選）。

### 仍 BLOCKED

R2 的三組空洞分布（④⑤⑥）與瀏覽器 frame log 的開／關對照（F6）。**T0 維持 blocked。**

## T3 implementation audit（2026-09-09）

### Scope

新增兩個檔（生產側只有一個模組，零既有檔案修改）：

| 檔案 | 內容 |
|---|---|
| [`src/metrics/mouseSampleGaps.ts`](../../../../../src/metrics/mouseSampleGaps.ts) | `segmentByTimeGap()`（README §2.3 簽名）+ `deriveUnlockedIntervals()`（D-60.T3-5）+ `TimeInterval`／`SampleGap`／`SampleSegment`／`SampleSegmentation` |
| [`src/metrics/mouseSampleGaps.test.ts`](../../../../../src/metrics/mouseSampleGaps.test.ts) | 25 cases：切段語意 8、Pointer Lock 消歧 5、型別邊界與 typed error 6、C-D4／純度 3、C-D3／R7 2 |
| `CONTEXT.md` | 新增「未取鎖區間（unlocked interval）」一列（T1 已定義 raw mouse sample／時間間隙／取樣區段，本 task 逐字對齊，未改動）|

**既有檔案零修改** —— 本模組不被 `src/` 任何生產路徑 import（C-D3），故不進 `SimLoop`、教練報告或 registry。

### Verification

| Item | Command / evidence | Result |
|---|---|---|
| Targeted T3 tests | `npm.cmd test -- src/metrics/mouseSampleGaps.test.ts` | exit 0；**25 passed** |
| Typecheck ×2 | `npm.cmd run typecheck` | exit 0 |
| Full Vitest | `npm.cmd test` | exit 0；**246 files passed, 1 skipped；2606 passed, 2 skipped** |
| Build | `npm.cmd run build` | exit 0；Vite 6.4.3；193 modules；保留既有 chunk-size warning |
| C-D3 importer scan | 測試內走訪 `src/**/*.ts` 找 `mouseSampleGaps` 字串 | importer 數 **0**（僅模組自身與其測試）|
| C-D4 symbol scan | 剝註解後掃 `omegaDegPerSec`／`deriveDetectionMetrics`／`deriveRepositioningSuspicion` | **0** 命中 |
| 構念語彙 scan | 剝註解後掃 `lift`／`reposition`／`suspicion`／`stall`（不分大小寫）| **0** 命中 |
| NFR-60.6 純度 scan | 剝註解後掃 `three`／`node:`／`readFileSync`／`Date.now`／`performance.now`／`Math.random`／`document.`／`window.` | 八個 pattern **全數 0** 命中 |
| R7 命名 scan | 走訪 `src`／`tests`／`scripts` 全部 `.ts` 掃 `LOD`（原文，不剝註解）| **0** 命中（僅掃描器自身，已具名排除）；`grep -nE "LOD" CONTEXT.md` exit 1 |

**全量差額歸屬**：T2 baseline 245 files / 2581 passed → T3 為 246 files / 2606 passed。差額 = **+1 檔、+25 cases**（皆為本 task 新增檔），其餘檔案 case 數未動 ⇒ 與平行 session 無交集。

### 斷言偵測力（三組突變，逐一實測）

沿用 Surprises 4 的教訓：宣稱「邊界正確／不重疊」的斷言，寫完必須用故意的突變驗證它抓得到。

| 突變 | 預期抓到的性質 | 實測 |
|---|---|---|
| 比較改成 `<= 0`（拿掉 `GAP_EPSILON_US`）| 32.3 ms 門檻下恰在門檻上的 32,300 µs 被誤判為間隙 | **1 case failed**（boundary 案例）|
| lock 重疊改成非嚴格（`<=`，端點相接算重疊）| 緊鄰真實間隙被中斷一起吃掉 | **1 case failed**（F2 案例）|
| lock 間隙**同時**留在 `gaps` | 違反 `lockGapIndices` 與 `gaps` 不重疊的 invariant | **3 cases failed** |

⚠️ 第一次嘗試的突變（`<=` 改 `<`）**全綠存活**，但那是一個 no-op 突變（差異只在恰好等於 1e-6 時），不是斷言的漏洞。它反而暴露了真正的漏洞：原本的「恰在門檻上」案例用 30 與 18.2，兩者的 `×1000` 乘積都落在整數上或其上方，**證明不了容差有沒有生效**。窮舉 10–60 ms 全部一位小數門檻後找到唯一有偵測力的 32.3，補為獨立案例（D-60.T3-3）。

### ✅ 真人取樣的區段／間隙分布（T3 DoD 第 9 項；TF2）

2026-09-09 以 repo 外的 B 組真人匯出實跑；完整數字與限制見 §TF2。`analyze:spider-wide` exit 0，
`activeRateHz = 708 Hz`（≥ 500 Hz），18／30／50 ms 三門檻均由 `deriveUnlockedIntervals()` →
`segmentByTimeGap()` 計算。⇒ **T3 DoD 第 9 項補齊，T3 轉 ✅**。真人逐筆軌跡與 throwaway script 均未進 repo。

## T4 implementation audit（2026-09-09）

### Scope

生產側只有一個檔，且既有邏輯**一行未動**（新增皆為 additive）：

| 檔案 | 改動 |
|---|---|
| [`scripts/spiderWideRepositioningRunner.ts`](../../../../../scripts/spiderWideRepositioningRunner.ts) | ① `SpiderWideRunSummary` additive 六欄（`sampleCount`／`observedRateHz`／`sampleOverflow`／`lockBreakCount`／`gapCountAtThreshold`／`longestGapMs`）；② 新 private `readSamplingHealth()`；③ 四個取樣 blocker（全閘在 block 存在上，D-60.T4-1）；④ 報告開頭多一行門檻 provenance、「逐 run」段多一張 `###` 子表（D-60.T4-3）；⑤ 兩個常數 `MIN_OBSERVED_RATE_HZ = 500`、`REPORTED_GAP_THRESHOLD_MS = 30`（D-60.T4-2）。 |
| [`tests/regression/spider-wide-repositioning-runner.test.ts`](../../../../../tests/regression/spider-wide-repositioning-runner.test.ts) | +7 cases；helper `widePayload()` 加 `mouseSamples`／`extraEvents` 兩個選配參數、`summary()` 補六個 `undefined` 預設 |
| [`docs/operational/spider-wide-recording-spec.md`](../../../../operational/spider-wide-recording-spec.md) | §2.4 新節「原始滑鼠取樣的錄製前提（選配）」；§5 的報告三段說明納入子表與六個**逐字相符**的欄位名 |
| — | `analyze-spider-wide-repositioning.ts` **一行未動** —— 六欄與 blocker 都在 runner 的回傳值裡，I/O 殼不需要知道它們（既有分工成立即為證據）。`mouseSampleGaps.ts` 亦一行未動。 |

C-D3 仍成立：`mouseSampleGaps` 的 importer 掃描只掃 `src/**`，而本消費者在 `scripts/`。它不進 `DrillMetricRegistry`、不進教練報告 —— 報告出的是**描述性**的空洞計數，不是指標。

### Verification

| Item | Command / evidence | Result |
|---|---|---|
| Targeted T4 tests | `npm.cmd test -- tests/regression/spider-wide-repositioning-runner.test.ts` | exit 0；**19 passed**（既有 12 + 新增 7）|
| 既有 12 案例期望值零修改 | `git diff -U0` 的**移除行**共 6 行 | 全部落在檔頭註解、`widePayload()` 的 doc／簽名、`makePayload(` 呼叫的兩行；**沒有一行在既有 `it()` 內** |
| Typecheck ×2 | `npm.cmd run typecheck` | exit 0 |
| Full Vitest | `npm.cmd test` | exit 0；**246 files passed, 1 skipped；2613 passed, 2 skipped** |
| Build | `npm.cmd run build` | `$LASTEXITCODE = 0`；`dist/assets/index-CcqBc2hD.js` 1,220.06 kB gzip 346.97 kB —— **hash 與 T2 完全相同**，`scripts/` 不進 app bundle |

**全量差額歸屬**：T3 baseline 246 files / 2606 passed → T4 為 246 files / **2613** passed。差額 = **+7 cases**（皆為本 task 新增於既有檔），檔數未增、其餘檔案 case 數未動 ⇒ 與平行 session 無交集。

### 斷言偵測力（四組突變，逐一實測）

| 突變 | 預期抓到的性質 | 實測 |
|---|---|---|
| M1：`segmentByTimeGap()` 改吃 `[]`（不傳 lock 區間）| lock 中斷造成的空洞會被算成候選間隙 | **1 case failed** |
| M2：COI blocker 移出 `sampling !== undefined` 閘 | legacy（無 `mouseSamples`）run 平白多一條 blocker | **1 case failed** |
| M3：`sampleCount ?? 0`、`sampleOverflow ?? false` | 「沒錄」被壓成「錄了但為零」 | **1 case failed** |
| M4：`longestGapMs` 涵蓋 lock 歸因的空洞 | 一次 alt-tab 就讓最長間隙變成量測假影 | **1 case failed** |

四組突變後皆已還原並複跑 19 passed。

### 實跑證據

**① legacy 匯出（無 `mouseSamples`）—— 不因缺該區塊新增任何 blocker**

```text
npm.cmd run analyze:spider-wide -- research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json --out <scratch>/legacy

## 資料品質：1／1 份有 blocker
- **counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json**
  - drillId 為 'counterstrafe_ad_v1'，非 'spider-shot-wide-v1' ⇒ 無 peripheral 母體
  - 缺指示標籤 ⇒ 無 ground truth，不參與方向性分組
  - `meta.dpi` 缺席 ⇒ `cm/360` 不可稽核（錄製時未填 SessionSetup 的 Mouse DPI）
  - 零個 `zone: peripheral` 抵達 ⇒ 母體為空

### 原始取樣健康度（WP-60）
本批**沒有任何** run 帶 `mouseSamples` 區塊（錄製時未以 `?rawMouse=1` 開啟原始取樣）。這**不是 blocker** ——
只是少了這一維資料，上面的數字不受影響。
```

四條 blocker **全部是本 task 之前就有的**（drill／指示／DPI／母體），取樣 blocker 零條。

**② 含 `mouseSamples` 的樣本 —— 三段結構完整、六欄有值**

輸入為 scratchpad 內以同一份 fixture 注入 `mouseSamples` + `meta.mouseSampling` 產生的兩份合成匯出（**不進 repo**，比照 D-57.T5-8）：`raw-clean`（2,000 筆 @ ~1 ms，三個真實空洞 45／120／900 ms，COI true，無中斷）與 `raw-degraded`（800 筆、312 Hz、`overflow: true`、COI false、一次涵蓋 900 ms 空洞的 Pointer Lock 中斷）。

```text
## 資料品質（raw-degraded 的取樣四條，raw-clean 零條）
  - 原始取樣事件率不足（312 Hz < 500 Hz）⇒ 時間間隙判定不可用（README §2.6 F1）
  - 原始取樣溢位（recorded 800 已達容量上限）⇒ 末端資料缺失，不要把樣本流的結尾當成 drill 的結尾（FR-60.9；tick 資料本身仍有效）
  - `meta.crossOriginIsolated: false` ⇒ `event.timeStamp` 精度不足（F4），樣本間 `dt` 被捨入雜訊污染，時間間隙判定不可信
  - Pointer Lock 中斷 1 次 ⇒ 該區間的空洞**不是**抬滑鼠（FR-60.6）；已排除在間隙計數之外，但中斷期間的移動依 FR-A-8 整筆丟棄，那段軌跡不可復原

### 原始取樣健康度（WP-60）
| run | samples | 事件率 (Hz) | 溢位 | lock 中斷 | 間隙 > 30.0 ms | 最長間隙 (ms) |
|---|---|---|---|---|---|---|
| raw-clean.json | 2000 | 1005 | 否 | 0 | 3 | 900.0 |
| raw-degraded.json | 800 | 312 | 是 | 1 | 1 | 60.0 |
```

`raw-degraded` 的兩個空洞（60 / 900 ms）中，900 ms 那個被 Pointer Lock 中斷吸收 ⇒ `gapCountAtThreshold` 由 2 降為 1、`longestGapMs` 由 900 降為 60。**F2 的消歧在真實腳本路徑上成立**，不只在單元測試裡。

⚠️ 這兩份是**合成**輸入，證明的是報告管線正確，**不是**真人取樣的分布；該缺口已於後續 TF2
以 B 組真人匯出補齊（見 §TF1／TF2 follow-up）。

## T-exit gate（2026-09-09）

> 逐條 A-60.1～16 + 四個收尾閘 + FR/NFR 對帳 + §2b 覆核 + WP-61 handoff。
> **未達成的一律列名歸因**，不以「實作完成」代替。基準 commit `f06fe1f`（T4 之後）；本 gate 期間落地
> 一個修復 commit `66a1890`（D-60.X1，見 Decision Log）。

### TF1／TF2 follow-up 實機摘要（2026-09-09）

兩份真人匯出均留在 repo 外；以下只記統計摘要。A 為 rawMouse 關、B 為 rawMouse 開。

#### TF1：A/B 可比性 gate 與 F6

| 可比性項目 | A | B | 覆核 |
|---|---:|---:|---|
| `meta.drillId` | `spider-shot-wide-v1` | `spider-shot-wide-v1` | ✅ 相同 |
| `meta.frames.summary.count` | 3780 | 3779 | ✅ 差 **0.026%**（< 20%）|
| displayHz／解析度模式 | 60 Hz；native；3840×2160 buffer／2560×1440 CSS；DPR 1.5 | 同 A | ✅ 相同 |
| `meta.crossOriginIsolated` | true | true | ✅ 兩組皆 true |
| B `meta.mouseSampling.recorded > 0` | 不適用（rawMouse 關） | **31,621** | ✅ 錄製確實開啟 |

讀取命令：PowerShell `ConvertFrom-Json` 後逐欄讀 `meta.frames.summary`／`meta.suspect`／
`meta.lateEventCount`／`meta.bufferOverflow`／`meta.display`，以及 B 的 `meta.mouseSampling`。

| 量 | A（關）| B（開）| Δ（B−A）|
|---|---:|---:|---:|
| frame p50 (ms) | 16.670 | 16.670 | **0.000** |
| frame p95 (ms) | 16.790 | 16.785 | **−0.005** |
| frame p99 (ms) | 16.855 | 16.840 | **−0.015** |
| `overBudgetWindows`（7.8125 ms）| 3780 | 3779 | **−1（未新增）** |
| frame summary overflow | false | false | — |
| `meta.suspect` | true | true | — |
| `lateEventCount` | 0 | 0 | 0 |
| `bufferOverflow` | false | false | — |

**A-60.16 = ✅。** Δp95 = −0.005 ms ≤ 0.5 ms，且 over-budget windows 未新增；歸因為
raw capture **未造成可量測的 frame-time regression**。兩組共同的 `suspect=true` 與幾乎逐 frame
超過 7.8125 ms，來自相同的 60 Hz frame pacing（p50 約 16.67 ms），不是 rawMouse 開啟後才出現的退化。

#### TF2：操作者報告與 18／30／50 ms sweep

命令：`npm.cmd run analyze:spider-wide -- "<repo外/B.json>" --out "<scratch>/raw-real"`，**exit 0**。
原始取樣健康度七欄：samples **31,621**；平均事件率 **529 Hz**；連續期間 `activeRateHz`
**708 Hz**；overflow **否**；lock 中斷 **0**；gaps > 30 ms **231**；max gap **739.1 ms**。
報告整體仍列 **1／1 有 blocker**：缺指示標籤、DPI、`meta.suspect=true`，且 canonical 偵測撞 KI-031；
這些限制其他研究用途，但不改變 TF2 以 `activeRateHz ≥ 500` 判斷原始取樣是否足以描述 gap 分布的 gate。

throwaway script 位於系統暫存目錄（不進 repo），直接 import `src/metrics/mouseSampleGaps.ts`，以
`deriveUnlockedIntervals(payload.events, lastSampleMs)` → `segmentByTimeGap(block, threshold, unlocked)`
實跑。分位採 `(n−1)×p` 線性插值，顯示至 0.001；三組 `lockGapIndices.length` 均為 0。

| 門檻 (ms) | 區段數 | 區段 samples p50 / p95 | 間隙數 | 間隙 ms p10 / p50 / p90 / max | lock gaps |
|---:|---:|---:|---:|---:|---:|
| 18 | 333 | 11 / 369.200 | 332 | 21.527 / 39.768 / 97.525 / 739.100 | 0 |
| 30 | 232 | 41.500 / 467.450 | 231 | 32.450 / 55.155 / 107.300 / 739.100 | 0 |
| 50 | 133 | 209 / 527.400 | 132 | 54.312 / 75.015 / 116.496 / 739.100 | 0 |

錄製條件／n：Windows 10、Edge 151、`spider-shot-wide-v1`、raw sample span **59.727 s**、
31,621 samples、60 Hz native 3840×2160 buffer／2560×1440 CSS、DPR 1.5、COI true、sensitivity 1、
`cs2-0.022deg`、FOV 75。匯出未記滑鼠型號與 DPI；協定要求 1000 Hz 滑鼠，但此檔無法獨立稽核硬體設定。

限制（逐條保留）：

1. 以上是**描述性**分布，不宣稱任何一個空洞是抬滑鼠（C-D3／C-D4／D-60.R2-1）。
2. 門檻仍**未校準**；18／30／50 ms sweep 只顯示敏感度，不構成選擇依據。
3. 結果條件於本次 n 與上述錄製條件；滑鼠型號／DPI 缺席，跨人、跨硬體或跨設定比較不得省略此限制。

⇒ `activeRateHz` 過 F1 下限，三門檻分布與條件／限制齊備；**T3 DoD 第 9 項 = ✅**。

### 收尾閘（實際數字）

| 閘 | 指令 | 結果 |
|---|---|---|
| Typecheck ×2 | `npm.cmd run typecheck` | **exit 0**（`tsc --noEmit` + `-p tsconfig.node.json`）|
| 全量 Vitest | `npm.cmd test` | **exit 0**；**246 files passed, 1 skipped（247）；2614 passed, 2 skipped（2616）** |
| Build | `npm.cmd run build` | **exit 0**；Vite 6.4.3；193 modules；`dist/assets/index-CcqBc2hD.js` 1,220.06 kB gzip 346.97 kB —— **hash 與 T2／T4 完全相同**（本 gate 只動 `scripts/`／`docs/`／`tests/`，不進 app bundle）；保留既有 chunk-size warning |
| 全量 Playwright | `npx.cmd playwright test --workers=1` | ✅ **exit 0；101 passed／0 failed／0 skipped（13.8m）**。逐項歸屬與 history root 證據見 §TF3。 |

**全量差額歸屬**：T4 baseline 246 files / 2613 passed → 本 gate 246 files / **2614** passed。差額 = **+1 case**，即 D-60.X1 在
`spider-wide-repositioning-runner.test.ts` 新增的停頓對照案例（該檔 19 → 20）；檔數未增、其餘檔案 case 數未動
⇒ 與平行 session（stage12）**無交集**。本 gate 開場先跑一次未修改狀態的全量，得 2613，與 T4 紀錄逐位相符
⇒ 這個 baseline 本身也不含他人變更。

### TF3 follow-up：全量 Playwright 讀數與歸屬（2026-09-09）

**執行前 gate**：5173／4173 兩次檢查皆無 listener，因此沒有 server 可停，也不需終止任何 process；
5174 未被查殺或停止。`data/session-history/.history-root.lease` 記載 PID 68140，但該 PID 已無活 process，
故是 stale lease。測試前真實 history 快照為 **54 files／14,183,166 bytes／latest write 11:29:49 UTC**。

執行 `npx.cmd playwright test --workers=1`，結果 **exit 0；101 passed／0 failed／0 skipped（13.8m）**。
失敗集合為空，故沒有任何 case 可歸為「疑似 flake」，也不觸發 KI-030 的 `test-results/` 完整備份紀律。

| 歸屬面 | 實際結果 | 判定 |
|---|---:|---|
| 既存 KI-027／`overlay-layering.spec.ts` | **4 passed／0 failed** | 原先預期紅未重現；本輪無 KI-027 失敗 |
| KI-030（多 worker flake）| **0 failed**；合法門檻命令固定 `--workers=1` | 本輪無 KI-030 失敗，不以 flake 掩蓋任何紅燈 |
| WP-58 | `session-orchestrator.spec.ts` **15 passed**；overlay 4 passed | WP-58 相關真瀏覽器流程全綠，無失敗歸屬 |
| WP-60 | `raw-mouse-sampling.spec.ts` **2 passed** | **無 WP-60 回歸** |
| 其餘 E2E | 全部 passed | 無其他失敗 |

**history root 證據**：跑後 `.playwright-tmp/history-dev` 與 `.playwright-tmp/history-preview` 均存在，
分別有 **117／172 個直接子目錄**（低於「數百」清理門檻），且本輪 latest write 為 12:14:32／12:14:31 UTC。
真實 `data/session-history/` 跑後仍為 **54 files／14,183,166 bytes／latest write 11:29:49 UTC**，三項與跑前逐位相同；
真實 lease 內容也未變。⇒ Playwright 使用測試 roots，**沒有把 fixture 寫進真實 history root**。
跑後 5173／4173 皆無 listener；`test-results/` 只有成功執行的 `.last-run.json`，沒有失敗 artifact。

### 原 T-exit 時 Playwright 閘為何沒跑（不是「跳過」，是**當時跑了會說謊**）

`playwright.config.ts` 的 dev webServer 是 `reuseExistingServer: !process.env.CI` + `url: http://localhost:5173/`，
而 27 支 spec 全部把 `http://localhost:5173/` **硬編**在檔內。本機當下的實測：

| 量 | 值 | 含意 |
|---|---|---|
| 5173 LISTEN | PID 51084 `node .../FPS_aim_analyst/node_modules/vite/bin/vite.js` | **主 checkout** 的 dev server，不是本 worktree |
| `GET :5173/src/main.ts` | 200，246,000 bytes，`rawMouse` 命中 **0** | 該 server 服務的是**不含 WP-60 的程式碼** |
| `GET :5173/api/history/health` | `validRunCount: 78` | 它掛的是**真實** history root（`.playwright-tmp/history-dev` 只有 1 個 entry）|
| 5174 LISTEN | PID 24544，`/src/main.ts` 的 `rawMouse` 命中 **3** | 這才是 T0 R1/R2 的量測 server（`--port 5174`）|
| 4173 | 未 LISTEN | preview 會被 Playwright 自己拉起（無妨）|

⇒ 在此狀態下跑全量 Playwright 有兩個後果，且**都不會報錯**：① `reuseExistingServer` 會沉默地重用 5173，
於是整批 e2e（含 `raw-mouse-sampling.spec.ts`）測的是**別的樹**；② history 相關的 spec 會把測試 participant
寫進**真實**的 session-history root。這正是 memory 記過的那個陷阱的最壞版本。設 `CI=1` 也救不了 ——
`reuseExistingServer` 會變 false，但 5173 已被占用，Vite 會自動換 port，而 Playwright 的 readiness 檢查仍打
5173，於是**照樣**連到別人的 server。

**當時的處置**：兩支 dev server 屬於他人的 session（5174 是使用者的 R1/R2 量測入口），
**原 gate 不終止它們**，待埠釋放後才跑：

```powershell
npx.cmd playwright test --workers=1      # KI-030：多 worker 不可重現，門檻讀數一律 --workers=1
```

當時預期可能因既存 [KI-027](../../../../known_issue/) exit 1；TF3 實跑結果則是 overlay 4／4 passed、
全量 exit 0。T2 舊讀數不再代替本輪：TF3 已重新取得 `raw-mouse-sampling.spec.ts` **2／2 passed**。

### A-60.1～16 逐條

| ID | 判定 | 指令 / 實際輸出 |
|---|---|---|
| **A-60.1** 真實 run 含 `mouseSamples`，樣本數 ≈ 事件率 × 時長 | ✅（實機，2026-09-09 R1 Run B）| arena `recorded` = **10,476**、`lockedRaw` = 10,476（**零遺漏**）、span **10.79 s** ⇒ 971 樣本/s，對照探針實測 `pointermove` 派發 **997 events/s**（比值 0.97）。<br>⚠️ 該匯出 JSON 依 D-57.T5-8 **不進 repo**，證據為使用者貼回的 `__aimDebug.recorder.snapshot()` 摘要；本 gate 未重跑（Playwright 閘同一阻塞）。 |
| **A-60.2** 關閉錄製時匯出逐位相同 | ✅ | `npm.cmd test -- src/data/*.test.ts`（五檔）**182 passed**：關閉時 `snapshot()` **不存在** `mouseSamples`／`mouseSampling` 兩個 key（非空物件）。<br>更強的證據 —— 全 WP 範圍 `git diff -U0 715ffcb..HEAD -- "src/**/*.test.ts" "tests/**"` 的**移除行共 7 行**，逐行檢視：6 行在 runner test 的檔頭註解／helper 簽名，1 行是 `spiderWideDeterminismFixture.ts` 的 recorder 建構（改為吃 options）——**沒有一行在任何 `it()` 內**。⇒ 既有 golden／determinism／round-trip 期望值**零修改**（NFR-60.7）。 |
| **A-60.3** 四 FPS parity 開／關逐位一致 | ✅ | `npm.cmd test -- tests/regression/wp60-raw-mouse-capture.test.ts` **20 passed**。比對面為 `TickRecord` **全欄位**攤平後逐格 `Object.is`（D-60.T2-2，非 `toEqual`／`toBeCloseTo`）。 |
| **A-60.4** 每 tick `dYaw` = 該 tick 窗內原始樣本換算總和 | ✅ | 同檔，`'每個 tick 的 dYaw/dPitch = 落在該 tick 窗內 raw 樣本經同一 gain 換算的總和（逐位）'`：以生產的 `createAimIntegrator()` + 同一 `resolveMouseGain()` 重播半開窗 `[.., tick.t)`，1,200 筆全數歸位。 |
| **A-60.5** 錄製開啟不新增 `Array.prototype.push` | ✅ | 同檔，含前置案例「微型 harness 真的消費到樣本（否則比較的是兩個 0）」——先證對照組非空，再證計數相同。 |
| **A-60.6** 溢位獨立旗標、不改 `meta.suspect` | ✅ | 同檔 4 個案例（`overflow: true`、`recorded === capacity`、tick 資料完整、`suspect`／`recorderOverflow` 不變）＋ `DataRecorder.test.ts` 的 `'raw sample overflow is independent from tick recorder overflow'`。 |
| **A-60.7** 缺席合法／宣稱不符擲指名 typed error | ✅ | `exportPayloadSchema.test.ts`（在上述 182 passed 內）：缺席合法、`mouseSamples` 形狀錯、`recorded > capacity`、`recorded ≠ dtUs.length`、只有 block 沒有 meta、只有 meta 沒有 block —— 六格全覆蓋，錯誤 `path` 逐一指名欄位。 |
| **A-60.8** `segmentByTimeGap()` 對抗性 fixture 全綠 | ✅ | `npm.cmd test -- src/metrics/mouseSampleGaps.test.ts` **25 passed**，含 32.3 ms 門檻（`×1000 = 32299.999999999996`，唯一能分辨容差的一位小數門檻，D-60.T3-3）。 |
| **A-60.9** lock 中斷的空洞與真實間隙可分辨 | ✅ | 同檔 Pointer Lock 消歧 5 案例；**且在真實腳本路徑上成立** —— 本 gate 重跑合成 run：`paused.json` 的 5,000 ms 空洞留在 `gaps`；T4 的 `raw-degraded` 那個被中斷覆蓋的 900 ms 空洞則被移出（`gapCountAtThreshold` 2 → 1）。 |
| **A-60.10** 60 s run 的 `mouseSamples` ≤ 1.0 MB | ✅（60 s）／⚠️（300 s 上界）| T1 實測 60,000 筆 columnar block `JSON.stringify` = **567,316 bytes**（p50 1.714 ms／p95 2.377 ms）。R1 實機推算 9.46 bytes/sample ⇒ 60 s ≈ **571 KB**。<br>⚠️ **滿 300 s 的 run ≈ 2.85 MB**，對現行 3.4–3.8 MB 匯出為 **+75%**，超出 NFR-60.4 敘述裡「增幅 ≤ 30%」那個框。條文的 60 s 門檻通過，框不成立 ⇒ 開 **OQ-60.7**（不阻塞：`spider-shot-wide-v1` 實際 60–120 s ⇒ 0.57–1.1 MB）。 |
| **A-60.11** `dt` 量化誤差 ≤ 10 µs | ✅（構造性）| `MouseSampleArena.snapshot()` 以 `Math.round((tMs[i]−tMs[i−1]) × 1000)` 產 `dtUs` ⇒ 單筆誤差**上界恆為 0.5 µs**，與資料無關。T0 synthetic round-trip 實測 max **0.369 µs**。<br>⚠️ 這證的是**本專案的量化**不破壞精度；瀏覽器 `event.timeStamp` 自身的解析度另由 `crossOriginIsolated`（R1 實測 `true`）保證，本 gate 未對硬體參考時鐘做外部校驗。 |
| **A-60.12** 新模組純度掃描全綠 | ✅ | `mouseSampleGaps.test.ts` 的 NFR-60.6 案例：剝註解後掃 `three`／`node:`／`readFileSync`／`Date.now`／`performance.now`／`Math.random`／`document.`／`window.` —— 八個 pattern **全數 0 命中**。 |
| **A-60.13** C-D3 零 importer + C-D4 零既有判準符號命中 | ✅ | 同檔：`src/**` 內 `mouseSampleGaps` 的 importer 數 **0**；剝註解後掃 `omegaDegPerSec`／`deriveDetectionMetrics`／`deriveRepositioningSuspicion` **0 命中**；構念語彙 `lift`／`reposition`／`suspicion`／`stall` **0 命中**。<br>唯一消費者 `scripts/spiderWideRepositioningRunner.ts` 刻意落在 `scripts/`（不進 `DrillMetricRegistry`、不進教練報告），報告只出**描述性**量。 |
| **A-60.14** 全 repo 無 `LOD` 縮寫命名 | ✅ | `\bLOD\b` 掃 `src`／`tests`／`scripts`／`CONTEXT.md`／`stage13` 全部檔案 ⇒ **唯一命中是掃描器自己的測試標題**（`mouseSampleGaps.test.ts:321`，已具名排除）。 |
| **A-60.15** 缺 `mouseSamples` 的舊匯出不被判 blocked | ✅（實跑）| `npm.cmd run analyze:spider-wide -- research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json --out <scratch>` exit 0 ⇒ 4 條 blocker **全部是本 WP 之前就有的**（drill／指示／DPI／母體），取樣 blocker **0 條**；取樣段落印「這**不是 blocker**」。 |
| **A-60.16** frame-time p95 開／關差值符合門檻、無新增掉 tick | ✅（實機 A/B） | **瀏覽器側**：可比性五項全過；A→B 的 Δp50／p95／p99 = **0.000／−0.005／−0.015 ms**，`overBudgetWindows` **3780→3779**（未新增），故 Δp95 ≤ 0.5 ms 且 F6 通過。兩組皆 `suspect=true`，歸因為共同的 60 Hz frame pacing（p50 約 16.67 ms）高於 7.8125 ms floor，非 raw capture 新增退化。**node 側**既有結果仍為 Δp95 −0.0044～+0.0007 ms。詳見 §TF1。 |

**逐條結論**：16 條中 **15 條 ✅**、**1 條 ✅ 帶上界告警**（A-60.10 → OQ-60.7），沒有 🟡／❌。

### FR / NFR traceability 對帳（README §4.1 逐列）

| FR / NFR | Task | 本 gate 覆核 |
|---|---|---|
| FR-60.1 逐筆保留 | T1+T2 | ✅ A-60.1／A-60.3 檔內「逐筆保留 raw counts，不做跨事件聚合」 |
| FR-60.2 選配、預設關閉、關閉時逐位相同 | T1+T2 | ✅ A-60.2（含 7 行移除行的逐行歸因）|
| FR-60.3 provenance | T1 | ✅ `MouseSamplingMeta` 六欄（`timeSource`／`deltaUnit` 為字面型別，parser 釘死）|
| FR-60.4 缺席合法／宣稱不符 typed error | T1 | ✅ A-60.7 六格 |
| FR-60.5 時間間隙切段 | T3 | ✅ A-60.8 |
| FR-60.6 三種空洞可分辨 | T1+T3 | ✅ A-60.9；第三種（drill 未進行）為**結構性不存在於輸出**（`mouseSampleGaps.ts` 檔頭已明文）|
| FR-60.7 同時鐘域可對齊 | T2 | ✅ A-60.4 + `t0Ms + Σ dtUs` 逐位還原事件時間戳 |
| FR-60.8 操作者報告 | T4 | ✅ A-60.15 實跑 + 七欄子表；**且 D-60.X1 修掉了「事件率」那一欄的誤判** |
| FR-60.9 溢位獨立旗標 | T1+T2 | ✅ A-60.6 |
| NFR-60.1 決定性 | T2 | ✅ A-60.3 |
| NFR-60.2 零額外配置 | T2 | ✅ A-60.5 |
| NFR-60.3 容量 | T1 | ✅ 360,000 槽（1000 Hz × 300 s × 1.2）；R1 實機以 1005 Hz 可撐 358 s > 300 s，`overflow: false` |
| NFR-60.4 匯出體積 | T0+T1 | ✅ 60 s／⚠️ 300 s 上界 → **OQ-60.7** |
| NFR-60.5 時間精度 | T0+T1 | ✅ A-60.11（構造性 0.5 µs 上界）|
| NFR-60.6 純度 | T3 | ✅ A-60.12 |
| NFR-60.7 零回歸 | 全 | ✅ 三個閘 exit 0 + 期望值零修改；**Playwright 未取讀數**（見上）|

⇒ traceability 表**無遺漏列**；F6 的瀏覽器側讀數已由 TF1 補齊並通過。

### §2b 硬約束逐條覆核（T-exit 重新過閘）

| 約束 | 覆核結果 |
|---|---|
| 禁 `Date.now()`、一律 `performance.now()`（ADR-4）| ✅ 仍成立。sim 內**零新增時鐘讀取**（樣本時間戳沿用 `ev.t` = `event.timeStamp`）；唯一 `performance.now()` 新增點在 `main.ts` 的 `pointer_lock` 事件（app 佈線層，非 sim）。純度掃描含 `Date.now`／`performance.now` 於 `mouseSampleGaps.ts` 0 命中。 |
| cross-origin isolation 生效 | ✅ 前提未變；R1 實機 `crossOriginIsolated === true`。F4 已落成 T4 的 blocker（且依 D-60.T4-1 閘在 block 存在上）。 |
| **決定性**（最高風險項）| ✅ 仍成立。本 gate 未動 `src/` 一行；A-60.3 的全欄位 `Object.is` 比對 20 passed。D-60.X1 的修復只在 `scripts/`（離線分析），結構上不可能觸及 sim。 |
| 三迴圈邊界（ADR-2）| ✅ 仍成立。`src/input/**` 與 render 層對 `mouseSampleArena` 的 import 命中數 **0**（`wp60-raw-mouse-capture.test.ts` 掃 > 10 個模組，非空掃）。 |
| 固定佈局（真 ring／preallocated arena／不 push 物件）| ✅ 仍成立。`MouseSampleArena` = 三個建構期配置的 `Float64Array`，drill 內不繞圈、滿了設旗標丟末端（D-60.P6）；A-60.5 的 push 計數不變。<br>ⓘ `snapshot()` 會配置三個 plain array（長度 = `recorded`）—— 那是 **drill 結束後**的一次性序列化路徑，與熱路徑紀律無關（`TickArena.snapshot()` 同一慣例）。 |
| seeded RNG（GD-5）| ✅ 不觸及；`Math.random` 掃描 0 命中。 |
| GD-6 場景幾何不進 sim／解析度與場景切換不改 sim | ✅ 不觸及（輸入域資料，不讀 `propBounds`／GLTF／`SceneConfig`）。 |
| GD-9 場景資產授權 | ✅ 不觸及（本 WP 零場景資產）。 |
| GD-11 FPSci 授權紅線 | ✅ 不觸及。移植來源為 `performance_analysis`，OQ-60.1 已收斂為無授權問題（D-60.P7）；`mouseSampleGaps.ts` 與 runner 皆**記名**來源檔與版本，且**未搬任何 Go 程式碼**（理由為技術性，見 D-60.P7）。 |
| GD-7 hitbox 單一來源 | ✅ 不觸及（`hitbox` 零命中）。 |
| C-D1／C-D5 | ✅ 仍成立。本 WP 只動 `src/`／`scripts/`／`tests/`／`docs/`，`research/` 未讀任何 TS 模組、`src/` 未 import Python 產物；**刻意不建立** Python 側實作（OQ-60.6）⇒ 不觸發 C-D5 的雙實作對表。 |
| C-D3／C-D4（本 WP 真正的風險）| ✅ 仍成立，見 A-60.13。**且 D-60.X1 是這條紀律的實例**：一個會對每份真人 run 說錯話的 blocker，寧可改掉也不能留在報告裡。 |

### WP-61 handoff（四項）

| # | 交付物 | 狀態 / 值 |
|---|---|---|
| 1 | 實機事件率分布 | ✅ **R1 Run B**（連續移動 10.79 s，n = 10,475 個間隔）：`dtUs` p50 **995**／p95 **1660**／p99 **2235**／max 151,305 µs；瞬時事件率 **≈ 1005 Hz**、探針派發率 997 events/s。<br>**副產品（WP-61 的門檻可行範圍）**：剔除取鎖起始靜止段後，**連續移動期間的空洞上限 = 18.2 ms**，其餘 6–15 ms ⇒ 本硬體上時間間隙切段的**雜訊底線 ≈ 18 ms**，PA 的 30 ms 有約 1.7× headroom。⚠️ 一輪 / n = 11 個空洞 ⇒ **prior，非校準值**。<br>⚠️ 直方圖本身未入 repo（只有分位與空洞明細，見 §T0 R1）。 |
| 2 | 抬起／停頓／一次到位的空洞長度分布 | ✅ **且結論是負面的**（R2，各 10 次）：lift 與 pause 的 >1 s 空洞**範圍重疊**（lift 1257–1850 ms、pause 1066–1363 ms），oneshot 無 >1 s 空洞但 max 270.4 ms。⇒ **D-60.R2-1：空洞長度不足以可靠分離 lift/pause**，不得據此凍結 30 ms／1 s 或任何分類門檻。<br>⚠️ 限制逐條見 §T0 R2；逐筆軌跡不入 repo，本 session 無法重算。 |
| 3 | PA 十四參數與語意抄本 + 「哪些需在角度空間重推」標註 | ✅ 見 §T0 automated audit 的表（十四列逐一標註 time-domain / **px/s 空間需重推** / dimensionless / counts / sample-count）。來源檔與 ADR 已記名（D-60.P7 要求）。 |
| 4 | OQ-60.4 構念歸屬結論 | 🔴 **未交付 —— 待使用者拍板**。T3 已以**中性時序語彙**交付原語（`gap`／`segment`／`unlocked`，掃描釘死零構念語彙命中），故**沒有預先佔用構念名**；但「新判準與 `deriveRepositioningSuspicion()` 是取代還是並存」仍是研究決定。<br>⇒ **WP-61 T0 的第一件事**，不阻塞 WP-60 收尾（README §1.5 明列 deadline = WP-61 T0）。 |

**WP-61 另需但本 WP 不提供**：高刷（≥ 144 Hz）真人標註 cohort，規格見
[`spider-wide-recording-spec.md`](../../../../operational/spider-wide-recording-spec.md)。

### T-exit follow-up 最終判定

F6、T3 真人分布與全量 Playwright 已由 TF1／TF2／TF3 全數補齊，故 **T0 = ✅、T3 = ✅**，
T-exit 判定更新為 **✅、零具名缺口**。OQ-60.4 與高刷真人標註 cohort 仍屬 WP-61，不是 WP-60 缺口。

## Surprises

1. **要偵測抬滑鼠所需的原始資料，這個專案其實一直都在收 —— 只是在進匯出前一步被丟掉。** [`InputSampler.ts:137-139`](../../../../../src/input/InputSampler.ts#L137-L139) 早在 WP-3（ADR-5，「1000 Hz 滑鼠下不遺失中間軌跡」）就用 `getCoalescedEvents()` 逐筆保留了 sub-frame 樣本與各自的 `event.timeStamp`；到了 [`SimLoop.ts:96-99`](../../../../../src/loop/SimLoop.ts#L96-L99) 才被 `accumulateMouse` 聚合成逐 tick 的 `dYaw`／`dPitch`。<br>⇒ 本 WP 的性質因此不是「新增一種量測」，而是**停止丟棄一份已經付過成本的資料**。這也解釋了為什麼 WP-57 的抬滑鼠標註只能做到「角速度停滯」—— 不是判準沒設計好，是它拿到的資料裡已經沒有那個資訊了。

2. **`performance_analysis` 的 LOD v1 偽陽，與 FPS 這邊實測到的偽陽是同一個。** PA 的 ADR-002 記載 v1 有兩個系統性偽陽：**「目標捕獲時的急停」**與**「目標中心附近的生理性顫抖」**。WP-57 §T5-real 實測合成期建議的 `100/15` 會把 44% 的「全程不抬滑鼠」對照 run 標成抬滑鼠，成因正是「寬鬆的 ω 門檻抓到的是拉槍中途的正常減速」。<br>⇒ 兩個專案在不同的訊號空間（px/s vs deg/s）、不同的實作語言、相隔半年，撞上同一個失效模式。PA 的解法（時間間隙當閘 + 非對稱門檻）因此不只是「一個可以參考的做法」，而是**對同一個已知病理的已驗證處置**。

3. **`performance_analysis` 沒有 LICENSE 檔 —— 但這次不是問題。** `go.mod` 與 `package.json` 也沒有 license 欄位。規劃期我把它開成 OQ-60.1 並設為 T3 的阻塞條件，理由是 GD-11 的存在正說明授權不能靠直覺。**使用者當日即回覆：兩個 repo 都是他寫的，無授權問題**（D-60.P7）。<br>⇒ 這條的價值不在結論（結論是「沒事」），而在**它讓一個原本要放棄的東西回來了**：PA 的十四個參數與 parity fixture 可以直接當起點。我在提問時已經先把「不複製原始碼」寫進建議處置，若使用者沒有主動澄清作者身分，這個計畫就會在一個不存在的限制下多繞一圈。<br>⇒ **教訓**：把外部依賴的授權開成 OQ 是對的，但**建議處置不該預設最保守的那一個** —— 保守選項若被照單全收，成本是沉默的（沒有人會發現本來可以不用重推參數）。應該把「若無授權問題則可以多做什麼」一併寫進 OQ，讓拍板者看得到兩邊的代價。

4. **按 DoD 字面寫出來的決定性斷言，抓不到「唯寫旁路」最可能的失效模式。** T2 DoD 明列比對對象為「逐 tick `replayTargetId` + `tx/ty/tz` + `dYaw`/`dPitch` + spawn 序列」。照字面實作、20 個案例全綠之後，我在錄製旁路裡手動塞了 `state.player.x += 1e-12`（即「錄製其實寫了 sim state」這個 bug 的最小形式）—— **20 個測試依然全綠**。原因是 player 位置／速度不在那份清單裡。改成攤平 `TickRecord` 全欄位後，同一突變被 4 個案例抓到。<br>⇒ 這不是 DoD 寫錯，而是**任何按名單列舉的比對面都會漏掉名單外的欄位**，而「唯寫」是一個全稱命題（不寫**任何** sim state），只能用全稱的比對面去證。<br>⇒ **教訓**：宣稱「零回歸／不改任何既有行為」的斷言，寫完必須用一次故意的突變驗證它的偵測力。全綠只證明「沒抓到東西」，不證明「有能力抓」。這次的成本是五分鐘，而錯過的代價是一個宣稱已證明決定性、實際上沒有的旁路。

5. **T2 是「接線」task，但真正的設計決定不在接線，而在要不要在 main.ts 打開它。** 一行 `recordMouseSample()` 沒有選擇餘地；有選擇餘地的是 app 佈線層 —— `recordKeyEvents` 與 `mouseIntegration` 的先例都是「全域開」，而 main.ts 的註解本身就記著「API 層 opt-in 存在但佈線層從未啟用」曾是前車之鑑，所以先例的壓力是往「開」的方向。<br>但這次相反：WP-60 的前提（R1）**尚未量測**，全域開等於用未驗證的前提換 8.6 MB 常駐 arena 與數 MB 匯出增幅。收斂成 `?rawMouse=1`（D-60.T2-1）之後才發現一個沒預期到的副作用 —— **它同時是 T0 缺的那個入口**：T0 的 R1/R2 要「真瀏覽器 + 真 COI + 真滑鼠」，而在 T2 之前 repo 裡根本沒有任何路徑能把 raw sample 匯出出來。<br>⇒ 一個原本被當成「因為 gate 沒過所以保守」的決定，實際上是**解開那個 gate 的工具**。⇒ **教訓**：被 gate 阻塞時，值得先問「這個 task 的產出能不能變成解 gate 的儀器」，而不是只問「這個 task 能不能在 gate 沒過的情況下安全落地」。

6. **README 的兩個要求，照字面各自合理，合起來自相矛盾。** §2.3 把 `lockGapIndices` 寫成「與 Pointer Lock 中斷重疊的**間隙 index**」，而 T3 步驟 3 要求那些間隙「**排除在 `gaps` 之外**（不是標記後留著 —— 留著就會有人忘記過濾）」。若 index 指的是 `gaps` 的 index，它就指向一個不含它們的陣列 —— 一個恆為空指標的欄位。<br>⇒ 解法不難（改指樣本 index，D-60.T3-1），值得記的是**發現的時機**：這個矛盾在寫型別註解、要解釋「index 指向哪裡」的那一刻才浮現。照著簽名把程式碼寫出來、測試也能全綠 —— 因為兩邊都是我寫的，我會很自然地讓測試去對齊我當下的那個讀法。<br>⇒ **教訓**：規格裡「兩個欄位的關係」比「一個欄位的型別」更容易藏矛盾，而**逼自己寫出每個欄位的語意註解**是最便宜的偵測器 —— 註解寫不下去的地方，就是規格沒收斂的地方。

7. **一個「全綠存活」的突變，暴露的不是斷言弱，而是我挑錯了邊界值。** 為了驗收「恰在門檻上不算間隙」的容差策略，我先把比較從 `<=` 改成 `<`，預期至少一個案例會紅 —— 結果 25 個全綠。第一反應是「斷言沒偵測力」，但實際上那是個 **no-op 突變**（兩者只在差值恰為 1e-6 時不同）。真正的問題在別處：我的邊界案例用 30 與 18.2 兩個門檻，而 `30 * 1000` 精確、`18.2 * 1000` 落在整數**上方** —— 兩者在有沒有容差之下**行為完全相同**，所以那兩個案例從頭到尾就沒有測到容差。窮舉 10–60 ms 全部一位小數門檻後，只有 **32.3**（`× 1000 = 32299.999999999996`）落在整數下方，是唯一能分辨的值。<br>⇒ **教訓**：突變測試的失敗有兩種讀法 —— 「斷言抓不到」與「突變根本沒改變行為」。把兩者混為一談會讓人去補一堆補不到點上的斷言。而浮點邊界的案例值**不能憑直覺挑**：看起來最像邊界的那個數（門檻本身、實測值 18.2），很可能恰好是那條路徑上最不敏感的輸入。


8. **突變測試的「還原」步驟本身會說謊 —— 我用 `git checkout --` 還原突變，結果把整個未提交的切片一起還原了。** T4 的第一輪突變驗證跑了三組：M1 抓到 1 個 case，然後 `git checkout -- scripts/...` 還原；接著 M2、M3 各報「6 個 case failed」，看起來偵測力很強。**但那六個失敗不是斷言抓到突變，而是整個 T4 實作已經不在檔案裡了** —— `git checkout --` 從 index 還原，而 index 就是 HEAD，我未提交的 164 行一起沒了。後兩組突變的 perl 替換甚至沒有命中任何一行（那些行不存在），實際跑的是「T4 完全沒實作」這個對照組。<br>⇒ 這與 Surprises 7 是**同一個病**的另一面：那次是「突變沒改變行為，卻被讀成斷言沒偵測力」，這次是「突變根本沒被套用，卻被讀成斷言偵測力很強」。**紅燈與綠燈一樣需要歸因**。<br>⇒ **教訓**：突變測試的 setup／teardown 要用**不依賴 VCS 狀態**的手段（`cp` 一份備份再 `cp` 回來）。在一個「當前 task 未 commit」是明文紀律的 repo 裡（`CLAUDE.md §3.1`），任何 `git checkout --`／`git restore` 的還原動作都等於「丟棄本 task 的全部工作」。重跑後四組突變各 1 個 case failed，才是真正的偵測力。

9. **T4 的四個 blocker 全部通過了單元測試與兩份合成匯出的實跑，其中一個仍然會對每一份真人 run 說錯話。** 事件率 blocker 讀 `meta.mouseSampling.observedRateHz`，而 T4 的測試是**直接把那個欄位設成 499／1005** 來驅動它 —— 於是被測到的只有「讀到小於 500 就報 blocker」這件事，沒有任何案例問過「真實匯出裡那個數字會是多少」。答案在同一份 progress.md 裡躺了一整天：T0 R2 三組的平均率是 417／494／412 Hz，全部低於下限，而同一支滑鼠在 R1 連續移動時是 1005 Hz。<br>⇒ 缺的不是斷言數量（T4 有 19 個案例、四組突變全部抓到），而是**輸入的來源**：fixture 的值由我指定，就等於我先假設了那個欄位的量級，再測試我的假設。<br>⇒ **教訓**：一個閘的測試，fixture 必須從**真實資料的形狀**倒推（1000 Hz 串流 + 一段停頓），而不是從**閘的閾值**倒推（499 / 501）。從閾值倒推的 fixture 恆定會通過，因為它是照著實作寫的。這也是為什麼 T-exit 不能只是「把每個 A-60.x 對到一個已經綠的測試檔」—— 逐條把實機數字代回去，才是它存在的理由。

## Open Questions（追蹤用，權威定義見 [README.md](README.md) §1.5）

| ID | 狀態 | 待誰 | Deadline |
|---|---|---|---|
| OQ-60.1 移植 PA 方法學的授權狀態 | ✅ **已收斂 2026-09-08**：無授權問題（同一作者、同一組織）。R5 關閉、T3 解除阻塞、PA 參數與 fixture 可直接引用（D-60.P7）| — | — |
| OQ-60.2 序列化格式（columnar µs vs array-of-objects）| ✅ **T1 contract 凍結**：columnar + integer µs delta；60k `mouseSamples` block 567,316 bytes / p95 2.377 ms。R1 實測事件率仍屬 T0/T2 runtime gate，不改 T1 schema。 | Engineering | — |
| OQ-60.3 Pointer Lock 中斷如何入匯出 | ✅ **T1 contract 凍結**：additive `pointer_lock` DrillEvent（`{ type, locked, t }`），parser 已支援；T2/T3 負責接線與消歧。 | Engineering | — |
| OQ-60.4 新判準與 `deriveRepositioningSuspicion()` 的關係 | 🔴 開放（T3 已以**中性時序語彙**交付原語並掃描釘死，故未預先佔用構念名；歸屬仍待拍板）| 使用者 + 研究 | WP-61 T0（不阻塞 WP-60）|
| OQ-60.5 高輪詢率（4000／8000 Hz）是否支援 | ✅ **T1 contract 凍結**：預設容量 1000 Hz × drill seconds × 1.2 headroom；高輪詢率不預先支援，超出以 `meta.mouseSampling.overflow` 具名退化。R1 實測若顯示本專案常態 >1000 Hz，需另開決策升版。 | Engineering | — |
| OQ-60.6 是否同步進 `research/` Python 側 | 🟡 有建議值（本 WP 內不做）| Engineering | WP-61 |
| **OQ-60.7**（T-exit 新開）長 drill 的匯出體積政策 | 🔴 **開放**：NFR-60.4 的 60 s 門檻（≤ 1.0 MB）**通過**（實測 571 KB），但條文附帶的「增幅 ≤ 30%」框在**滿 300 s** 的 run 上不成立 —— 原始取樣 ≈ 2.85 MB，對現行 3.4–3.8 MB 匯出為 **+75%**。<br>**不阻塞**：`spider-shot-wide-v1` 實際 60–120 s ⇒ 0.57–1.1 MB。<br>**候選處置**：(a) 只修條文，把「≤ 30%」改成「60 s ≤ 1.0 MB，長 drill 另計」；(b) 為長 drill 加降取樣或分段匯出政策；(c) 讓 `mouseSampleCapacity` 由 drill 長度而非 `maxDrillSeconds` 推導。**在有人真的錄一份 > 200 s 的 raw run 之前不值得選。** | 使用者 + Engineering | 首次出現 > 200 s 的 `?rawMouse=1` run |

## 規劃期未解的前提風險

> ✅ **2026-09-09 更新：R1 已於實機通過**（§T0 R1 實機量測 / D-60.T0-2）。以下原文保留為規劃期紀錄，
> 其結論已被實測取代 —— 但**它的教訓反而被實測加強了**：註解宣稱的不只是「有沒有次幀樣本」（這點對），
> 還包括「靠什麼機制拿到」（這點錯，見 D-60.T0-2）。一個寫在註解裡的宣稱，即使結論正確，機制也可能是錯的。

⚠️ **R1 尚未驗證，且它是本 WP 的存亡條件。** 整份計畫建立在「`getCoalescedEvents()` 在 Pointer Lock 下真的回傳次幀樣本」這個假設上。repo 內的註解如此宣稱（`InputSampler.ts:125-127`，ADR-5／附錄 B），但**沒有任何實機證據**。T0 step 3 是唯一的驗證點，且設為 go/no-go 閘：**觀測事件率 < 500 Hz 即停止本 WP**。

這與 WP-57 的教訓同型（Surprises 17／18：「靜態覆核 + 端到端 run 綠」不等於「指標棧在真人資料上產得出值」，而所有 harness 都逐 tick 直接寫 `state.aim`，結構上不可能重現真實取樣問題）。**一個寫在註解裡的宣稱，不是證據。**

**T2 之後的狀態更新（2026-09-08）**：R1 依然未驗證，T0 依然 blocked —— T2 的合成樣本流證明的是「擷取路徑逐位正確、且不改任何既有行為」，**不是**「真實硬體真的產出次幀樣本」。但 R1 現在**有量測入口了**：以 `?rawMouse=1` 載入（dev 或 preview 皆可，後者帶 production build 的 COI 條件），跑一輪 drill 後匯出，即可直接讀
- `meta.mouseSampling.observedRateHz` → R1 的 go/no-go 數字（門檻 ≥ 500 Hz）、
- `mouseSamples.dtUs` 的分布 → dt p50/p95/p99 與抬起／停頓的空洞長度分布（R2）、
- `pointer_lock` 事件 → 把 lock 中斷造成的空洞與感測器離地分開（FR-60.6）。

⚠️ 仍需**使用者實機操作**：T0 的 `spider-shot-wide-v1` 三種操作模式（刻意抬起／手不動停頓／一次到位）各 ≥ 10 次，以及瀏覽器 frame log 的開／關 p50/p95/p99 對照。這些本 session 無法替代。
