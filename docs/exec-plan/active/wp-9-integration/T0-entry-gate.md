# T0 — Entry gate

> Part of [WP-9 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-0 ~ WP-8 全部 exit ✅（M1/M2/M3 達成） |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ✅ DONE（2026-07-03）— WP-0~8 exit confirmed; OQ-9.1~9.4 locked |

## Objective
確認所有上游 WP 已交付（頂層索引 WP-0~8 皆 ✅、M1/M2/M3 達成），並敲定 E2E/效度/回歸的測試策略與附錄 E 自動/手動分工（OQ-9.1~9.4）。

## Steps
- [x] 確認 [頂層索引](../../README.md) §2 WP-0~8 皆 ✅，§3 M1/M2/M3 達成。
- [x] 盤點現有測試（各 WP 的 Vitest/Playwright）作為回歸基線。
- [x] 鎖 OQ-9.1：E2E harness 合成輸入 + COI/匯出斷言。
- [x] 鎖 OQ-9.2：反應分布 ~150–250 ms sanity。
- [x] 鎖 OQ-9.3：CI 或 `test:ci` 本機腳本閘。
- [x] 鎖 OQ-9.4：附錄 E 自動/手動逐項標註。
- [x] README §1 + progress.md 翻 ✅；加 dated log。

## Gate evidence（2026-07-03）

- **WP-0~8 exit**：頂層索引 §2 標示 WP-0~8 全部 ✅；§3 標示 **M1 ✅（2026-07-01）**、**M2 ✅（2026-07-02）**、**M3 ✅（2026-07-03）**。
- **Task checklists**：`docs/exec-plan/active/wp-0-*` 到 `wp-8-*` 的 `task-checklist.md` 皆無 `⬜` 待辦列。
- **Exit gate docs**：WP-0/WP-1/WP-7 使用 `T6-exit-gate.md`，WP-2~WP-6/WP-8 使用 `T5-exit-gate.md`；各 WP 均有 exit gate 文件。
- **Vitest baseline**：`npm.cmd test -- --run` → **24 files / 164 tests passed**，含 `src/loop/__tests__/determinism.test.ts` **9 tests**。
- **Playwright baseline**：`npm.cmd run test:e2e` → **6 passed**（Edge；isolation dev/preview、backend detection、InputSampler browser E2E）。
- **CI status**：目前沒有 `.github/` 目錄；T3 先新增 `test:ci` 本機閘，是否加 workflow 由 T3 視 repo CI 決定。

## OQ resolutions（locked by T0）

| ID | Resolution | Consequence |
|----|------------|-------------|
| **OQ-9.1** | E2E 自動化採 `window.__fpsTest` dev/test harness：合成輸入跑 drill，全程斷言 COI、匯出 payload、事件與統計一致。Pointer Lock / 原始輸入真實手感留手動驗收。 | T1 可不依賴 OS-level raw mouse automation；自動測完整資料鏈。 |
| **OQ-9.2** | 計時效度分兩層：已知間隔的確定性計算測試 + 實玩反應分布 ~150-250 ms 量級 sanity。這不是絕對硬體延遲校準。 | T2 fail 條件是單位/時鐘基準錯誤或系統性離譜偏移（如 <50 ms、>1 s）。 |
| **OQ-9.3** | 先以 `test:ci = tsc --noEmit && vitest run && playwright test` 作本機 exit-code gate；repo 目前無 `.github/`，CI workflow 為 T3 條件性新增。 | T3 必須讓一個命令涵蓋 typecheck、Vitest、Playwright。 |
| **OQ-9.4** | 附錄 E 分工：自動覆蓋 COI/backend metadata/128 Hz determinism/movement+gate/t_visible/firstShot/drill/export schema/metrics/反應時間；手動補 Pointer Lock 原始輸入與實際遊玩手感；規格中 2 個「階段 A+／延後」移動目標項不阻塞 M4。 | T4 的 `acceptance-stage-a.md` 以階段 A 10 項為硬閘，另列延後項為非阻塞。 |

## Definition of Done
- [x] **PASS 條件**：WP-0~8 全 exit ✅；否則 STOP（缺上游無法整合）。
- [x] OQ-9.1~9.4 翻 ✅。

## Commit
`docs(wp-9): T0 entry gate — 確認 WP-0~8 交付 + 鎖 OQ-9.1~9.4`
