# T2 — projectile 數學核心(src/ballistics/ 純模組 + golden)

> Part of [WP-25 ballistics-tracer](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(GD-17 參數表)+ **M11 ✅**(開工前複驗 WP-23 T-exit) |
| **Risk / Cplx** | Med / Med(演算法正確性——swept 測試與固定步長語意) |
| **Touches** | ADD `src/ballistics/`(`bullet.ts` + `sweptHit.ts` + golden 測試);**零 three/DOM/sim 相依**(比照 `src/recoil/`) |
| **狀態** | ✅ PASS(2026-07-14) |

## Objective

彈道數學先於接線釘死(FR-E8,仿 WP-10 模式):固定 1/128s 步長的彈道演進
純函式 + swept segment vs AABB 命中測試 + golden——之後 T3 的整合問題
可歸因到接線而非公式。

## In scope

- `bullet.ts`:
  - `BulletState`(x,y,z,vx,vy,vz,ageTicks,alive——plain 欄位,arena 可重用);
  - `stepBullet(b, dtSec, gravityU)`:半隱式 Euler(先 vy -= g·dt 再位移;
    定案記 spec 註解),**dtSec 非 1/128 拋錯**(比照 `recoilTick` 硬約束);
  - `spawnBullet(out, origin, dirUnit, speedU)`(重用 out,零配置)。
- `sweptHit.ts`:`sweptHitTest(x0,y0,z0, x1,y1,z1, aabb)` → `s ∈ [0,1] | null`
  (slab method,與 `clearance.ts` 同技術但**不共用場景模組**——GD-6 邊界;
  數學 helper 可自立);`s` 供 t_hit 的 tick 內插值(記錄粒度依 T4 語意)。
- **命中語意 spec(OQ-25.3 定案)**:swept segment 對「本 tick 目標 AABB」測試;
  移動目標 × 飛行彈的語意寫進模組 doc comment(決定性可斷言的定義)。
- **golden tests**:
  - 平飛(g=0):n tick 後位置 = origin + dir·speed·n/128(逐位);
  - 拋體:GD-17 參數組的位置序列前 32 tick golden(逐位鎖定);
  - 命中 tick:known 幾何(距離 d、速度 v)→ 命中發生在 `ceil(d/(v/128))` tick(含 s 值);
  - 高速貼邊/薄 AABB(tunneling 防護)、平行軸零分量、起點在 AABB 內。

## Out of scope

- SimLoop 接線/arena/事件(T3)、WeaponConfig 欄(T3)、指標(T4)。

## Steps

- [ ] M11 複驗(WP-23 T-exit ✅ 引用)記 progress。
- [ ] `bullet.ts` + 演進 golden(平飛/拋體/非法 dt 拋錯)。
- [ ] `sweptHit.ts` + 命中 golden(含 tunneling/邊界 fixture)。
- [ ] 命中語意 spec(doc comment + progress Decision Log)。
- [ ] `npx vitest run` 全綠;模組零相依證據(import 清單)。

## Definition of Done

- golden 全綠(位置序列/命中 tick 逐位);非法 dt 拋錯;模組零 three/DOM/sim import;
  OQ-25.3 語意定案記 ledger。

## Commit

`feat(wp-25): T2 projectile 數學核心(stepBullet/sweptHitTest + golden;零相依)`
