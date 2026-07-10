# T0 — Entry gate(上游驗證 + OQ-S5-4 拍板 + hitbox 現況基線)

> Part of [WP-23 longrange-tracking](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | 上游:WP-18 exit ✅ + M10 ✅(驗證非執行) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [CLAUDE.md](../../../../../CLAUDE.md) §4 候選 + [../README.md §8](../README.md)(OQ 回填) |
| **狀態** | ⬜ |

## Objective

動 hitbox 三處常數之前先鎖:上游交付狀態、現況消費點清單(零破壞閘的參照)、
遠距 drill 的角參數矩陣、hitbox 單一來源落點。

## In scope

- **上游驗證**:[WP-18 T-exit](../../../completed/stage2/wp-18-f5-subtick/T-exit-gate.md) ✅(motion/sub-tick 內插/追蹤指標)
  與 [WP-22 T-exit](../../../completed/stage3/wp-22-perception-integration/T-exit-gate.md)(M10)✅ 證據引用記 progress。
- **現況基線**:hitbox `{1,2,1}` 全部消費點讀碼盤點(已知三處:`src/sim/TargetManager.ts:57`、
  `src/scene/clearance.ts:8`(含 `TARGET_HITBOX_RADIUS_U`/`PROP_INFLATION_U` 派生)、
  `src/metrics/trackingDerivation.ts` `DEFAULT_OPTIONS`;另盤點 `HitDetector`/`TargetView` 的幾何來源);
  T1 零破壞閘沿用的既有決定性/追蹤測試清單列出。
- **OQ-S5-4**:遠距設計矩陣定稿(角高階層 × 角速度階層 → 距離/hitbox/motion 速度反推表;
  角尺寸下限),記 ledger + 上層 §8 回填。
- **OQ-23.1**:hitbox 單一來源落點定稿(型別宣告 + 預設常數放哪一檔)。
- **CLAUDE.md §4 候選**:「目標 hitbox 單一來源;命中判定與 on-target 推導必須同幾何」——
  與本 task 同 commit 回寫。

## Out of scope

- 任何 `src/` 變更(T1);drill config(T2)。

## Steps

- [ ] `npm run test:ci` 乾淨基準 exit 0 記 progress。
- [ ] 上游 exit-gate 證據(WP-18/M10)引用記 progress。
- [ ] hitbox 消費點盤點 + 既有回歸測試清單記 progress。
- [ ] OQ-S5-4 / OQ-23.1 決議記 ledger(明確數值,非「傾向」)+ 上層 §8 回填。
- [ ] CLAUDE.md §4 追加候選約束(與本 task 同 commit)。
- [ ] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- progress 含:上游證據、消費點盤點(含測試清單)、兩條 OQ 決議(反推表為具體數字);
  CLAUDE.md §4 含新約束;`git diff --stat` 不含 `src/`。

## Commit

`docs(wp-23): T0 entry gate — 上游驗證 + 遠距角參數矩陣/hitbox 單一來源決議`
