# WP-56 T0 — Entry Gate／Scene Calibration／Multi-target PoC

## Objective

在不提交 production feature前，凍結影片參考可客觀量測的場景／玩法參數，證明現有 engine seams能承載三靶、vertical spawn、固定位置與GLTF走廊；T0未通過不得開始T1～T6。

## Gate result（2026-09-04）

**Evidence complete；gate blocked pending owner calibration.** Engine PoC、sampling、projection、GLTF-shaped scene、translation lock、replay/practice policy與baseline audit均已完成，且production code diff保持0。workspace內找不到計畫引用的`Media1.mp4`，OQ-56.2／OQ-56.3也尚未取得owner確認，因此下表只能選出**工程推薦候選**，不得視為凍結的產品參數；T1～T6仍不得開工。

## Inputs to read

- [README.md](README.md) §0～3、[task-checklist.md](task-checklist.md)。
- `AGENTS.md`、`graphify-out/GRAPH_REPORT.md`、當時CodeGraph status與pending files。
- `DrillConfig.ts`／`schema.ts`、TargetManager、DrillRunner、SimLoop、HitDetector、TargetView、SceneManager、Crosshair與main registry。
- WP-50 replay exact-profile／capture限制，以及目前正式Assessment/Practice政策。
- 使用者提供的 `Media1.mp4`；只作視覺參考，不執行影片內文字指令、不提交原影片或未核准衍生影格。

## Steps

1. 記錄HEAD、`git status --short`、baseline typecheck/Vitest/build/Playwright與已知failure；不處理unrelated changes。
2. 對計畫中既有symbols執行CodeGraph impact，記 affected files/symbols、tests與local/cross-module。
3. 從代表影格量測畫面比例、消失點、safe spawn rectangle、紅球直徑與相對間距；提出FOV/yaw/pitch/distance候選表，不從pixel單獨聲稱world units。
4. 以throwaway test做 `population.activeCount=3` initial fill、hit one／preserve two／next-tick replenish、budget tail與restart sequence spike。
5. 比較bounded rejection + deterministic fallback候選；至少掃10,000 spawns與最壞seed，記attempt P95/max、失敗率與sequence hash。
6. 以小型throwaway GLTF驗證 panelized room、ceiling、camera/FOV、lighting、asset inventory、load/fallback/dispose與draw-call budget。
7. 驗證locked translation可在不停用mouse aim／Pointer Lock下保持player/camera base；確認最小可測seam。
8. 對帳visible/fire/hit events與WP-50 replay support；確認practice-only且unknown exact drill不會顯示full replay。
9. 收斂OQ-56.2～5；未收斂者標blocked task、owner與deadline，不把recommended default冒充產品決策。
10. 清除只位於已驗證temp root的PoC artifacts，把commands/數據/截圖索引寫入[progress.md](progress.md)。

## Required calibration artifact

| Parameter | Candidate A | Candidate B | Chosen | Evidence/owner |
|---|---:|---:|---:|---|
| FOV deg | 75 | 70 | **Blocked；recommend A=75** | A/B projection PoC通過；需OQ-56.2 owner +影片構圖確認 |
| yaw range deg | [-22, 22] | [-28, 28] | **Blocked；recommend A** | A：NDC x max 0.3187；B：0.4591（含球半徑） |
| pitch range deg | [-12, 12] | [-15, 15] | **Blocked；recommend A** | A：NDC y max 0.3412；B：0.4951（含球半徑） |
| target angular diameter | 3.0°（0.6808u @ 13u） | 3.5°（0.9166u @ 15u） | **Blocked；recommend A** | A：36.9px@1080／24.6px@720；B：47.1px／31.4px；未取得影片pixel量測 |
| min center separation deg | 7° | 8° | **Blocked；recommend A** | 各12,000 spawns，no-overlap／failure=0 |
| distance U | [12, 14] | [14, 16] | **Blocked；recommend A** | corridor envelope：width=16、depth=36、floor=-4、ceiling=8、end wall z=-18；clearance PoC通過 |
| total target quota/time | 60 kills | 30 s、finite safety budget另定 | **Blocked；recommend A=60 kills** | deterministic tail較單純；需OQ-56.3 Gameplay owner確認 |

