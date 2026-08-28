# WP-52 — task checklist

> 狀態符號：`[ ]` pending · `[-]` in progress · `[x]` complete。每個 task 完成後更新 [progress.md](progress.md) 與 stage11 [progress.md](../progress.md)。

## T0 — Entry gate／v1 audit／parameter candidates

- [ ] 記錄 HEAD/status/CodeGraph pending/baseline tests
- [ ] 覆核 `peek_click_transfer_pilot_v1`、metrics、session、metadata blast radius
- [ ] 拍板 OQ-52-1 target size policy
- [ ] 拍板 OQ-52-2 timeout policy
- [ ] 拍板 OQ-52-3 warmup policy
- [ ] 明確記錄 v1 不原地修改的 guard

## T1 — Pilot v2 config and contracts

- [ ] 新增 `peek_click_transfer_pilot_v2` config/builder
- [ ] 新增具名常數：id、target count、timeout、visibility、hitbox/candidate label
- [ ] 新增 deterministic tests（60/120/240 Hz）
- [ ] 新增 scene geometry / hitbox compatibility tests
- [ ] v1 pilot tests 零修改全綠

## T2 — Pilot session preset UI + metadata unblock

- [ ] `sessionSchedule.ts` 匯出完整 session family allowlist 單一來源
- [ ] `metadata.ts` 使用同一 allowlist 驗證 `sessionPlanFamilyOrder`
- [ ] `SessionPlanSetup` 支援具名 preset 選擇，不提供 protocol numeric free input
- [ ] `main.ts` session plan 匯出寫入 `sessionPlanPreset`
- [ ] transfer pilot session E2E：選 preset → 跑 transfer family → 匯出 metadata 不 throw

## T3 — Pilot evidence harness/report

- [ ] 建立 pilot evidence report generator 或 test fixture
- [ ] report 輸出 completion rate、timeout rate、valid first shot rate、left/right balance、flag counts
- [ ] synthetic fixture 覆蓋 timeout、first miss→second hit、pre-onset fire、no-counter
- [ ] practice-only history guard tests 全綠

## T4 — Manual pilot gate and documentation

- [ ] 人工 pointer-lock／視覺手感 checklist 建檔
- [ ] 至少記錄 pilot evidence 的採樣限制與不可宣告事項
- [ ] 更新 `analysis-peek-click-transfer.md`
- [ ] 更新 `CONTEXT.md` pilot v2 條目
- [ ] WP-53 go/no-go 記錄於 progress

## T-exit

- [ ] focused tests exit 0
- [ ] relevant Playwright E2E exit 0
- [ ] typecheck exit 0
- [ ] 若修改 code，`graphify update .` 已執行
- [ ] progress / checklist / stage11 docs synced
- [ ] staged file audit complete
