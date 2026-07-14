# 階段 E 驗收清單 E — WP-26 T4 / FR-E13

> M13(stage5 交付)的 BR 跟槍整合驗收對照。每項要嘛有自動測試入口,要嘛有明確手動回填步驟。
> Companion:[analysis-tracking.md](analysis-tracking.md) · [analysis-lead.md](analysis-lead.md) · [schema.md](schema.md) · [WP-26 progress](../exec-plan/active/stage5/wp-26-br-scene-integration/progress.md)。

---

## 0. T4 執行基線

| 命令 | 結果 |
|---|---|
| `npx.cmd vitest run tests/regression/br-tracking-invariants.test.ts src/testharness/fpsTestHarness.test.ts` | ✅ 2 files / 13 tests passed |
| `npm.cmd run typecheck` | ✅ `tsc --noEmit` clean |
| `npx.cmd playwright test tests/e2e/br-tracking.spec.ts` | ✅ 2 tests passed(Edge);sandbox 首跑被既有 Vite/esbuild parent-directory access denial 擋,approved external rerun exit 0 |
| `npm.cmd run test:ci` | ✅ exit 0;Vitest 77 files / 622 tests passed;Playwright 18 tests passed |
| `graphify update .` | ✅ AST extraction 168/168 files;graph rebuilt |

Sandbox note:`npm.cmd run test:ci` sandboxed first run hit the known Vite/esbuild parent-directory access denial;approved external rerun passed.

---

## 1. 清單 E 驗收項