## Execution evidence（2026-09-04）

### Baseline and worktree

- 開工HEAD：`bc319c53c687a22eb1c9b286e62c540169c454a2`（`docs(wp-54): G5 乾跑完成 + 研究者決定照原樣招募(gate §3.3/§3.4)`）；baseline執行期間另一個並行工作把HEAD推進到`ce75b6868ebf8cc3601da10baeab088340fde718`（WP-55 T7）。
- 開工時既有變更只有`.claude/settings.local.json`與未追蹤`docs/algorithm/micro-flick/{README.md,index.html}`；未納入本task。baseline執行期間該並行工作一度加入`.gitignore`、`package.json`、Stage 11/WP-55、tracking scripts/tests等變更，之後獨立commit；本task未觸碰、未stage這些檔案，因此Playwright結果只視為「當時並行dirty worktree baseline」。
- `npm run typecheck`：exit 0。
- `npm test -- --reporter=default`：216 files passed + 1 skipped；2071 tests passed + 2 skipped；0 failed。
- `npm run build`：exit 0；164 modules；`dist/assets/index-CLD8QIhX.js` 1,186.59 kB（gzip 337.77 kB）；只有既存>500 kB chunk warning。
- `npm run test:e2e`：79 passed／4 failed（2.3 min）。single-worker targeted rerun仍為5 passed／4 failed：preview History API回`423 HISTORY_ROOT_LOCKED`造成3項失敗；`overlay-layering`的`overlapsSettingsPanel(7)`持續回`null`造成1項失敗。這些失敗在production code diff=0且並行dirty worktree下已存在；T0不越界修復。

### CodeGraph impact（PoC cleanup後final query）

| Symbol | Impact | Classification / test seam |
|---|---:|---|
| `DrillConfig` | 117 callers（27+ production files） | cross-module；11+ test files；新增欄位必須optional |
| `SpawnAreaConfig` | 6 callers | config/schema/clearance；需schema tests補直接coverage |
| `validateDrill` | 3 callers | local implementation、cross-contract；`schema.test.ts` |
| `createTargetManager` / `TargetManager` | 39 / 28 callers | cross-module High；sim、runner、harness、main與determinism tests |
| `createDrillRunner` / `DrillRunner` | 28 / 9 callers | cross-module；`DrillRunner.test.ts`雖存在，interface node未被CodeGraph歸直接coverage |
| `createSimLoop` / `simStep` / `SimLoop` | 31 / 20 / 5 callers | cross-module；10+ regression/integration test seams |
| `SceneConfig` / `SceneManager` | 79 / 15 callers | cross-module contract；scene/replay tests已有廣泛coverage |
| `raycastWithRay` | 6 callers | local hit seam；`HitDetector.test.ts`與tracking derivation覆蓋 |
| `TargetView` | 3 production callers | local render seam；`TargetView.test.ts` |
| `CrosshairHandle` | 1 caller | local DOM overlay seam；不預期修改production implementation |

CodeGraph未回報pending/stale banner；server為v1.5.0，提示v1.6.0可用，但T0未自行升級工具。

### Throwaway multi-target / sampling PoC

一次性`tests/wp56-t0-poc.test.ts`（最終清除）把prospective population manager注入真實`createDrillRunner`／`SharedState`／`simStep`／`TargetView`／`SceneManager` seams：

