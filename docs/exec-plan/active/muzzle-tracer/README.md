# muzzle-tracer(草稿)— tracer 從槍口射出 + ADS 槍口移置準心下方

> **狀態:DRAFT / 待採納**。沿 [stage4 草稿](../stage4/README.md)先例:**採納前不展開 T-task 子檔、不動 [exec-plan/README.md](../../README.md) §2 索引**。採納時依 GD-15 重編正式 WP 編號(候選 WP-27,見 §7 OQ-MT-1)。
> 上層:[PLAN.md](../../../PLAN.md) · 決議帳本:[DECISIONS.md](../../DECISIONS.md) · 術語:[CONTEXT.md](../../../CONTEXT.md)
> 家族:延伸 **WP-25 tracer**([completed/stage5/wp-25-ballistics-tracer](../../completed/stage5/wp-25-ballistics-tracer/README.md));ADS 沿 **WP-24**([wp-24-ads-optics](../../completed/stage5/wp-24-ads-optics/README.md))。

| | |
|---|---|
| **一句話** | 讓 tracer(子彈軌跡顯示)的**視覺起點**從畫面中心(準心)改為**槍口位置**(hip = 右手持槍位),並在**開鏡(ADS)**時把槍口移到**準心下方**;命中判定與彈道物理**完全不變**(仍從相機中心)。 |
| **性質** | render-only 視覺增強(WP-25 tracer 家族);**非** bug 修復、**非**命中/效度變更。 |
| **對應 FR** | 延伸 FR-E7(tracer 顯示);ADS 消費 FR-E4(`heldAds`)。 |
| **前置相依** | **KI-002 D1 必須先落地**(相機中心 = sim origin = 準心;見 §2 契約 C-0)。 |
| **估時** | ~1.5–2.5 dev-days(T1 hip 0.5–1;T2 ADS 0.5–1 code + ADS 偏移量**實機量測**研究成本另計)。 |

---

## 1. 範圍

**In scope**:
```
src/render/muzzleOffset.ts (新)   ← ADD 槍口偏移常數/設定(hip + ads,view-space 向量)+ 決定性純函式  [T1/T2]
src/loop/SimLoop.ts               ← MODIFY 開火時計算 muzzleOrigin,作為 tracer(shotRays)origin      [T1/T2]
tests/regression/ + src/**test    ← ADD tracer origin 偏移正確 / 命中原點不變 / 決定性 / ADS 切換測試  [T1/T2]
docs/operational/(視需要)        ← MODIFY tracer 視覺語意註記(非匯出欄位)                            [T2]
```

**Out of scope**(明確排除):
- **改命中幾何 / 彈道物理**:raycast 與 projectile spawn 恆從相機中心;本 feature 一律不碰(見 C-1)。永久紅線。
- **可見武器模型 / view-model 動畫**(手臂、槍身 mesh、bob/sway):本 feature 只動 tracer 起點,不建 viewmodel。
- **tracer 進匯出 / 進指標**:`shotRays` 為 render-only 環,不進 export、不進命中語意(WP-25 硬約束)。
- **ADS 偏移量的「正確數值」定案**:程式接線在 In scope;**準心下方偏移量需實機遊戲量測**(OQ-MT-2,研究/量測任務)。
- **子彈對場景幾何互動**(GD-6 紅線,永久排除)。

---

## 2. 關鍵契約

