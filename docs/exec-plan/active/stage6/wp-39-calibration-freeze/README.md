# WP-39 — calibration-freeze:Calibration pilot 工具 + 數值凍結 + `protocolVersion = 1.0.0` + 驗收清單 F

> stage6 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 需求 source of truth:[../aim-assessment-framework-v1.md](../aim-assessment-framework-v1.md) · 決議依據:**GD-22**(stage6 採納)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 交付 FR-F17(calibration pilot 參數化工具)+ FR-F18(協定凍結程序 + `protocolVersion = 1.0.0` + 驗收清單 F 全項通過);達成 **M16**(stage6 交付里程碑) |
| **里程碑** | **M16**(stage6 交付) |
| **相依** | **WP-33+34+35+36+37+38 全部 T-exit**([../README.md §5](../README.md))。**現況(2026-08-25)阻塞**:WP-38 僅 T0~T2 完成,T3(`ResultScreen` 呈現整合)與 T-exit 尚未交付([wp-38 task-checklist.md](../wp-38-diagnosis-recommendation/task-checklist.md))——**本 WP 的 T0 entry-gate 在 WP-38 T-exit 綠燈前不得放行**,此規劃先行產出,執行時序仍受 WP-38 進度控制 |
| **對應 FR** | FR-F17 + FR-F18 |
| **估時** | 2–3 dev-days([../README.md §6](../README.md));讀碼發現六個測試家族 WP 已各自留下顯式 pilot-candidate 標記(見 §0),故本 WP 的淨新增工作量集中在「產生候選配置的參數化工具」與「凍結後把候選常數換成正式常數並升版」兩點,不需要重新設計任何協定骨架 |
| **狀態** | ⬜ 規劃已展開(本檔,2026-08-25);entry 待 WP-38 T-exit |

---

## 0. 讀碼對帳(規劃階段,2026-08-25;決定本 WP 淨新增工作量)

> 動筆前對 `src/drill/hold_click_v1.ts`、`src/drill/hold_track_v1.ts`、`src/drill/spider_shot_v1.ts`、`src/drill/counterstrafe_cued_v1.ts`/`counterstrafe_reversal_v1.ts`、`src/metrics/visibilityDerivation.ts`、`src/metrics/diagnosisRules.ts`、`src/metrics/sessionHistory.ts`、`src/metrics/compatibilityKey.ts`、`src/main.ts`、`docs/operational/analysis-*.md`、`docs/operational/pilot-protocol-stage3.md` 的讀碼結果。目的與 WP-33~38 §0 同:找出框架 v1 假設為新能力的項目裡有多少是既有構念的延伸,並把散落在四個測試家族程式碼裡的「pilot candidate」標記收斂成一份權威清單,避免 T0 遺漏。

