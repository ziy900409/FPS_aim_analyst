# WP-50 — progress.md

> Running log。Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-27**：依engineering-planning skill完成repository-grounded規劃。盤點`TickRecord`／`DrillEvent`／`Meta`、live render callback、SceneManager、CameraController、Target/Impact/Tracer views與official roster；尚未修改production code。
- **2026-08-27**：確認legacy v2不能一律宣稱full：tick只有第一個visible/alive target座標且無ID/lifecycle，continuous recoil、shot ray/impact與projectile visual未完整export。規劃T1 additive replay contract，legacy依capability降級。
- **2026-08-27**：將工作拆為T0～T6 + T-exit；預設單renderer／隔離scene／single app rAF exclusive ownership，並以pure time sampling守住seek invariant。

## Decision Log

- **D-50-P1 / Recorded state**：不重跑input或live sim；payload + normalized time是唯一replay truth。
- **D-50-P2 / Exact support**：support registry只接受exact `drillId`，status由profile與observed capabilities共同判定。
- **D-50-P3 / Legacy honesty**：沒有replay v1 evidence的舊payload最高先視為partial；T0可依逐drill證據收斂，但不得按schemaVersion批次升full。
- **D-50-P4 / Seek purity**：targets與短效fire/hit visuals由recording+t純推導；不重用live Impact/Tracer累積state。
- **D-50-P5 / Presentation ownership**：prototype優先共用既有renderer/canvas，但scene/camera/view state隔離；app frame owner在live/replay間互斥。

## Open Questions（狀態）

- **OQ-50.1**：full visual fidelity最低集合，待使用者／遊戲設計owner於T0 exit確認。
- **OQ-50.2**：current Practice Result是否允許in-memory replay，建議允許但不保存。
- **OQ-50.3**：partial是否可進有限重播，建議可，並持續顯示缺失capabilities。
- **OQ-50.4**：asset pack version mismatch，建議降partial並顯示版本警告。

- **2026-08-28**：完成 **T0 — Entry Gate／Replay Sufficiency Audit／PoC**。Production code diff = 0（僅 progress.md/README.md/task-checklist.md/T0-entry-gate.md 更動 + 已清除的 throwaway PoC test）。詳見下方 Evidence Log 與 Decision Log D-50-P6～P11。OQ-50.1～4 皆已取得 owner（使用者）確認，T1 可開工。
- **2026-08-28**：完成 **T1 — Additive Replay Contract／Capture／Support Classifier**（4 個垂直切片，各自獨立 commit + 全綠驗證）。詳見下方 T1 Evidence Log 與 Decision Log D-50-P12～P14。
- **2026-08-28**：完成 **T2 — Playback Domain Core**（4 個垂直切片：contracts+normalizer／sampleReplay／ReplayPlayer／42k-tick perf benchmark，各自獨立 commit + 全綠驗證）。詳見下方 T2 Evidence Log 與 Decision Log D-50-P15～P18。
- **2026-08-28**：完成 **T3 — Exclusive Presentation Ownership／Base Replay Scene**（5 個垂直切片：PresentationCoordinator／ReplaySceneAdapter+scene-config resolution／ReplayPresentationSession／50-cycle+pump-isolation 整合測試／main.ts wiring，各自獨立 commit + 全綠驗證）。詳見下方 T3 Evidence Log 與 Decision Log D-50-P19～P21。
- **2026-08-28**：完成 **T4 — Target Lifecycle／ADS-Recoil／Shot-Hit Effect Adapter**（7 個垂直切片：ReplayRecording weaponId/targetHitbox/hipFovDeg pass-through＋replayRecoil.ts 純函式 recoil 重放／ReplaySceneAdapter punch+FOV extras／ReplayTargetView／ReplayEffectView／ReplayPresentationSession 佈線／direct-seek-vs-sequential state-hash 測試／42k-tick render-adapter perf 測試，各自獨立 commit + 全綠驗證）。詳見下方 T4 Evidence Log 與 Decision Log D-50-P22～P24。
- **2026-08-31**：完成 **T5 — Replay Screen／Transport／Timeline／HUD**（單一垂直切片：`ReplayTransport.ts` + `ReplayScreen.ts` 兩個新檔＋各自 component test，全綠驗證後一次 commit）。詳見下方 T5 Evidence Log 與 Decision Log D-50-P25～P27。

## T0 Audit — Official Assessment Exact-`drillId` Roster

以 `mode: 'assessment'` 逐檔 grep 確認（practice/pilot/dev drills 排除，因 Replay policy：「historical replay 只有 Assessment」）：

| exact drillId | file | motion | spiderShot（center/peripheral） | weapon（ballistic） | ADS config |
|---|---|---|---|---|---|
| `hold_click_v1` | `src/drill/hold_click_v1.ts` | `linear`／`slide-in`（有） | 無 | 預設 ak47（hitscan） | ak47.ads 存在 |
| `hold_track_v1` | `src/drill/hold_track_v1.ts` | `linear`／`slide-in`（有） | 無 | 預設 ak47（hitscan） | ak47.ads 存在 |
| `spider-shot-v1` | `src/drill/spider_shot_v1.ts` | 無（static） | 有 | 預設 ak47（hitscan） | ak47.ads 存在 |
| `spider-shot-v2` | `src/drill/spider_shot_v2.ts` | 無（static） | 有 | 預設 ak47（hitscan） | ak47.ads 存在 |
| `counterstrafe-cued-v1` | `src/drill/counterstrafe_cued_v1.ts` | 無（static） | 無 | 預設 ak47（hitscan） | ak47.ads 存在 |
| `counterstrafe-reversal-v1` | `src/drill/counterstrafe_reversal_v1.ts` | 無（static） | 無 | 預設 ak47（hitscan） | ak47.ads 存在 |

**負向確認**（unknown/prefix 不得沿用 family fallback，FR-50.1）：`tracking_v1`／`tracking_scene_v1`／`tracking_longrange_v1`／`tracking_br_v1` 及其 7 個 axis variants／`detection_popin_v1` 均**無** `mode` 欄位（`DrillConfig.mode` 省略 = practice，見 [DrillConfig.ts:107](../../../../../src/drill/DrillConfig.ts)）→ 非 Assessment，historical replay 不適用；`counterstrafe-free-v1`（warmup）、`peek_click_transfer_pilot_v1_{1.5,2,3}deg`（pilot）同為 practice-only，只影響 OQ-50.2（in-memory current-Result replay），不影響 historical 6-ID roster。BR tracking protocol variants（含 projectile ballistic）**不在**目前 Assessment roster 內——projectile 視覺重建不必列入 T1 的「full」範圍（見下方 D-50-P7）。

**關鍵結構性發現**（`src/sim/TargetManager.test.ts` 現有斷言，全部 `state.targets` 長度觀察值皆為 0 或 1，涵蓋 hold-click/hold-track/spider-shot 路徑）：6 個 official exact ID **從未同時有 >1 個 active target**（spider-shot 的 center/peripheral 為「交替佔用同一 slot」而非同時並存）。這使得 legacy v2 `TickArena.recordState()`「只記第一個 visible && alive target」的簡化，對**目前**這 6 個 ID 而言**沒有遺失目標座標**——真正缺的只是 target ID/zone（可從既有 `visible`/`target_stop` 事件的 `targetId`/`side`/`zone` 欄位事件式還原，不需要逐 tick 陣列）。此發現**不是**對未來任意新 drill 的保證（README D-50-P3「legacy honesty」與 exact-profile-only 政策不變）——T1 開工前需先補一個 invariant test 鎖定這個假設（見 Decision Log D-50-P8／使用者已確認）。

## T0 Audit — PoC Evidence（`tests/_t0_poc/*.test.ts`，執行後已依 DoD 清除，不留在 repo）

1. **`recoil-seek-purity.test.ts`**（6 assertions，全綠）：以真實 `src/recoil/punch.ts`（`recoilTick`/`recoilOnFire`）+ `generateRecoilTable(ak47.recoil)` 驗證：
   - 10 發全自動 burst + 衰減，在 9 個混合（burst 中／burst 後）tick index 上，「從 t=0 重放到目標 tick」與「循序播放到同一 tick」逐欄位（`aimPunchPitchDeg`/`YawDeg`/`punchVelPitch`/`Yaw`/`viewPunchPitchDeg`/`YawDeg`/`recoilIndex`）**bit-for-bit 相等**。證明 recoil punch 是純函式重放、非路徑相依，滿足 FR-50.10 對這個子系統的具體驗證，且不呼叫任何 sim 模組（FR-50.4 相容）。
   - 衰減至「實務可忽略」（合成量值 `<1e-6`）耗時 **248 ticks @ 64Hz ≈ 3.875s**；**從未**在合理時間內到達 IEEE754 精確 0（`punchVelPitch/Yaw` 為純指數衰減、無線性 snap，會無限趨近但理論上要到 float64 underflow 才精確為 0）。→ **結論**：T1 不能假設「補打前一發後很快變 0」而省略 normalize-time 預建索引；README §2.5「normalize 一次建 index」的設計是正確方向，"從最近一次 fire 重放" 這條捷徑本身没问题（幾百步、微秒等級，遠低於 NFR-50.2 的 2ms 預算)，但**索引要在 normalize 時對整段錄影建一次**，不要天真假設短時間衰減到精確 0。
