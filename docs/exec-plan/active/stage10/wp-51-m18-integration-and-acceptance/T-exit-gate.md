# WP-51 T-exit — Final M18 Gate and Stage 10 Closeout

## Objective

以fresh checkout/clean synthetic roots重跑全部Stage 10 gates，確認上游與WP-51 evidence無缺口後才宣告M18；任何核心條件blocked/fail都維持Stage 10 active。

## Preconditions

- WP-48、WP-49、WP-50 T-exit皆完成且連到當前commit可用的evidence。
- WP-51 T0～T5 checklist全完成；所有upstream defect已修復並重跑owning exit。
- OQ-51.1～3與WP-50相關OQ已收斂，產品語意不再靠測試假設。

## Automated gates

1. Browser與Node/server TypeScript typecheck exit 0。
2. 全Vitest與全Playwright exit 0，記錄files/tests count、browser/backend與roots。
3. `npm run build`與既有`npm run test:ci` exit 0。
4. `npm run test:stage10`以fresh dev/preview、`reuseExistingServer=false` exit 0；critical specs `--repeat-each=5 --retries=0`零失敗。
5. boundary scans：browser無`node:*`、API loopback/no wildcard/no request root、Replay無live sim/input；preview bundle無DEV hooks。
6. 5k/100/42k/50-cycle與abort/acceptance wall-time gates符合README NFR並記environment。

## M18 acceptance checklist

- [ ] Assessment完成後在正確Participant/exact drill位置原子auto-save；Result identity一致。
- [ ] restart後只從JSON重建，Participant/drill/run順序與historical Result/Replay不變。
- [ ] Practice保留當次Result/manual download但零API/file/history；Replay依已決policy。
- [ ] exact grouping/cohort/trend/unknown metric行為正確，未引入composite score。
- [ ] full Replay可play/seek/rate/event；partial/unsupported/invalid誠實且可返回。
- [ ] API/save/corrupt/conflict/not-found/scene failures有retry/download/return，不crash或stale commit。
- [ ] path traversal/symlink/root escape被拒；真實root/outside sentinel不變。
- [ ] rapid navigation與50-cycle無late commit、listener/rAF/presentation/GPU resource leak。
- [ ] dev completion/autosave與preview public UI/API各自通過，headers/build boundary正確。
- [ ] scale/performance、keyboard/focus/ARIA與manual browser/GPU walkthrough通過。

## Evidence and repository hygiene

- [ ] `docs/operational/acceptance-stage-j.md`每項均有commit/environment/owner/artifact/status。
- [ ] reports/screenshots/downloads只含synthetic IDs，無真實payload/Participant資料或絕對history path。
- [ ] operation docs由另一operator按步驟重現成功，known limitations不豁免核心M18 gate。
- [ ] production code若有修改已執行`graphify update .`；CodeGraph pending已同步或直接讀取。
- [ ] `git status --short`、`git diff --cached --stat`與staged names只含預期code/tests/docs，無test artifacts。
- [ ] WP-51與Stage 10 README/checklist/progress狀態、實際commit與test counts已對帳。

## Exit decision

只有所有upstream exits、automated gates、M18 checklist與依OQ-51.1定義的manual gate皆為pass，才可將WP-51與Stage 10標完成並宣告M18。任何fail/blocked維持active，填owner、下一步與重驗範圍；不得以happy-path demo或重試成功取代exit evidence。

## Suggested commit

```text
docs(stage10): close WP-51 and M18 acceptance
```