| # | 框架 v1 / stage6 README 假設 | 讀碼發現 | 對本 WP 的影響 |
|---|---|---|---|
| **0-1** | 「近/中/遠世界距離」(OQ-S6-2/OQ-AF-02)是待建立的條件矩陣 | [`hold_click_v1.ts`](../../../../../src/drill/hold_click_v1.ts)/[`hold_track_v1.ts`](../../../../../src/drill/hold_track_v1.ts) 目前 `targets.distance`/`spawnArea.distanceURange` 皆是**單一**固定值(`8`),尚無 near/mid/far 變體;[`spider_shot_v1.ts`](../../../../../src/drill/spider_shot_v1.ts) 的 `centerDistanceU`/`peripheral.distanceURange` 同樣是單點 | `DrillConfig.targets.distance`/`spawnArea`/`spiderShot.peripheral` 欄位本身足夠表達多個距離水準(無 schema 缺口),但**目前零個**近/中/遠變體被具體化;T1 必須產生真正可執行的 pilot `DrillConfig` 變體,不只是回傳參數物件 |
| **0-2** | 「可見門檻候選值」(OQ-S6-1/OQ-S6-12/OQ-AF-01)需要新的分析能力 | [`visibilityDerivation.ts`](../../../../../src/metrics/visibilityDerivation.ts) 的 `onsetThreshold`/取樣點數已是**建構子注入參數**(非硬編);`hold_click_v1.ts` 現用單一候選 `N=9`/`onsetThreshold=0.5`([analysis-visibility.md](../../../../operational/analysis-visibility.md) 已 pre-register)。T1 合成 fixture(WP-34 T1)已量化 `N=1` vs `N=9` 的敏感度差異 | **零新增推導邏輯**。T1 只需要對同一批合成/pilot 匯出資料,用不同 `onsetThreshold` 候選值重跑既有 `deriveVisibilityTimeline()`(`N` 維持 `9`,不重新開一個 N 掃描維度——WP-34 已定案 `N=9` 為必要取樣密度,pilot 只掃 `onsetThreshold`) |
| **0-3** | 「Spider Shot `D_deg`/`W_deg` 範圍」(OQ-S6-4/OQ-AF-04)是待生成的條件格 | `spiderShotV1.spiderShot.peripheral.angularRadiusDegRange = [15, 15]` 是**單點**而非範圍;`W_deg` 換算邏輯已在 `spiderShotConditions.ts`(WP-36 交付)中定案,讀 `DrillConfig.targets.hitbox` 單一來源(GD-7) | T1 只需要對 `angularRadiusDegRange`/`hitbox` 掃出多個候選水準組成 pilot config 陣列,`W_deg` 換算**必須繼續呼叫**既有 `spiderShotConditions.ts`,不得另開第二套換算(C-D4 精神延伸) |
| **0-4**(新發現) | stage6 README §7 的 OQ-S6-1~6 清單(撰寫於 2026-08-19)已窮舉全部待凍結數值 | [`diagnosisRules.ts`](../../../../../src/metrics/diagnosisRules.ts) 的 `PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS`(8 個數值門檻 + `version: 'recommendation-pilot-candidate-v1'`)是 WP-38 T1(2026-08-25)才落地的候選值,**晚於** README §7 OQ 清單撰寫時間,尚未收錄任何 OQ 編號 | 這是本 WP 待凍結清單的**新增項**,不是原 OQ-S6-1~6 的子項;T0 須開新 OQ 編號(見 §7 OQ-S6-24)並在 stage6 README 對帳,避免「規劃時就存在但沒人追蹤」的缺口(呼應 §1.3 風險表「三個測試家族各自量產指標,但共同契約覆蓋不到某個邊界情境」的精神,這裡是診斷層而非契約層的同類缺口) |
| **0-5**(新發現) | 急停 cue 提示時機(`holdDurationMs`/cue lead time)已在 WP-37 明文標記「凍結留給 WP-39」,但未對應 stage6 README 正式 OQ 編號 | [wp-37 README §"Out of scope"](../wp-37-counterstrafe-protocols/README.md) 明文:「`holdDurationMs`/cue lead time 的凍結數值:WP-39 pilot 待決,本 WP 只交付『可配置+可記錄』的機制」;`counterstrafe_reversal_v1.ts` 目前用單一候選 `holdDurationMs` 值 | 同樣需要新開 OQ 編號收斂(見 §7 OQ-S6-25),T1 對此值產生候選掃描,T2 凍結 |
| **0-6** | 「Assessment 是否顯示即時命中回饋」(OQ-S6-6/OQ-AF-06)是待比較的兩個版本 | [`main.ts:510-517`](../../../../../src/main.ts) 目前**寫死** `assessmentFeedbackPolicy: 'minimal-end-of-block'`;型別([`metadata.ts`](../../../../../src/data/metadata.ts))已凍結為 `'minimal-end-of-block' \| 'unrestricted'` 兩個字面值(WP-33 契約),但**沒有任何呼叫路徑**能產生 `'unrestricted'` 匯出 | 若 pilot 要「比較最小回饋與無策略回饋版本」,`main.ts` 目前的寫死值必須改成**可由呼叫端覆寫**的參數(不新增第三個枚舉值,只是把既有兩個合法值都變成可達);這是本 WP 在 `main.ts` 的最小必要修改點(T1) |
| **0-7** | 「`protocolVersion` 由 pilot 態升為 `1.0.0`」(FR-F18)隱含現況已有一個「pilot 態」版本字串可升級 | `main.ts:513` 目前 `protocolVersion: activeDrillConfig.drillId`——即 `protocolVersion` 現況**等同 `taskId`/`drillId`**,沒有獨立版本語意,也不是任何 pilot 佔位格式(例如 `hold-click-v1@0.0.0-pilot`) | FR-F18 在現況下缺一個「顯式版本常數注入點」;T2 必須新增 `STAGE6_PROTOCOL_VERSION` 一類的具名常數並改 `main.ts` 讀取它,而不是繼續讀 `drillId`,否則「凍結後升版」沒有意義的起點可比較(`compatibilityKey.ts` 的 `protocolVersion` 欄位本身不變,只是來源要換) |
| **0-8** | 「baseline session 數」(OQ-S6-5/OQ-AF-05)凍結後直接可用 | [`sessionHistory.ts`](../../../../../src/metrics/sessionHistory.ts) 的 `buildSessionHistory(past, windowSize, minN)` 兩個參數由呼叫端注入,**目前沒有任何生產呼叫點**傳入實際數字(WP-38 T3——`ResultScreen` 歷史呈現接線——尚未交付) | 本 WP 凍結的 `windowSize`/`minN` 數值,其唯一消費者是 WP-38 T3 待接的呼叫點;T0 需要記錄「凍結值目前無寫入點」的相依提醒,T-exit 需要覆核 WP-38 T3 落地時讀的是同一個具名常數,而非另訂一份(承 C-D4) |