2. **`payload-size-estimate.test.ts`**（2 assertions，全綠，含 1 條「找到問題」的斷言）：
   - `capacityForDrill(128, 300)` = **41,528 ticks**（對應 NFR-50.1「42,000 ticks 附近」的來源）。
   - Legacy tick JSON ≈ 134 bytes/tick；README §2.3 草案的**逐 tick nested target 陣列**（即使只 1～2 個 concurrent target）在 41,528 ticks 時膨脹到 **~9.7～12.5 MiB**，**超出 NFR-50.1 的 4 MiB fixture 預算 2～3 倍**。
   - **結論／T1 待辦**：不可用「逐 tick array-of-objects」直接照抄 README 草案；配合上面「單一 active target」的發現，T1 應改用**單一 scalar 附加欄位**（例如 `targetId?: string`，比照既有 `tx/ty/tz` 慣例，而非陣列）或欄位式（columnar，比照 `TickArena` 現有 `Float64Array` per-field pattern）編碼，才能同時滿足 NFR-50.1 的 250ms/4MiB 與這次 OQ-50.1 收斂後的實際需求（見下方修訂後 schema 候選）。
3. **`scene-isolation.test.ts`**（2 assertions，全綠）：`SceneManager`／`CameraController`／`TargetView` 皆為純 class instance、無 module-level singleton；兩個並存 instance 互不干擾（改 A 的 FOV/mouse delta 不影響 B）；50 次 enter/leave（`new SceneManager` → `TargetView.sync` → `dispose`）後每輪 `scene.children.length` 皆精確回到 0，無跨輪累積。**範圍限制**：本 PoC 未觸及 `WebGPURenderer`/canvas（此 headless 環境無真實 GPU adapter，`createRenderer.test.ts` 現況也只測 `resolveBackend` 純函式、不建真 renderer）——renderer/canvas 層級的 exclusive-frame-owner 與長時間 GPU resource lifecycle 仍需在 T3 於瀏覽器/Playwright 環境驗證，本 PoC 只證明「render-object-graph 層沒有阻擋隔離的架構障礙」。

## T0 Audit — CodeGraph Impact Summary

- `TickArena`/`recordState`（`src/data/RingBuffer.ts`）：僅 `DataRecorder.ts` 2 個呼叫點，⚠️ 無直接覆蓋測試（透過 `DataRecorder`/`SimLoop` 間接覆蓋）。Additive 欄位風險集中在此類別的 preallocated-arena 佈局（CLAUDE.md §4 固定佈局紀律）。
- `TickRecord`：34 個呼叫點（`metrics/*`、`data/export.ts`、`data/DataRecorder.ts` 等），6 個 test 檔覆蓋。`DrillEvent`：50 個呼叫點，7 個 test 檔覆蓋——兩者是 metrics/export 生態的高扇出核心，T1 新增欄位必須嚴格 additive optional，不能碰現有欄位語意。
- `DrillEvent` 的 `fire` variant**已經**帶 `viewYaw/viewPitch/aimPunchPitch/aimPunchYaw/spreadX/spreadY/recoilIndex/ammo/targetId/offsetDeg/part`——比 README §0 discovery item 2 原始描述更豐富；這批既有欄位正是上面「recoil 可純推導」與「shot cue 可還原」兩個結論的資料來源，T1 不需要重複捕捉。
- `createRenderer`（`src/render/createRenderer.ts`）：確認**只有** `main.ts` 一個呼叫點（README §0 item 8 成立）。`SceneManager`/`CameraController`/`TargetView`/`ImpactView`/`TracerView` 皆為 `main.ts` 直接 instantiate，無其他 caller，無跨模組隱藏耦合。
- `DrillMetricRegistry`（`src/history/DrillMetricRegistry.ts`）：現況**只登記 `spider-shot-v2`** 一個 exact drillId（`registrationForExactDrill`，無 family/prefix fallback，`unregistered-drill` 為顯式狀態）——這是 WP-49 已經在生產環境驗證過的「exact-drillId-only registry」先例，直接佐證 FR-50.1／§2.4 的 profile registry 設計方向沒有生態不相容風險。
- WP-48／WP-49 依賴確認（非猜測，讀當前原始檔）：
  - `HistoryClient.loadRun(runId, signal?): Promise<ExportPayload>`（`src/history/HistoryClient.ts:61`）已存在且原生支援 `AbortSignal`——T6 的 generation/abort 需求（NFR-50.6）可直接複用，不需自建 fetch 包裝。
  - `HistoricalRunDetail.ts` 已有**型別化** `onReplay?: (runId: string) => void` port（README §0 item 10 描述的「approved contract」屬實），目前渲染一個 disabled 的「Replay（尚未提供）」按鈕——T6 只需傳入實作、不需改 WP-49 檔案的公開介面。
  - `ResultScreen.ts` **尚未**有任何 replay 相關程式碼（grep 零命中）——FR-50.14（current Result replay action）完全是 WP-50 T6 的新範圍，無需相容既有 port。

## Decision Log（續）

- **D-50-P6 / OQ-50.1 收斂（使用者確認 2026-08-28）**：`full` 定義**縮小為**符合 T0 證據的範圍——camera（punch 由 recoil 純函式推導，不逐 tick 捕捉）+ 單一 active target 位置/ID（既有 `tx/ty/tz` + 新增 scalar `targetId?`，非陣列）+ ADS 逐 tick flag（既有）+ shot/hit cue（既有 `fire`/`hit` 事件欄位推導）。**Projectile 視覺明確排除於目前 full 範圍**（無任何 Assessment-mode drill 使用 projectile 武器）；未來若有 projectile drill 晉升 Assessment，須重開 OQ 重新收斂，不得事後靜默擴大「full」語意。
- **D-50-P7 / Roster 範圍收斂**：Historical replay 的 exact-drillId 全集固定為 6 個（`hold_click_v1`／`hold_track_v1`／`spider-shot-v1`／`spider-shot-v2`／`counterstrafe-cued-v1`／`counterstrafe-reversal-v1`）；BR tracking variants／tracking_*／detection_popin_v1 現況皆非 Assessment，不進 T1～T6 的 full/partial 矩陣（除非之後有獨立 WP 把它們升級為 Assessment，屆時比照 D-50-P6 重開 OQ）。
- **D-50-P8 / T1 前置驗證義務（使用者確認）**：T1 開工的**第一個子步驟**必須先新增一個 regression/property test，鎖定「6 個 official exact drillId 的 `state.targets.length` 恆 ≤ 1」這個 D-50-P6 schema 縮小所倚賴的假設；通過後才可依此定案 scalar `targetId?` 欄位（而非陣列）。若測試發現反例，D-50-P6 的 schema 縮小必須重新評估（不得沿用縮小後的假設）。
- **D-50-P9 / OQ-50.2 收斂（使用者確認）**：維持原推薦預設——當次 in-memory Result（Assessment **與** Practice 皆可）可立即 Replay；Practice payload 只活在記憶體，離開頁面後不可再尋回，不新增 history save/list 路徑。
- **D-50-P10 / OQ-50.3 收斂（使用者確認）**：維持原推薦預設——`partial` 允許有限重播，畫面持續顯示缺失 capability 清單（persistent banner），不做「只能查看結果」的封鎖。
- **D-50-P11 / OQ-50.4 收斂（使用者確認）**：維持原推薦預設——`assetPackVersion` 不一致時降 `partial`、用當前已安裝場景資產播放並顯示版本差異警告；只有當前資產**不滿足** drill 的 `minimumPlayable` 時才整體 `unsupported`。

## Revised Replay-v1 Schema Candidate（T0 output，供 T1 定案；取代 README §2.3 草案的 `targets[]` 形狀）

```ts
// TickRecord 既有欄位不變；additive 欄位收斂如下（D-50-P6～P8）：
interface TickRecord {
  // ...既有欄位（t/vx/vz/px/pz/tx/ty/tz/aim/keys/ads/dYaw?/dPitch?）不變
  /** WP-50 additive：目前 tick 的 active target 識別（scalar，非陣列——D-50-P8 待 T1 驗證後定案）。
   *  省略／null＝無 active target，與既有 tx=null 語意一致。*/
  replayTargetId?: string | null;
}
// 不新增 viewPunchPitchDeg/viewPunchYawDeg 逐 tick 欄位（D-50-P6）：
// replay 端在 normalize 時，對每筆 fire 事件重放 recoilTick/recoilOnFire（純函式，
// 輸入 = Meta.weapon.recoil + 事件序列的 recoilIndex/t）一次性建出全程 punch 索引。
// projectile 視覺欄位（ReplayProjectileState 等）本期不新增（D-50-P6/D-50-P7）。
```

## Evidence Log

- Baseline（T0 開工前）：`git rev-parse HEAD` = `7545620ccf26623d609a222a17841077fd76dbc4`；`git status --short` 除既有未追蹤的 `docs/exec-plan/active/stage11/`（與本 WP 無關，未觸碰）外乾淨。
- Baseline `npm run build`：green（`tsc --noEmit` ×2 + `vite build`，既有 1113.50 kB chunk-size 警告，屬既存狀態非本次引入）。
- Baseline `npx vitest run`：**159 test files passed / 1426 tests passed / 2 skipped**（0 failed）。
- T0 PoC 執行結果：`npx vitest run tests/_t0_poc` 最終 **3 files / 6 tests 全綠**（過程中的 2 次失敗屬 PoC 腳本本身的浮點取樣/斷言錯誤，已修正並記錄在上方 Evidence 小節；`payload-size-estimate.test.ts` 的「大小超標」斷言是刻意保留的**發現型**斷言，非腳本錯誤）。
- T0 收工前：PoC 測試檔已刪除（`rm -rf tests/_t0_poc`），`git status --short` 確認回到與開工前一致的乾淨狀態，production code diff = 0。

