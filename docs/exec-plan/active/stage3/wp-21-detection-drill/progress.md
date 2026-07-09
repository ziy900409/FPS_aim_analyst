# WP-21 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 進行中 — T0 entry gate PASS 2026-07-09; T1 next

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 seeded spawn | ⬜ |
| T2 偵測 drill config | ⬜ |
| T3 離線推導 spec + fixture | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S3-2 t_detect 參數起點(θ_v 倍率 / k tick;spec 標「暫定」) | ✅ resolved | θ_v = 3× 前刺激窗 500ms aim 角速度 SD;k = 4 tick(128Hz 下約 31.25ms)。T3 spec 需標「暫定,pilot 校準」並保留離線敏感度分析。 |
| OQ-21.1 `spawnArea` 幾何範圍預設(yawDegRange/distanceURange 與房間/場景/走廊的相容範圍) | ✅ resolved | `targets.spawnArea` 預設 `{ yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] }`。目標 y/hitbox 沿用 `TargetManager` 現況(`y=1.5`,1×2×1u);最遠中心 z=-4.4 時 hitbox 前緣仍在 placeholder-room 北牆 z=-5 內,橫向極值小於現行 ±2u 側槽。 |
| OQ-21.2 seeded 取樣次序定稿(計畫預設:delay → yaw → distance)+ spawn 事件位置欄落點(v2 additive) | ✅ resolved | 取樣次序固定為 `delay → yaw → distance`。位置落點為既有 `visible` event 的 additive 欄位 `targetX`/`targetY`/`targetZ`(JSON),CSV events 追加同名欄;不新增 `spawn` event type。`meta.spawn` 記 `seed`、`spawnArea`、`spawnDelayMsRange` 快照。 |

---

## Log

### 2026-07-09 07:35Z — T0 entry gate PASS(GD-7/8 收斂 + spawnArea/取樣次序決議 + WP-19 對帳)

- **基準驗證**:
  - `npm run test` 先被本機 PowerShell execution policy 擋在 `npm.ps1`。
  - `npm.cmd run test` 在 sandbox 內進到 Vitest,但 esbuild 讀 `vite.config.ts` 時被上層目錄權限擋住。
  - 提升權限重跑同一條 `npm.cmd run test` → Vitest **56 files / 415 tests pass**,exit 0。
- **TargetManager / seed 現況證據**:
  - `src/drill/schema.ts` 目前驗證並保留 `sequence.seed`(有限數),但不賦予 spawn 語意。
  - `src/sim/TargetManager.ts` `createTargetManager(config)` 只讀 `targets.distance`、`targets.count`、`targets.motion`、`sequence.alternation`;註解明確寫 `sequence.seed` 為未來隨機化保留、現階段不讀 seed。
  - 現行 spawn = 單 active target;位置 `{ x: ±2, y: 1.5, z: -distance }`,spawn 當 tick `visible: true/alive: true`。
  - `tick(state, nowMs)` 在無存活目標且未達 spawn 上限時補生,同 tick 對 visible 且未蓋戳目標寫 `state.tVisible.set(id, nowMs)`;`t_visible` 語意仍是 spawn tick 的 sim clock。
  - `markKilled` 只有真的移除目標才翻面並刪該 id 的 `tVisible`;`reset` 清 targets/tVisible/計數並由 `seq` 或 config 首字決定首側。
- **T1 零破壞閘沿用的既有測試清單**:
  - `src/sim/TargetManager.test.ts`:spawn 即可見、`t_visible` 只蓋一次、sim clock 時間源、`markKilled`/`reset`、嚴格左右交替、config-driven distance/count/motion、同 config 決定性。
  - `src/drill/schema.test.ts`:合法 config 保留 `seed`/timing/motion,非法欄位帶路徑錯誤。
  - `src/loop/__tests__/determinism.test.ts`:M1 fixed-step determinism、事件 tick index、large gap clamp 決定性。
  - `tests/regression/determinism.test.ts`:完整 sim + DataRecorder 跨 render FPS bit-exact、場景純裝飾跨場景 bit-exact、重播 bit-exact。
  - `src/loop/__tests__/fire-determinism.test.ts`:連發出彈 tick/排程序列與重播 bit-exact。
  - `src/loop/__tests__/recoil-wiring.test.ts`:同 seed recoil/spread bit-exact、不同 pump FPS 末態一致。
  - `src/loop/__tests__/sim-clock-drift.test.ts`:卡頓後 sim clock re-anchor 防永久漂移。
- **OQ 決議**:
  - OQ-21.1:`spawnArea` 預設 `yawDegRange [-25,25]`, `distanceURange [3.2,4.4]`。Alternatives Considered:更大距離上限(4.8u)可增加偏心度,但 placeholder-room 內 hitbox 會越過 z=-5 北牆;更窄 yaw(±15°)較保守但偏心度範圍不足。採 ±25°/3.2–4.4u,保留現行側槽等級 eccentricity 且不越過佔位房間幾何。
  - OQ-21.2:seeded stream 每 trial 固定抽樣 `delay → yaw → distance`。Alternatives Considered:先抽位置再抽 delay 較直覺,但會讓只調 delay 分佈時改變位置序列;delay 先抽符合 WP-21 README 既定契約並成為 golden 序列的一部分。
  - OQ-21.2 event 落點:沿用 `visible` event,追加 `targetX/targetY/targetZ`,不新增 `spawn` event type。Alternatives Considered:新增 `spawn` event 可語意更直,但現行 schema 已以 `visible.t` 表示 `t_visible`;新增 event 會讓分析端同時處理兩個起點事件。
  - OQ-S3-2:`t_detect` 起點維持 θ_v = 3× 前刺激窗 SD、k=4 tick;T3 spec 必須標「暫定,pilot 校準」。
- **WP-19 淨空對帳**:
  - 現行 `src/scene/clearance.ts` `deriveTargetEnvelopes(drill)` 只用 `targets.distance`、active sides(±2u)與 `targets.motion`;因 schema 尚無 `targets.spawnArea`,**尚未形式涵蓋 spawnArea 極值**。
  - 結論:WP-21 T1/T2 啟用 `targets.spawnArea` 前,必須把 spawnArea polar 極值納入 clearance target envelope(或另拆同等 gate),否則場景淨空證據只覆蓋舊左右側槽。此待辦已互記到 WP-19 progress。
- **文件同步**:`T0-entry-gate.md` 狀態/Steps、`task-checklist.md`、本 progress、stage3 `README.md` §8、`CLAUDE.md` §4 與 WP-19 progress 已回寫。`git diff --stat` 應不含 `src/`。
- **Entry-gate conclusion**:**PASS**。T1 可開始,但 T1 的 DoD 必須同時守住「無 seed 路徑逐位不變」與上述 WP-19 clearance spawnArea 對帳。

### 2026-07-06 — Plan authored
- 由 stage3 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T3 + T-exit)。
- 決議依據:GD-8(pop-in 刺激 `t_visible`=spawn tick 語意不變;t_detect = 瞄準 onset
  離線推導;偏心度共變數)、GD-7(原始資料全記錄——推導輸入 = v2 逐 tick 欄)、
  GD-5(spawn 隨機化一律 seeded,重用 `createRan1`)。
- 設計要點:**零破壞不變式**(無 seed 路徑逐位不變)是 T1 的 DoD 首項;
  t_detect 推導完全離線(引擎零新計算),spec 即分析端介面。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD 收斂 + spawnArea 決議,docs-only。
