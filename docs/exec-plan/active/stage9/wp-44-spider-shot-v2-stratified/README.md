# WP-44(暫用編號)— spider-shot-v2-stratified:12 格 stratified 周邊排程

> stage9 提案的 WP 子資料夾。上層 spec:[../README.md](../README.md)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> 格式比照 [`completed/stage6/wp-36-spider-shot/README.md`](../../../completed/stage6/wp-36-spider-shot/README.md)(同一 drill 家族的前作)。

| | |
|---|---|
| **目標** | 新增 `spider-shot-v2`:周邊目標取樣改為 4 象限 × 3 距離 tier(等立體角)洗牌佇列,`spider-shot-v1` 逐位不變 |
| **里程碑** | 無獨立里程碑(T-exit gate 即交付判定,比照 WP-27 muzzle-tracer 精神);暫定字母 I(未正式指派,見 [../README.md](../README.md) OQ-S9-2) |
| **相依** | 無(獨立;不修改任何已交付的 stage6 協定) |
| **估時** | 1.5–2.5 dev-days |
| **狀態** | 🟡 進行中 |

---

## 0. 讀碼對帳(已於brainstorming對話完成,摘要見 [../README.md §0](../README.md))

關鍵讀碼結論(完整證據見上層 README §0):

1. 「擊殺即出下一個」現況已滿足,零程式碼變動。
2. `TargetManager.sampleSpiderShotPose()` 的 azimuth→radius→distance 三角函式可原樣抽出重用,v1 輸出逐位不變(相同抽樣順序、相同公式)。
3. v1 的 `angularRadiusDegRange=[15,15]` 是 WP-39 凍結值,不可改;v2 是新 drill,不受此凍結約束。
4. `main.ts` 已有 KI-011 教訓(`sceneId: 'placeholder-room'`),v2 直接沿用同一 sceneId 即可避開 clearance 拒入。
5. `spiderShotConditions.ts`/`spiderShotMetrics.ts` 只消費匯出的目標世界座標 + hitbox + `zone`,對 spawn 排程方式無感——本 WP 不需要碰這兩個檔案或它們的測試。

---

## 1. 需求對應

| 項目 | 內容 | 落點 |
|---|---|---|
| 型別契約 | `SpiderShotScheduleConfig` 擴充為 union,新增 `center-peripheral-stratified` + `grid` 欄位;`schema.ts` 新分支驗證(含拒絕退化 radius range) | T1 |
| 排程引擎 | `TargetManager` 抽出共用三角函式 + 新增等立體角 12 格洗牌佇列取樣路徑 | T2 |
| 新 drill | `src/drill/spider_shot_v2.ts` + `main.ts` 註冊(`sceneId: 'placeholder-room'`) | T3 |
| 驗收 | `npm run test:ci` 全綠 + 文件對帳 | T-exit |

### 1.1 範圍

**In scope**:

```
src/drill/DrillConfig.ts             ← MODIFY SpiderShotScheduleConfig → union(新增 SpiderShotStratifiedGridConfig/
                                        SpiderShotStratifiedConfig),SpiderShotCenterPeripheralConfig 承接原 v1 形狀   [T1]
src/drill/schema.ts                  ← MODIFY validateSpiderShotSchedule 新分支 + 新增 validateSpiderPeripheral 共用   [T1]
src/sim/TargetManager.ts             ← MODIFY 抽出 peripheralPos() 共用三角函式(v1 純重構零輸出改動);新增
                                        buildSpiderZoneCells()/shuffleInPlace()/sampleStratifiedPeripheralPos();
                                        reset() 新增 spiderZoneQueue 清空                                            [T2]
src/drill/spider_shot_v2.ts          ← ADD 新 drill config(候選值,未凍結)                                          [T3]
src/main.ts                          ← MODIFY availableDrills 註冊 spider-shot-v2(sceneId: 'placeholder-room')      [T3]
```

**Out of scope**:

- `src/drill/spider_shot_v1.ts`——零改動,既有回歸測試逐位不變。
- `src/metrics/spiderShotConditions.ts`/`spiderShotMetrics.ts`——零改動(見 §0 讀碼結論)。
- `docs/operational/analysis-spider-shot.md` 的既有段落——只新增一節說明 v2 排程與 v1/呈現層 `SpiderQuadrant` 的分工,不修改既有文字。

---

## 2. 關鍵設計決策

### ① 共用三角函式抽取(承 §0-2):純重構,v1 零回歸風險

`sampleSpiderShotPose()` 目前把 azimuth/radius/distance → world pos 的三角函式寫死在函式內。抽成:

```ts
// src/sim/TargetManager.ts                                                    [T2]
function peripheralPos(centerDistanceU: number, azimuthRad: number, radiusRad: number, distanceU: number): Vec3 {
  const centerLength = Math.hypot(TARGET_Y, centerDistanceU);
  const forwardY = TARGET_Y / centerLength;
  const forwardZ = -centerDistanceU / centerLength;
  const upY = centerDistanceU / centerLength;
  const upZ = TARGET_Y / centerLength;
  const radialSin = Math.sin(radiusRad);
  const radialCos = Math.cos(radiusRad);
  const azimuthSin = Math.sin(azimuthRad);
  const azimuthCos = Math.cos(azimuthRad);
  return {
    x: distanceU * radialSin * azimuthSin,
    y: distanceU * (radialCos * forwardY + radialSin * azimuthCos * upY),
    z: distanceU * (radialCos * forwardZ + radialSin * azimuthCos * upZ),
  };
}
```

