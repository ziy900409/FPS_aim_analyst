# WP-15 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T0 surrogate PASS(2026-07-07):速度曲線採 theory-derived fixture;實錄 caveat 留 T-exit

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ surrogate PASS 2026-07-07(可開 T1/T2;實錄 caveat) |
| T1 cl_showpos 對表 | ⬜ |
| T2 pattern 比對 | ⬜ |
| T-exit(M7) | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-2 校準容差 | ✅ decided 2026-07-07 | `cl_showpos` 速度逐 tick **±1 u/s**;AK pattern 逐彈角度 **±0.05°**。首輪跑完若需校正,須記錄最大偏差、原因分層與新容差理由。 |
| OQ-15.1 速度曲線資料來源 | 🟡 caveat accepted 2026-07-07 | 因目前沒有高幀率錄影設備,研究者批准以 Source movement 公式 + CS2 cvars 產生 theory-derived surrogate fixture。T1 可開工;M7/T-exit 不得宣稱已通過 `cl_showpos` 實錄行為級校準。 |

---

## Log

### 2026-07-07 — T0 amended to surrogate PASS(theory-derived velocity fixtures)

研究者指示:目前沒有設備錄高幀率影片,改用本輪調查得到的速度曲線資料。T0 因此由 STOP 改為 **surrogate PASS**。

**新增 fixtures:**
- [tests/golden/calibration/clshowpos-accel.json](../../../../../tests/golden/calibration/clshowpos-accel.json):Source movement 公式 + CS2 cvars 產生的起步曲線;primary `knife_250`,alternate `ak47_215`。
- [tests/golden/calibration/clshowpos-stop.json](../../../../../tests/golden/calibration/clshowpos-stop.json):同來源的 counter-strafe 急停 signed velocity 曲線;含 zero-crossing bracket。

**採用依據:**
- Source movement 順序採 friction → accelerate;fixture meta 記公式與來源。
- CS2 cvars 採 `sv_accelerate=5.5`、`sv_friction=5.2`、`sv_stopspeed=80`。
- `cl_showpos` 有 frame interpolation 與 subtick partial-step 地雷;T1 對齊規則改為 fixture tick 0 = input 生效後第一個完整 64Hz movement step,未來真實錄資料的 partial sample 不納入 ±1 u/s 斷言。

**Decision Log:**
- **接受 theory-derived surrogate 解除工程 blocker,但不等同外部行為真值。** Alternatives Considered:維持 STOP 直到高幀率 `cl_showpos` 錄影可得;使用者明確表示目前無設備並要求使用本資料,故改採 surrogate 以推進 T1/T2。限制寫入 OQ-15.1 與 T1/T-exit caveat。
- **保留 primary `knife_250` + alternate `ak47_215`。** 現行 WP-14 movement baseline 是 250 u/s,但 recoil/AK 情境的手持速度為 215 u/s;兩條曲線同檔保留,避免日後 weapon-specific movement 對帳重做 fixture。
- **stop fixture 保存 signed velocity。** Alternatives Considered:只存 `abs(speed)`;否決,因 counter-strafe 持續按反向鍵會 overshoot,保存 signed velocity 才能明確斷言 zero-crossing bracket。

**Open Questions / Caveat:**
- 若日後可取得 demo parser 或高品質實錄,應新增 `sourceType=demo-derived` 或 `sourceType=clshowpos-capture` fixture,再決定是否替換 theory surrogate。
- T-exit/M7 若仍只使用 theory surrogate,結論文字必須降級為「公式/常數曲線對表通過」,不能宣告 `cl_showpos` 實錄行為級通過。

### 2026-07-07 — AK pattern candidate fixture added(Aiming.Pro)

研究者提供 Aiming.Pro drill creator 內 AK47 spray pattern 數值與來源:
- 來源 URL:`https://aiming.pro/app#/training/drills/create`。
- 第 1 欄 = yaw / horizontal = `xDeg`。
- 第 2 欄 = pitch / vertical = `yDeg`。
- 30 發角度值已整理為 [tests/golden/calibration/ak47-pattern.json](../../../../../tests/golden/calibration/ak47-pattern.json)。

**清點狀態更新:**AK pattern 由「缺」改為「候選 fixture 已入 repo」。此資料是來源 UI 直接給出的角度值,因此不需要像素→角度標定;但 T2 實作時仍必須明確把來源 sign convention 映射到本專案 yaw/pitch sign。`cl_showpos` 起步與急停兩段仍缺,所以 WP-15 T0 整體維持 STOP,T1/T2 不開工。

**Out of scope note:**研究者同時提供 Custom Damage Fall Off、clip、spread 等武器設定截圖;這些不屬於 WP-15 T2 pattern fixture 的必要欄位,暫不入本 fixture。若後續要校準 weapon config,應另開對應資料/測試切片。

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
| 社群 AK pattern 圖 | `tests/golden/calibration/ak47-pattern.json`,含來源 URL 與可複核的像素→角度標定方法 | 🟡 2026-07-07 已補候選 fixture:Aiming.Pro drill creator 直接角度值;不需像素標定,sign 映射待 T2 明確化。 |

**資料清點證據:** `rg --files tests docs | rg "(calibration|clshowpos|showpos|pattern|ak47)"` 只找到 WP-15 task 文件、WP-10 recoil golden(`tests/golden/recoil/*`)與 pattern viewer 圖;未找到 `tests/golden/calibration/*`。`Test-Path tests\golden\calibration` 回報 missing。

**Decision Log:**
- **容差先拍板,資料 gate 獨立 STOP。** Alternatives Considered:等待資料後再決定容差;否決,因 T1/T2 測試需先有固定 DoD,且計畫已提供保守預設。資料缺口不影響 OQ-S2-2 數字拍板,但阻塞 T1/T2。
- **不建立空 fixture 或測試骨架。** Alternatives Considered:先建 `tests/golden/calibration` 與 skipped tests;否決,T0 明確寫「資料不在手 = blocker(STOP),不得以先寫測試骨架繞過」。

**Open Questions / Blocker:**
- 研究者需提供 CS2 `cl_showpos` 起步 + 急停錄製資料(各至少一段,64 tick 連續、含 tickrate/來源/錄製條件)。
- AK pattern 候選 fixture 已補;T2 仍需在測試中明確來源 sign convention 到 project yaw/pitch 的映射。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md) §6 WP-15 表 + session 補充決定)展開為自足 task 檔(T0–T2 + T-exit)。
- 補充決定:T0 加入**參考資料備妥檢查**(CS2 `cl_showpos` 錄製檔、社群 pattern 圖來源)——資料不在手 = blocker,列 STOP 條件。
- 比對不過的處理原則 = 差異分層歸因(公式/常數/subtick),不盲調參([README.md §2](README.md))。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— OQ-S2-2 拍板 + 資料清點,docs-only。
