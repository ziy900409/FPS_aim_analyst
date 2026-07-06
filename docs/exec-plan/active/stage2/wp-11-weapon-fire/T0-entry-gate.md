# T0 — Entry gate(上游驗證 + 影響面盤點)

> Part of [WP-11 weapon-fire](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | WP-10 T1–T3(recoil/inaccuracy 型別已存在) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs |
| **狀態** | ✅ |

## Objective

驗證 WP-10 已提供 `WeaponConfig` 需要的型別形狀,盤點 fire 事件契約變更的影響面
(哪些既有測試/消費端會被 down 欄位波及),把清單記入 progress 供 T2 逐一處理。

## In scope
- 驗證 WP-10 checklist:T1–T3 ✅(`src/recoil/` 存在 `Rng`/`WeaponRecoilParams` 形狀可 import)。
- 影響面盤點(記入 progress):`codegraph_impact` 對 `pushFire`、`applyInput`、
  `InputEvent`;列出引用 `type:'fire'` 的測試檔(預期:`InputSampler.test.ts`、
  `consume.test.ts`、`SimLoop.test.ts`、`firstShot.test.ts`、`InputRing.test.ts`)。
- 確認 OQ-S2-6 已於 wp-10 T0 拍板(彈匣盡即停火);引用決議至本 WP ledger。

## Out of scope
- 任何 `src/` 變更;OQ-11.1(單擊邊界)的實作決策——T3 設計段落處理。

## Steps

- [x] `wp-10/task-checklist.md` T1–T3 = ✅;`src/recoil/` 模組可 import(tsc 快查)。
- [x] `codegraph_impact` 三個符號;整理受影響檔案清單 + 每檔一句「怎麼改」進 progress。
- [x] 確認 `EV_FIRE` 的 `b` 欄目前恆 0(`pushFire: (t) => enqueue(EV_FIRE, t, 0, 0)`,
      [SharedState.ts:108](../../../../../src/state/SharedState.ts))——變更為 down 不影響既有解碼。
- [x] OQ-S2-6 決議轉錄至本 WP ledger(含 wp-10 progress 連結)。
- [x] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- progress 含:上游 ✅ 證據、影響面清單(檔案 × 改法)、OQ-S2-6 轉錄。
- 全部為 docs 變更:`git diff --stat` 不含 `src/`。

## Commit

`docs(wp-11): T0 entry gate — WP-10 上游綠燈 + fire 事件契約影響面盤點`
