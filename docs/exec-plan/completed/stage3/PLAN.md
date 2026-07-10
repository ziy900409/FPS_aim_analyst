# 階段 C 執行計畫(大框架)— 研究場景與感知實驗

> 對應上層:[docs/PLAN.md](../../../PLAN.md)(階段 A 大框架)、[stage2 README](../stage2/README.md)(階段 B tech spec)。
> 本文件為 stage3 的「**大框架執行計畫**」:研究決策以 [DECISIONS.md](../../DECISIONS.md) **GD-6 ~ GD-10** 為準,tech spec(FR-C1~15、介面契約、failure modes、OQ)以本資料夾 [README.md](README.md) 為 **source of truth**;本檔提供 PLAN 視角——目標、架構定位、agent 可執行的階段步驟、風險——供快速理解與人工排程。
> 導航見 [MAP.md](MAP.md)。專有名詞見 [CONTEXT.md](../../../../CONTEXT.md)(2026-07-06 已收錄本階段全部新術語)。

---

## 0. 一句話目標

在既有訓練器上加入**寫實原創 BR 場景**(資料驅動可置換、純裝飾、淨空驗證)與**顯示管線**(解析度模式 + 資格閘),交付兩個感知實驗:**追蹤能力評估**(移動目標 × 場景,消費 stage2 WP-18)與**解析度 × 察覺**(受試者內 pop-in 偵測)——所有指標離線推導,**sim 熱路徑零侵入、既有決定性 baseline 不重錄**。

---

## 1. 決策依據(GD-6 ~ GD-10;本階段的 D1–D5 對應物)

> 五筆決議於 2026-07-06 grill 拍板,完整條目(理由/排除選項/失效防範)見 [DECISIONS.md](../../DECISIONS.md)。本表只給執行視角的一句話。沿用階段 A 的 D1–D5(UI 純 TS + DOM、Vitest + Playwright 等)不變。

| # | 決策點 | 結論 | 對執行的意義 |
|---|---|---|---|
| GD-6 | 場景遮擋路線 | **純裝飾場景 + 淨空驗證**(載入期幾何 gate,相交拒載);mesh 衍生 collision 永久排除 | 場景幾何永不進 sim → 決定性 baseline 不分裂、換場景零引擎碼;淨空驗證器(WP-19 T3)是本階段幾何正確性的全部 |
| GD-7 | 追蹤指標(OQ-S2-5 解決) | 獲取/追隨**指標層**分離:`t_acquire` + 追蹤窗口內 **TOT% / RMS(ε)**;原始資料全記錄 | 指標零引擎計算(離線推導);逐 tick 位置欄落 WP-16 schema v2;WP-18 門控只剩 M8 |
| GD-8 | 偵測操作化 | **pop-in** 刺激(`t_visible` = spawn tick 語意不變)+ `t_detect` = 瞄準移動 onset(離線)+ 偏心度共變數 | 偵測 drill 只需 seeded spawn(WP-21);slide-in 判準已預存、待 occluder 路線 C 觸發才實作 |
| GD-9 | 場景資產 | **寫實原創**(不復刻特定地圖)+ 雜亂度階層規格;授權 CC0/CC-BY、NC/遊戲抽取排除 | 資產可直接 commit(public repo);場景 = 有版本的 config 資料(`sceneId`/`assetPackVersion` 進 meta) |
| GD-10 | 顯示硬體 | **全遠端 + 三道 blocking 防線**:軟體資格閘(不合格拒入)、受試者內對比、metadata 地板 | 實驗構念 =「同一面板上的 render 解析度效應」;資格閘/frame log/setup 表單是 WP-20 的四件套 |

---

## 2. 技術棧(新增項;其餘沿用階段 A/B)

