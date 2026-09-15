# WP-69 T3 — Input/Camera gate、Pointer Lock Resume、PauseOverlay 與 Restart

## Objective

交付可操作的暫停介面，確保 pause/resume-countdown 中沒有 gameplay input 或 camera 偷跑，且 Restart 是唯一恢復 candidate eligibility 的動作。

## Steps

1. `InputSampler` 注入 `isGameplayInputEnabled()` 與 `mapEventTime()`；所有 keyboard/mouse/fire/ADS 走同一 gate。
2. 增 `suspend(t)`：對已採計 held controls 送出成對 release edge，再拒收 gameplay；不得由 UI 直接寫 `SharedState.held*`。
3. camera movement consumer 使用同一 enable gate；pause/locking/resume-countdown 都不套用 delta。
4. recording-time `pointerlockchange locked=false` 呼叫 attempt `pause()`、mapper `pause()` 與 sampler `suspend()`；armed/idle/ended 不失效。
5. 新增純 TS DOM `PauseOverlay`。Resume click 同步呼叫 `pointerLock.request()`；成功事件進 resume countdown，error 留在 paused；倒數完才 mapper resume/input enable。
6. Pause overlay 新增 Restart，收斂到單一 full-restart coordinator，清 attempt/time/input/recorder/sim/RNG/UI 後回既有 armed。

## Definition of Done

- [ ] overlay 文案逐字含「本次已失去實驗效力」「繼續仍無效」「只有完整重新測試才能再次接受門檻」
- [ ] pause 與 resume-countdown 期間 ring write count、camera yaw/pitch、held states 與 shot count 無新增
- [ ] Resume request 在 button click stack 內發生；成功/NotSupported fallback/error 三路有測試
- [ ] armed lock→unlock helper 仍為 `pauseOccurred=false`；countdown/running 掉鎖為 true
- [ ] Restart 後 attempt +1、validity fresh、同 config/seed、需重新取鎖並跑初始 countdown
- [ ] overlay 建構期一次配置，更新路徑零新增 DOM node

## Commit

```text
feat(ui): add invalidating pause and full restart controls
```