## T1 — Additive Replay Contract／Capture／Support Classifier（2026-08-28）

依 D-50-P8 要求，T1 第一個子步驟即為鎖定 target cardinality 假設的 regression test，其餘四個切片依序疊加、逐一 commit：

1. `test(replay): lock D-50-P8 single-active-target invariant for official Assessment drills`（`a8c64e6`）——`tests/replay/target-cardinality-invariant.test.ts`：6 個 official exact drillId 各自跑完整 drill（countdown → running → ended 或 backstop），逐 tick 斷言 `state.targets.length <= 1`。全綠，驗證 D-50-P6 schema 縮小（scalar `replayTargetId?` 而非陣列）的前提成立。
2. `feat(replay): capture additive replayTargetId tick field and meta.replay marker`（`298f98e`）——`TickRecord.replayTargetId?: string | null`（`src/data/RingBuffer.ts`）、`TickSourceState.targets[].id?`、`TickArena` 新增 preallocated `(string|null)[]`（非 typed array——字串無法進 typed array，但仍固定長度、無 push，符合固定佈局紀律精神）、`Meta.replay?: ReplayMeta{replaySchemaVersion:1}`（`src/data/metadata.ts`，`collectMeta` 無條件填入——目前唯一 production 路徑 `recordTickFromState`→`TickArena.recordState` 一律有此能力）、`exportPayloadSchema.ts` 新增對應 strict parse/serialize。**關鍵設計修正**：`replayTargetId` 採 dYaw/dPitch 的「有值才 spread」慣例（非 tx/ty/tz 的「恆存在、null 表無」慣例）——否則既有大量 `toEqual` 精確比對的 legacy 測試（無 target 的 tick）會全部斷裂；只有「新增有 target 的 tick」才多出這個 key，既有零 target 案例逐位不變。
3. `feat(replay): add exact-drillId profile registry and support classifier`（`a2e2ff7`）——`src/replay/contracts.ts`（`ReplaySupportStatus`/`ReplayCapability`/`ReplaySupport`/`ReplayProfile` 型別)、`src/replay/replayCompatibility.ts`（`classifyReplaySupport(payload): ReplaySupport`,純函式,分類順序＝timeline structural validity → exact profile lookup → capability 檢查 → overflow;6 個 official exact drillId 各自登記獨立 profile,無 family/prefix fallback)。16 個 reason-matrix 單元測試涵蓋 full/partial/unsupported 與穩定 reason 排序。
4. `test(replay): lock replayTargetId size win over the rejected array-of-targets draft`（`87b5464`）+ `test(replay): prove capture-to-classifier agreement and legacy-never-full`（`c3b8cd3`）——補 NFR-50.1 payload-size 證據與端到端整合測試（見下方 Surprises 與 Evidence）。

`npm run build` / `npm run typecheck` / `npx vitest run`（1489 tests,167 files,0 failed)全綠;`graphify update .` 已同步（`89c0795`）。

### Decision Log（T1）

- **D-50-P12 / replayTargetId spread 慣例**：不沿用 `tx/ty/tz` 的「恆存在＋null sentinel」慣例,改採 `dYaw/dPitch` 的「有值才 spread」慣例——原因：`tx/ty/tz` 的 null sentinel 慣例是既有欄位,舊測試早已預期它；但 `replayTargetId` 是全新欄位,若比照 tx 恆輸出（即使 null）,會讓數十個既有「無 target tick」的 `toEqual` 精確快照測試全部斷裂。改為「有 active target 才輸出 key」後,無 target 的 tick 逐位不變（零測試需要改動之外的 churn），且語意仍與 README schema 草案「省略／null 皆表無 active target」的文字相容。
- **D-50-P13 / meta.replay 為單一版本旗標,非完整 capabilities 陣列**：README §2.3 原草案的 `ReplayMeta{replaySchemaVersion,recordingHz,visualSemanticsVersion,capabilities}` 在 D-50-P6 收斂後大部分欄位變成多餘——camera/ADS/shot-hit-cue 皆可從既有 v2 欄位（`weapon.recoil`／`ticks[].ads`／`fire`/`hit` 事件）逐一推導,不需要額外宣告;`recordingHz` 與既有 `meta.simHz` 重複；`visualSemanticsVersion` 无对应可变语意需要版本化。故 T1 只留 `replaySchemaVersion:1` 一個旗標,單純用來讓 classifier 分辨「這份匯出的 recorder 有無填 `replayTargetId`」,不用逐 tick 掃描判斷。
- **D-50-P14 / classifyReplaySupport 只回傳 full/partial/unsupported,`invalid` 留給 parseExportPayload**：README §2.4 分類順序把「JSON schema 本身不合法」與「結構有效但缺 capability」分成兩層——前者是 `parseExportPayload` 的既有職責（回傳 `ok:false`）,不需要 classifier 重新判定;後者才是 `classifyReplaySupport` 的範圍。這避免 `ReplaySupportStatus` 型別雖仍保留完整四值（供 T5/T6 UI 用一個型別描述完整狀態機）,但 classifier 函式簽章維持單純（輸入必為已通過 strict parse 的 `ExportPayload`）。

### Surprises & Discoveries（T1）

- **NFR-50.1 的「≤4 MiB」不能字面理解為「recorder 滿容量（41,528 ticks）序列化後必須 ≤4 MiB」**：實測發現，即使完全不含任何 WP-50 新欄位的既有 legacy tick（`t/vx/vz/px/pz/tx/ty/tz/aim/keys/ads`）在滿容量、compact JSON.stringify 下就已經是 **~6.0 MiB**（超出 4 MiB 25%+），這是 WP-50 之前就存在的既有系統性質,不是本次新增的回歸。加上 `serializeJSON` 實際使用 2-space pretty-print（比 compact 大 ~1.7 倍）,滿容量 pretty-printed legacy 匯出約 **~10.4 MiB**。因此 NFR-50.1 的 4 MiB/42k-tick 描述應理解為「T2 效能測試要用的一個*寫實*（而非理論滿容量）fixture 的目標大小」——6 個 official exact drillId 實際受 `timing.timeLimitMs`（多數 120000ms）或 `endCondition.value`（spider-shot-v2 為 60000ms）後援閘限制,真實最長匯出約 ≤120s ≈ 15,360 ticks,遠低於理論的 300s／41,528-tick 安全上限。T1 因此把驗證重心改為「scalar `replayTargetId` 相對於 README §2.3 被否決的陣列草案,在同樣滿容量／100% occupancy 最壞情境下所增加的位元組成本」（實測：scalar 每 tick 額外 ~18 bytes,滿容量陣列草案是 scalar 的 ~1.36 倍),而非重申一個連既有系統都不成立的絕對位元組上限。**待辦（T2 owner 確認）**：T2 建 42k-tick 效能 fixture 時,應採「寫實 occupancy pattern 的合成/真實資料」而非「理論滿容量」,並在 T2 progress.md 記錄實際採用的 fixture 大小與其相對於 4 MiB 的關係,避免下一位讀者誤以為既有系統本來就符合這個絕對值。
- **`DrillRunner` 既有註解已經非正式記載了 D-50-P8 的不變量**：`src/drill/DrillRunner.ts` 第 134-135 行的既有註解「擊殺數 = 見過的 id 數 − 目前存活數（單 active 目標,故 targets.length ∈ {0,1}）」早已隱含這個假設,只是從未有 regression test 鎖定它。T1 新增的 `tests/replay/target-cardinality-invariant.test.ts` 是這個既有隱性契約的第一份顯式測試。

### Evidence Log（T1）

- Baseline（T1 開工前）：`git rev-parse HEAD` = `a8c64e6`（T0 收尾 commit）；`git status --short` 乾淨。
- 逐切片驗證：每個 commit 前皆執行 `npm run typecheck`（`tsc --noEmit` ×2）與 `npx vitest run`（相關子集 + 全量）,全綠才 commit。
- T1 收工：`npm run build`（green,既有 1113.72 kB chunk-size 警告,屬既存狀態）；`npx vitest run` 全量 **167 test files / 1489 tests passed / 2 skipped（0 failed）**；`graphify update .` 已同步（commit `89c0795`）。
- Payload-size 證據（`tests/replay/payload-size-budget.test.ts`）：單一有 target 的 tick 相對於無 target 的同一 tick,`replayTargetId` 只增加位元組數 < 40 bytes；在 41,528-tick 滿容量、100% target occupancy 最壞情境下,scalar 編碼（~6.74 MiB）比 README §2.3 被否決的 `targets:[...]` 陣列草案（~9.19 MiB）省約 27%（陣列草案／scalar ≈ 1.36×）。
- 端到端證據（`tests/replay/official-full-candidate.test.ts`）：`hold_click_v1` 走完整 production pipeline（`TargetManager`→`DrillRunner`→`SimLoop`→`DataRecorder`→`collectMeta`→`buildExportPayload`）,再經 `canonicalExportJSON`→`parseExportPayload` 走一次 strict wire boundary 往返,`classifyReplaySupport` 回報 `full`、`missing`/`reasonCodes` 皆空——證明 Slice 2（capture）與 Slice 3（classifier）不是各自獨立成立、而是真的能串成完整 pipeline。另以 2 個既有 `research/fixtures/exports/*.json`（pre-WP-50 真實/合成匯出）驗證 `classifyReplaySupport` 永遠不誤判為 `full`（D-50-P3）。

