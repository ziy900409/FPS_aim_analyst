# WP-51 T5 — Operations, Manual Walkthrough, and Release Dossier

## Objective

把啟動、資料保護、故障處理與真實browser/GPU驗收寫成可由另一位operator重現的runbook，並完成M18 evidence dossier草案。

## Dependencies

- T2～T4自動化、failure與measurement evidence可引用。
- OQ-51.1～3已有決策；manual gate所需硬體/owner可取得。

## Operational documentation

1. 正式啟動／build/preview指令與Node History API readiness；如何確認resolved root是固定project folder。
2. JSON階層、Assessment-only、exact drillId、atomic save、restart rebuild與不支援任意root選擇。
3. 備份採app停止後複製整個root；prototype不提供delete/import/migration，還原前先保留原root。
4. troubleshooting：API unavailable、permission/save failure、corrupt/unsupported、duplicate conflict、empty History、Replay partial/unsupported、WebGPU→WebGL2 fallback與scene load failure。
5. privacy/security：無登入/角色權限、多使用者共用本機資料；API loopback-only；不要將含Participant資料的JSON、screenshots或logs提交git。
6. 說明manual download與automatic History是不同路徑；Practice只有當次Result/download，不會依Participant回看。

## Manual walkthrough

- 使用乾淨synthetic Participant，latest Chrome與Edge、WebGPU-capable desktop；另確認WebGL2 fallback（依OQ-51.2調整）。
- Participant flow：完成Assessment、Result/save feedback、History找到自己、Result/trend、3D Replay play/seek/rate/event/Back。
- Researcher flow：多Participant與exact drill瀏覽、時間排序、unknown metric/cohort說明、partial/unsupported辨識。
- Practice flow：Result/download可用，重啟後History完全沒有該Practice；當次Replay依OQ-50.2。
- 真實視覺：camera/target/ADS/recoil/shot-hit cues與記錄事件一致，無live gameplay/input背景執行；Pointer Lock與滑鼠完成流程無回歸。
- failure/recovery spot check：API停用或scene failure時訊息與返回/retry/download可理解。
- keyboard/focus與至少一次screen reader smoke；warnings不只靠顏色。

每次記錄commit、OS/GPU/driver、browser/version/backend、date、signer、每case pass/fail/notes；只截synthetic資料，失敗不得改寫成caveat後宣告pass。

## Release dossier

- 建立`docs/operational/acceptance-stage-j.md`，逐一映射Stage README §10與FR/NFR到evidence record。
- evidence狀態只允許pass/fail/blocked/not-applicable；N/A需rationale與owner核准。
- 記錄known limitations與後續WP，但M18核心條件不得以known limitation豁免。
- 由未撰寫主要功能者依runbook重跑至少一次，以證明文件不是作者記憶的替代品。

## Definition of Done

- [ ] operator runbook涵蓋啟動、root/backup、Practice政策、troubleshooting與prototype security/privacy。
- [ ] 新operator可只依文件啟動、定位synthetic record、Replay並處理至少一個failure state。
- [ ] manual browser/GPU/role/a11y checklist完成且有環境與signer；若OQ-51.1為blocking則全部pass。
- [ ] acceptance-stage-j逐項連到automated/measurement/inspection/manual artifact，無orphan M18條件。
- [ ] docs/artifacts無真實Participant identity、payload或敏感absolute path。

## Suggested commit

```text
docs(stage10): add history replay operations and M18 dossier
```

