# T2 — Runtime 與 Session Plan wiring

> Parent：[README.md](README.md) · 前置：[T1](T1-curated-scheduling-contract.md)

| | |
|---|---|
| **Objective** | 讓已可編譯的 selected Pilot drills 能由真實 `loadDrillById()` 載入，並在 custom picker/preview/export 中保持可辨識且不洩漏正式 Pilot 語意。 |
| **Dependencies** | T1；WP-62 的 runtime/UI 熱區已穩定。 |
| **Risk** | Med：`availableDrills` 同時餵 runtime 與 Controls，錯誤投影會擴大 UI surface。 |
| **Estimate** | 1.5 dev-days。 |
| **Commit** | `feat(wp-64): wire pilot drills into session plans` |

## Planned files

- `src/main.ts`
- `src/ui/SessionPlanSetup.ts`（只在 surface/copy/a11y 確有必要時）
- `src/ui/SessionPlanSetup.test.ts`
- `src/session/sessionProgramExport.test.ts`
- 可能新增低耦合 registry projection test；不為 top-level `main.ts` 建第二套 runtime。

> ⚠️ **Step 3 / 4 已於 T1 落地（D-64-T1-1）**：`main.ts` 的 runtime entry 與 `showInResearcherControls`
> filter 被 `drillFamily.test.ts` 的 roster coherence invariant 拉進 T1，否則 T1 無法讓全量 Vitest
> 轉綠。理由與取捨見 [progress.md](progress.md) T1 §2。**T2 不要重做這兩步**，改為補上它們缺的
> 行為測試（OQ-64.5）。

## Steps

1. 對 `AvailableDrill`、`availableDrills`、`loadDrillById`、Controls 建構、`sessionPlanAuditFields` 執行 CodeGraph impact，先記 blast radius。
2. 先寫 source/contract 紅測試：每個 curated item 必須有 runtime entry，entry `source === config`、`sceneId === 'field-low'`；未選中 Pilot id 不得出現。**T1 只做到 source-scan 級別**（roster 由 registry spread、九個 id 皆非手寫）；本步要把它升級成真正測得到 resolve 行為的 seam。
3. ~~從 curated registry 映射 `availableDrills` entries~~ ✅ **T1 已落地**。本步只需覆核：未經 `resolveTrackingPilotBlockConfig()`、未 clone/mutate config、weapon override 仍走 SessionRunner/WP-62 既有鏈路。
4. ~~依 OQ-64.2 實作 `showInResearcherControls:false` + Controls projection 過濾~~ ✅ **T1 已落地**。本步只需補**雙側測試**：Controls projection 不含 selected ids、`loadDrillById()` 仍能 resolve 它們；並確認既有 entries 缺席該欄時行為逐位相同。
5. `SessionPlanSetup.test.ts` 斷言 selected ids 在 `tracking` optgroup、未選 Pilot 缺席、可用鍵盤選取與加入；若加 ad hoc copy，斷言文字而非顏色。
6. 以 selected Pilot + `tracking_scene_v1` 驗同 family preview，以 selected Pilot + detection 驗跨 family preview；實際 steps 與 T1 compiler expected 相同。
7. 擴充 export test：`sessionPlanMode:'custom'`、items/rest/family order/item/rep coordinates、`meta.drillId`、primary `rngSeed`、`weaponId:'tracking_pilot_hold'`、`sceneId:'field-low'` 可對帳。parser 不新增 allowlist且可 round-trip。
8. 加負向斷言：ad hoc export 不帶 `meta.assessment`；不由 Session Plan code 產生 manifest seed family、retry log 或 eligibility status。
9. 驗證 source order/ownership：drill activation 必須在 sim loop 建構前套用既有 weapon precedence；不得改 WP-62 已釘死順序。
10. 執行 focused/full verification，更新 graphify 與 progress。

## Definition of Done

- [ ] runtime/family/weapon 三者對 selected ids 為 total mapping，對 unselected Pilot ids 均無 entry。
- [ ] selected entries 固定 `field-low` 且使用原 config object/typed builder 結果；沒有 alternate-seed clone。
- [ ] `npx vitest run src/ui/SessionPlanSetup.test.ts src/session/sessionProgramExport.test.ts src/session/trackingPilotSchedulableDrills.test.ts` exit 0。
- [ ] UI 測試從真實 select 找到 selected ids，未選 Pilot ids 全缺席，鍵盤操作可加入 program。
- [ ] 若採預設 visibility，Controls projection 不含 selected ids，但 `loadDrillById()` runtime registry 含 selected ids；兩側各有斷言。
- [ ] export round-trip 可從 item/rep 回指所選 drill，且 seed/weapon/scene 與 canonical config 一致。
- [ ] `src/session/trackingPilotManifest.ts`、`TrackingPilotRunner.ts`、Pilot config value lines、`src/sim`、`SharedState` 零 diff。
- [ ] 全量 Vitest、typecheck ×2、build 全部 exit 0；`graphify update .` 完成。

## Failure handling

- picker 有 entry、runtime 無 entry：禁止合併；不以 try/catch fallback。
- clearance 失敗：先確認 scene pin/config identity；不得縮小 trajectory 或 hitbox「讓測試過」。
- metadata parser 因歷史 id 失敗：保持 shape-only reader 原則，不把 live roster allowlist 加到 reader。

