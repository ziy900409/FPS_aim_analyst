# 場景契約 — 本 repo 的「一個場景」到底是什麼

> P2 載入。所有斷言取自 `src/scene/`、`src/render/`、`src/main.ts` 現行程式碼。

---

## 1. 一個場景 = 8 件交付物

| # | 產物 | 權威性 | 誰生成 |
|---|---|---|---|
| 1 | `src/scene/scenes/<id>.props.json` | **唯一權威** prop 清單 | 人(P3 草案 → T1 定稿) |
| 2 | `scripts/gen-<id>-gltf.mjs` | 讀 ①,程序化吐 box 幾何 | 人(照抄既有 gen script 改參數) |
| 3 | `public/assets/scenes/<id>/<id>.gltf` | 衍生物,**不手改** | ② `node scripts/gen-<id>-gltf.mjs` |
| 4 | `src/scene/scenes/<id>.ts` | `SceneConfig`,`propBounds` 由 ① map 過來 | 人 |
| 5 | `src/scene/scenes/<id>.test.ts` | 場景不變式 | 人 |
| 6 | registry 掛線 ×3 | 場景才進得了 UI / 結果頁 / replay | 人 |
| 7 | `ATTRIBUTIONS.md` 逐項 | GD-9 授權稽核 | 人 |
| 8 | clearance / occlusion 對齊 | drill 載得進來 | 人(T3 對抗性 fixture) |

**①→③ 單向**:`props.json` 同時餵 `propBounds`(淨空判定)與 gltf(視覺)。
兩邊各寫一份 = 視覺與判定漂移,這是本 repo 明確避開的坑。

### registry 三處(缺一場景就是半殘)

| 檔案 | 做什麼 | 現況 |
|---|---|---|
| `src/main.ts` `availableScenes` | 場景切換選單 | `placeholder-room` / `field-low` / `urban-high` / `br-field` / `peek-corridor` / `peek-ad-corridor` |
| `src/results/ResultPresentation.ts` `KNOWN_SCENES` | 結果頁還原場景 | 同上(缺 `placeholder-room` 以外皆列) |
| `src/render/replay/replaySceneResolution.ts` | replay 依 `meta.scene.sceneId` 找回 config | 由呼叫端傳 `availableScenes` |

---

## 2. `SceneConfig` 欄位語意(每欄都要有來源,不能憑感覺填)

```ts
validateScene({
  sceneId: string,              // kebab-case 功能命名。禁用原地圖名(R1)
  assetPackVersion: string,     // '<id>-v1';幾何改版即升版
  clutterTier: 'low'|'mid'|'high',
  asset: { url: string, displayScale?: number } | null,
  propBounds: readonly PropBound[],          // 由 props.json map
  playerCorridor: { halfWidthU: number },    // >0
  proceduralRoom?: {
    roomSize: [width_x, depth_z, height_y],  // 注意順序!
    eyeHeight: number,                        // 現行全場景 1.6
    fovDeg: number,                           // 現行全場景 75
    eyeZ?: number,                            // 見下方警告
    floorY?: number,                          // 省略 = 0
    colors: { floor, wall, background },      // 0xRRGGBB
    lights: { ambientIntensity, directionalIntensity, directionalPosition },
  },
})
```

### `roomSize` 是 `[x寬, z深, y高]`

`resolveEyeWorldBase` 取 `roomSize[1]` 當 depth,`#buildRoom` 取 `roomSize[2]` 當高度。
寫成 `[寬, 高, 深]` 會讓 camera 落在錯誤的 z —— 這是最常見的低級錯誤。

### `eyeZ` — KI-024 / BD-024 的復發坑

省略時 fallback = `roomSize[1] / 2 − CAMERA_STANDOFF(=1)`。

<CRITICAL>
**前向目標(`z = −distance`)的 radial-spawn drill 必須設 `eyeZ: 0`**,
否則實際交戰距離 ≠ config `distance`,角尺寸/角速度全部失真。
`field-low` / `br-field` / `peek-corridor` / `peek-ad-corridor` 都設了 `eyeZ: 0`。
新場景若服務這類 drill,`eyeZ: 0` 是預設答案,不是選項。
</CRITICAL>

### `floorY`

省略 = 0。調降會連動加高牆體(牆以 `floorY` 為下緣、`roomSize[2]` 為上緣),不留視覺縫隙。

### 現行場景的數值慣例(新場景的錨)

