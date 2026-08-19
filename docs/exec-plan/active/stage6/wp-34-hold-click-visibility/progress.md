# WP-34 — Progress / Decision Log / Surprises / Open Questions

> Running log。每個 task 完成時與切片一起 stage。
> Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

---

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 讀碼 spike | ✅ | 2026-08-19 | D-34.1(候選方案評估)+ D-34.2(occlusion-aware 政策拍板);零 `src/` diff;`npm run test:ci` 證據見下(含與本 WP 無關的既有紅燈說明,S-34.1) |
| T1 visibility derivation | ✅ | 2026-08-19 | 新增 `src/metrics/visibilityDerivation.ts` + 4 個合成 fixture 單測;`analysis-visibility.md` 起稿;`npm run test:ci` 全綠(見閘證據) |
| T2 occlusion scene + clearance | 🟡 impl done / gate blocked | 2026-08-19 | `ClearanceOptions` additive API + `peek-corridor` procedural scene; strict legacy clearance remains unchanged; targeted scene/clearance tests green. Full `npm run test:ci` blocked by existing Playwright app-ready timeout in `input-sampler.spec.ts`(見 S-34.3) |
| T3 hold-click protocol | ⬜ | — | — |
| T-exit | ⬜ | — | — |

**閘證據**:

| Task | `npm run test:ci` |
|---|---|
| T0 | 見 S-34.1——當前 working tree(含 WP-33 T1 未提交變更)跑出 `Test Files 1 failed \| 97 passed (98)`、`Tests 2 failed \| 808 passed (810)`(`src/metrics/trackingDerivation.test.ts` 兩案例 `raycastWithRay is not a function`)。以 `git stash`(不含 untracked)復現乾淨 HEAD(`33e4ebb docs(wp-33): freeze T0 assessment contract`)驗證:**810/810 全綠**,證明失敗由 WP-33 T1 的未提交變更引入,與本 WP-34 T0 的零 `src/` diff 無關 |
| T1 | 2026-08-19 14:40+02:00:首跑在 sandbox 內被 Windows 權限擋於 Vitest config 載入(`Cannot read directory "../../../..": Access is denied`);非 sandbox 重跑同一命令通過:`tsc --noEmit` + Vitest **101 files / 845 tests passed** + Playwright **21 passed** |
| T2 | 2026-08-19 14:48+02:00:`npx.cmd vitest run src\scene\clearance.test.ts` 通過(**16 tests passed**);14:49+02:00 scene/clearance targeted gate 通過(**5 files / 34 tests passed**);`npm run typecheck` 通過。完整 `npm run test:ci` sandbox 內因 Windows 權限無法載入 Vite config;非 sandbox 重跑兩次皆通過 `tsc --noEmit` + Vitest **102 files / 853 tests passed**,但 Playwright full suite 皆 **20/21 passed, 1 failed**於既有 `tests/e2e/input-sampler.spec.ts` app-ready timeout。單跑 `npx.cmd playwright test tests/e2e/input-sampler.spec.ts` 通過(**5 passed**) |
| T3~T-exit | — |

---

## Decision Log

> 編號 `D-34.n`。跨 WP / 跨文件的決策改入 [DECISIONS.md](../../../DECISIONS.md)。

### D-34.1 — 可見度計算候選方案評估:候選②(scene 層封閉幾何離線解析)拍板,候選①排除(2026-08-19,T0)

讀碼覆核 [../README.md §2.3(a)](../README.md) 列出的三個候選,逐一對照既有程式碼:

| 候選 | 讀碼發現 | 判定 |
|---|---|---|
| ① render 逐幀 raycast | 需要新增 render loop 邏輯,且訊號會依附 render 幀率,與既有「量測資料不得依賴 render FPS」的決定性契約(ADR-2、`schema.md` 對 `meta.scene.eye` 的明文警告:「never read from sceneManager.camera.position…would make the export depend on render frame rate」)牴觸 | **排除**——不是「比較差」,是候選②讓它變得不必要,且候選①有具體的決定性風險 |
| ② scene 層封閉幾何解析(offline) | 四個關鍵元件皆已存在且可直接組合:`segmentIntersectsAabb()`([clearance.ts:287](../../../../../src/scene/clearance.ts))、`eyeOriginForTick()`([eyeOrigin.ts:76](../../../../../src/metrics/eyeOrigin.ts))、`TickRecord.tx/ty/tz`([RingBuffer.ts:18-20](../../../../../src/data/RingBuffer.ts))、`SceneConfig.propBounds` + 程序化視覺方塊生成腳本(`scripts/gen-field-low-gltf.mjs`,`field-low.props.json` 註解明載「JSON → 視覺 GLTF box + propBounds 單一來源」)。目標多角點取樣可直接改寫自既有 `sampleAabb()`(`clearance.ts:256`)。emergence 移動路徑可直接用既有 `TargetMotion: 'linear'/'waypoints'`(WP-18 F5),零新增型別 | **採用** |
| ③ 混合(錨點事件 + 離線重建) | 讀碼後發現候選②已經是「完全離線重建」,不需要即時錨點事件退而求其次 | 併入候選②,不需要單獨實作 |

