# WP-10 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 進行中(T0 ✅,T1 ✅,下一步 T2)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 ran1 + 彈道表 | ✅ |
| T2 punch 動力學 | ⬜ |
| T3 spread/inaccuracy | ⬜ |
| T4 2D 檢查頁 | ⬜ |
| T-exit(M5) | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-1 recoil tick 節奏(建議:64Hz 子節奏,偶數 sim tick) | ✅ resolved | 2026-07-05,Codex 依 T0 計畫預設拍板:recoil tick = 64Hz 子節奏,在 128Hz sim 內以偶數 tick 呼叫 `recoilTick(state, 1/64)`;golden 與 WP-13 接線皆以此為準。 |
| OQ-S2-6 彈匣盡行為(建議:停火、無 reload) | ✅ resolved | 2026-07-05,Codex 依 T0 計畫預設拍板:彈匣盡即停火,stage2 不做 reload;drill 一 peek ≤ 一匣。 |

---

## Decision Log

### 2026-07-05 — T1 ran1 + recoil table decisions
- **Decision**:新增 `src/recoil/` 純 TS 模組,以 Numerical Recipes ran1 常數組(IA/IM/IQ/IR/NTAB/NDIV/EPS/RNMX)實作 `createRan1`,並在 `generateRecoilTable` 內以 seed 223 生成 AK-47 64 筆表;full-auto 相鄰彈使用 0.55 Lerp 平滑,前 4 發套用 0.75→1.0 抑制係數。
- **Alternatives Considered**:未引入外部 RNG 套件,避免增加 runtime dependency;未把 golden 放進 `src/`,維持 `tests/golden/recoil/` 作為跨 T1/T2/T4 的測試資料位置。
- **Evidence**:`.\node_modules\.bin\vitest.cmd run src/recoil` → 2 files / 11 tests passed;`npm.cmd run typecheck` → pass;`rg "Math\.random" src/recoil` → no matches(exit 1)。

### 2026-07-05 — T0 entry gate decisions
- **Decision**:採納 stage2 範圍與 GD-5 六項跨 WP 契約:64Hz recoil 子節奏、彈匣盡停火、CS2 0.022°/count 感度語意、WP-14 baseline 預期重錄、sim/recoil 禁 `Math.random()`、`MovementProfile` 留接口但 Valorant 不進 stage2。
- **Alternatives Considered**:OQ-S2-1 的 `dt=1/128` 代入與 `SIM_HZ` 降 64 皆未採用;前者缺 golden 對照基準,後者會破壞 ADR-3 既有 128Hz sim。OQ-S2-6 的 reload 流程未採用,避免 WP-11 範圍蔓延。
- **Evidence**:`git log --oneline -n 20` 可見 `ddbb599 docs(wp-9): exit gate — 宣告 M4 階段 A交付 + 附錄 E 全綠`;[stage2 README](../README.md) §8 已回填 OQ 狀態;[DECISIONS.md](../../../../DECISIONS.md) 已新增 GD-5。

## Surprises & Discoveries

### 2026-07-05 — T1 PowerShell npx shim blocked by execution policy
- **Evidence**:`npx vitest run src/recoil` failed with `npx.ps1 cannot be loaded because running scripts is disabled on this system`。
- **Action**:改用 `.\node_modules\.bin\vitest.cmd run src/recoil`;首次 sandbox 內載入 Vite config 遇到 `Cannot read directory "../../../..": Access is denied`,改以核准後的 escalated test command 執行。

### 2026-07-05 — T0 relative paths pointed at non-existent files
- **Evidence**:`Get-Content docs/exec-plan/active/DECISIONS.md` failed with "Cannot find path";專案導航與 stage2 README 指向的權威帳本是 [docs/exec-plan/DECISIONS.md](../../../../DECISIONS.md)。
- **Action**:修正 [T0-entry-gate.md](T0-entry-gate.md) 中 DECISIONS / exec-plan README 的相對路徑,並將實際對帳寫入正確檔案。

## Open Questions

- 無 T0 阻塞項。T1 可開始 `createRan1` + `generateRecoilTable` + golden(seed 223)。

---

## Log

### 2026-07-05 — T1 ran1 + recoil table completed
- 新增 [rng.ts](../../../../../src/recoil/rng.ts):`createRan1(seed)` 與 `randomFloat`,禁用 `Math.random()`。
- 新增 [recoilTable.ts](../../../../../src/recoil/recoilTable.ts):`generateRecoilTable(p)` 恆 64 筆,含相鄰彈 0.55 Lerp 平滑與前 4 發抑制。
- 新增 [ak47-table.json](../../../../../tests/golden/recoil/ak47-table.json):seed 223 / magnitude 30 / variance 0 / angleVariance 70 的 64 筆 fixture;測試逐位鎖前 8 筆。
- T4 前置數值 sanity:以前 9 筆累積 `x += sin(angle)*mag`, `y += cos(angle)*mag`,y 單調上升到 235.33,符合「前段直升」的前置檢查。
- 驗證:`.\node_modules\.bin\vitest.cmd run src/recoil` → 2 files / 11 tests passed;`npm.cmd run typecheck` → pass;`rg "Math\.random" src/recoil` → no matches(exit 1)。

### 2026-07-05 — T0 entry gate completed
- 上游 M4 已驗證:`git log --oneline -n 20` 包含 `ddbb599` exit-gate commit;[exec-plan README](../../../../README.md) §3 M4 仍為 ✅。
- 已拍板 OQ-S2-1/OQ-S2-6,回填 [stage2 README](../README.md) §8 與本檔 ledger。
- 已新增 [GD-5](../../../../DECISIONS.md),補 [CLAUDE.md](../../../../../CLAUDE.md) §4 兩條硬約束,並在 [exec-plan README](../../../../README.md) §2/§3 補 stage2/M5–M8。
- 已勾選 [task-checklist.md](task-checklist.md) T0;本 slice 為 docs-only,不含 `src/` 變更。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md))展開為自足 task 檔(T0–T4 + T-exit)。
- 演算法權威來源 = [研究計畫](../CS2%20壓槍軌跡復刻研究計畫.md) Phase 1;golden 測試向量 = Phase 4(seed 223、10 發 punch −10.18°/−1.56°、前 4 發抑制係數)。
- **Next at authoring time**:T0([T0-entry-gate.md](T0-entry-gate.md))— 決策拍板 + GD-5 對帳,docs-only commit。
