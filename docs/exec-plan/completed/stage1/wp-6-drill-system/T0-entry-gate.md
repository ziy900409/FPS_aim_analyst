# T0 — Entry gate

> Part of [WP-6 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-4 exit ✅、WP-5 exit ✅（M2） |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ✅ DONE（2026-07-02） |

## Objective
確認 M2 達成、`TargetManager` 可被參數化驅動，敲定 DrillConfig schema 範圍與位置抽象（OQ-6.1~6.4）。

## Steps
- [x] 確認 WP-5 exit ✅（M2）+ WP-4 `TargetManager`（spawn/markKilled/reset）可承接 config 驅動。
- [x] 鎖 OQ-6.1：schema = drillId/targets/sequence/timing/endCondition。
- [x] 鎖 OQ-6.2：L/R 槽位 + 距離抽象。
- [x] 鎖 OQ-6.3：結束條件預設目標數達標。
- [x] 鎖 OQ-6.4：載入驗證失敗 throw、不啟動。
- [x] README §1 + progress.md 翻 ✅；加 dated log。

## Verification evidence（2026-07-02）
- **M2 ✅**：頂層索引 [`../../README.md`](../../README.md) §2 WP-5 = ✅ 完成（2026-07-02）、§3 M2 ✅（2026-07-02）。
- **WP-4 ✅**：§2 WP-4 = ✅ 完成（2026-07-02）。
- **TargetManager 可參數化**：[`../../../../src/sim/TargetManager.ts`](../../../../src/sim/TargetManager.ts) 具 `tick`/`markKilled`/`reset`；已由 `opts.distance` 參數化、L/R 槽位 (`sideX`) 與 `nextSide` 交替皆內部驅動、無隨機源（決定性）。原始碼註解已標「佔位，WP-6 drill config 接管」→ T2 可全參數化由 DrillConfig 驅動。

## Definition of Done
- **PASS 條件**：M2 達成 + TargetManager 可參數化；否則 STOP。
- OQ-6.1~6.4 翻 ✅。

## Commit
`docs(wp-6): T0 entry gate — 確認 M2 + 鎖 OQ-6.1~6.4`
