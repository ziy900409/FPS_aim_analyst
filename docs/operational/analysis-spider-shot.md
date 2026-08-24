# Analysis Spider Shot Contract

`spider-shot-v1` 是 Assessment 的中心—周邊目標切換協定。場上同時只保留一個可命中目標；目標命中後依 `spiderShot` 排程在中心與周邊間交替。排程由 `spiderShot.seed` 決定，並完整回顯到 `meta.spawn.spiderShot`；既有 `sequence.alternation` 在此分支只保留型別相容位置，不承載 Spider Shot 語意。

## Event anchors and transition direction

每個目標生成時記錄既有 `visible` 事件，Spider Shot 額外帶：

```ts
{ type: 'visible', targetId, side: 'R', zone: 'center' | 'peripheral', t, targetX, targetY, targetZ }
```

離線 `deriveSpiderShotTransitions(payload)` 依時間排序相鄰的 `visible` 事件，以 `zone` 重建 transition：

- `center → peripheral` 是 `center-to-peripheral`。
- `peripheral → center` 是 `peripheral-to-center`。

兩種 transition 都輸出，讓 T3 的節奏統計保有完整序列；只有抵達周邊的 `center-to-peripheral` transition 具有象限標籤。遺漏座標、`zone`、GD-7 hitbox 或 spawn seed 的匯出會明確拋錯，避免無法溯源的條件格混入 Assessment 歷史。

## Condition geometry

`D_deg` 是前一目標與抵達目標、均由玩家原點指向目標中心的兩個方向向量之無號球面夾角。其實作共用 `angularDistanceDeg()`；`angularEccentricityDeg()` 亦使用同一函式，因此沒有第二套夾角公式。

`W_deg` 是抵達目標的角寬：

```text
W_deg = 2 × atan((hitbox.width / 2) / worldDistanceU) × 180 / π
```

`hitbox` 僅來自 `meta.targets.hitbox`（GD-7 單一來源），`worldDistanceU` 為玩家原點到抵達目標中心的距離。輸出同時保留三維 hitbox、距離與 `meta.spawn.seed`，使條件可獨立審核。

周邊點相對中心視線的方位角依 45° 分箱：上／下為 `vertical`、左／右為 `horizontal`、45°、135°、225°、315° 邊界及其斜向區域為 `oblique`。這是呈現層標籤，不進 `targetConditionCell`，因此後續 pilot 調整分箱不會改變相容鍵語意。

## Compatibility condition cell

每筆 transition 輸出固定六位小數的：

```text
spider:d=<D_deg>;w=<W_deg>
```

例如 `spider:d=15.000000;w=7.152668`。此字串是 caller-owned 的非空 `targetConditionCell`，可直接傳給 `buildCompatibilityKey()`；WP-33 不解析其內容。

## Metrics status

T2 只定義條件與事件幾何。切換反應、移動執行、停止控制、首發與節奏五類指標由 WP-36 T3 在同一組 transition anchors 上組裝，避免在此文件預先建立第二份指標定義。