**結論**:六個測試家族 WP 已經各自用「pilot candidate」註解標記好等待凍結的數值(視覺門檻、架槍距離、Spider Shot 角度範圍、急停 hold 時長、診斷規則門檻),協定骨架不需要任何新設計。本 WP 的淨新增只有兩類——① 一個純 TS、seeded、可重現的 pilot config 產生器(T1),② 凍結後把候選常數換成具名的凍結常數並統一升版(T2)——外加驗收清單 F 的最終覆核(T3)。這個收斂決定了 T1/T2/T3 的切法(見 §4),記入 Decision Log D-39.1(T0 執行時定案)。

---

## 1. 需求對應

| FR | 內容 | 落點 |
|---|---|---|
| FR-F17 | Calibration pilot 工具:支援近/中/遠世界距離、可見門檻候選值、架槍速度/露出距離、Spider Shot `D_deg`/`W_deg` 範圍的參數化探索;pilot 資料**不進**正式歷史 | T1 |
| FR-F18 | 協定凍結程序 + `protocolVersion = 1.0.0` 發布:pilot 結束後先凍結協定與分析規則再收正式 baseline;驗收清單 F 全項通過 | T2(凍結機制)+ T3(驗收清單 F)+ T-exit(M16 收斂) |

### 1.1 範圍

**In scope**:

```
src/pilot/pilotConfigs.ts                     ← ADD 參數化 pilot config 產生器(近/中/遠距離、可見門檻候選、
                                                  Spider Shot D_deg/W_deg 範圍、holdDurationMs 候選、
                                                  assessmentFeedbackPolicy 候選)+ pilot-only seed roster   [T1]
src/pilot/pilotConfigs.test.ts                ← ADD 決定性/reproducibility 測試 + mode==='practice' 守門    [T1]
src/main.ts                                    ← MODIFY protocolVersion 讀取來源(drillId → 顯式版本常數
                                                  注入點);assessmentFeedbackPolicy 從寫死字面值改為可覆寫   [T1/T2]
src/metrics/diagnosisRules.ts                 ← MODIFY `PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS` 凍結為正式
                                                  具名常數,`version` 升級                                    [T2]
src/drill/hold_click_v1.ts                    ← MODIFY(視 T2 凍結結果)near/mid/far 具體數值定案             [T2]
src/drill/hold_track_v1.ts                    ← MODIFY(同上)                                                [T2]
src/drill/spider_shot_v1.ts                   ← MODIFY(同上)D_deg/W_deg 條件格定案                          [T2]
src/drill/counterstrafe_reversal_v1.ts        ← MODIFY(同上)holdDurationMs 定案                             [T2]
docs/operational/pilot-protocol-stage6.md     ← ADD(比照 pilot-protocol-stage3.md)stage6 施測程序文件      [T1/T-exit]
docs/operational/acceptance-stage-f.md        ← ADD 驗收清單 F                                              [T3/T-exit]
tests/regression/stage6-cross-family-consistency.test.ts
                                                ← ADD 跨家族同名事件時間語意一致性回歸測試                    [T3]
docs/exec-plan/DECISIONS.md                    ← MODIFY(T2)凍結決策 + `protocolVersion = 1.0.0` 發布記錄     [T2/T-exit]
```

