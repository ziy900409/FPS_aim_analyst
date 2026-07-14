# Enhancement — tracer 逐 tick 軌跡重播(方法 B)

> WP-25 ballistics-tracer(**M12** 已交付,PR [#22](https://github.com/ziy900409/FPS_aim_analyst/pull/22))之後的 enhancement 提案。
> **狀態**:⬜ Proposed — 待 S1(HITL)拍板;正式 WP/task 編號與 [DECISIONS.md](../../../DECISIONS.md) 入帳為 S1 職責(GD-15 編號受管,本檔不逕自認號)。
> Companion:[README.md](README.md) · [CONTEXT.md §H](../../../../../CONTEXT.md)

---

## 1. 動機

現行 tracer 一發只存一組 `origin→endpoint`(單段直線,[TracerView.ts](../../../../../src/render/TracerView.ts) / [SharedState.ts `ShotRayRing`](../../../../../src/state/SharedState.ts))。對 projectile(有重力弧線)無法呈現真實飛行路徑,也無法「重播」子彈逐 tick 飛行。本 enhancement 讓 tracer 能**逐 tick 重建並重播** projectile 弧線。

hitscan 為瞬時、無逐 tick 弧線 → 重播只對 **projectile** 有意義;hitscan tracer 維持單段直線。

## 2. 方法 B(render 端重算)— 為何是本階段最佳

利用「projectile 演進 = 固定 1/128s 純決定性函式」(`stepBullet`,參數由 config 注入)這一事實:render 只要拿到 spawn 起始條件,就能用**同一支純函式**重算出與 sim 逐位相同的弧線。

- sim 熱路徑**零額外負擔**(產彈點只多存幾個純量,非每 tick 寫點)。
- ring 記憶體最省;因共用同一純函式 → 重播弧線與命中判定用軌跡**逐位一致**。
- 多把槍只要 `model` 相同、參數不同 → 差異被 `(spawn 速度, gravityU, flightTicks)` 純量吸收,render 端零分支。

**取捨邊界(記為 OQ)**:讓 B 退化的不是「槍變多」,而是「演進 **model** 增生」(drag/wind/homing…,目前 out of scope)。屆時需維持**單一真實來源**的 `model` dispatch;若 model 多樣性高、或不願 render 依賴物理,則改採**方法 A**(sim 逐 tick 寫實際位置,model-agnostic)。→ 見 §5 OQ。

## 3. 切片(tracer bullets)→ GitHub issues

| # | 切片 | 型 | Issue | Blocked by |
|---|---|---|---|---|
| S1 | 設計拍板 + task 規格 + 決策入帳 | HITL | [#23](https://github.com/ziy900409/FPS_aim_analyst/issues/23) | — |
| S2 | 共用軌跡重算純函式 + golden | AFK | [#24](https://github.com/ziy900409/FPS_aim_analyst/issues/24) | #23 |
| S3 | `ShotRayRing` 存 spawn 參數 + sim 寫入(hitscan 零破壞) | AFK | [#25](https://github.com/ziy900409/FPS_aim_analyst/issues/25) | #24 |
| S4 | `TracerView` 折線重播(instant polyline)+ render tests | AFK | [#26](https://github.com/ziy900409/FPS_aim_analyst/issues/26) | #24, #25 |
| S5 | 時間重播:播放游標(即時飛行) | AFK | [#27](https://github.com/ziy900409/FPS_aim_analyst/issues/27) | #26 |
| S6 | dev/test projectile fixture + E2E smoke | AFK | [#28](https://github.com/ziy900409/FPS_aim_analyst/issues/28) | #26 |

## 4. 硬約束(CLAUDE.md §4,不可破壞)

- **tracer render-only**:sim 最多寫 `SharedState` 預配置 ring;`TracerView` 唯讀繪製,不回寫 sim、不進 export、不改命中/指標語意。
- **GC 紀律**:新增欄位/序列一律預配置 typed-array、物件重用、環狀覆寫,禁 push 物件。
- **子彈永不測場景**(GD-6):重播只畫線,不與場景幾何互動。
- **決定性**:render 重算用同一支 `stepBullet`、固定 1/128s;禁時鐘、禁 `Math.random`、禁變動 dt。
- **hitscan 逐位不變**:hitscan 路徑與既有決定性 baseline 零重錄(S3 首要 DoD)。

## 5. Open Questions

| ID | 問題 | 現議 |
|---|---|---|
| OQ-25.4(候選) | tracer 端點語意由「單段 origin→endpoint」擴為「逐 tick 序列」,與 OQ-25.1(未命中端點)如何對帳 | S1 拍板;未命中彈重播至消滅點,命中彈重播至命中 tick |
| OQ-25.5(候選) | 演進 model 增生時是否改用方法 A | 觸發 = 落地第二種 projectile 演進 model(非「槍變多」);在此之前維持方法 B + 單一真實來源 dispatch |

> 正式 OQ 編號 / DECISIONS 條目由 S1(HITL)入帳。
