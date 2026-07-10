# WP-23 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T2 PASS(2026-07-10);T3 ready

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 hitbox config 化 | ✅ |
| T2 遠距 drill config | ✅ |
| T3 round-trip + 決定性 | ⬜ |
| T-exit(M11) | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S5-4 遠距 drill 設計矩陣(角尺寸/角速度/距離/hitbox;角尺寸下限) | ✅ T0 決議 | 小目標 H1 = `{ widthU:0.5, heightU:1, depthU:0.5 }`;角高階層 0.5° / 2.0°;角速度階層 5°/s / 20°/s;角尺寸下限 0.5°。距離 `d = h/(2*tan(theta/2))`:0.5°→114.59u,2.0°→28.65u。水平速度 `v = d * omegaRad`:0.5°×5→10.00u/s,0.5°×20→40.00u/s,2°×5→2.50u/s,2°×20→10.00u/s。T2 canonical default = 0.5° × 5°/s,hard profile = 0.5° × 20°/s,近距 sanity = 2° × 5°/s。 |
| OQ-23.1 hitbox 單一來源落點(型別/常數宣告在哪一檔) | ✅ T0 決議 | `src/drill/DrillConfig.ts` 擴 `targets.hitbox?: { widthU;heightU;depthU }` 並宣告唯一預設常數 `{1,2,1}`;loader/schema resolve 後交給 `TargetManager` 寫入 `TargetState.hitbox`。sim/render 讀 `TargetState.hitbox`;clearance 讀 resolved `DrillConfig`;離線推導優先讀 `meta.targets.hitbox`,缺欄 fallback 預設常數。 |
| OQ-23.2 遠距 drill 的 display scale 與場景尺度(`field-low` 是否直接可用) | ✅ T2 決議 | `field-low` 正面遠距走廊不可直接用:0.5° canonical distance 114.59u 與 2° sanity distance 28.65u 的 forward sightline 皆被 z≈-8 backdrop props 擋住。T2 先用同一 `field-low` 的右後方 clear long lane(`spawnArea.yawDegRange=[110,110]`,radial distance 114.59u)保留角尺寸/角速度契約並通過 clearance;WP-26 仍需補 front-facing BR field/long corridor。display scale 不改 sim 單位,沿用 `field-low.asset.displayScale=1`。 |

---

## Log

### 2026-07-10 — T2 tracking_longrange_v1 遠距小目標 drill PASS

- **Implementation**:`src/drill/tracking_longrange_v1.ts` 新增 `tracking_longrange_v1` scene-drill config,掛 `sceneId:'field-low'`。config 以小 hitbox `{widthU:0.5,heightU:1,depthU:0.5}` + canonical 角參數 0.5° × 5°/s 反推 `distance=114.59083180471995u`,`speed=9.999936537956994u/s`,`range=4.999968268978497u`(2000ms pingpong 完整週期)。
- **Angular audit note**:config 註記完整列出 T0 OQ-S5-4 四檔矩陣:0.5°/2.0° × 5/20°/s 的 distance/speed/2s range,供研究者對帳。
- **Clearance decision**:`field-low` forward lane 會被 backdrop props 擋住(正面 114.59u 與 28.65u 皆不通);T2 固定 `spawnArea` 到右後方 clear long lane `yaw=110°`,radial distance 保持 114.59u,不修改 sim/data 層或場景 propBounds。此為 T2 可上線折衷;WP-26 需補 front-facing BR field。
- **UI / harness exposure**:`src/main.ts` 將 `tracking_longrange_v1` 加入 `availableDrills`,切換時會自動載入 `field-low`;dev `__fpsTest` 由同一清單暴露新 drill。
- **Tests**:`src/drill/tracking_longrange_v1.test.ts` 覆蓋角參數反推、固定 field-low spawn lane、resolved hitbox meta shape、`validateClearance(fieldLow,cfg)` 零違規與 `loadDrill(...,fieldLow)` 不 throw。
- **Verification**:
  - Targeted Vitest:`npx.cmd vitest run src/drill/tracking_longrange_v1.test.ts src/drill/schema.test.ts src/scene/clearance.test.ts src/testharness/fpsTestHarness.test.ts` exit 0 (**4 files / 49 tests**).
  - Typecheck:`npm.cmd run typecheck` exit 0。
  - Full Vitest:`npx.cmd vitest run` exit 0 (**66 files / 518 tests**).
  - Browser smoke:`npx.cmd playwright test tests/e2e/full-drill.spec.ts -g "tracking_longrange" --project=edge` unsandboxed exit 0 (**1 test**).Sandboxed first run failed because Vite/esbuild could not resolve `vite.config.ts` due parent-directory access denial;unsandboxed rerun passed. Smoke verifies true browser/dev harness can load `tracking_longrange_v1`, export `field-low` scene meta, small hitbox meta, fixed longrange spawn lane, and moving target samples.
  - `graphify update .` exit 0;graphify rebuilt **1068 nodes / 2502 edges / 63 communities**.