| 類別 | 選型 | 來源 |
|---|---|---|
| 場景資產 | GLTF(`GLTFLoader`,three/addons)+ CC0/CC-BY 資產 + `ATTRIBUTIONS.md` 稽核 | GD-9 |
| 場景幾何 | render-only;`propBounds` AABB 清單僅供載入期驗證器,**永不進 sim** | GD-6 |
| 淨空驗證 | 純數學 slab test(線段 vs 膨脹 AABB),零相依、drill 載入時執行 | GD-6 / [README §2.4](README.md) |
| 解析度 | 顯式 render buffer(`setSize(w,h,false)` + `setPixelRatio(1)`)+ CSS 全螢幕 upscale | GD-10 |
| 全螢幕 | Fullscreen API(user gesture 觸發;`fullscreenchange` 監聽退出) | GD-10 |
| 隨機性 | `createRan1` seeded stream(**重用** [src/recoil/rng.ts](../../../../src/recoil/rng.ts),零相依) | GD-5 延伸 |
| frame 量測 | preallocated `Float64Array` frame log(rAF timestamp;GC 紀律同 arena) | GD-8/GD-10 |

---

## 3. 架構總覽

### 3.1 stage3 疊在三迴圈架構上的位置

| 層 | stage3 新增/異動 | 侵入性 |
|---|---|---|
| 輸入(~1000 Hz) | **無變更** | 零 |
| 模擬(128 Hz) | `TargetManager` seeded spawn——**唯一 sim 觸點**;無 seed 路徑逐位不變 | 最小(零破壞不變式把關) |
| 渲染(rAF) | `SceneManager` 接 `SceneConfig`、GLTF 管線、解析度模式、frame log push | 主戰場 |
| 資料 | `meta.scene`/`display`/`spawn` + `frames` 區塊——全部 **v2 additive optional**,不二次斷代 | additive |
| **載入期(新概念層)** | `validateScene` → `validateClearance` → 資格閘——drill/session 開始**前**的 gate,不進任何迴圈 | 新增但不進熱路徑 |

> 雙迴圈邊界(ADR-2)不變:場景圖/解析度/frame log 全在 render 側;`propBounds` 的資料流終點是驗證器,`src/sim` 不得 import `src/scene`(架構閘測試,WP-19 T1)。

### 3.2 元件 → 功能對照

| 元件(新) | 對應 FR | WP |
|---|---|---|
| `SceneConfig` / `validateScene` | FR-C1 | WP-19 T1 |
| `sceneLoader`(GLTF + dispose + fallback) | FR-C2 | WP-19 T2 |
| `clearance`(淨空驗證器) | FR-C3 | WP-19 T3 |
| `resolutionMode` / `DisplayState` | FR-C6 | WP-20 T1 |
| `eligibilityGate`(資格閘) | FR-C7 | WP-20 T2 |
| `frameLog` | FR-C8 | WP-20 T3 |
| `SessionSetup`(自陳表單) | FR-C9 | WP-20 T4 |
| `TargetManager` seeded spawn | FR-C10 | WP-21 T1 |
| `detection_popin_v1`(偵測 drill) | FR-C11 | WP-21 T2 |
| `analysis-t-detect.md`(離線推導 spec) | FR-C12 | WP-21 T3 |
| `ProtocolRunner`(條件序列執行器) | FR-C14 | WP-22 T2 |

### 3.3 兩個關鍵論證(整個階段站在上面)

1. **淨空等價性(GD-6d)**:視線走廊與所有 prop 不相交 ⇒ 對場景 raycast 與無場景**逐位元等價** ⇒ sim 不需場景知識、決定性不分裂。這把「視覺=物理一致性」從 runtime 機械(1+ WP)換成載入期幾何證明(~1 dev-day),且不靠人工紀律。
2. **受試者內對比(GD-10)**:每人同面板跑全部解析度條件 ⇒ 面板 PPI/尺寸/觀看距離/scaler 在對比中一階抵銷 ⇒ 全遠端施測方法學上可辯護——但**資格閘是前提**(FHD 面板的「QHD 條件」= 降階超取樣 = 方向性錯誤資料,必須拒入而非記錄)。

---

## 4. 里程碑

| 里程碑 | 完成條件 | 對應 WP | 意義 |
|---|---|---|---|
| **M9** | 場景可置換(≥2 雜亂度階層)+ 淨空驗證拒載 + 跨場景 sim 決定性逐位一致 + attribution 可稽核 | WP-19 | 場景脊椎:「換場景零引擎碼」「場景不碰決定性」被測試釘死;**未過不進 WP-22** |
| **M10** | 驗收清單 C 全項通過 | WP-22 | **stage3 交付**:兩實驗 pilot-ready |

---

