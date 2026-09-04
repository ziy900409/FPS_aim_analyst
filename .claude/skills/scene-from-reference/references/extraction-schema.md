# P1 萃取 Schema — 從畫面能抽出什麼、不能抽出什麼

> P1 載入。逐欄填寫;**看不出來的填進 `unknowns`,不要猜**。

## 填寫三原則

1. **抽象優先於還原**:記「這是一面 corner-peek 掩體,暴露側在右」,不記「這面牆在畫面左三分之一」。
2. **每個數值帶錨與信心**:`{ value_u, anchor, confidence }`,規則見 `scale-anchors.md`。
3. **分清誰決定什麼**:
   - 畫面決定 → 拓撲、掩體型別、遮蔽關係、視覺條件、雜亂度
   - **drill 規格決定 → 交戰距離、目標尺寸、目標運動、`eyeZ`**
   畫面上的距離只用來檢查「場景容不容得下 drill 要的距離」,不用來設定它。

---

## Schema

```yaml
scene_id: <kebab-case 功能命名;禁原地圖名>
reference:
  kind: video | screenshots | photos
  frames: [ {file, 鏡位, 看得出什麼} ]      # P0 產出
  source_is_commercial_game: true | false   # true → R1 紅線全套適用
  # 素材本身不進 repo,只留此處的文字描述

engagement:                                  # 交戰拓撲
  primary_sightline:
    length_band: {value_u, anchor, confidence}   # 級距即可,如 15–20u
    heading: 前 | 左前 | 右前 | 側向
  secondary_sightlines: []                   # 有幾條、大致方位
  target_appears_from: 左緣 | 右緣 | 上緣 | 正面開闊 | 多向
  openness: 封閉走廊 | 半開放 | 開闊地形

cover:                                       # 掩體(每個掩體一筆)
  - id: <語意化,將來就是 prop id>
    archetype: corner-peek | head-glitch | full | soft   # 見下方定義
    exposed_side: L | R | 兩側
    key_height: {value_u, anchor, confidence}   # 掩體上緣;決定 head-glitch 成立與否
    blocks_target_before_emergence: true | false

occlusion:                                   # 遮蔽拓撲 → T3 的 ClearanceOptions
  needs_occlusion_aware_clearance: true | false
  allowed_occluders: [<cover id>]            # 允許遮住 emergence 前包絡的 prop
  exposed_rest_zone: <文字描述;暴露/靜止區必須對所有 prop 淨空>

visual:                                      # → colors / lights
  background_luminance: 暗 | 中 | 亮
  target_vs_background_contrast: 低 | 中 | 高
  dominant_hue: <文字,如 冷灰藍 / 沙黃>
  lighting: 均勻 | 強方向光 | 逆光
  notes: <會影響目標可辨識度的任何觀察>

clutter_tier:
  value: low | mid | high
  rationale: <為什麼;對照 field-low(low) / urban-high(high)>

drill_fit:                                   # 場景要服務誰
  target_drills: [<drill 檔名或名稱>]
  requires_eye_z_zero: true | false          # radial-spawn 前向目標 → true
  corridor_half_width_u: {value_u, rationale}
  floor_y: 0 | <值 + 理由>
  room_size_proposal: [x寬, z深, y高]          # 注意順序;要容得下 sightline 與目標包絡

unknowns:                                    # 鐵律欄位
  - question: <看不出來的東西>
    blocks: <會擋住哪個 Task / 哪個欄位>
    resolution: 問使用者 | 由 drill 規格決定 | 實作時實測
```

---

## 掩體原型定義(archetype)

| archetype | 判準 | 對場景的影響 |
|---|---|---|
| `corner-peek` | 垂直邊緣,玩家繞邊暴露 | 需要 `allowedOcclusionPropIds` + `exposedRestEnvelope` |
| `head-glitch` | 水平上緣 ≈ 眼高附近,只露頭 | `key_height` 必須逼近 `eyeHeight`(1.6u),精度要求高 |
| `full` | 完全阻擋,無交戰角 | 純裝飾或用來封路;不得壓到目標包絡 |
| `soft` | 視覺遮蔽但不阻斷(草叢/柵欄) | 影響可辨識度,**不一定**要進 `propBounds` — 可只做 render-only visual |

`soft` 的判斷很重要:進 `propBounds` = 參與淨空判定 = 可能擋住目標生成。
若它只影響觀感,放進 gen script 的 `visuals` 陣列而不放進 `props`。

---

## 常見誤填

| 誤填 | 為什麼錯 | 正解 |
|---|---|---|
| `length_band: 18.4u` | 假精度,畫面給不出小數 | 寫級距 `15–20u` + `confidence: low` |
| `archetype` 留白 | T3 的 `ClearanceOptions` 就沒依據 | 看不出來 → 進 `unknowns` |
| `clutter_tier: high` 無理由 | 沒有比較基準 | 對照 `field-low` / `urban-high` 給理由 |
| 把每根欄杆都列成 prop | `propBounds` 爆量,淨空判定變慢且難除錯 | 只列**影響交戰或淨空**的體積;其餘 render-only |
| `requires_eye_z_zero` 留白 | 觸發 KI-024 復發 | 查目標 drill 是不是 radial-spawn 前向目標 |
