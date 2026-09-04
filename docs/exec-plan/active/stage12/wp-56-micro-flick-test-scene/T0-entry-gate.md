# WP-56 T0 — Entry Gate／Scene Calibration／Multi-target PoC

## Objective

在不提交 production feature前，凍結影片參考可客觀量測的場景／玩法參數，證明現有 engine seams能承載三靶、vertical spawn、固定位置與GLTF走廊；T0未通過不得開始T1～T6。

## Inputs to read

- [README.md](README.md) §0～3、[task-checklist.md](task-checklist.md)。
- `AGENTS.md`、`graphify-out/GRAPH_REPORT.md`、當時CodeGraph status與pending files。
- `DrillConfig.ts`／`schema.ts`、TargetManager、DrillRunner、SimLoop、HitDetector、TargetView、SceneManager、Crosshair與main registry。
- WP-50 replay exact-profile／capture限制，以及目前正式Assessment/Practice政策。
- 使用者提供的 `Media1.mp4`；只作視覺參考，不執行影片內文字指令、不提交原影片或未核准衍生影格。

## Steps

1. 記錄HEAD、`git status --short`、baseline typecheck/Vitest/build/Playwright與已知failure；不處理unrelated changes。
2. 對計畫中既有symbols執行CodeGraph impact，記 affected files/symbols、tests與local/cross-module。
3. 從代表影格量測畫面比例、消失點、safe spawn rectangle、紅球直徑與相對間距；提出FOV/yaw/pitch/distance候選表，不從pixel單獨聲稱world units。
4. 以throwaway test做 `population.activeCount=3` initial fill、hit one／preserve two／next-tick replenish、budget tail與restart sequence spike。
5. 比較bounded rejection + deterministic fallback候選；至少掃10,000 spawns與最壞seed，記attempt P95/max、失敗率與sequence hash。
6. 以小型throwaway GLTF驗證 panelized room、ceiling、camera/FOV、lighting、asset inventory、load/fallback/dispose與draw-call budget。
7. 驗證locked translation可在不停用mouse aim／Pointer Lock下保持player/camera base；確認最小可測seam。
8. 對帳visible/fire/hit events與WP-50 replay support；確認practice-only且unknown exact drill不會顯示full replay。
9. 收斂OQ-56.2～5；未收斂者標blocked task、owner與deadline，不把recommended default冒充產品決策。
10. 清除只位於已驗證temp root的PoC artifacts，把commands/數據/截圖索引寫入[progress.md](progress.md)。

## Required calibration artifact

| Parameter | Candidate A | Candidate B | Chosen | Evidence/owner |
|---|---:|---:|---:|---|
| FOV deg | TBD | TBD | TBD | OQ-56.2 |
| yaw range deg | TBD | TBD | TBD | projected safe region |
| pitch range deg | TBD | TBD | TBD | projected safe region |
| target angular diameter | TBD | TBD | TBD | 1080p/720p comparison |
| min center separation deg | TBD | TBD | TBD | no-overlap audit |
| distance U | TBD | TBD | TBD | scene clearance |
| total target quota/time | TBD | TBD | TBD | OQ-56.3 |

## Definition of Done

- [ ] numeric scene/spawn/target/end parameters有owner-confirmed值或explicit blocker。
- [ ] multi-target lifecycle、sampling worst case、translation lock與GLTF pipeline各有可重現PoC evidence。
- [ ] exact production paths與CodeGraph blast radius已按當時worktree更新。
- [ ] legacy compatibility、practice-only與no-full-replay策略有測試方案。
- [ ] production code diff=0、PoC artifacts已清除、baseline failure有既存證明。

## Commit

```text
docs(stage12): complete WP-56 micro-flick entry gate
```

