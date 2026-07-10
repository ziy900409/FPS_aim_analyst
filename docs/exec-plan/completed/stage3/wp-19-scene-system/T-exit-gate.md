# T-exit — Exit gate(M9:場景脊椎宣告)

> Part of [WP-19 scene-system](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T5 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引) |
| **狀態** | ✅（M9 達成 2026-07-08） |

## Objective

宣告 M9:場景系統的兩個承諾——「換場景零引擎碼」與「場景不碰決定性」——有測試級
證據;WP-22 整合自此有穩定的場景面可消費。

## Steps

- [x] `npm run test:ci` exit 0。→ `tsc --noEmit` pass + Vitest **48 files / 356 tests** + Playwright(Edge)**10 tests** 全綠(2026-07-08)。
- [x] **M9 四項證據**逐項記 progress(見 progress.md 2026-07-08 T-exit Outcomes):
  - 置換:`src/scene/scenes/field-low.test.ts`(3) + `urban-high.test.ts`(5) 綠;T4/T5 headless smoke 兩場景真 GLTF 200 + UI gating + drill 可跑。
  - 拒載:`src/drill/DrillLoader.test.ts` › `scene clearance 違規時拒載,錯誤訊息指名 prop id` 綠(對抗性 `blocking-crate`);縱深 `waypoints 元素非 Vec3 → 於 schema 層拒載` 綠。
  - 決定性:`tests/regression/determinism.test.ts` › `WP-19 T4 — 場景純裝飾…` › `placeholder-room / field-low / urban-high 使用同輸入序列時完整 sim 輸出一致` 綠。
  - 稽核:`ATTRIBUTIONS.md` 逐項 ↔ `public/assets/scenes/{field-low,urban-high}` 一一對應(2 資產,皆原創 CC0);repo 無非白名單授權檔。
- [x] 架構閘複查:`src/scene/architecture.test.ts` › `src/sim 與 src/state 不得 import src/scene` 綠(1 test)。
- [x] OQ ledger 收斂:OQ-S3-3 已 ✅ 於 [../README.md §8](../README.md);OQ-19.1 / OQ-19.2 已 ✅ 於 [progress.md](progress.md) OQ ledger;§8 補收斂註記。
- [x] [../README.md §3](../README.md) WP-19 翻 ✅(M9 2026-07-08);[task-checklist.md](task-checklist.md) 全 ✅;
  [exec-plan/README.md](../../../README.md) §2 stage3 表 + §3 M9 同步。
- [x] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` exit 0;M9 四項證據可追;**WP-22 T1 可直接消費場景面**(SceneConfig/
  切換/淨空驗證/meta 全就緒)。

## Commit

`docs(wp-19): exit gate — M9 場景脊椎(置換/拒載/決定性/稽核四證據)`
