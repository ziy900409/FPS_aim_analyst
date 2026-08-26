# 階段 I(stage9)提案 — Assessment / transfer-test 擴充提案集合

> **本檔狀態:🟡 討論定案,尚未正式採納**。stage9 目前收納兩個彼此獨立、皆不修改 stage6 frozen v1 協定的 additive 提案:WP-44 `spider-shot-v2` 與 WP-45 `peek-click-transfer-pilot-v1`。尚未指派正式里程碑字母 / [DECISIONS.md](../../DECISIONS.md) GD 條目,亦未同步 [exec-plan/README.md](../../README.md)、[docs/MAP.md](../../../MAP.md)。比照 stage8 先例(見 [stage8/README.md §4 OQ-S8-4](../stage8/README.md)),這些文件對帳動作留到各 WP T-exit 或使用者確認正式開工時一併補上。
> WP-44 觸發:使用者研究了一份第三方 Three.js aim trainer demo(`3d_fps_12 1.html`)的 SpiderShot 模式,與本專案已交付的 `spider-shot-v1`(stage6 WP-36)做完整對照後,希望把該 demo 的「4 象限 × 3 距離 tier stratified 排程」與「擊殺即出下一個」兩個特性帶進本專案。
> WP-45 觸發:使用者研究 Kovaak's `Peek and Click` 錄影後,決定把「自體移動造成目標曝光 → 反向急停 → 首發／補槍」轉譯成本專案可量測的 transfer test；完整 spec 見 [`wp-45-peek-click-transfer/README.md`](wp-45-peek-click-transfer/README.md)。
> 與 stage6 的關係:**不修改** `spider-shot-v1` 本身或其凍結數值(WP-39 `STAGE6_PROTOCOL_VERSION = '1.0.0'`)——本提案開一個新 drill `spider-shot-v2`,`spider-shot-v1` 逐位不變。
> 文件語言:繁體中文,術語保留英文(D4)。

---

## 0. 背景與現況讀碼(2026-08-26 對話中確認)

