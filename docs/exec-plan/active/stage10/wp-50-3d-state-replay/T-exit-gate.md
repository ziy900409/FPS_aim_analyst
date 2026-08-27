# WP-50 T-exit — Replay Acceptance and WP-51 Handoff

## Objective

依README FR/NFR/traceability驗收完整WP-50；證明replay fidelity分級、seek決定性、presentation隔離、UI與來源返回皆成立，並提供WP-51穩定契約。

## Automated gates

1. Browser與Node/server TypeScript typecheck exit 0。
2. 全Vitest exit 0，記錄files/tests count與replay property/state-hash tests。
3. 全Playwright exit 0，記錄tests count、browser/backend與fixture roots。
4. `npm run build`、`npm run test:ci` exit 0。
5. boundary scans：replay domain無DOM/Three/fs/sim/wall-clock/random；Replay UI無`node:*`；replay path無`SimLoop.pump`/InputSampler/Pointer Lock。
6. 42k tick normalize/seek/frame、cached scene first frame與50-cycle lifecycle benchmark達README NFR。

## Acceptance scenarios

| ID | Scenario | Pass condition |
|---|---|---|
| A-50.1 | full historical Assessment | disk JSON→Run Detail→Replay；scene/camera/targets/required visuals正確 |
| A-50.2 | current Assessment | Result→Replay；保存成功或失敗都使用相同in-memory payload |
| A-50.3 | Practice | 依OQ決策可in-memory replay或無action；任何情況零history mutation |
| A-50.4 | transport | play/pause/seek/四rate/end/restart與time HUD正確 |
| A-50.5 | events | markers、prev/next、duplicate/bounds與cue/visible/counter/fire/hit正確 |
| A-50.6 | seek invariant | 代表keyframes direct seek與sequential播放state hash相同，backward seek無殘影 |
| A-50.7 | partial | 有限重播只顯示可靠能力，persistent warning/reasons可讀 |
| A-50.8 | unsupported/invalid | 無假play action；結果/返回仍可用，不crash |
| A-50.9 | scene mismatch/failure | 正確degrade/retry/return；late scene dispose |
| A-50.10 | ownership | replay active live pump/input/pointer lock=0，single rAF/renderer owner |
| A-50.11 | navigation race | A→B、Back during load、reload/close無stale commit，route/scroll/focus還原 |
| A-50.12 | lifecycle/scale | 42k tick與50次enter/leave達perf/resource gates |

## Research/data safety

- [ ] full status逐exact drill/profile/version可追到fixture與required capabilities。
- [ ] legacy/partial/unsupported沒有推測target/projectile/impact資料。
- [ ] replay contract additive；old export/metrics/canonical fixtures與research results未變。
- [ ] test只用fixtures/validated temp roots，真實history root與Participant資料無mutation/artifact。

## Architecture regression

- [ ] ReplayPlayer/sample domain不依DOM/Three/live sim；scene adapter不寫SharedState。
- [ ] app只有一個presentation owner；`main.ts`不含support/interpolation/effect domain logic。
- [ ] current/historical entries共用controller/screen，未複製load/parse path。
- [ ] live determinism、target hit、recoil、ADS、result、history regressions全綠。
- [ ] dispose後listeners/rAF/subscriptions/GPU resources無殘留。

## Documentation and graph

- [ ] README OQ/assumptions/interfaces/profile matrix更新為實際交付。
- [ ] progress貼test/perf/a11y/manual/backend/acceptance evidence，checklist全✅。
- [ ] 上層Stage 10 README/checklist/progress更新WP-50狀態與WP-51 handoff。
- [ ] `graphify update .`完成；CodeGraph pending同步或已直接讀。
- [ ] `git status --short`、`git diff --cached --stat`與staged names只含預期code/tests/docs，無payload artifacts。

## Exit criteria

Automated gates、A-50.1～12、research safety與architecture regression全數有客觀證據才可宣告WP-50完成。至少一個official full profile、seek invariant、live isolation或partial honesty任一只有人工敘述、沒有test/measurement，T-exit不通過。

## Commit

```text
docs(stage10): close WP-50 3d replay
```
