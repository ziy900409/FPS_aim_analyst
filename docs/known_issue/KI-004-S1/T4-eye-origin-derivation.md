# T4 — 離線推導 eye pose 契約 + 正確性閘 ① / ②

> 交付 **FR-S1-5 / 6 / 7 / 9 / 10**(KI-004 §5.1 S1 ③ + §6 兩道新閘)· 上游:[S1 README §2.3 / §2.3a / §2.5](README.md)
> 依賴:**T3 已 commit**(且 T2 的 `meta.simToWorld` / `meta.scene.eye` 已在匯出中 ⇒ `'meta'` 分支可實測)。
> **風險等級:High** —— 這是 S1 唯一會改變已交付數值的切片,且必然波及一批目前綠的測試(R-1 / FM-2)。

**In scope**:`src/metrics/eyeOrigin.ts`(新檔)· `trackingDerivation.ts` · `detectionDerivation.ts` · `fpsTestHarness.ts` · 閘 ①/閘 ② 的 TS 測試 · [analysis-tracking.md](../../operational/analysis-tracking.md) / [analysis-t-detect.md](../../operational/analysis-t-detect.md) 的**射線原點段落**。
**Out of scope**:Python 側(T4)· 匯出欄位(S2)· 兩份 prose spec 的單位敘述全面對帳(S3)。

---

## 缺陷回顧

