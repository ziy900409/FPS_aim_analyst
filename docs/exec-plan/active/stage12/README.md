# 階段 L（stage12）— Micro-flick、Spider Shot、Session Program 與 v8 替補間距

> **狀態：🟡 active。** WP-56（micro-flick 三靶測試場景）**✅ T-exit 交付 2026-09-07**；WP-57（Spider Shot 大幅度拉槍）**✅ T-exit 交付 2026-09-08**；WP-58（Session Program 排程器）**T0～T5 ✅ 2026-09-08、T6 ✅ 2026-09-09**，T-exit 未開工；WP-59（Micro Flick v8 替補間距）已完成規劃、未開工。
>
> WP-56／WP-57 各交付一個 researcher-only 的測試場景與 drill；WP-58 交付排程層；WP-59 依賴 WP-56 的 population seam，修正固定狹窄生成區下的 v8 替補位置品質。

| | |
|---|---|
| **WP-56 目標** | 依參考影片交付灰白狹長走廊 micro-flick 場景：玩家位置固定、場上恆維持最多三顆球形目標、命中後最遲下一個 sim tick 補位 |
| **WP-56 交付定位** | practice／researcher-only；不進正式 participant protocol、不改研究指標定義、不做槍枝/手臂 view model |
| **WP-56 狀態** | ✅ **T-exit 交付 2026-09-07**：T0／T1（2026-09-04）+ T2～T6／T-exit（2026-09-07）。T6 遺留的兩個 T5 E2E rerun 失敗經 T-exit 診斷為測試前提缺陷（非 production 缺陷、與 WP-57 無關），已修正並全綠 |
| **WP-57 目標** | Spider Shot 大幅度拉槍：寬場 arena + 中心↔貼近水平 FOV 極限的周邊目標交替，周邊 yaw 於 arm 時由 FOV／aspect 解析並凍結 |
| **WP-57 交付定位** | practice／researcher-only；不改 `spider-shot-v1`／`v2` 參數、不晉升 Assessment、不進 history／compatibility cohort |
| **WP-57 狀態** | ✅ **T-exit 交付 2026-09-08**：T0～T4 ✅（2026-09-07）+ T6 ✅ + T5 ✅ + T-exit ✅（2026-09-08；T5 排在 T6 之後執行，兩者無相依）。A-57.1～12 全綠（含四個 blocking 條件）、boundary scans 綠、build／兩個 typecheck／全量 Vitest exit 0。⚠️ **NFR-57.8 的全量 Playwright／`test:ci` 兩子句未 exit 0**，唯一成因為既存的 [KI-027](../../../known_issue/KI-027-overlay-layering-researcher-submenu-guard-dead.md)（非本 WP）；另新立 [KI-030](../../../known_issue/KI-030-history-e2e-flaky-under-parallel-workers.md)（全量 Playwright 多 worker 下不可重現，以 `--workers=1` 的 90 passed／1 failed 為門檻讀數）。OQ-57.5（抬滑鼠門檻）**維持開放**：repo 內無真人 wide-flick 匯出，敏感度表建在合成 cohort 上。OQ-57.7 已由 KI-026／BD-026／[GD-32](../../DECISIONS.md) 拍板為選項 (b) 並落地，T4 的匯出 round-trip 即以 eye-frame 為期望值（實測 `W_deg` 恆為設計值 2.0°）。T6 已交付 arm-time 接線 + 4 個 Edge E2E + FOV 60／75／120 實機截圖（D-57.T3-3 結案），並收斂 OQ-57.3（維持 `kLo`／`screenMargin`）與部分收斂 OQ-57.4（`timeLimitMs` 90000 → **60000**；timeout 率仍待真人 run） |
| **WP-58 目標** | Session Plan 從「四家族固定排程」升級為「可自由編排的 drill program」：選 drill、設 reps、設 drill／家族兩級休息秒數 |
| **WP-58 交付定位** | 純排程層；不新增 drill、不改任何 `DrillConfig`、不改 sim／命中／指標語意。frozen「標準 Assessment」路徑逐位不變 |
| **WP-58 狀態** | 🟡 **T0～T5 ✅（2026-09-08）／T6 ✅（2026-09-09）**，T-exit 未開工。T0 凍結 36 個 exact drillId 的歸屬表（**4 個新家族**：`tracking`／`detection`／`micro-flick`／`spider-shot-wide`）、收斂 OQ-58.1／58.2／58.4、入帳 [GD-35](../../DECISIONS.md)；T1 `drillFamily.ts` 雙向單一來源；T2 `compileSessionProgram()` 純函式編譯器；T3 `SessionRunner` 游標化（frozen／custom 兩軌共用同一 runtime）；T4 表單新增自訂 program 軌與編譯器驅動的預覽表；T5 匯出 metadata 加 5 個 additive 稽核欄位 + custom run 排除於 frozen trend cohort；T6 端到端整合（3 條真實瀏覽器 live run）與全量回歸對帳。全量 Vitest **2,661 passed／2 skipped**、全量 Playwright **99 passed** exit 0。⚠️ T6 發現 **OQ-58.6**（frozen 軌 `tracking` 家族開場即中止）建議列為 T-exit blocker |
| **WP-59 目標** | 在不擴大 v8 yaw／pitch／distance 生成區的前提下，降低擊殺後替補目標貼近原位置而可原地再射的機率 |
| **WP-59 交付定位** | practice-only v8 參數與通用 optional spawn policy；其他 drills 的 config/RNG/trace 不變 |
| **WP-59 狀態** | ⬜ 規劃完成（2026-09-08），未開工 |
| **里程碑** | 尚未指派。下一個可用編號為 **M22**（M20／M21 已由 stage11 的 WP-54／WP-55 取用）。四個 WP 目前各以 T-exit gate 為交付判定 |

