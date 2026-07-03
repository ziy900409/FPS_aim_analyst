# WP-8 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: ✅ T0 Entry gate 完成；可開始 T1

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-03）— M3 達成；8 指標對照 + OQ-8.1~8.5 全鎖定 |
| T1 指標計算 | ⬜ 待執行 |
| T2 結果頁 | ⬜ 待執行 |
| T3 即時 HUD | ⬜ 待執行 |
| T4 控制 | ⬜ 待執行 |
| T5 Exit gate | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-8.1 指標來源 | ✅ 鎖定（T0 預檢） | 用 WP-7 `DataRecorder.snapshot()`；統計來源與 JSON/CSV 匯出同源。 |
| OQ-8.2 過衝定義 | ✅ 鎖定（T0 預檢） | 階段 A 不顯示連續 u/s；以 velocity 軌跡判定速度過零後是否反向，結果頁分類呈現。 |
| OQ-8.3 HUD 即時值 | ✅ 鎖定（T0 預檢） | 分數（擊殺數）、計時、命中率、velocity 停止/移動狀態。 |
| OQ-8.4 結果頁圖表 | ✅ 鎖定（T0 預檢） | 數值卡 + 反應時間分布小圖；進階圖表延後。 |
| OQ-8.5 準心資料契約 | ✅ 鎖定（T0） | 採 DECISIONS GD-4 的 **B + C2**：`fire` 事件補 `targetId` + `offsetDeg` 作為準心對齊偏移 canonical 來源；per-tick `crosshair` 改為 `aim:{yaw,pitch}` / `ticks.aim`。 |

---

## Log

### 2026-07-03 — T0 Entry gate ✅ PASS（可開始 T1）
- **STOP 解除**：WP-7 T6 已宣告 **M3**（頂層索引 WP-7 ✅），並經實機端到端驗證（22,219 ticks / 37 visible·21 counter·39 fire，`meta` 齊全、`suspect: false`）。先前阻塞（M3 未宣告）消除。
- **新增前置 OQ-8.5**：M3 實測證實 `ticks[].crosshair` 恆 `[0,0]`（[DECISIONS GD-4](../../DECISIONS.md)）。依 CONTEXT:22，準心恆置中、純裝飾，「準心對齊偏移」為 fire-event 量。使用者拍板 **B + C2**：(B) `fire` 事件補 `targetId`+`offsetDeg`（準心對齊偏移 canonical 來源，修下方對照表缺口）；(C2) per-tick `crosshair` 改記 camera 朝向 `aim:{yaw,pitch}`（plumbing 守 ADR-2：CameraController 經 input 寫 SharedState、sim 只讀）。契約與落地細節見 [T0-entry-gate.md](T0-entry-gate.md) OQ-8.5。
- **對指標的影響**：下方對照表「準心對齊偏移」輸入由 `ticks.crosshair`（無效）改為 `fire.offsetDeg`；逐 tick 瞄準軌跡改讀 `ticks.aim`。T1 依此實作記錄端 B+C2 改動並更新 `schema.md` + 規格附錄 C。
- **Gate result**：T0 PASS。OQ-8.1~8.5 已鎖定，WP-8 可開始 T1；T1 第一個實作切片需先落地 OQ-8.5 / GD-4 資料契約，再進入 8 指標純函式。

### 2026-07-03 — T0 Entry gate 預檢 ⛔ STOP（WP-7 M3 未宣告）
- **Gate result**：不得宣告 T0 PASS。WP-5 已完成（M2，`SharedState.player.stopped` / `vx` 可用；fire event 記 `hit` / `firstShot` / `residualSpeed`），WP-6 已完成（`loadDrill()` / `DrillRunner.restart()` 可用），但 WP-7 `progress.md` 與頂層索引仍標示 **T6 exit gate 待執行 / M3 未宣告**。T0 DoD 明定「M3 達成，否則 STOP」，因此 T1 不得開始。
- **WP-7 可用但未 gate**：`DataRecorder.snapshot()` 回傳 `{ticks,events,recorderOverflow}`；`buildExportPayload(meta,snapshot)` 以同一 snapshot 組 JSON/CSV；`docs/operational/schema.md` 已文件化 root `{meta,ticks,events}` 與 CSV 欄位。缺口是 WP-7 T6 尚未做完整 drill 端到端匯出驗收並更新 M3。
- **§5 八指標輸入/公式對照（供 T1 使用，待 M3 後重跑 gate）**：

| 指標 | snapshot 欄位 | 公式 / 階段 A 解讀 | 備註 |
|---|---|---|---|
| 急停反應時間 | `events: visible(targetId,t)` + `counter(key,t)` | `t_counter - t_visible` | 需以 peek/target 順序配對 visible 後第一個 counter。 |
| 速度歸零誤差 | `fire.residualSpeed` + 鄰近 `ticks.vx/vz` | 階段 A 分類：已停止 / 移動中，不呈現連續 u/s | CONTEXT 明定立即停止下為二元精度維度。 |
| 停火時序對齊 | `counter.t` + `fire.t`（首發） | 階段 A：`t_fire - t_counter` | `t_velocity_zero` 塌縮成 `t_counter`。 |
| 首發命中率 | `fire.firstShot`, `fire.hit` | `firstShot && hit` / `firstShot` | 分母用首發事件數，避免補槍稀釋。 |
| 準心對齊偏移 | `fire.offsetDeg`（T1 依 OQ-8.5 補） | 開火事件點的 camera 正向射線與目標中心角距離 | `ticks.crosshair` 已知無效；逐 tick 瞄準軌跡改為 `ticks.aim`。 |
| 切換時間 | hit `fire.t` + `fire.targetId` + 下一 acquisition | `t_next_acquisition - t_prev_kill` | `t_prev_kill` 由 hit fire 取得；下一 acquisition 以 OQ-8.5 補足的 target 歸屬與 aim/offset 契約定義。 |
| 節奏穩定度 | `visible.t`, 首發 `fire.t`, hit `fire.t` | 循環時長 SD / CV；保留 `visible→kill` 與首發間隔兩錨 | CONTEXT 要求兩個錨都可記。 |
| 左右對稱性 | target/peek side + reaction/hit stats | 左/右分組後比較反應時間與命中率 | 目前事件只有 `targetId`，side 需由 target id 序列/DrillConfig alternation 還原；T1 需固定此契約。 |

- **OQ 鎖定**：OQ-8.1~8.4 已由 CONTEXT、WP-8 README 與 schema 對齊（見 ledger）。鎖定不等於 T0 PASS；PASS 仍等待 M3。
- **Next**：先執行 WP-7 `T6-exit-gate.md` 宣告 M3；完成後重跑 WP-8 T0，把本預檢轉為 PASS，再開始 T1。

### （規劃）— WP-8 計畫產出
- 依 PLAN WP-8（8.1–8.4）+ 規格 §5（8 指標）+ §14（受試者內相對值）展開為 T0–T5。
- 核心：指標純機械計算、與匯出**同一 snapshot 來源**（確保統計=匯出，WP-9 交叉驗證）；HUD 不污染量測。
- **Next**：確認 M3 後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
