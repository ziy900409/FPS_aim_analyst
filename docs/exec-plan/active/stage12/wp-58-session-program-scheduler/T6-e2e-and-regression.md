# WP-58 T6 — 端到端整合與回歸對帳

## Objective

在真實瀏覽器證明「編排 → 預覽 → eligibility gate → 逐步執行 → 逐輪匯出 → 完成」整條路徑成立，並對帳既有決定性／Session Plan／history 回歸零破壞（NFR-58.2、FR-58.10）。

## Steps

1. 更新 `tests/e2e/session-orchestrator.spec.ts` 的 Session Plan 案例以符合新表單（**更新既有 spec，不新開平行 spec**）。
2. 新增 E2E：自訂 program「3 個不同家族 drill × 2 reps、drillRest=1s、familyRest=2s」的縮小版，驗證
   - 預覽表步數與內容正確（11 步：6 run + 5 rest）；
   - 實際休息時長落在容許誤差內（rep 邊界 1s、family 邊界 2s）；
   - 產生 6 份匯出、檔名互異；
   - 完成後 `experimentSession.exit()` 生效、rest overlay 已隱藏。
3. 新增 E2E：frozen「標準 Assessment」路徑跑完，行為與本 WP 之前一致（家族順序、單一休息秒數、熱身）。
4. 新增 E2E 失效案例：program 中途 drill 載入失敗 → session 中止、錯誤可見、overlay 不殘留。
5. 跑全量 Vitest 與 Playwright，記錄 files/tests 數、browser 與 backend。
6. 逐條對帳既有回歸：決定性測試、target hit、recoil、ADS、result、history、replay 全綠且**零修改**。
7. 執行 `graphify update .`，同步 CodeGraph。

## Invariants

- 既有決定性回歸測試零修改全綠（NFR-58.2）。
- E2E 不寫入真實 `data/session-history/`；使用 fixture／temp root。
- 不得為了讓 E2E 過而放寬既有斷言。

## Definition of Done

- [ ] `session-orchestrator.spec.ts` 更新後全綠，且未新開平行 Session Plan spec。
- [ ] 自訂 program E2E 通過：11 步預覽、休息時長、6 份唯一匯出、完成後狀態。
- [ ] frozen 路徑 E2E 通過且行為與改造前一致。
- [ ] 載入失敗 E2E 通過（中止 + 錯誤可見 + overlay 不殘留）。
- [ ] 全量 Vitest 與 Playwright exit 0，數量與環境記入 progress。
- [ ] 既有決定性／hit／recoil／ADS／result／history／replay 回歸零修改全綠。
- [ ] `graphify update .` 完成，CodeGraph pending 已同步或已直接讀。

## Commit

```text
test(session): cover custom session program end to end
```