## T2 — Playback Domain Core（2026-08-28）

四個垂直切片、各自獨立 commit + 全綠驗證：

1. `feat(replay): add ReplayRecording contracts and strict normalizer`（`c794c8a`）——`src/replay/contracts.ts` 新增 `NormalizedReplayTick`/`NormalizedReplayEvent`/`ReplayRecording`/`ReplaySample`/`ReplayPlayer` 等純 playback-domain 型別（additive，未動 T1 既有型別）；`src/replay/normalizeReplayRecording.ts`——`ExportPayload -> ReplayRecording`：時間原點歸零（`ticks[0].t` 為 0）、事件依 `(timeMs, 原始 array 位置)` 穩定排序、建一次 `Float64Array` binary-search 索引（`tickTimes`/`eventTimes`）、`meta.scene` 直通為 `ReplaySceneDescriptor`。`classifyReplaySupport` 已經在 `unsupported` 情形擋下空/非單調 ticks（README §2.4 `minimumPlayable=['camera']`），故 normalizer 本身不重複驗證 finite（`ExportPayload` 型別本身即由 strict parse boundary 保證）。新增 static import-scan 測試鎖定 replay domain purity（無 DOM/Three/fs/sim/wall-clock/random）。
2. `feat(replay): add pure binary-search sampling with seek-purity guarantee`（`70827df`）——`src/replay/sampleReplay.ts`：`sampleReplay(recording, t, reuse?)` 以 O(log n) binary search 定位 tick/event，純函式推導 `ReplaySample`（position/camera/input/targets/effects/eventCursor）。yaw 採 shortest-arc（wrap 到 `(-π, π]` 再乘 alpha）；target 只在左右 tick 同 ID 且皆有座標時插值，否則採左 tick 離散 hold（涵蓋 spawn/despawn/target-swap 三種邊界）；keys/ADS/speed 一律取左 tick（不插值）；短效 `effects` 以單一 `EFFECT_WINDOW_MS`（見 Decision Log D-50-P16）從 `eventCursor` 往回掃描、遇到第一個超出窗口的事件即可提早停止（不需整陣列掃描）。`ReplaySampleBuffer` 讓呼叫端重用 `targets`/`effects` 陣列，避免熱路徑逐幀配置新陣列。
3. `feat(replay): add injected-clock ReplayPlayer state machine`（`a7c9a8c`）——`src/replay/ReplayPlayer.ts`：`paused`/`playing`/`ended` 狀態機，`frame(nowMs)` 只依 `(nowMs - lastAnchorNowMs) * rate` 推進，且 `play()`/`seek()`/`setRate()` 一律重設 anchor（防 tab 休眠/切速/seek 造成的假跳動）；`previousEvent()`/`nextEvent()` 對 `recording.eventTimes` 各自 binary search「嚴格早於/晚於當前 t 的最近事件」，到邊界即為 no-op（不 wrap）；`dispose()` 後任何方法呼叫皆 throw（見 D-50-P18）。
4. `test(replay): lock 42k-tick normalize/sample perf against NFR-50.1/2/4`（perf slice）——`tests/replay/replay-perf.test.ts`：42,000-tick 合成 fixture（呼應 T0 `capacityForDrill(128,300)` 與 NFR-50.1 原文數字，非 T1 Surprises 記錄的 ~15,360-tick 寫實上限——本測試刻意壓理論上限，見下方 Surprises）；量測 normalize P95、5,000 次 scattered-seek sample P95、3,000 幀 buffered per-frame P95，以及 500→42,000 ticks（84×成長）下的執行時間比例，驗證非線性全陣列掃描。

`npm run build` / `npm run typecheck` / `npx vitest run`（**172 test files / 1534 tests passed / 2 skipped，0 failed**）全綠。

### Decision Log（T2）

- **D-50-P15 / T2 的「camera」只到 base position/yaw/pitch 插值，recoil punch 重建留給 T4**：README OQ-50.1 收斂（D-50-P6）雖然把「camera capability」定義為「punch 由 recoil 純函式推導」，但 T2 的 `FR-50.5`（「相鄰 ticks 間插值 player/camera position 與 yaw/pitch」）與 T2-playback-domain-core.md 的 Required tests 只涵蓋 shortest-arc yaw／target segment／seek purity，未提及任何 recoil/punch 重放。對照 README 任務拆解表，`recoil`/`ADS` 視覺重建明確歸在 T4（「Target lifecycle、ADS/recoil、shot/hit/projectile effect adapter」）。故 T2 的 `ReplaySample.camera` 僅為 ticks[].aim 的基礎插值，尚未疊加 view punch；T4 將消費本 task 的 `ReplayRecording`/events，自行重放 `recoilTick`/`recoilOnFire`（`getWeapon(recording 對應的 meta.weaponId)` 提供固定 recoil 參數）疊加在這個基礎樣本之上，不需回頭修改 T2 的 binary-search 核心。
- **D-50-P16 / effects 採單一 `EFFECT_WINDOW_MS`（200ms），非逐 kind 視覺時長**：README §2.5 只說「短效視覺由 `eventTime <= t < eventTime + fixedDuration` 純查詢」，未規定每種事件 kind 各自的時長（那屬於 T4 的 `ReplayEffectView` 視覺設計）。T2 選擇一個保守、kind-independent 的通用視窗常數，供 timeline/HUD 一類的「這附近剛發生過什麼事」查詢使用；T4 若需要逐 kind 精確視覺時長，可在自己的 view adapter 層對這個結果再過濾/加窗，不需改動 `sampleReplay` 的 binary-search 核心。
- **D-50-P17 / `ReplaySampleBuffer` 是「呼叫端必須立即消費」的重用契約，非快取**：`reuse.targets`/`reuse.effects` 陣列在下一次 `sampleReplay` 呼叫時會被原地截斷重填（`length = 0` 後 push），因此前一次呼叫回傳的 `ReplaySample` 一旦下一幀呼叫就會被覆寫。測試（`sampleReplay.test.ts`「reusing a ReplaySampleBuffer...」）刻意在每次呼叫後立即拷貝快照再比較，把這個「必須立即消費」的契約寫成可驗證的行為，而不是留一個容易被誤用的陷阱。
- **D-50-P18 / `ReplayPlayer.dispose()` 讓後續呼叫全部 throw，而非靜默 no-op**：README §2.6「dispose 後不得發布 sample」若實作成「dispose 後 frame() 靜默返回舊 sample」，違反者不會有任何錯誤訊號，容易讓 T3 presentation coordinator 的生命週期 bug 長期不被發現。改為 throw 讓契約違反在測試與開發期都立即可見；T3 的 coordinator 只需確保在呼叫 `dispose()` 之後真的不再呼叫這個 player 實例的任何方法（正常生命週期下不需要 try/catch）。

### Surprises & Discoveries（T2）

- **binary-search 設計的效能餘裕遠超 NFR 門檻，且是次線性成長**：Node/V8 headless 測得（非瀏覽器，見 `replay-perf.test.ts` 檔頭註解）——42,000-tick normalize P95 ≈ **17.3ms**（NFR-50.1 門檻 250ms，餘裕 ~14×）；5,000 次 scattered seek 的 sampleReplay P95 ≈ **0.005ms**（NFR-50.2 門檻 2ms，餘裕 ~400×）；3,000 幀 buffered 循序播放 P95 ≈ **0.002ms**（NFR-50.4 門檻 4ms/frame，餘裕 ~2000×）。額外驗證：tick 數從 500 → 42,000（84× 成長）時，20,000 次 sampleReplay 呼叫總耗時只從 ~9.7ms 增至 ~19.8ms（~2×），實證 `sampleReplay` 是 O(log n) 而非 O(n) 全陣列掃描。**注意範圍**：這是 Node/V8 對純 TS 函式的測量，不含 T3 之後才會出現的瀏覽器事件迴圈、GC 壓力來源（Three.js scene graph、DOM HUD 更新）或與 render/GPU submit 競爭同一幀預算的情境——T-exit 才需要瀏覽器層級的最終量測。
- **T1 Surprises 待辦已收斂**：T1 progress.md 的「T2 owner 確認」待辦（42k-tick fixture 該用「寫實 occupancy」而非「理論滿容量」）在此明確記錄決定：T2 的效能測試刻意採用 NFR-50.1 原文的理論滿容量數字（42,000 ticks）作為壓力測試上界，而非 6 個 official drill 實際受 timing gate 限制的 ~15,360-tick 寫實上限——因為 NFR-50.1 的文字本身就是以 42,000 為準；寫實與理論兩個數字現在都已在帳本上明確區分，不會再被誤讀成同一件事。

### Evidence Log（T2）

