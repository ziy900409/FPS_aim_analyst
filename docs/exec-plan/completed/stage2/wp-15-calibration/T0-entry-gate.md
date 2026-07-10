# T0 — Entry gate(容差拍板 + 參考資料備妥檢查)

> Part of [WP-15 calibration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | WP-13 exit ✅(M6)、WP-14 exit ✅(逐項驗證) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [../README.md §8](../../../completed/stage2/README.md)(OQ 回填) |
| **狀態** | ✅ surrogate PASS(2026-07-07):OQ-S2-2 已拍板;速度曲線採 theory-derived fixture;AK pattern 候選資料已入 repo |

## Objective

校準的 DoD 能否客觀判定,取決於兩件事先就位:容差數字(OQ-S2-2)與參考資料實體在手。
**資料不在手 = blocker(STOP)**,不得以「先寫測試骨架」繞過。

## In scope
- 上游驗證:wp-13 / wp-14 的 `task-checklist.md` 全 ✅ 與 exit 證據連結記 progress。
- **OQ-S2-2 拍板**(與研究者):`cl_showpos` 逐 tick 容差(預設 ±1 u/s)、pattern 逐彈
  容差(預設 ±0.05°);記 ledger + 回填 [../README.md §8](../../../completed/stage2/README.md)。
- **參考資料備妥檢查**(STOP 條件,逐項驗收入 progress):
  - CS2 `cl_showpos` 錄製檔:起步 + 急停各 ≥ 1 段,tick 連續無缺漏,附錄製條件(tickrate、來源)。
  - 社群 AK pattern 圖:附來源連結,且**可標定**(已知參考尺度可換算角度)。

## Out of scope
- fixture 數位化與測試實作(T1/T2);資料不合格時的重錄製(研究者側工作,本 WP 等待)。

## Steps

- [x] 上游兩 WP exit 證據記 progress。
- [x] OQ-S2-2 拍板(明確數字,非「傾向」);ledger + §8 回填。
- [x] 資料清點:兩類參考資料逐項核對合格條件;檔案路徑 / 來源 URL 記 progress。
- [x] 任一不備 → **STOP**:記 blocker + 通知研究者,不開 T1/T2。
- [x] progress.md 記 entry-gate PASS 宣告。

## T0 Amendment(2026-07-07)

研究者確認目前沒有設備錄製高幀率 `cl_showpos` 影片,並指示以本輪調查得到的 Source movement 公式 + CS2 預設常數產生速度曲線資料。T0 因此由 STOP 改為 **surrogate PASS**:

- [tests/golden/calibration/clshowpos-accel.json](../../../../../tests/golden/calibration/clshowpos-accel.json):已補 theory-derived 起步曲線(primary `knife_250`,alternate `ak47_215`)。
- [tests/golden/calibration/clshowpos-stop.json](../../../../../tests/golden/calibration/clshowpos-stop.json):已補 theory-derived counter-strafe 急停曲線(primary `knife_250`,alternate `ak47_215`)。
- [tests/golden/calibration/ak47-pattern.json](../../../../../tests/golden/calibration/ak47-pattern.json):已補 Aiming.Pro AK pattern 候選 fixture。

此 PASS 只解除 T1/T2 工程 blocker;它不是 `cl_showpos` 行為級外部真值。M7/T-exit 必須保留 caveat:速度曲線目前驗證的是公式/常數對表,不是實錄逐 tick 對表。

## T0 Result(2026-07-07)

**Historical STOP superseded by T0 Amendment above.** 容差已拍板為 `cl_showpos` 速度逐 tick **±1 u/s**、AK pattern 逐彈角度 **±0.05°**。AK pattern 候選資料已於 2026-07-07 補入,但當時 `cl_showpos` 校準參考資料仍未備妥:

- `tests/golden/calibration/clshowpos-accel.json`:缺。
- `tests/golden/calibration/clshowpos-stop.json`:缺。
- `tests/golden/calibration/ak47-pattern.json`:已補候選 fixture(Aiming.Pro drill creator;直接角度值,非像素數位化)。

此 STOP 已由研究者批准的 theory-derived 速度 fixture 取代;T1/T2 可開工,但須標示實錄 caveat。

## Definition of Done

- OQ-S2-2 ✅(數字入 ledger);資料清點兩項皆合格且路徑可開;上游證據齊;
  `git diff --stat` 不含 `src/`。

## Commit

`docs(wp-15): T0 entry gate — OQ-S2-2 容差拍板 + 校準參考資料備妥檢查`