`sampleSpiderShotPose()` 的 `center-peripheral` 分支呼叫順序(azimuth → radius → distance 依序 `randomFloat`)完全不變,故 v1 的 RNG 消費序列與世界座標逐位不變(`TargetManager.test.ts` 既有「四象限+兩斜向世界座標」斷言為證據)。

### ② 12 格洗牌佇列:等立體角分層 + seeded Fisher–Yates(承 §0-2/GD-5)

```ts
// src/sim/TargetManager.ts                                                    [T2,新增]
interface SpiderZoneCell {
  readonly azimuthDegRange: readonly [number, number];
  readonly cosRadiusRange: readonly [number, number]; // [cosLower, cosUpper]；radiusRad = acos(sample)
}

function buildSpiderZoneCells(config: SpiderShotStratifiedConfig): SpiderZoneCell[] { /* 見 T2 task 檔 */ }
function shuffleInPlace<T>(items: T[], rng: Rng): void { /* Fisher–Yates,消費同一顆 seeded RNG */ }
```

等立體角公式(球面正確定義,非 HTML 原版的平面 `sqrt(area)` 近似):以 `cos(radMinDeg)`/`cos(radMaxDeg)` 為界線性內插出 `radiusTiers` 個 `cos` 區間;格內抽樣時直接對 `cos` 值做均勻抽樣(`randomFloat` 於 `[cosLower, cosUpper]`)再 `acos()` 還原成 `radiusRad`——每個 tier 內部仍是等面積抽樣,整體 12 格覆蓋等面積分層,對應 stage9 README §2 的公式說明。

佇列耗盡(每 12 次周邊 spawn)即用同一顆 `spawnRng` 重建 + 重洗;`reset()` 需清空 `spiderZoneQueue = []`(下次 spawn 時以剛重播種的 RNG 重建,決定性不變)。

### ③ `spawn()` 分派:依 `spiderShot.kind` 分支,呼叫端零改動

`sampleSpiderShotPose()` 內部依 `nextSpiderZone`/`spiderShot.kind` 分派:`center` 分支兩種 kind 共用;`peripheral` 分支若 `kind === 'center-peripheral-stratified'` 呼叫 `sampleStratifiedPeripheralPos()`,否則走 v1 既有的連續抽樣路徑。`spawn()`/`tick()`/`markKilled()` 呼叫端完全不變。

---

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| `angularRadiusDegRange` 退化(`min === max`)卻走 stratified 分支 | `radiusTiers` 個 `cos` 區間全部退化成同一點,12 格佇列變成「4 象限各 3 份完全相同的格」,分層失去意義但不會 crash | `schema.ts` 明確拒絕(`requireNonDegenerateRadius`),T1 DoD 含此負向測試 |
| 佇列重洗時機與 `reset()` 沒有同步清空 | `reset()` 後第一次 spawn 用到「上一輪殘留的佇列」,決定性測試(同 seed 重放)會抓到不一致 | T2 DoD 明文要求「reset → replay 同 seed → 結果與 fresh run 逐位相同」的測試 |
| `peripheralPos()` 抽取時不小心改變了呼叫順序(如先抽 radius 再抽 azimuth) | v1 既有 `TargetManager.test.ts` 的「四象限+兩斜向世界座標」斷言會直接紅燈(對浮點數精確到 12 位) | 抽取後先跑一次既有 `TargetManager.test.ts` 全綠才繼續,T2 DoD 明文列此回歸檢查 |

---

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk | 估時 |
|---|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | 覆核 §0 讀碼假設仍成立;無程式碼 | 無 | Low | 0.25d |
| **T1** | [T1-schema-types.md](T1-schema-types.md) | `DrillConfig.ts` union 擴充 + `schema.ts` 新分支驗證 + `schema.test.ts` 新測試 | T0 | Low | 0.5d |
| **T2** | [T2-target-manager-stratified.md](T2-target-manager-stratified.md) | `TargetManager.ts` 共用三角函式抽取 + 12 格洗牌佇列 + `TargetManager.test.ts` 新測試 | T1 | Med(v1 回歸風險) | 1–1.5d |
| **T3** | [T3-drill-v2-registration.md](T3-drill-v2-registration.md) | `spider_shot_v2.ts` + `main.ts` 註冊 + `spider_shot_v2.test.ts` | T2 | Low | 0.25d |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | 驗收;`npm run test:ci` 全綠;文件對帳 | T1+T2+T3 | — | 0.25d |

一 task = 一垂直切片 = 一原子 commit 紀律不變。

---

## 5. Concurrency model

**N/A**(沿用既有單 rAF 超級迴圈,ADR-2)。本 WP 不新增計時來源。

---

## 6. 文件對帳清單

- [ ] [../README.md](../README.md) §5:WP-44 狀態於 T-exit 後翻 ✅。
- [ ] `docs/operational/analysis-spider-shot.md`:T-exit 新增一節說明 v2 排程機制,並點名新的排程用 quadrant/tier 分箱與既有 `SpiderQuadrant`(呈現層)是兩套不同分類。
- [ ] [DECISIONS.md](../../../DECISIONS.md):T-exit 記一筆「為何開 v2 而非改 v1」+ 等立體角公式選擇,WP/GD 編號視使用者當下決定是否正式指派(比照 OQ-S9-2)。
- [ ] [exec-plan/README.md](../../../README.md) §2/§4/§6、[docs/MAP.md](../../../../MAP.md):同上,視使用者決定是否現在同步。
