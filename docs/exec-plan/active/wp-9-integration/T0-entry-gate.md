# T0 — Entry gate

> Part of [WP-9 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-0 ~ WP-8 全部 exit ✅（M1/M2/M3 達成） |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ⬜ TODO |

## Objective
確認所有上游 WP 已交付（頂層索引 WP-0~8 皆 ✅、M1/M2/M3 達成），並敲定 E2E/效度/回歸的測試策略與附錄 E 自動/手動分工（OQ-9.1~9.4）。

## Steps
- [ ] 確認 [頂層索引](../../README.md) §2 WP-0~8 皆 ✅，§3 M1/M2/M3 達成。
- [ ] 盤點現有測試（各 WP 的 Vitest/Playwright）作為回歸基線。
- [ ] 鎖 OQ-9.1：E2E harness 合成輸入 + COI/匯出斷言。
- [ ] 鎖 OQ-9.2：反應分布 ~150–250 ms sanity。
- [ ] 鎖 OQ-9.3：CI 或 `test:ci` 本機腳本閘。
- [ ] 鎖 OQ-9.4：附錄 E 自動/手動逐項標註。
- [ ] README §1 + progress.md 翻 ✅；加 dated log。

## Definition of Done
- **PASS 條件**：WP-0~8 全 exit ✅；否則 STOP（缺上游無法整合）。
- OQ-9.1~9.4 翻 ✅。

## Commit
`docs(wp-9): T0 entry gate — 確認 WP-0~8 交付 + 鎖 OQ-9.1~9.4`
