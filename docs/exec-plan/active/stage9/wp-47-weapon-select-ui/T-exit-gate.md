# T-exit — 驗收 + 文件對帳

> Part of [WP-47](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 + T2 |
| **Risk / Cplx** | — |
| **Touches** | 本 WP 文件狀態收尾;視結果可能新增 `docs/operational/` 使用說明(非必要,見 Steps) |
| **狀態** | ⬜ |

## Objective

驗收 WP-47 全部交付內容(自動測試 + 手動瀏覽器驗證),並依 stage9 既有先例誠實記錄哪些跨文件對帳動作被有意延後。

## Steps

- [ ] `npm run test:ci`(`tsc --noEmit` + `vitest run` + `playwright test`)全綠。
- [ ] 覆核 T2 手動驗證四項全部通過(fire rate 差異可感知、ADS 隨武器切換、換 drill 後 override 重置、匯出 `meta.weapon.id` 正確)。
- [ ] `task-checklist.md`/`progress.md`/本 WP `README.md` 狀態更新為 ✅。
- [ ] 視情況更新 [../README.md](../README.md) §5 WP 索引新增 WP-47 一列——**先確認當下無其他並行工作正在改動該共用檔案**(比照 WP-44 T-exit 的處置原則,見下方「誠實記錄」)。
- [ ]（有意延後,見下方)`docs/exec-plan/DECISIONS.md`/`docs/exec-plan/README.md` §2/§4/§6/`docs/MAP.md`:正式 WP/GD/里程碑編號指派——比照 stage8(WP-43)/stage9(WP-44/45/46)先例,留給使用者決定何時正式採納。

## 誠實記錄:本次刻意不做的事

比照 WP-44/45/46 的處置方式,本 WP 在交付時**不**佔用具體 GD 編號、**不**寫入 `DECISIONS.md`/`exec-plan/README.md` §2/§4/§6/`docs/MAP.md` 的正式索引項,只在 `stage9/README.md`(視 T-exit 當下是否有並行工作衝突而定)與本 WP 文件內用「暫用 WP-47」標記,留待使用者確認要正式開工/編號時一次性補上。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `npm run test:ci` 全綠 | 執行輸出 |
| ② | T2 四項手動驗證全部通過 | 本檔 Steps 勾選 + 手動記錄 |
| ③ | 本 WP 內部文件(task-checklist/progress/README)狀態一致,全部 ✅ | 本檔 diff |
| ④ | 誠實記錄延後的跨文件對帳項,不擅自佔用編號 | 本檔「誠實記錄」段 |

## Commit

`docs(wp-47): T-exit — 驗收 + 文件對帳(WP/GD 編號正式指派延後)`
