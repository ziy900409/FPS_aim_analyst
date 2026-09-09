# WP-61 — progress.md

> Running log。Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## 最新狀態

**🟡 規劃完成，尚未開工。** T0 未過不得開 T1～T4。

**2026-09-09：四個使用者決策已收斂**（D-61.U1～U4）⇒ **T1 的兩個阻塞項（OQ-61.1／61.2）已解除，T2 的硬體阻塞（OQ-61.5）已解除**。

開工前置：
- ① WP-60 T-exit 的四項 handoff —— ①②③ ✅；**④ OQ-60.4 構念歸屬 ✅ 已由 D-61.U1 補上**（WP-60 T-exit 的最後一個未勾項可據此翻 ✅）。
- ② 高刷真人標註 cohort —— **仍不存在**。硬體已就緒（240 Hz），但錄製需要 T1 的儀器先落地，且錄製本身屬使用者。
- ③ 剩餘阻塞只剩 **T0 本身**（評估契約 pre-registration、構念命名落地、兩個顯示更新率門檻的依據補註）。

## Progress

- **2026-09-09**：依 `engineering-planning` skill 完成 repository-grounded 規劃。盤點 `KEY_CODE` 封閉集、`applyInput` 的 key 分支、`TickRecord.keys` 四 bit 遮罩、`mouseSampleGaps.ts` 的中性原語、`deriveRepositioningSuspicion()` 的既有構念語意、`research/` 的 C-D1／C-D2 邊界與 WP-60 的 R1／R2／TF1／TF2 實機基線；**尚未修改任何 production code**。
- **2026-09-09**：把工作拆為 T0～T4 + T-exit（T4 條件式）。相對 2026-09-09 的範圍草案（本 WP `README.md` 的前一版，四切片 T0／T1／T2／T-exit；`git log -- README.md` 可回溯）新增一個 **T1「標註通道儀器」** —— 草案把「保存獨立的抬起／落下標註」寫成 T0 的資料要求，但 repo 內**沒有任何機制**能產生那種標註（`KEY_CODE` 是四鍵封閉集、`DrillEvent` 無標註型別）。見 D-61.P2。

## Decision Log

