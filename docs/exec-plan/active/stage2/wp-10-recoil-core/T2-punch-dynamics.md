# T2 — punch 動力學(KickBack / HybridDecay / leapfrog / index)

> Part of [WP-10 recoil-core](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> 演算法權威來源:[研究計畫 Phase 1-2](../CS2%20壓槍軌跡復刻研究計畫.md)

| | |
|---|---|
| **相依** | T1(彈道表) |
| **Risk / Cplx** | **High** / High |
| **Touches** | NEW `src/recoil/punch.ts`、`src/recoil/punch.test.ts`、`tests/golden/recoil/ak47-10shot-punch.json` |
| **狀態** | ⬜ |

## Objective

實作 punch 狀態機:開槍 KickBack 注入**角速度**、每 recoil tick(1/64s)衰減 + 積分,
以 AK 10 發 golden 向量(`punch×2` = pitch −10.18° / yaw −1.56°)釘死。

## In scope
- `RecoilState`(固定欄位、物件重用):`aimPunchPitchDeg/aimPunchYawDeg/punchVelPitch/punchVelYaw/viewPunch*/recoilIndex/inaccuracyFire/lastFireT`。
- `recoilTick(s, dtSec)`,dtSec 恆 1/64(OQ-S2-1),順序:
  ① punch 角度 **HybridDecay**(指數項係數 8 + 線性項 18);
  ② 角速度 **leapfrog** 積分(前後各加 `vel·dt·0.5`);
  ③ 角速度衰減 `vel *= exp(−4.5·dt)`;
  ④ 停火超過 `cycletime × 1.1` 後 `recoilIndex *= exp(−dt·ln10·2)`。
- `recoilOnFire(s, w, table)`:依 `recoilIndex` 查表 →`(angle, magnitude)` 分解 pitch/yaw 加到**角速度**;`viewPunch += magnitude × 0.055`;`recoilIndex++`、`lastFireT` 更新、`inaccuracyFire += w.inaccuracy.fire`(供 T3)。

## Out of scope
- spread 取樣(T3);sim 佈線與 64Hz 子節奏排程(WP-13);deg→rad/符號翻轉(WP-13 接線)。

## Design notes

- 單位 = **degree、Source 慣例(pitch 正值朝下)**;golden 向量即此域,不得在本模組先翻轉。
- decay-先-kick 順序:tick 內先衰減、fire 事件後注入(與 WP-13 simStep 順序契約一致,[../README.md §2.4](../README.md))。
- `cycletime` 由參數傳入(本 WP 測試用 AK 0.10s inline 常數;正式 config 屬 WP-11)。

## Steps

- [ ] `RecoilState` + `createRecoilState()`(zeroed)+ `resetRecoilState()`(原地清空)。
- [ ] `recoilTick` 四步驟照序實作;`recoilOnFire` KickBack + index。
- [ ] 抑制/index 交互測試:index 0..3 開火使用表 entry 對應抑制值(接 T1)。
- [ ] **Golden**:合成序列「每 0.1s 一發 × 10 發,間隔跑 recoilTick(1/64)」→ `aimPunch×2` = pitch **−10.18°**、yaw **−1.56°**(±0.01°);全序列逐 tick punch 快照存 golden fixture。
- [ ] 停火衰減測試:最後一發後 0.11s 起 index 以 `exp(−dt·ln10·2)` 歸零(半衰期解析值對照)。
- [ ] `npx vitest run src/recoil` 全綠。

## Definition of Done

- 10 發 golden 向量 ±0.01° 通過;抑制係數 4 值精確;index 衰減解析對照通過;同輸入兩次執行位元級一致。

## Commit

`feat(wp-10): T2 punch 動力學(HybridDecay+leapfrog+index)+ AK 10 發 golden 向量`