---

## 1. WP 索引

| WP | 子資料夾 | 目標 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|
| **WP-56** | [`wp-56-micro-flick-test-scene/`](wp-56-micro-flick-test-scene/README.md) | Micro flick 三靶測試場景（走廊 + 固定玩家 + 三靶 lifecycle + 命中補位） | — | 8.5–15.5 | ✅ T0～T6 + T-exit（2026-09-07） |
| **WP-57** | [`wp-57-spider-shot-wide-flick/`](wp-57-spider-shot-wide-flick/README.md) | Spider Shot 大幅度拉槍（eye-frame 幾何 + 寬場 arena + arm-time FOV 解析） | 參照 WP-56 的 `playerControl.translation` seam | 9.5–16 | ✅ **T-exit 交付 2026-09-08** |
| **WP-58** | [`wp-58-session-program-scheduler/`](wp-58-session-program-scheduler/README.md) | Session Program 排程器（drill 清單 + reps + 兩級休息 + 編譯預覽 + 稽核 metadata） | 無 | 7.5–12.5 | 🟡 T0～T5 ✅（2026-09-08）／T6 ✅（2026-09-09） |
| **WP-59** | [`wp-59-micro-flick-v8-replacement-spacing/`](wp-59-micro-flick-v8-replacement-spacing/README.md) | v8 時序替補間距（固定生成區 + bounded candidate ranking + deterministic fallback） | WP-56 | 3.5–6 | ⬜ 規劃完成 |

## 2. 相依關係

```
WP-56（micro-flick 場景／drill）──┬──► WP-59（v8 替補間距）
                                  │
                                  └──── WP-57 參照 translation seam 先例（非硬相依）

WP-58（session program 排程器）──────── 無硬相依，可與 WP-57／WP-59 並行
```

WP-58 的 drill→family 對照表會把 stage12 產出的新 drill 登記為可排程；但依 WP-58 FR-58.3，家族歸屬**不授予** Assessment 資格，WP-56／WP-57 的 practice-only 定位不受影響。若 WP-56／WP-57 在 WP-58 T1 之後才確定 drill id，T1 的對照表需回頭同步。**T0 已把兩者登記進凍結表**：WP-56 的 `micro_flick_three_target_test_v1`～`_v8` → 新家族 `micro-flick`；WP-57 的 `spider-shot-wide-v1` → 新家族 `spider-shot-wide`（**獨立家族**，非併入 `spider-shot`）。兩者 `mode` 皆非 `assessment`、皆未登記於 `DrillMetricRegistry` ⇒ practice-only 定位確認不受影響。

WP-59 只依賴 WP-56 已交付的 `TargetManager` population／replacement seam；它不依賴 WP-57 或 WP-58，也不擴大 v8 場景或生成範圍。

## 3. 編號分配（GD-15「先採納先得」）

| 資源 | WP-56 | WP-57 | WP-58 | WP-59 | 下一個可用 |
|---|---|---|---|---|---|
| WP 編號 | 56 | 57 | 58 | 59 | 60 |
| 全域決策 | — | GD-32 | GD-33 | GD-34（T0 proposed） | GD-35 |
| 里程碑 | 未指派 | 未指派 | 未指派 | 未指派 | M22 |

> WP-57 與 WP-58 於 2026-09-07 同日在兩個平行 session 中規劃，一度都暫用 WP-57／GD-32。WP-57（spider shot）資料夾先建立，依 GD-15「先採納先得」保留 WP-57／GD-32；session program 排程器順延重編為 **WP-58／~~GD-33~~ GD-35**。<br>⚠️ **二次碰撞（2026-09-08，WP-58 T0）**：`GD-33` 隨後又被 WP-57 T3 取用、`GD-34` 被 KI-026 取用 ⇒ WP-58 的全域決策最終入帳為 **[GD-35](../../DECISIONS.md)**。**紀律**：`GD-n` 編號必須在**寫入當下**重查最大值，不得沿用規劃文件寫定的號碼。

## 4. 階段層文件

- Task 狀態總表：[task-checklist.md](task-checklist.md)
- 進度與決策紀錄：[progress.md](progress.md)
- 全域決策帳本：[../../DECISIONS.md](../../DECISIONS.md)
- 上層索引：[../../README.md](../../README.md)（stage12 段落待補；見 [progress.md](progress.md) 的 Open Items）
