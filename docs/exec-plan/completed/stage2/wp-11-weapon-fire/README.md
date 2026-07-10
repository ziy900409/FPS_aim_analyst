# WP-11 — weapon-fire:WeaponConfig + full-auto 開火管線

> stage2 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../../../completed/stage2/README.md) · 稽核 A5 缺口的補齊。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 建立武器抽象(`WeaponConfig` ~15 欄、三把 CS2 vdata 預設)與 **full-auto 開火管線**(fire down/up 事件 → `heldFire` → tick 內 cycletime 產彈 + 彈匣),為 recoil `onFire` 準備唯一掛點 |
| **里程碑** | —(M6 的前置) |
| **相依** | WP-10(`WeaponConfig` 的 recoil/inaccuracy 欄位形狀由 T1–T3 型別定義) |
| **對應 FR** | FR-B5(WeaponConfig)、FR-B6(cycletime 連發 + 彈匣)、FR-B4 部分(index 遞增掛點) |
| **估時** | 2–3 dev-days |
| **狀態** | ✅ 完成(T-exit:連發決定性 + 回歸全綠,2026-07-06) |

---

## 1. 範圍

**In scope**:

```
src/weapon/WeaponConfig.ts     ← NEW 型別 + validateWeapon(比照 drill/schema.ts 模式)   [T1]
src/weapon/weapons.ts          ← NEW 內建三把(ak47/m4a4/m4a1s,CS2 vdata 值)           [T1]
src/input/InputSampler.ts      ← MODIFY mouseup 監聽 + pushFire(down)                     [T2]
src/state/types.ts             ← MODIFY InputEvent fire variant 加 down;EV_FIRE b 欄啟用 [T2]
src/state/SharedState.ts       ← MODIFY heldFire + weapon:{nextFireT, ammo, magSize}(原地 reset) [T2/T3]
src/loop/SimLoop.ts            ← MODIFY fire down/up 消費 + tick 內 cycletime 產彈排程    [T3]
src/main.ts                    ← MODIFY createSimLoop 注入預設武器(ak47)                [T3]
(+ 對應 *.test.ts)
```

**Out of scope**:recoil/punch/spread 接線與彈道方向(WP-13,產彈點只留 seam)、
`DrillConfig.weaponId` 選填欄(WP-16 schema v2 一併)、reload(OQ-S2-6:彈匣盡即停火)。

## 2. 關鍵契約

- **fire 事件**:`{ type:'fire'; down: boolean; t: number }`;ring packed 槽位 `EV_FIRE` 以既有閒置 `b` 欄存 down(0/1)——容量/佈局不變。
- **產彈排程(累加制,防漂移)**:tick 內 `while (heldFire && ammo > 0 && nextFireT <= tickEndMs) { 產彈; nextFireT += cycletimeSec*1000 }`;首發(從未開火/停火後)`nextFireT = fireDown 事件 t`。
- **產彈點 = 未來 recoil 掛點**:本 WP 產彈仍走既有 camera-center raycast(WP-5 路徑);
  WP-13 在同一點呼叫 `recoilOnFire` + `sampleSpread` 並替換方向來源。
- vdata 參考值(T1 內建):

| 參數 | AK-47 | M4A4 | M4A1-S |
|---|---|---|---|
| seed / magnitude / variance | 223 / 30 / 0 | 38965 / 23 / 0 | 38965 / 25 / 3 |
| angleVariance / cycletime / magSize | 70 / 0.10 / 30 | 70 / 0.09 / 30 | 65 / 0.10 / 20 |
| InaccuracyFire | 0.0078 | 0.007 | 0.012 |

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| `nextFireT = now + cycletime` 重設制 | 排程漂移,pattern 全歪 | 契約累加制;T3 DoD:30 發 span = 2900ms ± 1 tick |
| 解鎖(Esc/失焦)時 heldFire 卡住 | 解鎖後持續產彈 | T2:PointerLock onChange 補送 fire-up(stuck-fire 防護)+ 測試 |
| fire 事件型別變更破壞既有測試 | WP-3/5 回歸紅 | T2 同刀更新既有測試斷言;決定性回歸(9 tests)綠為閘 |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | WP-10 型別就緒確認 + InputRing 影響面盤點 | WP-10 T1–T3 | Low |
| **T1** | [T1-weapon-config.md](T1-weapon-config.md) | `WeaponConfig` + `validateWeapon` + 三把內建 | T0 | Low |
| **T2** | [T2-fire-down-up.md](T2-fire-down-up.md) | fire down/up 事件鏈 + `heldFire` + stuck-fire 防護 | T0 | Med |
| **T3** | [T3-cycletime-scheduler.md](T3-cycletime-scheduler.md) | tick 內 cycletime 產彈 + 彈匣 + recoil 掛點 seam | T1, T2 | Med |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | 連發決定性 + 既有回歸全綠 | T1–T3 | — |
