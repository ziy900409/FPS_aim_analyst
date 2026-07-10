# T0 — Entry gate(GD-7/8 收斂驗證 + spawnArea 決議 + 硬約束回寫)

> Part of [WP-21 detection-drill](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | —(T1/T2 可先行;T3 的 WP-16 相依在 task 級把關) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [CLAUDE.md](../../../../../CLAUDE.md) §4 + [../README.md §8](../README.md)(OQ 回填) |
| **狀態** | ✅（2026-07-09 T0 PASS） |

## Objective

動 `TargetManager` 之前先鎖:現行 spawn/`t_visible`/交替機制的行為基線(零破壞
不變式的參照)、`spawnArea` 幾何範圍、seeded 取樣次序、與 WP-19 淨空驗證的對帳。

## In scope
- **現況基線**:`TargetManager` spawn/`markKilled`/`reset` 與 `sequence.seed`「保留未讀」
  現況、`t_visible` 蓋戳語意(spawn tick)讀碼證據記 progress;既有決定性回歸測試
  清單(T1 的零破壞閘)列出。
- **OQ-21.1**:`spawnArea` 預設範圍定稿(yawDegRange/distanceURange 與佔位房間尺寸、
  `field-low` 走廊的相容值),記 ledger。
- **OQ-21.2**:取樣次序(delay → yaw → distance)+ spawn 事件位置欄落點定稿。
- **OQ-S3-2**:t_detect 參數起點(θ_v = 3×前刺激窗 SD、k = 4 tick)確認或修訂,
  記 ledger(spec 內標「暫定」)。
- **WP-19 對帳**:淨空驗證的目標包絡是否已涵蓋 `spawnArea` 極值(WP-19 T3 的包絡
  推導含 spawnArea → 互記 progress;未含 → 記為 WP-19 T3 的待辦)。
- **CLAUDE.md §4 回寫**:「spawn 隨機化一律 seeded(`sequence.seed` → `createRan1`),
  seed 進匯出 meta」。

## Out of scope
- 任何 `src/` 變更;schema 擴欄(T1)。

## Steps

- [x] `npm run test` 乾淨基準 exit 0 記 progress。
- [x] TargetManager/seed 現況證據 + 既有決定性測試清單記 progress。
- [x] OQ-21.1 / OQ-21.2 / OQ-S3-2 決議記 ledger + §8 回填。
- [x] WP-19 淨空包絡對帳(互記 progress)。
- [x] CLAUDE.md §4 追加一條硬約束(與本 task 同 commit)。
- [x] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- progress 含:現況基線、三條 OQ 決議(明確數值,非「傾向」)、WP-19 對帳結論;
  CLAUDE.md §4 含新約束;`git diff --stat` 不含 `src/`。

## Commit

`docs(wp-21): T0 entry gate — GD-7/8 收斂 + spawnArea/取樣次序決議 + 硬約束回寫`