[trackingDerivation.ts:191-193](../../../src/metrics/trackingDerivation.ts#L191) 與 [:222-224](../../../src/metrics/trackingDerivation.ts#L222)(`detectionDerivation.ts:190-194` 為同一份實作):

```ts
const ox = tick.px;            // source unit
const oy = options.eyeHeight;  // 1.6 → world unit
const oz = tick.pz;            // source unit
const dx = target.x - tick.px; // world unit − source unit  ❌
```

兩個**獨立**缺陷:

| # | 缺陷 | 條件 | 08:03 實測 | 09:39 實測 |
|---|---|---|---|---|
| **D2a** | 遺漏 camera base offset(`field-low` 的 `eyeZ = 4`) | **恆成立,與 `px` 無關** | 12.52°(max 12.73) | — |
| **D2b** | 遺漏 `SIM_TO_WORLD` | 僅 `px ≠ 0` | — | 疊加後 67.11°(max 88.55) |

正確公式的殘差:0.21° / 0.14°(來源 = fire 時間戳 vs 最近 tick 的取樣差,非系統性偏差)。

---

## Steps

### 1. 紅測試先行 —— 閘 ①(`fire.offsetDeg` oracle)

> **這是 S1 最有價值的單一產出**。`offsetDeg` 是引擎在開火當下用**真實 camera** 算出的「準心 → 目標中心」夾角([SimLoop.ts:408](../../../src/loop/SimLoop.ts#L408) `targetCenterOffsetDeg`),與 ε(t) 是**同一構念、不同實作路徑、不同資料來源**。此閘若早存在,D2a 與 D2b 第一天就會被抓到。

- [ ] 新增 `tests/golden/research/epsilon-offsetdeg-oracle.test.ts`,對兩份真實 fixture 各跑一次:

```
篩選:F.type === 'fire' && F.offsetDeg !== undefined
     && (F.aimPunchPitch ?? 0) === 0 && (F.aimPunchYaw ?? 0) === 0
選 tick:T = argmin_t |tick.t − F.t|                          ← 口徑見 OQ-S1-3
斷言 A:合格 fire 數 > 0                                       ← 防空跑假綠
斷言 B:每個合格 fire,|ε(T, target) − F.offsetDeg| ≤ 0.5°
輸出:median / max 偏差(失敗訊息要看得到實際數字)
```

- [ ] `target` 取用與 derivation 相同的解析路徑(tick 的 `tx/ty/tz`,缺則 `visible.targetX/Y/Z`),**不要**在測試裡另建一套目標解析。
- [ ] 兩份真實 fixture 是 **pre-S1 匯出**(刻意不補欄,見 T2),故測試必須以**顯式** `eyeBase`(來自 `resolveEyeWorldBase(field-low config)`)+ `simToWorld` 呼叫 derivation。這同時讓 `'explicit'` 分支與「pre-S1 相容路徑」持續受測。
- [ ] 在工作區實跑,**證實為紅**(08:03 應約 12.5°、09:39 約 67°),輸出貼進 [progress.md](progress.md)。

### 2. 紅測試先行 —— 閘 ②(閉式幾何 fixture)

- [ ] 新增測試涵蓋 **`eyeBase.z ≠ 0` 且 `px ≠ 0`** 的交叉情境(現行 WP-28 T2 幾何 fixture 全為原點 `(0,·,0)` 的靜態情境,**結構上看不見這個 bug**):

```
eyeBase = (0, 1.6, 4)、simToWorld = 0.01、px = 169.25、pz = 0
target  = (2, 1.5, −4)、aim yaw/pitch 給定
expected = 閉式解手算的向量夾角(以常數寫死)
斷言:|actual − expected| / |expected| ≤ 1e-9
```

- [ ] 同一組數字**必須**在 T4 的 Python 版逐位重用(FM-3:兩側各自對閉式解,而不是互相對表)。
- [ ] 至少再加一組 `pz ≠ 0` 與一組 `eyeBase.z = 0`(退化為舊行為)的案子,確認新公式在 `base = 0` 時**逐位**等同舊實作乘上 `simToWorld`。

### 3. `eyeOrigin.ts` 共用模組

- [ ] 依 [README §2.3 / §2.3a](README.md) 契約新增 `src/metrics/eyeOrigin.ts`:`EyeOriginOptions` / `EyeOriginSource` / `ResolvedEyeOrigin` / `resolveEyeOrigin` / `eyeOriginForTick`。
- [ ] 解析優先序:`explicit` → `meta`(T2 起的匯出皆有)→ `legacy-default`。
- [ ] **`'meta'` 分支的成立條件**:`meta.simToWorld` 為正有限數 **且** `meta.scene?.eye` 三分量皆有限。**只拿到一半視為 miss**,退 `legacy-default` —— 半猜半讀比全猜更難察覺(FM-1b)。
- [ ] **fallback 語意(重要)**:`legacy-default` = `{ x: 0, y: eyeHeight ?? 1.6, z: 0 }` **且仍套用 `SIM_TO_WORLD`**。理由:D2b 的因子是全域引擎常數、**可知**;只有 `base.z`(D2a)無法從 pre-S1 匯出還原。fallback 不得原樣保留舊的錯誤行為。
- [ ] `strictEyeOrigin === true` 且落到 `legacy-default` → 拋錯,訊息須指名「此匯出無 `meta.scene.eye` / `meta.simToWorld`(pre-S1),請顯式提供 `eyeBase`(見 KI-004 §2.3)」。
- [ ] 補 `resolveEyeOrigin` 的單元測試:三條優先序路徑各一、**「只有一半 meta」退 fallback** 一條、strict 拋錯一條、`source` 欄位值正確一條。
- [ ] 補 round-trip 測試(G-7):以 harness 產生的**新**匯出跑 derivation,**不傳任何 options**,斷言 `options.eyeOrigin.source === 'meta'` 且 `base` 等於該場景的 `resolveEyeWorldBase`。這條是「匯出真的自我描述了」的唯一證明。

### 4. 兩個 derivation 接上

- [ ] `trackingDerivation.ts`:`isOnTarget` 與 `angularEccentricityDeg` 改吃 `ResolvedEyeOrigin`;原點由 `eyeOriginForTick(tick, resolved)` 產出。
- [ ] `detectionDerivation.ts`:刪掉自己那份 `angularEccentricityDeg` / `aimForward`,改引用 `eyeOrigin.ts` 的共用實作 —— KI-004 §2.3.1 明記兩檔是「同一份實作」的複製,S1 順手消除。
- [ ] 兩者的 `Resolved*Options` 加上 `eyeOrigin: ResolvedEyeOrigin`(FR-S1-6);`eyeHeight` 保留為 `eyeOrigin.base.y` 的別名(TD-2,S3 移除)。
- [ ] **`hitbox` 來源不動**(C-5 / GD-7):仍走 `meta.targets.hitbox` → options → `DEFAULT_TARGET_HITBOX`,不新增第二套尺寸常數。

### 5. harness 路徑

- [ ] [fpsTestHarness.ts:544](../../../src/testharness/fpsTestHarness.ts#L544) 的 `trackingMetricsFromExport` 呼叫 `deriveTrackingMetrics(payload)`(無 options)。T2 之後 harness 產生的 payload **自帶** `meta.scene.eye` + `meta.simToWorld` ⇒ **維持不傳 options**,讓它實際走 `'meta'` 分支 —— 這正是 G-7 要證明的事。
- [ ] 若 harness 的匯出路徑未填入新 meta(例如自建 payload),補上;**不要**改成顯式傳參繞過,那會讓 `'meta'` 分支在 e2e 完全不受測。
- [ ] 這會改動 `tests/e2e/br-tracking.spec.ts`(WP-23 M11 的「推導誤差 ≤ 1 tick」round-trip)的數值。**逐條檢視**:新值應該**更接近**引擎真值;若反而變差,停下來查,不要調寬容差。

### 6. 既有期望值的處置(FM-2 硬規)

- [ ] T0 盤點清單中每一條「預期變動」的測試,逐條書面歸因:**舊值錯在哪(D2a / D2b / 兩者)、新值為何正確**,寫入 [progress.md](progress.md)。
- [ ] **禁止**為了讓測試轉綠而放寬任何容差。若某條測試無法歸因,視為修法有誤,回頭查。
- [ ] 決定性回歸與 sim 相關測試若有**任何**變動 ⇒ 違反 NFR-S1-1,立即停。

### 7. prose spec 同步(C-4,權威不得分裂)

- [ ] [analysis-tracking.md](../../operational/analysis-tracking.md) 的 **Coordinate Convention** 段落:`p_eye = (px, eyeY, pz)` 與「`eyeY` defaults to `1.6` source units」改寫為 world domain 的 `p_eye = base + (px, 0, pz) × simToWorld`,並說明 `base` 來自 `meta.scene.eye`、`simToWorld` 來自 `meta.simToWorld`,pre-S1 匯出缺欄時須由呼叫端顯式提供(並標記 `legacy-default`)。
- [ ] [analysis-t-detect.md](../../operational/analysis-t-detect.md) 的對應段落同步。
- [ ] **只改射線原點的定義**;「Target/player positions are source units」這類全域單位敘述的對帳留 **S3**(該敘述本身也是錯的,但改它會牽動 `CONTEXT.md`,屬 S3 範圍)。在改動處留一行 `TODO(S3)` 指路。

### 8. 回歸

- [ ] `npx tsc --noEmit`
- [ ] `npm run test:ci` —— `epsilon-parity.test.ts` 此時**預期為紅**(TS 已修、Python fixture 未重產),這是 T4 的入口條件,必須在 progress 明記,**不得**在本 task 用 skip 掩蓋。

> ⚠️ **commit 顆粒度**:repo 硬規「每個 commit 綠」與「T4 改完 parity 必紅」衝突。**處置**:比照 BD-001 的偏離慣例,把 **T4 + T5 合併為單一已驗證綠的 commit**(TS 修法 + Python 同步 + fixture 重產一起落地)。T4/T5 仍為兩個獨立的執行階段與 DoD 清單,但只產出一個 commit。此偏離須記入 [progress.md](progress.md) 與 BD-004。

---

## Definition of Done

- [ ] 閘 ① 與閘 ② 在修法前於工作區**證實為紅**,實測數字(08:03 ≈ 12.5°、09:39 ≈ 67°)貼在 progress.md。
- [ ] 修法後閘 ① 綠:兩份 fixture 的全部合格 fire `|ε − offsetDeg| ≤ 0.5°`,且合格樣本數 > 0。
- [ ] 修法後閘 ② 綠:閉式解相對誤差 ≤ 1e-9;含 `base.z = 0` 的退化案。
- [ ] `eyeOrigin.ts` 為 ε(t) / on-target 幾何的**唯一** TS 實作;`detectionDerivation.ts` 內的重複 `angularEccentricityDeg` / `aimForward` 已刪除。
- [ ] `strictEyeOrigin` 的拋錯路徑有測試;`ResolvedEyeOrigin.source` 三種值各有測試覆蓋;「只有一半 meta」退 fallback 有測試(FM-1b)。
- [ ] **G-7 round-trip**:不傳 options 消費 T2 之後的新匯出,`source === 'meta'` 且 `base` == 該場景的 `resolveEyeWorldBase`。
- [ ] harness 維持不傳 options(走 `'meta'`);`br-tracking.spec.ts` 的 round-trip 斷言逐條檢視且**未放寬容差**。
- [ ] 所有變動的既有期望值皆有書面歸因(progress.md),決定性/sim 相關測試零變動。
- [ ] `analysis-tracking.md` 與 `analysis-t-detect.md` 的射線原點定義已與 TS 實作一致,並留 `TODO(S3)` 指路。
- [ ] `npx tsc --noEmit` exit 0。`npm run test:ci` 除 `epsilon-parity.test.ts` 外全綠(該條由 T5 收尾;合併 commit 前不得留紅)。

## Commit message

> T4 與 T5 合併為單一 commit(見上方 ⚠️);commit message 見 [T5](T5-python-parity-sync.md)。