### 2026-07-10 — T1 hitbox config 化 PASS

- **Implementation**:`src/drill/DrillConfig.ts` 新增 `targets.hitbox?: { widthU;heightU;depthU }`、唯一預設 `DEFAULT_TARGET_HITBOX = { width:1,height:2,depth:1 }`、resolved/config 轉換 helper;`schema.ts` 驗證正有限與 sanity 上限 `MAX_TARGET_HITBOX_U = 10`。
- **Single-source runtime path**:`TargetManager` spawn 改由 `resolveTargetHitbox(config)` 寫入 `TargetState.hitbox`;`HitDetector` / `TargetView` 維持讀 `TargetState.hitbox`;`clearance` 的 target envelope 與 prop inflation 改 per-drill hitbox 派生。
- **Export / offline derivation**:`collectMeta` 接受 `meta.targets.hitbox`;production `main.ts` 與 `fpsTestHarness` 匯出 resolved hitbox snapshot;`trackingDerivation` 優先讀 `payload.meta.targets.hitbox`,舊匯出 fallback `DEFAULT_TARGET_HITBOX` / legacy options。
- **同幾何 fixture**:`src/metrics/trackingDerivation.test.ts` 新增邊緣 aim fixture:小 hitbox `{0.5,1,0.5}` 下 inside/outside 斷言 `raycastWithRay` sim hit 與 offline on-target 同真同假;並驗證 meta hitbox 優先於 options。
- **小 hitbox smoke**:`TargetManager.test.ts`、`clearance.test.ts` 覆蓋 `{0.5,1,0.5}` 的 spawn state、envelope、prop inflation;`metadata.test.ts` 覆蓋 meta snapshot 驗證。
- **Schema/docs**:`docs/operational/schema.md` 新增 `meta.targets.hitbox`;`analysis-tracking.md` 更新為新匯出讀 meta、舊匯出 fallback 預設 H1。
- **Verification**:
  - `npm.cmd run typecheck` exit 0。
  - Targeted Vitest:`npx.cmd vitest run src/drill/schema.test.ts src/sim/TargetManager.test.ts src/scene/clearance.test.ts src/data/metadata.test.ts src/metrics/trackingDerivation.test.ts src/testharness/fpsTestHarness.test.ts` exit 0 (**6 files / 107 tests**).
  - Full Vitest:`npx.cmd vitest run` exit 0 (**65 files / 514 tests**).
  - Full CI:`npm.cmd run test:ci` sandbox run hit Vitest config parent-path permission denial;unsandboxed rerun exit 0 (**tsc clean;65 Vitest files / 514 tests;Playwright 14 tests**).
  - `graphify update .` exit 0;graphify rebuilt **1064 nodes / 2488 edges / 63 communities**.
- **Decision**:保留 runtime `TargetState.hitbox` 的 `{width,height,depth}` 形狀,只在 config/meta 邊界使用 `{widthU,heightU,depthU}`。理由:sim/render/hit detector 已以 runtime shape 同源消費,此做法把 T1 風險集中在 loader/metadata/clearance/derivation 邊界,避免無必要改動熱路徑與既有測試 fixtures。

### 2026-07-10 — T0 entry gate PASS

