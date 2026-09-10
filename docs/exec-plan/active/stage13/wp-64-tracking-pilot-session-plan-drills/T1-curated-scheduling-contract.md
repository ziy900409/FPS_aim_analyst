# T1 — Curated scheduling contract

> Parent：[README.md](README.md) · 前置：[T0](T0-entry-gate.md)

| | |
|---|---|
| **Objective** | 以單一 curated registry 表達核准 config，讓 schedulable family、固定武器與 history 排除成為可測的同一契約。 |
| **Dependencies** | T0；WP-62 的 declared-weapon/compiler contract 已合併。 |
| **Risk** | Med：registry drift 會讓 UI 可選但 runtime 或 weapon guard 不一致。 |
| **Estimate** | 1–1.5 dev-days。 |
| **Commit** | `feat(wp-64): register curated tracking pilot session drills` |

## Planned files

- `src/session/trackingPilotSchedulableDrills.ts`（new）
- `src/session/trackingPilotSchedulableDrills.test.ts`（new）
- `src/session/drillFamily.ts` / `src/session/drillFamily.test.ts`
- `src/session/sessionProgram.test.ts`
- `src/pilot/trackingPilotHistoryExclusion.test.ts`
- 若 core cell 缺乏可穩定引用的 exported symbol：只做 named export/typed builder reference；不得改 config 值。

## Steps

1. 編輯任何既有 symbol 前，對 T0 鎖定的 symbols 執行 CodeGraph impact，將 affected files/symbols 與 local/cross-module 判斷回填 `progress.md`。
2. 先寫紅測試：curated 長度 1–2、id 唯一、全部屬九個 Pilot config、family=`tracking`、scene=`field-low`、mode=`practice`、weapon=`tracking_pilot_hold`；未選中的 complement 不得出現在 schedulable ids。
3. 建立 `ResearchSchedulableDrill` 與 `TRACKING_PILOT_SCHEDULABLE_DRILLS`。core 條件使用 exported typed builder/具名 constant；禁止手寫 drill id 或依賴候選陣列位置。
4. `FAMILY_ROSTER['tracking']` 從 curated configs 推導 ids；`DECLARED_WEAPON_ROSTER` 從同一 configs 推導 weapon，不另列字串。
5. 加對抗性測試：重複 id、未知 weapon、未排程 weapon declaration 仍 fail fast；所選 id 指定不同 weapon 編譯失敗，相同 `tracking_pilot_hold` 成功。
6. 編譯含 selected pilot reps、同 family sibling 與另一 family 的 program；斷言 `rep`／`drill`／`family` boundary 和 rest 秒數精確。
7. 擴充 history exclusion：選中集合與全部九個集合都仍 `mode:'practice'`、exact-id 未註冊，避免「schedulable ⇒ assessment」錯誤推論。
8. 進行 mutation checks：移除 family spread、移除 weapon spread、把整個九項集合 spread 進 roster，各自必須至少一個具名測試轉紅；立即還原。
9. 執行 focused/full verification，更新 graphify 與 progress。

## Definition of Done

- [ ] `TRACKING_PILOT_SCHEDULABLE_DRILLS` 是 family/weapon policy 的唯一 Pilot selection source，沒有第二份手寫 id list。
- [ ] `npx vitest run src/session/trackingPilotSchedulableDrills.test.ts src/session/drillFamily.test.ts src/session/sessionProgram.test.ts src/pilot/trackingPilotHistoryExclusion.test.ts` exit 0。
- [ ] 測試證明 `selectedIds` 精確為 1–2，且 `allPilotIds - selectedIds` 全不在 `FAMILY_BY_DRILL_ID`。
- [ ] weapon mismatch 以 `SessionProgramCompileError.field === 'weaponId'` 且正確 `itemIndex` 失敗；相同值通過。
- [ ] reps 和兩種 rest boundary 有 exact expected steps，不使用 snapshot 模糊比對。
- [ ] 全量 `npx vitest run`、`npx tsc --noEmit`、`npx tsc --noEmit -p tsconfig.node.json`、`npm run build` 全部 exit 0，數字入 `progress.md`。
- [ ] 三道 mutation 均被測試抓住；結果入 `progress.md`。
- [ ] `graphify update .` 完成；CodeGraph pending 檔案於後續讀取時直接讀檔。

## Guardrails

- 不 import `trackingPilotManifest.ts` 或 `TrackingPilotRunner.ts`。
- 不改任何 Pilot config 欄位、trajectory generator、weapon config 或 history registrations。
- frozen `resolveFamilyDrillId('tracking')` 必須仍回 `tracking_scene_v1`。
