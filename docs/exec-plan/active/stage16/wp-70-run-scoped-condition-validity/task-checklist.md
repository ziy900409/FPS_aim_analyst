# WP-70 — Task Checklist

| 狀態 | Task | 交付 | 相依 | 風險 |
|---|---|---|---|---|
| ✅ | **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | — | Med |
| ✅ | **T1** per-run fullscreen 旗標 | [T1-per-run-fullscreen-flag.md](T1-per-run-fullscreen-flag.md) | T0 | High |
| ✅ | **T2** protocol 路徑判準一致 | [T2-protocol-path-consistency.md](T2-protocol-path-consistency.md) | T1 | Med |
| ⬜ | **T3** 橫幅真值驅動 + run 級文案 | [T3-banner-truth-driven.md](T3-banner-truth-driven.md) | T1 | Low |
| ⬜ | **T4** 恢復條件入口（E2） | [T4-condition-recovery-entry.md](T4-condition-recovery-entry.md) | T1, T3 | High |
| ✅ | **T5** fullscreen 迴歸防線 | [T5-gate-e2e-guard.md](T5-gate-e2e-guard.md) | T0, T4 | High |
| ⬜ | **T6** 決策落帳與文件 | [T6-decisions-and-docs.md](T6-decisions-and-docs.md) | T1–T5 | Low |
| ⬜ | **T-exit** 驗收 | [T-exit-gate.md](T-exit-gate.md) | T1–T6 | Low |

規則：一列 = 一個 vertical slice = 一個 atomic conventional commit。若 task 超過 3 dev-days，先回 README 拆分，不在實作中偷長。

✅ **OQ-70.1 已於 T0 實測結案（2026-09-15）**：Playwright 在 `--project=edge`（headless、無額外 flag）**可以**以 synthetic click 取得真 fullscreen 並觸發 `fullscreenchange` ⇒ **T5 = e2e 任務**。
⚠️ 但 T5 必須連同三條具名限制一起寫（L1：`page.evaluate()` 自帶 user activation ⇒ **e2e 無法守 FM-70.4**；L2：不得斷言視窗尺寸；L3：等待條件掛事件記錄）——詳見 [progress.md §T0.7](progress.md#t07-oq-701-實測步驟-6)。

✅ **T5 已交付（2026-09-15）**：`tests/e2e/wp70-fullscreen-validity.spec.ts`，全套 `--project=edge --workers=1` **exit 0／121 passed**。實作時又量到**兩條 T0 未預見的限制**：**L4**（`meta.suspect === false` 不可釘成常數——效能地板同機橫跳 4.36～15.7ms ⇒ 改斷言恆等式 `suspect === validity.perfFloor`；連帶 **FM-70.1 不被 e2e 可靠守住**）與 **L5**（`document.exitFullscreen()` **不**釋放 Pointer Lock）——詳見 [progress.md §T5](progress.md#t5-fullscreen-效度鏈路的-e2e-防線2026-09-15)。

⚠️ **T6 接手兩筆未結項**：(a) **FR-70.7 的橫幅文案仍是 session 級措辭**（T3 DoD 未達成，`src/ui/EligibilityGate.ts` 仍含「本 session」）；(b) **FM-70.4 的實機手動驗證清單尚未落 `docs/operational/`**（L1 ⇒ e2e 永遠測不到它）。
