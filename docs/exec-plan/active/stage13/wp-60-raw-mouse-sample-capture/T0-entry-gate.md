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
| 觀測事件率（Hz）| step 3 直方圖 | **≥ 500 Hz**（否則停止）| |
| `dt` p50 / p95 / p99（µs）| step 3 | p50 ≈ 1000 µs（1000 Hz 滑鼠）| |
| 每 rAF 幀的 coalesced 筆數 | step 3 | > 1（否則 R1 成立）| |
| 抬起的空洞長度 p10/p50/p90（ms）| step 4 ① | 與 ② 可分離 | |
| 停頓的空洞長度 p10/p50/p90（ms）| step 4 ② | 與 ① 可分離 | |
| 一次到位的最長空洞（ms）| step 4 ③ | 應遠小於 ①| |
| 60 s columnar 序列化（bytes / ms）| step 5 | **≤ 1.0 MB**（NFR-60.4）| |
| 60 s array-of-objects（bytes）| step 5 | 對照組 | |
| µs 取整誤差（µs）| step 5 | **≤ 10**（NFR-60.5）| |
| frame p95 開 vs 關（ms）| step 6 | 差值 ≤ 0.5 ms 且無新增掉 tick | |

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