| # | 驗收項 | 判定方式 | 證據入口 | T4 狀態 |
|---|---|---|---|---|
| E-1 | `br-field` 原創/白名單資產可稽核,無遊戲抽取/地圖復刻 | **A/M**:`ATTRIBUTIONS.md` br-field 條目為 procedural CC0;T1 progress 記錄生成器與紅線自檢。 | [ATTRIBUTIONS.md](../../ATTRIBUTIONS.md);[WP-26 progress T1](../exec-plan/active/stage5/wp-26-br-scene-integration/progress.md) | ✅ |
| E-2 | `br-field` SceneConfig 資料化上線,零引擎碼,tri/material budget 通過 | **A**:`br-field` scene test 驗 GLTF 1548 triangles、8 materials、SceneConfig metadata。 | [`src/scene/scenes/br-field.test.ts`](../../src/scene/scenes/br-field.test.ts);[`src/scene/scenes/br-field.ts`](../../src/scene/scenes/br-field.ts) | ✅ |
| E-3 | front-facing long corridor clearance 對 114.59u sightline、42u hard width、145u projectile envelope 全綠 | **A**:`br-field.test.ts` clearance + intentional blocker;T2 progress 記錄 corridor/budget。 | [`src/scene/scenes/br-field.test.ts`](../../src/scene/scenes/br-field.test.ts);[WP-26 progress T2](../exec-plan/active/stage5/wp-26-br-scene-integration/progress.md) | ✅ |
| E-4 | `tracking_br_v1` 純 config 宣告 BR 場景 × H1 小目標 × ADS × projectile | **A**:drill config tests + E2E canonical payload meta.scene/meta.targets/meta.weapon bullet。 | [`src/drill/tracking_br_v1.test.ts`](../../src/drill/tracking_br_v1.test.ts);[`tests/e2e/br-tracking.spec.ts`](../../tests/e2e/br-tracking.spec.ts) | ✅ |
| E-5 | BR protocol 條件序列 = 2 ADS × 2 ballistic × 2 angular height,條件 metadata 不殘留 | **A**:ProtocolRunner tests + Playwright BR protocol export 8 條件,condition index/label/display/weapon gate 對齊。 | [`src/display/ProtocolRunner.test.ts`](../../src/display/ProtocolRunner.test.ts);[`tests/e2e/br-tracking.spec.ts`](../../tests/e2e/br-tracking.spec.ts) | ✅ |
| E-6 | export round-trip 含 `meta.scene`、`meta.targets.hitbox`、`meta.weapon.ads/bullet`、tick `ads`、ads/fire/hit events | **A**:canonical projectile condition 驗 ADS+bullet+fire;ADS hitscan 2deg smoke 驗 `fire.hit=true`;protocol payload 驗 tick `ads`。 | [`tests/e2e/br-tracking.spec.ts`](../../tests/e2e/br-tracking.spec.ts);[`src/testharness/fpsTestHarness.test.ts`](../../src/testharness/fpsTestHarness.test.ts) | ✅ |
| E-7 | E2E 一鍵跑 `tracking_br_v1` → export → offline tracking metrics + lead derivation,無 NaN/Infinity | **A**:Playwright canonical `tracking_br_v1` full round validates TOT%/RMS/t_acquire sanity and `deriveLeadError()` finite sample。 | [`tests/e2e/br-tracking.spec.ts`](../../tests/e2e/br-tracking.spec.ts);[`src/metrics/trackingDerivation.ts`](../../src/metrics/trackingDerivation.ts);[`src/metrics/leadDerivation.ts`](../../src/metrics/leadDerivation.ts) | ✅ |
| E-8 | 決定性不變性 ①:同輸入下 `br-field` vs baseline/placeholder scene sim/export core rows 逐位一致 | **A**:T2 cross-scene fixture includes `br-field`;T4 BR hitscan variant compares `br-field` against scene-free baseline。 | [`tests/regression/determinism.test.ts`](../../tests/regression/determinism.test.ts);[`tests/regression/br-tracking-invariants.test.ts`](../../tests/regression/br-tracking-invariants.test.ts) | ✅ |
| E-9 | 決定性不變性 ②/③:ADS display 不改 sim;hitscan gate baseline 逐位;projectile 跨 FPS 逐位 | **A**:T4 regression drives ADS FOV display hook with identical ADS input and compares recorder snapshot;BR projectile condition stable/jitter FPS equals canonical。 | [`tests/regression/br-tracking-invariants.test.ts`](../../tests/regression/br-tracking-invariants.test.ts);[`tests/regression/projectile-determinism.test.ts`](../../tests/regression/projectile-determinism.test.ts) | ✅ |
| E-10 | 效能/CI gate:frame log 不使 BR condition suspect;`test:ci` exit 0 | **A**:BR protocol harness exports `frames.summary.overBudgetWindows=0`, `suspect=false`;`npm.cmd run test:ci` exit 0。 | [`src/testharness/fpsTestHarness.test.ts`](../../src/testharness/fpsTestHarness.test.ts);[WP-26 progress](../exec-plan/active/stage5/wp-26-br-scene-integration/progress.md) | ✅ |

---

## 2. 手動回填項

自動測試覆蓋資料鏈與決定性;下列視覺/手感仍需研究者在本機實機回填:

> **操作提示(2026-07-14 實機驗證回饋後修正)**:drill 下拉選單**選了即自動載入**(不必再按 Load)。scene 仍以「Scene」按鈕載入。
> **視覺預期**:br-field **前向走廊 x∈[-21,21] 是刻意淨空**的(遠距 tracking 視線需求),所以直視正前方時中央是空的、只在天際線看到遠山;**麥田/丘陵/樹在兩側翼**——需左右轉視角才看得到開闊田野。
> **目標可見度**:canonical `tracking_br_v1` = 0.5°@114.59u,換算到畫面僅數 px(研究規格上的遠距小目標);**肉眼視覺/手感確認請改載入 2° 變體**(如 `tracking_br_v1__ads_on__projectile__2deg`,28.65u,清楚可見)。

