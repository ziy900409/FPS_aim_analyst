# WP-56 T-exit — Micro Flick Acceptance and Handoff

## Objective

依README FR/NFR/traceability驗收完整WP-56；證明三靶population、fixed translation、scene/presentation、hit/events、determinism、performance、visual與資料邊界成立，並提供後續Assessment／multi-target replay可依賴的誠實handoff。

## Automated gates

1. Browser與Node TypeScript typecheck exit 0。
2. 全Vitest exit 0，記files/tests count與multi-target property/determinism tests。
3. 全Playwright exit 0，記tests count、browser/backend與fixture roots。
4. `npm run build`與現有CI組合命令exit 0。
5. A-56.1～12全數pass；replacement ≤1 tick、four-FPS trace、10k spawn與resource gates有機器可讀結果。
6. boundary scans：engine module無micro-flick drillId特例、spawn無`Math.random()`/render clock、asset無weapon/hands/target nodes。

## Acceptance scenarios

| ID | Scenario | Pass condition |
|---|---|---|
| A-56.1 | researcher load | exact scene/drill，running後3 targets |
| A-56.2 | hit replacement | exact ID撤除，survivors不變，≤1 tick補位 |
| A-56.3 | miss/stale | quota/score/targets不變 |
| A-56.4 | fixed player | translation零漂移，mouse aim有效 |
| A-56.5 | exhaustion/restart | budget尾段、ended與same-seed restart正確 |
| A-56.6 | determinism | 30/60/144/240 FPS target trace等價 |
| A-56.7 | spawn stress | 10k positions bounds/separation/finite/unique成立 |
| A-56.8 | lifecycle | pool=3，1k replacement/50 scene cycles無resource成長 |
| A-56.9 | viewport/contrast | 1080p/720p safe region、crosshair、contrast達標 |
| A-56.10 | no weapon | asset/scene/DOM/manual screenshot皆無weapon/hands/muzzle |
| A-56.11 | failure recovery | load fail/switch/retry可操作，無stale state |
| A-56.12 | data honesty | practice-only、no history、no full replay、exact targetId events |

## Data and research safety

- [ ] exact drill保持practice-only；Participant/session protocol roster沒有此ID。
- [ ] history repository/save client mutation=0；tests不寫真實Participant roots。
- [ ] WP-50 replay classifier不把此drill標full；UI不呈現不可信的三靶重播。
- [ ] visible/fire/hit events保留exact targetId且無duplicate visible記錄。
- [ ] legacy exports、metrics、official Assessment fixtures與canonical serialization無變化。

## Architecture regression

- [ ] DrillConfig新增欄位optional且default保持legacy；engine無scene/drill ID conditional。
- [ ] spawn/lifecycle只在128 Hz sim，render不改state、不消費RNG。
- [ ] TargetView/HitDetector/Crosshair沿用單一共享契約，沒有micro-flick forks。
- [ ] fixed translation離開drill後不洩漏到其他drills。
- [ ] SceneManager／PresentationCoordinator仍維持single scene/renderer/rAF ownership與完整dispose。

## Documentation and graph

- [ ] README interface/OQ/assumptions/paths更新為實際交付。
- [ ] progress貼tests/perf/resource/visual/manual/failure evidence，checklist全✅。
- [ ] 上層Stage 12 README/checklist/progress若已存在則同步WP-56狀態與handoff。
- [ ] `graphify update .`完成；CodeGraph pending同步或已直接讀取pending files。
- [ ] `git status --short`、`git diff --cached --stat`與staged names只含預期code/tests/assets/docs，無影片或temp artifacts。

## Exit criteria

Automated gates、A-56.1～12、data safety、architecture regression與T6 visual checklist全數有客觀證據才可宣告WP-56完成。三靶只靠肉眼、replacement latency未量測、spawn determinism未跨FPS、或no-full-replay boundary未測任一成立時，T-exit不通過。

## Commit

```text
docs(stage12): close WP-56 micro-flick test scene
```