## 5. 執行階段(WP-19 ~ WP-22)

> 每個 WP 標示:目標、agent 可執行步驟(對應 task 檔,權威版在各 WP 資料夾)、驗收、相依、估時。

### WP-19 場景系統 — 4–6 天 ★M9

- **目標**:場景 = 資料驅動、可置換、render-only,淨空驗證自動把關。
- **步驟**
  1. `SceneConfig` schema + `validateScene` + 佔位房間收編為 config(`asset: null`,fallback 同路徑)。 *(19.1, ← GD-6/9)*
  2. GLTF async 管線(dispose/fallback)+ `field-low` 寫實場景 + `ATTRIBUTIONS.md`。 *(19.2, ← 19.1;資產選型 = T0 的 OQ-S3-3)*
  3. 淨空驗證器(視線走廊 slab test)+ `DrillLoader` 違規拒載(指名 prop)。 *(19.3, ← 19.1;可與 19.2 並行)*
  4. 場景切換 UI + `meta.scene` + **跨場景決定性斷言** + 走廊逸出 `suspect`。 *(19.4, ← 19.2, 19.3)*
  5. `urban-high` 第二場景(雜亂度對照)+ 兩場景負載驗證。 *(19.5, ← 19.4)*
- **驗收(M9 四證據)**:置換 ×2 / 拒載(對抗性 fixture)/ 跨場景決定性 / attribution 稽核。
- **相依**:M4 ✅(可與 stage2 尾段並行;不碰 recoil 鏈檔案)。

### WP-20 顯示管線 — 3–4 天

- **目標**:解析度成為可控實驗條件,GD-10 三道防線的機械落地。
- **步驟**
  1. 解析度模式(`native`/`fhd-1080`/`qhd-1440`:顯式 buffer + CSS upscale)+ `meta.display` 自動欄。 *(20.1)*
  2. Fullscreen 流程 + **資格閘**(原生解析度/fullscreen/效能地板;不合格拒入)+ DPI 矩陣驗證。 *(20.2, ← 20.1)*
  3. per-frame render-time log(preallocated)+ `frames` 匯出 + 效能地板 `suspect`。 *(20.3, ← 20.1;與 20.2 並行)*
  4. session setup 表單(型號/原生解析度/尺寸/距離自陳,moderator-only)。 *(20.4, ← 20.1)*
- **驗收**:四件套齊 + 三斷言(準心置中/感度無像素項/sim 跨模式不變)+ DPI 矩陣三檔全對。
- **相依**:M4 ✅(可並行)。

### WP-21 偵測 drill — 2.5–3.5 天

- **目標**:偵測實驗的機械與資料鏈;`sequence.seed` 從保留欄變成活的。
- **步驟**
  1. seeded spawn:schema 擴欄(`spawnArea`/`spawnDelayMsRange`)+ `TargetManager` 注入 ran1——**零破壞不變式**(無 seed 路徑逐位不變)為 DoD 首項。 *(21.1)*
  2. `detection_popin_v1` drill config + spawn 事件位置欄 + `meta.spawn`。 *(21.2, ← 21.1)*
  3. `t_detect`/偏心度**離線推導 spec** + round-trip fixture(合成已知 onset → 推導誤差 ≤ 1 tick)。 *(21.3, ← 21.2 + **WP-16**)*
- **驗收**:零破壞 / 同 seed 重現 golden / 推導 round-trip ≤ 1 tick。
- **相依**:21.1/21.2 獨立;**21.3 需 WP-16**(schema v2 逐 tick 位置欄)。

### WP-22 感知實驗整合 — 2–3 天 ★M10

- **目標**:兩實驗端到端成立,防線收斂,交付。
- **步驟**
  1. 追蹤 drill × BR 場景(消費 **WP-18**)+ E2E + 指標 sanity(合成極端輸入)。 *(22.1, ← WP-18, WP-19)*
  2. `ProtocolRunner`(資格閘 → setup → 條件序列 → 匯出;條件級 `suspect`)+ 受試者內解析度 × 偵測 E2E + 拒入路徑 E2E。 *(22.2, ← WP-20, WP-21)*
  3. 決定性回歸擴充(跨場景/跨解析度/seeded 重現三不變性)+ **驗收清單 C** + pilot protocol 文件。 *(22.3, ← 22.1, 22.2)*