1. 啟動 dev server,用 Chrome/Edge 桌面版進入 app。
2. 選 `br-field`(按 Scene 載入),左右轉視角確認兩側翼為開闊麥田/丘陵、天際線有遠山,未呈現特定商業 BR 地圖配置。
3. drill 下拉選 `tracking_br_v1__ads_on__projectile__2deg`(自動載入),按住右鍵 ADS 追蹤移動小目標;確認 scope/FOV 過渡手感可接受且不遮蔽目標。(0.5° canonical 變體因目標僅數 px,不適合肉眼手感確認。)
4. 在 projectile 條件開火,確認 tracer/impact 視覺能支援研究者觀察,且無明顯 frame hitch。
5. 匯出 JSON,確認 `meta.protocol`、`meta.scene.sceneId='br-field'`、`meta.weapon.ads/bullet`、tick `ads`、tracking 欄位存在。

回填位置:WP-26 progress 的 T-exit 或後續研究者驗收段落。

---

## 3. BR 跟槍 Pilot Protocol 草案

**受試者內條件矩陣**:`br_tracking_v1` 共 8 條件:

| 軸 | 水準 |
|---|---|
| ADS | `ads_off`, `ads_on` |
| Ballistic | `hitscan`, `projectile` |
| Angular height | `0p5deg`, `2deg` |

**施測步驟**:

1. 進入資格閘,沿用 stage3 display gate。若 native/fullscreen/perf 任一不通過,拒入。
2. 開始 `BR protocol`;每條 condition 載入 `br-field` 與對應 `tracking_br_v1` 變體。
3. ADS-on 條件要求受試者全程 hold ADS;ADS-off 條件不得按 ADS。
4. 每條件跑完後立即匯出 JSON;若 fullscreen exit、frame p95 超過地板或 researcher 觀察到 hitch,該 condition 標 `suspect`。
5. 條件間允許短休息;下一條件開始前確認 scene/drill/weapon overlay 已切換。
6. Pilot 後以 export JSON 離線計算 tracking TOT%/RMS/t_acquire;projectile 條件另可用 lead derivation 檢查 lead error。

**資料 QC**:

- 每份 JSON 必須含 `meta.protocol.protocolId='br_tracking_v1'`、condition index/label、`meta.scene.sceneId='br-field'`。
- ADS-on payload 必須有 ads down/up events 且 tick `ads=true`;ADS-off payload 不應有 ads events。
- Projectile payload 必須含 `meta.weapon.bullet` 與 `projectileOverflow=false`。
- `meta.suspect=false` 才進主要分析;`suspect=true` 保留但排除或做 sensitivity analysis。

---

## 4. T4 判定 / T-exit 收斂

✅ **T4 自動驗收項通過**:BR tracking E2E、三條決定性不變性、清單 E 自動項、完整 `test:ci` gate 與 pilot 草案已落地。手動視覺/手感項已明確列出回填流程。

**T-exit 自動閘複驗(2026-07-14,branch-guarded)**:於 `aa`(HEAD 6fec1e6)重跑 `npm run test:ci` exit 0——`BRANCH_BEFORE=aa … BRANCH_AFTER=aa`;vitest 77 files / 622 tests、playwright 18 tests(含 `br-tracking.spec.ts` 2 條)全綠。首跑 2 條 BR e2e 失敗係 stale 5173 dev server 服務 pre-T3/T4 bundle(`reuseExistingServer:!CI`),kill 後 fresh server 通過——碼無缺陷。

**M13 判定**:自動項 E-1~E-10 + `test:ci` 全綠;**§2 手動視覺/手感回填(br-field 開闊尺度、ADS scope 手感、tracer/impact 觀感、無 hitch)為 M13 阻塞項,待研究者實機**。沿 stage-C M10 先例(使用者拍板 2026-07-14):**落自動閘、保留 M13 待手動**;回填完成後翻 WP-26/stage5「✅ 交付」並補規格書 §9(階段 E 節 + 附錄 E-E 清單 E)。回填位置:[WP-26 progress](../exec-plan/active/stage5/wp-26-br-scene-integration/progress.md) T-exit 段。
