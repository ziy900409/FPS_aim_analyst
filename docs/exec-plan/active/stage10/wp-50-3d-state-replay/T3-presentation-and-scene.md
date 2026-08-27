# WP-50 T3 — Exclusive Presentation Ownership／Base Replay Scene

## Objective

讓replay以隔離scene/camera租用既有renderer/canvas，並在app單一rAF中完全取代live presentation；scene load、resize、return與dispose可安全競態。

## Steps

1. 對`main.ts` render callback、createRenderLoop/createRenderer、SceneManager/CameraController執行最新CodeGraph impact。
2. 抽`PresentationCoordinator`/session port；frame mode在任何`simLoop.pump`前互斥分流，不把replay判斷散落live modules。
3. 建ReplaySceneAdapter：依recorded scene descriptor/exact profile建立獨立SceneManager/camera；直接套sampled camera position/quaternion/FOV基礎。
4. 實作async payload/scene generation、loading/error/abort/late-dispose、active-only resize與renderer lease release。
5. 以spy/E2E驗證replay active時pump/InputSampler/Pointer Lock=0、只有一rAF/renderer owner；退出回來源不resume進行中run。
6. 做50次enter/load/leave與scene failure/mismatch/WebGPU-WebGL fallback lifecycle test。

## Invariants

- replay不寫`SharedState`，不使用live camera/scene/TargetView。
- source只允許ended Result或History；進行中test沒有replay入口。
- late scene不可掛入active tree；dispose所有GPU/listener/controller資源。
- 若T0改採dedicated renderer，須保留single active owner與額外context resource evidence。

## Definition of Done

- [ ] NFR-50.3/5/6 instrumentation通過。
- [ ] camera base、simToWorld、scene/fallback/version mapping有unit/integration evidence。
- [ ] resize、rapid run switch、abort、load failure與50-cycle lifecycle tests全綠。
- [ ] live render/determinism regressions無變化，`main.ts`只留composition/delegation。

## Commit

```text
feat(replay): add isolated replay presentation
```
