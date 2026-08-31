# Stage 10 — Master Task Checklist

> Stage spec：[README.md](README.md) · Running log：[progress.md](progress.md)
>
> 本清單先固定垂直切片、相依與 exit gate。每個 task 正式開工前，依 `docs/exec-plan/README.md` 規則補成自足 task file，並在讀碼後更新具體檔案與 blast radius；未完成前不得把預計路徑當成既成事實。

## WP-48 — Local History Foundation

> 自足 spec：[wp-48-local-history-foundation/README.md](wp-48-local-history-foundation/README.md) · checklist：[wp-48-local-history-foundation/task-checklist.md](wp-48-local-history-foundation/task-checklist.md)

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| ✅ | **T0** Entry gate／filesystem PoC／決策凍結 | [T0-entry-gate.md](wp-48-local-history-foundation/T0-entry-gate.md) | 無 | High |
| ✅ | **T1** Strict ExportPayload runtime contract | [T1-export-payload-contract.md](wp-48-local-history-foundation/T1-export-payload-contract.md) | T0 | High |
| ✅ | **T2** Filesystem repository | [T2-filesystem-repository.md](wp-48-local-history-foundation/T2-filesystem-repository.md) | T1 | High |
| ✅ | **T3** Node History API／Vite adapter | [T3-node-history-api.md](wp-48-local-history-foundation/T3-node-history-api.md) | T2 | High |
| ✅ | **T4** HistoryClient／persistence state machine | [T4-history-client.md](wp-48-local-history-foundation/T4-history-client.md) | T3 | Med |
| ✅ | **T5** Assessment-only auto-save wiring | [T5-auto-persistence-wiring.md](wp-48-local-history-foundation/T5-auto-persistence-wiring.md) | T4 | High |
| ✅ | **T-exit** Foundation acceptance／handoff | [T-exit-gate.md](wp-48-local-history-foundation/T-exit-gate.md) | T1～T5 | Med |

WP-48 Definition of Done：瀏覽器完成一場 Assessment 後，不需人工下載／選檔即可在專案 history root 得到完整 JSON，重新啟動服務後仍可列出並載入；Practice 明確略過持久化但保留當次結果與手動匯出；Practice submission、missing Participant、path escape、partial write、duplicate conflict 與 API unavailable 皆有負向證據。

## WP-49 — History Library and Trends

> 自足spec：[wp-49-history-library-and-trends/README.md](wp-49-history-library-and-trends/README.md) · checklist：[wp-49-history-library-and-trends/task-checklist.md](wp-49-history-library-and-trends/task-checklist.md)

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| ✅ | **T0** Entry gate／handoff audit／PoC／決策凍結 | [T0-entry-gate.md](wp-49-history-library-and-trends/T0-entry-gate.md) | WP-48 contract | High |
| ✅ | **T1** Navigation/controller shell | [T1-navigation-controller.md](wp-49-history-library-and-trends/T1-navigation-controller.md) | T0 | High |
| ✅ | **T2** Participant／exact-drill browser | [T2-participant-drill-browser.md](wp-49-history-library-and-trends/T2-participant-drill-browser.md) | T1 + WP-48 T4 | Med |
| ✅ | **T3** Run list／historical Result | [T3-run-list-result-detail.md](wp-49-history-library-and-trends/T3-run-list-result-detail.md) | T2 + WP-48 loadRun | High |
| ✅ | **T4** Metric registry／analysis API／trend domain | [T4-metric-registry-trend-domain.md](wp-49-history-library-and-trends/T4-metric-registry-trend-domain.md) | T0 + WP-48 T2/T3 | High |
| ✅ | **T5** Drill overview trend UI／entry integration | [T5-drill-overview-integration.md](wp-49-history-library-and-trends/T5-drill-overview-integration.md) | T1～T4 + WP-48 T5 | High |
| ✅ | **T-exit** History UI gate／WP-50 handoff | [T-exit-gate.md](wp-49-history-library-and-trends/T-exit-gate.md) | T1～T5 | Med |

WP-49 Definition of Done：Participant與研究員可不接觸檔案選擇器完成`Participant → exact drill → run → historical Result`；Browser navigation與scale gates成立；即使某drill尚無primary metric，結果與紀錄列表仍完整可用，Practice維持零歷史entry。

## WP-50 — 3D State Replay