| ID | Date | Decision | Owner | Evidence |
|---|---|---|---|---|
| **D-61.P1** | 2026-09-09 | **本 WP 為 WP-61，全域決策預留 GD-37，無獨立里程碑**（T-exit gate 即交付判定；下一個可用里程碑為 M22）。⚠️ 依 [GD-35](../../../DECISIONS.md) ② 的紀律，`GD-37` **視為佔位符** —— 入帳當下必須重新查最大值（GD-32／33／34／35／36 已各撞過一次，本專案平行 session 為常態）。 | 規劃 | [`../README.md`](../README.md) §3；`DECISIONS.md` 現行最高 = GD-36 |
| **D-61.P2** | 2026-09-09 | **在草案的四切片之外新增 T1「標註通道儀器」，且它排在 cohort 錄製之前。**<br>理由：草案 T0 要求「保存獨立的抬起／落下、停住／恢復時間標註，標註不可由空洞反推」，但 repo 內**不存在**能產生這種標註的機制 —— `KEY_CODE` 是 `{KeyA,KeyD,KeyW,KeyS}` 的封閉集（非集合內的鍵整筆不入 ring），`DrillEvent` union 也無標註型別。⇒ 沒有 T1，T0 的資料要求在物理上無法滿足。<br>**連帶價值**：這正是 D-60.T2-1 的同一模式 —— 被 gate 阻塞時，先問「這個 task 的產出能不能變成解 gate 的儀器」。T1 可在 cohort 尚未錄製時獨立驗收。<br>**Alternatives considered**：(a) 沿用 R2 的「每組 10 次」block 指示當標籤 —— R2 的具名限制②已判定「無逐次時間標註，九個長空洞不能當九次成功偵測」，駁回；(b) 外部影片 + 事後對齊 —— 跨時鐘域，repo 無支援，且對齊誤差不可稽核，駁回；(c) 把標註做進 UI 按鈕 —— 需離開 Pointer Lock，會製造與抬滑鼠同形的空洞（FR-60.6），**自相矛盾**，駁回。 | 規劃 | README §0 discovery ⑦⑧⑨；[`src/state/types.ts:45`](../../../../../src/state/types.ts#L45)；WP-60 progress §T0 R2 限制② |
| **D-61.P3** | 2026-09-09 | **標註鍵擴充既有 `KEY_CODE` 封閉集，而非另開一條輸入通道。**<br>理由：`applyInput` 的 key 分支只對 `KeyD`／`KeyA` 有作用，`KeyW`／`KeyS` 今天就是「被採集但 sim 不消費」；`TickRecord.keys` 是由 `state.held` 推導的固定四 bit 遮罩。⇒ 第五個 code 對 sim 的 inert **是結構性的**，決定性斷言是**覆核**它而非**維持**它。另開通道要動 ring 的 `type,t,a,b` 槽位語意，成本與風險都高得多。<br>**Alternatives considered**：(a) 新增第五種 ring event type —— 動固定佈局的核心表示法，駁回；(b) 用既有 `KeyW`／`KeyS` 兼作標註 —— 語意重載，且 WASD 在其他 drill 會被真正使用，駁回。 | 規劃 | README §0 discovery ⑦⑧⑨；§2.5 |
| **D-61.P4** | 2026-09-09 | **Stage 1 切段不在 Python 側重寫**：由 TS `segmentByTimeGap()` 產出 committed golden JSON，`research/` 只讀不算。<br>理由：C-D1 允許 `research/` 讀 committed golden；若 Python 另寫一套切段，T3 的結果就無法歸因（差異來自特徵還是來自切段？），且形同對一個已凍結的原語建立第二定義。<br>**Alternatives considered**：(a) Python 重寫切段並以 parity 對表 —— 那是 C-D5 的成本，而原語尚未晉升，過早，駁回；(b) 把整個分析搬進 TS —— 探索期需要繪圖與統計，TS 側沒有那個工具鏈，駁回。 | 規劃 | README §2.1／OQ-61.4／F7；[`research/README.md`](../../../../../research/README.md) |
| **D-61.P5** | 2026-09-09 | **T2／T3 只做 Python 單側實作，C-D5 刻意留到 T4 才觸發。**<br>理由：同 OQ-60.6 —— C-D5 的雙實作對表紀律只綁**晉升指標**；本 WP 在 T3 判定之前沒有任何晉升指標。過早雙實作會讓每次改判準都要兩端同步 + 升版，成本遠大於收益。<br>**Alternatives considered**：(a) 一開始就雙實作 —— 探索期參數會反覆變動，每次都要重跑 golden，駁回；(b) 永遠只做 Python —— 判準若晉升就必須進 `src/metrics/` 供離線推導使用，屆時 C-D5 是硬性要求，駁回。 | 規劃 | README §2b C-D5 列；OQ-61.4 |
| **D-61.P6** | 2026-09-09 | **評估契約必須在 T0 pre-register，事後只能升版不得改值。**<br>理由：GD-20 的既有紀律（xcorr 的 reliability gate 門檻於 WP-31 T0 pre-register 凍結，事後不得調整）。本 WP 的資料量小、特徵維度高，是「調門檻直到指標好看」風險最高的形態；[`../README.md`](../README.md) 也已明文禁止「用本輪最大值調出剛好分開的門檻」。<br>**Alternatives considered**：(a) 先看分布再定門檻 —— 那就是 GD-20 要防的事，駁回；(b) 只 pre-register 指標不 pre-register 門檻 —— 門檻才是判定的所在，駁回。 | 規劃 | [`DECISIONS.md`](../../../DECISIONS.md) GD-20；README §2.4 |
| **D-61.P7** | 2026-09-09 | **負面結論（「不可靠分離」／「證據不足」）為一級交付物，其驗收嚴格度與「通過」相同。**<br>理由：D-60.R2-1 已在空洞長度軸上得到負面結論，且 §1.4 的物理論證顯示 lift 與 pause 在本硬體上都產生「零樣本」區間 ⇒ 分不開是**最可能的單一結果**。若只為「通過」寫 DoD，這個 WP 在最可能的路徑上會沒有交付定義。C-D3／GD-20 的立場一致：寧可少一個指標，不能有一個會說錯話的指標。 | 規劃 | README §3.1 R3／§5；`DECISIONS.md` GD-20 |
| **D-61.U1** | 2026-09-09 | **OQ-61.1（＝ WP-60 交不出來的第四項 handoff）收斂：兩個構念並存但語意分離。**<br>既有 `deriveRepositioningSuspicion()` 維持「角速度停滯（repositioning suspicion）」語意**一行不改**；新構念為「**感測器離地（sensor lift）**」，用不同名稱、不同型別、不同模組。兩者於 `CONTEXT.md` 分開定義並**互相指名**（差異：訊號來源＝ 128 Hz tick 聚合 ω vs 事件級取樣空洞；時間粒度＝ 7.8125 ms vs ~1 ms；可回答的問題不同）。<br>⇒ C-D4 的守線方式確立：禁的是「同一構念兩套定義」，本案是「兩個不同構念」，故雙向命名掃描（新模組零 `reposition`／`suspicion`；舊模組零 `sensorLift`）即為充分證據。<br>**Alternatives considered**：(b) 新的取代舊的 —— 用一個未驗證的取代一個已校準的，順序反了，駁回；(c) 本輪不建構念名只出研究結論 —— 使用者未選，但仍是 T3 判定為非 `promote` 時的實際落點（T4 不執行）。 | 使用者 | 使用者回覆（2026-09-09）；README §1.5 OQ-61.1 |
| **D-61.U2** | 2026-09-09 | **OQ-61.2 收斂：自報鍵為主 + block 設計為冗餘。**<br>受測者本人按標註鍵；block 設計（「本 run 每個 trial 都抬」）提供 trial 級冗餘標籤，用來稽核漏按。不引入第二人標註、不引入外部硬體。<br>⚠️ **隨此決定生效的宣稱界線（必須進 §Pre-registration）**：反應時間 ≈ 200 ms 與 WP-57 量到的 lift 事件 180–225 ms **同量級** ⇒ 自報鍵可支撐**事件級匹配**（「哪一個空洞是抬滑鼠」），**不可**支撐**起點精度**宣稱（「抬滑鼠從第幾毫秒開始」）。T3／T-exit 不得作後者的宣稱；匹配容差的設計以此為前提。<br>**Alternatives considered**：(b) 第二人標註 —— 一樣是反應時間，不會更準，卻多一個人與一台裝置，駁回；(c) 兩者都收 —— 錄製負擔加倍，且不一致時要另訂仲裁規則，駁回；(d) 客觀量測（高速攝影／外部感測器）—— 跨時鐘域對齊，成本遠大於本 WP 規模，列為 F3 判定「自報通道不可用」時的升級路徑。 | 使用者 | 使用者回覆（2026-09-09）；README §1.5 OQ-61.2／§3.2 |
| **D-61.U3** | 2026-09-09 | **OQ-61.5 收斂：cohort 一律錄在 240 Hz 顯示器；`meta.displayHz === 240` 為逐份可用性條件。**<br>硬體：使用者有 60 Hz 與 **240 Hz** 兩台，選 240 Hz。<br>⚠️ **規劃期把「≥ 120」與「≥ 144」誤判為文件矛盾，實際上不是** —— 兩者回答不同問題，**兩個都對**：<br>　• **≥ 120 Hz** ＝ 資格閘地板，依 `PERF_FLOOR_MS = 8.33`（[`src/display/constants.ts:13`](../../../../../src/display/constants.ts#L13)）與 [`spider-wide-recording-spec.md`](../../../../operational/spider-wide-recording-spec.md) §2.1；管的是 `meta.suspect` 是否被 frame floor 判紅。<br>　• **≥ 144 Hz** ＝ KI-031 完全緩解點，依 [KI-031](../../../../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) §2「失效邊界」：零樣本比例 ≈ `1 − f/128`，`f ≥ 128 Hz`（144 Hz 顯示）幾乎無零樣本；**`f ≈ 120 Hz` 仍約 6% 零樣本 ⇒ 偶發漏檢**；60 Hz 為懸崖。管的是 `deriveDetectionMetrics()` 會不會靜默失效。<br>⇒ `../README.md` §4 與 `docs/exec-plan/README.md` §2 的「≥ 144 Hz」**有依據，不得改寫為 120**。正確處置是**兩個門檻並列並各自標明依據**，而非統一成一個數字。**240 Hz 同時滿足兩者**，故本決定不受影響。<br>**連帶**：F1（硬體不存在）**關閉**；R1 由 High 降為 **Med**（殘餘風險只剩錄製時間與品質）。原「60 Hz 降級路徑」不再需要。<br>**新增硬性條件**：**禁止混合顯示更新率** —— `meta.displayHz` 不等於 240 即作廢該 run（T2 逐份覆核）。顯示更新率同時改變 aim 更新率與 `suspect`，是顯性 confound；既有 WP-57／WP-60 的 60 Hz 真人資料**不得**併入本 cohort。 | 使用者 | 使用者回覆（2026-09-09）；`src/display/constants.ts:13`；`src/data/metadata.ts:154`；KI-031 §2 |
| **D-61.U4** | 2026-09-09 | **OQ-61.6 收斂：n = 1 的宣稱上限為「本操作者 × 本硬體 × 本 drill 條件下成立」，一律 `research_only`，不得進教練報告（C-D3／GD-20）。**<br>⇒ **T4 的「`src/` 內零 importer」不是暫時措施，而是本 WP 的終局狀態** —— 即使 T3 判 `promote`、T4 交付判準，也不會有任何教練報告端的消費者。這與 `deriveRepositioningSuspicion()` 的既有處置一致（同樣零 importer、同樣品質標註定位）。T-exit 的 A-61.20 據此驗收。<br>跨人泛化需另立 WP 與另一批 cohort。 | 使用者 | 使用者回覆（2026-09-09）；README §1.5 OQ-61.6；`DECISIONS.md` GD-20 |

## Surprises

1. **我把兩個各自有依據的門檻當成「文件矛盾」，差點把對的數字改掉。**（2026-09-09，規劃期）
   規劃時看到 `spider-wide-recording-spec.md` §2.1 寫 ≥ 120 Hz、stage13 README §4 與 exec-plan README 寫 ≥ 144 Hz，直接判為不一致，並向使用者陳述「144 是未經稽核的數字」，建議統一為 120。**這個陳述是錯的** —— 讀 [KI-031](../../../../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) §2「失效邊界」之後才發現 144 有精確依據：零樣本比例 ≈ `1 − f/128`，`f ≥ 128 Hz`（144 Hz 顯示）幾乎無零樣本，而 **`f ≈ 120 Hz` 仍約 6% 零樣本 ⇒ 偶發漏檢**。兩個數字管的是不同的事（資格閘地板 vs detection 判準的連續性），**兩個都對**。
   ⇒ 若沒有回頭讀 KI-031，這一輪會把一個有依據的門檻降級成一個較寬的門檻，而且是以「消除矛盾」的名義做的 —— 那比留著矛盾更糟，因為它會看起來已經解決了。
   ⇒ **教訓**：兩份文件對同一個量給不同數字時，第一個假設不該是「其中一個錯」，而是「它們可能在量不同的東西」。判定為矛盾之前，必須先找到**兩邊各自的依據**；找不到依據的那一個才是候選。本例中兩邊的依據都在 repo 裡（`constants.ts` 與 KI-031 §2），只是沒被一起讀。
   ⇒ 與 WP-60 Surprises 9 同型：那次是 fixture 從**閾值**倒推而非從**真實資料的形狀**倒推；這次是矛盾判定從**數字不同**出發而非從**依據**出發。都是「跳過來源直接看表面」。

## Open Questions（狀態）

| ID | 狀態 | Owner | Deadline |
|---|---|---|---|
| **OQ-61.1**（= OQ-60.4）構念歸屬：取代還是並存？各叫什麼？ | ✅ **已收斂 2026-09-09** —— 並存但語意分離；新構念 = **感測器離地（sensor lift）**（D-61.U1）。T0 只需落成型別／檔名與 `CONTEXT.md` 草稿 | ~~使用者 + 研究~~ | ~~T0 exit~~ |
| **OQ-61.2** 標註通道形式：自報鍵／第二人／兩者 | ✅ **已收斂 2026-09-09** —— 自報鍵 + block 冗餘（D-61.U2）。⚠️ 附帶宣稱界線：支撐事件級匹配、**不**支撐起點精度 | ~~使用者~~ | ~~T0 exit~~ |
| **OQ-61.3** 標註鍵 code | 🔴 開放。recommended default = `KeyL` | Engineering | T1 凍結前 |
| **OQ-61.4** 實作落點與 C-D5 觸發時機 | 🔴 開放。recommended default = Python 探索 → T4 條件式 TS 晉升（見 D-61.P4／P5） | Engineering | T0 exit |
| **OQ-61.5** 硬體與門檻 | ✅ **已收斂 2026-09-09** —— cohort 錄在 **240 Hz**，逐份條件 `meta.displayHz === 240`，禁止混合更新率（D-61.U3）。⚠️ 120／144 **不是矛盾**：120 = 資格閘地板、144 = KI-031 完全緩解點，兩者並存；**T0 只補依據、不改數字** | ~~使用者~~ | ~~T0 exit~~ |
| **OQ-61.6** n = 1 時的宣稱上限 | ✅ **已收斂 2026-09-09** —— 本操作者 × 本硬體 × 本 drill，一律 `research_only`；T4 零 importer 為終局狀態（D-61.U4） | ~~使用者 + 研究~~ | ~~T0 exit~~ |
| **OQ-61.7** `gapThresholdMs` 最終值 | 🔴 開放。**T0 刻意不凍結**，以 18／30／50 ms sweep 進 T3 | Engineering | T4 |
| **OQ-60.7**（承自 WP-60）長 drill 匯出體積政策 | 🔴 開放，**不阻塞本 WP**（協定限制單 run ≤ 120 s） | 使用者 + Engineering | 首次出現 > 200 s 的 `?rawMouse=1` run |

## 上游 handoff 覆核（WP-60 → WP-61）

| # | 交付物 | 狀態 | 本 WP 的用途 |
|---|---|---|---|
| 1 | 實機事件率分布 | ✅ p50 995 µs／≈1005 Hz；連續移動空洞上限 **18.2 ms**（n = 11，prior 非校準值） | θ sweep 的下界依據 |
| 2 | 抬起／停頓／一次到位的空洞長度分布 | ✅ **且結論為負面**（D-60.R2-1：範圍重疊） | T3 Layer 1 baseline 的預期值；四項具名限制是本 WP 設計要擋掉的東西 |
| 3 | PA 十四參數與語意抄本 | ✅ 含三個 px/s 空間參數的「需重推」標註 | T3 Layer 3／4 的換算起點（FR-61.10 記名） |
| 4 | OQ-60.4 構念歸屬結論 | ✅ **已於 2026-09-09 由使用者拍板**（D-61.U1：並存；新構念 = 感測器離地／sensor lift） | T1 的事件命名依據；T0 step 4 落成型別名與 `CONTEXT.md` 草稿。⚠️ WP-60 T-exit DoD 的「WP-61 handoff 四項齊備」未勾項可據此翻 ✅ |
| — | 高刷真人標註 cohort | 🟡 **硬體已就緒（240 Hz，D-61.U3）；資料仍不存在** | T1 交付儀器後由使用者錄製（T2）。`meta.displayHz ≠ 240` 即作廢，禁止與 60 Hz 混批 |
