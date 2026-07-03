# T2 — fire down/up 事件鏈 + heldFire + stuck-fire 防護

> Part of [WP-11 weapon-fire](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(影響面清單在 progress) |
| **Risk / Cplx** | Med / Med |
| **Touches** | MODIFY `src/state/types.ts`、`src/state/SharedState.ts`、`src/input/InputSampler.ts`、`src/loop/SimLoop.ts`(applyInput fire 分支)、`src/main.ts`(stuck-fire 防護)+ 既有測試 |
| **狀態** | ⬜ |

## Objective

把「mousedown = 一發」升級為「fire 是**按住狀態**」:down/up 都入 ring、sim 依時序
消費更新 `heldFire`——full-auto 的輸入面。產彈本身仍是舊行為(T3 才換排程)。

## In scope
- `types.ts`:fire variant → `{ type:'fire'; down: boolean; t: number }`;`InputEventView` 註解更新。
- `SharedState.ts`:`heldFire: boolean` 欄(`resetState` 原地清空);`pushFire(down, t)` →
  `enqueue(EV_FIRE, t, 0, down ? 1 : 0)`;`dequeueInto` 解碼 `view.down`(EV_FIRE 分支)。
- `InputSampler.ts`:`mouseup`(button 0)監聽入緩衝;mousedown 帶 `down:true`。
  up 事件**不受** `isLocked` 閘門(down 已採計者其 up 必須送達,否則卡 held)。
- `SimLoop.ts` `applyInput`:fire 分支改為「`down` → 更新 `state.heldFire` + **沿用既有單發邏輯**
  (down 時就地 raycast 一發,行為暫時不變);`!down` → 只更新 heldFire」——T3 再把單發邏輯搬進排程。
- `main.ts`:`pointerLock.onChange(locked => { if (!locked) 直接清 heldFire })`(stuck-fire 防護;
  不經 ring——解鎖是 UI 事件,非量測輸入)。

## Out of scope
- cycletime 排程 / 彈匣(T3);recoil 掛線(WP-13);fire 事件匯出欄位變更(WP-16)。

## Steps

- [ ] 依 T0 影響面清單逐檔修改;既有測試斷言同刀更新(`{type:'fire'}` → 加 `down:true`)。
- [ ] 新測試:down/up 序列 → `heldFire` 翻轉正確;up 不觸發 raycast;鎖定外 down 不採計、
      已 held 時解鎖 → `heldFire=false`(stuck-fire)。
- [ ] ring 保序測試:fire down/up 與 key 事件交錯,依 t 升冪消費(沿用既有 consume 測試模式)。
- [ ] `npx vitest run` 全綠(含 WP-2/3/5 既有回歸)。

## Definition of Done

- fire down/up 入 ring、依時序消費、heldFire 正確;stuck-fire 防護有測試;
  決定性回歸(9 tests)+ 全 suite 綠;`git grep "type: 'fire'" src tests` 無殘留舊形狀。

## Commit

`feat(wp-11): T2 fire down/up 事件鏈 + heldFire 狀態 + 解鎖 stuck-fire 防護`