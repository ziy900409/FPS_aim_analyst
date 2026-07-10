# WP-16 — metrics-export-v2:schema v2 + 壓槍指標

> stage2 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../../../completed/stage2/README.md) · [研究計畫 Phase 3](../../../completed/stage2/CS2%20壓槍軌跡復刻研究計畫.md)(對照工具)的呈現部分併入本 WP。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 匯出 schema v2(fire 事件擴欄 + meta 擴欄 + `schemaVersion` bump)+ 壓槍補償指標(補償路徑 vs 理想路徑 `−aimPunch×2` 鏡像)+ 結果頁軌跡對照 |
| **里程碑** | —(M8 前置:WP-17 全鏈路 E2E 消費本 WP 匯出) |
| **相依** | WP-13(M6;punch/spread 資料源) |
| **對應 FR** | FR-B14(schema v2)、FR-B15(壓槍指標) |
| **估時** | 2–3 dev-days |
| **狀態** | ✅ 完成(2026-07-07)— schema v2 + 壓槍指標交付;不變式/溢位/對帳全綠 |

---

## 1. 範圍

**In scope**:

```
src/data/DataRecorder.ts    ← MODIFY fire 事件擴欄 + arena 容量重估(capacityForDrill) [T1]
src/data/metadata.ts        ← MODIFY meta 增 weaponId/weaponSeed/rngSeed/schemaVersion   [T1]
src/data/export.ts          ← MODIFY v2 匯出 + 統計=匯出不變式維持                       [T1]
src/drill/schema.ts         ← MODIFY DrillConfig.weaponId? 選填欄(validateDrill 更新)  [T1]
docs/operational/schema.md  ← MODIFY v2 欄位對帳                                         [T1]
src/metrics/compute.ts      ← ADD 理想路徑產生器 + 補償誤差(mean/RMS 角度)             [T2]
src/ui/ResultScreen.ts      ← MODIFY 軌跡對照呈現(DOM overlay,D1)                     [T3]
```

**Out of scope**:殘速/過衝連續化(WP-14 T3;對帳點互指)、視角逐 tick 重建
([../README.md §2.5](../../../completed/stage2/README.md) 政策 = 記錄而非重建)、舊資料回溯轉換(schemaVersion 斷代即可)。

## 2. 關鍵契約

- fire 事件擴欄(FR-B14):`viewYaw/viewPitch/aimPunchPitch/aimPunchYaw/spreadX/spreadY/recoilIndex/ammo`。
- meta 擴欄:`weaponId/weaponSeed/rngSeed/sensitivityModel/movementModel/schemaVersion`;
  **`schemaVersion` bump 落本 WP**(WP-12 只加 `sensitivityModel` 欄);`rngSeed` = WP-13 OQ-13.1 的 spread seed;
  `movementModel` = 移動模型語意斷代(stage2 = CS2 Source profile;為 Valorant 等後續模式留資料可比性,比照 `sensitivityModel`)。
- **stage3 前置欄位(GD-7/8/10 回饋,2026-07-06)**:逐 tick 加目標中心 `tx/ty/tz` + 玩家位置 `px/pz`
  (arena 平行欄位;追蹤/偵測指標離線推導的輸入,GD-7「記錄全套」決議);meta 增 `spawn` 區塊縫
  (`sequence.seed` + motion/spawnArea 快照);`scene`/`display`/`frames`/`session` 定義為 **v2 reserved optional
  區塊**(schema.md 記形狀、WP-19/20 填值,additive 不再 bump;`session` =
  `participantId`/`sessionLabel` 串接鍵,FPSci R3,2026-07-07)。詳 [stage3 README §2.5](../../../completed/stage3/README.md)。
- **FPSci 欄位對映(R1,2026-07-07 grill 拍板)**:T1 產出 schema v2 ↔ FPSci SQLite 表(frame-wise 玩家狀態/目標軌跡/click 事件)的欄位對映表,收 `docs/operational/schema.md` 附錄。**命名以 CONTEXT.md 正規術語優先、既有欄位不改名**;僅 v2 全新欄位且語意完全相同時考慮沿用 FPSci 命名——可比性由對映表承擔,不由改名承擔。授權邊界守 GD-11(只讀其文件/論文,不碰程式碼)。出處:[FPSci 評估 R1](../../../../research/FPSci_評估與建議.md)。
- 理想路徑 = `−aimPunch×2` 的時間鏡像;補償誤差 = 實際 aim 路徑 vs 理想路徑的 mean/RMS 角度差。
- arena 容量重估:fire 事件率上限 = `magSize / cycletime`(AK = 10 發/s);per-fire 欄位
  增加後 `capacityForDrill` 重推;溢位測試為 T1 DoD。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| per-fire 欄位增加使 arena 提前溢位 | `recorderOverflow` 污染 drill | 容量公式重估 + 滿載溢位測試(T1 DoD;[../README.md §2.6](../../../completed/stage2/README.md)) |
| schema.md 與實際 payload 漂移 | 研究端解析錯欄 | 沿用既有 schema assert 機制,對帳為 T1 DoD |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | WP-13 exit 驗證 + OQ-S2-3 收尾 / `targetCenterOffsetDeg` 語意定稿 | — | Low |
| **T1** | [T1-schema-v2.md](T1-schema-v2.md) | schema v2 擴欄 + `schemaVersion` + arena 容量重估 | T0 | Med |
| **T2** | [T2-ideal-path-metric.md](T2-ideal-path-metric.md) | 理想路徑產生器 + 補償誤差 mean/RMS | T1 | Low |
| **T3** | [T3-result-overlay.md](T3-result-overlay.md) | 結果頁軌跡對照(實際 vs 理想) | T2 | Low |
| **T-exit** ✅ | [T-exit-gate.md](T-exit-gate.md) | 不變式全綠 + schema 對帳宣告 | T1–T3 | — |
