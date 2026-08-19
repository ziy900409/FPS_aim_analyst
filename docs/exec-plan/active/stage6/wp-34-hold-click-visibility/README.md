# WP-34 — hold-click-visibility:遮蔽物可見度時間線 + `hold-click-v1` 協定

> stage6 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 需求 source of truth:[../aim-assessment-framework-v1.md](../aim-assessment-framework-v1.md) · 決議依據:**GD-22**(stage6 採納)+ 本 WP T0 讀碼 spike(2026-08-19)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 交付 FR-F5(遮蔽物 + render/scene 層連續可見度時間線)與 FR-F6(`hold-click-v1` 協定 + 預瞄/反應/取得/首發指標)。T0 讀碼 spike 已把「候選方案②:scene 層封閉幾何離線解析」拍板為實作路線,本 WP 其餘 task 依此展開 |
| **里程碑** | 無獨立里程碑;是 WP-35(`hold-track-v1`)的地基,兩者共同構成架槍挑戰家族 |
| **相依** | **WP-33**(共同契約,`AssessmentTimelinePoint`/`DrillConfig.mode`)——T0 spike 本身零程式碼,已提前於 WP-33 完成前執行;T1 起需要 WP-33 T-exit |
| **對應 FR** | FR-F5(可見度時間線)+ FR-F6(`hold-click-v1`) |
| **估時** | 2.5–3.5 dev-days(T0 spike 完成後由原估 3–5d 下修,見 [../README.md §6](../README.md) 與 progress.md D-34.1) |
| **狀態** | 🟡 T0/T1 已完成;T2 implementation done but full `npm run test:ci` gate blocked by existing Playwright app-ready timeout(S-34.3,2026-08-19);T3/T-exit 待展開 |

---

## 0. T0 讀碼 spike 結論(2026-08-19;決定本 WP 後續 task 切分的依據)

> 完整證據見 [progress.md D-34.1](progress.md)。以下是結論摘要。

### 0.1 可見度計算:候選方案②完全可行,且大部分元件已存在

[../README.md §2.3(a)](../README.md) 列了三個候選(render 逐幀 raycast / scene 層封閉幾何解析 / 兩者混合)。讀碼後發現**候選②不需要新引擎能力**,可以整條落在 offline metrics 層,原因是四個關鍵元件都已存在:

| 需要的能力 | 既有實作 |
|---|---|
| 線段 vs AABB 遮擋測試 | [`segmentIntersectsAabb()`](../../../../../src/scene/clearance.ts) |
| 逐 tick eye world 位置(純函式,KI-004 修正後權威) | [`eyeOriginForTick()`](../../../../../src/metrics/eyeOrigin.ts) |
| 逐 tick 目標世界座標 | `TickRecord.tx/ty/tz`([RingBuffer.ts](../../../../../src/data/RingBuffer.ts)) |
| 靜態遮蔽物 AABB + 程序化視覺方塊生成 | `SceneConfig.propBounds` + `scripts/gen-field-low-gltf.mjs`(JSON → 視覺 GLTF box + propBounds 單一來源) |
| 目標多角點取樣 | `sampleAabb()`(既有邏輯,改寫為「當前 tick 目標 AABB」版本) |
| Emergence 移動路徑 | `TargetMotion: 'linear'/'waypoints'`(WP-18 F5,既有,零新增型別) |

**結論**:候選①(render 逐幀 raycast)可直接排除——不只是「候選②比較好」,而是候選②完全繞開了候選①的核心風險(render FPS 依賴、破壞決定性)。全部輸入(eye 位置、target 位置、propBounds)匯出後皆為已知靜態資料,`visibleFraction(t)` 可以 100% 離線重建,新模組 `src/metrics/visibilityDerivation.ts` 與 `detectionDerivation.ts` 同層級,不是 sim、不是 render,滿足 GD-6。降級 fallback(離散可見度階梯,OQ-S6-7)**不需要啟用**。

### 0.2 發現的新設計衝突:`validateClearance` 現行不變式與 hold-click 目的相反

