# WP-21 — detection-drill:seeded spawn + pop-in 偵測 drill + 離線推導 spec

> stage3 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 決議依據:[DECISIONS.md](../../../DECISIONS.md) **GD-8**(pop-in / t_detect 瞄準 onset / 偏心度共變數)/ **GD-7**(原始資料全記錄)/ GD-5(seeded RNG 紀律)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 偵測實驗的機械與資料鏈:`sequence.seed` 啟用(seeded spawn 位置/時序)+ pop-in 偵測 drill config + `t_detect`/偏心度**離線推導 spec** 與合成 fixture 驗證 |
| **里程碑** | —(M10 前置:WP-22 T2 protocol 消費本 WP drill) |
| **相依** | T1/T2 獨立可跑;**T3 需 WP-16**(schema v2 逐 tick 目標/玩家位置欄) |
| **對應 FR** | FR-C10 ~ FR-C12 |
| **估時** | 2.5–3.5 dev-days |
| **狀態** | ⬜ 未開始 |

---

## 1. 範圍

**In scope**:

```
src/drill/schema.ts             ← MODIFY targets.spawnArea? + sequence.spawnDelayMsRange? + seed 啟用 [T1]
src/sim/TargetManager.ts        ← MODIFY seeded spawn(createRan1 注入;無 seed 路徑逐位不變)       [T1]
src/recoil/rng.ts               ← REUSE createRan1(零相依,不改)                                    [T1]
src/drill/detection_popin_v1.ts ← ADD 偵測 drill config(pop-in + seeded 位置/延遲)                 [T2]
src/data/(spawn 事件位置欄)   ← MODIFY spawn 事件記錄含目標位置(v2 additive)                     [T2]
docs/operational/analysis-t-detect.md ← ADD t_detect/偏心度離線推導 spec(θ_v/k 預設 + 演算法)     [T3]
src/metrics/(dev 驗證器)      ← ADD 合成 fixture 推導測試(已知 onset → 誤差 ≤ 1 tick)           [T3]
```

**Out of scope**:slide-in / 宣告式 occluder(GD-8 判準已預存,觸發後另立 WP)、fixation gate(GD-8 觸發條件)、追蹤 drill(WP-18)、正式分析 pipeline(Python/R,repo 外;spec 是介面)、專用反應鍵(GD-8 排除)。

## 2. 關鍵契約

- **spawn 隨機化(FR-C10)**:`sequence.seed` → `createRan1(seed)` 注入 `createTargetManager`;
  spawn 位置 = seeded 取樣 `spawnArea.yawDegRange × distanceURange`(polar,固定世界座標,
  camera 無關);spawn 延遲 = seeded 取樣 `spawnDelayMsRange`。**取樣次序固定**
  (delay 先、yaw 次、distance 後——決定性重現的一部分,記 schema)。
- **零破壞不變式**:無 `seed`/`spawnArea` 的既有 drill,`TargetManager` 行為**逐位不變**
  (既有決定性回歸為閘);seeded 路徑同 seed 同序列(新決定性測試)。
- **`t_visible` 語意不變**(GD-8):pop-in = spawn tick 蓋戳,現行 `TargetManager` 機制
  零改動——偵測刺激直接繼承 F2 量測鏈。
- **離線推導 spec(FR-C12)**:`t_detect` = `t_visible` 後首個「ε(t) 以 > θ_v 的角速度
  下降、持續 k tick」的 tick;θ_v = 3 × 前刺激窗(spawn 前 500ms aim 角速度)SD、
  k = 4 tick(OQ-S3-2 起點,標「暫定,pilot 校準」);偏心度 = aim@spawn 與目標的角距。
  輸入 = 匯出 v2(逐 tick aim + 目標位置 + t_visible)——**引擎零新計算,spec 即介面**。
- 推進政策沿用 P2 + `peekTimeoutMs`(GD-8:開火允許,engagement time 為免費副指標;
  不需新 presentation policy)。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| seeded 改動波及無 seed 路徑 | 既有 drill 決定性 baseline 全紅 | 「無 seed 逐位不變」為 T1 DoD 首項(先跑既有回歸) |
| spawn 位置落到房間/場景幾何外或走廊外 | 淨空驗證誤擋或目標不可見 | `spawnArea` 進 T1 schema 驗證(範圍 sanity);淨空驗證(WP-19 T3)把 spawnArea 極值納入目標包絡——對帳記雙方 progress |
| 取樣次序未固定 → 同 seed 不同序列 | 決定性重現失敗 | 次序寫進 schema + 決定性測試鎖定 |
| 推導 spec 與實際匯出欄位漂移 | 分析端算不出 t_detect | 合成 fixture 測試同時消費「真匯出格式」(round-trip:錄 → 匯 → 推導) |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | GD-7/8 收斂 + spawnArea 幾何範圍決議 + WP-19 淨空對帳 | — | Low |
| **T1** | [T1-seeded-spawn.md](T1-seeded-spawn.md) | schema 擴欄 + TargetManager seeded spawn(零破壞) | T0 | **High** |
| **T2** | [T2-detection-drill-config.md](T2-detection-drill-config.md) | 偵測 drill config + spawn 事件位置欄 | T1 | Med |
| **T3** | [T3-offline-derivation-spec.md](T3-offline-derivation-spec.md) | t_detect/偏心度推導 spec + 合成 fixture 驗證 | T2 + **WP-16** | Med |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | 偵測鏈交付宣告(WP-22 可消費) | T1–T3 | — |
