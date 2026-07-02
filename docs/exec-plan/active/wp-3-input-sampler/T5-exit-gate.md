# T5 / T-exit — Exit gate

> Part of [WP-3 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Low / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)；docs only |
| **Status** | ✅ DONE (2026-07-01) |

## Objective
驗證 F1 採集整體綠燈、map PLAN WP-3 驗收、更新索引、交棒 WP-5（消費這些事件做命中/急停）。

## Steps
- [x] `npx vitest run` 綠燈（鍵盤/滑鼠/開火/消費 + WP-2 決定性回歸）→ **8 files / 54 passed**（InputSampler 14 · consume 5 · InputRing 8 · SimLoop 6 · determinism 9 無回歸 · SharedState 4 · render/loop 8）。
- [x] `npx tsc --noEmit` **exit 0**；`npx vite build` **✓ built**（dev 觀測縫由 `import.meta.env.DEV` 剝除、不入 production bundle）。
- [x] 瀏覽器端到端驗（真實 Edge，Playwright `tests/e2e/input-sampler.spec.ts`）→ **3 passed**：鍵盤 trusted A/D → 入緩衝 → sim 消費 → 套用 vx + 推進位置（FR-3.1/3.4）· 同步探針帶同源 `timeStamp` 入 ring + 非採集鍵忽略 + 未鎖定 fire 被閘門擋（FR-3.1/3.3/OQ-3.3）· pointermove coalesced 子樣本各入 ring（FR-3.2）。觀測縫 = `main.ts` dev-only `window.__aimDebug`。
- [~] 手動驗（**鎖定中** fire 入緩衝的正向路徑）：Pointer Lock 需真實手勢、e2e 無法穩定自動化（自動化只驗未鎖定的負向路徑）→ 步驟見 [manual-verification.md](manual-verification.md) §B，由使用者於瀏覽器確認。
- [x] map 下方 4 項驗收 → 證據；勾選。
- [x] 翻 [頂層索引](../../README.md) §2 WP-3 ✅。
- [x] progress.md 寫 `Outcomes & Retrospective`。
- [ ] （條件性）`gh pr create`：CI 未設；本機紅綠燈證據記於 progress.md，PR 由使用者視需要開。

## Acceptance criteria（PLAN WP-3 / F1）→ evidence
- [x] 鍵盤事件帶時間戳入緩衝 → **T1**（unit `InputSampler.test.ts`：keydown/keyup 蓋 `event.timeStamp`、A/D/W/S 過濾、`event.repeat` 不重入、時間戳原樣保留）**+ e2e**（`input-sampler.spec.ts`：真實 Edge trusted A/D 端到端 + 同步探針時間戳同源 OQ-3.3）。
- [x] 滑鼠 coalesced 次幀樣本無遺漏 → **T2**（unit：多子事件全數入緩衝、`getCoalescedEvents` 缺席 fallback 單筆）**+ e2e**（`input-sampler.spec.ts`：真實 Edge 3 coalesced 子樣本各入 ring）。
- [x] 開火事件帶時間戳 → **T3**（unit：鎖定中左鍵入緩衝+時間戳、未鎖定不採、非左鍵不採）**+ e2e**（未鎖定 fire 被閘門擋，負向）**+ 手動**（鎖定中入緩衝的正向，[manual-verification.md](manual-verification.md) §B）。
- [x] sim 依時序、無遺漏消費並排空 → **T4 + T4b**（unit `consume.test.ts`：亂序→升冪、跨 tick 分批、邊界嚴格 `<`、排空、遲到 `lateEventCount`；`InputRing.test.ts`：真 ring 繞圈重用、滿拒收不丟最舊 `bufferOverflow`、寫入端保序；`determinism.test.ts` 9 tests 無回歸）**+ e2e**（真實 Edge 鍵盤 → sim 消費 → vx/位置變更）。

## Definition of Done
- [x] 4 項驗收勾選有證據（unit + 真實瀏覽器 e2e）；頂層索引 WP-3 ✅；交棒 note 指向 WP-5。
- ⚠️ 例外：**鎖定中** fire 的正向路徑因 Pointer Lock 需真實手勢、無法穩定自動化 → 手動驗（[manual-verification.md](manual-verification.md) §B）；非阻斷（負向閘門路徑已 e2e，機制已 unit 覆蓋）。

## 交棒 WP-5（Handoff）
F1 採集層就緒：三類事件（key/mouse/fire）帶高解析度 `event.timeStamp` 入固定欄位 ring buffer，sim 端 [`consume`](../../../../src/input/consume.ts) 依 `t` 升冪、半開窗嚴格 `<`（GD-3）、無遺漏排空。**WP-5 接手消費這些事件**：`applyInput`（現 [SimLoop.ts](../../../../src/loop/SimLoop.ts) 佔位只 A/D 切 vx）換真 `MovementController`（friction/accel + 簡化急停，OQ-3.1 反向鍵語意）、fire 事件於 simStep 內就地 raycast（`HitDetector`，H1 單一 hitbox）、mouse 樣本驅動準心供 raycast。研究 metadata（`lateEventCount` / `bufferOverflow`）待 WP-7 匯出。

## Commit
`docs(wp-3): exit gate — F1 驗收 map + 頂層索引狀態 + 交棒 WP-5`
