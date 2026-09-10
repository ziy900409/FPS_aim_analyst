# T3 — E2E 與研究語意回歸

> Parent：[README.md](README.md) · 前置：[T2](T2-runtime-and-session-plan-wiring.md)

| | |
|---|---|
| **Objective** | 用真瀏覽器證明 selected Pilot drill 能由 Session Plan 完整執行與匯出，同時證明它沒有接管正式 Pilot runner、沒有進 history、沒有改變刺激。 |
| **Dependencies** | T2。 |
| **Risk** | **High validity**：功能看似可跑仍可能產生可被誤讀的研究資料。對應 FM-64.1/7/8/9。 |
| **Estimate** | 1–1.5 dev-days。 |
| **Commit** | `test(wp-64): verify ad hoc tracking pilot session plans` |

## Planned files

- `tests/e2e/session-orchestrator.spec.ts`（擴充既有 spec，不新增平行 Session Plan spec）
- `tests/e2e/tracking-pilot-live.spec.ts`（原 expected 原則上不改，只重跑）
- `src/pilot/trackingPilotHistoryExclusion.test.ts`
- `docs/operational/tracking-pilot-runbook.md` 或最接近的既有操作文件（只補 ad hoc 限制）

## Steps

1. 確認 E2E server/history roots 安全；沿用既有單 worker 與 history 前後不變紀律，不啟動會寫入真實 history root 的未知 server。
2. 擴充 `session-orchestrator.spec.ts` 的 custom track：從真 DOM picker 選一個 selected Pilot id，提交 program，通過 eligibility gate，等待真 `field-low` load、countdown/running/ended。
3. 不縮短 production config、不改 clock；若 25/26 秒 timed block 使測試較長，接受真實時間成本。使用既有 harness 只觀察/輸入，不直接呼叫私有 runner 完成。
4. 捕捉下載 payload，斷言 custom audit fields、item/rep、family、primary seed、weapon、scene、practice/no-assessment；若選中 scored block，再斷言原 protocol guard metadata/event 能被保留，但不宣稱 eligibility。
5. 斷言完成後由 `SessionRunner` 推進／done；`TrackingPilotRunner` records 不增加，避免 `handleDrillEnded()` 誤接管。
6. 重跑正式 `tracking-pilot-live.spec.ts`，確認 manifest block order、alternate seed、operator screen/retry/eligibility 既有 expected 無變更。
7. 重跑全九項 history exclusion與 selected subset；確認真實 history roots 前後無新增檔。
8. 執行四種 render pump 的既有 tracking/session weapon determinism suites；記錄逐位一致結果。
9. 更新操作文件：清楚寫「Session Plan 選到 Pilot drill = ad hoc primary-seed 測試；不可替代 manifest、不可作 Gate B/C evidence、reps 不得當獨立樣本」。
10. 完成 full CI-style verification；記錄所有指令、測試數、時長、瀏覽器版本與任何既有 warning。

## Definition of Done

- [ ] `npx playwright test tests/e2e/session-orchestrator.spec.ts --project=edge --workers=1` exit 0，selected Pilot case 由真 DOM picker 起跑、真時間結束並下載 payload。
- [ ] payload 斷言 `sessionPlanMode === 'custom'`、item/rep/family/seed/weapon/scene 正確，且 `meta.assessment === undefined`。
- [ ] 測試證明 `SessionRunner` 而非 `TrackingPilotRunner` 擁有該 run 的完成與下載。
- [ ] `npx playwright test tests/e2e/tracking-pilot-live.spec.ts --project=edge --workers=1` exit 0，既有 manifest/alternate-seed/eligibility expected 未放寬。
- [ ] history roots before/after deep-equal；全部 selected ids projection 為 `unregistered-drill`。
- [ ] 四種 render pump 的 sim state bit-exact；不斷言 wall-clock timestamps。
- [ ] 操作文件含三項明文禁令：非 manifest、primary seed only、rep 非獨立樣本。
- [ ] 全量 `npx vitest run`、typecheck ×2、build、適用 Playwright 全部 exit 0，證據入 `progress.md`。
- [ ] `git diff` 證明 Pilot config value、sim/input/hitbox/history registration/research Python 無修改；`graphify update .` 完成。

## Failure handling

- E2E timeout 只可調整 test timeout，不可縮 production duration。
- 若 `TrackingPilotRunner` 誤接管，視為 release blocker；不得在測試中 mock 掉。
- 若 formal pilot expected 必須改，停止並先判斷是否為刻意研究 protocol 變更；本 WP 原則上無權修改。

