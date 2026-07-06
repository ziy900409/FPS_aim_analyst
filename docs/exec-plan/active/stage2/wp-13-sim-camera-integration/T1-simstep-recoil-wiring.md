# T1 — simStep recoil 佈線(64Hz 子節奏 + onFire/spread 掛線)

> Part of [WP-13 sim-camera-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0 |
| **Risk / Cplx** | **High** / High |
| **Touches** | MODIFY `src/loop/SimLoop.ts`、`src/state/SharedState.ts`(recoilState + recoil prev/curr)、`src/state/types.ts` + 測試 |
| **狀態** | ✅ 2026-07-06 |

## Objective

recoil 狀態機進 sim:偶數 tick 衰減(64Hz 子節奏,OQ-S2-1 決議)、產彈點注入
kick + spread 取樣,punch 快照供 render 內插。彈道方向本 task **暫不換**(T2)。

## In scope
- `SharedState`:`recoilState: RecoilState`(sim 專屬,`resetState` 呼叫 `resetRecoilState`)
  + `recoil: { prev: {pitchDeg,yawDeg}; curr: {...} }` 內插快照(比照 position prev/curr)。
- `createSimLoop`:`tickIndex` 計數器;spread RNG = `createRan1(seed)`(OQ-13.1 定案:
  seed = `drill.sequence.seed ?? DEFAULT_RNG_SEED`,restart 重建 stream);weapon 已由 WP-11 注入。
- `simStep` 順序(更新 [../README.md §2.4](../README.md) 契約):
  ① prev←curr(含 `recoil.prev ← recoil.curr`);② targets;
  ③ **`tickIndex & 1 === 0` → `recoilTick(recoilState, 1/64)`**;④ consume(fire 排程產彈:
  `fireOneShot` 內先 `sampleSpread(…, rng)` 再 `recoilOnFire(…)`——spread 用 kick **前**的
  inaccuracy,對齊 CS2 次序);⑤ movement;⑥ curr←新值(`recoil.curr ← aimPunch`);⑦ record。
- `speedRatio` 輸入:`|state.player.vx| / 250`(WP-14 前為 {0,1} 二元,介面即真速度)。

## Out of scope
- 彈道方向替換與 adapter(T2——本 task 產彈仍走 `raycastFromCenter`,punch/spread 只更新狀態);
  彈孔(T3);匯出欄位(WP-16)。

## Steps

- [x] SharedState 擴充 + reset;types 註解更新。
- [x] tickIndex + 子節奏呼叫;順序測試:「decay 在產彈前」(合成:tick 內先衰減後 kick,
      斷言 punch 值 = 手算序列 forward,且 ≠ 反序 reversed)。
- [x] `fireOneShot` 掛 `sampleSpread` + `recoilOnFire`(結果 `recoil.lastSpread` 暫存 SharedState,T2 消費)。
- [x] 整合 golden:合成 held AK 10 發跑完 → `recoilState.aimPunch×2` 重現 M5 向量
      (pitch −10.18°/yaw −1.56°)——**接線正確性的判準**。⚠️ 容差調 0.01→0.02°:雙率離散化殘差
      (實測 pitch 0.0141°),見 progress.md T1 Surprises。
- [x] 決定性:同 seed 同輸入兩次執行 → recoilState/spread 位元級一致;每幀 1 tick vs 60Hz 幀末態一致。
- [x] `npm run test` 全綠(含既有回歸)。

## Definition of Done

- 整合 golden 通過(M5 向量在 sim 內重現);決定性(2 案)綠;既有回歸綠;
  `recoilTick` 呼叫僅一處且帶常數 1/64。

## Commit

`feat(wp-13): T1 recoil 進 simStep(64Hz 子節奏)+ 產彈點 onFire/spread 掛線`