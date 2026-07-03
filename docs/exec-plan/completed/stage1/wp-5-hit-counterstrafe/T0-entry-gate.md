# T0 — Entry gate

> Part of [WP-5 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-3 exit ✅、WP-4 exit ✅ |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ✅ DONE（2026-07-02）|

## Objective
確認輸入事件（WP-3）與目標/hitbox/`t_visible`（WP-4）就緒，敲定急停/首發/精準 gate 語意（OQ-5.1~5.4）——這些定義直接決定 §5 指標效度。

## Steps
- [x] 確認 WP-3 exit ✅（fire/key 事件入緩衝、sim 消費）+ WP-4 exit ✅（hitbox + t_visible + markKilled）。
- [x] 鎖 OQ-5.1：布林精準 gate（stopped→accurate；residualSpeed 二元 {0,±v} → 結果頁分類）。
- [x] 鎖 OQ-5.2：瞬間 snap 到 `v_strafe`(~250 u/s)、反向鍵穿越 tick 歸零（M1）。
- [x] 鎖 OQ-5.3：peek 起點 = t_visible；**P2 命中才推進**、`peekTimeoutMs` 防卡；新目標可見 reset 首發。
- [x] 鎖 OQ-5.4：**第一次命中**即擊殺 → markKilled（spawnDelay 0）。
- [x] README §1 + progress.md 翻 ✅；加 dated log。

## 驗證證據（2026-07-02）
- **WP-3 exit ✅**：`origin/main` PR #1（`wp-3-input-sampler`）已合併——`InputSampler` fire/key 事件入 ring、`consume` sim 端排序消費（`src/input/consume.ts`、`src/state/SharedState.ts` `createInputRing`）。
- **WP-4 exit ✅**：`origin/main` PR #2（`wp-4-target-tvisible`）已合併——progress.md 記 F2 全綠（五軸 review Approve、`tsc` exit 0、`vitest run src` 43/43）。就緒契約確認在 base：
  - `src/sim/TargetManager.ts`：`tick`（sim tick 蓋 `t_visible`=注入 sim clock nowMs、只蓋一次）、`markKilled`（撤除 → 翻面 nextSide → 對側 spawn）、單一 box hitbox（H1）`{width,height,depth,part?}`。
  - `src/state/types.ts` `TargetState`：`side/pos/visible/alive/hitbox/motion?`；`SharedState.tVisible: Map<id,ms>`、`player{vx,vz,x,z}`。
  - `src/render/TargetView.ts`、`src/ui/Crosshair.ts`（螢幕中心準心 = camera 正向射線來源，WP-5 raycast 同源）。
- **base 銜接**：WP-5 branch rebase 到 `origin/main`（f530210，含 WP-3 + WP-4）；`SimLoop.simStep` 已具 target-motion slot（命中判定之前）與佔位 strafe velocity，WP-5 換真 `MovementController` + `HitDetector`。
- **OQ-5.1~5.4** 全鎖（見 [progress.md](progress.md) ledger），與 [CONTEXT.md](../../../../CONTEXT.md) `HitDetector`(H1)/`MovementController`(M1)/首發(peek 錨)/殘速(階段 A 二元) 一致。

## Definition of Done
- **PASS 條件**：WP-3/WP-4 綠燈 + 急停/首發語意明確；否則 STOP。
- OQ-5.1~5.4 翻 ✅。

## Commit
`docs(wp-5): T0 entry gate — 確認 WP-3/4 + 鎖 OQ-5.1~5.4`
