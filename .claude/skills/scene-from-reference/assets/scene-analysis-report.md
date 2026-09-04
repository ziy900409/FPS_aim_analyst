# 場景分析報告 — `<scene-id>`

> 第一段產出(P0–P3)。**核可後**才進 P4/P5 生成 WP 執行計畫。
> 落點:`docs/scene-specs/<scene-id>-analysis.md`

| | |
|---|---|
| **場景 id** | `<scene-id>`(功能命名;禁原地圖名) |
| **服務 drill** | `<drill 檔名>` |
| **參考素材** | `<video / N 張截圖>`;來源是否商業遊戲:`<是/否>` |
| **素材位置** | `<scratchpad 路徑>` — **不進 repo** |
| **狀態** | 🟡 待審 |

---

## 0. 素材盤點(P0)

| 檔名 | 鏡位 | 看得出什麼 |
|---|---|---|
| | 正面 sightline | |
| | 掩體側視 | |
| | 俯視/小地圖 | |
| | 目標出現瞬間 | |

**缺的鏡位**:`<明列;不要用推測補>`

## 1. 語義萃取(P1)

> 依 `references/extraction-schema.md` 逐欄填。數值格式 `{value_u, anchor, confidence}`。

### 1.1 交戰拓撲
### 1.2 掩體
| id | archetype | 暴露側 | 關鍵高度 | emergence 前遮蔽 |
|---|---|---|---|---|
### 1.3 遮蔽拓撲
### 1.4 視覺條件
### 1.5 雜亂度
### 1.6 drill 契合

## 2. 紅線過閘(P2)

| 紅線 | 判定 | 證據 / 說明 |
|---|---|---|
| **R1** 只做方法學抽象;命名不沿用原地圖;素材不進 repo | ⬜ | |
| **R2** GD-6:無「sim 讀場景幾何」的衍生任務 | ⬜ | |
| **R3** 決定性:不觸及 `SIM_HZ` / 目標演進 / 命中幾何 / 輸入鏈 | ⬜ | |

**未過閘項的處理**:`<停下來問使用者;不得自行放寬>`

## 3. 規格草案(P3)

### 3.1 `props.json` 草案

```json
```

`check_props.py` 結果:`<貼上輸出;必須綠燈>`

### 3.2 render-only visuals(不入 `propBounds`)

| id | kind | 為什麼不入淨空 |
|---|---|---|

### 3.3 `SceneConfig` 建議值

| 欄位 | 建議值 | 來源 / 理由 |
|---|---|---|
| `sceneId` | | |
| `assetPackVersion` | `<id>-v1` | |
| `clutterTier` | | 對照 `field-low`(low) / `urban-high`(high) |
| `asset.url` | `/assets/scenes/<id>/<id>.gltf` | |
| `playerCorridor.halfWidthU` | | 現行僅 `1` / `2`,優先沿用 |
| `proceduralRoom.roomSize` | `[x寬, z深, y高]` | **順序**;要容得下 sightline |
| `proceduralRoom.eyeHeight` | `1.6` | 偏離需理由(影響角尺寸可比性) |
| `proceduralRoom.fovDeg` | `75` | 同上 |
| `proceduralRoom.eyeZ` | | radial-spawn 前向目標 → **必須 `0`**(KI-024) |
| `proceduralRoom.floorY` | | 省略 = 0 |
| `colors` | | 由 §1.4 視覺條件推導 |
| `lights` | | 同上 |

### 3.4 淨空 / 遮蔽策略

- `allowedOcclusionPropIds`: `<[]>`
- `exposedRestEnvelope`: `<描述或 N/A + 理由>`

## 4. Open Questions

| # | 問題 | 擋住什麼 | 由誰/如何解 |
|---|---|---|---|
| OQ-1 | | | |

## 5. 給第二段(P4/P5)的輸入摘要

- **必要 Task**:T0 / T1 props+gltf+ATTRIBUTIONS / T2 SceneConfig+單測 / T3 clearance 對抗性 fixture / T4 registry+meta
- **本場景的額外 Task**:`<有就列,沒有就寫「無」>`
- **預估風險最高的一項**:`<哪個 Task、為什麼>`
