# WP-69 T1 — Attempt validity、disposition、integrity 與 metadata 契約

## Objective

建立純函式/狀態機的單一 attempt 權威，使 pause invalidation sticky、restart 才清除，並讓可保留的 invalid payload 自述失效事實。

## Steps

1. 新增 `RunAttemptController` 與 `AttemptValidity`/`AttemptDisposition`/`RecordingIntegrityReason` 封閉型別；狀態只允許 README §2.1 的轉換。
2. 實作 `pause()` sticky transition、重複 pause idempotence、`restart()` attempt +1 及 fresh state；不得 import DOM/Three/`SharedState`。
3. 實作純 `evaluateRecordingIntegrity()`，只使用 T0 凍結的 tick/event/pause fence/overflow 判準。
4. `Meta.validity` 增 `pauseOccurred`（optional-in/required-out）；parser 舊檔缺席回 `false`，canonical output 帶 boolean，`suspect` OR 納入但不得作唯一 hard gate。
5. 測試 clean、pause→resume、repeat pause、restart、invalid-retained、discarded、舊 payload、未知/非法欄位與 canonical digest 影響。

## Definition of Done

- [ ] Resume 無法把 `invalid-paused` 改回 `eligible-candidate`；只有 `restart()` 可以
- [ ] `eligible-candidate` / `invalid-retained` / `discarded` 三態每一分支至少一個正向與一個反證測試
- [ ] `pointerLockLost` 與 `pauseOccurred` 可分別解析，錄製掉鎖組合測試兩者皆 true
- [ ] pre-WP-69 payload 可讀；WP-67 已落地時其 `opening` bytes/語意不被覆蓋
- [ ] 模組依賴掃描證明零 DOM/Three/sim/research import

## Commit

```text
feat(attempt): add sticky pause validity contract
```

