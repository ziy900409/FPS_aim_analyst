# WP-27 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🚧 T0/T1/T2 ✅;T-exit 待執行(2026-08-03)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 hip muzzle tracer | ✅ |
| T2 ADS muzzle | ✅ |
| T-exit | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-MT-1 offset config 落點 | ✅ 採納時決議(GD-18) | `src/render/muzzleOffset.ts`,與 `WeaponConfig` 解耦(保 weapon config = 命中/彈道語意純淨)。`SimLoop` 的 import 為 render-only 常數的刻意單向引用,檔頭註記可稽核。per-weapon 槍口偏移待「第二把幾何差異顯著的武器」觸發再晉升 `WeaponConfig`。 |
| OQ-MT-2 **ADS 槍口相對準心的下方偏移量** | ✅ 2026-08-03 | `{rightU 0, upU −0.065, forwardU 0.60}`。Edge 40° ADS FOV,固定 forward 0.60;FHD/QHD 比較三候選後選定。FHD/QHD 距準心 161/214 px(畫面高 14.88%),世界 origin 分別由 camera y 寫為 `cameraY−0.065`。 |
| OQ-MT-3 capture-at-fire vs 顯示時重算 | ✅ 採納時決議(GD-18) | **capture-at-fire**。F-3 使其零額外成本:muzzle 由既有 `ballisticQ` 於開火 tick 算出,hitscan 直寫 ring、projectile 寫 `arena.m*`,顯示端不重算 → 開火後轉視角 tracer 不游移。 |
| OQ-MT-4 hip 偏移方向/量值 | ✅ 採納時決議(GD-18) | `{rightU 0.15, upU −0.12, forwardU 0.60}`(右 ≈14°、下 ≈11°)。**前向必須 ≫ 側向**——初版草稿的 `[0.18, −0.12, 0.10]` 會使 muzzle 落在光軸外 ≈63°(畫面外)。實機可微調,不改介面。 |
| OQ-MT-5 WP 編號與採納 | ✅ 採納時決議(GD-18) | **WP-27**,單 WP 資料夾 `active/muzzle-tracer/`,**無獨立里程碑**(exit gate 即交付判定)。stage4 草稿順延重編 **WP-28+ / M14+**。 |
| OQ-MT-6 hip↔ads 平滑內插 vs 階躍 | ✅ 採納時決議(GD-18) | **階躍**。tracer origin 是 capture-at-fire 的 sim 值,平滑內插必然是 render 幀狀態,兩者互斥;且與 GD-16「ADS gain 階躍」慣例一致。 |
| OQ-MT-7 tracer 縮尾方向(origin 端固定) | 🟡 新增,待 T-exit V-4 | `TracerView` 現行以 origin 為固定端縮短([TracerView.ts:148-163](../../../../src/render/TracerView.ts#L148-L163))。origin 從眼睛(看不見)移到槍口後,此行為**第一次真正可見**,可能讀作「線往槍口縮回」而非「子彈往前飛」。先維持現狀,T-exit 視覺驗收判定;不可接受則另開 task(本 WP out of scope)。 |

---

## Log

### 2026-08-03 — T2 ADS muzzle final PASS(OQ-MT-2 實測 + 視覺驗收)

- **量測環境**:系統 Edge(Playwright `channel:msedge`)、真 Vite dev render、ADS 垂直 FOV 40°;
  每案按 ADS 後等待 180ms(>120ms FOV transition),再注入無移動第一發。固定 `rightU:0`、
  `forwardU:0.60`,只比較可由 2D 影格唯一校準的 `upU`。
- **原始候選數據**:

  | `upU` | FHD 1920×1080 | QHD 2560×1440 | 畫面高比例 | 結論 |
  |---:|---:|---:|---:|---|
  | −0.055 | 136.00 px | 181.33 px | 12.59% | 略貼近準心 |
  | **−0.065** | **160.73 px** | **214.30 px** | **14.88%** | **採用:清楚位於下方且保留 scope 下緣餘裕** |
  | −0.080 | 197.82 px | 263.76 px | 18.32% | QHD 幾乎貼/越過 260px scope 下緣 |

- **世界座標交叉驗證**:選定案 FHD/QHD 的 live `shotRays` 皆逐位讀得
  `[0,1.5350000000000001,3.4]`(camera `[0,1.6,4]` + local `[0,−0.065,−0.6]`),各案 total=1;
  兩解析度 world origin 相同,像素比例一致。
- **視覺證據**:[FHD](t2-ads-balanced-fhd.png) / [QHD](t2-ads-balanced-qhd.png)。兩圖均由真實
  `heldAds` + production SimLoop 第一發產生;槍口端在準心正下方且留在 scope 圈內。
- **選定/回填**:`DEFAULT_MUZZLE_OFFSETS.ads = {rightU:0,upU:-0.065,forwardU:0.60}`;
  `muzzle-tracer-invariants` 的逐位期望同步為 camera `[2,3,4]` → muzzle `[2,2.935,3.4]`。
- **驗證**:量測探針 Edge **6/6** 候選案 + 最終清潔證據圖 **2/2** 通過;目標 Vitest
  `muzzleOffset` / `muzzle-tracer-invariants` / `projectile-determinism` **3 files / 19 tests** 通過。
  最終 `npm run test:ci` exit 0:TypeScript 0 errors、Vitest **81 files / 640 tests**、Playwright **18 passed**。
  首次完整 Playwright 曾有既有 `input-sampler` 等待 `__aimDebug` 5s 啟動逾時(17/18);單案重跑
  **1 passed(1.3s)**,隨後完整重跑 18/18,證實為並行啟動抖動而非產品失敗。
- **Graph freshness**:`graphify update .` 完成(AST 173/173),更新為 **1227 nodes / 2950 edges / 72 communities**。
- **Decision Log**:以 scope 下緣餘裕 + 跨解析度相同比例作客觀選值準則。
  **Alternatives Considered**:`−0.055` 雖保守但槍口感偏近準心;原佔位 `−0.080` 在 QHD 過低,皆不採。
- **Surprises & Discoveries**:Scope overlay 半徑由 CSS `min(34vmin,260px)` 封頂;因此 QHD 是辨別
  `−0.080` 過低的關鍵條件,只看 FHD 會低估此風險。
- **Open Questions**:OQ-MT-2 ✅ 關閉;T2 無剩餘 open question。

### 2026-08-03 — T2 ADS muzzle 自動化接線 PASS;DoD ⑥⑦待補

- **交付**:`SimLoop.fireOneShot` 的 hitscan/projectile 兩處 `computeMuzzleOrigin` 改讀開火 tick
  `state.heldAds`;`muzzleOffset.ts` 明記 hip/ADS 為 capture-at-fire 階躍,不引入 render-frame 內插狀態。
- **Blast radius**:CodeGraph 顯示 `computeMuzzleOrigin` production callers 侷限於 `SimLoop.ts` 產彈路徑;
  `spawnProjectile` / `fireOneShot` production caller 亦都在 `SimLoop.ts`,屬局部變更。data/metrics/TracerView 零改動。
- **先紅後綠**:新增 T2 斷言後先得到 2 failures(ADS 仍收到 hip `[2.15,2.88,3.4]`);
  接上 `state.heldAds` 後 `muzzle-tracer-invariants.test.ts` **8/8**、`muzzleOffset.test.ts` **4/4** 綠。
- **ADS 四項契約**:同條件 hip/ADS 起點逐位分離;hip→ADS→hip 只有兩個離散值;raycast 原點、
  projectile `x/y/z` + `o*`、fire/hit 事件逐位不變;ADS 跨 frame sequence tracer origin 逐位一致。
- **零破壞 / CI**:`npm run test:ci` sandbox 外 exit 0(TypeScript 0 errors;Vitest **81 files / 640 tests**;
  Playwright **18 passed**)。sandbox 內首次執行仍因既知 esbuild 權限限制無法讀 `vite.config.ts`,
  與 T0 證據一致;非產品失敗。相關回歸組另跑 **12 files / 114 tests passed**。
- **Export / data 邊界**:`projectile-determinism.test.ts` diff = **0 bytes**;`src/data` +
  `docs/operational/schema.md` diff = **0 bytes**;data 層查詢 `shotRays` / `arena.m*` = **zero matches**。
- **Graph freshness**:`graphify update .` 完成(AST 173/173),更新為 **1227 nodes / 2950 edges / 71 communities**。
- **Decision Log**:保留 GD-18 佔位 ADS offset `{rightU:0,upU:-0.08,forwardU:0.60}` 以先完成行為接線;
  未把佔位值冒充實測值,亦未提前勾 T2 完成。
  **Alternatives Considered**:等待實測值才寫任何 code 會延後與數值解耦的低風險接線;自行猜測新 offset
  則違反 OQ-MT-2 的量測契約,兩者皆不採。
- **Surprises & Discoveries**:無產品層意外;既有 `applyInput` 已完整維護 `heldAds`,T2 確認不需新接線。
- **Open Questions / blocker**:OQ-MT-2 仍未解;缺實測 offset 原始數據與 ADS 實機截圖,故 DoD ⑥⑦未滿足。
  依使用者明確要求,將目前自動化接線成果作為 checkpoint commit;T2 仍維持 🚧,亦未把 task-checklist 翻 ✅。

### 2026-08-03 — T1 hip muzzle tracer PASS

- **交付**:`src/render/muzzleOffset.ts` 新增 allocation-free `computeMuzzleOrigin` 與 hip/ADS 常數;
  `BulletArena` 以預配置 `Float64Array(BULLET_CAP)` 新增 `mx/my/mz`;`SimLoop` hitscan/projectile
  capture-at-fire 後只把 muzzle 寫入 tracer 路徑。`arena.x/y/z`、`arena.ox/oy/oz`、raycast 與
  `pushImpact` 保持命中/彈道權威。
- **Blast radius / structural review**:CodeGraph 顯示 `spawnProjectile` / `advanceProjectiles` 的 production caller
  皆侷限於 `SimLoop.ts`;`BulletArena` 為跨 `SharedState` factory + SimLoop 的 additive change。
  Post-edit 查核確認 `computeMuzzleOrigin` 只由 SimLoop 產彈路徑與其單元測試消費。
- **新增測試**:
  - `src/render/muzzleOffset.test.ts` **4 passed**:THREE `−Z` forward、yaw 90°、pitch ±45°、逐位決定性 + 回傳 caller `out`;
  - `tests/regression/muzzle-tracer-invariants.test.ts` **5 passed**:hitscan raycast origin probe、projectile
    `x/o*` 權威、獨立 `m*`、hitscan/projectile tracer 同源、capture-at-fire、跨 frame sequence 逐位一致。
- **F-5 唯一既有斷言變更**:[SimLoop.test.ts](../../../../src/loop/SimLoop.test.ts) 的 tracer origin
  從 `[0,1.5,5]` 改為顯式逐位 `[0.15,1.38,4.4]`;仍使用 `toEqual`,未放寬精度。其餘既有案零修改。
- **零破壞 / CI**:`npm run test:ci` exit 0(2026-08-03):`tsc --noEmit` 0 errors;
  Vitest **81 files / 637 tests passed**(T0 79/628 + 新增 2 files/9 tests);Playwright **18 passed**。
  `projectile-determinism.test.ts`、`TracerView.test.ts`、SharedState、命中/彈孔/fire/BR regression 全部零修改綠。
- **Export / data 邊界**:`git diff -- src/data docs/operational/schema.md` = **0 changed files**;
  `projectile-determinism.test.ts` diff = **0 bytes**;`rg -n 'shotRays|arena.(mx|my|mz)|bullets.(mx|my|mz)' src/data`
  = **zero matches**。schema/export/metrics 不變。
- **GC 紀律**:`muzzleScratch` 是 SimLoop 模組層單一 `Vector3`;`computeMuzzleOrigin` 只改 caller `out`;
  `mx/my/mz` 只在 arena 建立時配置。開火函式內無 `new Vector3/Quaternion`。
- **視覺證據**:[t1-hip-muzzle-tracer.png](t1-hip-muzzle-tracer.png) 由本機 Edge + production SimLoop
  真實 fire 事件產生;ring origin 先逐位斷言為 `[0.15,1.48,3.4]`,畫面可見 cyan tracer 連接準心與
  右下 hip muzzle。暫時 Playwright probe 已刪除,未進正式測試。
- **Graph freshness**:`graphify update .` 完成(AST 173/173),更新為 **1227 nodes / 2948 edges / 72 communities**。
- **Decision Log**:T1 對 `computeMuzzleOrigin` 的 `ads` 固定傳 `false`,不提前接 T2 分支;
  projectile 另存 `m*` 而保留 `o*` 作物理距離基準。
  **Alternatives Considered**:覆寫 `arena.o*` 會污染 maxRange/落地;從 camera quaternion 重算會污染跨 FPS 決定性;
  提前讀 `heldAds` 會混合 T1/T2 切片,三者皆不採。
- **Surprises & Discoveries**:純函式 pitch 測試的 quaternion 結果與 `Math.SQRT1_2` 相差 1 ULP,
  改以 15 位精度驗旋轉(不影響被要求逐位的 SimLoop/invariant 斷言)。前兩次人工 ring 注入截圖錯過
  tracer lifetime;改以真實 fire event 並先 poll ring 後成功取得證據,production 無需改動。
- **Open Questions**:無新增。OQ-MT-2 仍為唯一待決項;T2 code 可用佔位值接線,但實機數值未回填前
  T2 DoD ⑥ 不可完成。
- **T1 宣告**:**PASS**。T1 已完成且可獨立回滾;依規則未取得 OQ-MT-2 實測值前不宣告 T2 完成。

### 2026-08-03 — T0 entry gate PASS

- **前置相依(C-0)**:[BUGFIX-DECISIONS.md:21/36-46](../../../known_issue/BUGFIX-DECISIONS.md#L36)
  明記 **BD-002 / KI-002 D1+D2 ✅(2026-07-15)**;[br-field.ts:24-26](../../../../src/scene/scenes/br-field.ts#L24)
  以 `eyeZ:0` 把 camera(射線/彈道原點)錨在 sim origin。T1 的 muzzle 偏移基準已成立。
- **乾淨基線**:`npm run test:ci` exit 0(2026-08-03 12:41Z):`tsc --noEmit` 0 errors;
  Vitest **79 files / 628 tests passed**;Playwright **18 passed**。此數字作為 T1/T2 零破壞比較基準。
- **F-2 — `arena.o*` 雙重角色**:
  - [SimLoop.ts:234-236](../../../../src/loop/SimLoop.ts#L234) 於 spawn 時把 `ballisticOrigin` 寫入 `arena.ox/oy/oz`;
  - [SimLoop.ts:324](../../../../src/loop/SimLoop.ts#L324) 與
    [SimLoop.ts:353](../../../../src/loop/SimLoop.ts#L353) 又把同欄作 projectile tracer origin;
  - [SimLoop.ts:339-343](../../../../src/loop/SimLoop.ts#L339) 同時以該欄計算 `maxRangeU`/落地前的距離進度。
  結論:C-1b 必須另立 `mx/my/mz`;T1 不得改 `arena.o*`。
- **F-3 — 決定性旋轉來源**:[SimLoop.ts:119-145](../../../../src/loop/SimLoop.ts#L119) 以
  `state.aim + rawPunch×2` 合成模組層 `ballisticQ`,再由 camera 只讀 world position;
  [CameraController.ts:102-109](../../../../src/view/CameraController.ts#L102) 及
  [CameraController.ts:179-190](../../../../src/view/CameraController.ts#L179) 則證實 camera quaternion 由 render 幀
  的 view-punch + aim 重組。結論:muzzle 只能複用 `ballisticQ`,不得讀 `camera.getWorldQuaternion()`。
- **F-5 — T1 零破壞測試帳本**:
  - 唯一允許修改的既有斷言:[SimLoop.test.ts:432](../../../../src/loop/SimLoop.test.ts#L432),目前顯式期望
    tracer origin `=== [0, 1.5, 5]`;T1 必須改成 `camPos + R·hipOffset` 的逐位顯式期望,不得放寬精度。
  - **零修改全綠**:`tests/regression/projectile-determinism.test.ts`、`src/loop/SimLoop.test.ts` 其餘案、
    `src/state/SharedState.test.ts`、`src/render/TracerView.test.ts`、
    `tests/regression/br-camera-anchor-invariants.test.ts`、`tests/regression/br-tracking-invariants.test.ts`、
    `src/loop/__tests__/fire-determinism.test.ts`、`src/loop/__tests__/ballistic-compose.test.ts`、
    `src/ballistics/bullet.test.ts`、`src/ballistics/sweptHit.test.ts`、`src/render/ImpactView.test.ts`、
    `src/data/DataRecorder.test.ts`。基線全數包含於上述 628 tests 且已綠。
- **C-2 export 邊界**:`rg -n 'shotRays' src/data` exit 1 / **zero matches**;T1 後須以相同查詢複核
  `shotRays` 與新增 `arena.m*` 都未進 data 層。
- **CLAUDE.md §4**:已在 WP-25 render-only tracer 約束後補上 WP-27 分離原點紅線:muzzle 只可寫
  `shotRays` / `BulletArena.m*`,不得進 raycast、`arena.o*` 或 `pushImpact`。
- **OQ-MT-2**:Owner 維持「研究者/使用者」,deadline **T2 前**;量測法已登記於上方 ledger:
  實機影格像素位置 → 依 FOV/解析度換算視角度 → 反推 world offset。T1 不受阻塞。
- **Decision Log**:工作分支先從 `main` 建立,再 fast-forward 納入 `aa` 的 WP-26/KI-002/WP-27 完整前置歷史。
  **Alternatives Considered**:只 cherry-pick WP-27 計畫提交會遺漏 BD-002 與 `br-field` 且產生文件歸檔衝突;
  手工拼接文件會使 T0 宣稱的上游證據不存在,故不採。
- **Surprises & Discoveries**:sandbox 內第一次 `npm run test:ci` 於 Vitest 啟動時因 esbuild 無權讀
  `vite.config.ts` 失敗(`Access is denied`);相同指令於核准的 sandbox 外 exit 0,證實為環境限制而非產品/測試失敗。
- **Open Questions**:無新增。OQ-MT-2 仍為唯一待決項,不阻塞 T1。
- **Entry-gate 宣告**:**PASS**。`src/` 零變更;T1 可開工。

### 2026-08-03 — 採納 + 計畫展開(GD-18)

- **採納決定**(使用者):初版草稿 → 正式 **WP-27**,四個 task 子檔展開,入 [exec-plan/README.md](../../README.md) §2 索引;
  OQ-MT-1/3/4/6 四項設計問題一次拍板(見上方 ledger),入帳 [DECISIONS.md](../../DECISIONS.md) **GD-18**。
- **規劃期讀碼核實(五項,改寫了契約與 task 拆解)**——詳見 [README.md §0](README.md):
  - **F-1**:C-0 前置 **KI-002 D1 已落地**(BD-002,2026-07-15),`br-field` 設 `eyeZ:0` → 偏移基準已正確。
    初版草稿列為阻塞相依的項目**已解**,T0 降為基線核對。
  - **F-2 ⚠️ 最重要**:`arena.ox/oy/oz` 是**雙重角色**——既是 projectile tracer origin([SimLoop.ts:324](../../../../src/loop/SimLoop.ts#L324)/[:353](../../../../src/loop/SimLoop.ts#L353)),
    **也是** `maxRangeU` 與落地判定的距離基準([:339-343](../../../../src/loop/SimLoop.ts#L339-L343))。
    初版草稿「三個 `pushShotRay` 點都改用 muzzleOrigin」會**改變子彈存活長度與命中數** → 違反 C-1。
    修正:新增 `BulletArena.mx/my/mz` 三欄僅供 tracer 消費(契約 **C-1b**)。
  - **F-3**:初版 C-4 的 `camera.getWorldQuaternion()` 會讓 sim 讀 render 幀狀態(camera 朝向由
    `CameraController` 每幀寫入,含內插 punch)→ **破壞跨 FPS 決定性**。既有 `ballisticRaycast` 刻意
    只用 `state.aim + rawPunch×2` 合成 `ballisticQ`([:127-133](../../../../src/loop/SimLoop.ts#L127-L133))。
    修正:muzzle 旋轉複用同一 `ballisticQ`——零額外計算、與彈道方向同源、capture-at-fire 天然成立。
  - **F-4**:初版 hip 初值 `[0.18, −0.12, 0.10]` 前向分量最小 → muzzle 落在光軸外 ≈63°(畫面外);
    且「前 = +z」與 THREE(前 = **−Z**)相反。修正見 OQ-MT-4 + 契約 **C-6**(符號慣例明文釘死)。
  - **F-5**:[SimLoop.test.ts:432](../../../../src/loop/SimLoop.test.ts#L432) 硬斷言 tracer origin `== [0,1.5,5]`
    → T1 **唯一允許修改**的既有斷言(預期變更,須改為顯式期望值而非放寬)。
    [projectile-determinism.test.ts](../../../../tests/regression/projectile-determinism.test.ts) 的 `tracers` 是
    run-vs-run 跨 FPS 比較、**非**存檔 golden → 應零修改全綠,直接充當 C-4 決定性證據。
- **範圍確認**:`TracerView` / `Controls` / `src/data/` / `src/metrics/` **零改動**;不新增匯出欄位(FR-MT5)。
- **帶著走的決定**:本 WP 的唯一嚴重風險是「muzzle 誤入命中權威」,且 F-2 讓它比初版估計更易誤觸
  (`arena.o*` 看起來像純 tracer 欄位)。緩解沿用 BD-002 已驗證的手法——**新增專屬回歸檔封測試盲區**
  (`tests/regression/muzzle-tracer-invariants.test.ts`),而非只靠既有測試。
- **Surprises**:初版草稿的三項技術假設(相依未解 / 三點同源 / camera quat 取旋轉)皆與實況不符,
  但三項都在讀碼階段被攔下、未進入實作。這佐證「entry-gate 讀碼證據」的價值 —— T0 保留此步驟。
