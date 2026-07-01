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
- [x] `npx tsc --noEmit` **exit 0**；`npx vite build` **✓ built**。
- [~] 手動驗（鎖定中操作，緩衝收到帶時間戳的鍵/滑鼠/開火事件並被 sim 排序消費）：**本 session 非互動、無法跑瀏覽器手動驗**。採集/消費機制已由單元測試逐項覆蓋（下方證據）；互動式瀏覽器驗證延至 **WP-9 整合**（`tests/e2e/` 現僅 WP-0 isolation/backend，無 WP-3 輸入 e2e）或由使用者手動確認。
- [x] map 下方 4 項驗收 → 證據；勾選。
- [x] 翻 [頂層索引](../../README.md) §2 WP-3 ✅。
- [x] progress.md 寫 `Outcomes & Retrospective`。
- [ ] （條件性）`gh pr create`：CI 未設；本機紅綠燈證據記於 progress.md，PR 由使用者視需要開。

## Acceptance criteria（PLAN WP-3 / F1）→ evidence
- [x] 鍵盤事件帶時間戳入緩衝 → **T1**（`InputSampler.test.ts`：keydown/keyup 蓋 `event.timeStamp`、A/D/W/S 過濾、`event.repeat` 不重入、時間戳原樣保留）。
- [x] 滑鼠 coalesced 次幀樣本無遺漏 → **T2**（`InputSampler.test.ts`：多子事件 pointermove 全數入緩衝、樣本數=子事件數>1、`getCoalescedEvents` 缺席 fallback 單筆）。
- [x] 開火事件帶時間戳 → **T3**（`InputSampler.test.ts`：鎖定中左鍵入緩衝+時間戳、未鎖定不採、非左鍵不採）。
- [x] sim 依時序、無遺漏消費並排空 → **T4 + T4b**（`consume.test.ts`：亂序→升冪、跨 tick 分批、邊界嚴格 `<`、排空、遲到 `lateEventCount`；`InputRing.test.ts`：固定欄位真 ring 繞圈重用、滿拒收不丟最舊 `bufferOverflow`、寫入端 bounded insertion 保序；`determinism.test.ts` 9 tests 無回歸）。

## Definition of Done
- [x] 4 項驗收勾選有證據；頂層索引 WP-3 ✅；交棒 note 指向 WP-5。
- ⚠️ 例外：互動式瀏覽器手動驗延後（見 Steps，非阻斷——4 項驗收機制皆有單元證據）。

## 交棒 WP-5（Handoff）
F1 採集層就緒：三類事件（key/mouse/fire）帶高解析度 `event.timeStamp` 入固定欄位 ring buffer，sim 端 [`consume`](../../../../src/input/consume.ts) 依 `t` 升冪、半開窗嚴格 `<`（GD-3）、無遺漏排空。**WP-5 接手消費這些事件**：`applyInput`（現 [SimLoop.ts](../../../../src/loop/SimLoop.ts) 佔位只 A/D 切 vx）換真 `MovementController`（friction/accel + 簡化急停，OQ-3.1 反向鍵語意）、fire 事件於 simStep 內就地 raycast（`HitDetector`，H1 單一 hitbox）、mouse 樣本驅動準心供 raycast。研究 metadata（`lateEventCount` / `bufferOverflow`）待 WP-7 匯出。

## Commit
`docs(wp-3): exit gate — F1 驗收 map + 頂層索引狀態 + 交棒 WP-5`