- Baseline（T2 開工前）：`git rev-parse HEAD` = `89c0795`（T1 收尾／graphify sync commit）；`git status --short` 乾淨。
- 逐切片驗證：每個 commit 前皆執行 `npm run typecheck`（`tsc --noEmit` ×2）與 `npx vitest run`（相關子集 + 全量），全綠才 commit；4 個切片全數一次通過（無需修正重跑）。
- T2 收工：`npm run build`（green，既有 1113.72 kB chunk-size 警告，屬既存狀態非本次引入）；`npx vitest run` 全量 **172 test files / 1534 tests passed / 2 skipped（0 failed）**。
- Seek-purity 證據（`tests/replay/sampleReplay.test.ts`「seek purity」與 `ReplayPlayer.test.ts`「any command sequence...」）：對多個 t（含 tick 邊界、事件時間點、跨 target lifecycle 邊界）驗證「直接 seek(t)」與「從 0 逐步 walk 到 t」／「play/frame/setRate/pause 任意指令序列到同一 t」皆產生逐欄位相等（`toEqual`）的 `ReplaySample`，實證 FR-50.10 與 D-50-P4 seek purity 在 playback domain core 層級成立。
- Perf 證據（`tests/replay/replay-perf.test.ts`）：見上方 Surprises 小節數字；P95 皆以 5 次（normalize）或數千次（sample）迭代取樣，開發機 Node/V8（非 CI 專用硬體，數字僅供量級參考，非嚴格 SLA）。

## T3 — Exclusive Presentation Ownership／Base Replay Scene（2026-08-28）

五個垂直切片、各自獨立 commit + 全綠驗證：

1. `feat(replay): add exclusive live/replay PresentationCoordinator seam`（`304a1b9`）——`src/render/PresentationCoordinator.ts`：`PresentationMode`（`live` | `replay`）+ `frame()`/`resize()`/`enterReplay()`/`leaveReplay()`/`dispose()`。唯一分流點：`frame()`/`resize()` 在任何 live 邏輯（尤其 `simLoop.pump`）之前依 mode 分支，replay 分支只呼叫 `session.frame(nowMs)`，不落到 live deps。`enterReplay()` 在已是 replay 態時 throw（不靜默 dispose-and-replace）——rapid switch 必須先 `leaveReplay()`。純 TS、零 DOM/Three 依賴，8 個 unit test 全綠。
2. `feat(replay): add isolated ReplaySceneAdapter and scene-config resolution`（`fc48dfb`）——`src/render/replay/ReplaySceneAdapter.ts`：自有 `SceneManager` 實例（不共用 live scene/camera，D-50-P5）；`applySample()` 直接依 `ReplaySample.camera.yaw/pitch` 與 `player.px/pz` 套 camera quaternion/position，公式與 main.ts live render loop 逐項對齊（`resolveEyeWorldBase` 基準 + `× SIM_TO_WORLD`；`qYaw·qPitch` 組合順序同 `CameraController#applyToCamera`）——刻意不疊加 recoil punch（D-50-P15，歸 T4）。`src/render/replay/replaySceneResolution.ts`：`resolveReplaySceneConfig()` 純函式,依 recorded `sceneId` 查目前已安裝的 `SceneConfig`,並標記 `assetPackVersion` 不一致（OQ-50.4/D-50-P11）而不拒絕解析。10 個 unit test 全綠。
3. `feat(replay): add ReplayPresentationSession async scene load/dispose lifecycle`（`bdac17f`）——`src/render/replay/ReplayPresentationSession.ts`：glue `ReplayPlayer`（T2）+ `ReplaySceneAdapter`；每個 session 實例擁有自己的一次 `createSceneManagerWithStatus` async 載入,`dispose()` 立即標記 `'aborted'`——若載入之後才 resolve,剛建好的 `SceneManager` 在到達當下就地 `dispose()`,絕不掛入任何 active tree（README §2.11 late-dispose）。`resize()` 在場景就緒前緩存、就緒後套用。`frame()` 在載入中為 no-op,就緒後才 sample+applySample+render,從不觸碰 live sim/state。6 個 unit test 全綠（含 fallback-scene-load 不崩潰）。
4. `test(replay): lock 50-cycle presentation lifecycle and pump-isolation invariants`（`27cc7af`）——`tests/replay/presentation-lifecycle.test.ts`：用**真實**（非 fake）`PresentationCoordinator`+`ReplayPresentationSession`+`ReplaySceneAdapter`+`SceneManager` 組合跑 50 次 enterReplay/frame/leaveReplay 循環,每輪結束後 `scene.children.length` 精確歸零（比照 T0 PoC `scene-isolation.test.ts` 模式,但這次是在完整 presentation 疊層上）；rapid switch（leaveReplay 後立即 enterReplay 新 session）驗證新舊 scene 互不重疊；pump-isolation proxy 驗證 replay 啟用期間任意幀數下 live frame callback（main.ts 裡 `simLoop.pump` 所在之處）呼叫次數恆為 0；fallback scene load 不中斷 session。4 個 integration test 全綠。
5. `refactor(replay): route live render callback through PresentationCoordinator`（`ce17004`）——`src/main.ts`：既有 render callback 本體**逐字保留**、只抽成具名函式 `liveFrame(now)`,交給 `createPresentationCoordinator({ frame: liveFrame, resize: ... })` 當 live deps；`createRenderLoop` 的 callback 改成 `(now) => presentation.frame(now)`。目前恆為 live 模式（無任何 entry point 呼叫 `enterReplay()`——那是 T6 的範圍),故這是純結構性 seam,`git diff` 確認除新增 import/註解外 render callback 本體無任何字元變動；`npm run build`/`typecheck`/`vitest run` 三者與變更前逐一比對皆為同一組 pass 數（177 files / 1562 tests）。

`npm run build` / `npm run typecheck` / `npx vitest run`（**178 test files / 1564 tests，1562 passed + 2 skipped，0 failed**）全綠。

### Decision Log（T3）

- **D-50-P19 / main.ts 本次只路由 frame,不路由 resize**：README §2.7/T3 Steps 提到「active-only resize」,但 T3 沒有任何 entry point 會讓 `PresentationCoordinator` 真正進入 replay 態（`enterReplay()` 只在測試裡被呼叫）——main.ts 全域 `resize()` 函式若也在此刻改走 `presentation.resize(...)`,會在「`presentation` 尚未建構前就先被呼叫一次」的既有時序上引入 TDZ 風險（`resize()` 在檔案早段就被立即呼叫一次,而 `presentation` 要等到本檔最尾端才能建構,因為 `liveFrame` 依賴幾乎整份檔案的其餘變數）。既然 replay 態在 production 中此刻不可能被啟用,繞這個 TDZ（比照既有 `controls`/`historyScreenHandle` 的 KI-013 模式）換不到任何行為效益,反而在一個沒有直接單元測試覆蓋的進入點檔案裡增加變更面。故 T3 讓 `resize()` 維持直接呼叫 `sceneManager.resize(...)`；`ReplayPresentationSession.resize()`（active-only resize 的真正實作）已在 T3 完整測試（含就緒前緩存）,T6 建真正的 replay entry point 時再把全域 `resize()` 與 `presentation.resize()` 接上。
- **D-50-P20 / ReplaySceneAdapter 不重用 live `CameraController`**：`CameraController` 的內部狀態是「累積式 mouse-delta 積分器」（`AimIntegrator`,只能靠 `applyDelta()` 增量累加,見 `src/input/mouseGain.ts`）,不是「每幀可設絕對 yaw/pitch」的介面。Replay 需要的是「依 `ReplaySample.camera.yaw/pitch` 這個絕對值逐幀 set」,套用 `CameraController.applyDelta()` 反推等效 delta 既不自然也徒增一層换算誤差風險。`ReplaySceneAdapter.applySample()` 改為直接以與 `CameraController#applyToCamera` 相同的 `qYaw·qPitch` 組合公式重新手刻（無累積狀態、無 punch）,兩者各自獨立,互不share 任何 mutable 積分器狀態（呼應 D-50-P5「不共用 live camera」）。
- **D-50-P21 / ReplayPresentationSession 不設共用 generation 計數器**：README §2.11 描述「payload/scene load generation」;但因為 `PresentationCoordinator` 已經強制「同一時間最多一個 active replay session」（`enterReplay()` 在已是 replay 態時 throw,見上方 slice 1 的 coordinator 設計),每個 `ReplayPresentationSession` 實例天生只可能存在於恰好一段「被 enterReplay 掛入 → 被 leaveReplay dispose」的期間,不會有第二個 session 與它並存競爭同一份「目前 active」旗標。故 T3 選擇讓 session 自己的 closure `disposed` flag 就是完整的 generation 保護（late-arriving load 一律先查 `disposed` 才決定 mount 或即棄置-dispose),不必在 session 之上另建一層跨 session 的全域 generation 計數器——那屬於 T6 需要「rapid run switch 前一個 session 尚未 dispose 完就換下一個」時才有意義的範圍,而 coordinator 目前的 assert-first 設計本就不允許這種疊加。

### Surprises & Discoveries（T3）

