# WP-45 / T3 — Pilot drill、angular-size cells 與 gameplay contract

## Objective

新增 1.5°/2.0°/3.0° 三個 Practice pilot configs，沿用既有 cue/alternation/miss補槍/timeout pipeline；研究員入口預設註冊 2.0° cell，不改任何 stage6 frozen drill。

## Dependencies

T1 + T2 + **WP-44 T-exit**。

## Pilot defaults

- `sceneId='peek-ad-corridor-v1'`
- `mode='practice'`
- `targets.count=20`、distance=8u、static、小型等寬等高 box
- `sequence.alternation='LR'`、seed 為 stage9 pilot range、cue foreperiod 500 ms
- `timing.countdownMs=3000`、pilot timeout 預設依 OQ-S9-4、backstop=120000 ms
- default weapon=AK-47；第一發與補槍皆保留既有 recoil/spread/velocity gate
- hit 或 timeout 後翻面；first miss 不撤 target

## Tests

1. angular degree→world width 公式與三候選 config。
2. mode/scene/seed/hitbox/visibility metadata。
3. first target L、20 presentations 10L/10R。
4. cue direction 對應即將 spawn side。
5. hidden wall shot miss；移動曝光+急停 hit。
6. first miss target 保留；second hit 才推進。
7. timeout 推進；120s backstop 不會卡 running。
8. restart 同 seed replay identical。

## Definition of Done

- [ ] README §2.3 C 與 §2.4 trial contract 已實作。
- [ ] 三候選皆通過 schema/clearance；operator 不可輸入任意 size。
- [ ] 2.0° cell 可由 researcher mode 載入，scene/drill atomic match。
- [ ] 20 presentations = 10L/10R；hit/timeout 可結束 phase。
- [ ] first miss→second hit E2E export 含兩筆 fire、一筆 hit、同 targetId。
- [ ] stage6 drill configs/golden fixtures 零修改。
- [ ] `npm.cmd test -- src/drill/peek_click_transfer_pilot_v1.test.ts src/testharness/fpsTestHarness.test.ts` exit 0。
- [ ] `npm run typecheck` exit 0。

## Commit

`Add peek-click transfer pilot drill cells`
