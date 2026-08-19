# WP-34 — Progress / Decision Log / Surprises / Open Questions

> Running log。每個 task 完成時與切片一起 stage。
> Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

---

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 讀碼 spike | ✅ | 2026-08-19 | D-34.1(候選方案評估)+ D-34.2(occlusion-aware 政策拍板);零 `src/` diff;`npm run test:ci` 證據見下(含與本 WP 無關的既有紅燈說明,S-34.1) |
| T1 visibility derivation | ✅ | 2026-08-19 | 新增 `src/metrics/visibilityDerivation.ts` + 4 個合成 fixture 單測;`analysis-visibility.md` 起稿;`npm run test:ci` 全綠(見閘證據) |
| T2 occlusion scene + clearance | ⬜ | — | — |
| T3 hold-click protocol | ⬜ | — | — |
| T-exit | ⬜ | — | — |

**閘證據**:

| Task | `npm run test:ci` |
|---|---|
| T0 | 見 S-34.1——當前 working tree(含 WP-33 T1 未提交變更)跑出 `Test Files 1 failed \| 97 passed (98)`、`Tests 2 failed \| 808 passed (810)`(`src/metrics/trackingDerivation.test.ts` 兩案例 `raycastWithRay is not a function`)。以 `git stash`(不含 untracked)復現乾淨 HEAD(`33e4ebb docs(wp-33): freeze T0 assessment contract`)驗證:**810/810 全綠**,證明失敗由 WP-33 T1 的未提交變更引入,與本 WP-34 T0 的零 `src/` diff 無關 |
| T1 | 2026-08-19 14:40+02:00:首跑在 sandbox 內被 Windows 權限擋於 Vitest config 載入(`Cannot read directory "../../../..": Access is denied`);非 sandbox 重跑同一命令通過:`tsc --noEmit` + Vitest **101 files / 845 tests passed** + Playwright **21 passed** |
| T2~T-exit | — |

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

---

## Surprises

> 編號 `S-34.n`。

### S-34.1 — `npm run test:ci` 在當前 working tree 有兩個既有紅燈,與 WP-34 無關但需要留痕

執行本 WP T0 的證據閘時,`npm run test:ci` 回報 `src/metrics/trackingDerivation.test.ts` 兩案例失敗(`raycastWithRay is not a function`)。**根因排查**:`git status` 顯示 working tree 已有 WP-33 T1 的未提交變更(`src/data/metadata.ts`/`src/drill/DrillConfig.ts`/`src/drill/schema.ts`/新檔 `src/drill/assessmentContract.ts`)。用 `git stash`(不含 untracked)復現乾淨 HEAD(`33e4ebb docs(wp-33): freeze T0 assessment contract`)重跑,**810/810 全綠**——確認失敗由 WP-33 T1 的未提交變更引入,與本 WP-34(零 `src/` diff)無關。**未進一步排查 WP-33 T1 側的根因**(不屬本 WP 範圍);記錄於此供 WP-33 進度追蹤參考,WP-33 T1 落地時應把這兩個測試失敗一併解決或在 WP-33 progress.md 記錄根因。

### S-34.2 — T1 edge-grazing fixture 顯示 N=1 與 N=9 可跨越 onset threshold

合成 edge-grazing 案例中,同一個 target/prop 幾何在 center-only (`N=1`) 下 `visibleFraction=1.0`,但在 `N=9` 下 `visibleFraction=5/9`。這證明 OQ-S6-12 不是純理論風險:取樣密度可直接改變靠近遮蔽物邊界時的 `t_measurement_onset`。T1 已把此案例寫入 `src/metrics/visibilityDerivation.test.ts` 與 `docs/operational/analysis-visibility.md`;最終 N/threshold 仍留給 WP-39 pilot 凍結。

---

## Open Questions

見 [README.md §7](README.md):OQ-S6-12(取樣點數 N 的邊界穩定性)、OQ-S6-13(occlusion 場景是否需要獨立 clutterTier)。