- **main.ts 的 render callback 完全可以逐字抽出,不需要重排任何既有變數宣告順序**：原先擔心抽出 `liveFrame` 會撞到本檔案已有的 KI-013 TDZ 慣例（`controls`/`historyScreenHandle` 皆需提前宣告成 `undefined` 才能避開）,但因為 `liveFrame`/`presentation`/`renderLoop` 三者本來就緊鄰在檔案最尾端、且彼此宣告順序天然滿足相依（`liveFrame` 先於 `presentation`、`presentation` 先於 `renderLoop` 的 callback）,轉換成 `function liveFrame(now) {...}` + `const presentation = createPresentationCoordinator(...)` + `createRenderLoop((now) => presentation.frame(now))` 完全不需要引入任何 `undefined` 佔位或提前宣告——純粹的尾端結構重排,`git diff` 顯示除了新增 import 與說明註解外,render callback 本體逐字元不變。
- **`ReplayPresentationSession` 不需要顯式的跨 session generation 計數器**：一開始依 README §2.11 的字面描述以為要仿照 HistoryClient 的 `AbortSignal`/generation 模式建一個獨立計數器,但因為 `PresentationCoordinator` 的「同一時間最多一個 replay session」不變量已經由型別層級的 assert-first `enterReplay()` 保證,每個 session 自己的 `disposed` boolean 就足以完整表達「這個 session 的這次 load 是否還算數」——見 D-50-P21。

### Evidence Log（T3）

- Baseline（T3 開工前）：`git rev-parse HEAD` = `89c0795`（T2 收尾／graphify sync commit,見上方 T2 節）；後續 5 個切片各自基於前一切片的 commit 累加,`git status --short` 每次 commit 前都確認只有本切片新增/修改的檔案待 stage。
- 逐切片驗證：每個 commit 前皆執行 `npm run typecheck`（`tsc --noEmit` ×2）與相關子集 `npx vitest run`,全綠才 commit；main.ts wiring 切片額外執行 `npm run build`（含 `vite build`）確認打包無誤,並用 `git diff src/main.ts` 逐行核對 render callback 本體零變動（只多了 import/註解/尾端重排）。
- T3 收工：`npm run build`（green,既有 1114.42 kB chunk-size 警告,屬既存狀態非本次引入）；`npm run typecheck` green；`npx vitest run` 全量 **178 test files / 1564 tests（1562 passed + 2 skipped，0 failed）**——與 T3 開工前的 177 files / 1562 tests（皆 passed）相比,新增剛好 1 個 test file、多出的 test 數與 T3 五個切片新增的 test 檔各自 test 數總和一致,無任何既有 test 被修改或刪除。
- Playwright（`npm run test:e2e`）：本次**未執行**——延續 T0～T2 的既有作法（先前 progress.md 各節 Evidence Log 亦只跑 build/typecheck/vitest,未見 Playwright 執行紀錄),且 T3 DoD 的「resize/rapid switch/abort/load failure/50-cycle」等場景已在 vitest 用真實（非 fake）`SceneManager`/`ReplaySceneAdapter`/`ReplayPresentationSession` 組合的 headless 整合測試涵蓋（見上方 slice 4）。真正需要瀏覽器 WebGPU context 的 renderer/canvas 層 exclusive-frame-owner 驗證,延續 T0 PoC `scene-isolation.test.ts` 當時記錄的範圍限制,留給 T6（真正的 replay entry point 落地、可在瀏覽器手動/E2E 驗證時）一併補齊。
- Open follow-up for T6：main.ts 全域 `resize()` 與 `presentation.resize()` 尚未接上（D-50-P19）；T6 建立真正的 replay entry point 時,若當時的 UI 需要「replay 開啟中收到 window resize」,須在該切片把 `resize()` 改為呼叫 `presentation.resize(...)`（`ReplayPresentationSession.resize()` 本身已支援「場景尚未就緒時緩存,就緒後套用」,見 slice 3）。

## T4 — Target Lifecycle／ADS-Recoil／Shot-Hit Effect Adapter（2026-08-28）

七個垂直切片、各自獨立 commit + 全綠驗證：

1. `feat(replay): reconstruct recoil punch timeline for T4 camera visuals`（`fc97458`）——`ReplayRecording` 新增 additive pass-through 欄位 `weaponId: string`／`targetHitbox?: TargetHitboxConfig`／`hipFovDeg?: number`（`contracts.ts`/`normalizeReplayRecording.ts`，僅 pass-through、不在 normalizer 套預設值）。`src/replay/replayRecoil.ts`（純函式，已加入 domain-purity-boundary 掃描清單）：`buildReplayPunchTimeline` 依 tick 順序重放 `recoilTick`/`recoilOnFire`（128Hz sim／64Hz 偶數 tick decay／半開窗 catch-up，逐位對齊 `SimLoop.ts simStep` 的順序）建出全程 per-tick `aimPunchPitchDeg`/`YawDeg` 陣列；`samplePunchDeg` 用與 `sampleReplay` 相同的 `(tickBefore,tickAfter,alpha)` 做線性內插（等價 live `recoil.prev/curr` lerp）；`resolveReplayCameraVisualState` 映射 sample+timeline+weapon+hipFovDeg 為 camera punch rad／FOV／`adsActive`。以獨立 tick-by-tick 參考重放 + 與 production `fire` 事件記錄的 `aimPunchPitch/Yaw` 欄位比對雙重驗證正確性（見下方 Evidence）。
2. `feat(replay): let ReplaySceneAdapter apply recoil punch and ADS FOV`（`3727c04`）——`applySample(sample, extras?)` 新增選填第二參數；punch 角度**在組 quaternion 之前**與 base yaw/pitch 相加（`qYaw(yaw+punchYaw)·qPitch(pitch+punchPitch)`），不是對已組好的 quaternion 事後再乘一個 punch quaternion（見下方 D-50-P22 為何後者數學上不等價）。省略 `extras` 逐位相容既有 T3 呼叫方式（既有 5 個 T3 測試不需改動）。
3. `feat(replay): add ReplayTargetView mesh pool for sampled targets`（`7d6ce27`）——比照 live `TargetView` 的 mesh 重用池，但消費已插值完的 `ReplaySample.targets`（不再自行插值/判斷 lifecycle 邊界）；hitbox 尺寸來自 `recording.targetHitbox`，缺席時退回 `DEFAULT_TARGET_HITBOX`（與 live `resolveTargetHitbox` 同一常數，GD-7 單一來源）；hitbox 對整份錄影固定一次（replay 不會中途換 drill），故不像 live 需要動態 `setShape`。
4. `feat(replay): add ReplayEffectView for time-derived shot/hit cues`（`a73b7d7`）——兩個常駐、重用的 marker mesh（非 live `ImpactView`/`TracerView` 的累積式 ring，那兩者依 render wall time／monotonic seq 遞增，不符合任意 seek 純推導）：hit marker 貼在比對到的 sampled target 位置、fire marker 貼在 camera 前方固定偏移；純由 `sample.effects`（已由 `sampleReplay` 依固定 `EFFECT_WINDOW_MS` 篩窗）驅動,窗內同種事件多個時取最後一個（D-50-P23 見下方,含為何不重建精確 tracer/impact 幾何的理由）。
5. `feat(replay): wire ReplayTargetView/EffectView and camera visual state into ReplayPresentationSession`（`6c8c487`）——`createReplayPresentationSession` 依 `recording.weaponId`（`getWeapon`,defensive try/catch 防未來未知武器 id 導致建構期 crash）建一次性 punch timeline；scene 就緒時同步建 `ReplayTargetView`/`ReplayEffectView`；`frame()` 依序 `resolveReplayCameraVisualState` → `adapter.applySample(sample, extras)` → `targetView.sync` → `effectView.sync` → render；`dispose()` 一併釋放兩個 view。
6. `test(replay): lock direct-seek vs sequential-walk parity for target/effect views`（`d55ebb5`）——`tests/replay/replay-visual-seek-purity.test.ts`：以真實 `sampleReplay()` 輸出（非手造 `ReplaySample`）驅動全新 `ReplayTargetView`/`ReplayEffectView` 實例，比較「直接 seek 到 t」vs「從 0 逐幀 walk 到同一 t」的最終 mesh 可見狀態，涵蓋窗內／窗外／目標已消失／backward seek 無殘留四種情境，全部逐位相等。
7. `test(replay): lock render-adapter frame perf and bounded mesh pool at 42k-tick scale`（本 slice）——`tests/replay/replay-visual-perf.test.ts`：42,000-tick、目標每 50 tick 換 ID（worst-case same-ID-segment 重評）＋每 20 tick 一組 fire+hit（worst-case effect window 掃描）的合成 fixture；量測 `sampleReplay+resolveReplayCameraVisualState+applySample+targetView.sync+effectView.sync` 合併每幀成本 P95，並鎖定 mesh pool 未逐 frame 無界增長。

`npm run build` / `npm run typecheck` / `npx vitest run`（**183 test files / 1593 tests passed + 2 skipped，0 failed**）全綠。

### Decision Log（T4）