**Out of scope**(附觸發條件):

- **實際受試者 pilot 施測**——本 WP 交付「可重現的參數化工具」與「凍結機制」,不代為執行真人 pilot(那是研究行政層工作,沿用 `pilot-protocol-stage3.md` 的角色劃分:app 只收 `participantId`/`sessionLabel`);觸發 = 研究者實際排程 pilot session。
- **WP-38 T3/T-exit 的任何工作**——本 WP entry 硬相依其完成,但不得代做;若 T0 發現 WP-38 T3 進度落後,記錄阻塞並等待,不得繞過。
- **VALORANT 或其他 `gameMovementProfile` 的凍結**——明文排除(承 stage6 README §2.1)。
- **跨玩家排名/單一總分**——框架 v1 明文不做,凍結程序不改變這條紅線。

---

## 2. 關鍵契約(T0 待凍結)

### ① Pilot config 不得污染正式歷史:複用 `mode: 'practice'`,不新增第三個 `AssessmentMode`

`AssessmentMode = 'assessment' | 'practice'`([`assessmentContract.ts`](../../../../../src/drill/assessmentContract.ts))沒有 `'pilot'` 值,且 WP-33 契約已明訂 Practice 匯出不進 `buildCompatibilityKey()`/正式 baseline。Pilot config 一律標記 `mode: 'practice'`,**不新增第三個模式**——沿用既有兩態語意即可滿足「pilot 資料不進正式歷史」的要求,避免在 `AssessmentMode` 之外另開一條分支(C-D4 精神延伸:既有二態語意已夠用,不得無故擴張)。

### ② Pilot 專用 seed roster:與正式 Assessment 完全不相交

```ts
// src/pilot/pilotConfigs.ts                                                    [T1,新增]
/** Pilot 專用 seed 範圍,與各協定既有 assessment seed(如 spiderShotV1.seed=36036、
 *  holdTrackV1.sequence.seed=35035)不相交,避免 pilot 探索資料與正式協定 seed 撞號。 */
export const PILOT_SEED_ROSTER_START = 90000;
```

框架 v1 明文「calibration 與正式 Assessment 使用不同 seed roster」;既有四個協定的 assessment seed 落在 3xxxx~3xxxx 區間,pilot roster 另起一個不重疊區間,由 T1 決定確切範圍並記錄於 `pilot-protocol-stage6.md`。

### ③ 凍結後版本來源:新增顯式常數,`main.ts` 不再讀 `drillId` 充當 `protocolVersion`

```ts
// src/main.ts 或新增 src/drill/protocolVersion.ts                              [T2,MODIFY]
export const STAGE6_PROTOCOL_VERSION = '1.0.0'; // 凍結前為 pilot 佔位字串,凍結後升版,只能升不能降
```

`compatibilityKey.ts` 的 `CompatibilityKey.protocolVersion` 型別與判定式不變(仍是 `string` 相等比較);只改變 `main.ts` 產生這個字串的來源。

### ④ 診斷門檻凍結:`PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS` → 具名凍結常數,`version` 只能升版

```ts
// src/metrics/diagnosisRules.ts                                                [T2,MODIFY]
export const DIAGNOSIS_THRESHOLDS_V1: DiagnosisThresholds = {
  version: 'recommendation-v1.0.0', // 由 'recommendation-pilot-candidate-v1' 升版,不得原地修改語意
  // …凍結後的 8 個門檻值,由 pilot 資料決定,寫入時同步記 DECISIONS.md…
};
```

