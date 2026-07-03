# T1 — Schema v2:fire/meta 擴欄 + arena 容量重估

> Part of [WP-16 metrics-export-v2](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(語意決議完成) |
| **Risk / Cplx** | Med / Med |
| **Touches** | MODIFY `src/data/DataRecorder.ts`、`src/data/metadata.ts`、`src/data/export.ts`、`src/drill/schema.ts`、`docs/operational/schema.md` + 對應測試 |
| **狀態** | ⬜ |

## Objective

匯出升 v2(FR-B14):fire 事件八個新欄 + meta 五欄 + `schemaVersion` bump;
arena 容量以 fire 事件率上限重估——壓槍狀態在資料面完整外顯。

## In scope
- fire 事件擴欄:`viewYaw/viewPitch/aimPunchPitch/aimPunchYaw/spreadX/spreadY/recoilIndex/ammo`
  (preallocated arena 加欄 = 加平行欄位,維持固定欄位 / 物件重用 / 不 push 物件紀律)。
- meta:`weaponId/weaponSeed/rngSeed/sensitivityModel/schemaVersion`
  (`sensitivityModel` 已存在,收斂進 v2 區塊;`rngSeed` = OQ-13.1 spread seed)。
- `DrillConfig.weaponId?` 選填欄(`validateDrill` 更新;未給 = 預設武器)。
- `capacityForDrill` 重估:fire 率上限 = `magSize / cycletime`;公式記 schema.md。
- `docs/operational/schema.md` v2 全欄對帳(單位/符號慣例 + `targetCenterOffsetDeg` 語意補寫,T0 決議)。

## Out of scope
- 指標計算(T2)、呈現(T3);殘速連續欄與 WP-14 T3 的對帳(欄位歸本 task 一次加齊,
  對帳紀錄雙方 progress 互記)。

## Steps

- [ ] arena 平行欄位擴欄 + fire 記錄簽名更新(呼叫端 = fireOneShot 單點)。
- [ ] meta 五欄 + `schemaVersion` bump;drill schema `weaponId?` + validate 測試。
- [ ] `capacityForDrill` 重估 + **滿載溢位測試**(構造 fire 率上限 drill → 無 `recorderOverflow`)。
- [ ] 統計=匯出不變式測試擴 v2 欄後維持綠(既有 assert 機制)。
- [ ] schema.md 對帳(欄位表 + 單位/符號 + 容量公式)。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- v2 匯出含全部新欄且與 schema.md 一致(assert 綠);滿載溢位測試綠;不變式綠;
  `schemaVersion` 新值出現於匯出、舊值不再出現。

## Commit

`feat(wp-16): T1 匯出 schema v2(fire/meta 擴欄 + schemaVersion + arena 容量重估)`
