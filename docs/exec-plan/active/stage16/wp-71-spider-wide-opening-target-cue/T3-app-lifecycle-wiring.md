# WP-71 T3 — App lifecycle、phase gate 與 scene replacement 接線

> FR-71.2／71.4／71.5／71.7 · NFR-71.1／71.2／71.7 · FM-71.1／71.3／71.4

## Objective

把 cue 接進 production app，但維持正式 target、sim、input、hit 與 recorder 全部不變。

## Steps

1. 在 scene/view 建構點建立 `OpeningTargetCueView`；scene replacement 與 `TargetView` 同步 dispose/recreate。
2. 建立單一 `configureOpeningTargetCue(activeDrillConfig)` 接線點，供初始載入、Restart、換 weapon、換 drill、換 scene、Session Plan block 共用；不得在五條路徑各自寫 mode 比較式。
3. `liveFrame` 的 visibility gate 凍結為：`drillRunner.phase === 'countdown' && runAttempt.phase === 'active' && descriptor !== null`。
4. `armed` 不顯示；pause/locking/resume-countdown 隱藏；若原初 countdown 尚有剩餘，resume 完成後重新顯示到 running transition。
5. running frame 先依 phase 隱藏 cue，再由既有 `TargetView.sync(sharedState.targets, ...)` 顯示正式 target；測同 frame 不雙重顯示。
6. 加 integration tests：六相位表、五條 activation 路徑、scene replacement、非 wide drill、restart、pause/resume。
7. 加 determinism fixture：cue on/off × 30/60/144/240 FPS，正式 tick/event/target sequence 逐位相等。
8. source scan：本 task 不修改 `SimLoop.ts`、`TargetManager.ts`、`HitDetector.ts`、`SharedState.ts`、`src/input/`。

## Definition of Done

- [ ] 六相位 truth table 全綠，尤其 pause/resume-countdown 不顯示 cue。
- [ ] 五條 activation/restart 路徑無 stale cue；scene child/resource 計數回到基線。
- [ ] countdown `targets/tVisible/visible events = 0/0/0`；running 首 tick = `1/1/1`。
- [ ] cue/live position、shape、display size 逐位相等，且 transition frame 無雙 mesh。
- [ ] 四 FPS cue on/off determinism fixture 逐位一致。
- [ ] `npm run typecheck`、targeted Vitest、`npx vitest run tests/regression` exit 0。

## Commit

```text
feat(wp-71): wire the cue into drill countdown lifecycle
```