- **Baseline verification**:`npm.cmd run test:ci` exit 0(unsandboxed rerun;PowerShell `npm.ps1` 受 execution policy 擋,沙盒 Vitest config 解析受 parent path 權限擋)。結果:`tsc --noEmit` clean;Vitest **65 files / 505 tests**;Playwright **14 tests**。
- **Upstream gates verified**:
  - WP-18 T-exit ✅ PASS(2026-07-09):motion 驅動、FR-B17 sub-tick hit interpolation、timed presentation、tracking metrics、moving-target determinism 已交付。
  - WP-22 T-exit / M10 ✅ PASS(2026-07-10):stage3 perception integration 交付;`test:ci` clean;兩個感知實驗 pilot-ready。
- **Current hitbox consumer baseline**(T1 零破壞參照):
  - `src/sim/TargetManager.ts`:local `HITBOX = { width:1,height:2,depth:1 }` 寫入 spawned `TargetState.hitbox`。
  - `src/sim/HitDetector.ts`:不持有常數;用 `TargetState.hitbox` 建 `Box3`,含 `subAlpha` 內插中心。
  - `src/render/TargetView.ts`:不持有尺寸常數;單位 `BoxGeometry(1,1,1)` 以 `mesh.scale.set(t.hitbox.width,height,depth)` 呈現。
  - `src/scene/clearance.ts`:local `TARGET_HITBOX_U = {1,2,1}`;`TARGET_HITBOX_RADIUS_U` / `PROP_INFLATION_U` / static + motion envelope 皆由此派生。
  - `src/metrics/trackingDerivation.ts`:local `DEFAULT_OPTIONS.hitbox = {1,2,1}`;`on-target` slab intersection 使用 `options.hitbox`。
  - `docs/operational/analysis-tracking.md`:仍描述 hitbox 常數非匯出欄;T1 需與 schema/meta 一起更新。
- **Regression / tracking test list for T1 zero-break gate**:
  `tests/regression/determinism.test.ts`;`tests/regression/moving-target-determinism.test.ts`;`tests/regression/spray-determinism.test.ts`;
  `src/loop/__tests__/determinism.test.ts`;`src/loop/__tests__/fire-determinism.test.ts`;`src/loop/__tests__/wp22-determinism.test.ts`;
  `src/sim/TargetManager.test.ts`;`src/sim/HitDetector.test.ts`;`src/render/TargetView.test.ts`;`src/scene/clearance.test.ts`;
  `src/metrics/trackingDerivation.test.ts`;`src/drill/tracking_v1.test.ts`;`src/drill/tracking_scene_v1.test.ts`;
  `src/testharness/fpsTestHarness.test.ts`;`tests/e2e/full-drill.spec.ts`.
- **OQ-S5-4 decision**:遠距設計矩陣定稿為小目標 H1 `{0.5,1,0.5}` + 角高 0.5°/2.0° + 角速度 5°/s/20°/s;反推表見 ledger。T2 預設用 0.5° × 5°/s,hard profile 記 0.5° × 20°/s,近距 sanity 記 2° × 5°/s。
- **OQ-23.1 decision**:單一來源落在 `DrillConfig` contract + resolved config;`TargetState.hitbox` 是 runtime sim/render/hit detector 傳遞值;export meta 是離線推導來源。預設常數只允許一處宣告,省略 `targets.hitbox` 必須逐位不變。
- **CLAUDE.md §4**:追加「目標 hitbox 單一來源;命中判定與 on-target 推導必須同幾何」硬約束。
- **Entry gate**:PASS。T1 可開;本切片無 `src/` 變更。

### 2026-07-10 — Plan authored

- 由 stage5 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T3 + T-exit)。
- 決議依據:GD-7(同幾何零新門檻——hitbox config 化必須保住「命中 ⇔ on-target 同 AABB」)、
  WP-18 交付形狀(motion/sub-tick 內插/tracking_v1/追蹤指標推導)、2026-07-10 架構評估
  (hitbox 為 {1,2,1} 寫死常數、三處重複:TargetManager.ts:57 / clearance.ts:8 / trackingDerivation DEFAULT_OPTIONS)。
- 設計要點:**零破壞不變式**(省略 hitbox 欄 = 現行常數逐位不變)是 T1 的 DoD 首項;
  遠距 drill 以**角參數**(角尺寸/角速度)反推距離與 hitbox,非直接指定絕對距離。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— 上游驗證 + OQ-S5-4 拍板,docs-only。
