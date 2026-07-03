# T4 — 決定性驗證 ★M1 gate

> Part of [WP-2 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **這是 M1 門控閘。未綠燈 → STOP，不展開 WP-3 之後任何 WP。**

| | |
|---|---|
| **Depends on** | T2 |
| **Risk / Complexity** | High / High |
| **Touches** | NEW `src/loop/__tests__/determinism.test.ts` |
| **Status** | ✅ DONE (2026-07-01) |

## Objective
以 Vitest 證明：**給定相同輸入事件序列（含時間戳），sim 的逐 tick 輸出與 render FPS（frame delta 序列）無關**（FR-2.4）。這是整個量測工具效度的基石。

## In scope
- 合成一條輸入序列（OQ-2.1：按鍵在固定時間切換 vx）。
- 用多組 frame delta 序列（OQ-2.2：等距 60/144/240 Hz、抖動、含一次大 spike）各自驅動 `pump`，注入式 clock。
- 收集每次跑的「逐 tick player 狀態軌跡」，斷言彼此**逐 tick 相等**（浮點以嚴格相等或極小 epsilon）。

## Out of scope
- 真 movement/急停（佔位邏輯即可暴露 frame-dependent bug）。

## Design notes
- 關鍵：sim tick 數與每 tick 結果只取決於累積時間到達 `TICK` 的次數，與「分幾次餵」無關（spike 夾住後仍須等價於連續累積）。
- 注意 spike：`Math.min(delta, 0.25)` 會「丟棄」超過 0.25s 的時間——所有 FPS 序列必須在相同總模擬時間下比較，且 spike 的夾除行為一致（測試以「同樣注入到 0.25s 夾界內」設計，避免把夾除誤判為不決定性）。
- 比較對象：固定 tick 索引的軌跡陣列；長度應一致（總模擬時間相同）。

```ts
function runWith(frameDeltas: number[]): PlayerSnapshot[] {
  const state = freshState(); const clock = injectedClock();
  const sim = createSimLoop(state, clock, 128);
  const traj: PlayerSnapshot[] = [];
  let t = 0;
  for (const d of frameDeltas) { t += d; clock.set(t); applyInputsUpTo(state, t); sim.pump(t); traj.push(snapshot(state.curr)); }
  return traj;   // 比較不同 frameDeltas 下相同 tick 索引的狀態
}
```

## Steps
- [x] 寫合成輸入序列（`syntheticInputs`：固定 timeStamp 切換 vx）。
- [x] 實作 `runFrames(absTimes)` + `canonicalTrajectory`（per-tick ground truth），回傳逐 tick 軌跡。
- [x] 三組以上 frameDeltas（60/144/240 + 抖動 + spike），斷言逐 tick 軌跡相等。
- [x] 加邊界案例：背景分頁大 gap（驗 spike 夾除一致、不產生分歧）。
- [x] `npx vitest run` 綠燈（9/9；全套 27/27 無回歸）；測試報告摘要見 progress.md。

## Definition of Done
- [x] **同輸入序列、不同 FPS → 逐 tick sim 軌跡一致**，Vitest 綠燈。
- [x] spike/背景分頁邊界不破壞決定性（>250ms 夾成 32 ticks、重播 bit-exact；行為明確定義並測試）。
- [x] progress.md 記錄通過證據 → **宣告 M1 可達（待 T5 正式宣告）**。

> **實作偏離 sketch（無害）：** README/T4 sketch 的 `runWith` 每幀 `traj.push(snapshot)` 為**逐幀**取樣（不同 FPS 幀數不同、長度不一難逐 tick 比對）；改為 **per-tick ground truth**（每幀恰一 tick 建立 canonical 軌跡）+ 每幀以「累積 tick 數」為索引對齊 canonical，達成真正的**逐 tick index** 比較，且不需 `applyInputsUpTo`（`consumeInput` 已依 timeStamp 分桶，預載全部事件即決定性）。斷言用 **exact 相等**（本佔位邏輯數值 float 精確，比 epsilon 更強）。

## Commit
`test(wp-2): 決定性驗證 — 同輸入不同 FPS 逐 tick 一致（FR-2.4, M1 gate）`
