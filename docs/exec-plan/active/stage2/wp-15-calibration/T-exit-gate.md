# T-exit — Exit gate(M7:校準通過,研究效度成立)

> Part of [WP-15 calibration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1, T2 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/兩層索引)+ 歸因報告定稿 + `../../../DECISIONS.md`(必要時) |
| **狀態** | ⬜ |

## Objective

宣告 **M7**:速度曲線與彈道 pattern 皆對上外部真值(或差異已分層歸因並被研究者接受)——
「counter-strafe × 壓槍」研究效度自此成立,移動 inaccuracy 掛在可信速度上。

## Steps

- [ ] `npx vitest run` 全綠(tests/calibration 兩組常駐 CI,非一次性腳本)。
- [ ] 歸因報告定稿:全過 → 簡記;有容差校正 → 前後值 + 理由;有未解差異 →
      分層歸因(公式/常數/subtick)+ 研究者接受聲明,記 progress + GD 補記。
- [ ] OQ-S2-2 ledger 收斂:容差最終值回填 [../README.md §8](../README.md)。
- [ ] [../README.md §3](../README.md) WP-15 翻 ✅、M7 標日期;[exec-plan/README.md §3](../../../README.md) M7 同步。
- [ ] progress.md 寫 Outcomes(通過項 / 校正項 / caveat 清單)。

## Definition of Done

- M7 於兩層索引 ✅ + 日期;校準測試在 CI 常駐且綠;歸因報告可追;
  **M8(WP-17)的校準側前置就緒**。

## Commit

`docs(wp-15): exit gate — 宣告 M7 校準通過(cl_showpos + pattern 對外部真值)`
