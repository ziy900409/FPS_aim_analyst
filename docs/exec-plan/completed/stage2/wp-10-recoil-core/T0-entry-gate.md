# T0 — Entry gate(決策拍板 + 文件對帳)

> Part of [WP-10 recoil-core](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | 階段 A M4 ✅(2026-07-03,[exec-plan/README.md §3](../../../../README.md)) |
| **Risk / Cplx** | Low / Low |
| **Touches** | `../../../../DECISIONS.md`、`../../../../README.md`、`../../../../../CLAUDE.md`、本資料夾 docs |
| **狀態** | ✅ 完成(2026-07-05) |

## Objective

在寫任何 recoil 程式碼前,鎖定影響 golden 測試定義的兩個決策(OQ-S2-1/S2-6),
把 stage2 範圍採納記入全域帳本(GD-5),並完成最小文件對帳。

## In scope
- 向使用者確認 OQ-S2-1(tick 節奏)與 OQ-S2-6(彈匣行為),記入 [progress.md](progress.md) ledger 與 [../README.md §8](../../../active/stage2/README.md)。
- [DECISIONS.md](../../../DECISIONS.md) 新增 **GD-5**:stage2 範圍採納、tick 64Hz 子節奏、感度語意變更(WP-12)、WP-14 決定性 baseline 預期重錄、sim/recoil 禁 `Math.random()`、移動模型抽象留接口(`MovementProfile`;Valorant 不入 stage2,WP-14/16)。
- [CLAUDE.md §4](../../../../../CLAUDE.md) 追加兩條硬約束:禁 `Math.random()`(seeded RNG 注入)、recoil 衰減以 1/64s 步長定義。
- [exec-plan/README.md §2](../../../README.md) 加 stage2 索引列(連 [../README.md](../../../active/stage2/README.md))。

## Out of scope
- `src/` 下任何變更;規格書 v1.2 / CONTEXT.md 新術語(排 T-exit 隨 M5 一併回寫,見該檔)。

## Steps

- [x] 驗證上游:`git log --oneline` 可見 M4 exit-gate commit(`ddbb599` 附近);[exec-plan/README.md §3](../../../../README.md) M4 ✅。
- [x] **OQ-S2-1 拍板**:recoil tick = 64Hz 子節奏(偶數 sim tick)/ dt=1/128 代入 / SIM_HZ 降 64,三擇一(計畫建議第一案,理由見 [../README.md §2.4](../../../active/stage2/README.md))。
- [x] **OQ-S2-6 拍板**:彈匣盡即停火(無 reload),drill 一 peek ≤ 一匣(計畫建議)。
- [x] 兩決議寫入 [progress.md](progress.md) ledger(含日期與拍板人)+ 回填 [../README.md §8](../../../active/stage2/README.md) 狀態。
- [x] [DECISIONS.md](../../../../DECISIONS.md) 新增 GD-5(格式循 GD-2:決議/權威來源/影響面)。
- [x] [CLAUDE.md §4](../../../../../CLAUDE.md) 追加兩條硬約束(一行一條,附出處 GD-5)。
- [x] [exec-plan/README.md §2](../../../../README.md) 加 stage2 列;§3 加 M5–M8 佔位列。

## Definition of Done

- OQ-S2-1 / OQ-S2-6 於 progress ledger 皆 ✅ 且有明確決議文字(非「傾向」)。
- GD-5 條目存在且含六個決策點;CLAUDE.md 兩條硬約束可 grep 到;exec-plan 索引列存在。
- 全部為 docs 變更:`git diff --stat` 不含 `src/`。

## Commit

`docs(wp-10): T0 entry gate — OQ-S2-1/S2-6 拍板 + GD-5 stage2 範圍採納與硬約束對帳`
