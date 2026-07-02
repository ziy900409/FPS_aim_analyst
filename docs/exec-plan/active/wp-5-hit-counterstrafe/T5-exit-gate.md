# T5 / T-exit — Exit gate（宣告 M2）

> Part of [WP-5 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Med / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)（WP-5 ✅ + M2）；docs + render 佔位（main.ts display-scale / dev HUD） |
| **Status** | ✅ DONE（2026-07-02）— M2 達成 |

## Objective
驗證 F3 整體綠燈，宣告 **M2（核心玩法成立）**：能橫移、急停、開火、命中、首發。交棒 WP-6（drill 編排）/ WP-7（記錄這些事件）。

## Steps
- [x] `npx vitest run` 綠燈（命中/首發/橫移/急停 + WP-2/3 決定性回歸）。→ **99/99 綠**（含 determinism 9/9）。
- [x] `npx tsc --noEmit` exit 0。
- [x] 手動驗（核心玩法 loop）：移動 → 反向鍵急停 → 停止開火命中目標 → 對側生成 → 重複。→ **PASS（使用者確認 2026-07-02）**；橫移速度佔位 1:1 過快 → 加 render-only `SIM_TO_WORLD` display scale；1-tick 急停肉眼不可視 → 加 dev-only HUD（vx/stopped 閂鎖）佐證 gate 觸發。
- [x] map 下方 4 項驗收 → 證據；勾選。
- [x] 翻 [頂層索引](../../README.md) §2 WP-5 ✅ + §3 標記 **M2 達成**。
- [x] progress.md 寫 `Outcomes & Retrospective`（急停語意、首發 peek 邊界、決定性回歸）。
- [ ] （條件性）`gh pr create` 或記本機證據。→ 本機證據記於 progress.md；PR 由使用者視需要開。

## Acceptance criteria（PLAN WP-5 / F3 / M2）→ evidence
- [x] Raycaster 命中判定 + 部位 → **T1**（`HitDetector.test.ts` 8 例 + 手動驗端到端命中/擊殺/對側生成）
- [x] 首發判定不被掃射稀釋 → **T2**（`firstShot.test.ts` 8 例：同 peek 三槍只首發 true、換 peek 隱式 reset）
- [x] A/D 橫移正確（固定步長）→ **T3**（`MovementController.test.ts`：snap ±v/0、位移與 tick 切分無關 bit-exact）
- [x] 急停停止狀態正確 gate 開火 → **T4**（`MovementController.test.ts` 急停組 + `SimLoop.test.ts` 整合：stopped/vx gate 來源）

## Definition of Done
- [x] 4 項驗收勾選有證據；**M2 達成**並記於頂層索引；交棒 note 指向 WP-6 / WP-7。

## Commit
`docs(wp-5): exit gate — 宣告 M2 + 驗收 map + 交棒 WP-6/7`
