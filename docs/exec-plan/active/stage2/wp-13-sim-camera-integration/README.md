# WP-13 — sim-camera-integration:recoil 進 sim + 視覺/彈道分離(M6)

> stage2 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 對應[研究計畫 Phase 2](../CS2%20壓槍軌跡復刻研究計畫.md)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 把 WP-10 數學核心接進雙迴圈:recoil tick(64Hz 子節奏)+ 產彈點掛 `onFire`/`spread`,相機合成分離——**渲染 = viewAngles + aimPunch(視覺)、彈道 = viewAngles + rawPunch×2 + spread(實際)**;彈孔 InstancedMesh + debug overlay |
| **里程碑** | **M6**:瀏覽器內可按住連發壓槍,視覺/彈道分離生效 |
| **相依** | WP-10(**M5 必須先過**)、WP-11(fireOneShot 產彈點)、WP-12(raycastWithRay) |
| **對應 FR** | FR-B9(相機合成)、FR-B10(彈孔)、FR-B2/B3 的 sim 佈線 |
| **估時** | 2–3 dev-days |
| **狀態** | ✅ 完成(M6 達成 2026-07-06;automated-green + 手動視覺 4 項使用者確認通過) |

---

## 1. 範圍

**In scope**:

```
src/recoil/adapter.ts          ← NEW 單點轉換:Source deg(pitch 下正)→ three rad(pitch 上正) [T2]
src/loop/SimLoop.ts            ← MODIFY tickIndex + 偶數 tick recoilTick;fireOneShot 接
                                  recoilOnFire + sampleSpread + raycastWithRay(彈道方向)        [T1/T2]
src/state/SharedState.ts       ← MODIFY recoil:{prev,curr punch 快照}、impacts 固定容量彈著格   [T1/T3]
src/view/CameraController.ts   ← MODIFY setViewPunch(yawRad, pitchRad) + compose 含 punch       [T2]
src/main.ts                    ← MODIFY render loop:lerp punch → setViewPunch;彈孔 view 掛載   [T2/T3]
src/render/ImpactView.ts       ← NEW InstancedMesh 彈孔(環狀覆寫上限常數,render-only)        [T3]
(+ 對應 *.test.ts、dev-only debug overlay)
```

**Out of scope**:匯出欄位擴充(WP-16)、校準比對(WP-15)、`view_recoil_tracking`
視覺跟隨比例的精確值(OQ-S2-4:先做可調常數開關,預設關)。

## 2. 關鍵契約

- **tick 佈線**(../README.md §2.4):`createSimLoop` 維護 `tickIndex`;`tickIndex & 1 === 0`
  時 `recoilTick(state.recoilState, 1/64)`,位置在 simStep ②(targets)與 ③(consume)之間
  ——decay 先於本 tick 產彈(kick)。
- **spread RNG**:`createRan1(drill.sequence.seed ?? DEFAULT_RNG_SEED)` 於 SimLoop 閉包持有;
  drill restart 重建 stream(決定性);seed 值交 WP-16 記入 meta。
- **單點轉換**(`adapter.ts`,唯一允許 deg→rad 與符號翻轉之處):pitch 翻轉
  (Source 下正 → three 上正)、yaw 同向(兩者皆左正);E2E 以「上跳 + 向右漂」方向斷言驗證。
- **彈道方向**:`dir = anglesToDir(viewYaw + rawPunchYaw, viewPitch + rawPunchPitch)`,
  rawPunch = aimPunch×2(轉換後 rad);spread `(x,y)` 以 `forward + x·right + y·up` 疊加後正規化
  → `raycastWithRay(cameraWorldPos, dir, targets)`。
- **視覺 punch**:sim 每 tick 寫 `recoil.prev/curr` 快照;render 以 alpha lerp → `setViewPunch`
  → `#applyToCamera` 每幀重組(滑鼠靜止時 punch 衰減仍可見——稽核 A2 整合注意點)。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| deg/rad 或符號在 adapter 之外又轉一次 | 彈道/視覺錯亂難追 | 契約:轉換只在 adapter.ts;T2 grep `degToRad\|deg2rad` 於 sim/view 僅 adapter 一處 |
| 視覺 punch 用 sim 值不內插 | 64Hz punch 在 240Hz 顯示階梯感 | prev/curr + alpha lerp(比照 position 內插既有模式) |
| 視覺與彈道分離造成 QA 誤判「打不準」 | 手感驗證與資料矛盾 | T3 debug overlay:punch 數值 readout + 彈著即彈孔可視化;M6 手動驗證腳本含此說明 |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | M5 + WP-11/12 exit 全綠驗證 | 三上游 | Low |
| **T1** | [T1-simstep-recoil-wiring.md](T1-simstep-recoil-wiring.md) | tickIndex + 64Hz 子節奏 + onFire/spread 掛線 + 快照 | T0 | **High** |
| **T2** | [T2-camera-ballistic-compose.md](T2-camera-ballistic-compose.md) | adapter 單點轉換 + 彈道方向 + setViewPunch 每幀 compose | T1 | **High** |
| **T3** | [T3-bullet-holes-debug.md](T3-bullet-holes-debug.md) | InstancedMesh 彈孔 + dev-only debug overlay | T2 | Low |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | **M6 門**:E2E golden + 手動壓槍驗證 | T1–T3 | — |