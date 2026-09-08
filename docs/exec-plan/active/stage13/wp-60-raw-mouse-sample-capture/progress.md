# WP-60 — progress.md

> 主規格：[README.md](README.md) · 清單：[task-checklist.md](task-checklist.md)

## Progress

| Task | Status | Started | Completed | Evidence |
|---|---|---|---|---|
| T0 Entry Gate | ⬜ Not started | — | — | — |
| T1 Capture Contract | ⬜ Not started | — | — | — |
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

## Surprises

1. **要偵測抬滑鼠所需的原始資料，這個專案其實一直都在收 —— 只是在進匯出前一步被丟掉。** [`InputSampler.ts:137-139`](../../../../../src/input/InputSampler.ts#L137-L139) 早在 WP-3（ADR-5，「1000 Hz 滑鼠下不遺失中間軌跡」）就用 `getCoalescedEvents()` 逐筆保留了 sub-frame 樣本與各自的 `event.timeStamp`；到了 [`SimLoop.ts:96-99`](../../../../../src/loop/SimLoop.ts#L96-L99) 才被 `accumulateMouse` 聚合成逐 tick 的 `dYaw`／`dPitch`。<br>⇒ 本 WP 的性質因此不是「新增一種量測」，而是**停止丟棄一份已經付過成本的資料**。這也解釋了為什麼 WP-57 的抬滑鼠標註只能做到「角速度停滯」—— 不是判準沒設計好，是它拿到的資料裡已經沒有那個資訊了。

2. **`performance_analysis` 的 LOD v1 偽陽，與 FPS 這邊實測到的偽陽是同一個。** PA 的 ADR-002 記載 v1 有兩個系統性偽陽：**「目標捕獲時的急停」**與**「目標中心附近的生理性顫抖」**。WP-57 §T5-real 實測合成期建議的 `100/15` 會把 44% 的「全程不抬滑鼠」對照 run 標成抬滑鼠，成因正是「寬鬆的 ω 門檻抓到的是拉槍中途的正常減速」。<br>⇒ 兩個專案在不同的訊號空間（px/s vs deg/s）、不同的實作語言、相隔半年，撞上同一個失效模式。PA 的解法（時間間隙當閘 + 非對稱門檻）因此不只是「一個可以參考的做法」，而是**對同一個已知病理的已驗證處置**。

3. **`performance_analysis` 沒有 LICENSE 檔。** `go.mod` 與 `package.json` 也沒有 license 欄位。兩個 repo 同屬 BenQ、同一個作者，直覺上不會有問題 —— 但 GD-11 的存在正是因為「授權」不能靠直覺（那條是為了 FPSci 的 CC BY-NC-SA 而立）。「未宣告授權」在法律上不等於「公有領域」。<br>⇒ 開 OQ-60.1 交使用者拍板，並設為 T3 的阻塞條件。建議的處置與 GD-11 同構：**移植方法學與參數語意，不複製任何原始碼**。

## Open Questions（追蹤用，權威定義見 [README.md](README.md) §1.5）

| ID | 狀態 | 待誰 | Deadline |
|---|---|---|---|
| OQ-60.1 移植 PA 方法學的授權狀態 | 🔴 開放 | **使用者** | T0 exit（**阻塞 T3**）|
| OQ-60.2 序列化格式（columnar µs vs array-of-objects）| 🟡 有建議值（columnar µs），待 T0 實測體積佐證 | Engineering | T1 開工前 |
| OQ-60.3 Pointer Lock 中斷如何入匯出 | 🟡 有建議值（additive `pointer_lock` DrillEvent）| Engineering + 使用者 | T1 凍結前 |
| OQ-60.4 新判準與 `deriveRepositioningSuspicion()` 的關係 | 🔴 開放 | 使用者 + 研究 | WP-61 T0（不阻塞 WP-60）|
| OQ-60.5 高輪詢率（4000／8000 Hz）是否支援 | 🟡 有建議值（不支援但偵測並具名）| 使用者 | T1 |
| OQ-60.6 是否同步進 `research/` Python 側 | 🟡 有建議值（本 WP 內不做）| Engineering | WP-61 |

## 規劃期未解的前提風險

⚠️ **R1 尚未驗證，且它是本 WP 的存亡條件。** 整份計畫建立在「`getCoalescedEvents()` 在 Pointer Lock 下真的回傳次幀樣本」這個假設上。repo 內的註解如此宣稱（`InputSampler.ts:125-127`，ADR-5／附錄 B），但**沒有任何實機證據**。T0 step 3 是唯一的驗證點，且設為 go/no-go 閘：**觀測事件率 < 500 Hz 即停止本 WP**。

這與 WP-57 的教訓同型（Surprises 17／18：「靜態覆核 + 端到端 run 綠」不等於「指標棧在真人資料上產得出值」，而所有 harness 都逐 tick 直接寫 `state.aim`，結構上不可能重現真實取樣問題）。**一個寫在註解裡的宣稱，不是證據。**
