# T-exit — Exit gate(M9:場景脊椎宣告)

> Part of [WP-19 scene-system](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T5 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引) |
| **狀態** | ⬜ |

## Objective

宣告 M9:場景系統的兩個承諾——「換場景零引擎碼」與「場景不碰決定性」——有測試級
證據;WP-22 整合自此有穩定的場景面可消費。

## Steps

- [ ] `npm run test:ci` exit 0。
- [ ] **M9 四項證據**逐項記 progress:
  - 置換:兩場景(field-low / urban-high)實機切換 + drill 可跑。
  - 拒載:構造違規 drill → 淨空驗證拒載且指名 prop(對抗性測試名 + 結果)。
  - 決定性:跨場景 sim 狀態逐位一致測試綠(測試名 + 結果)。
  - 稽核:ATTRIBUTIONS.md ↔ 資產目錄一一對應;repo 無非白名單授權檔。
- [ ] 架構閘複查:`src/sim`/`src/state` 零 `src/scene` import(測試名)。
- [ ] OQ ledger 收斂:OQ-S3-3 / OQ-19.1 / OQ-19.2 決議回填 [../README.md §8](../README.md)。
- [ ] [../README.md §3](../README.md) WP-19 翻 ✅(M9 日期);[task-checklist.md](task-checklist.md) 全 ✅;
  [exec-plan/README.md](../../../README.md) §2 stage3 表同步。
- [ ] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` exit 0;M9 四項證據可追;**WP-22 T1 可直接消費場景面**(SceneConfig/
  切換/淨空驗證/meta 全就緒)。

## Commit

`docs(wp-19): exit gate — M9 場景脊椎(置換/拒載/決定性/稽核四證據)`
