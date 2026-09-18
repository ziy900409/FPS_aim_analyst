# WP-71 T1 — Config contract、schema 與 opening cue resolver

> FR-71.1／71.3／71.4／71.10 · NFR-71.1／71.6／71.7 · FM-71.1／71.2

## Objective

建立 opt-in、封閉且可驗證的 cue descriptor；不建立 mesh、不接 app、不修改任何 sim/input/state 檔。

## Steps

1. 在 `DrillConfig.targets` 新增 `openingCue?: 'countdown-anchor-v1'`，省略時保持現況。
2. 更新 `schema.ts` 白名單重組與 validation：未知值 fail fast；目前唯一允許組合為 `spiderShot.kind === 'center-peripheral-yawpitch'`。
3. 新增 `src/drill/openingTargetCue.ts`：實作 README §2.3 的型別與 `resolveOpeningTargetCue()`。
4. position 只呼叫 `spiderWideEyePos(0, 0, config.spiderShot.distanceU)`；size/shape 只讀 `resolveTargetHitbox()`，`visualSize` 存在時只影響 size。
5. `spiderShotWideV1Template` opt-in；其餘 roster 零修改。
6. 單元測試至少覆蓋：省略→null、wide-v1 exact descriptor、非法 mode、非法 spider kind、visualSize、FOV/aspect 重解析不改 center anchor、resolver 不消耗 RNG。
7. 以 source scan 斷言 resolver 不 import `SharedState`／`TargetManager`／clock／RNG；檢查 `src/sim/`、`src/input/` production diff 為空。

## Definition of Done

- [ ] 合法／非法 config 測試具名通過，錯誤訊息含 `targets.openingCue`。
- [ ] descriptor position 與正式首中心 spawn expectation 逐欄 `Object.is` 或 bit-exact 相等。
- [ ] descriptor display size 與 `resolveTargetHitbox()` 單一來源對表。
- [ ] 非 opt-in roster canonical config／既有 fixture 零位移。
- [ ] `npm run typecheck`、`npx vitest run <T1 cases>` exit 0。
- [ ] `git diff -- src/sim src/input src/state/SharedState.ts` 為空。

## Commit

```text
feat(wp-71): define the opening target cue contract
```
