# WP-70 — Task Checklist

| 狀態 | Task | 交付 | 相依 | 風險 |
|---|---|---|---|---|
| ⬜ | **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | — | Med |
| ⬜ | **T1** per-run fullscreen 旗標 | [T1-per-run-fullscreen-flag.md](T1-per-run-fullscreen-flag.md) | T0 | High |
| ⬜ | **T2** protocol 路徑判準一致 | [T2-protocol-path-consistency.md](T2-protocol-path-consistency.md) | T1 | Med |
| ⬜ | **T3** 橫幅真值驅動 + run 級文案 | [T3-banner-truth-driven.md](T3-banner-truth-driven.md) | T1 | Low |
| ⬜ | **T4** 恢復條件入口（E2） | [T4-condition-recovery-entry.md](T4-condition-recovery-entry.md) | T1, T3 | High |
| ⬜ | **T5** fullscreen 迴歸防線 | [T5-gate-e2e-guard.md](T5-gate-e2e-guard.md) | T0, T4 | High |
| ⬜ | **T6** 決策落帳與文件 | [T6-decisions-and-docs.md](T6-decisions-and-docs.md) | T1–T5 | Low |
| ⬜ | **T-exit** 驗收 | [T-exit-gate.md](T-exit-gate.md) | T1–T6 | Low |

規則：一列 = 一個 vertical slice = 一個 atomic conventional commit。若 task 超過 3 dev-days，先回 README 拆分，不在實作中偷長。

⚠️ **T0 的 OQ-70.1（Playwright fullscreen 可行性）是本 WP 的單點風險**：它決定 T5 是「e2e 任務」
還是「手動清單 + 單元注入」。T0 未給出實測結論前不要開 T5。
