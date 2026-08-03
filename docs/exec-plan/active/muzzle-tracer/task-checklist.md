# WP-27 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk | 估時 |
|------|------|------|------|------|------|
| ✅ | **T0** entry gate(基線核對 + 讀碼證據,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low | 0.25 |
| ⬜ | **T1** hip muzzle tracer(muzzleOffset + `BulletArena.m*` + SimLoop 四切口) | [T1-hip-muzzle-tracer.md](T1-hip-muzzle-tracer.md) | T0 | **Med** | 0.75–1 |
| ⬜ | **T2** ADS muzzle(`heldAds` 階躍切換 + 量測值回填) | [T2-ads-muzzle.md](T2-ads-muzzle.md) | T1 + OQ-MT-2 | Low-Med | 0.5–1 |
| ⬜ | **T-exit** 三不變性驗收 + 視覺驗收 + 文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T1–T2 | — | 0.25–0.5 |

## 執行規則(沿用 [exec-plan/README.md §5](../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [exec-plan/README.md §2](../../README.md) 的 WP-27 狀態翻 ✅,資料夾移入 `completed/`。
- **T1 未綠不開 T2**(ADS 是 hip 路徑的分支,基礎路徑先鎖)。
- **紅線提醒(每個 task 開工前重讀)**:muzzle 偏移**只可**寫入 `shotRays` 與 `BulletArena.mx/my/mz`;
  **不得**進入 raycast 原點、`arena.ox/oy/oz`(maxRange/落地基準)、`arena.x/y/z` 或 `pushImpact`。
