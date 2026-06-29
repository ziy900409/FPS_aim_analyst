# T0 — Entry gate

> Part of [WP-6 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-4 exit ✅、WP-5 exit ✅（M2） |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ⬜ TODO |

## Objective
確認 M2 達成、`TargetManager` 可被參數化驅動，敲定 DrillConfig schema 範圍與位置抽象（OQ-6.1~6.4）。

## Steps
- [ ] 確認 WP-5 exit ✅（M2）+ WP-4 `TargetManager`（spawn/markKilled/reset）可承接 config 驅動。
- [ ] 鎖 OQ-6.1：schema = drillId/targets/sequence/timing/endCondition。
- [ ] 鎖 OQ-6.2：L/R 槽位 + 距離抽象。
- [ ] 鎖 OQ-6.3：結束條件預設目標數達標。
- [ ] 鎖 OQ-6.4：載入驗證失敗 throw、不啟動。
- [ ] README §1 + progress.md 翻 ✅；加 dated log。

## Definition of Done
- **PASS 條件**：M2 達成 + TargetManager 可參數化；否則 STOP。
- OQ-6.1~6.4 翻 ✅。

## Commit
`docs(wp-6): T0 entry gate — 確認 M2 + 鎖 OQ-6.1~6.4`
