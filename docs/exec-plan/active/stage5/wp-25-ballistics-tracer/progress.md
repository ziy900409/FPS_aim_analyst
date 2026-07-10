# WP-25 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 未開始

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 tracer | ⬜ |
| T2 數學核心 | ⬜ |
| T3 sim 整合 | ⬜ |
| T4 指標語意 | ⬜ |
| T-exit(M12) | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S5-2 projectile 參數域(speedU/gravityU/maxRangeU 表;與 distance 聯動)→ **GD-17** | 🟡 待 T0 | 計畫預設:飛行時間 8–32 tick 反推 speedU;下墜角尺寸 0.1–0.5× 目標角高反推 gravityU;2–3 組武器檔;拍板入 DECISIONS.md GD-17 |
| OQ-S5-5 lead 誤差是否進正式指標 | 🟡 待 T4 | 計畫預設:spec-only 離線推導(引擎零計算);pilot 顯示構念有效再立案晉升 |
| OQ-25.1 未命中彈的 tracer 端點(engagement plane 投影 vs maxRange 點) | 🟡 待 T1 | 預設:hitscan 沿用 `projectMissOntoEngagementPlane` 既有語意;projectile 用消滅點(maxRange/落地高度) |
| OQ-25.2 `BULLET_CAP` 容量與滿載政策 | 🟡 待 T3 | 預設:`magSize × 2`(單 peek 一匣 + 飛行殘留裕度);滿載拒發 + 旗標(比照 ring 溢位語意) |
| OQ-25.3 移動目標 × 飛行彈命中語意(swept 對本 tick 目標 AABB) | 🟡 待 T2 | 預設:swept segment vs 本 tick 目標 AABB(決定性可斷言);sub-tick 目標內插與彈道的交互留 spec 註記 |

---

## Log

### 2026-07-10 — Plan authored

- 由 stage5 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T4 + T-exit)。
- 決議依據:GD-6(子彈永不測場景幾何——與「純裝飾場景」本體論一致)、
  WP-10→WP-13 模式(先鎖數學 golden 再接線)、WP-11 產彈點 seam(recoil `onFire` 唯一掛點,
  tracer 寫入與 projectile spawn 掛同一點)、2026-07-10 架構評估
  (`ballisticRaycast(camera, state, subAlpha?)` @ SimLoop.ts:109、`projectMissOntoEngagementPlane` @ :152、
  ImpactRing/ImpactView pattern 為 tracer 顯示的複製模板)。
- 設計要點:**tracer 與 projectile 嚴格分離**(T1 render-only 可先交付);
  **hitscan 預設逐位不變**是 M12 門控核心——這就是使用者要的 Bullet Type
  Enabled/Disabled 開關,同時保護 stage1–3 全部 golden 資產。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD-17 拍板,docs-only;
  T1 可與 WP-23/24 並行。