`validateClearance`(WP-19)現行硬不變式是「目標整條移動 envelope 對玩家走廊零遮蔽」——服務既有 drill「保證打得到」的需求。`hold-click-v1` 需要目標在 emergence 之前**被刻意遮蔽**,兩者語意互斥。讀碼證據:`field-low.props.json` 註解明寫「所有 prop 置於淨空安全區…遠離…到 target 的視線;由 field-low.test.ts 的 validateClearance 斷言零違規」——**既有三個場景(field-low/urban-high/br-field)都不能直接拿來做 hold-click**。

### 0.3 政策決議(使用者拍板,2026-08-19)

採用 **候選①「occlusion-aware 驗證模式」**:只驗證**曝光後的子路徑**零遮蔽,emergence 前允許指定的 propBounds 遮蔽。細節見 [progress.md D-34.2](progress.md);具體介面設計留給 T2(不在 T0 鎖死實作,只鎖政策方向與不變式)。

### 0.4 修正後的 task 切分與估時

原 README §6 的「T1+/T2+(依 T0 產出定案)」現在展開為具體四個 task(見 §4),估時由 3–5d 下修為 **2.5–3.5d**。

---

## 1. 需求對應

| FR | 內容 | 落點 |
|---|---|---|
| FR-F5 | 遮蔽物 + render/scene 層連續可見度時間線(`t_first_visible`/`visibleFraction(t)`/`t_measurement_onset`/`t_full_exposure`);場景幾何不得進 sim runtime(GD-6) | T1 |
| FR-F6 | `hold-click-v1`:目標出現後允許立即開火;構念 = 預瞄偏差、`t_detect − t_measurement_onset`、取得、首發 | T3 |

### 1.1 範圍

**In scope**:

```
src/metrics/visibilityDerivation.ts       ← ADD visibleFraction/tFirstVisible/tMeasurementOnset/tFullExposure   [T1]
src/scene/clearance.ts                    ← MODIFY validateClearance 增 occlusion-aware 選項(additive)         [T2]
src/scene/scenes/*-cover.props.json       ← ADD 新 occlusion 場景 prop 清單(程序化牆,零新資產授權疑慮)         [T2]
src/drill/DrillConfig.ts                  ← 視 T3 讀碼決定是否需要 additive 欄位(如 `mode: 'assessment'` 搭配既有 targets.motion) [T3]
src/metrics/detectionDerivation.ts        ← 讀,不改(t_detect 既有實作,C-D4)                                    [T3]
docs/operational/analysis-visibility.md   ← ADD 可見度契約文件(取樣點數 N/門檻凍結流程/`t_*` 定義)              [T1/T-exit]
```

**Out of scope**(附觸發條件):

- **`hold-track-v1` 的 fire-gating**——WP-35,依賴本 WP 的 emergence 機制但獨立實作。
- **render 層即時視覺化可見度**(例如 debug overlay 顯示目前 visibleFraction)——訓練功能非量測必要,觸發 = 明確除錯需求。
- **既有場景(field-low/urban-high/br-field)的 propBounds 佈局變更**——本 WP 只新增獨立的 occlusion 場景,不動既有場景既有驗證結果。
- **可見度門檻/取樣點數 N 的最終凍結值**——pre-registered 進 T1,實際數值凍結留給 WP-39 pilot(OQ-S6-1)。

---

## 2. 關鍵契約(T0 凍結項)

### ① 可見度計算落點:離線 metrics 層,非 render/sim(承 §0.1)

`visibleFraction(t)` 系列函式全部是**純函式**,輸入為已匯出的 `ExportPayload`(`ticks[].tx/ty/tz`/`px/pz`)+ `SceneConfig.propBounds` + 目標 hitbox(GD-7 單一來源),不讀取任何即時 render/scene 物件。與 `eyeOriginForTick`/`angularEccentricityDeg` 同一層級與同一輸入模式。

### ② occlusion-aware clearance 政策(承 §0.3,使用者拍板)

