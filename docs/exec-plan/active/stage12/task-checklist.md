# 階段 L（stage12）— Task Checklist

> 階段索引：[README.md](README.md) · 進度紀錄：[progress.md](progress.md)
>
> 本表只追蹤 WP 層狀態；各 task 的細項見該 WP 自己的 `task-checklist.md`。

## WP-56 — Micro Flick Three-Target Test Scene

明細：[wp-56-micro-flick-test-scene/task-checklist.md](wp-56-micro-flick-test-scene/task-checklist.md)

| Done | Task |
|---|---|
| ✅ | T0 Entry gate（2026-09-04） |
| ✅ | T1 Contract and fixtures（2026-09-04） |
| ✅ | T2 Three-target lifecycle（2026-09-07） |
| ✅ | T3 Corridor scene and presentation（2026-09-07） |
| ✅ | T4 Fixed player hit and HUD（2026-09-07） |
| ⬜ | T5 Automated integration and performance |
| ⬜ | T6 Visual acceptance |
| ⬜ | T-exit |

## WP-57 — Spider Shot Wide Flick

明細：[wp-57-spider-shot-wide-flick/task-checklist.md](wp-57-spider-shot-wide-flick/task-checklist.md)

| Done | Task |
|---|---|
| ⬜ | T0 Entry gate／幾何 PoC／GD-32 |
| ⬜ | T1 Config 契約／eye-frame 投影／resolver |
| ⬜ | T2 TargetManager 分支／分層佇列／決定性 |
| ⬜ | T3 寬場 arena 與幾何斷言 |
| ⬜ | T4 匯出 provenance 與 `side` 欄位 |
| ⬜ | T5 抬滑鼠疑慮標註與敏感度表 |
| ⬜ | T6 Arm-time 接線與實機 E2E |
| ⬜ | T-exit |

## WP-58 — Session Program Scheduler

明細：[wp-58-session-program-scheduler/task-checklist.md](wp-58-session-program-scheduler/task-checklist.md)

| Done | Task |
|---|---|
| ✅ | T0 Entry gate／排程層現況稽核／決策凍結（**GD-35**，非 GD-33） |
| ✅ | T1 Drill ↔ Family 雙向單一來源 |
| ✅ | T2 Session Program 純函式編譯器 |
| ✅ | T3 SessionRunner 游標化／runtime 接線 |
| ✅ | T4 Session Plan 表單改版／程式預覽 |
| ✅ | T5 Metadata 稽核欄位／逐輪匯出／cohort 隔離 |
| ✅ | T6 E2E 整合／回歸對帳 |
| ✅ | T-exit（2026-09-09 交付；OQ-58.6／58.7 兩個 blocker 已落地） |

## WP-59 — Micro Flick v8 Replacement Spacing

明細：[wp-59-micro-flick-v8-replacement-spacing/README.md](wp-59-micro-flick-v8-replacement-spacing/README.md#-task-breakdown)

| Done | Task |
|---|---|
| ⬜ | T0 Reproduction and parameter freeze |
| ⬜ | T1 Additive contract |
| ⬜ | T2 Temporal sampler |
| ⬜ | T3 V8 integration |
| ⬜ | T4 Full-system evidence |
| ⬜ | T-exit |

## 階段層 Definition of Done

- [ ] 四個 WP 的 T-exit gate 皆通過並有客觀證據。
- [ ] `docs/exec-plan/README.md` §2 已加入 stage12 段落與四個 WP 的狀態列。
- [ ] stage12 的里程碑歸屬已由 owner 決定（指派 M22 或明示不設里程碑）。
- [ ] WP-57 的 **GD-32**、WP-58 的 **GD-35** 與 WP-59 的全域決策皆已入 [DECISIONS.md](../../DECISIONS.md)，且編號無衝突。<br>**已更正（2026-09-09，WP-58 T-exit）**：本行原寫 WP-58=GD-33／WP-59=GD-34，兩個號碼皆已被別的工作取用（`GD-33` → WP-57 T3、`GD-34` → KI-026），WP-58 T0 實際入帳為 **GD-35**（已完成）；WP-59 的號碼待其 T0 於**寫入當下**重查最大值後決定。
- [x] 若 stage12 新增的 drill 要進 WP-58 的排程清單，drill id 已與 WP-58 T1 的對照表對帳。**已完成**：WP-56 的 `micro_flick_three_target_test_v1`～`_v8` → 家族 `micro-flick`、WP-57 的 `spider-shot-wide-v1` → 家族 `spider-shot-wide`，皆自 drill 模組匯出的常數建表（非手打字面值），並由 `drillFamily.test.ts` 的不變量 2 對 `main.ts` roster 逐一對帳。
