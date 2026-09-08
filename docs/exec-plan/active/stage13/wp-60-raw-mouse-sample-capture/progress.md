# WP-60 — progress.md

> 主規格：[README.md](README.md) · 清單：[task-checklist.md](task-checklist.md)

## Progress

| Task | Status | Started | Completed | Evidence |
|---|---|---|---|---|
| T0 Entry Gate | 🟡 Blocked（自動稽核完成；等待實機 Pointer Lock / 抬滑鼠 PoC） | 2026-09-08 | — | 見 §T0 automated audit（2026-09-08 13:39Z）。Baseline typecheck、Vitest、build 已跑；README §0 discovery 已覆驗；CodeGraph impact 已回填 README §0.2。R1/R2 需要真實瀏覽器 + 使用者滑鼠操作，本 session 無法替代，故 T0 不得標 done、T1～T4 不得開工。 |
| T1 Capture Contract | ✅ Completed（依使用者明確指示 override T0 gate；contract-only，不接線） | 2026-09-08 | 2026-09-08 14:31Z | `npm.cmd test -- src/data/mouseSampleArena.test.ts src/data/DataRecorder.test.ts src/data/export.test.ts src/data/exportPayloadSchema.test.ts src/data/metadata.test.ts` exit 0（182 passed）；`npm.cmd run typecheck` exit 0；`npm.cmd test` exit 0（244 files passed, 1 skipped；2561 passed, 2 skipped）；`npm.cmd run build` exit 0（既有 chunk-size warning）；60k `mouseSamples` JSON.stringify：567,316 bytes / p50 1.714 ms / p95 2.377 ms / max 2.546 ms；`rg -n "\bLOD\b" src tests scripts CONTEXT.md` exit 1（0 命中）。 |
| T2 Recorder Wiring | ⬜ Not started | — | — | — |
| T3 Time-Gap Primitive | ⬜ Not started | — | — | — |
| T4 Operator Visibility | ⬜ Not started | — | — | — |
| T-exit | ⬜ Not started | — | — | — |

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

## Surprises

1. **要偵測抬滑鼠所需的原始資料，這個專案其實一直都在收 —— 只是在進匯出前一步被丟掉。** [`InputSampler.ts:137-139`](../../../../../src/input/InputSampler.ts#L137-L139) 早在 WP-3（ADR-5，「1000 Hz 滑鼠下不遺失中間軌跡」）就用 `getCoalescedEvents()` 逐筆保留了 sub-frame 樣本與各自的 `event.timeStamp`；到了 [`SimLoop.ts:96-99`](../../../../../src/loop/SimLoop.ts#L96-L99) 才被 `accumulateMouse` 聚合成逐 tick 的 `dYaw`／`dPitch`。<br>⇒ 本 WP 的性質因此不是「新增一種量測」，而是**停止丟棄一份已經付過成本的資料**。這也解釋了為什麼 WP-57 的抬滑鼠標註只能做到「角速度停滯」—— 不是判準沒設計好，是它拿到的資料裡已經沒有那個資訊了。

2. **`performance_analysis` 的 LOD v1 偽陽，與 FPS 這邊實測到的偽陽是同一個。** PA 的 ADR-002 記載 v1 有兩個系統性偽陽：**「目標捕獲時的急停」**與**「目標中心附近的生理性顫抖」**。WP-57 §T5-real 實測合成期建議的 `100/15` 會把 44% 的「全程不抬滑鼠」對照 run 標成抬滑鼠，成因正是「寬鬆的 ω 門檻抓到的是拉槍中途的正常減速」。<br>⇒ 兩個專案在不同的訊號空間（px/s vs deg/s）、不同的實作語言、相隔半年，撞上同一個失效模式。PA 的解法（時間間隙當閘 + 非對稱門檻）因此不只是「一個可以參考的做法」，而是**對同一個已知病理的已驗證處置**。

3. **`performance_analysis` 沒有 LICENSE 檔 —— 但這次不是問題。** `go.mod` 與 `package.json` 也沒有 license 欄位。規劃期我把它開成 OQ-60.1 並設為 T3 的阻塞條件，理由是 GD-11 的存在正說明授權不能靠直覺。**使用者當日即回覆：兩個 repo 都是他寫的，無授權問題**（D-60.P7）。<br>⇒ 這條的價值不在結論（結論是「沒事」），而在**它讓一個原本要放棄的東西回來了**：PA 的十四個參數與 parity fixture 可以直接當起點。我在提問時已經先把「不複製原始碼」寫進建議處置，若使用者沒有主動澄清作者身分，這個計畫就會在一個不存在的限制下多繞一圈。<br>⇒ **教訓**：把外部依賴的授權開成 OQ 是對的，但**建議處置不該預設最保守的那一個** —— 保守選項若被照單全收，成本是沉默的（沒有人會發現本來可以不用重推參數）。應該把「若無授權問題則可以多做什麼」一併寫進 OQ，讓拍板者看得到兩邊的代價。

## Open Questions（追蹤用，權威定義見 [README.md](README.md) §1.5）

| ID | 狀態 | 待誰 | Deadline |
|---|---|---|---|
| OQ-60.1 移植 PA 方法學的授權狀態 | ✅ **已收斂 2026-09-08**：無授權問題（同一作者、同一組織）。R5 關閉、T3 解除阻塞、PA 參數與 fixture 可直接引用（D-60.P7）| — | — |
| OQ-60.2 序列化格式（columnar µs vs array-of-objects）| ✅ **T1 contract 凍結**：columnar + integer µs delta；60k `mouseSamples` block 567,316 bytes / p95 2.377 ms。R1 實測事件率仍屬 T0/T2 runtime gate，不改 T1 schema。 | Engineering | — |
| OQ-60.3 Pointer Lock 中斷如何入匯出 | ✅ **T1 contract 凍結**：additive `pointer_lock` DrillEvent（`{ type, locked, t }`），parser 已支援；T2/T3 負責接線與消歧。 | Engineering | — |
| OQ-60.4 新判準與 `deriveRepositioningSuspicion()` 的關係 | 🔴 開放 | 使用者 + 研究 | WP-61 T0（不阻塞 WP-60）|
| OQ-60.5 高輪詢率（4000／8000 Hz）是否支援 | ✅ **T1 contract 凍結**：預設容量 1000 Hz × drill seconds × 1.2 headroom；高輪詢率不預先支援，超出以 `meta.mouseSampling.overflow` 具名退化。R1 實測若顯示本專案常態 >1000 Hz，需另開決策升版。 | Engineering | — |
| OQ-60.6 是否同步進 `research/` Python 側 | 🟡 有建議值（本 WP 內不做）| Engineering | WP-61 |

## 規劃期未解的前提風險

⚠️ **R1 尚未驗證，且它是本 WP 的存亡條件。** 整份計畫建立在「`getCoalescedEvents()` 在 Pointer Lock 下真的回傳次幀樣本」這個假設上。repo 內的註解如此宣稱（`InputSampler.ts:125-127`，ADR-5／附錄 B），但**沒有任何實機證據**。T0 step 3 是唯一的驗證點，且設為 go/no-go 閘：**觀測事件率 < 500 Hz 即停止本 WP**。

這與 WP-57 的教訓同型（Surprises 17／18：「靜態覆核 + 端到端 run 綠」不等於「指標棧在真人資料上產得出值」，而所有 harness 都逐 tick 直接寫 `state.aim`，結構上不可能重現真實取樣問題）。**一個寫在註解裡的宣稱，不是證據。**
