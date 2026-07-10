# T-exit — Exit gate(真急停物理上線)

> Part of [WP-14 movement-physics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T3 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引)+ `../../../DECISIONS.md`(GD 補記)+ 規格 §5 註記回寫 |
| **狀態** | ✅ complete(2026-07-06) |

## Objective

宣告 WP-14 收斂:integrator + velocity gate 全綠、baseline 重錄有完整紀錄、
急停「手感」經真瀏覽器驗證——WP-15 校準自此有穩定對象。

## Steps

- [ ] `npm run test:ci` exit 0(vitest + Playwright 既有鏈全綠)。
- [ ] baseline 重錄完成確認:T0 盤點清單逐檔已更新;重錄理由記 GD-5 補記 + progress。
- [ ] **手動手感驗證**(記 progress,含觀察值):
      ① A/D 起步 → vx 曲線平滑升至 ~250(非瞬跳);
      ② 按反向鍵急停 → vx 自然衰減穿越 88(非瞬停);
      ③ HUD stopped 燈在 |vx| < 88 時亮。
- [ ] 規格 §5「階段 A 指標分層」註記解除回寫(若規格已升 v1.2 則補節,否則記入待對帳)。
- [ ] [../README.md §3](../../../completed/stage2/README.md) WP-14 翻 ✅;[task-checklist.md](task-checklist.md) 全 ✅。
- [ ] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` exit 0;手感驗證三觀察點皆有紀錄;baseline 重錄證據可追(GD + progress);
  索引/checklist 翻 ✅。
- **M7 的 WP-14 側前置就緒**:WP-15 T1 可直接以本 WP 曲線對 `cl_showpos`。

## Commit

`docs(wp-14): exit gate — 真急停物理上線(integrator + velocity gate + 指標連續化)`
