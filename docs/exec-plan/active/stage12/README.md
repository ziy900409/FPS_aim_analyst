# 階段 L（stage12）— Micro-flick 場景 + Spider Shot 大幅度拉槍 + Session Program 排程器

> **狀態：🟡 active。** WP-56（micro-flick 三靶測試場景）**✅ T-exit 交付 2026-09-07**；WP-57（Spider Shot 大幅度拉槍）與 WP-58（Session Program 排程器）皆已完成規劃、未開工。
>
> 三個 WP 互不相依。WP-56／WP-57 各交付一個 researcher-only 的測試場景與 drill；WP-58 交付排程層，讓研究者能把任意 drill（含前兩者的產物）編成有序的測試 program。

| | |
|---|---|
| **WP-56 目標** | 依參考影片交付灰白狹長走廊 micro-flick 場景：玩家位置固定、場上恆維持最多三顆球形目標、命中後最遲下一個 sim tick 補位 |
| **WP-56 交付定位** | practice／researcher-only；不進正式 participant protocol、不改研究指標定義、不做槍枝/手臂 view model |
| **WP-56 狀態** | ✅ **T-exit 交付 2026-09-07**：T0／T1（2026-09-04）+ T2～T6／T-exit（2026-09-07）。T6 遺留的兩個 T5 E2E rerun 失敗經 T-exit 診斷為測試前提缺陷（非 production 缺陷、與 WP-57 無關），已修正並全綠 |
| **WP-57 目標** | Spider Shot 大幅度拉槍：寬場 arena + 中心↔貼近水平 FOV 極限的周邊目標交替，周邊 yaw 於 arm 時由 FOV／aspect 解析並凍結 |
| **WP-57 交付定位** | practice／researcher-only；不改 `spider-shot-v1`／`v2` 參數、不晉升 Assessment、不進 history／compatibility cohort |
| **WP-57 狀態** | ⬜ 規劃完成（2026-09-07），T0 未開始 |
| **WP-58 目標** | Session Plan 從「四家族固定排程」升級為「可自由編排的 drill program」：選 drill、設 reps、設 drill／家族兩級休息秒數 |
| **WP-58 交付定位** | 純排程層；不新增 drill、不改任何 `DrillConfig`、不改 sim／命中／指標語意。frozen「標準 Assessment」路徑逐位不變 |
| **WP-58 狀態** | ⬜ 規劃完成（2026-09-07），未開工 |
| **里程碑** | 尚未指派。下一個可用編號為 **M22**（M20／M21 已由 stage11 的 WP-54／WP-55 取用）。三個 WP 目前各以 T-exit gate 為交付判定 |

---

## 1. WP 索引

| WP | 子資料夾 | 目標 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|
| **WP-56** | [`wp-56-micro-flick-test-scene/`](wp-56-micro-flick-test-scene/README.md) | Micro flick 三靶測試場景（走廊 + 固定玩家 + 三靶 lifecycle + 命中補位） | — | 8.5–15.5 | ✅ T0～T6 + T-exit（2026-09-07） |
| **WP-57** | [`wp-57-spider-shot-wide-flick/`](wp-57-spider-shot-wide-flick/README.md) | Spider Shot 大幅度拉槍（eye-frame 幾何 + 寬場 arena + arm-time FOV 解析） | 參照 WP-56 的 `playerControl.translation` seam | 9.5–16 | ⬜ 規劃完成 |
| **WP-58** | [`wp-58-session-program-scheduler/`](wp-58-session-program-scheduler/README.md) | Session Program 排程器（drill 清單 + reps + 兩級休息 + 編譯預覽 + 稽核 metadata） | 無 | 7.5–12.5 | ⬜ 規劃完成 |

## 2. 相依關係

```
WP-56（micro-flick 場景／drill）──┬── WP-57 參照其 translation seam 先例（非硬相依）
                                   │
WP-57（spider shot wide flick）────┤
                                   │
WP-58（session program 排程器）────┘   三者可並行
```

WP-58 的 drill→family 對照表會把 stage12 產出的新 drill 登記為可排程；但依 WP-58 FR-58.3，家族歸屬**不授予** Assessment 資格，WP-56／WP-57 的 practice-only 定位不受影響。若 WP-56／WP-57 在 WP-58 T1 之後才確定 drill id，T1 的對照表需回頭同步。

## 3. 編號分配（GD-15「先採納先得」）

| 資源 | WP-56 | WP-57 | WP-58 | 下一個可用 |
|---|---|---|---|---|
| WP 編號 | 56 | 57 | 58 | 59 |
| 全域決策 | — | GD-32 | GD-33 | GD-34 |
| 里程碑 | 未指派 | 未指派 | 未指派 | M22 |

> WP-57 與 WP-58 於 2026-09-07 同日在兩個平行 session 中規劃，一度都暫用 WP-57／GD-32。WP-57（spider shot）資料夾先建立，依 GD-15「先採納先得」保留 WP-57／GD-32；session program 排程器順延重編為 **WP-58／GD-33**。

## 4. 階段層文件

- Task 狀態總表：[task-checklist.md](task-checklist.md)
- 進度與決策紀錄：[progress.md](progress.md)
- 全域決策帳本：[../../DECISIONS.md](../../DECISIONS.md)
- 上層索引：[../../README.md](../../README.md)（stage12 段落待補；見 [progress.md](progress.md) 的 Open Items）