- 既有 `validateClearance(scene, drill)` 呼叫方式(無新參數)**逐位不變**——既有 63+ 份 drill config 的驗證行為零回溯相容成本。
- 新增 occlusion-aware 模式(參數形狀留給 T2 設計)必須同時滿足兩條不變式:
  1. 只有**明確列名**的 propBounds 可以遮蔽目標的**emergence 前**路徑;其餘所有 prop 仍必須對整條 envelope 零遮蔽(防止意外遮蔽被誤判為設計意圖)。
  2. 目標的**曝光後靜止子範圍**(hold-click 的「首發評估窗」)必須對**全部** propBounds(含被列名允許遮蔽的那些)零遮蔽——不允許目標在停止狀態下仍被部分遮擋,否則首發判定會混入視覺可見性雜訊。
- T2 的 DoD 首項 = 既有 `clearance.test.ts` 全部案例(既有三場景 + 既有 drill)**零修改**全綠。

### ③ 取樣點數 N 與可見度門檻走 pre-registered 紀律(GD-5/GD-8 精神延伸)

`visibleFraction` 的取樣點數(暫定 N=9:中心 + 8 角,沿用 `clearance.ts` 既有 `sampleAabb` 的取樣邏輯)與 `t_measurement_onset` 的可見比例門檻皆為 pre-registered 常數,寫入 `analysis-visibility.md` 並帶版本字串;凍結後不得為了讓資料好看而事後調整(門檻最終數值仍待 WP-39 pilot,見 OQ-S6-1)。

---

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| Occlusion-aware 驗證模式的「列名允許遮蔽」被誤用在既有場景 | 既有 drill 可能意外通過本應失敗的淨空驗證 | T2 DoD 明文:新參數只在明確傳入時生效,省略時逐位等同現行行為;既有測試零修改為機械判準 |
| `visibleFraction` 取樣點數 N 太少,漣漪式的假性 0%→100% 跳變(而非漸進) | `t_measurement_onset` 對取樣密度過度敏感,同一物理事件因 N 不同而給出不同時間點 | T1 DoD 要求合成 fixture 涵蓋「target 邊緣掠過遮蔽物角落」的邊界案例,記錄 N 的敏感度分析,若不穩定則升高 N 或改用解析式(角點插值)而非離散取樣 |
| 曝光後靜止子範圍與 propBounds 距離抓太近 | 首發評估窗仍可能被場景切換(如未來解析度/FOV 差異)意外遮蔽 | 契約②不變式 2 已要求靜止範圍對全部 prop 零遮蔽;T2 場景設計時加安全邊界(沿用 `clearance.ts` 既有 `CLEARANCE_MARGIN_U`) |
| `hold-click-v1` 的「立即可開火」與既有 hit detection 不檢查遮蔽的事實產生誤解 | 玩家在目標完全遮蔽時預先開火仍可能命中,若被誤當成 bug 回報 | T3 明文記錄:hit detection 從未也不需要檢查遮蔽(GD-6:場景幾何不進 sim/HitDetector);提早開火視為框架 v1 本來就要記錄的「anticipation」構念,不是缺陷 |

---

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk | 估時 |
|---|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | 讀碼 spike:候選方案評估 + occlusion-aware 政策拍板;零程式碼 | — | — | ✅ 完成 |
| **T1** | [T1-visibility-derivation.md](T1-visibility-derivation.md) | `visibilityDerivation.ts`:`visibleFraction`/`tFirstVisible`/`tMeasurementOnset`/`tFullExposure` + 合成 fixture | T0 | ✅ 完成 | 1–1.25d |
| **T2** | [T2-occlusion-scene-clearance.md](T2-occlusion-scene-clearance.md) | Occlusion-aware `validateClearance` + 新 occlusion 場景內容(程序化牆) | T0(可與 T1 並行,不同檔案) | 🟡 impl done / gate blocked(S-34.3) | 0.75–1d |
| **T3** | [T3-hold-click-protocol.md](T3-hold-click-protocol.md) | `hold-click-v1` 協定 config + 預瞄/反應/取得/首發指標 | T1 + T2 | Low | 0.5–0.75d |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | 驗收:`hold-click` 不宣稱獨立 tracking 能力;`analysis-visibility.md` 定稿 | T3 | — | 0.25d |