- **驗收**:清單 C 全項通過(= M10)。
- **相依**:WP-19(M9)、WP-20、WP-21 + **WP-18(stage2,M8 後)**。

---

## 6. 關鍵路徑與估時

```
WP-19(場景,M9)────────────────┐
WP-20(顯示管線)────────────────┼→ WP-22(整合,M10)= stage3 交付
WP-21(偵測;21.3 需 WP-16)─────┤
WP-18(F5;stage2,M8 後)────────┘
```

| 工作包 | dev-days |
|---|---|
| WP-19 ~ WP-22 | **11.5–16.5**(≈2.5–3.5 週) |
| (WP-18,stage2 另計) | +2–3.5 |

> 三線(WP-19/20/21)可並行,皆不碰 stage2 recoil 鏈熱區;建議排程點 = stage2 M6(**✅ 2026-07-06 已達成**)。WP-22 等 M8 + WP-18——若 stage2 主鏈順利,整體約與 WP-14~17 交錯進行。

---

## 7. 測試策略(對應 D2,stage3 新增層)

| 層級 | 工具 | 涵蓋 |
|---|---|---|
| 幾何正確性 | Vitest(純函式) | 淨空驗證對抗性 fixture:恰相交紅 / 恰不相交綠 / 背後 prop 不誤擋 / motion 極值相交(19.3) |
| 決定性(新三條) | Vitest(合成輸入重播) | 跨場景一致、跨解析度一致、同 seed spawn 重現;**既有 stage1/2 baseline 全綠維持**(22.3) |
| 推導對齊 | Vitest(round-trip) | 合成 aim 流 → recorder → export → t_detect 推導,誤差 ≤ 1 tick(21.3) |
| 資格閘 | Vitest(mock 矩陣)+ 手動 | screen/dpr/fullscreen 組合;**Windows DPI 100%/125%/150% 實機矩陣**(20.2) |
| E2E | Playwright | 追蹤×場景、受試者內 protocol 全流程(兩條件 + 拒入路徑 + 條件隔離)(22.1/22.2) |
| 負載 | 實機 + frame log | 兩場景 × 移動目標無掉 tick;三解析度 frame 分佈(19.5/20.3) |

---

## 8. 風險與緩解(重點,詳見 [README §7](README.md))

| 風險 | 緩解 |
|---|---|
| 場景資產壓垮 render(**High**) | T0 選型即驗負載、資產預算記 config、frame log 外顯、效能地板 `suspect` |
| 淨空驗證幾何錯(**High**) | 保守過近似 + margin 常數 + 對抗性 fixture;等價性論證記 schema.md 供審查 |
| 資格閘跨硬體誤判 | DPI 矩陣手動驗證;gate `details` 全量記 meta,誤放可事後偵測 |
| WP-16/WP-18 時程拖住 21.3/22.x | task 級相依明確(T0 gate);WP-19/20 + 21.1/21.2 不受影響可先交付 |

---

## 9. 明確不在範圍(階段 C)

宣告式 occluder / slide-in 偵測(判準已預存 GD-8,觸發後另立 WP)、fixation gate(GD-8 觸發條件)、特定地圖復刻與熟悉度研究(GD-9 排除;需要時走授權或原版遊戲實驗臂)、眼動儀、付費資產管線、多受試者管理/上傳後端(本地匯出檔為邊界,規格 §14)、分析 pipeline 本體(21.3 的 spec 即介面)、`mid` 雜亂度第三場景(實驗設計需要時再加)。

---

## 10. 階段 C+ 預留(不在本次交付)

- **宣告式 occluder(GD-6 路線 C)**:prop-bounds 資料即前身;觸發 = 研究需要躲藏(reacquisition)/擋彈/LOS 自動 `t_visible` 任一。
- **slide-in 偵測 drill**:判準已釘死(目標中心穿越宣告邊界 tick 蓋 `t_visible`,GD-8);隨 occluder 落地。
- **fixation gate**:偏心度受控版;代價 = aim 成為 sim 演進輸入(GD-4 契約變更),pilot 證明共變數不夠再議。
- **熟悉度研究**:授權取得或受試者玩原版遊戲的獨立實驗臂(GD-9)。
