## CS2 壓槍軌跡復刻研究計畫

**目標**:在現有 Three.js 練槍軟體中,完整還原 CS2 後座力系統(固定彈道表 + 隨機擴散 + 視角上跳),多武器參數可設定,含軌跡回放與理想壓槍路徑對照。

### Phase 1 — 演算法移植(核心,約 1~2 天)

CS2 後座力是三層架構,全部已從原始碼確認:

1. **固定彈道表**:每把武器用固定 seed(AK-47 = 223)跑 Valve 的 ran1 RNG(Numerical Recipes,IA=16807/IM=2147483647),生成 64 筆 (angle, magnitude)。全自動武器有兩個修正:相鄰彈 Lerp(variance=0.55) 平滑、前 4 發抑制係數從 0.75 漸增到 1.0。移植 `CUniformRandomStream` + `GenerateRecoilTable` 即可 100% 重現官方彈道。
2. **Punch 動力學**(續):開槍時 `KickBack` 把 (angle, magnitude) 分解成 pitch/yaw 加到「角速度」而非角度;每 tick(64Hz)先對 punch 角度做 HybridDecay(指數項 8 + 線性項 18),再以 leapfrog 方式積分角速度(前後各加 vel·dt·0.5),角速度本身以 exp(−4.5·dt) 衰減。視覺上跳另外加 magnitude × 0.055 到 viewPunch。關鍵公式:**實際子彈偏移 = aimPunch × 2.0**(weapon_recoil_scale),射擊角 = 視角 + aimPunch × 2。停火超過 cycletime × 1.1 後,recoil index 以 exp(−dt·ln10·2) 衰減歸零。
3. **隨機不準度**:inaccuracy 分狀態基礎值(站 0.00641 / 蹲 0.00481,AK)+ 每發累積 InaccuracyFire(AK 0.0078),以 exp(−dt·ln10/recoveryTime) 回復;移動附加項 = (速度比例)^0.25 × InaccuracyMove。取樣:θ 均勻、半徑 = U(0,1) × inaccuracy(中心偏置),子彈方向 = forward + x·right + y·up。這層正是 counter-strafe 練習的核心,與你已完成的移動系統直接掛鉤。

### Phase 2 — Three.js 整合設計(約 1 天)

相機角度組成:使用者 yaw/pitch 與 punch 分開存放,渲染時疊加 punch(視覺),射線檢測時用視角 + rawPunch × 2(實際彈道)——兩者分離是 CS2「視覺≠實際」手感的關鍵。共用你現有的 64Hz fixed tick;彈孔用 InstancedMesh;準星可選 cl_crosshair_recoil 跟隨模式。

### Phase 3 — Prototype(約 1~2 天)

單檔驗證工具(先做 2D canvas,不急著進 Three.js):武器參數面板(AK-47 / M4A4 / M4A1-S 預設值取自 CS2 vdata,可編輯)、理論彈道圖、Pointer Lock 練習模式(按住射擊、滑鼠補償)、結束後顯示你的補償路徑 vs 理想路徑(= −aimPunch×2 隨時間的鏡像)與平均角度誤差。驗證通過後才把核心模組移植進 Three.js 專案。

### Phase 4 — 驗證(約 0.5~1 天)

已完成的:抑制係數數學檢查(前 4 發 22.5 / 24.375 / 26.25 / 28.125 = 30 × Lerp(j/4, 0.75, 1) ✓)、AK 軌跡形狀重現(直升 9 發 → 左右之字 ✓)。待做的量化驗證:與社群發布的 pattern 圖逐彈比對、10 發後 punch 值對照(AK 測試向量:pitch −10.18°, yaw −1.56°)、擴散雲半徑在 10m 牆面的角度→公分換算檢查。

### 已確認的武器參數(CS2 現行 vdata)

| 參數 | AK-47 | M4A4 | M4A1-S |
|---|---|---|---|
| seed | 223 | 38965 | 38965 |
| magnitude / variance | 30 / 0 | 23 / 0 | 25 / 3 |
| angle variance | 70 | 70 | 65 |
| cycletime | 0.10 | 0.09 | 0.10 |
| InaccuracyFire | 0.0078 | 0.007 | 0.012 |

主要風險與 caveat:引擎行為取自 CS:GO 洩漏碼,數值取自 CS2 vdata(現行),兩者組合假設 CS2 未改演算法——社群共識是沒改,但 subtick 下開槍時點的內插可能造成微小差異,Phase 4 比對時要留意;另外 view_recoil_tracking(視覺跟隨比例)在 CS2 的對應值尚未確認,只影響視覺不影響彈著。

要開始執行的話,說一聲就從 Phase 1 的 TypeScript 移植動工。