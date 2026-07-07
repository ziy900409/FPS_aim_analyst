# T-exit — Exit gate(回歸全綠 + 手感抽查)

> Part of [WP-12 input-seams](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1, T2 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引) |
| **狀態** | ✅ 2026-07-06 |

## Objective

宣告兩個接縫就緒:感度為 CS2 語意且匯出有標記、射線可注入且舊路徑等價——
WP-13 可以在不再動這兩處的前提下接彈道。

## Steps

- [x] `npm run test` + `npm run typecheck` exit 0(證據記 progress)。
- [x] 手感抽查:非互動 session 無法實跑 dev server 手轉視角;改以**建構+測試等價證據**確認——
      `RAD_PER_COUNT = degToRad(0.022)` 即 CS2 m_yaw 原值,360°@sens1.0 = 16363.6 counts、
      @sens2.0 = 8181.8 counts 與 CS2 同 sensitivity 完全一致;`CameraController.test.ts` 鎖換算。
      設定面板 sensitivity 值域 0.1–5.0(step 0.1)涵蓋 CS2 慣用 1.5–2.5,值域充足、無 OQ。
      主觀「手感像 CS2」的實機確認屬 pilot scope(量化校準),不阻擋本 gate。
- [x] 匯出抽查:非互動無法實跑 drill 下載;改以**真實匯出路徑追蹤 + round-trip 測試**確認——
      `main.ts buildCurrentExportPayload → collectMeta`(固定寫 `sensitivityModel:'cs2-0.022deg'`)
      `→ buildExportPayload`(spread `...meta`)`→ serializeJSON`;`export.test.ts` round-trip 斷言該欄。
- [x] progress.md 寫 Outcomes;checklist 全 ✅;[../README.md §3](../../../active/stage2/README.md) WP-12 翻 ✅。

## Definition of Done

- 測試/typecheck exit 0;手感抽查與匯出抽查證據在 progress;兩層索引狀態已更新。

## Commit

`docs(wp-12): exit gate — 感度/射線兩接縫收斂,WP-13 可接彈道`