# WP-15 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🛑 T0 STOP(2026-07-07):容差已拍板,校準參考資料未備

| Task | 狀態 |
|---|---|
| T0 entry gate | 🛑 STOP 2026-07-07(資料未備;不開 T1/T2) |
| T1 cl_showpos 對表 | ⬜ |
| T2 pattern 比對 | ⬜ |
| T-exit(M7) | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-2 校準容差 | ✅ decided 2026-07-07 | `cl_showpos` 速度逐 tick **±1 u/s**;AK pattern 逐彈角度 **±0.05°**。首輪跑完若需校正,須記錄最大偏差、原因分層與新容差理由。 |

---

## Log

### 2026-07-07 — T0 entry gate STOP(OQ-S2-2 已拍板;參考資料未備)

**閘門結論:STOP, not PASS。** T1/T2 不得開工,因校準參考資料尚未入 repo。`git diff --stat` 本切片預期僅包含 docs;不碰 `src/`。

**上游 exit 證據:**

| 上游 | checklist | exit-gate 證據 |
|---|---|---|
| WP-13(M6) | [../wp-13-sim-camera-integration/task-checklist.md](../wp-13-sim-camera-integration/task-checklist.md) 全 ✅ | [progress.md](../wp-13-sim-camera-integration/progress.md) 記錄 `npm run typecheck` exit 0、`npm run test` 38 files / 289 tests passed、`npx playwright test` 9 passed,並有手動視覺/手感 4 項確認。 |
| WP-14 | [../wp-14-movement-physics/task-checklist.md](../wp-14-movement-physics/task-checklist.md) 全 ✅ | [progress.md](../wp-14-movement-physics/progress.md) T-exit 記錄 `npm run test:ci` exit 0:Vitest 40 files / 298 tests passed、Playwright 9 passed,並完成 Edge 手感驗證。 |

**OQ-S2-2 決議:**採 stage2 計畫預設並拍板為明確數字:
- `cl_showpos` 起步/急停速度逐 tick 容差:**±1 u/s**。
- AK pattern 逐彈角度容差:**±0.05°**。
- 首輪比對若需調整容差,不得靜默放寬;必須在本 progress 記最大偏差 tick/彈號、差異分層(公式/常數/subtick/資料品質)、新容差與理由,並同步回填 [../README.md §8](../README.md)。

**參考資料清點(STOP 條件):**

| 參考資料 | 期待路徑/證據 | T0 結果 |
|---|---|---|
| CS2 `cl_showpos` 起步段 | `tests/golden/calibration/clshowpos-accel.json`,tick 連續無缺漏,含 tickrate/來源/錄製條件 | ❌ 缺。`tests/golden/calibration` 目錄不存在。 |
| CS2 `cl_showpos` 急停段 | `tests/golden/calibration/clshowpos-stop.json`,tick 連續無缺漏,含 tickrate/來源/錄製條件 | ❌ 缺。`tests/golden/calibration` 目錄不存在。 |
| 社群 AK pattern 圖 | `tests/golden/calibration/ak47-pattern.json`,含來源 URL 與可複核的像素→角度標定方法 | ❌ 缺。repo 內僅有 WP-10 recoil golden 與 pattern viewer PNG,沒有可標定外部 pattern fixture。 |

**資料清點證據:** `rg --files tests docs | rg "(calibration|clshowpos|showpos|pattern|ak47)"` 只找到 WP-15 task 文件、WP-10 recoil golden(`tests/golden/recoil/*`)與 pattern viewer 圖;未找到 `tests/golden/calibration/*`。`Test-Path tests\golden\calibration` 回報 missing。

**Decision Log:**
- **容差先拍板,資料 gate 獨立 STOP。** Alternatives Considered:等待資料後再決定容差;否決,因 T1/T2 測試需先有固定 DoD,且計畫已提供保守預設。資料缺口不影響 OQ-S2-2 數字拍板,但阻塞 T1/T2。
- **不建立空 fixture 或測試骨架。** Alternatives Considered:先建 `tests/golden/calibration` 與 skipped tests;否決,T0 明確寫「資料不在手 = blocker(STOP),不得以先寫測試骨架繞過」。

**Open Questions / Blocker:**
- 研究者需提供 CS2 `cl_showpos` 起步 + 急停錄製資料(各至少一段,64 tick 連續、含 tickrate/來源/錄製條件)。
- 研究者需提供 AK pattern 圖來源 URL 與可標定尺度,或直接提供可複核的 30 點數位化草稿與標定方法。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md) §6 WP-15 表 + session 補充決定)展開為自足 task 檔(T0–T2 + T-exit)。
- 補充決定:T0 加入**參考資料備妥檢查**(CS2 `cl_showpos` 錄製檔、社群 pattern 圖來源)——資料不在手 = blocker,列 STOP 條件。
- 比對不過的處理原則 = 差異分層歸因(公式/常數/subtick),不盲調參([README.md §2](README.md))。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— OQ-S2-2 拍板 + 資料清點,docs-only。
