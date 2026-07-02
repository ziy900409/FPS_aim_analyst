# T5 / T-exit — Exit gate

> Part of [WP-4 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Low / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)；docs only |
| **Status** | ✅ DONE（2026-07-02，程式面全綠；瀏覽器手動驗待 WP-5 kill trigger，見下） |

## Objective
驗證 F2 整體綠燈、map PLAN WP-4 驗收、更新索引、交棒 WP-5（命中 + 急停消費目標/hitbox）與 WP-6（drill 接管目標生成）。

## Steps
- [x] `npx vitest run src` 綠燈 — **43/43**（TargetManager 11 含 t_visible 蓋一次 / 時間源 sim clock / 交替確定性 / 無效 id 守衛；TargetView 5；WP-2 決定性 9 無回歸）。
- [x] `npx tsc --noEmit` exit 0。
- [x] `npx vite build` ✓（1.60s；chunk-size 警告為既有 three bundle，非本 WP 引入）。
- [x] 五軸 code review（correctness / readability / architecture / security / performance）→ **Approve**，無 Critical/Required（見 progress.md Outcomes）。
- [~] 手動驗：**準心置中**可即時驗；**左右交替出現**需 kill trigger（WP-5 命中訊號）方能端到端觸發，本 WP 無佔位擊殺鍵 → 交棒 WP-5 一併瀏覽器驗。`t_visible` 正確性已由單元測試（時間源 + 蓋一次）覆蓋，優於鉤子手驗。
- [x] map 下方 4 項驗收 → 證據；勾選。
- [x] 翻 [頂層索引](../../README.md) §2 WP-4 ✅。
- [x] progress.md 寫 `Outcomes & Retrospective`（t_visible 時間源確認、交替決定性）。
- [ ] （條件性）`gh pr create` 或記本機證據 — 本機紅綠燈證據已記於 progress.md；PR 延後（沿用 repo 慣例）。

## Acceptance criteria（PLAN WP-4 / F2）→ evidence
- [x] 可生成目標（mesh + hitbox）→ **T1** — `TargetView.test.ts` 5 tests：visible→出現且位置/尺寸取自 state、reuse pool、dispose；hitbox=mesh 同來源（box）。
- [x] `t_visible` 在 sim tick 內正確蓋戳 → **T2** — `TargetManager.test.ts`「時間源為注入 sim clock」斷言戳 ≈1007.8 且 `< 1e6`（排除 Date.now 域）+「只蓋一次」。
- [x] 目標左右交替生成 → **T3** — `killSequence` 斷言 R→L→R→L… / L→R…、決定性重跑一致、無效 id 不翻面。
- [x] 螢幕中心準心 → **T4** — `Crosshair.ts` `left/top:50%+translate(-50%,-50%)` 恆置中、`pointer-events:none` 穿透；DOM overlay 手動驗慣例（無 jsdom）。

## Definition of Done
- 4 項驗收勾選有證據 ✅；頂層索引 WP-4 ✅；交棒 note 指向 WP-5 / WP-6（見 progress.md Outcomes）。
- **殘留**：端到端「左右輪替出現」瀏覽器 spot-check 隨 WP-5 kill trigger 一併驗（單元層已覆蓋交替邏輯本身）。

## Commit
`docs(wp-4): exit gate — F2 驗收 map + 頂層索引狀態 + 交棒 WP-5/6`
