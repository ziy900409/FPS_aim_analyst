# WP-24 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(GD-16 感度模型 + hold/toggle 拍板,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ⬜ | **T1** EV_ADS 輸入鏈 + heldAds(零破壞) | [T1-ads-input-event.md](T1-ads-input-event.md) | T0 | Med |
| ⬜ | **T2** WeaponConfig.ads + CameraController zoom/gain | [T2-weapon-camera-zoom.md](T2-weapon-camera-zoom.md) | T1 | Med |
| ⬜ | **T3** scope overlay + 記錄 + schema 對帳 | [T3-overlay-recording.md](T3-overlay-recording.md) | T2 | Med |
| ⬜ | **T-exit** ADS 鏈交付宣告 | [T-exit-gate.md](T-exit-gate.md) | T1–T3 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-24 狀態翻 ✅。