- **C-0(前置)**:KI-002 D1 落地後,相機中心射線原點 = sim origin = 準心。muzzle 偏移是**相對這個修正後的權威中心**定義的;若在 D1 前施作,偏移基準錯誤(z=144),數值白調 → **必須 KI-002 D1 先綠**。
- **C-1(命中權威不動)**:命中/彈道原點恆為 `ballisticOrigin = camera.getWorldPosition()`([SimLoop.ts:142/203](../../../../src/loop/SimLoop.ts#L142));projectile spawn(`arena.ox/oy/oz`,[SimLoop.ts:234](../../../../src/loop/SimLoop.ts#L234))亦不變。**只有 `shotRays` 的 origin 改為 muzzle**——line 從 muzzle → **既有命中/落點 endpoint**,在目標處收斂(真實遊戲做法,方向天然正確)。
- **C-2(render-only,資料安全)**:`shotRays` 環未被 `src/data/` 引用(已核),改 origin 不動任何匯出/指標(WP-25)。tracer 亦是 projectile 的**唯一**視覺(無獨立 bullet view,已核)→ 一套 muzzle origin 同時涵蓋 hitscan 與 projectile tracer。
- **C-3(開火當下凍結,capture-at-fire)**:muzzle 世界座標在**開火 tick**算好寫入 ring(和 endpoint 同時凍結),非顯示時重算 → 開火後轉視角 tracer 不游移,語意乾淨(替代方案見 OQ-MT-3)。
- **C-4(決定性)**:`muzzleOrigin = ballisticOrigin + R(cameraWorldQuat)·offsetVec`,`offsetVec` 為**常數 config 向量**;禁時鐘、禁 `Math.random`。相機朝向來自決定性 aim 狀態 → muzzleOrigin 決定性。熱路徑零配置(複用 scratch `Quaternion`/`Vector3`,GC §4)。
- **C-5(ADS = render 消費旗標,GD-16)**:開火 tick 讀 `state.heldAds` 選 hip / ads 偏移向量。ADS 移動槍口是**純視覺**,不改 `SIM_HZ`、命中幾何、彈道語意;`heldAds` 的事件 + 逐 tick flag 記錄維持 WP-24 現狀。
- **C-6(view-space 偏移)**:`offsetVec` 定義於相機本地座標系(右 = +x、下 = −y、前 = +z),以相機 world quaternion 旋到世界 → 「右手位」隨視角旋轉保持在右手側。

---

## 3. 系統設計摘要

**資料流(開火 tick)**:
```
aim 狀態 ─→ camera(world pos + world quat)
                 │
                 ├─ ballisticOrigin = camera.getWorldPosition()   ── raycast / projectile spawn(命中權威,不變)
                 │
                 └─ muzzleOrigin = ballisticOrigin + Rquat · offsetVec(heldAds ? adsOffset : hipOffset)
                                    └─ pushShotRay(muzzleOrigin → 既有 endpoint)   ── tracer 視覺（render-only）
```

**介面契約(草案)**:
```ts
// src/render/muzzleOffset.ts
export interface MuzzleOffsets {
  hip: readonly [number, number, number];   // view-space 右手位,e.g. [+0.18, -0.12, +0.10]（待 OQ-MT-6 調）
  ads: readonly [number, number, number];   // view-space 準心下方,e.g. [0, -0.05, +0.10]（待 OQ-MT-2 實機量測）
}
// 決定性純函式:寫入呼叫端提供的 scratch out（零配置);不讀時鐘/亂數。
export function computeMuzzleOrigin(
  camPos: THREE.Vector3, camQuat: THREE.Quaternion, ads: boolean, offsets: MuzzleOffsets, out: THREE.Vector3,
): THREE.Vector3;
```
SimLoop 在三個 `pushShotRay` 點([SimLoop.ts:324/353/431](../../../../src/loop/SimLoop.ts#L324))改用 `muzzleOrigin`(取代 `ballisticOrigin` 作為 origin 引數);raycast/spawn 引數不動。

---

## 4. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| 誤把 muzzle 偏移套進 raycast / projectile spawn | 命中幾何偏移、效度破壞 | 測試斷言:raycast 原點 == camera world pos(逐位);projectile arena.ox/oy/oz 不變。C-1 為 DoD 首項 |
| 在 KI-002 D1 前施作 | 偏移基準錯(z=144),數值全錯 | T0 entry-gate 核 KI-002 D1 已綠(C-0) |
| 熱路徑每發配置 Quaternion/Vector3 | 高射速 GC 卡頓汙染量測 | 模組層級 scratch 複用,`computeMuzzleOrigin` 寫入傳入 out(GC §4) |
| offset 引入時鐘/亂數 | 破壞決定性回歸 | offset 為常數 config;決定性 fixture 斷言同輸入逐位一致 |
| ADS 偏移量未經實機驗證即定 | tracer 視覺不真實(但不影響正確性) | OQ-MT-2 標記為研究/量測任務;T2 code 與數值解耦,數值可後補不改介面 |
| tracer 起點與 projectile 物理路徑視覺不符 | 觀感輕微不一致(彈從中心飛、線從槍口起) | 可接受:兩者在 endpoint 收斂;真實遊戲同款妥協。記為設計註記 |

---

## 5. Task 拆解(採納後展開為 T-task 子檔)

| Task | Objective | 相依 | Risk | Cplx | Definition of Done |
|---|---|---|---|---|---|
| **T0 entry-gate** | 核 KI-002 D1 已落地(C-0);拍板 offset config 位置(OQ-MT-1/與 WeaponConfig 解耦)+ hip 偏移初值;登記 ADS 偏移量為量測任務 | KI-002 D1 | Low | Low | KI-002 D1 綠;offset 模組位置與 hip 初值定案;OQ-MT-2 owner/deadline 明確 |
| **T1 hip muzzle tracer** | `muzzleOffset.ts`(hip)+ SimLoop 開火時算 muzzleOrigin 寫 tracer origin;raycast/spawn 不變 | T0 | Med | Low | 測試:tracer origin == camera+旋轉後 hip 偏移;**raycast 原點/ projectile spawn 逐位不變**;決定性 fixture 綠;`tsc --noEmit` 0;`npm run test:ci` exit 0 |
| **T2 ADS muzzle(準心下方)** | offset 依 `heldAds` 切 hip↔ads;ads 偏移量填入實機量測值;沿 WP-24 ADS 過渡 | T1 + OQ-MT-2 | Med | Low-Med | 測試:`heldAds` 切換使 tracer origin 在 hip/ads 間切換;命中原點仍不變;決定性綠;實機截圖佐證 ads 槍口落準心下方;`test:ci` exit 0 |
| **T-exit** | 三不變性(命中/彈道/決定性零改動)+ 視覺驗收;採納入 README §2 索引(GD 一筆) | T1–T2 | — | — | 命中/彈道/export 零 diff 斷言;playwright tracer 視覺 spec 綠;README §2 + DECISIONS 更新 |

### 驗證總表(對應契約)
| 契約 | 驗證 |
|---|---|
| C-1 命中權威不動 | raycast 原點 == camera world pos、projectile spawn 逐位不變(T1/T2 測試 + T-exit 零 diff) |
| C-2 render-only | export/指標 fixture 零改動;`shotRays` 不進 `src/data/`(已核) |
| C-4 決定性 | 同輸入 tracer origin 逐位一致 fixture |
| C-5 ADS render 消費 | `heldAds` 切換只動 tracer origin,SIM_HZ/命中/彈道不變 |

---

## 6. 風險分析

- **命中污染風險(High → 由測試降至 Low)**:唯一嚴重風險 = 偏移不慎套進命中/彈道原點。緩解:C-1 為 DoD 首項,測試逐位斷言 raycast/spawn 原點不變;T-exit 對 export/決定性零 diff。
- **相依風險(Med)**:必須 KI-002 D1 先落地,否則偏移基準錯。緩解:T0 entry-gate 硬性前置檢查。
- **效度風險(Low)**:tracer 純視覺、不進匯出/指標,改起點不影響任何量測資料。
- **經驗成本(Med,非 code)**:ADS「準心下方偏移量」需實機量測(OQ-MT-2);code 與數值解耦,量測結果後補不改介面。
- **有意識妥協**:projectile 物理從中心飛、tracer 從槍口起,兩者在 endpoint 收斂——與真實遊戲同款妥協,可接受。

---

## 7. Open Questions

| # | 問題 | Owner | Deadline | 未解影響 |
|---|---|---|---|---|
| OQ-MT-1 | offset config 放哪?建議 **render 層獨立模組**(與 `WeaponConfig` 解耦,保 weapon config = 命中/彈道語意純淨);若需 per-weapon 槍口再促晉 WeaponConfig | 使用者/實作者 | T0 前 | T1 檔案落點 |
| OQ-MT-2 | **ADS 時槍口相對準心的下方偏移量**(須找遊戲驗證,使用者已點名)——參考實機影格量測像素→world 偏移 | 研究者/使用者 | T2 前 | T2 ads 數值;code 可先接線 |
| OQ-MT-3 | capture-at-fire(C-3,推薦)vs 顯示時重算(tracer 隨視角游移,260ms 壽命影響小) | 實作者 | T1 | muzzle 凍結語意 |
| OQ-MT-4 | hip「右手位」偏移的方向/量值(右/下/前多少)——次要經驗值,可先用合理初值,實機微調 | 使用者 | T1 | hip 觀感 |
| OQ-MT-5 | WP 正式編號與採納入 [exec-plan/README.md](../../README.md) §2(GD-15:候選 WP-27,與 stage4 草稿 on-adoption 保留衝突,先採納先得)→ 採納時記一筆 GD | 使用者 | 採納時 | 索引/編號 |
| OQ-MT-6 | 是否需要 hip↔ads 平滑內插(沿 WP-24 `CameraController` 既有 ADS 過渡因子),或階躍即可 | 使用者 | T2 | T2 過渡觀感 |

---

## 8. 假設(Assumptions)

- **KI-002 D1 已落地**:相機中心 = sim origin = 準心(本 feature 的偏移基準)。
- `shotRays` 為 render-only 環、未進匯出/指標(WP-25;已核 `src/data/` 無引用)。
- 無既有 muzzle / viewmodel 概念(全 repo grep 無)→ 綠地新增,無相容包袱。
- projectile 唯一視覺 = tracer(無獨立 bullet view;已核)→ muzzle origin 一套涵蓋 hitscan + projectile。
- 階段 A 鎖 Chromium 桌面版;Three.js 世界座標,相機朝向由決定性 aim 狀態驅動。
