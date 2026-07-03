# T5 / T-exit — Exit gate（宣告 M4 — 階段 A 交付）

> Part of [WP-9 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Med / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)（WP-9 ✅ + M4 + 整體狀態）；docs only |
| **Status** | ✅ 完成（2026-07-03）— M4 階段 A 交付宣告 |

## Objective
驗證附錄 E 全綠，正式宣告 **M4 — 階段 A 交付**，收尾整個專案的階段 A。

## Steps
- [x] `npm run test:ci` exit 0（tsc + vitest + playwright 全綠）。**2026-07-03**：tsc 乾淨 → vitest **26 files / 185 tests passed** → playwright **7 passed（Edge）** → **exit 0**。
- [~] 手動驗收：附錄 E 中標為手動的項（原生輸入無加速、實際遊玩手感）逐一通過。**待研究者實機回填**（headless session 無法合成真實運動-知覺反應與滑鼠手感）；依 [acceptance §3](../../../operational/acceptance-stage-a.md) 與 T0-lock，此為交付前研究者步驟，**不阻塞自動閘綠燈判定**。
- [x] 確認 [acceptance-stage-a.md](../../../operational/acceptance-stage-a.md) 10 項全綠（自動綠燈；第 10 項「實玩中位數」手動子項見上）。
- [x] map 下方 4 項 WP-9 驗收 → 證據；勾選。
- [x] 翻 [頂層索引](../../README.md) §2 WP-9 ✅ + §3 標記 **M4 達成**；頂層狀態改「✅ 階段 A 交付」。
- [ ] 把 `active/wp-*` 依需要移入 `../../completed/`。**暫不移動**：跨資料夾移動會破壞各 WP README/progress 大量相對連結，且 M4 宣告不依賴實體搬移；留待後續一次性帶連結修正的整理。
- [x] progress.md 寫 `Outcomes & Retrospective`（階段 A 交付總結、已知限制、階段 B 銜接）。
- [~] （條件性）`gh pr create`（base `main`）彙整階段 A，或記本機綠燈證據。本 session 記**本機綠燈證據**（上方 test:ci exit 0）；PR 由使用者視需要建立。

## Acceptance criteria（PLAN WP-9 / 附錄 E / M4）→ evidence
- [x] 端到端整合（drill→匯出→統計）→ T1（`tests/e2e/full-drill.spec.ts`，統計＝匯出斷言）
- [x] 計時效度（150–250 ms 合理）→ T2（`tests/validity/reaction-time.test.ts` + timing-validity.md；實玩中位數手動補）
- [x] 決定性回歸自動化 → T3（`tests/regression/determinism.test.ts` 15 tests + `test:ci` exit-code 閘）
- [x] 附錄 E 驗收清單全數通過 → T4（`docs/operational/acceptance-stage-a.md` 10 項對照證據）

## Definition of Done
- 附錄 E 10 項全綠；**M4 達成、階段 A 交付**並記於頂層索引；階段 B 銜接 note 寫入 progress.md。✅
- 已知限制：手動遊玩手感 / 實玩反應中位數為研究者實機回填步驟（不阻塞自動閘）；WP 資料夾實體搬移延後。

## Commit
`docs(wp-9): exit gate — 宣告 M4 階段 A 交付 + 附錄 E 全綠`
