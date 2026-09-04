# WP-56 T5 — Automated Integration／Determinism／Performance Gates

## Objective

用可在CI與本機重跑的browser/domain gates驗證完整Micro Flick流程、failure recovery、四render-FPS決定性、spawn壓力、scene lifecycle與全專案回歸。

## Automated scenarios

| ID | Scenario | Pass condition |
|---|---|---|
| A-56.1 | researcher load | exact drill載入exact scene；首個running tick後3 visible sphere targets |
| A-56.2 | hit replacement | hit exact ID；survivors不變；≤1 tick恢復3 targets |
| A-56.3 | miss/stale ID | score/quota/target set不變，無額外visible event |
| A-56.4 | fixed player | W/A/S/D 10秒零position/camera-base drift；mouse aim有效 |
| A-56.5 | budget/end/restart | 尾段3→2→1→0、ended；restart回同seed initial hash |
| A-56.6 | determinism | 30/60/144/240 FPS逐ticktarget trace完全一致 |
| A-56.7 | spawn stress | 10k accepted positions皆finite/in-bounds/separated/unique，attempt bounded |
| A-56.8 | rendering/resource | 1k replacements pool=3；50次scene switch無children/resource/listener成長 |
| A-56.9 | viewport/contrast | 1080p/720p targets在safe region、crosshair≤1px、contrast≥3:1 |
| A-56.10 | no weapon | asset/scene/DOM無weapon/hands/muzzle與不在scope UI |
| A-56.11 | load failure | fallback/error可離開並可重新載入；無stale targets或unhandled rejection |
| A-56.12 | data honesty | practice不persist；unknown exact drill不full replay；events保留exact targetId |

## Performance method

- 使用production build或明確記錄的test build；先warm 100 iterations，再採至少10,000 samples計P50/P95/max。
- target domain量測不含test assertion與JSON serialization；render量測需分開記CPU adapter與GPU/browser frame evidence。
- first-visible-frame測cached asset至少20次；記hardware、OS、browser/version、resolution與background load。
- resource gate以pool size、scene child count、dispose spies、listener/rAF instrumentation為主，不只看一次heap snapshot。

## Commands（以當時package scripts為準）

```text
npm run typecheck
npm test
npm run build
npm run test:e2e
```

T0/T5若新增Stage 12 aggregate script，必須只組合既有tests/benchmarks，不把domain assertion藏在runner內。

## Definition of Done

- [ ] A-56.1～12全數有automated evidence或明確manual-only理由；核心lifecycle不得manual-only。
- [ ] NFR-56.1～7與9達標，環境／樣本／P95數據寫入progress。
- [ ] full typecheck/Vitest/build/Playwright exit 0，記files/tests count。
- [ ] existing counter-strafe、tracking、spider-shot、replay、history與scene regressions無變化。
- [ ] failure artifacts只在validated test/temp roots，無Participant/history資料mutation。

## Commit

```text
test(stage12): add micro-flick acceptance gates
```

