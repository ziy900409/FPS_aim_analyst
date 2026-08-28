# WP-50 T0 — Entry Gate／Replay Sufficiency Audit／PoC

## Objective

在不寫production feature前，逐exact drill證明現有與候選replay資料是否足夠，凍結`full/partial/unsupported`語意、replay schema v1、renderer ownership與OQ-50.1～4。T0未通過不得開始T1～T6。

## Inputs to read

- [README.md](README.md) §0～3、WP-48 load contract、WP-49 run route/action handoff。
- `AGENTS.md`、`graphify-out/GRAPH_REPORT.md`與當時CodeGraph status。
- `RingBuffer`、`DataRecorder`、metadata/export parser/build path；official drill/session/protocol roster。
- `main.ts` live frame、SceneManager/CameraController、Target/Impact/Tracer views與scene configs。

## Steps

1. 記錄HEAD、`git status --short`、CodeGraph pending與baseline build/test；不處理unrelated changes。
2. 對recorder/parser/live render/scene/view symbols執行CodeGraph impact，列local/cross-module blast radius。
3. 列出所有可產生Assessment的exact `drillId`；每個用真實或可追溯fixture填`scene/camera/player/target/ADS-recoil/shot/projectile/events`能力矩陣。
4. 對legacy v2與candidate replay v1做direct-seek state reconstruction spike；禁止call sim。
5. 比較candidate target/weapon/projectile capture shapes在代表性最長run的JSON bytes、parse/normalize時間與recorder hot-path成本。
6. 做single-renderer/isolated-scene/exclusive-frame-owner throwaway PoC；instrument replay active時live pump/input/pointer lock=0，重覆enter/leave無resource增長。
7. 收斂OQ-50.1～4；輸出versioned exact profile roster與reason codes。未收斂者標blocked task/owner，不把recommended default寫成產品決策。
8. 清除只位於已驗證T0 temp root的PoC artifacts，把commands/measurements寫入[progress.md](progress.md)。

## Required audit artifact

| exact drillId | fixture provenance | minimum playable | full required | observed legacy | replay-v1 target | status/reasons |
|---|---|---|---|---|---|---|
| 每個official ID | run/golden/test builder | capability list | capability list | evidence | evidence | explicit |

## Definition of Done

- [x] official exact ID roster完整；unknown/prefix相近ID負向測試成立（progress.md「Official Assessment Exact-drillId Roster」：6 個 assessment ID + 負向確認 tracking_*/detection_popin_v1/BR variants/practice-only drills）。
- [x] legacy與new schema支援矩陣有field-level evidence，不以直覺判定（`TickArena.recordState`/`DrillEvent.fire`/`TargetManager.test.ts` 逐檔讀取；6 ID 皆同一套 recorder，profile 差異只在 motion/spiderShot 欄位）。
- [x] schema size/hot-path、42k normalize/seek與renderer lease PoC有可重現數據（`tests/_t0_poc/*.test.ts`，6 assertions 全綠；capacity=41,528 ticks；naive schema 12,531KiB vs 4,096KiB 預算；scene isolation 50-cycle 零累積）。
- [x] OQ-50.1～4有owner-confirmed結論或明確blocked owner/deadline（progress.md D-50-P6/P9/P10/P11，使用者 2026-08-28 經 AskUserQuestion 確認）。
- [x] T1～T6 paths/contracts按當時WP-48/49 worktree更新（讀當前 `HistoryClient.loadRun`/`HistoricalRunDetail.onReplay`/`ResultScreen.ts`，與 README §0 item 10 描述一致，無需修改 §2.1 檔案清單）。
- [x] production code diff=0、PoC artifacts清除、baseline failure若有已證明為既存（`tests/_t0_poc/` 已刪除；baseline build/vitest 皆 green，無既存 failure）。

## Commit

```text
docs(stage10): complete WP-50 replay entry gate
```
