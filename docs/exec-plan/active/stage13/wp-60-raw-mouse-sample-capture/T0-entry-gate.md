# WP-60 T0 — Entry Gate／取樣充分性稽核／實機 PoC

## Objective

在寫任何 production code 之前，**實機證明原始取樣真的存在且足以偵測抬滑鼠**。本 WP 建立在三個未經驗證的假設上（README §1.4），其中 R1 若不成立，整個 WP 的前提崩塌。T0 未通過不得開始 T1～T4。

## Inputs to read

- [README.md](README.md) §0 discovery 十四條（**逐條覆驗**，檔案可能已被平行 session 動過）、§1.4 假設、§3.1 R1/R2。
- `src/input/InputSampler.ts`、`src/input/PointerLock.ts`、`src/input/consume.ts`、`src/loop/SimLoop.ts`、`src/data/DataRecorder.ts`、`src/data/RingBuffer.ts`。
- `performance_analysis`：`docs/architecture/adr/002_lod_v3_design.md`、`contracts/modules/input/lod_v3_default_config.json`、`backend/modules/input/infrastructure/lodclean/service.go`（**只讀不抄**，見 step 7）。
- WP-57 progress §T5-real（既有抬滑鼠標註的極限）、[KI-031](../../../../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md)。

## Steps

1. 記錄 HEAD、`git status --short`、CodeGraph pending 與 baseline `typecheck`／全量 Vitest／`vite build`；**不處理** worktree 內平行 session 的既存改動。
2. 逐條覆驗 README §0 的十四項 discovery，對不上的**更正 README 而非沿用**。對 `ExportPayload`、`DataRecorder`、`SimLoop` 跑 CodeGraph impact，把實測 caller 數填回 §0.1。
3. **R1 go/no-go（本 task 最重要的一步）**：在真實瀏覽器 + Pointer Lock 下量測 `getCoalescedEvents()` 的實際回傳筆數與 `event.timeStamp` 間距。輸出：事件率直方圖、`dt` 的 p50/p95/p99、以及「每個 rAF 幀回傳幾筆」的分布。**觀測事件率 < 500 Hz 即停止本 WP 並回報**。
4. **R2 抬起／停頓的空洞分布**：使用者實機在 `spider-shot-wide-v1` 上做三組各 ≥ 10 次 —— ①刻意抬起滑鼠、②手不離開滑鼠但停住、③一次到位不停。量測每組的事件空洞長度分布。**這是 WP-61 判準的分離軸依據**，也是本 WP 唯一無法用合成資料取代的證據。
5. **NFR-60.4／60.5 體積與精度 PoC**：以 step 3 的實測事件率推算 60 s run 的樣本數，對 columnar 與 array-of-objects 兩種格式各產生一份真實大小的樣本並量測 `JSON.stringify` 後的 bytes 與耗時。量化 µs 取整對 `dt` 的誤差。→ 收斂 **OQ-60.2**。
6. **F6 熱路徑 PoC**：throwaway 版本的逐筆錄製掛在消費點，量測「開／關」兩組的 frame-time p50/p95/p99 與掉 tick 數。
7. ~~OQ-60.1 授權拍板~~ ✅ **已於 2026-09-08 收斂**（D-60.P7：同一作者、同一組織，無授權問題）。本步改為**取用**：把 PA 的 `lod_v3_default_config.json` 十四個參數與其語意抄錄進 `progress.md` 作為 WP-61 的推導起點，並記下哪些是 px/s 空間、需要重推。
8. 收斂 **OQ-60.2／60.3／60.5**；OQ-60.4／60.6 可維持開放（不阻塞本 WP，但須標 owner／deadline）。
9. 清除只位於已驗證 temp root（session scratchpad）的 PoC artifacts，把**指令與量測數字**寫入 [progress.md](progress.md)。

## Required audit artifact