---

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| T0 在 WP-38 T3/T-exit 尚未交付時就放行後續 task | WP-39 凍結的 `windowSize`/`minN`(§0-8)可能與 WP-38 T3 實際接線時另訂的值不一致,重蹈「共同契約覆蓋不到邊界情境」風險 | T0 entry-gate DoD 首項 = 機械檢查 [wp-38 task-checklist.md](../wp-38-diagnosis-recommendation/task-checklist.md) 全數 ✅;未達成則本 WP 停在 T0,不得跳過 |
| Pilot config 產生器不小心把 `mode` 留白或誤設 `'assessment'` | Pilot 探索資料混入正式 baseline,污染縱向比較(直接違反 FR-F17「pilot 資料不進正式歷史」) | T1 DoD:單元測試斷言 `pilotConfigs.ts` 產出的**每一個** `DrillConfig` 皆 `mode === 'practice'`;新增一條「呼叫 `buildCompatibilityKey()` 應拋錯或不可達」的守門測試(比照 wp-37 T3 OQ-S6-21 的验证方式) |
| Pilot seed roster 與既有協定 assessment seed 撞號 | 若研究者不慎用 pilot config 覆蓋正式協定的 seed,決定性回歸可能得到與正式 baseline 相同的探索序列,難以區分兩者 | T1 DoD:新增測試斷言 `PILOT_SEED_ROSTER_START` 及其衍生 seed 與 `spiderShotV1.spiderShot.seed`/`holdTrackV1.sequence.seed`/既有其餘 `*_v1.ts` seed 常數**逐一不相等** |
| `diagnosisRules.ts` 凍結時只改數值、忘記把 `version` 升版 | 破壞「規則表版本化,門檻變更須升版並保存舊規則」的 FR-F14 紅線,已收集的 pilot-candidate 版本推薦結論失去可追溯性 | T2 DoD:測試斷言凍結後 `DIAGNOSIS_THRESHOLDS_V1.version !== PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS.version`(舊常數保留於原始碼作為歷史記錄,不刪除,比照「保存舊規則」要求) |
| `protocolVersion` 凍結後,四個測試家族各自升版時間不同步(例如 `hold-click-v1` 先凍結,`spider-shot-v1` 還在 pilot) | 相容比較鍵(`buildCompatibilityKey`)會把「同任務不同版本」誤判為不可比較的邊界情境處理不一致,可能出現「有些任務已可比較歷史、有些還不行」的混亂狀態未被明確記錄 | T2 DoD:`DECISIONS.md` 凍結決策逐一記錄**每個** `taskId` 各自的 `protocolVersion` 升版時間點,不得用一個全域旗標蓋過四個任務可能分批凍結的事實 |
| T3 的跨家族一致性回歸測試只覆蓋「有寫」的欄位,漏掉「應該不寫」的欄位(例如某家族意外多寫了別家族專屬的事件型別) | 「三個任務的同名事件具有一致時間語意」這條驗收條件可能因為只做正向斷言而放過反向污染 | T3 DoD:`stage6-cross-family-consistency.test.ts` 同時斷言正向(同名事件跨家族時間語意一致)與反向(家族特有事件型別不出現在其他家族的匯出中) |

---

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk | 估時 |
|---|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | 驗 WP-33~38 全部 T-exit(**現況阻塞於 WP-38 T3/T-exit**);彙整六個測試家族的 pilot-candidate 標記成一份權威清單;開新 OQ 編號(OQ-S6-24/25);零程式碼 | WP-33~38 T-exit | Low(但**進度阻塞風險 High**,見 Failure modes) | 0.25–0.5d |
| **T1** | [T1-pilot-config-tool.md](T1-pilot-config-tool.md) | `src/pilot/pilotConfigs.ts`:近/中/遠距離、可見門檻候選、Spider Shot 角度範圍、`holdDurationMs`、`assessmentFeedbackPolicy` 候選的參數化產生器;pilot-only seed roster;`pilot-protocol-stage6.md` 起稿 | T0 | Med | 1–1.25d |
| **T2** | [T2-numeric-freeze.md](T2-numeric-freeze.md) | 凍結機制:`STAGE6_PROTOCOL_VERSION` 常數化、`DIAGNOSIS_THRESHOLDS_V1` 版本化凍結、四個協定 config 的 near/mid/far/D_deg/W_deg/holdDurationMs 定案數值寫入、`DECISIONS.md` 記錄 | T1 | Med | 0.5–0.75d |
| **T3** | [T3-acceptance-checklist-f.md](T3-acceptance-checklist-f.md) | `docs/operational/acceptance-stage-f.md` 驗收清單 F(框架 v1 12 項驗收條件逐一對照六個 WP 既有測試證據)+ 新增跨家族一致性回歸測試補齊缺口 | T2 | Med | 0.75–1d |
| **T-exit(M16)** | [T-exit-gate.md](T-exit-gate.md) | 驗收清單 F 全項通過;`pilot-protocol-stage6.md` 定稿;文件對帳;stage6 狀態翻 ✅,視需要移入 `completed/stage6/` | T3 | — | 0.25d |