**Alternatives considered**:
- 「render 層做粗略即時提示,offline 層做精細重算」(候選③原意)——否決:既有 `eyeOriginForTick`/`TickRecord.tx/ty/tz` 已經提供 offline 重建所需的全部輸入,雙軌會製造「即時提示 vs 精細重算」兩套可能不一致的數字,無正當理由。

**影響**:`visibleFraction(t)` 系列函式全部落在新模組 `src/metrics/visibilityDerivation.ts`,與 `detectionDerivation.ts`/`trackingDerivation.ts` 同層級(offline metrics,非 sim、非 render),滿足 GD-6。OQ-S6-7(降級為離散可見度階梯的 fallback)**不需要觸發**。

### D-34.2 — Occlusion-aware `validateClearance` 政策:選項①(曝光後子路徑零遮蔽,emergence 前允許指定 propBounds)(2026-08-19,使用者拍板)

**背景**:`validateClearance`(WP-19)現行不變式是「目標整條移動 envelope 對玩家走廊零遮蔽」,服務既有 drill「保證打得到」;`hold-click-v1` 需要目標在 emergence 前被刻意遮蔽,兩者語意互斥。讀碼證據:[`field-low.props.json:2`](../../../../../src/scene/scenes/field-low.props.json) 註解明寫所有 prop 刻意避開視線,並由 `field-low.test.ts` 的 `validateClearance` 斷言零違規——既有三個場景(field-low/urban-high/br-field)都不能直接拿來做 hold-click。

**決議(選項①)**:新增 occlusion-aware 驗證模式,只驗證**曝光後的子路徑**零遮蔽;emergence 前允許**明確列名**的 propBounds 遮蔽。兩條不變式(承 [README §2②](README.md)):

1. 只有明確列名的 propBounds 可以遮蔽 emergence 前路徑;其餘所有 prop 仍必須對整條 envelope 零遮蔽(防止意外遮蔽被誤判為設計意圖)。
2. 目標的曝光後靜止子範圍必須對**全部** propBounds(含被列名允許遮蔽的那些)零遮蔽——避免首發判定混入視覺可見性雜訊。
3. 既有 `validateClearance(scene, drill)` 呼叫方式(無新參數)逐位不變,既有 63+ 份 drill config 零回溯相容成本。

**未定案(留給 T2)**:「曝光後靜止子範圍」的具體介面形狀(是由 `deriveTargetEnvelopes` 通用推導,還是由 drill config 作者顯式宣告一個獨立小 AABB)。T0 只鎖政策方向與兩條不變式,不鎖演算法。

**Alternatives considered**:
- 「② hold-click 場景整個繞過 `validateClearance`,走獨立驗證邏輯」——未採用:會製造兩套淨空驗證邏輯,增加維護面且喪失既有 `segmentIntersectsAabb`/`CLEARANCE_MARGIN_U` 的一致安全邊界。
- 「③ 混合(沿用既有函式簽名 + 白名單參數)」——與選項①在效果上等價,選項①的表述(政策層級)已隱含選項③的實作形狀,不需要另立第三案。

### D-34.3 — `visibility-v1` T1 取樣介面:凍結候選 N=9,保留 N=1 診斷模式(2026-08-19,T1)

T1 實作接受 `sampleCount: 9`(中心 + 8 hitbox corners)作為 `visibility-v1` 的 pre-registered candidate,另接受 `sampleCount: 1` 作為 OQ-S6-12 的敏感度診斷模式;其餘 N 值 loud fail。`onsetThreshold` 仍為建構參數,等待 WP-39 pilot 凍結。

**Alternatives considered**:
- 任意整數 N——未採用:需要定義更多取樣拓撲(表面格點、體積格點或解析式),超出 T1 範圍且會讓 `t_measurement_onset` 的版本語意變模糊。
- 只允許 N=9——未採用:會使 T1 無法以 executable fixture 量化 OQ-S6-12 的取樣密度敏感度。

### D-34.4 — T2 occlusion 場景命名:新增獨立 `peek-corridor`,不擴充 `clutterTier`(2026-08-19,T2)