| 量 | 方法 | 門檻 | 實測 |
|---|---|---|---|
| 觀測事件率（Hz）| step 3 直方圖 | **≥ 500 Hz**（否則停止）| ✅ **1005 Hz**（瞬時 = 1/dt p50）／971 Hz（run 平均）|
| `dt` p50 / p95 / p99（µs）| step 3 | p50 ≈ 1000 µs（1000 Hz 滑鼠）| ✅ **995 / 1660 / 2235**（run B）；1000 / 1550 / 3890（run A）|
| 每 rAF 幀的 coalesced 筆數 | step 3 | ~~> 1（否則 R1 成立）~~ **指標定義有誤，見下方 §R1 註**| ⚠️ p50 **1**、p95 1、mean **1.020**、max 5 —— 但 R1 **通過**（機制不是 coalescing，是逐筆派發）|
| 抬起的空洞長度 p10/p50/p90（ms）| step 4 ① | 與 ② 可分離 | **BLOCKED**（需使用者實機三組操作）|
| 停頓的空洞長度 p10/p50/p90（ms）| step 4 ② | 與 ① 可分離 | **BLOCKED** |
| 一次到位的最長空洞（ms）| step 4 ③ | 應遠小於 ①| 🟡 **部分**：連續移動期間上限 **18.2 ms**（剔除取鎖起始靜止段 151.3 ms）；非 drill 協定下的正式量測 |
| 60 s columnar 序列化（bytes / ms）| step 5 | **≤ 1.0 MB**（NFR-60.4）| ✅ 593,031 bytes / 1.311 ms（synthetic 60k）⇒ **9.46 bytes/sample**；以實測 1005 Hz 推算 60 s ≈ **571 KB** |
| 60 s array-of-objects（bytes）| step 5 | 對照組 | 2,158,328 bytes / 6.167 ms（synthetic 60k）|
| µs 取整誤差（µs）| step 5 | **≤ 10**（NFR-60.5）| ✅ max 0.369（synthetic round-trip）|
| frame p95 開 vs 關（ms）| step 6 | 差值 ≤ 0.5 ms 且無新增掉 tick | 🟡 **部分**：node 側 per-tick sim cost Δp95 −0.0044 ～ +0.0007 ms（符號在四次重複間翻轉 ⇒ 小於噪音）；**瀏覽器 frame log 仍 BLOCKED** |

### §R1 註 — 指標③的定義錯誤（2026-09-09 實機發現）

指標③「每 rAF 幀的 coalesced 筆數 > 1」建立在一個**實機不成立的前提**上：以為 Chromium 會把幀內多筆硬體樣本**打包**成一個 rAF 對齊的 `pointermove`，其餘放在 `getCoalescedEvents()`。實測相反 —— **`pointermove` 逐筆硬體取樣派發**：clean run 中 10,762 個 `pointermove` ÷ 10.79 s ≈ **997 events/s**，遠高於任何顯示更新率（階段 A 上限 240 Hz），故 coalescing 幾乎是 no-op（mean 1.020）。

指標③的**目的**是「證明瀏覽器沒把次幀樣本丟掉」。該目的已由 ①② 直接滿足（dt p50 = 995 µs、10,475 個間隔），只是走了另一條路。⇒ **R1 gate 通過**；門檻敘述應改為「事件派發率 ≫ 顯示更新率**或** coalesced p50 > 1，二者其一即可」。

⚠️ 連帶更正：`InputSampler.ts:125-127` 與 ADR-5／附錄 B 對機制的描述（「以 `getCoalescedEvents()` 取回瀏覽器在單一 rAF 幀內合併的次幀樣本」）**對結果正確、對機制不準**。但 `max: 5` 顯示**幀變慢時 coalescing 確實會啟動**，故該呼叫仍為必要（拿掉會在卡頓時丟樣本）—— **程式碼不需修改**，需修正的是註解與 ADR 對機制的敘述。

## Invariants

- **production code diff = 0**。所有 PoC 走 throwaway script／temp 檔，T0 結束時刪除。
- 不修改任何既有測試的期望值。
- PoC 產生的真人資料**不進 repo**（沿用 D-57.T5-8 的同一紀律）；只把統計量寫進 `progress.md`。
- 引用 `performance_analysis` 的參數／fixture 時**記名來源與版本**（D-60.P7 的稽核要求）——授權雖無問題，但「這個數字從哪來」仍必須可追。

## Definition of Done

- [ ] baseline 三項（typecheck ×2／全量 Vitest／`vite build`）exit 0 且記錄實際數字；既有 failure 若有，證明為既存而非本 WP 引入。
- [ ] README §0 十四條逐條覆驗完成，不符者已更正；§0.1 blast radius 填入 CodeGraph 實測 caller 數。
- [ ] **R1 閘**：實機量到的事件率與每幀 coalesced 筆數寫入上表；若 < 500 Hz，本 WP 標為 blocked 並停止（這也是一個合格的 T0 結論）。
- [ ] **R2 分布表**：三組實機操作各 ≥ 10 次，空洞長度分布寫入 `progress.md`，並明確回答「抬起與停頓在空洞長度上分不分得開」。
- [ ] OQ-60.2 收斂：兩種序列化格式的實測 bytes 與耗時並列，格式選定並寫入 Decision Log。
- [ ] OQ-60.3 收斂：Pointer Lock 中斷的入匯出方式選定。
- [ ] OQ-60.5 收斂：容量常數與溢位行為選定。
- [ ] PA 的十四個 LOD 參數與語意抄錄進 `progress.md`，並標明哪些在 px/s 空間需要重推（供 WP-61）。
- [ ] F6 熱路徑 PoC 的「開／關」兩組 frame-time 數字並列，差值符合上表門檻。
- [ ] PoC artifacts 已刪除（`git status --short` 無殘留）；所有數字可由 `progress.md` 記載的指令重算。

## Commit

```text
docs(stage13): complete WP-60 raw sampling entry gate
```
