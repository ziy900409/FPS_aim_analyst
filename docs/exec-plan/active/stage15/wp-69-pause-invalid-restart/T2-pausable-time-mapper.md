# WP-69 T2 — Active measurement time 與 SimLoop freeze

## Objective

讓 pause 期間 gameplay time 真正凍結，resume 不 catch up；同時保持零 pause 路徑與既有 128 Hz 結果逐位相同。

## Steps

1. 新增純 `PausableTimeMapper`；輸入/輸出皆為 Chromium `performance.now()` time-origin 毫秒，不自行讀時鐘。
2. app 建構 SimLoop 時注入 mapped clock，rAF 每幀以 mapped `now` 呼叫 `pump()`；pause 時仍 pump 但 mapped time 固定。
3. HUD gameplay elapsed/countdown 改讀 mapped active time；hit feedback/tracer 等 render-only lifetime 繼續讀原 rAF wall time。
4. 以同一 mapper 對齊 recorder tick 與後續 T3 的 DOM event timestamps；定義 pause/resume/restart 的呼叫順序。
5. 補 zero-pause identity、pause ticks=0、resume no-catch-up、multi-pause、clock rollback/non-finite fail-fast、四 FPS determinism 與 fresh restart parity。

## Definition of Done

- [ ] pause 1/10/300 秒期間每幀 `pump()` 都回 `ticks=0`，sim/target/weapon/recorder count 全不變
- [ ] resume 第一幀 `ticks <= 1`（依餵入 delta）且沒有 >250 ms re-anchor；後續保持 128 Hz
- [ ] 從未 pause 的 30/60/144/240 FPS trace 與 T0 baseline 逐欄 `Object.is`
- [ ] gameplay HUD 不含 pause wall duration；render-only animation仍可運作
- [ ] `SimLoop.ts` 的 tick dt、accumulator clamp、target motion 公式無語意修改

## Commit

```text
feat(loop): freeze active time during paused attempts
```

