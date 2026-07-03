# T-exit — Exit gate(回歸全綠 + 手感抽查)

> Part of [WP-12 input-seams](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1, T2 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引) |
| **狀態** | ⬜ |

## Objective

宣告兩個接縫就緒:感度為 CS2 語意且匯出有標記、射線可注入且舊路徑等價——
WP-13 可以在不再動這兩處的前提下接彈道。

## Steps

- [ ] `npm run test` + `npm run typecheck` exit 0(證據記 progress)。
- [ ] 手感抽查(dev server):以 CS2 慣用 sensitivity(如 1.5–2.5)實際轉視角,
      確認 360° 所需滑鼠距離與 CS2 同 sensitivity 直覺一致(粗抽查即可,量化校準屬 pilot);
      若設定面板值域不敷使用,記 OQ 給 WP-13/pilot。
- [ ] 匯出抽查:dev 跑一輪 drill → 匯出 JSON 含 `sensitivityModel: 'cs2-0.022deg'`。
- [ ] progress.md 寫 Outcomes;checklist 全 ✅;[../README.md §3](../README.md) WP-12 翻 ✅。

## Definition of Done

- 測試/typecheck exit 0;手感抽查與匯出抽查證據在 progress;兩層索引狀態已更新。

## Commit

`docs(wp-12): exit gate — 感度/射線兩接縫收斂,WP-13 可接彈道`