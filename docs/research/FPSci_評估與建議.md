# 研究筆記 — NVlabs FPSci 與本專案之比較評估

> 撰寫日期：2026-07-07 · 撰寫視角：遊戲引擎架構
> 評估對象：[NVlabs/FPSci](https://github.com/NVlabs/FPSci)（FirstPersonScience，NVIDIA Research）
> 本專案基準：[PLAN.md](../PLAN.md)（階段 A）+ [CONTEXT.md](../../CONTEXT.md) + 規格書 ADR-1~9
> 結論先講：**FPSci 是本領域最強的 prior art，但不能取代本專案**——它沒有 Source 移動 physics（量不了 counter-strafe）、不能瀏覽器佈署、授權禁商用。本專案該做的是**借它的量測方法學與實驗管理設計**，而非借它的程式碼。

---

## 1. FPSci 是什麼

| 項目 | 內容 |
|---|---|
| 全名 | FirstPersonScience（FPSci） |
| 出處 | NVIDIA Research（NVlabs），SIGGRAPH 2022 tool paper〈FirstPersonScience: An Open Source Tool for Studying FPS Esports Aiming〉；另有 arXiv:2202.06429 |
| 定位 | FPS 瞄準行為的**受控使用者實驗平台**（psychophysics），主力用於 NVIDIA 的「延遲 vs 瞄準表現」系列研究（如 arXiv:2105.10498） |
| 引擎 / 語言 | C++，建立在 **G3D Innovation Engine** 上（繼承 `GApp`，覆寫 `oneFrame()` 重排 render loop 以壓低延遲） |
| 平台 | **Windows 10/11 原生應用**，VS2022 編譯；G3D 依賴需經 Subversion 取得 |
| 設定系統 | 階層式 `.Any` 檔（類 JSON）：`experimentconfig` / `userconfig` / `userstatus` / `systemconfig` / `weaponconfig`，支援 `#include()` 模組化；experiment → session → trial 三層結構 |
| 資料記錄 | **SQLite** 結果資料庫；frame-wise 記錄玩家狀態、目標軌跡、click 事件、每 frame 時序 |
| 延遲工具 | `frameDelay`（以整數 frame 注入人工延遲）、`frameRate` 鎖定/解鎖、`frameTimeArray` 自訂逐 frame 時序；整合 **LDAT-R** 硬體做 click-to-photon 實測（`PyLogger` 啟動外部量測） |
| 移動模型 | `moveRate` 等速移動 + jump/gravity；**無 acceleration / friction physics** |
| 其他 | 內建問卷系統（MultipleChoice / Rating / DropDown / Entry）、使用者 sensitivity/DPI 管理、武器參數化 |
| 授權 | **CC BY-NC-SA 4.0**（禁商用、衍生須同授權） |
| 延伸 | NVlabs 另有 [FPSWarpDemo](https://github.com/NVlabs/FPSWarpDemo)，建立在「Web FPSci」上的 late-warp demo——顯示 NVlabs 內部存在 web 移植的先例，可追蹤但非主線 |

---

## 2. 逐軸比較

| 軸 | FPSci | 本專案（階段 A） | 評註 |
|---|---|---|---|
| **研究定位** | 通用 FPS 瞄準實驗平台；核心變因是 render 延遲/幀率 | 專測 **counter-strafe**（急停時機 + 首發命中）的訓練器 | 互補而非重疊：FPSci 的自變因是系統延遲，本專案的自變因是玩家的急停行為 |
| **移動 physics** | 等速 `moveRate`，無 friction/accel，**無 counter-strafe 概念** | M1 立即停止（階段 A）→ Source friction+accel integrator（階段 B，`sv_friction` 5.2 / `sv_accelerate` 5.6 / 精準度門檻 ~88 u/s） | **本專案的核心差異化**。FPSci 根本量不了「急停」這件事 |
| **計時基礎** | 原生 QPC 級精度；render loop 自主可控 | `performance.now()` + cross-origin isolation（5 µs 解析度），`event.timeStamp` 同源可減（僅 Chromium） | 原生天生佔優；但本專案 5 µs 對 150–250 ms 級的反應時間量測已遠超所需 |
| **click-to-photon** | **LDAT-R 硬體實測**，端到端延遲有 ground truth | 無；browser compositor 之後的延遲不可觀測，只能以誤差界線陳述（規格 §15） | FPSci 明顯佔優，這是本專案效度論證最弱的一環（見建議 R2） |
| **決定性** | sim 與 render frame 綁定（刻意如此——幀率本身是實驗變因），**無決定性保證** | 128 Hz fixed-timestep + 三迴圈 `SharedState` 解耦，決定性是硬約束、有自動化測試把關（WP-2.4/9.3） | **本專案佔優**。同輸入可重播、可回歸測試，FPSci 的紀錄只能事後描述、不能重現 |
| **輸入採集** | 原生 raw input，OS 層無中介 | Pointer Lock + `unadjustedMovement` + `getCoalescedEvents()`（~1000 Hz），僅 Chromium | 原生佔優但差距有限；本專案的輸入時間戳鏈（`event.timeStamp` 同源）在 Chromium 上站得住 |
| **延遲操控** | `frameDelay` / `frameRate` / `frameTimeArray`，可把延遲當自變因做 psychophysics | 無（瀏覽器無法縮短 pipeline，也尚無注入機制） | FPSci 佔優；但注入式延遲本專案架構上可補（見建議 R5） |
| **實驗管理** | experiment/session/trial 三層 + user profile + 條件排序 + 問卷 + SQLite 多場次累積 | 單一 `DrillConfig` + JSON/CSV 單場匯出；無 subject/session 管理 | FPSci 明顯佔優，這是成熟研究工具與 prototype 的差距（見建議 R3） |
| **佈署 / 受試者取得** | Windows 執行檔，受試者須到場或安裝；G3D+SVN 建置門檻高 | **瀏覽器開網址即測**，零安裝；COOP/COEP 靜態主機即可 | **本專案佔優**，且是量級差異：遠端招募、大樣本、跨機器一致入口 |
| **渲染** | G3D（研究用引擎，社群小、文件少） | Three.js `WebGPURenderer` + WebGL2 fallback；生態龐大 | 本專案技術棧的長期可維護性佔優 |
| **資料格式** | SQLite（查詢方便、多場次累積） | preallocated arena → JSON/CSV（單場、防 GC 卡頓） | 各有所長；本專案的無 GC 設計對量測效度更關鍵 |
| **授權** | CC BY-NC-SA 4.0：**禁商用**，且 share-alike 具傳染性 | 自有程式碼 | **絕不可複製 FPSci 程式碼進本 repo**（會把整個專案拖進 NC-SA）；概念、schema 欄位語意、方法學可參考 |
| **維護狀態** | NVIDIA Research 支持，論文級可信度；issue/PR 持續但非產品級節奏 | 依 exec-plan 索引：階段 A（WP-0~9）已入 `completed/stage1`；階段 B（stage2，CS2 physics/recoil）與階段 C（stage3，場景/顯示管線）進行/規劃中 | — |

---

## 3. FPSci 的優點（本專案該正視的）

1. **端到端延遲有 ground truth**。LDAT-R 硬體 click-to-photon 實測，讓「量到的反應時間」與「玩家實際體感」之間的落差可以被校準。本專案目前只能對 compositor 之後的延遲做誤差界線陳述。
2. **實驗管理是完整的研究流水線**。session 排序、user profile（sensitivity/DPI）、條件平衡、問卷、SQLite 累積——一個受試者從進門到資料入庫不需要研究者手動接線。本專案目前只有單 drill 匯出。
3. **延遲/幀率可當自變因操作**。`frameDelay` 注入 + `frameTimeArray` 逐 frame 控制，是做 psychophysics 的正統手段。
4. **Schema 經過同儕審查與多篇論文使用**。frame-wise 玩家狀態 + 目標軌跡 + click 事件的記錄結構，是被驗證過的欄位設計，值得對齊以取得跨工具可比性。
5. **設定檔模組化成熟**。`experimentconfig` 與 `userconfig` 分離、`#include()` 重用，是「換實驗不改程式」的完成度更高版本（本專案 F4 的同一理念）。

## 4. FPSci 的缺點（本專案存在的理由）

1. **量不了 counter-strafe**。等速移動模型沒有 friction/accel，「反向鍵急停」在 FPSci 中無語意。本專案的 M1→階段 B Source physics 路線是 FPSci 沒有的能力。
2. **無決定性**。sim 綁 render frame，同輸入不可重播；本專案把決定性當硬約束（fixed-timestep + 邏輯 tick 域），能做回歸測試與逐 tick 稽核。
3. **佈署成本高**。Windows 原生 + G3D + SVN，受試者取得與跨實驗室重現的摩擦大；瀏覽器版零安裝是量級優勢。
4. **授權禁商用且具傳染性**（CC BY-NC-SA 4.0），亦非 OSI 認可的軟體授權；任何商業化路線都不能建立在它之上。
5. **G3D 生態孤島**。相對 Three.js/WebGPU 的社群與人才池，長期維護與擴充成本高。

---

## 5. 建議（actionable，映射到 WP）

| # | 建議 | 對應 | 優先 |
|---|---|---|---|
| **R1** | **匯出 schema 與 FPSci 對齊可比**：schema v2（WP-16 T1）設計時，對照 FPSci 的 SQLite 表（frame-wise 玩家狀態、目標位置、click 事件）做一張欄位對映表；語意相同的欄位沿用其命名慣例，讓兩工具的資料可以交叉分析、審稿人可對照。階段 A 的 `schema.md`（WP-7 T5 已交付）可在 v2 對帳時一併補上對映 | WP-16 T1 | 高 |
| **R2** | **做一次性 click-to-photon 硬體校準**：以 LDAT / 高速攝影（手機 240fps+）/ 光電二極體，量測本專案「mousedown → 螢幕像素變化」的端到端延遲分布，寫成 metadata 的系統性誤差界線。這是回應「瀏覽器計時效度」質疑最有力的證據，也是 FPSci 方法學的直接移植；與 WP-20 T3（frame-time log）互補——log 抓 render 端變異、硬體校準抓 compositor 之後的盲區 | WP-20 T3 / 階段 C 效度 | 高 |
| **R3** | **experiment 層採 FPSci 的三層分離**：FPSci 的 experiment→session→trial 對映到本專案是 experiment→session→**drill**，userconfig（sensitivity/DPI）與 experimentconfig 分離。WP-20 T4（session setup）實作時直接參考此結構與 `#include()` 式的 config 重用精神，避免多場次研究時重構 | WP-20 T4 | 中 |
| **R4** | **引用 FPSci 系列論文作為效度基準**：反應時間分布對照（150–250 ms）與延遲—表現關係，納入 FPSci 論文發表的數據作 baseline（分析端文件） | 分析端 / 階段 C | 中 |
| **R5** | **階段 B/C 選項——注入式延遲實驗**：本專案無法縮短瀏覽器 pipeline，但可以仿 `frameDelay` **加長**——render 端讀取落後 N tick 的 `RenderSnapshot`（alpha 內插基礎設施已在），即可把延遲當自變因研究「延遲對 counter-strafe 時序的影響」 | 階段 B/C 候選 | 低 |
| **R6** | **問卷模組（DOM overlay）**：若走向正式研究，pre/post 問卷（RSI、疲勞、既往 FPS 經驗）是效度要件；FPSci 內建此功能證明其必要性。純 DOM 實作與 D1 決策相容，可掛在 WP-20 T4 session setup 之後 | 階段 C+ | 低 |
| **R7** | **授權紅線**：FPSci 為 CC BY-NC-SA 4.0——**禁止複製其任何程式碼**進本 repo（share-alike 會傳染整個專案且禁商用）。允許：閱讀其文件/論文、參考 schema 欄位語意、複刻方法學。此條列入協議級約束 | 全域 | 高 |

**不建議採納**：G3D/原生移植（放棄瀏覽器佈署優勢）、SQLite 進瀏覽器（JSON/CSV + 分析端入庫已足夠,sql.js 反而引入 WASM 複雜度）、frame-coupled 迴圈（違反本專案決定性硬約束）。

> **採納對帳（2026-07-07 grill,權威：[DECISIONS.md](../exec-plan/DECISIONS.md) GD-11/GD-12）**：
> R1 ✅ 縮限採納（對映表入 WP-16 T1;**命名 CONTEXT.md 優先、既有欄位不改名**,可比性由對映表承擔）·
> R2 ❌ **不採納**（使用者拍板,與本文「高」評級相悖：接受 compositor 盲區為先天限制,審稿以誤差界線 + 受試者內對比 + frame-time log 回應）·
> R3 ✅ 縮限採納（三層術語正名入 CONTEXT §A + `participantId`/`sessionLabel` 入 WP-20 T4;不建流水線/userstatus）·
> R4 ✅ 採納（pilot 分析文件引 baseline,WP-22 T3 起）·
> R5 ⏸ backlog（觸發：延遲 × counter-strafe 成為研究問題;RenderSnapshot 縫已在,晚做不變貴）·
> R6 ⏸ backlog（觸發：WP-22 T2 pilot protocol 題組定案;複用 T4 表單模式）·
> R7 ✅ → GD-11 + CLAUDE.md §4 硬約束。

---

## 6. 定位總結

FPSci 與本專案在「量測方法學」上是師承關係、在「研究問題」上是互補關係:

- FPSci 回答「**系統**（延遲/幀率）如何影響瞄準」——需要原生 render loop 控制與硬體量測。
- 本專案回答「**玩家**（急停時機/首發紀律）的技能如何量化」——需要 Source 移動 physics、決定性重播、與零門檻佈署。

本專案不需要也不應該變成 FPSci；該做的是把 R1（schema 對映 → WP-16）、R2（click-to-photon 校準 → WP-20/階段 C）、R7（授權紅線 → 全域）落進當前 exec-plan，讓量測效度論證站在 FPSci 已鋪好的方法學肩膀上。

---

## 參考資料

- [NVlabs/FPSci（GitHub）](https://github.com/NVlabs/FPSci) · [README](https://github.com/NVlabs/FPSci/blob/master/README.md) · [general_config 文件](https://github.com/NVlabs/FPSci/blob/master/docs/general_config.md)
- [FirstPersonScience 專頁（NVIDIA Research）](https://research.nvidia.com/node/4856)
- [FirstPersonScience: An Open Source Tool for Studying FPS Esports Aiming（SIGGRAPH 2022）](https://research.nvidia.com/publication/2022-08_firstpersonscience-open-source-tool-studying-fps-esports-aiming)
- [FirstPersonScience: Quantifying Psychophysics for First Person Shooter Tasks（arXiv:2202.06429）](https://arxiv.org/pdf/2202.06429)
- [A Case Study of First Person Aiming at Low Latency for Esports（arXiv:2105.10498）](https://arxiv.org/pdf/2105.10498)
- [NVlabs/FPSWarpDemo — Web FPSci late-warp demo](https://github.com/NVlabs/FPSWarpDemo)
