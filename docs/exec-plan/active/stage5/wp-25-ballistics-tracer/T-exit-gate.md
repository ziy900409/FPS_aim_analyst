# T-exit — Exit gate(M12:彈道模型門控)

> Part of [WP-25 ballistics-tracer](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T4 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/本資料夾 README 狀態 + [上層 README §3/§4](../README.md) + [exec-plan/README.md](../../../README.md) M12) |
| **狀態** | ✅ PASS(2026-07-14) |

## Objective

宣告 **M12**:tracer 交付 + projectile 數學/整合/語意全綠且 **hitscan 逐位
不變**——`bullet` 欄自此可進 drill config(WP-26 T3 整合 drill 解鎖)。

## Steps

- [x] `npm run test:ci` exit 0(證據記 progress):`tsc` clean + Vitest 74 files/603 tests + Playwright 16 tests 全綠。
- [x] M12 四項證據記 progress(Outcomes):
  - **tracer**:render-only + 單 draw call + sim 零改動(T1)。
  - **hitscan 零破壞**:stage1–3 baseline 零重錄、零修改全綠(T3)。
  - **projectile golden + 決定性**:位置序列/命中 tick 逐位 + 跨 FPS fixture(T2/T3/T4)。
  - **語意**:`firstShot`/`t_fire` 錨定不變斷言 + hit 事件 round-trip + lead spec(T4)。
- [x] OQ ledger 收斂:OQ-S5-2(GD-17)/OQ-S5-5/OQ-25.1~25.3 全數 ✅ 回填。
- [x] CONTEXT.md 回寫確認(新增 §H:tracer/shotRays、projectile/彈道模型 gate、
  time-of-flight、lead 誤差 術語)。
- [x] 索引翻牌:本資料夾 README → ✅;[上層 README §3](../README.md) WP-25 列 + M12;
  [exec-plan/README.md §3](../../../README.md) M12 標記。
- [x] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` exit 0;M12 四項證據可追;OQ 收斂;CONTEXT 術語入帳;索引一致;
  **WP-26 T3 的 `bullet` 欄使用自此解鎖**。

## Commit

`docs(wp-25): exit gate — M12 彈道模型門控(tracer + projectile;hitscan 零破壞)`
