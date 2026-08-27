# metrix_design — 指標設計文件(移植自 `performance_analysis`)

> **來源**:`performance_analysis` repo(另一個獨立專案,`../../../performance_analysis` 相對本機路徑)的
> `docs/algorithm/metrix_design/`,**靜態複製**於 **2026-08-27**。內容是該專案的指標設計 guide(Q1–Q4
> 四象限框架、每個指標的目的/公式/notebook 用法),不是本專案的 source of truth——本專案的權威定義一律是
> [`docs/operational/analysis-*.md`](../operational/) + `src/metrics/`/`research/src/modules/metrics/`(CLAUDE.md C-D4)。
> **不會隨來源 repo 更新自動同步**;若來源文件之後修改,這裡的副本會過期,需要時手動重新複製。
> 內部連結(如 `[ADR-0001](../../adr/0001-...)`)指向來源 repo 的相對路徑,在本 repo **不保證可解析**——保留原樣以維持與來源逐字一致,不重寫連結。

## 為什麼複製進本專案

`docs/exec-plan/completed/stage4/`(WP-28~32,選手表現分析管線)移植了 `performance_analysis` 的多個指標演算法到本專案的 `research/` Python 層,並晉升三項(`phase-v1`/`sync-v1`/`curve-v1`)進 `src/metrics/` TS 生產代碼(見 [`docs/operational/analysis-advanced-diagnostics.md`](../operational/analysis-advanced-diagnostics.md)「逐位移植,零在地改良」)。這批文件是那些演算法在來源專案的**原始設計脈絡**(目的/公式推導/notebook 操作方式),供之後理解「為什麼演算法長這樣」或評估「還有哪些未移植的指標可以參考」時查閱,不需要每次都切換去另一個 repo 翻找。

## 文件索引與本專案對應關係

| 文件 | 指標 | 移植狀態(本專案) | 對應文件 |
|---|---|---|---|
| [fps-quadrant-metrics-roadmap-2026-05-20.md](fps-quadrant-metrics-roadmap-2026-05-20.md) | Q1–Q4 六指標框架總覽(roadmap,非單一指標) | 框架性參考,非逐一移植 | [analysis-segments.md](../operational/analysis-segments.md)、[analysis-advanced-diagnostics.md](../operational/analysis-advanced-diagnostics.md) |
| [per-segment-sparc-tracking-guide-2026-05-21.md](per-segment-sparc-tracking-guide-2026-05-21.md) | SPARC(Q2,平滑度) | ✅ 已移植(WP-31 T1,`sparc.py` 逐位對應 `metrics_sparc.py`) | [analysis-advanced-diagnostics.md §SPARC](../operational/analysis-advanced-diagnostics.md) |
| [key-velocity-coupling-guide-2026-05-22.md](key-velocity-coupling-guide-2026-05-22.md) | Key-Velocity Coupling(Q4,lagged xcorr) | ✅ 已移植(WP-31 T2,逐位沿用 `_xcorr_peak`) | [analysis-advanced-diagnostics.md §Key-Velocity xcorr](../operational/analysis-advanced-diagnostics.md) |
| [release-to-click-sync-guide-2026-05-22.md](release-to-click-sync-guide-2026-05-22.md) | Release-to-Click Sync(Q3) | ✅ 已移植並晉升(`sync-v1`,WP-29 T2,晉升進 `src/metrics/` 見 WP-32) | [analysis-peek-timeline.md](../operational/analysis-peek-timeline.md) |
| [primary-submovement-ratio-guide-2026-05-20.md](primary-submovement-ratio-guide-2026-05-20.md) | Primary Sub-movement Ratio(Q1) | 相關概念已移植(WP-28 T3 submovement 分段 `seg-v2`/`sg-seg-v2`,primary_flick/micro_adjustment 分類);本指標本身(比例計算)未確認逐位移植 | [analysis-segments.md](../operational/analysis-segments.md) |
| [velocity-scaling-consistency-guide-2026-05-21.md](velocity-scaling-consistency-guide-2026-05-21.md) | Velocity Scaling Consistency(Q1,Fitts-style) | 相關(WP-31 T3 Fitts 判定「blocked-by-data」/「ok」,未逐位移植本指標) | [analysis-advanced-diagnostics.md §Fitts](../operational/analysis-advanced-diagnostics.md) |
| [per-segment-ldj-v-guide-2026-05-21.md](per-segment-ldj-v-guide-2026-05-21.md) | Per-segment LDJ-V(Q1,平滑度) | ⬜ 尚未移植 | [analysis-segments.md](../operational/analysis-segments.md)(背景參考) |
| [kovaak-keyboardtrace-overlap-metric-2026-05-20.md](kovaak-keyboardtrace-overlap-metric-2026-05-20.md) | KeyboardTrace Overlap(資料閘門,非玩家評分指標) | ⬜ 未移植(本專案的資料閘門走 quality flags,見 [analysis-segments.md](../operational/analysis-segments.md) 詞彙表) | — |

## 使用時的注意事項

- **單位/取樣率不同**:來源專案是 px/s、多時鐘域對齊(QPC 滑鼠/wallclock 鍵盤/KovaaK event TOD);本專案是 deg/s(yaw 需乘 `cos(pitch)`)、單一 `performance.now()` 時鐘 + 固定 128Hz tick。套用這些文件的公式前,先確認單位換算(不要直接搬 threshold 常數)。
- **這些文件裡引用的程式路徑(`research/src/modules/...`)指向來源 repo**,不是本專案的 `research/`——本專案禁止 `research/` import 來源 repo 的任何模組(C-D1,見 [analysis-advanced-diagnostics.md](../operational/analysis-advanced-diagnostics.md) 的 purity 測試段落)。
- 若之後要移植這裡標示「⬜ 尚未移植」的指標,走既有流程:先讀本檔對應設計文件 → 依 C-D5 雙實作對表紀律在 `research/` 落地 → golden fixture 對表 → 視情況晉升進 `src/metrics/`。
