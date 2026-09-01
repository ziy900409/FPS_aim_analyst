# WP-52 — task checklist

> 狀態符號：`[ ]` pending · `[-]` in progress · `[x]` complete。每個 task 完成後更新 [progress.md](progress.md) 與 stage11 [progress.md](../progress.md)。

## T0 — Entry gate／v1 audit／parameter candidates

- [x] 記錄 HEAD/status/CodeGraph pending/baseline tests
- [x] 覆核 `peek_click_transfer_pilot_v1`、metrics、session、metadata blast radius
- [x] 拍板 OQ-52-1 target size policy（D-52.4：保留 1.5/2/3 deg 候選）
- [x] 拍板 OQ-52-2 timeout policy（D-52.5：維持 3000 ms）
- [x] 拍板 OQ-52-3 warmup policy（D-52.6：不新增，沿用 D-45.16）
- [x] 明確記錄 v1 不原地修改的 guard

## T1 — Pilot v2 config and contracts

- [x] 新增 `peek_click_transfer_pilot_v2` config/builder
- [x] 新增具名常數：id、target count、timeout、visibility、hitbox/candidate label
- [x] 新增 deterministic tests（60/120/240 Hz）
- [x] 新增 scene geometry / hitbox compatibility tests
- [x] v1 pilot tests 零修改全綠

## T2 — Pilot session preset UI + metadata unblock

- [x] `sessionSchedule.ts` 匯出完整 session family allowlist 單一來源（KI-016，T2a）
- [x] `metadata.ts` 使用同一 allowlist 驗證 `sessionPlanFamilyOrder`（KI-016，T2a）
- [x] `SessionPlanSetup` 支援具名 preset 選擇，不提供 protocol numeric free input（D-52.7：改為擴充既有自由 checkbox 家族清單至 5 家族，不重新引入 preset 下拉——沿用 WP-43 FR-H3 已交付/已測試設計；見 GD-26）
- [x] `main.ts` session plan 匯出寫入 `sessionPlanPreset`（D-52.7：範圍改變，不寫入此欄位——`SESSION_PLAN_PRESETS`/`findSessionPlanPreset` 維持原樣，非本次範圍）
- [x] transfer pilot session E2E：選 preset → 跑 transfer family → 匯出 metadata 不 throw（改為「勾選 peek-click-transfer 家族」；`session-orchestrator.spec.ts` 新增專屬 case 走到 eligibility gate；`buildMetadata()` 不 throw 由 T2a 的 `metadata.test.ts` regression 驗證）

## T3 — Pilot evidence harness/report

- [x] 建立 pilot evidence report generator 或 test fixture（`src/pilot/peekClickTransferPilotEvidence.ts`）
- [x] report 輸出 completion rate、timeout rate、valid first shot rate、left/right balance、flag counts
- [x] synthetic fixture 覆蓋 timeout、first miss→second hit、pre-onset fire、no-counter
- [x] practice-only history guard tests 全綠（`HistoryPersistence.test.ts` 新增 pilot v2 drillId 專屬 case）

## T4 — Manual pilot gate and documentation

- [x] 人工 pointer-lock／視覺手感 checklist 建檔（[T4-manual-pilot-gate.md](T4-manual-pilot-gate.md)，待真人研究者回填，不得由自動化冒充）
- [x] 至少記錄 pilot evidence 的採樣限制與不可宣告事項（`analysis-peek-click-transfer.md` §Pilot v2 + T4 文件內）
- [x] 更新 `analysis-peek-click-transfer.md`（新增 §Pilot v2）
- [x] 更新 `CONTEXT.md` pilot v2 條目
- [x] WP-53 go/no-go 記錄於 progress（No-go，待人工執行；見 [T4-manual-pilot-gate.md](T4-manual-pilot-gate.md) 與 progress.md Decision log）

## T-exit

- [ ] focused tests exit 0
- [ ] relevant Playwright E2E exit 0
- [ ] typecheck exit 0
- [ ] 若修改 code，`graphify update .` 已執行
- [ ] progress / checklist / stage11 docs synced
- [ ] staged file audit complete