**T0 是本 WP 的關鍵路徑與進度風險集中點**(不是設計風險——是硬相依 WP-38 尚未完成的進度風險);一旦 T0 放行,T1/T2/T3 皆是對既有 pilot-candidate 標記的收斂工作,設計複雜度低。一 task = 一垂直切片 = 一原子 commit 紀律不變。

---

## 5. Interface contracts(T0 待覆核;細節由後續 task 定稿)

```ts
// src/pilot/pilotConfigs.ts                                                    [T1,新增]
export const PILOT_SEED_ROSTER_START = 90000;

export interface PilotDistanceLevel { readonly label: 'near' | 'mid' | 'far'; readonly distanceU: number; }
export interface PilotVisibilityCandidate { readonly onsetThreshold: number; }
export interface PilotSpiderShotCell { readonly angularRadiusDeg: number; readonly widthU: number; readonly heightU: number; }
export interface PilotHoldDurationCandidate { readonly holdDurationMs: number; }
export interface PilotFeedbackPolicyCandidate { readonly assessmentFeedbackPolicy: 'minimal-end-of-block' | 'unrestricted'; }

// 所有產生器回傳的 DrillConfig 一律 mode:'practice',seed 落在 PILOT_SEED_ROSTER_START 起算的不相交區間
export function buildHoldClickPilotConfigs(
  distances: readonly PilotDistanceLevel[],
  visibilityCandidates: readonly PilotVisibilityCandidate[],
): readonly DrillConfig[];
export function buildHoldTrackPilotConfigs(distances: readonly PilotDistanceLevel[]): readonly DrillConfig[];
export function buildSpiderShotPilotConfigs(cells: readonly PilotSpiderShotCell[]): readonly DrillConfig[];
export function buildCounterstrafeReversalPilotConfigs(
  candidates: readonly PilotHoldDurationCandidate[],
): readonly DrillConfig[];

// src/main.ts 或 src/drill/protocolVersion.ts                                   [T2,MODIFY]
export const STAGE6_PROTOCOL_VERSION = '1.0.0';

// src/metrics/diagnosisRules.ts                                                [T2,MODIFY,additive — 舊常數保留]
export const PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS: DiagnosisThresholds; // 既有,保留作歷史記錄
export const DIAGNOSIS_THRESHOLDS_V1: DiagnosisThresholds;              // 新增,凍結後正式使用
```

---

## 6. 執行規則

沿用 [exec-plan/README.md §5](../../../README.md):一 task = 一垂直切片 = 一原子 commit;完成即更新 [progress.md](progress.md) 與 [task-checklist.md](task-checklist.md);單一閘 `npm run test:ci`。跨 WP 決策入 [DECISIONS.md](../../../DECISIONS.md),per-WP 決策入本資料夾 `progress.md`(編號 `D-39.n`)。

**本 WP 特有的四條紀律**:

1. **T0 entry 是機械判準,不是建議**:WP-33~38 任一未 T-exit,本 WP 一律停在 T0,不得以「反正介面看起來穩定」為由跳過(承 §1.3 風險表既有慣例)。
2. **凍結一律升版,不得原地改語意**:`protocolVersion`/`recommendationVersion`/`DiagnosisThresholds.version` 任一凍結動作都必須是新字串,舊值保留於原始碼或 `DECISIONS.md` 供追溯(承 C-D5 精神延伸)。
3. **Pilot 資料流的唯一守門是 `mode: 'practice'`**:不得新增第二套「這是 pilot 資料」的旗標欄位;既有 Assessment/Practice 二態契約已足夠(C-D4)。
4. **凍結數值來源必須可追溯到 pilot 匯出資料的實際計算**:`DECISIONS.md` 記錄凍結決策時,必須附上依據哪些 pilot session 的哪個統計量(即使數值最終仍是研究者現場判讀,也要記錄判讀依據),不得只寫最終數字。