**T1 與 T2 檔案熱區不重疊**(`src/metrics/` vs `src/scene/` + 新 props.json)→ 可並行;一 task 一 commit 的紀律不變。

---

## 5. Interface contracts(草案;確切簽名留給各 task 定稿)

```ts
// src/metrics/visibilityDerivation.ts                                          [T1]
export interface VisibilitySample {
  readonly tick: number;
  readonly visibleFraction: number; // [0,1],N 個取樣點中未被任何 propBounds 遮擋的比例
}
export interface VisibilityTimeline {
  readonly samples: readonly VisibilitySample[];
  readonly tFirstVisible?: number;      // 第一個 visibleFraction > 0 的 tick 對應時間
  readonly tMeasurementOnset?: number;  // 第一個 visibleFraction ≥ 凍結門檻 的時間
  readonly tFullExposure?: number;      // 第一個 visibleFraction 達飽和的時間
}
export function deriveVisibilityTimeline(
  payload: ExportPayload,
  scene: SceneConfig,
  options: { sampleCount?: number; onsetThreshold: number },
): VisibilityTimeline;

// src/scene/clearance.ts                                                       [T2,additive]
export interface ClearanceOptions {
  /** 允許在 emergence 前遮蔽目標的 propBounds id;省略 = 現行行為(零遮蔽容忍)。 */
  allowedOcclusionPropIds?: readonly string[];
  /** 曝光後靜止子範圍(必須對全部 prop 零遮蔽,含 allowedOcclusionPropIds)。 */
  exposedRestEnvelope?: TargetEnvelope;
}
export function validateClearance(scene: SceneConfig, drill: DrillConfig, options?: ClearanceOptions): ClearanceViolation[];
```

---

## 6. 執行規則

沿用 [exec-plan/README.md §5](../../../README.md):一 task = 一垂直切片 = 一原子 commit;完成即更新 [progress.md](progress.md) 與 [task-checklist.md](task-checklist.md);單一閘 `npm run test:ci`。跨 WP 決策入 [DECISIONS.md](../../../DECISIONS.md),per-WP 決策入本資料夾 `progress.md`(編號 `D-34.n`)。

**本 WP 特有的兩條紀律**:

1. **可見度計算零 render/sim 依賴**:`visibilityDerivation.ts` 只能消費 `ExportPayload` + `SceneConfig`,不得 import 任何 render(`src/render/`)或 sim(`src/sim/`/`SharedState`)模組。
2. **既有 clearance 行為零回溯相容成本**:T2 新增的 `ClearanceOptions` 必須是完全可省略的 additive 參數;既有 `clearance.test.ts` 零修改全綠是機械判準。

---

## 7. Open Questions(本 WP 新增;既有見 [../README.md §8](../README.md))

| # | 問題 | 建議 / 待決 | Owner | Deadline | 未決影響 |
|---|---|---|---|---|---|
| **OQ-S6-12**(新) | `visibleFraction` 取樣點數 N=9(中心+8角)是否足以避免「目標邊緣掠過遮蔽物角落」時的離散跳變假象 | 🟡 **T1 合成 fixture 驗證**;若不穩定,candidate 為解析式角點插值(非離散取樣) | 研究者 | WP-34 T1 | `t_measurement_onset` 的可重現性 |
| **OQ-S6-13**(新) | Occlusion-aware 場景是否需要獨立的 `clutterTier`,或沿用既有三階層語意 | ✅ **T2 已拍板(D-34.4)**:新增獨立 `peek-corridor` sceneId,沿用 `clutterTier: 'low'`;不擴充 clutter taxonomy | 研究者 | WP-34 T2 | 已解決 |

---

## 8. 文件對帳清單

- [ ] [../README.md](../README.md) §3/§6:WP-34 狀態與估時已於本次 T0 更新(2026-08-19)。
- [x] `docs/operational/analysis-visibility.md`(新,T1 起稿/T-exit 定稿)。
- [ ] [CONTEXT.md](../../../../../CONTEXT.md):新術語(`visibleFraction`、`t_measurement_onset`、`occlusion-aware clearance`)於 T-exit 回寫。
