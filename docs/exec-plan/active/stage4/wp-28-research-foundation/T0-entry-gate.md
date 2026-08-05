# T0 — entry gate(決策落地 + 硬約束回寫 + 樣本狀態;無演算法碼)

> Part of [WP-28 research-foundation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | — (stage4 採納 = GD-19/GD-20 已入帳) |
| **Risk / Cplx** | Low / Low |
| **Touches** | MODIFY [CLAUDE.md](../../../../../CLAUDE.md) §4(C-D1~C-D4);ADD `research/pyproject.toml` 最小骨架(可 `pytest` 空跑) |
| **狀態** | ✅ 2026-08-04 |

## Objective

把 stage4 的三項工具鏈/CI/fixture 決策與四條新硬約束**落成 repo 內的可稽核狀態**,並記錄真實匯出樣本的取得狀態(未到位 → 明列 M14 阻塞項與替代路徑),讓 T1 之後的每個切片都有不可漂移的前提。

## In scope

- **上游複驗**:M4 ✅ / WP-16 ✅ / M11 ✅ / M12 ✅ 的 exit-gate 引用記 progress(不重跑,只引用)。確認 [schema.md](../../../../operational/schema.md) 的 v2 欄位面(tick `aim`/`keys`/`ads`;events `visible`/`counter`/`ads`/`fire`/`hit`;`meta.targets.hitbox`/`meta.weapon.ads|bullet`)為 ingest 對表基準。
- **決策落地**(使用者已於 2026-08-04 確認,本 task 只記證據):
  - OQ-S4-1:Python 3.12 + uv + pyproject(環境:Python 3.12.10 / uv 0.9.18)。
  - OQ-S4-7:Python 閘 **不進** `npm run test:ci`;改 `uv run pytest` 獨立閘 + 雙向 parity/golden fixture 進 `test:ci`。
  - OQ-S4-8:真實匯出 fixture ≤ 30s(≈3840 ticks)+ `participantId` 匿名化,存 `research/fixtures/exports/`。
- **CLAUDE.md §4 追加四條**(逐字對齊 [../README.md §1.3](../README.md)):
  - **C-D1** `research/` ↔ `src/` 單向隔離(research 不得 import TS 模組;`src/` 只可讀 committed parity/golden JSON)。
  - **C-D2** `algorithms/` 純函式紀律(禁 matplotlib/print/file I/O)。
  - **C-D3** 教練報告紅線(未過 reliability gate 的指標不得進教練報告;GD-20)。
  - **C-D4** 既有構念不得有第二定義(ε(t)/on-target/t_acquire/t_detect/peek 窗界以 `docs/operational/analysis-*.md` + `src/metrics/` 為權威)。
- **`research/pyproject.toml` 最小骨架**:name/requires-python/dependencies(numpy/pandas/scipy)+ dev(pytest)+ pytest 設定;**可 `uv run pytest` 空跑綠**(零測試亦視為綠,證明工具鏈可用)。
- **樣本狀態記錄**:真實匯出樣本未取得 → progress 記 `OQ-S4-8(樣本)` 為 🟡 + M14 ①④ 阻塞項 + 「T1 合成匯出產生器為開發解鎖器,不替代真實資料項」。

## Out of scope

- 任何 ingest / kinematics / 分段演算法碼(T1 起)。
- `research/` 完整目錄樹與 README(T1)。
- CONTEXT.md 術語(隨各 task 切片回寫)。

## Steps

- [x] 複驗並記錄上游 exit-gate 引用(M4/WP-16/M11/M12)+ schema v2 欄位對表基準。
- [x] CLAUDE.md §4 追加 C-D1~C-D4(四條,措辭與 stage4 §1.3 一致)。
- [x] 建 `research/pyproject.toml` 最小骨架;`uv run pytest` 空跑。
- [x] progress.md 記:三項決策證據、樣本狀態 + M14 阻塞項、上游引用。
- [x] 對帳 [../README.md §9](../README.md) 的 CLAUDE.md 項打勾。

## Definition of Done

- CLAUDE.md §4 含 C-D1~C-D4 四條,且與 stage4 §1.3 逐條對齊(措辭可稽核)。
- `uv run pytest` 於 `research/` 退出碼 0(輸出貼 progress)。
- progress.md 含:三項決策(OQ-S4-1/7/8)證據行、樣本狀態 🟡 + M14 ①④ 阻塞項明文、上游 exit-gate 引用。
- **未動任何 `src/` 引擎碼**(`git diff --stat` 證據:僅 CLAUDE.md + research/pyproject.toml + 本 WP 文件)。

✅ 2026-08-04:全部達成;驗證與差異證據見 [progress.md](progress.md)。

## Commit

`docs(wp-28): T0 entry gate — research 層決策落地(Python/uv、CI 落點、fixture 政策)+ CLAUDE.md §4 C-D1~C-D4`