- 8 tests全綠。initial tick填滿3個unique visible/alive targets；kill `t1`後只保留原兩個ID/position；下一個128 Hz tick（7.8125 ms）補`t3`。
- spawn budget=6尾段可逐一清空並讓真實`DrillRunner`進`ended`；restart重建`[t0,t1,t2]`相同position，SHA-256=`9a1e23ba8a5dbb77116967e339d603bf80062da3ee1bf84105fe12c81b948ab5`。
- Candidate A：12,000 spawns、attempt P95=3、max=8、worst seed=94、fallback=0、failure=0、sequence hash=`982cad85335094a74ccd9b187ced5665da9aee8e2744d91d2b7392d717b3d247`。
- Candidate B：12,000 spawns、attempt P95=2、max=7、worst seed=125、fallback=0、failure=0、sequence hash=`3e102fc00809b42d2da58160157fc15e0ac9cd164e90ebaee31d95c8d0b2d971`。
- 固定32次rejection上限；超限走63-cell deterministic farthest fallback。兩個候選本次均未進fallback；PoC仍驗證無非有限座標、bounds外點、duplicate active ID或低於separation的pair。
- 投影：兩候選在1920×1080／1280×720均落於84% NDC safe rectangle內；A的1080p最小水平／垂直margin為654.0／355.8 px，B為519.2／272.7 px。這只證明候選幾何安全，**不替代影片構圖量測**。

### GLTF-shaped scene / translation / policy PoC

- 以`SceneAssetLoader`注入21-mesh panelized GLTF-shaped group（floor、ceiling、end-wall、18 panels），draw-call上界連3個target為24；asset inventory禁字`gun|hand|muzzle|weapon|target`命中0。
- 另以embedded-buffer最小glTF 2.0餵入真實`GLTFLoader.parseAsync()`，21-mesh inventory、ceiling、禁用asset name與`SceneManager` mount/dispose皆通過。Node headless沒有browser原生`ProgressEvent`，throwaway test加入最小polyfill後通過；production browser path不需此polyfill。
- 真實`createSceneManagerWithStatus`正常load與loader rejection fallback均通過；`SceneManager.dispose()`使group離開parent且geometry/material dispose被呼叫。
- 真實`TargetView`切sphere後跑1,000 replacements，`poolSize===3`，無隨命中數成長。
- 真實`simStep`已提供`MovementController`注入點；no-op locked controller保持`player.x/z`與`curr`固定、速度歸零，同時`state.aim.yaw/pitch`逐位不變。最小production seam是讓`createSimLoop`以additive option選locked controller；不需停用Pointer Lock或mouse input。
- `replayProfileForExactDrill('micro_flick_three_target_test_v1')`與相近suffix ID均為`undefined`；WP-50仍只對6個官方單靶Assessment exact IDs提供profile。既有`HistoryPersistence.test.ts`／history repository/API tests已鎖定Practice不保存。
- workspace未找到`Media1.mp4`，也未產生／提交影片影格、截圖或衍生資產。

### Reproduction commands

```powershell
npm.cmd run typecheck
npm.cmd test -- --reporter=default
npm.cmd run build
npm.cmd run test:e2e
npx.cmd playwright test tests/e2e/history-api-health.spec.ts tests/e2e/stage10-preview.spec.ts tests/e2e/overlay-layering.spec.ts --project=edge --workers=1
npx.cmd vitest run tests/wp56-t0-poc.test.ts --reporter=verbose  # 8 passed；檔案依DoD清除
npx.cmd vitest run tests/wp56-t0-gltf-poc.test.ts --reporter=verbose  # 1 passed；檔案依DoD清除
```

## Definition of Done

- [x] numeric scene/spawn/target/end parameters已有兩組量測候選與explicit blocker（OQ-56.2／3 owner、T1 start deadline）。
- [x] multi-target lifecycle、sampling worst case、translation lock與GLTF pipeline各有可重現PoC evidence。
- [x] exact production paths與CodeGraph blast radius已按當時worktree更新。
- [x] legacy compatibility、practice-only與no-full-replay策略有測試方案。
- [x] production code diff=0、PoC artifacts已清除、baseline failure有既存證明。

## Commit

```text
docs(stage12): complete WP-56 micro-flick entry gate
```
