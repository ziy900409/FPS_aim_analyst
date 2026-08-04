# WP-24 — ads-optics:ADS 開鏡(輸入事件 + zoom/感度 + scope overlay + 記錄)

> stage5 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 決議依據:GD-4(aim 僅觀測)/ GD-5(感度換算慣例)/ 待拍板 **GD-16**(ADS 感度模型,T0)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 武器可開關瞄準鏡(ADS Enabled):`EV_ADS` 輸入事件鏈 + `WeaponConfig.ads` + `CameraController` zoom(FOV + 感度換算)+ scope overlay(DOM)+ **ads 狀態完整記錄**(逐 tick flag + 事件,分析效度必要條件) |
| **里程碑** | —(交付由 M13 驗收清單 E 收斂,比照 stage3 WP-20/21 模式) |
| **相依** | M8 ✅(WeaponConfig/fire 事件模式/感度鏈既有);**可與 WP-23 並行**(無檔案熱區重疊) |
| **對應 FR** | FR-E4 ~ FR-E6 |
| **估時** | 2–3 dev-days |
| **狀態** | ✅ 完成(T0 ✅,T1 ✅,T2 ✅,T3 ✅,T-exit ✅ 2026-07-13) |

---

## 1. 範圍

**In scope**:

```
src/state/types.ts + SharedState.ts   ← MODIFY EV_ADS=3 + pushAds + heldAds 旗標(packed b=down)  [T1]
src/input/InputSampler.ts             ← MODIFY 右鍵 → ads 事件;PointerLock 解鎖補 ads-up(stuck 防護)[T1]
src/input/consume.ts + SimLoop        ← MODIFY ads 事件消費 → heldAds(分桶排序語意不變)           [T1]
src/weapon/WeaponConfig.ts + weapons.ts ← MODIFY ads?: { fovDeg, sensitivityRatio } + validateWeapon [T2]
src/view/CameraController.ts          ← MODIFY setAds(FOV 內插 target + applyDelta gain)            [T2]
src/main.ts / render 佈線             ← MODIFY heldAds → camera/overlay 每幀同步                     [T2/T3]
src/ui/(scope overlay)              ← ADD 純 TS + DOM(D1);開鏡遮罩 + 準心置中不變               [T3]
src/data/DataRecorder.ts + export.ts  ← MODIFY tick row `ads` flag + events `ads`(v2 additive)      [T3]
docs/operational/schema.md            ← MODIFY 對帳                                                  [T3]
```

**Out of scope**:scoped inaccuracy / ADS 移動懲罰 / 呼吸晃動(觸發 = 研究需要 ADS 精度構念)、狙擊鏡倍率切換(單段 zoom 先行)、W/S 移動、toggle 語意(OQ-S5-6 預設 hold,toggle 留 config 候補)。

## 2. 關鍵契約

- **ADS 落點 = 輸入/render/data 層(§1.3 硬約束)**:滑鼠→角度換算在 `CameraController.applyDelta`
  (aim 僅觀測,GD-4),ADS gain 乘在此處——**sim 演進、命中幾何、目標機制零改動**,
  既有決定性 baseline 零重錄。
- **感度換算模型(GD-16,T0 拍板)**:計畫預設 CS2 式——ads 有效感度 =
  `sensitivity × sensitivityRatio × (adsFov / hipFov)`;`sensitivityRatio` 預設 1.0;
  pre-registered 後凍結。跨解析度感度不變斷言(WP-20)沿用。
- **事件鏈比照 fire down/up(WP-11 模式)**:`EV_ADS` packed `b`=down;ring 佈局
  (`type,t,a,b`)不變;`heldAds` 旗標 + stuck-ads 防護(PointerLock 解鎖補送 ads-up);
  事件走既有輸入分桶(`timeStamp` 排序消費)——時間戳語意與 `t_ads` 分析可用。
- **記錄 = 效度必要條件(FR-E6)**:aim 資料已含 gain,離線分析**必須**靠 `ads` flag
  還原構念——tick row `ads` + events `ads`(down/up)為必填記錄,缺記錄 = 測試紅。
- **FOV 過渡為 render-only**:`heldAds` 切換 FOV 目標值,實際 FOV 以 render 幀內插趨近
  (不進 sim);overlay 顯示與 FOV 同步;DOM 準心**必須維持精確置中**(既有 §A 紀律)。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| EV_ADS 擴碼破壞 ring packed 佈局 | 全輸入鏈解碼錯 | 佈局不變(`b`=down);既有 ring/consume 測試零修改全綠為 T1 閘;解碼 golden |
| 右鍵與 contextmenu/瀏覽器手勢衝突 | ads 事件遺漏 | PointerLock 下 `contextmenu` 抑制;T1 手動驗證矩陣(按住/快速點放/解鎖中放開) |
| stuck-ads(解鎖時未補 up) | heldAds 永真 → 之後 drill 全程 ads 汙染 | 比照 stuck-fire 防護同一掛點補送 ads-up;測試覆蓋 |
| gain 作用點錯(疊到 punch 或 sim) | 彈道/視角雙重計入、決定性破壞 | gain 只乘 `applyDelta` 使用者 delta;punch 路徑零改動(CameraController 既有分離註解為準) |
| ads flag 與 heldAds 不同 tick 對齊 | 分析端 ads 窗口偏移 | flag 取 simStep 當 tick 的 heldAds 值(事件分桶後);round-trip 測試斷言事件↔flag 一致 |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | GD-16 感度模型拍板 + OQ-S5-6 hold/toggle + 現況基線 | — | Low |
| **T1** | [T1-ads-input-event.md](T1-ads-input-event.md) | EV_ADS 輸入鏈 + heldAds + stuck 防護(零破壞) | T0 | Med |
| **T2** | [T2-weapon-camera-zoom.md](T2-weapon-camera-zoom.md) | WeaponConfig.ads + CameraController zoom/gain | T1 | Med |
| **T3** | [T3-overlay-recording.md](T3-overlay-recording.md) | scope overlay + tick flag/事件記錄 + schema 對帳 | T2 | Med |
| **T-exit** ✅ | [T-exit-gate.md](T-exit-gate.md) | ADS 鏈交付宣告(WP-26 可消費) | T1–T3 | — |
