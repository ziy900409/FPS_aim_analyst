# T3 — sim 整合(WeaponConfig.bullet gate + 子彈 arena + shot/hit 事件解耦;hitscan 零破壞)

> Part of [WP-25 ballistics-tracer](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2(數學核心 golden 綠) |
| **Risk / Cplx** | **High** / High(唯一動 sim 核心語意的切片——零破壞閘是全部風險所在) |
| **Touches** | MODIFY `src/weapon/WeaponConfig.ts`(`bullet?` + 驗證)、`src/loop/SimLoop.ts`(產彈點分支 + arena 逐 tick 演進)、`src/state/SharedState.ts`(bullet arena 落點)、`src/data/DataRecorder.ts` + `export.ts` + `metadata.ts`(`hit` 事件 + `meta.weapon.bullet`)、`docs/operational/schema.md` + 測試 |
| **狀態** | ⬜ |

## Objective

projectile 進 sim(FR-E9):`WeaponConfig.bullet?` gate——未給走現行 hitscan
路徑**逐位不變**;給了則產彈點 spawn 子彈實體(方向 = 既有 viewAngles +
rawPunch×2 + spread 合成,**零新隨機**),逐 tick 演進 + swept 命中,
shot 與 hit 事件解耦。

## In scope

- `WeaponConfig.ts`:`bullet?: { model:'projectile'; speedU; gravityU; maxRangeU }`;
  `validateWeapon` 擴充(正有限、GD-17 範圍 sanity、飛行時間 < 2 tick 組合警告)。
- **零破壞閘(DoD 首項)**:config 無 `bullet` → 產彈點程式碼路徑不變;
  **先跑 stage1–3 全部決定性/golden 回歸零修改全綠**再進新功能(baseline 零重錄)。
- SimLoop:
  - 產彈點分支:projectile 時以既有合成方向 `spawnBullet` 進 arena
    (**取代** `ballisticRaycast` 呼叫,不疊加);tracer 寫入延後到命中/消滅
    (endpoint 才確定,沿 OQ-25.1);
  - **arena**:preallocated `BULLET_CAP`(OQ-25.2)欄位式儲存 + 重用,滿載拒發 + 旗標
    (比照 ring 溢位語意,旗標進 metadata);
  - 逐 tick:目標 motion 更新(①)**之後**、記錄(④)之前——每活彈 `stepBullet` +
    `sweptHitTest`(本 tick 目標 AABB);命中 → 既有命中處理鏈(markKilled/pushImpact/
    首發 outcome 回填)+ `hit` 事件;超 `maxRangeU`/落地 → 消滅 + miss tracer;
  - drill reset 清 arena。
- 事件/資料(v2 additive):`{ type:'hit', t, timeOfFlightMs, shotSeq }`
  (`shotSeq` 關聯該發 shot;fire row 語意不變);`meta.weapon.bullet` 快照;
  CSV events 加欄;`schema.md` 對帳。
- 決定性:projectile fixture(固定輸入序列 + GD-17 武器檔)跨 render FPS
  sim 狀態(彈位置/命中 tick/事件)逐位一致(新 baseline)。

## Out of scope

- 指標語意/結果頁/lead(T4);drill config 掛載(**M12 未過不得進 drill config**,
  fixture 限測試內使用)。

## Steps

- [ ] WeaponConfig 擴欄 + 驗證測試。
- [ ] **hitscan 零破壞證據**(改動前基準 → 分支引入後 stage1–3 回歸零修改全綠)。
- [ ] arena + 產彈點分支 + 逐 tick 演進/命中(T2 模組接線,不重寫數學)。
- [ ] `hit` 事件 + meta + schema.md 對帳 + export 測試。
- [ ] projectile 決定性 fixture(跨 FPS 逐位)+ 滿載/reset 測試。
- [ ] `npm run test:ci` exit 0。

## Definition of Done

- hitscan baseline 零重錄(零破壞證據記 progress);projectile 決定性 fixture 綠;
  arena 熱路徑零配置;`hit` 事件 round-trip 綠;schema.md 已對帳;`test:ci` exit 0。

## Commit

`feat(wp-25): T3 projectile sim 整合(config gate + 子彈 arena + hit 事件;hitscan 零破壞)`
