# WP-15 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(容差拍板 + 資料備妥檢查,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low(surrogate PASS;實錄 caveat) |
| ✅ | **T1** cl_showpos 起步/急停逐 tick 對表(128Hz surrogate;抓到+修正 CS2_PROFILE 常數 bug) | [T1-clshowpos-calibration.md](T1-clshowpos-calibration.md) | T0、WP-14 exit | Med |
| ✅ | **T2** pattern 逐彈比對 + 換算檢查(RED/STOP:外部 AK pattern yaw 偏差超容差,已記歸因) | [T2-pattern-comparison.md](T2-pattern-comparison.md) | T0、WP-13 exit | Med |
| ⬜ | **T-exit** M7 門(比對通過 + 歸因定稿) | [T-exit-gate.md](T-exit-gate.md) | T1, T2 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-15 狀態翻 ✅(M7)。