---

## 7. Open Questions(本 WP 新增;既有見 [../README.md §8](../README.md))

| # | 問題 | 建議 / 待決 | Owner | Deadline | 未決影響 |
|---|---|---|---|---|---|
| **OQ-S6-24**(新) | `diagnosisRules.ts` 的 `PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS`(8 個門檻 + `recommendationVersion`)未被 stage6 README §7 原始 OQ 清單收錄,是否需要補登 README 或直接在本 WP 的 T0/T2 收斂即可 | 🟡 **T0 拍板**:建議在本 WP T0 收斂並於 T-exit 回寫 stage6 README §7(不需要單獨修 README,由本 WP T-exit 一併對帳) | 研究者 | WP-39 T0 | 待凍結清單的完整性;若遺漏,診斷規則可能帶著 pilot-candidate 版本號進入正式驗收 |
| **OQ-S6-25**(新) | `counterstrafe-reversal-v1` 的 `holdDurationMs`/cue lead time 凍結數值,是單一固定值還是也要走「近/中/遠」式的分層條件格 | 🟡 **T1 讀碼後拍板**:初判傾向單一固定值(框架 v1 未要求急停測試分層 hold 時長條件格,FR-F13 只要求「制動」與「輸入反應」兩類指標,不要求 hold 時長本身分層),但需確認 pilot 資料是否顯示明顯個體差異需要分層 | 研究者 | WP-39 T1 | `counterstrafe-reversal-v1` 的 pilot config 產生器介面形狀(單值 vs 陣列) |
| **OQ-S6-26**(新) | `assessmentFeedbackPolicy` 的 pilot 比較(`'minimal-end-of-block'` vs `'unrestricted'`)若結論是兩者無顯著差異,是否仍要把兩個值都保留在型別中,還是收斂回單一值 | 🟢 **建議**:保留兩個型別值(不縮減既有型別,避免未來需求變更時重開契約);`DECISIONS.md` 記錄「凍結後正式 Assessment 預設走哪一個」,型別本身不變 | 使用者 | WP-39 T2 | `metadata.ts`/`compatibilityKey.ts` 型別穩定性;不阻塞實作 |
| **OQ-S6-27**(新) | 四個測試家族(`hold-click`/`hold-track`/`spider-shot`/`counterstrafe`)的 `protocolVersion` 是否必須**同時**凍結發布 `1.0.0`,還是允許分批凍結(例如某家族 pilot 較快完成) | 🟡 **T2 拍板**;初判傾向允許分批,但每個 `taskId` 各自的凍結時間點必須各自記錄於 `DECISIONS.md`(承 §3 Failure modes 表),不得用一個全域 `protocolVersion` 常數蓋過四個任務可能分批凍結的事實 | 研究者 / 使用者 | WP-39 T2 | M16 驗收清單 F 的判定方式(逐家族 vs 一次性) |

---

## 8. 文件對帳清單

- [ ] [../README.md](../README.md) §3:WP-39 狀態列由「⬜」更新為進行中/完成;§0.0/§4/§5 視需要覆核 M16 完成條件敘述。
- [ ] `docs/operational/pilot-protocol-stage6.md`(新,T1 起稿 / T-exit 定稿,比照 [pilot-protocol-stage3.md](../../../../operational/pilot-protocol-stage3.md) 格式)。
- [ ] `docs/operational/acceptance-stage-f.md`(新,T3 起稿 / T-exit 定稿,比照 [acceptance-stage-e.md](../../../../operational/acceptance-stage-e.md) 格式)。
- [ ] [DECISIONS.md](../../../DECISIONS.md):凍結決策(`protocolVersion`/`recommendationVersion`/四個協定的近中遠與角度條件格數值)入帳。
- [ ] [CONTEXT.md](../../../../../CONTEXT.md):新術語(`STAGE6_PROTOCOL_VERSION`、`DIAGNOSIS_THRESHOLDS_V1`、pilot seed roster 慣例)於 T-exit 回寫。
- [ ] stage6 資料夾視需要移入 `docs/exec-plan/completed/stage6/`(M16 通過後)。
