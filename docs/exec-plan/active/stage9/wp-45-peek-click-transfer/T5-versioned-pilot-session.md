# WP-45 / T5 — Versioned transfer-pilot session roster / preset

## Objective

提供受試者內三條件 pilot session：`hold-click`、`counterstrafe`、`peek-click-transfer`。順序依 participant/session 位置平衡，保留 60 秒 rest 與既有 warmup policy；stage6 v1 四家族 default order 必須逐位不變。

## Dependencies

T4 + **stage8 WP-43 T-exit**。

## Design

- 新增 `TRANSFER_PILOT_FAMILY_IDS`，不改 `TEST_FAMILY_IDS` 的四元素與順序。
- 新增 generic/versioned `buildFamilyOrderForRoster()`；既有 `buildFamilyOrder()` 仍封裝原 roster。
- `SessionRunner` additive 支援 `'peek-click-transfer'` resolution，不放寬 operator 任意 drill id。
- 新 preset `transfer-pilot-v1`:三家族、60 秒 rest、既有 counterstrafe warmup；transfer 自身是否加 warmup由 T5 entry 時依 WP-43 UI contract拍板。
- export protocol context 必須包含 participantId/sessionIndex/condition position/label。

## Failure modes covered

- FM-P45-7 stage6 order drift。
- FM-P45-8 stage8入口衝突。
- pseudoreplication：UI/report 明確呈現 participant/session/block/trial 層級；不把 trial count 當 participant n。

## Definition of Done

- [ ] 既有 `buildFamilyOrder()` golden cases byte-for-byte/deep-equal 不變。
- [ ] transfer roster 在三個連續 sessionIndex 中，每家族各出現在 position 0/1/2 一次。
- [ ] 相同 participant/session deterministic；不同 participant offset 可重現。
- [ ] roster empty/duplicate/negative sessionIndex 明確 throw。
- [ ] Session Plan 入口只在 versioned preset 顯示 transfer family，不污染 stage6 default preset。
- [ ] 60 秒 rest、warmup→family→rest→next flow E2E 全綠。
- [ ] 三個 exports 含相同 participant/session block context 且各自 scene/drill 正確。
- [ ] `npm.cmd test -- src/session/sessionSchedule.test.ts src/session/SessionRunner.test.ts src/ui/SessionPlanSetup.test.ts` exit 0。

## Commit

`Add versioned peek-click transfer pilot session`
