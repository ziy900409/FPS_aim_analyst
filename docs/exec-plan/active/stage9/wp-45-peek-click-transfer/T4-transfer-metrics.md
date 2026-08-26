# WP-45 / T4 — Transfer metrics assembler 與 flags

## Objective

以 `targetId` 組裝既有 hold-click exposure/acquisition 與 counterstrafe braking/sync 結果，新增 completion metrics；不重推 frozen 構念、不建立 composite score。

## Dependencies

T3。

## Scope

- `src/metrics/peekClickTransferMetrics.ts` + tests。
- ResultScreen/研究員輸出新增獨立 transfer section；Practice 不進正式 history。
- operational contract 草稿。

## Required metrics

- per trial:`tMeasurementOnsetMs`、`onsetToFirstShotMs`、`onsetToHitMs`、`shotsToKill`、`firstShotHit`、`validFirstShot`、flags。
- aggregate:`validFirstShotRate`、`firstShotHitRate`、`fireBeforeGateRate`、`anticipationRate`。
- nested:`counterstrafe: CounterstrafeMetrics`，保留 L/R sided stats。

## Required flags

`fire_before_first_visible`、`fire_before_measurement_onset`、`no_measurement_onset`、`no_counter`、`fire_before_gate`、`timeout`、`timeout_before_onset`、`player_corridor_exceeded`，以及既有 quality/suspect flags。

## Definition of Done

- [ ] README §2.3 D public contract 已實作或 ADR 記錄等價變更。
- [ ] presentation join 使用 targetId；事件順序亂序 fixture 仍產生相同結果。
- [ ] first-hit、first-miss→second-hit、timeout-before-onset、pre-fire、no-counter fixtures 全綠。
- [ ] 缺失值為 `undefined` + flag，沒有以 0 補缺。
- [ ] public key-set test 明確排除 `score`/`compositeScore`。
- [ ] ResultScreen 值來自同一 export snapshot；Practice history guard 全綠。
- [ ] `npm.cmd test -- src/metrics/peekClickTransferMetrics.test.ts src/metrics/counterstrafeMetrics.test.ts src/metrics/holdClickMetrics.test.ts` exit 0。

## Commit

`Add layered peek-click transfer metrics`
