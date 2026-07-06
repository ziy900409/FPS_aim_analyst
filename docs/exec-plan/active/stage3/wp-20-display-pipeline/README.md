# WP-20 — display-pipeline:解析度模式 + 資格閘 + frame log + session setup

> stage3 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 決議依據:[DECISIONS.md](../../../DECISIONS.md) **GD-10**(全遠端 + 三道 blocking 防線)/ **GD-8**(frame log 為顯示鏈效度防線)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 顯示管線四件套:解析度模式(顯式 buffer + CSS upscale)、fullscreen + **資格閘**(不合格拒入)、per-frame render-time log、session setup 表單 + `meta.display` |
| **里程碑** | —(M10 前置:WP-22 T2 受試者內 protocol 消費本 WP 全部四件) |
| **相依** | M4 ✅(可並行;只碰 render/UI/data 層) |
| **對應 FR** | FR-C6 ~ FR-C9 |
| **估時** | 3–4 dev-days |
| **狀態** | ⬜ 未開始 |

---

## 1. 範圍

**In scope**:

```
src/display/resolutionMode.ts   ← ADD 模式定義 + applyResolutionMode(DisplayState)      [T1]
src/main.ts                     ← MODIFY resize():顯式 buffer 尺寸 + setPixelRatio(1)  [T1]
src/display/eligibilityGate.ts  ← ADD 資格閘(原生解析度/fullscreen/效能地板)          [T2]
src/ui/(gate 畫面)            ← ADD 拒入畫面(原因明示)+ fullscreen 請求流程          [T2]
src/display/frameLog.ts         ← ADD preallocated frame-time log                        [T3]
src/loop/RenderLoop.ts          ← MODIFY 每幀 push(tMs)(一行掛線)                     [T3]
src/data/export.ts              ← MODIFY frames 區塊(完整序列 + 摘要;v2 optional)     [T3]
src/ui/SessionSetup.ts          ← ADD setup 表單(自陳欄:型號/原生解析度/尺寸/距離)   [T4]
src/data/metadata.ts            ← MODIFY meta.display 填值(自動 + 自陳)                [T1/T4]
```

**Out of scope**:OS 顯示模式切換(瀏覽器做不到,GD-10 語意即「同一面板上的 render 解析度效應」)、對抗平衡排程邏輯(WP-22 T2 protocol config)、fixation gate(GD-8 觸發條件)、監視器規格 API 讀取(不存在;自陳欄為 GD-10 既定妥協)。

## 2. 關鍵契約

- `ResolutionMode`/`DisplayState`/`applyResolutionMode`/`runEligibilityGate`/`FrameLog`
  簽名:[../README.md §2.3](../README.md)。
- **解析度語意**:`fhd-1080`/`qhd-1440` = **render buffer** 尺寸;CSS 恆全螢幕(compositor
  upscale)。`setPixelRatio(1)` + 顯式 `setSize(w, h, false)`——繞開 `devicePixelRatio` 與
  Windows DPI 縮放的隱式縮放。既有 `Math.min(dpr, 2)` 路徑保留為 `native` 模式。
- **不變式(斷言級)**:DOM 準心置中(CSS 定位,與 buffer 無關;CONTEXT §A)、感度角度制
  跨解析度不變(`0.022°/count` 不含像素項)、**sim 狀態序列跨解析度逐位一致**(FR-C15 由
  WP-22 T3 收斂,本 WP 先留單元級斷言)。
- **資格閘(GD-10 防線①)**:`screen.width/height × devicePixelRatio ≥ 實驗最高條件`、
  `document.fullscreenElement` 存在、warmup 探測 p95 ≤ `PERF_FLOOR_MS`(OQ-S3-1);
  三項全過才可進**實驗 session**;不合格顯示原因並拒入(一般練習不受限)。
- **frame log(GD-10 防線③ 之自動 metadata)**:preallocated `Float64Array`,容量
  `maxDrillSeconds × MAX_DISPLAY_HZ(240)`;滿 = 停記 + 旗標(arena 紀律);drill 中
  p95 超地板 → `suspect`。
- `meta.display` 自動欄 = `DisplayState` + `screenW/screenH`;自陳欄 = setup 表單
  (`monitorModel?/panelInches?/nativeW?/nativeH?/viewingDistanceCm?`)——moderator 用,
  不承擔混淆控制(GD-10)。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| Windows DPI 縮放(125%/150%)使原生解析度判斷錯 | 資格閘誤放/誤擋 | T2 DPI 矩陣手動驗證;gate `details` 全量記 meta 供事後審查 |
| frame log push 配置物件 | GC 卡頓汙染 frame time 自身 | preallocated + 游標;測試斷言熱路徑零配置(比照 arena) |
| upscale 下 UI/準心模糊或偏位 | 量測參考失真 | 準心為 DOM(不受 buffer 影響)——T1 實機驗證三模式準心置中截圖記 progress |
| 使用者中途退出 fullscreen | 條件失效而資料照收 | fullscreenchange 監聽 → 實驗 session 標 `suspect` + UI 警示 |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | GD-10 收斂 + 效能地板起點(OQ-S3-1)+ WP-16 display 縫對帳 | — | Low |
| **T1** | [T1-resolution-modes.md](T1-resolution-modes.md) | 解析度模式 + 顯式 buffer 控制 + display 自動 meta | T0 | Med |
| **T2** | [T2-fullscreen-eligibility-gate.md](T2-fullscreen-eligibility-gate.md) | fullscreen 流程 + 資格閘(拒入) | T1 | **High** |
| **T3** | [T3-frame-time-log.md](T3-frame-time-log.md) | frame log + frames 匯出 + 效能地板 suspect | T1 | Med |
| **T4** | [T4-session-setup-form.md](T4-session-setup-form.md) | session setup 表單 + 自陳欄進 meta | T1 | Low |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | 四件套交付宣告(WP-22 T2 可消費) | T1–T4 | — |
