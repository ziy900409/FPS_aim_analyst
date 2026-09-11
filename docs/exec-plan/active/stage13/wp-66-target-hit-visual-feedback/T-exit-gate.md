# WP-66 T-exit — 驗收閘（A-66.1～A-66.12）與 GD-42 入帳

> 交付判定 = 本閘。本 WP **無獨立里程碑**（承 stage13 其餘 WP 慣例）。

## Objective

以**逐條具名證據**宣告 WP-66 交付。每一項的證據必須是**指令 + 輸出**、**檔名 + 案例名**，或**實機截圖／數值**——「已完成」「運作正常」一律不合格。

## 驗收清單

| # | 驗收項 | 證據形式 | 來源 Task |
|---|---|---|---|
| **A-66.1** | 命中環形格由 sim 唯寫、render 唯讀，且**不新增任何命中判定** | `git diff` 顯示 `HitDetector`／`ballisticRaycast`／`targetAabb`／`sweptHitTest` 零修改；`SimLoop` 的新增行數 = 2 | T1 |
| **A-66.2** | 六條「不得寫入」反證全綠（脫靶／occlusion／速度閘／逾射程／`accurate=0`／無存活目標） | 檔名 + 案例名 + `vitest` exit 0 | T1 |
| **A-66.3** | 環形格跨 ≥ 4 種 render FPS 逐位一致 | `wp66-hit-ring-determinism.test.ts` 案例名 + 通過輸出 | T1 |
| **A-66.4** | 命中態跟身分走、不跟 pool 槽位走 | FM-2 槽位洩漏專測案例名 + 通過輸出 | T2 |
| **A-66.5** | render 對 `SharedState` 零寫入 | FM-4 專測（`sync()` 前後 ring 全欄位 `Object.is`）案例名 | T2 |
| **A-66.6** | 未啟用時**逐位不變** | ① FM-1 材質三屬性斷言 ② `meta`／`meta.targets` 鍵集合與 T0 基線逐字相同 ③ 未涉 `meta` 鍵面的 golden fixture 零變動 | T2 · T3 · T4 |
| **A-66.7** | 四個 wiring 點全部到位 | `grep -n "targetView" src/main.ts` 完整輸出 + 逐行標記；e2e「換 drill／換場景後仍生效」兩條斷言 | T3 · T5 |
| **A-66.8** | metadata 為 additive、跨語言可讀 | 帶新鍵 payload 的 TS parse 綠 + Python `load_export()` 零修改可讀 + `git diff research/` 為空 | T3 |
| **A-66.9** | 啟用清單**逐字等於** T0 收斂結果，且不含任何 formal assessment 協定 | `progress.md §T0` 與 `§T4` 的清單並列比對；`protocolVersion` 零變更的 `git diff` | T4 |
| **A-66.10** | 效度斷代已成明帳 | `progress.md §T4` + [stage13 README](../README.md) WP-66 列 + GD-42 D-66-4 三處同一句摘要 | T4 |
| **A-66.11** | 命中回饋零洩漏進資料層／指標層 | `tests/regression/wp66-hit-feedback-isolation.test.ts` 案例名 + 通過輸出 | T5 |
| **A-66.12** | 效能無退步 | A/B frame-time p95 增量 ≤ 0.2 ms、over-budget window 不增、首次命中幀無尖峰、draw call 相同——四個數值 | T5 |

## 最終 gate（全部必須 exit 0，通過數逐項記錄）

- [ ] `npm run typecheck` ×2
- [ ] `npx vitest run`（passed 數 ≥ T0 基線；差額逐條說明）
- [ ] `npx vitest run tests/regression`（變動的 fixture 逐筆具名說明，其餘零修改）
- [ ] `npx playwright test --workers=1`（passed 數 ≥ T0 基線，`0 failed`）
- [ ] `npm run build`

## 收尾

1. **GD-42 入帳**：把 `progress.md` 的草稿 D-66-1～D-66-6 補上實際結果後，寫入 [DECISIONS.md](../../../DECISIONS.md)（**入帳前重查當下最大 GD**；被取用則順延、不爭號）。
2. **翻狀態**：
   - [task-checklist.md](task-checklist.md) 全部 Done box 翻 ✅。
   - [stage13 README §2](../README.md) 的 WP-66 列翻 ✅ + 具名證據摘要；§3 補「WP-66 / GD-42 編號與落點偏離」條目。
   - [`docs/exec-plan/README.md §2`](../../../README.md) 的 stage13 表補／翻 WP-66 列。
   > ⚠️ 這兩份索引是多 session 共編檔。撞到同一行衝突時**只 stage 自己那幾行**，不要整檔覆蓋。
3. **交接**：把「replay 同步」（技術債 §3.2 第一列）與其觸發條件寫成一句話，留在 `progress.md` 的 Open Questions 供後續 WP 取用。

## Commit

```text
docs(wp-66): T-exit acceptance for target hit visual feedback
```