> 自足spec：[wp-50-3d-state-replay/README.md](wp-50-3d-state-replay/README.md) · checklist：[wp-50-3d-state-replay/task-checklist.md](wp-50-3d-state-replay/task-checklist.md)

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| ✅ | **T0** Entry gate／sufficiency audit／PoC | [T0-entry-gate.md](wp-50-3d-state-replay/T0-entry-gate.md) | WP-48 approved load contract | High |
| ✅ | **T1** Replay schema／capture／support classifier | [T1-replay-contract-and-capture.md](wp-50-3d-state-replay/T1-replay-contract-and-capture.md) | T0 | High |
| ✅ | **T2** Playback domain core | [T2-playback-domain-core.md](wp-50-3d-state-replay/T2-playback-domain-core.md) | T1 | Med/High |
| ✅ | **T3** Presentation ownership／base scene | [T3-presentation-and-scene.md](wp-50-3d-state-replay/T3-presentation-and-scene.md) | T1～T2 | High |
| ✅ | **T4** Targets／weapon／effects | [T4-replay-visual-state.md](wp-50-3d-state-replay/T4-replay-visual-state.md) | T1～T3 | High |
| ✅ | **T5** Replay Screen／transport／HUD | [T5-replay-ui.md](wp-50-3d-state-replay/T5-replay-ui.md) | T2～T4 | Med |
| ✅ | **T6** Result／History integration | [T6-entry-and-navigation.md](wp-50-3d-state-replay/T6-entry-and-navigation.md) | T5 + WP-48 + WP-49 T3 | High |
| ✅ | **T-exit** Replay gate／WP-51 handoff | [T-exit-gate.md](wp-50-3d-state-replay/T-exit-gate.md) | T1～T6 | Med |

WP-50 Definition of Done：至少一個代表性official Assessment可由磁碟JSON完成第一人稱3D重播、任意seek與事件跳轉；所有official exact `drillId`依profile/capability如實分級；Replay期間live sim/input停止且direct seek與順播state等價。

## WP-51 — Integration and M18 Acceptance

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| ✅ | **T0** Entry／handoff gate | [T0-entry-gate.md](wp-51-m18-integration-and-acceptance/T0-entry-gate.md) | WP-48～50 exit evidence | High |
| ✅ | **T1** Acceptance harness／roots／evidence | [T1-acceptance-harness.md](wp-51-m18-integration-and-acceptance/T1-acceptance-harness.md) | T0 seams confirmed | High |
| ⬜ | **T2** Cross-WP canonical journeys | [T2-cross-wp-happy-paths.md](wp-51-m18-integration-and-acceptance/T2-cross-wp-happy-paths.md) | T1 + WP-48～50 exits | High |
| ⬜ | **T3** Failure／recovery／safety | [T3-failure-recovery-safety.md](wp-51-m18-integration-and-acceptance/T3-failure-recovery-safety.md) | T1～T2 | High |
| ⬜ | **T4** Scale／lifecycle／a11y | [T4-scale-lifecycle-a11y.md](wp-51-m18-integration-and-acceptance/T4-scale-lifecycle-a11y.md) | T1～T3 | Med/High |
| ⬜ | **T5** Operations／manual release | [T5-operations-manual-release.md](wp-51-m18-integration-and-acceptance/T5-operations-manual-release.md) | T2～T4 | Med |
| ⬜ | **T-exit** M18 gate | [T-exit-gate.md](wp-51-m18-integration-and-acceptance/T-exit-gate.md) | T0～T5 + upstream exits | High |

WP-51 Definition of Done：WP-48～50 exits與README §10全數有客觀證據後才可宣告M18；不可只因happy-path demo可操作就略過隔離root、preview public contract、資料安全、重啟持久性、Practice排除、unsupported replay或實機fidelity。

## 執行順序

```text
WP-48 T0→T5→T-exit
       ├──→ WP-49 T0→T5→T-exit ─────────────┐
       └──→ WP-50 T0→T5 ────────────────────┤
                    WP-49 T3 ─→ WP-50 T6→T-exit
                                               └──→ WP-51 T0→T5→T-exit
```

- WP-49 與 WP-50 在 WP-48 可穩定讀取 payload 後可並行，但不得同時改動同一 History navigation／Result Screen 熱區。
- WP-50 T0 是實作 gate；audit 沒有結論前不得先做一個看似可播、實際默默遺失狀態的播放器。
- WP-51 只收斂跨模組與 acceptance，不在最後一刻新增未經單元測試的新 domain logic。

## 全階段紀律

1. 一個 task = 一個垂直切片 = 一個原子 commit；先驗證再進下一 task。
2. 修改既有 symbol 前依專案規範執行 CodeGraph impact，記錄 affected files／symbols 與 local 或 cross-module 判斷。
3. 所有 filesystem tests 使用 workspace 內明確的 temporary root，先驗證 resolved path；不得刪除或改寫 `data/session-history/` 的真實資料。
4. JSON 是 source of truth；任何 index/cache 必須可從 JSON 重建。
5. Replay path 不得呼叫 live `SimLoop`、注入 InputSampler 或改寫當前 session 的 `SharedState`。
6. Practice 不持久化／不進歷史與 exact `drillId` 分組必須同時有 domain test 與 UI/E2E 證據。
7. 每個 WP 完成時更新 [progress.md](progress.md)；程式碼修改後執行 `graphify update .`。
