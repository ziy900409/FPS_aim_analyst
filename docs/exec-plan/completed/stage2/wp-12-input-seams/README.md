# WP-12 — input-seams:CS2 感度換算 + 射線方向注入

> stage2 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../../../active/stage2/README.md) · 稽核 A3/A4 WARN 的修補。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 兩個小而準的接縫修補:(a) 感度佔位常數換成 CS2 語意(0.022°/count),讓壓槍滑鼠補償對得上玩家肌肉記憶;(b) 命中射線方向改為注入式,為 WP-13 彈道合成開口 |
| **里程碑** | —(M6 的前置) |
| **相依** | 無(與 WP-10/11/14 並行;可立即開跑) |
| **對應 FR** | FR-B7(感度)、FR-B8(射線注入) |
| **估時** | 1–1.5 dev-days |
| **狀態** | ✅ 完成(2026-07-06;T0/T1/T2/T-exit 全綠) |

---

## 1. 範圍

**In scope**:

```
src/view/CameraController.ts   ← MODIFY RAD_PER_COUNT = degToRad(0.022)(佔位 0.0022 rad 退場) [T1]
src/data/metadata.ts           ← MODIFY meta 增 sensitivityModel 欄(感度語意標記)            [T1]
src/sim/HitDetector.ts         ← MODIFY 抽出 raycastWithRay(origin, dir);FromCenter 改薄包裝  [T2]
(+ 對應 *.test.ts、schema.md 對帳註記)
```

**Out of scope**:punch 合成與 `setViewPunch`(WP-13)、schema v2 全量(WP-16,
此處只加一欄並在 schema.md 註記)、既有 drill 匯出資料的回溯轉換(不做,以欄位標記區隔)。

## 2. 關鍵契約

- 感度:`角度(deg) = movementX × sensitivity × 0.022`。實作 = [CameraController.ts:19](../../../../../src/view/CameraController.ts)
  `RAD_PER_COUNT = THREE.MathUtils.degToRad(0.022)`(內部仍 radian,僅常數值變)。
  現值 0.0022 rad/count ≈ 5.73× CS2——換算後**同 sensitivity 數字的手感變慢 5.73 倍**,屬預期。
- `sensitivityModel: 'cs2-0.022deg'` 入 meta(舊資料無此欄 = 佔位語意);GD-5 已記語意斷代。
- `raycastWithRay(origin: Vector3, dirNormalized: Vector3, targets): RaycastResult`:
  內部 `raycaster.set(origin, dir)` + 既有 Box3 求交迴圈;`raycastFromCenter` 改為
  「setFromCamera 取 origin/dir → 轉呼叫」,既有測試/呼叫端零改動。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| 感度換算後未標記語意 | 階段 A/B 資料混併分析失效 | T1 同刀加 `sensitivityModel` 欄 + schema.md 註記(OQ-S2-3) |
| FromCenter 包裝與原實作射線不等價 | 既有命中回歸紅 | T2 以既有測試為閘;新增「包裝 vs 原路徑同輸入同結果」對照測試 |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | OQ-S2-3 拍板(語意標記方式) | — | Low |
| **T1** | [T1-cs2-sensitivity.md](T1-cs2-sensitivity.md) | `RAD_PER_COUNT` CS2 化 + meta 標記 | T0 | Low |
| **T2** | [T2-ray-injection.md](T2-ray-injection.md) | `raycastWithRay` 抽出 + 薄包裝 | — | Low |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | 回歸全綠 + 手感抽查 | T1, T2 | — |
