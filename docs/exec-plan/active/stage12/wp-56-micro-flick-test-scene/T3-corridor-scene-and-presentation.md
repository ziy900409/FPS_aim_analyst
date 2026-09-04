# WP-56 T3 — Corridor GLTF／Scene Config／Presentation Lifecycle

## Objective

交付接近參考影片構圖的輕量灰白走廊，沿用既有SceneManager與TargetView呈現三顆紅色球，並以asset inventory、projection、contrast與resource tests證明無槍模／手模與無GPU成長。

## Steps

1. 依T0凍結尺寸製作`micro-flick-room.gltf`：floor、ceiling、side/end walls與規則panel seams；材質／node命名遵守allowlist。
2. 新增`micro-flick-room.ts` scene config：asset version、URL/displayScale、camera eye/FOV、neutral lights、background、corridor與prop bounds。
3. 以asset parser test核對finite transforms、local assets、node/primitive/material budget與禁止名稱；不得把targets/camera/lights/weapon烘焙進GLTF。
4. 以SceneManager tests驗證load、effective config、fallback、resize、rapid switch、dispose與late load處理。
5. 以TargetView sphere tests驗證3個targets的位置/scale/visibility與pool reuse；1000 replacements後pool仍為3。
6. 以projected bounds／pixel sampling量測1080p/720p safe region、中央消失點與target/background contrast。
7. 執行至少50次enter/switch/leave，記scene children、geometry/material dispose spies與browser errors。

## Asset budgets（T0可收緊）

- environment nodes／primitives使用T0核准上限；禁止每片小panel各自成為無界draw call。
- external URI只允許本scene資料夾相對路徑；禁止data/session/history或遠端URL。
- asset inventory必須沒有`weapon|gun|rifle|pistol|hand|arm|muzzle|target` gameplay nodes。

## Definition of Done

- [ ] FR-56.2/5/11/13/15 scene/render tests全綠。
- [ ] asset allowlist、budgets與no-weapon/no-target gates可在CI重跑。
- [ ] camera/FOV/eye/end-wall與spawn field projection符合T0數值契約。
- [ ] NFR-56.5～8達標；50-cycle無scene child/GPU/listener累積。
- [ ] fallback可操作且切離正常，沒有黑屏、stale scene或unhandled rejection。

## Commit

```text
feat(stage12): add micro-flick corridor scene
```

