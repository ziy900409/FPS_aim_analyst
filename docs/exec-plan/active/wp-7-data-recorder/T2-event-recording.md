# T2 — 事件記錄（t_visible / 命中 / 首發 / 急停）

> Part of [WP-7 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1 |
| **Risk / Complexity** | Med / Med |
| **Touches** | MODIFY `src/data/DataRecorder.ts`、`src/loop/SimLoop.ts`（事件掛點） |
| **Status** | ⬜ TODO |

## Objective
記錄關鍵事件流：`visible`（t_visible，WP-4）、`counter`（急停，WP-5）、`fire`（含 hit/firstShot/residualSpeed/part，WP-5），對齊附錄 C events 結構（FR-7.2）。

## In scope
- `recordEvent(e)`：append 到 events[]。
- WP-4 蓋 t_visible 時 → `recordEvent({type:'visible',targetId,t})`。
- WP-5 反向鍵急停 → `{type:'counter',key,t}`；fire → `{type:'fire',t,hit,firstShot,residualSpeed,part}`。

## Out of scope
- 指標計算（→ WP-8）；匯出（→ T4）。

## Design notes
- 事件時間 `t` 用來源 `event.timeStamp`（fire/counter）或 sim tick 時間（visible），皆 `performance.now()` 基準。
- 對齊附錄 C：`{"type":"fire","t":...,"hit":true,"firstShot":true,"residualSpeed":3.1,"part":"head"}`。

## Steps
- [ ] `recordEvent` + events[]（reset 隨 drill）。
- [ ] WP-4/5 掛點呼叫 recordEvent。
- [ ] Vitest：一段合成 drill → events 含 visible/counter/fire，欄位齊全且時間遞增。
- [ ] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [ ] 事件流完整（visible/counter/fire + 子欄位），對齊附錄 C；時間源正確。

## Commit
`feat(wp-7): 事件記錄 t_visible/命中/首發/急停（FR-7.2）`
