# T0 — Entry gate 與研究選擇凍結

> Parent：[README.md](README.md) · checklist：[task-checklist.md](task-checklist.md) · progress：[progress.md](progress.md)

| | |
|---|---|
| **Objective** | 在任何 production code 前，確認 WP 編號、上游契約、平行熱區與實際選中的 1–2 個 config，將 ad hoc 語意凍結為可執行決策。 |
| **Dependencies** | 無；但 T1 需等待本 task 全綠。 |
| **Risk** | Low。 |
| **Estimate** | 0.5–1 dev-day。 |
| **Commit** | `docs(wp-64): complete tracking pilot scheduling entry gate` |

## Inputs / invariants

- [WP-54 README](../../stage11/wp-54-tracking-pilot/README.md)、`progress.md` 與現行 Pilot config/test。
- [WP-62 README](../wp-62-session-plan-per-item-weapon/README.md)、`progress.md` 與 D-62-1 declared weapon contract。
- `docs/exec-plan/README.md`、`DECISIONS.md`、stage13 index 與未追蹤 WP-63/GD-39 現況。
- 不修改任何 `src/`、tests 或 runtime artifact。

## Steps

1. 重新執行 `git status --short`、全 repo WP/GD 最大編號掃描；確認 WP-63/GD-39 是否已被採納。若被其他工作佔用，依 GD-15 同步順延資料夾、標題、FR/A 編號與 commit messages。
2. 以 CodeGraph 對 `FAMILY_BY_DRILL_ID`、`DECLARED_WEAPON_BY_DRILL_ID`、`compileSessionProgram`、`SessionRunner`、`AvailableDrill`、`loadDrillById`、`TrackingPilotRunner` 執行 impact/context；把實際 blast radius 寫入 `progress.md`。
3. 對照 WP-62 最新 progress：T1/T2/T3 相關介面必須已提交且 working tree 無未合併熱區；若 WP-62 後續 task 正在改 `SessionPlanSetup.ts`、`main.ts`、metadata 或 E2E，記錄排序而非平行寫同檔。
4. 由研究者核准 1–2 個 config。逐項記錄 exported source、drill id、role（core/reversal/practice/calibration）、primary seed、size/speed 或 reversal density、`mode`、weapon、scene。
5. 收斂 OQ-64.2～64.4；任何偏離 README 預設都新增 Decision Log row。若要求 alternate seed 或 live eligibility，停止 T1 並擴寫 scope/estimate，不把 manifest 語意偷偷塞進 registry。
6. 建立「選中集合」與「全部九個 Pilot 集合」的預期 fixture 表；明列 complement 必須維持 unschedulable。
7. 復現 focused baseline：
   - `npx vitest run src/session/drillFamily.test.ts src/session/sessionProgram.test.ts src/ui/SessionPlanSetup.test.ts`
   - `npx vitest run src/drill/tracking_core_pr_pilot_v1.test.ts src/drill/tracking_reversal_pilot_v1.test.ts src/session/trackingPilotManifest.test.ts src/session/TrackingPilotRunner.test.ts src/pilot/trackingPilotHistoryExclusion.test.ts`
   - `npm run typecheck`
8. 把實際 test counts、HEAD、worktree 例外與上游 commit/gate 寫入 `progress.md`；不以「看過」代替指令證據。

## Definition of Done

- [ ] WP/GD 編號掃描輸出與結論已入 `progress.md`；撞號時全部引用一致順延。
- [ ] OQ-64.1 有 1–2 個精確 config、來源 symbol、primary seed 與理由，沒有用 array index 當長期 contract。
- [ ] OQ-64.2～64.4 已關閉，或有 owner/deadline/default 且不阻塞 T1。
- [ ] WP-62 同檔熱區沒有平行未合併修改；若有，T1 明確標 blocked-on-commit。
- [ ] 兩組 focused Vitest 與 typecheck 都 exit 0；測試數與日期記入 `progress.md`。
- [ ] `git diff -- src tests` 為空，證明 T0 未動 production/test code。

## Failure handling

- 上游測試紅：停止，不把 baseline defect 歸因於 WP-64。
- 核准超過兩個 config：回到 README scope/estimate 重審，不直接擴清單。
- 研究者要求 manifest feature：另立 manifest-aware WP；本 WP 保持 ad hoc。

