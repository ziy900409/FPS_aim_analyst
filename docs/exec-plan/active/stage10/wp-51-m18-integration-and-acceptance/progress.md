# WP-51 — progress.md

> Running log。Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-27**：依engineering-planning skill完成WP-51規劃；建立T0～T5 + T-exit、dev/preview分層驗收、workspace-contained roots、failure ownership、M18 evidence schema與人工release gate。尚未開始production/test implementation。

## Planning-time observations

- WP-48目前實際已推進到T2，但上層Stage狀態尚待owning WP於exit同步；WP-51 T0以實際HEAD/evidence為準，不代替上游宣告完成。
- DEV-only test hooks不能出現在preview bundle；因此completion/autosave自動化與production-bundle smoke必須分成兩種證據。
- 現行Playwright會reuse server且fixed ports；Stage 10 acceptance需自行擁有process lifecycle，避免stale server與錯root造成假綠。
- 現有部分filesystem tests使用OS temp，與Stage 10 workspace temp紀律不一致；列入WP-48 handoff對帳。

## Open Questions

- **OQ-51.1**：人工實機3D/Pointer Lock/Participant與研究員walkthrough是否阻擋M18？建議是。
- **OQ-51.2**：Chrome與Edge是否都需自動化？建議Edge自動，Chrome+Edge人工，WebGL2 fallback自動。
- **OQ-51.3**：preview是否接受只走公開History→Result→Replay，completion→autosave由dev自動化+preview人工補足？建議接受。

## Evidence log

T0開始後，每筆記錄：date、commit、task、command/scenario、environment、artifact、result、owner。不得貼真實payload或Participant identity。
