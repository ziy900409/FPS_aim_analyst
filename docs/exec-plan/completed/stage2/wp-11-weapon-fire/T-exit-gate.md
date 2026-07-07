# T-exit — Exit gate(連發決定性 + 回歸全綠)

> Part of [WP-11 weapon-fire](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T3 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引)+ 必要時補測試 |
| **狀態** | ⬜ |

## Objective

宣告 full-auto 開火管線就緒且決定性成立:同一合成輸入序列(fire down/up + 鍵盤)
在不同 render FPS pump 節奏下,逐發出彈 tick、彈數、命中序列一致。

## Steps

- [ ] 連發決定性測試:同序列 × pump 節奏 60/144/240 FPS 模擬 → 出彈 tick index 序列
      逐位一致(比照 [determinism.test.ts](../../../../../src/loop/__tests__/determinism.test.ts) 模式,新增 fire 維度)。
- [ ] `npm run test`(vitest)exit 0;`npm run typecheck` exit 0。
- [ ] 手動驗證(dev server):鎖定後按住左鍵 → 連發至 30 發停;Esc 解鎖不卡連發;
      證據(操作紀錄 + console)記 progress。
- [ ] progress.md 寫 Outcomes;checklist 全 ✅;[../README.md §3](../../../active/stage2/README.md) WP-11 翻 ✅。

## Definition of Done

- 決定性測試含 fire 維度且綠;`test` + `typecheck` exit 0;手動驗證紀錄在案;
  兩層索引狀態已更新。

## Commit

`docs(wp-11): exit gate — full-auto 管線決定性驗證 + WP 收斂`