T2 以新增 `sceneId='peek-corridor'` 承載 hold-click emergence 的遮蔽物語意,並沿用既有 `clutterTier: 'low'`。`clutterTier` 保持「雜亂度」分類,不新增 occlusion 專用 tier,避免為單一 WP 擴大 `SceneConfig` enum 與所有場景/協定驗證面。

實作上,`loadDrill(source, scene)` 仍只呼叫舊式 strict `validateClearance(scene, drill)`,因此 `peek-corridor` 搭配 T2 fixture drill 會被舊載入閘拒載;T3 若要使用此場景,必須明確呼叫 `validateClearance(scene, drill, { allowedOcclusionPropIds, exposedRestEnvelope })` 或在新協定入口接上同等選項。這保留既有 drill 的零回溯相容成本,也讓 occlusion-aware 成為 opt-in。

**Alternatives considered**:
- 新增 `clutterTier: 'occlusion'` 或類似值——未採用:這會把「可見度設計語意」混入「雜亂度層級」,並迫使 `SceneConfig` 驗證、既有協定與測試更新。
- 直接把 `peek-corridor` 接到 `loadDrill(source, scene)` 的自動例外——未採用:會讓場景 ID 隱式改變 clearance policy,違反 T0/T2 的「明確列名 propBounds 才可遮蔽」要求。

---

## Surprises

> 編號 `S-34.n`。

### S-34.1 — `npm run test:ci` 在當前 working tree 有兩個既有紅燈,與 WP-34 無關但需要留痕

執行本 WP T0 的證據閘時,`npm run test:ci` 回報 `src/metrics/trackingDerivation.test.ts` 兩案例失敗(`raycastWithRay is not a function`)。**根因排查**:`git status` 顯示 working tree 已有 WP-33 T1 的未提交變更(`src/data/metadata.ts`/`src/drill/DrillConfig.ts`/`src/drill/schema.ts`/新檔 `src/drill/assessmentContract.ts`)。用 `git stash`(不含 untracked)復現乾淨 HEAD(`33e4ebb docs(wp-33): freeze T0 assessment contract`)重跑,**810/810 全綠**——確認失敗由 WP-33 T1 的未提交變更引入,與本 WP-34(零 `src/` diff)無關。**未進一步排查 WP-33 T1 側的根因**(不屬本 WP 範圍);記錄於此供 WP-33 進度追蹤參考,WP-33 T1 落地時應把這兩個測試失敗一併解決或在 WP-33 progress.md 記錄根因。

### S-34.2 — T1 edge-grazing fixture 顯示 N=1 與 N=9 可跨越 onset threshold

合成 edge-grazing 案例中,同一個 target/prop 幾何在 center-only (`N=1`) 下 `visibleFraction=1.0`,但在 `N=9` 下 `visibleFraction=5/9`。這證明 OQ-S6-12 不是純理論風險:取樣密度可直接改變靠近遮蔽物邊界時的 `t_measurement_onset`。T1 已把此案例寫入 `src/metrics/visibilityDerivation.test.ts` 與 `docs/operational/analysis-visibility.md`;最終 N/threshold 仍留給 WP-39 pilot 凍結。

### S-34.3 — T2 full `npm run test:ci` 被既有 Playwright app-ready timeout 擋住,但 T2 相關 gate 全綠

T2 驗證時,完整 `npm run test:ci` 在 sandbox 內先因 Windows 權限無法讀取 Vite config(`Cannot read directory "../../../..": Access is denied`)失敗;非 sandbox 重跑後,`tsc --noEmit` 與 Vitest 皆全綠(**102 files / 853 tests passed**),但 Playwright full suite 兩次各在 `tests/e2e/input-sampler.spec.ts` 的不同案例等待 `window.__aimDebug` timeout,結果皆為 **20/21 passed, 1 failed**。單跑同一檔 `npx.cmd playwright test tests/e2e/input-sampler.spec.ts` 通過(**5 passed**),且 T2 相關 scene/clearance targeted gate **5 files / 34 tests passed**。

**Evidence**:失敗點都在 `gotoAppReady()` 的 app readiness polling,不是 `src/scene/clearance.ts`、`peek-corridor` 或 GLTF/SceneConfig 測試路徑。T2 code 目前不 commit,等待使用者決定是否接受帶此既有 E2E flake 的 slice,或先另開/處理 input-sampler E2E 穩定性。

---

## Open Questions

見 [README.md §7](README.md):OQ-S6-12(取樣點數 N 的邊界穩定性)。OQ-S6-13 已由 D-34.4 解決:新增獨立 `peek-corridor` sceneId,不新增 `clutterTier`。