- **D-50-P22 / punch 必須在組 quaternion「之前」與 base yaw/pitch 相加，不能事後乘一個 punch quaternion**：`README` 原文（`ReplaySceneAdapter.ts` T3 舊註解）曾把 punch 疊加歸給「`ReplayEffectView`」，暗示可以在 base camera 定好之後再由另一層「疊加」punch。實作時發現這在數學上不成立：live `CameraController#applyToCamera` 的公式是 `qYaw(yaw+punchYaw)·qPitch(pitch+punchPitch)`——**先把角度相加、再組合一次**；若改成 `qYaw(yaw)·qPitch(pitch)` 先組好，再乘上 `qYaw(punchYaw)·qPitch(punchPitch)`，因為 `qPitch(pitch)` 與 `qYaw(punchYaw)` 繞不同軸、不可交換，兩者不是同一個旋轉。故改為 `ReplaySceneAdapter.applySample(sample, extras?)` 收一個選填 `{punchPitchRad,punchYawRad,fovDeg}`,在組 quaternion **之前**先把 punch 角度加進 base yaw/pitch,維持與 live 逐位一致的組合公式;`ReplayEffectView` 專心做「這個 t 有沒有 fire/hit cue」,不碰 camera orientation。
- **D-50-P23 / ReplayEffectView 只做近似 cue,不重建精確 tracer/impact 幾何**：T0 discovery item 2 與 D-50-P6 已確認現有 export 沒有 world-space `shotRays`/impact 座標（`fire`/`hit` 事件只有 `viewYaw/viewPitch/aimPunchPitch/aimPunchYaw/spreadX/spreadY/targetId/part` 等,不含子彈起訖點）。若要重建精確彈道會需要重跑 `ballisticRaycast`/spread 取樣的整條 sim 路徑——這正是 FR-50.4／README T4 Steps #4 明確禁止的「以 current weapon physics 重新跑 live bullet simulation」。故 `ReplayEffectView` 只做誠實的近似 cue：hit marker 貼在比對到的 sampled target 位置(找不到就跳過,不猜座標)；fire marker 貼在 camera 前方固定偏移（沒有 muzzle world 座標可用,camera position/quaternion 是唯一決定性輸入）。視窗內同種事件多個(full-auto burst)時只顯示最後一個──marker 是「此刻有沒有在開火/命中」的 boolean cue,不逐發計數,duplicate shots 因此不需要特殊處理。
- **D-50-P24 / projectile 視覺維持零程式碼路徑（沿用 D-50-P6/D-50-P7，本次不重開 OQ）**：README T4 Steps #4「依 T0 決策支援或降級 projectile visual」的決策仍是 D-50-P6/D-50-P7 當時的結論——6 個 official Assessment exact drillId 全部是 hitscan 武器,profile registry（`replayCompatibility.ts`）從未把任何 projectile 武器的 drill 登記進 full/partial 矩陣,故 `ReplayTargetView`/`ReplayEffectView` 完全不需要判斷 `weapon.bullet`；未來若有 projectile drill 晉升 Assessment,需要重開一個新 OQ（比照 D-50-P6 的先例），不得由本 WP 事後靜默擴大範圍。

### Surprises & Discoveries（T4）

- **`fire` 事件既有的 `aimPunchPitch`/`aimPunchYaw` 欄位可直接當作 punch 重放的 ground-truth oracle,不需要額外 golden fixture**：`SimLoop.ts` 的 `fireOneShot` 在呼叫 `recoilOnFire`（施加本發 kick）**之前**就把 `state.recoilState.aimPunchPitchDeg/YawDeg` 寫進 `fire` 事件（`aimPunchPitch`/`aimPunchYaw`,見 T0 discovery item 2 原本就記載這兩個欄位存在,只是當時未被用於此目的）。這代表任何真實／合成的 `fire` 事件序列本身就內建了「這一發開火前的 punch 讀數」這個可稽核錨點——`tests/replay/replayRecoil.test.ts` 的第三個測試直接拿這個欄位驗證 `buildReplayPunchTimeline` 的重放結果,不需要另外跑一次完整 SimLoop pipeline 或準備獨立 golden JSON。
- **`SceneManager` 沒有把 `camera` 加進 `scene`,child-of-camera 的 marker 不會被渲染**：原本設計 fire marker 想直接掛成 `camera.add(mesh)`（跟隨 camera 最省事）,但 `SceneManager` 建構子從未 `scene.add(this.camera)`——`renderer.render(scene, camera)` 只走 `scene` 的子樹,camera 不在其中,camera 的 child mesh 因此永遠不會被 traverse 到。改為每幀用 `camera.position` + `camera.quaternion` 算出 world-space forward 偏移、直接寫 `scene` 底下獨立 mesh 的 position（`ReplayEffectView.sync` 的 `#forwardScratch`）,避免這個 three.js 常見陷阱。
- **`disposeScene`（`sceneLoader.ts`）本來就會清掉任何掛在 `scene.children` 下的 mesh,不限於 GLTF/room geometry**：一開始擔心 `ReplayTargetView`/`ReplayEffectView` 需要自己在 session `dispose()` 精確清乾淨,否則 T3 50-cycle 測試的「`scene.children.length===0`」不變量會被本次新增的 mesh 破壞。實測確認 `SceneManager.dispose()` 的 `for (const child of [...scene.children]) disposeScene(child)` 是**泛型**的（`disposeScene` 對任何 `Object3D` 都成立,不限定 GLTF group),本身就會連帶清掉 T4 新增的 target/effect mesh；`ReplayPresentationSession.dispose()` 仍呼叫 `targetView?.dispose()`/`effectView?.dispose()`（對稱、明確擁有權),但這只是保險,不是這個不變量成立的必要條件——`tests/replay/presentation-lifecycle.test.ts` 的既有 50-cycle 測試無需任何改動即全綠通過,證實了這點。

### Evidence Log（T4）

- Baseline（T4 開工前）：`git rev-parse HEAD` = `6c8c487` 之前的 T3 收尾 commit（見上方 T3 節）；每個切片前皆 `git status --short` 確認只有本切片新增/修改的檔案待 stage。
- 逐切片驗證：每個 commit 前皆執行 `npm run typecheck`（`tsc --noEmit` ×2）與相關子集 `npx vitest run`,全綠才 commit；最終切片（perf test）額外執行 `npm run build` 確認打包無誤。
- Recoil 重放正確性證據（`tests/replay/replayRecoil.test.ts`）：(a) 與獨立 tick-by-tick 參考重放（含同一 tick 內兩發 catch-up）逐 tick bit-exact 相等；(b) 單發 fire 情境下,timeline 在該發前一 tick 的 curr 值與該 `fire` 事件記錄的 `aimPunchPitch/Yaw`（production 慣例欄位）逐位相等；(c) `resolveReplayCameraVisualState` 對 ads-with-optics／ads-without-optics／hip 三種情境的 FOV／`adsActive` 選擇皆正確。
- Direct-seek-vs-sequential 證據（`tests/replay/replay-visual-seek-purity.test.ts`）：以真實 `sampleReplay()` 輸出驅動全新 view 實例,對窗內／窗外／目標已消失三種 `t` 各自比較「直接 seek」vs「從 0 逐 50ms 走到同一 t」,`toEqual` 逐位相等；backward seek 從 t=700（markers active）跳回 t=0 後兩個 marker 皆隱藏、且與「直接對 t=0 的全新 view」結果一致（無殘留）。
- Perf 證據（`tests/replay/replay-visual-perf.test.ts`，Node/V8 headless,數字僅供量級參考）：42,000-tick、worst-case churn fixture 下,`buildReplayPunchTimeline` 一次性成本 P95 ≈ **6.2ms**（遠低於借用的 NFR-50.1 250ms 量級）；合併每幀（sample+camera extras+applySample+target/effect sync）P95 ≈ **0.013ms**（NFR-50.4 4ms 門檻,餘裕 ~300×）；目標 mesh pool 全程維持 `poolSize===1`（fixture 全程恆有一個 active 目標,無逐 frame 無界增長）。
- T4 收工：`npm run build`（green,既有 1114.42 kB chunk-size 警告,屬既存狀態非本次引入）；`npm run typecheck` green；`npx vitest run` 全量 **183 test files / 1595 tests（1593 passed + 2 skipped，0 failed）**——與 T3 收工時的 178 files / 1564 tests 相比,新增 5 個 test file、31 個 test,無任何既有 test 被修改或刪除（除 `tests/replay/normalizeReplayRecording.test.ts`/`domain-purity-boundary.test.ts`/`ReplaySceneAdapter.test.ts` 各自新增少量斷言,見對應 commit）。
- Playwright（`npm run test:e2e`）：本次**未執行**——延續 T0～T3 的既有作法；T4 的 render-adapter 邏輯（mesh pool／effect window／camera composition）已在 vitest headless 用真實（非 fake）Three.js 物件圖驗證,真正需要瀏覽器 WebGPU context 的視覺驗收留給 T-exit。
- Open follow-up for T5：`ReplayEffectView`/`resolveReplayCameraVisualState` 已把 `adsActive` 算出來,但 ScopeOverlay（DOM UI）尚未接上——T5 建 Replay Screen/HUD 時,若需要開鏡疊加層視覺,直接讀 T4 產出的 `adsActive`（或等價的 sample-derived 值）即可,不需要在 T4 這層碰 DOM。

## T5 — Replay Screen／Transport／Timeline／HUD（2026-08-31）

單一垂直切片（兩個新檔案緊密耦合、component test 同時完成才有意義拆開驗證，不強行拆成多個小 commit）：

`feat(replay): add replay transport and HUD`——

