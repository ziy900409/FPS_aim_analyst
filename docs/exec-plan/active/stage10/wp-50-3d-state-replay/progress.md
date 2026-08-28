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
