# T-exit — Exit gate(M11:遠距追蹤效度地基)

> Part of [WP-23 longrange-tracking](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T3 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/本資料夾 README 狀態 + [上層 README §3/§4](../README.md) + [exec-plan/README.md](../../../README.md) M11) |
| **狀態** | ⬜ |

## Objective

宣告 **M11**:hitbox config 化零破壞 + 同幾何不變式被測試釘死 + 遠距小目標
追蹤 drill 的指標鏈與決定性成立——WP-25 T2+(projectile)與 WP-26(BR 整合)
自此有效度地基可消費。

## Steps

- [ ] `npm run test:ci` exit 0(tsc/vitest/playwright 證據記 progress)。
- [ ] M11 四項證據記 progress(Outcomes):
  - **零破壞**:省略 hitbox 欄既有測試零修改全綠(T1)。
  - **同幾何**:邊緣開火 fixture 命中 ⇔ on-target(T1)。
  - **round-trip**:`tracking_longrange_v1` 推導誤差 ≤ 1 tick(T3)。
  - **決定性**:遠距 fixture 跨 FPS 逐位 + 既有 baseline 零重錄(T3)。
- [ ] OQ ledger 收斂:OQ-S5-4 / OQ-23.1 / OQ-23.2 回填;帶著走的項移交
  (OQ-23.2 場景尺度 → WP-26 T0)。
- [ ] CONTEXT.md 候選回寫確認(hitbox 參數化語意——H1 單一 hitbox 不變、尺寸成為資料)。
- [ ] 索引翻牌:本資料夾 README 狀態 → ✅;[上層 README §3](../README.md) WP-23 列 + M11;
  [exec-plan/README.md §3](../../../README.md) M11 標記。
- [ ] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` exit 0;M11 四項證據可追;OQ 收斂或移交;索引狀態一致;
  **WP-25 T2 entry 的 M11 前提自此可引用**。

## Commit

`docs(wp-23): exit gate — M11 遠距追蹤效度地基(hitbox config 化 + round-trip + 決定性)`