| # | 現況 | 證據 | 對本提案的意義 |
|---|---|---|---|
| 0-1 | 「擊殺即出現下一個目標」在 `spider-shot-v1` 已經是事實 | [`TargetManager.tick()`](../../../src/sim/TargetManager.ts):`spider-shot-v1` 未設 `sequence.seed`/`spawnArea`/`sequence.spawnDelayMsRange`,故 `usesSeededSpawn` 為 false,`spawn()` 在下一個 sim tick 直接補生,零延遲 | 本提案不需要為「擊殺即出現」寫任何新程式碼,新 drill 只要不設這幾個欄位即可繼承此行為 |
| 0-2 | `spider-shot-v1` 目前的周邊目標取樣是連續均勻抽樣(每次獨立抽 azimuth/radius/distance),沒有分層防重複機制 | [`TargetManager.sampleSpiderShotPose()`](../../../src/sim/TargetManager.ts#L136) | 這是本提案要新增的唯一真正差異:把周邊目標取樣換成 12 格(4 象限 × 3 距離 tier)洗牌佇列 |
| 0-3 | `spider-shot-v1` 的數值(`centerDistanceU=8`、`angularRadiusDegRange=[15,15]` 固定、`distanceURange=[8,8]` 固定)已由 WP-39 列為正式凍結校準值(`STAGE6_PROTOCOL_VERSION = '1.0.0'`) | [`docs/exec-plan/completed/stage6/wp-39-calibration-freeze/T2-numeric-freeze.md`](../../completed/stage6/wp-39-calibration-freeze/T2-numeric-freeze.md) | 直接改 v1 會打破「除凍結欄位外逐位不變」的既有回歸測試契約與 pilot 資料可比性——本提案選擇開新 drill `spider-shot-v2`,v1 保留 |
| 0-4 | HTML demo 的「距離」是螢幕投影半徑(視覺上離中心的偏移量),不是本專案球面模型裡的世界距離 | 兩者幾何模型完全不同(見對話中的比較分析) | 「3 個距離 tier」在本專案最自然的對應是 `angularRadiusDeg`(離中心視線的角距)分三層,而非 `distanceURange`(維持固定 8u) |
| 0-5 | KI-011 已把 `spider-shot-v1` 鎖到 `sceneId: 'placeholder-room'`(唯一零 `propBounds` 場景) | [`docs/known_issue/KI-011-spider-shot-v1-clearance-rejected-in-field-low.md`](../../known_issue/KI-011-spider-shot-v1-clearance-rejected-in-field-low.md)、[`main.ts:160`](../../../src/main.ts#L160) | `spider-shot-v2` 沿用同一個 `sceneId`,不重踩 KI-011 的坑 |

**結論**:本提案是在既有 `spiderShot` 分支(`DrillConfig.spiderShot?`/`TargetManager` 的 center/peripheral 分支)上做加法,不改 v1 的型別或行為;`spiderShotConditions.ts`/`spiderShotMetrics.ts` 完全不用碰,因為它們只讀匯出的目標世界座標 + hitbox + `zone` 標籤,對 spawn 怎麼被排出來是透明的。

---

## 1. 範圍(對話中拍板)

**In scope**:

1. `DrillConfig.SpiderShotScheduleConfig` 擴充為 discriminated union:新增 `kind: 'center-peripheral-stratified'` 變體,帶一個 `grid: { azimuthQuadrants; radiusTiers }`。`kind: 'center-peripheral'`(v1 用)型別/行為逐位不變。
2. `TargetManager`:抽出共用的「azimuth+radius+distance → world pos」三角函式(純重構,v1 輸出零改動),新增等立體角(`cos` 分層,非 HTML 的平面 `sqrt(area)`)12 格洗牌佇列取樣路徑,只在 `kind: 'center-peripheral-stratified'` 時啟用。
3. `schema.ts`:新分支驗證 `grid` 欄位 + 拒絕退化 `angularRadiusDegRange`(stratified 變體要求 `min < max`,與 v1 允許 `[15,15]` 不同)。
4. 新檔 `src/drill/spider_shot_v2.ts`:`angularRadiusDegRange` 候選值先用 `[10, 25]`(對話中拍板,測試後再調整),明確標記未經 pilot 校準。
5. `main.ts` 註冊 `spider-shot-v2`,`sceneId: 'placeholder-room'`。
6. 對應測試(`schema.test.ts`/`TargetManager.test.ts`/`spider_shot_v2.test.ts` 新分支)。

**Out of scope(對話中明確排除)**:

- `spider-shot-v1` 本身、`spiderShotConditions.ts`、`spiderShotMetrics.ts`——零程式碼觸碰,五類指標與 condition-cell 推導對兩個 drill 共用同一套,不需要為 v2 另開分支。
- `distanceURange` 分層(對話中選了只分 `angularRadiusDeg`,`distanceURange` 維持固定值)。
- 移除 center↔peripheral 交替(對話中明確選擇保留,只換周邊目標的取樣策略)。
- 正式凍結校準(v2 是新草案,`angularRadiusDegRange=[10,25]` 未經 pilot 驗證,比照 v1 當年的「候選值」聲明方式)。

---

## 2. 系統設計摘要

完整讀碼細節與決策見 [`wp-44-spider-shot-v2-stratified/README.md`](wp-44-spider-shot-v2-stratified/README.md)。核心公式:

- **象限分箱(排程用,非呈現層標籤)**:把 `peripheral.azimuthDegRange`(如 `[0,360]`)均分成 `grid.azimuthQuadrants`(4)份,每份 90°。**注意**:這是全新的、只供 spawn 排程平衡使用的分類,邊界是 `0/90/180/270` 起算,和 `spiderShotConditions.ts` 既有的 `SpiderQuadrant`(`horizontal`/`vertical`/`oblique`,45°-居中 8 分箱收斂成 3 類、僅供呈現層標籤)是兩套完全不同的分類,不衝突但要在文件點名避免混淆。
- **距離 tier 分箱(排程用)**:把 `peripheral.angularRadiusDegRange` 依**等立體角**(`cos(θ)` 線性內插,球面幾何的正確「等面積」定義,而非 HTML 原版用於螢幕投影的平面 `sqrt(area)` 近似)切成 `grid.radiusTiers`(3)份。
- **12 格洗牌佇列**:每次佇列空了就用 `spiderShot.seed` 的同一顆 seeded RNG 重建 12 格 + Fisher–Yates 洗牌;每次周邊 spawn 從佇列尾端 pop 一格,格內再均勻抽 azimuth(線性)與 radius(`cos` 空間線性,格內仍是等面積抽樣)。

---

## 3. 與既有紀律的關係

| 既有紀律 | 本提案是否遵守 | 說明 |
|---|---|---|
| GD-5(sim/recoil 禁 `Math.random`,一律 seeded RNG) | ✅ 遵守 | 洗牌與格內抽樣都消費同一顆 `createRan1(spiderShot.seed)` |
| WP-39 凍結紀律(`protocolVersion`/四協定數值) | ✅ 遵守 | 不改 v1 任一凍結欄位;v2 是全新 drill,不繼承 v1 的 `protocolVersion` 凍結宣告 |
| C-D4(既有構念不得有第二定義) | ✅ 遵守 | `D_deg`/`W_deg`/五類指標零改動,v2 只影響 spawn 怎麼被排出來 |
| GD-6(場景幾何不進 sim runtime) | ✅ 遵守 | 本提案零觸碰場景/`propBounds`,沿用 KI-011 已鎖定的 `placeholder-room` |

---

## 4. Open Questions

| # | 問題 | 目前傾向 | Owner |
|---|---|---|---|
| OQ-S9-1 | `angularRadiusDegRange=[10,25]` 是候選值,實測手感後是否要調整? | 先用 `[10,25]` 跑,測試後再調(對話中拍板) | 使用者 |
| OQ-S9-2 | 本提案若要正式開工,WP 編號(暫用 WP-44)、里程碑字母(暫定 I)、GD 條目何時正式指派? | 待使用者於 T-exit 或之後確認,比照 stage8 OQ-S8-4 模式 | 使用者 |
| OQ-S9-3 | v2 是否需要走一輪真人 pilot 才能進入下一階段的凍結流程(比照 WP-39)? | 暫不需要,先讓 v2 可跑、可調參數;凍結流程留待之後另開提案 | 使用者/研究者 |

---

## 5. WP 索引

| WP | 子資料夾 | 目標 | 狀態 |
|---|---|---|---|
| **WP-44**(暫用) | [`wp-44-spider-shot-v2-stratified/`](wp-44-spider-shot-v2-stratified/README.md) | `spider-shot-v2`:12 格 stratified 周邊排程,保留 center↔peripheral 交替 | 🟡 進行中 |
| **WP-45**(暫用) | [`wp-45-peek-click-transfer/`](wp-45-peek-click-transfer/README.md) | `peek-click-transfer-pilot-v1`:對稱掩體、自體移動曝光、急停首發與分層 metrics；Practice/pilot only | ✅ T-exit：pilot-ready（非 Assessment 採納） |
| **WP-46**(暫用) | [`wp-46-spider-shot-v2-aimlab-parity/`](wp-46-spider-shot-v2-aimlab-parity/README.md) | `spider-shot-v2` 對齊 Aim Lab Spidershot:球體目標(真碰撞,擴充 GD-7)、中心免逾時、60 秒時限、視角直徑換算 hitbox | ✅ T-exit(數值為未經 pilot 校準候選值;GD/WP 正式編號延後) |

### 5.1 執行排程避免熱區衝突

- WP-45 T0/T1/T2(讀碼、共用 occlusion kernel、獨立場景資產)可在 WP-44 尚未 T-exit 時獨立進行。
- WP-45 T3 會觸及 `DrillConfig.ts`/`schema.ts`/`main.ts`，必須等 WP-44 T-exit 或確認其變更已合併，避免兩個 active WP 同時修改同一熱區。
- WP-45 T5 會觸及 Session Plan 入口，必須等 stage8 WP-43 T-exit，再依重構後的入口契約接線。