1. `src/ui/replay/ReplayTransport.ts`——底部 transport bar（上一事件／播放-暫停／下一事件／current-duration／seek slider／0.25-0.5-1-2× rate segmented control）＋ seek track 上的事件 marker（`dataset.eventKind`）＋可捲動事件列表（FR-50.8：只收 `cue`/`visible`/`counter`/`fire`/`hit`，排除 `ads`/`target_stop`/`key` 這些逐 tick 輸入狀態而非「事件」）＋一個給 `ReplayScreen` 疊在 viewport 左上的 `hudElement`（keys/ADS/speed/timestamp）。純 DOM component：不擁有 clock、不碰 `ReplayPlayer`/Three.js；呼叫端每 app frame 呼叫一次 `update(sample, playbackState)`，所有顯示值都來自同一次呼叫傳入的 `ReplaySample`（README §2.9「同一 sample 更新」）——本檔完全不讀 live state 或另開一個取樣時鐘。`controls: ReplayTransportControls` 是 `ReplayPlayer` 的窄子集（`play/pause/seek/setRate/previousEvent/nextEvent`），一個完整 `ReplayPlayer` 可直接結構相容傳入，不需轉接層。
2. `src/ui/replay/ReplayScreen.ts`——全螢幕 shell：top bar（返回／來源識別文字／支援度 badge）＋ 16:9 viewport host（空 `<div>`，供 T6 掛載/resize 共用 renderer 的 canvas——本檔完全不 import Three.js/canvas/WebGPU）＋ 依 `render(state)` 的 `kind` 切換 loading／error／unsupported／ready 四個面板。`ready` 面板在 `support.status==='partial'` 時顯示持續性 warning banner（列出缺少的 capability 標籤與 reasonCode 對應訊息，非只靠顏色，D-50-P10）；`unsupported` 不渲染任何可播放 action，只列 reason 訊息 + 返回。Space 鍵播放/暫停快捷鍵在 `show()`/`hide()` 時掛載/移除（`window` 監聽），焦點不落在 button/input/select/textarea 上時才觸發；`visibilitychange` 隱藏分頁時呼叫 `controls.pause()`，恢復時**不**自動重播（README Assumption §1.4）。狀態切換時把焦點移入新面板的主要控制項（比照 `HistoryScreen` 既有的 focus-on-route-change 慣例）。

`npm run build` / `npm run typecheck` / `npx vitest run`（**184 test files（+2 skip）／ 1621 tests passed + 2 skipped，0 failed**——較 T4 收工時新增剛好 2 個 test file、28 個 test，無任何既有 test 被修改）全綠。

### Decision Log（T5）

- **D-50-P25 / 不用 `instanceof HTMLElement` 判斷 Space 快捷鍵的目標元素**：本 repo 的既有 UI component test 慣例（`ResultScreen.test.ts`／`Controls.test.ts`／`HistoricalRunDetail.test.ts` 等）一律用手刻 `FakeElement`/`FakeDocument` 對 `document`/`window` 做 `vi.stubGlobal`，因為 vitest 設定（`vite.config.ts` `test.include`，未設 `environment:'jsdom'`）預設跑在 Node、**沒有** `HTMLElement` 全域。若 `onKeyDown` 用 `event.target instanceof HTMLElement` 判斷是否落在表單控制項上，會在這個環境下對整個 repo 唯一一處引用不存在的全域，於瀏覽器可通過但在既有 headless component test 慣例下無法測。改為鴨子定型的 `isFormLikeTarget()`（只檢查 `target.tagName` 是否為 `BUTTON`/`INPUT`/`SELECT`/`TEXTAREA` 字串）——瀏覽器執行語意不變，但不需要真正的 `Element`/jsdom 就可測試，維持與其餘 UI 檔案一致的測試策略。
- **D-50-P26 / `render(state)` 在任何狀態轉換時都無條件重建 transport，不只在離開 `ready` 時才 dispose**：一開始只在 `state.kind !== 'ready'` 時呼叫 `teardownTransport()`，若呼叫端把 `render({kind:'ready',...})` 連續呼叫兩次（例如 support 判定從 `partial` 因為晚到的 scene metadata 升級成 `full`——這正是 T0 討論過的 OQ-50.4 情境的 UI 端反映），第二次會在不 dispose 前一個 transport 的情況下,把新的 `hudElement` 疊加 append 到 `viewportHost`,造成兩個 HUD 重疊顯示、且前一個 transport 的按鈕/監聽器永久留存（記憶體與 DOM 洩漏)。改為 `render()` 一律先 `teardownTransport()` 再依 `kind` 決定要不要重建——因為 `render()` 只在狀態轉換時被呼叫（不是熱路徑，`updateFrame()` 才是逐幀呼叫的路徑),重建成本可忽略。新增 regression test（`re-rendering ready...disposes the previous transport instead of leaking it`）鎖定這個修正,原本的天真版本會讓這個測試在 headless component test 層級直接失敗（`huds` 長度 2 而非 1）,不需要瀏覽器才能發現。
- **D-50-P27 / HUD（keys/ADS/speed/timestamp）標記 `aria-hidden="true"`，不做成即時 live region**：README NFR-50.7 要求「transport、event controls、speed 與返回可只用 keyboard 操作…slider 有 ARIA min/max/current text」，但沒有要求 60fps 更新的視覺化 HUD 本身要對螢幕報讀器即時朗讀（一個逐幀更新的 `aria-live` 區域對 AT 使用者是噪音,不是資訊)。已經有的「可及性等價物」是 seek slider 的 `aria-valuetext`（每幀更新一次「當下/總長」文字,但只在使用者主動與 slider 互動或查詢時才會被朗讀,不會主動打斷)——HUD 這層純視覺疊層因此標 `aria-hidden`,避免與 slider 的可及文字重複朗讀或互相干擾。

### Surprises & Discoveries（T5）

- **T5 是目前 WP-50 唯一一個「兩個新檔案在同一次 commit 落地」的 task**：T0～T4 全部依「小到可獨立驗證」拆成多個垂直切片各自 commit。T5 的 `ReplayTransport.ts`（純資料呈現元件）與 `ReplayScreen.ts`（消費前者、加上 shell/生命週期）只有兩者都存在時,才可能有一個可執行、可測試的「畫面」；先單獨 commit `ReplayTransport.ts`（沒有任何呼叫端）並不會留下一個可獨立驗證的中間狀態,反而是刻意在半成品上硬做兩次驗證。兩個檔案的 test 各自針對自己的公開 API（`ReplayTransportControls`／`ReplayScreenState`）行為隔離撰寫,不互相 mock 對方的內部細節,因此雖然是同一次 commit,測試本身仍然是獨立、垂直可讀的。
- **`document.activeElement`／`window.addEventListener`／`document.addEventListener`／`.focus()` 這類「螢幕生命週期」DOM API,在既有 headless test 慣例下完全不存在,必須在每個測試檔自己手刻**：T0～T4 的既有 UI test（`ResultScreen.test.ts` 等）從未用到 `window` 全域或 `visibilitychange`/`keydown` 監聽,因為它們都是「被動渲染 + click」的元件。T5 第一次需要 `vi.stubGlobal('window', ...)`（配合既有的 `vi.stubGlobal('document', ...)`）且 `FakeDocument`/`FakeWindow` 都要補上 `addEventListener`/`removeEventListener`/`dispatch` 三件套,才能測「Space 快捷鍵在 `hide()` 後失效」與「visibilitychange 觸發 pause 但不自動恢復」這兩條 README 明確要求的行為。這組手刻 harness 完全侷限在這兩個新測試檔內,未引入任何新的共用測試工具或 devDependency（例如 jsdom）。

### Evidence Log（T5）

- Baseline（T5 開工前）：`git rev-parse HEAD` 為 T4 收尾的 graphify sync commit（見上方 T4 節）；`git status --short` 僅有 `src/ui/replay/`（本次新增，未追蹤）待加入。
- 逐步驗證：實作過程中先以 `npx vitest run src/ui/replay/ReplayTransport.test.ts` 與 `.../ReplayScreen.test.ts` 個別跑通（含修正 D-50-P25/P26 兩個在撰寫 test 過程中發現的問題），才執行全量 `npm run typecheck`／`npx vitest run`／`npm run build` 三者皆綠。
- 全量證據：`npm run typecheck`（`tsc --noEmit` ×2）green；`npx vitest run` **184 test files / 1623 tests（1621 passed + 2 skipped，0 failed）**——較 T4 收工時的 183 files / 1595 tests（1593 passed + 2 skipped）新增 2 個 test file、28 個 test，無任何既有 test 被修改或刪除；`npm run build`（green，既有 1114.42 kB chunk-size 警告，屬既存狀態非本次引入）。
- Playwright（`npm run test:e2e`）：本次**未執行**——延續 T0～T4 既有作法。T5-replay-ui.md Step 6「以fake player/controller做component tests，再以實際scene做browser visual/manual acceptance」的後半段（1024×768 等常用 viewport 下的真實視覺驗收、markers 在 seek track 上的實際像素對齊、event list 響應式換行）**尚未執行**——這類純視覺/佈局檢驗不是 headless component test 能覆蓋的範圍，留給 T-exit（README 既有慣例：真正需要瀏覽器渲染的驗收集中在 T-exit 一次做）。
- Open follow-up for T-exit：上一條的瀏覽器視覺驗收待辦；另外 T6 尚未把 `viewportElement`/`updateFrame()`/`render()` 接上任何真正的 `ReplayController`/`ReplayPresentationSession`——T5 的兩個檔案目前只有 component test 驗證過其獨立公開 API 行為，尚未在一個端到端的真實 `ReplayPlayer` + `ReplayPresentationSession` 組合下跑過一次完整 render loop（那正是 T6 的整合範圍）。