| 場景 | clutterTier | roomSize | eyeHeight | fovDeg | eyeZ | corridor halfWidthU |
|---|---|---|---|---|---|---|
| `field-low` | low | `[10, 10, 4]` | 1.6 | 75 | 0 | 1 |
| `urban-high` | high | `[10, 10, 4]` | 1.6 | 75 | (省略) | 1 |
| `br-field` | low | `[42, 290, 8]` | 1.6 | 75 | 0 | 由 props 的 `corridorClearance` 推導 |
| `peek-corridor` | low | `[12, 14, 4]` | 1.6 | 75 | 0 | 1 |
| `peek-ad-corridor` | low | `[12, 14, 4]` | 1.6 | 75 | 0 | 2 |

**偏離這些值要有理由,並寫進分析報告。** `eyeHeight` / `fovDeg` 尤其:改了就改變角尺寸,
跨場景比較的效度就沒了。

---

## 3. `props.json` 格式

```json
{
  "_comment": "<id> authoritative prop list (WP-NN Tn). Single source: scripts/gen-<id>-gltf.mjs 讀本檔生成 gltf,<id>.ts 映射為 SceneConfig.propBounds。",
  "props": [
    { "id": "cover-wall", "kind": "wall",
      "min": { "x": -2.5, "y": 0, "z": -4.4 },
      "max": { "x": -2.3, "y": 3, "z": -3.6 } }
  ]
}
```

- `min ≤ max` 逐軸(`validatePropBounds` 會擋)
- `id` 全場景唯一,且**語意化**(`cover-wall` 不是 `box-3`)——淨空違規訊息會指名 id
- `kind` 沿用既有分類:`wall` `ground` `guide` `building` `crate` `barrel` `barrier` `rock` `tree` `shrub` `hay` `lamp` `sign`
- **render-only 裝飾**(地面、引導線)可以放進 gen script 的 `visuals` 而**不入** `props`,
  這樣它們有視覺但不參與淨空判定(見 `gen-peek-corridor-gltf.mjs`)

---

## 4. 淨空與遮蔽(T3 要釘死的東西)

```ts
validateClearance(scene, drill, options?): ClearanceViolation[]   // 空陣列 = 通過
```

- prop 會被 **膨脹** `targetHitboxRadius(hitbox) + CLEARANCE_MARGIN_U` 後再測相交
- 玩家走廊由 `playerCorridor.halfWidthU` 取樣;目標包絡由 `deriveTargetEnvelopes(drill)` 推導
- 違規回傳 `{ propId, segment }` —— 所以 prop id 必須人看得懂

**需要掩體遮住目標**(peek 類場景)時用 `ClearanceOptions`,不要放寬全域判定:

```ts
{
  allowedOcclusionPropIds: ['cover-wall'],   // 這些 prop 可以遮 emergence 前的包絡
  exposedRestEnvelope: { min, max, side },   // 但暴露/靜止子包絡對所有 prop 都必須淨空
}
```

遮蔽的**幾何解析**在 `src/scene/occlusionGeometry.ts`(`firstBlockingIntersection` /
`visibleFractionForTarget`)——**scene 層離線解析,不是 sim**。這是 GD-6 邊界的既有解法,照走。

---

## 5. 硬約束(逐條,出處 `CLAUDE.md §4`)

| 約束 | 對場景的具體意義 |
|---|---|
| **GD-6** | `src/sim` / `SharedState` / `HitDetector` / `TargetManager` 不得引用任何場景資料。場景幾何只給 render + validation 層 |
| **GD-6/GD-10** | 場景切換不得改變 `SIM_HZ`、sim 狀態演進、輸入鏈、命中判定 |
| **GD-9** | 只有 CC0 / CC-BY 資產能 commit,且 `ATTRIBUTIONS.md` 逐項可稽核(資產名/作者/來源/授權/取得日/路徑/重生指令) |
| **GD-7** | hitbox 單一來源;場景不得另開一套尺寸常數 |
| 決定性 | 「同輸入序列跨場景 sim 狀態逐位一致」必須有自動化斷言 |
| 彈道 | 子彈永不與場景幾何互動:`propBounds` 不進 raycast |

### 本 repo 的資產路線:**只走原創程序化 box**

`field-low` / `urban-high` / `br-field` / `peek-corridor` / `peek-ad-corridor` 五個場景全部是
`props.json → gen-*.mjs → CC0 原創幾何`。**新場景照走這條**,不要引入第三方 GLTF:
授權零風險、`propBounds` 與視覺天生同源、gltf 可隨時重生。

`ATTRIBUTIONS.md` 條目照抄既有格式,「作者 = FPS_aim_analyst 專案(**原創**)」、
「授權 = CC0 1.0」、並附**重生方式**(`node scripts/gen-<id>-gltf.mjs`)。
