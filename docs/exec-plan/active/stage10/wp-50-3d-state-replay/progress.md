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
