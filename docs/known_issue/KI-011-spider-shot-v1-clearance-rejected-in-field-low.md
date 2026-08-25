# KI-011 — 選 spider-shot-v1 顯示「DrillConfig 載入失敗: clearance 驗證失敗」

> 類型：drill↔scene 綁定缺口(`availableDrills` additive 缺 `sceneId`)。
> 狀態：**✅ 已修**（2026-08-25）。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-011。

## 1. 症狀

drill 選單選擇 `spider-shot-v1` 時擲出：

```
DrillConfig 載入失敗: clearance 驗證失敗 — tree-b1 (player[0] -> target:L:center);
tree-b2 (player[0] -> target:R:center); rock-b1 (player[0] -> target:L:center);
rock-b2 (player[0] -> target:R:center)
```

drill 完全無法載入。

## 2. 根因

追碼 + 實測重現（`validateClearance(fieldLow, spiderShotV1)` 直接呼叫,逐字重現上述訊息）確認兩層
原因疊加:

**① `spider-shot-v1` 在 `main.ts` 的 `availableDrills` 登記缺 `sceneId`**（[main.ts:152](../../src/main.ts#L152) 修法前）:

```ts
{ id: spiderShotV1.drillId, label: spiderShotV1.drillId, source: spiderShotV1 },  // 無 sceneId
```

[loadDrillById()](../../src/main.ts#L985) 對缺 `sceneId` 的項目,驗證用場景**不是「不驗證」**,而是
`fallback` 到目前的 `activeSceneConfig`(`let activeSceneConfig: SceneConfig = fieldLow;`,app 啟動
即預設 `field-low`)。故選 spider-shot-v1 一律對 field-low 跑 clearance 驗證。

**② field-low 的裝飾道具(`tree-b1`/`tree-b2`/`rock-b1`/`rock-b2`)恰與 spider-shot-v1 的目標距離
重疊**:`spiderShotV1.targets.distance = 8` 且 `spiderShot.centerDistanceU = 8`,而 field-low
[field-low.props.json](../../src/scene/scenes/field-low.props.json) 的 tree/rock 道具座落在
x∈[-4,4]、z∈[-9,-7.5](8m 前方左右兩側)——與 [clearance.ts](../../src/scene/clearance.ts) 對「無
`spawnArea` 的 drill」採用的既有 L/R legacy envelope 公式(`x=±TARGET_SIDE_OFFSET_U(2)`,
`z=-distance(8)`)幾何上重疊,`segmentIntersectsAabb` 判定 player→target 視線被道具擋住。

**實測驗證 spider-shot-v1 真實目標包絡確實也落在此區間**:以
[`TargetManager.sampleSpiderShotPose`](../../src/sim/TargetManager.ts#L136) 的中心/周邊錐形公式
（`centerDistanceU=8`、`angularRadiusDegRange=[15,15]`、`azimuthDegRange=[0,360]`)數值模擬,真實
目標包絡為 `x∈[-2.07,2.07]`、`y∈[-0.61,3.46]`、`z∈[-8,-7.21]`——**與 `deriveTargetEnvelopes()` 目前
使用的 legacy 公式算出的近似包絡在此案例中空間上高度重疊**,故即使修正 `clearance.ts` 使其認得
`DrillConfig.spiderShot` 欄位(目前完全沒有對應分支,`deriveTargetEnvelopes()` 對任何無 `spawnArea`
的 drill 一律走 legacy L/R 公式),重新計算出的「正確」包絡仍會與 field-low 的 tree/rock 道具相交
——field-low 對 spider-shot 而言**不是**一個目標視線淨空的場景,不只是驗證公式算錯。

**為何既有 e2e 測試沒有抓到**:`tests/e2e/session-orchestrator.spec.ts` 透過 `__fpsTest.startDrill()`
呼叫的 `startDrillWithScene()`（[fpsTestHarness.ts:312](../../src/testharness/fpsTestHarness.ts#L312)）
以 `entry.scene`(而非 `activeSceneConfig` fallback)決定驗證場景;`entry.scene` 由
`sceneId !== undefined ? findSceneOption(sceneId).config : undefined`（[main.ts:838](../../src/main.ts#L838)）
產生。spider-shot-v1 缺 `sceneId` ⇒ harness 端 `entry.scene === undefined` ⇒
[`loadDrill(source, scene)`](../../src/drill/DrillLoader.ts#L35) 的 `scene !== undefined` 分支整段
跳過,clearance **完全不驗證**——harness 與 live app 對「無 `sceneId` 的 drill」語意不一致（harness =
不驗證,live = fallback 到目前場景驗證),使這個真實會發生的使用者路徑此前對 e2e 測試不可見。

## 3. 修復決策

在 `main.ts` 的 `availableDrills` 登記補上 `sceneId: 'placeholder-room'`(比照 hold-click/hold-track
既有「額外指定 home scene」的先例):

```ts
{ id: spiderShotV1.drillId, label: spiderShotV1.drillId, source: spiderShotV1, sceneId: 'placeholder-room' },
```

`placeholder-room` 是唯一 `propBounds: []`(零道具)的既有場景，任何目標包絡皆天然通過 clearance,
不受 spider-shot 全向錐形分佈影響。實測四個候選場景(`field-low`/`urban-high`/`peek-corridor`/
`placeholder-room`)只有 `placeholder-room` 零 violation,`urban-high`(backdrop-sign 系列道具)與
`peek-corridor`(`cover-wall`)同樣會擋。

不採「修正 `deriveTargetEnvelopes()` 使其正確理解 `spiderShot` 欄位」作為本次唯一修法——如上一節數值
模擬所示,正確計算出的包絡在 field-low 案例仍會相交,單獨修正公式**不足以**解決本次回報的錯誤,且
`clearance.ts` 是多個 drill 家族共用、已測試的核心驗證邏輯,改動幾何公式本體的正確性驗證成本遠高於
本次「指到一個乾淨場景」的修復範圍;此限制記為遺留 OQ(§5),留給日後需要視覺場景(而非空白房間)的
task 處理。

## 4. 修改紀錄

| 檔案 | 修改 |
|---|---|
| `src/main.ts` | `availableDrills` 的 `spider-shot-v1` 項目新增 `sceneId: 'placeholder-room'`；同步更新 `__fpsTest` harness deps 的 `scene` 欄位（透過既有 `sceneId → findSceneOption().config` 轉換,零額外改動）。 |

## 5. 驗證證據

1. **重現**：直接呼叫 `validateClearance(fieldLow, spiderShotV1)`，逐字重現使用者回報的錯誤訊息（4 violations：`tree-b1`/`tree-b2`/`rock-b1`/`rock-b2`）。
2. **候選場景掃描**：對 `field-low`/`urban-high`/`peek-corridor`/`placeholder-room` 四個既有場景各跑一次 `validateClearance`，僅 `placeholder-room` 為 0 violation。
3. `npx tsc --noEmit`：exit 0。
4. `npx vitest run`：130 files / 968 tests 全綠。
5. `npx playwright test tests/e2e/session-orchestrator.spec.ts --project=edge`：2/2 通過（含 `harness.startDrill('spider-shot-v1')` 走完整 `loadDrill()` 鏈路且不拋錯 — 此前因 harness/live 場景解析不一致，此路徑從未真正驗證過 clearance）。
6. `npx playwright test --project=edge`（全量）：19/23 通過；`tests/e2e/input-sampler.spec.ts` 5 案在全量並行下逾時（`gotoAppReady` 5000ms 等 `__aimDebug` 掛載），單獨執行 `npx playwright test tests/e2e/input-sampler.spec.ts --project=edge` 5/5 全綠——確認為既有沙盒並行負載下的環境 flake（與 pointer-lock/bootstrap 無關，本次改動未觸碰），非本次修法造成的迴歸；重跑全量一次仍隨機重現同類逾時（非本次改動觸發，改動前後行為一致）。

## 6. 遺留 Open Questions

- **OQ-KI11-1**：`deriveTargetEnvelopes()`（`src/scene/clearance.ts`）目前完全不認得 `DrillConfig.spiderShot` 欄位，對任何無 `spawnArea` 的 drill 一律套用 legacy L/R side 公式（`x=±TARGET_SIDE_OFFSET_U`, `z=-distance`）。這對 spider-shot 而言只是近似值（本次數值模擬顯示在 field-low 案例中恰好重疊，但未來若 `SPIDER_SHOT_ANGULAR_RADIUS_DEG_V1`/`centerDistanceU` 調整，近似值可能與真實包絡顯著偏離，安靜地產生假陰性或假陽性）。若日後需要讓 spider-shot 使用有裝飾道具的視覺場景（而非 `placeholder-room` 空房間），必須先補上 `spiderShot` 專屬的包絡計算分支（比照既有 `envelopeForSpawnArea` 的模式），否則驗證結果不可信。
- **OQ-KI11-2**：`__fpsTest` harness（`fpsTestHarness.ts`）與 live app（`main.ts`）對「drill 缺 `sceneId`」的語意不一致——harness 完全跳過 clearance 驗證，live app fallback 到 `activeSceneConfig`。本次修法讓 spider-shot-v1 兩端行為一致（皆解析為 `placeholder-room`），但這個語意分歧本身仍存在，其餘缺 `sceneId` 的 drill（`counterstrafe-reversal-v1`/`counterstrafe-free-v1`/`trackingV1`）目前恰好因 `distance` 較短而不撞上道具，但同一類回歸風險（e2e 測不到、live app 才炸）在原則上仍未關閉。若日後要系統性修正，建議讓 harness 比照 live app 的 fallback 語意（或反過來讓 live app 對缺 `sceneId` 的 drill 直接不驗證），兩端擇一統一，屬獨立於本次修復範圍的架構決策。
- **OQ-KI11-3**：`placeholder-room` 是空白灰房間（`asset: null`），視覺上不如 `field-low`/`urban-high` 寫實；spider-shot 的真實目標包絡在 y 軸可達 −0.61~3.46（比 `placeholder-room` 的 `roomSize` 高度 3 更寬），這只是 clearance.ts 不檢查的 room 幾何（只檢查 `propBounds`），不影響本次修法的正確性，但若日後要換一個「好看」的場景，需同時考慮 room 尺寸是否放得下這麼寬的錐形分佈，屬產品/美術決策，不在本次修復範圍。

## 7. 影響範圍

只新增一個 `sceneId` 欄位到 `main.ts` 既有 additive 陣列項目；不改動 `spider_shot_v1.ts` 本體
（協定凍結,GD-7/D-42.3 慣例）、不改動 `clearance.ts`/`TargetManager.ts` 任何邏輯、不影響其他任何
drill 的場景綁定或 clearance 結果。
