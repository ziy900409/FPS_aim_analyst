# WP-45 / T2 — `peek-ad-corridor-v1` 對稱掩體場景

## Objective

新增不影響 frozen `peek-corridor` 的左右對稱場景；同一份 props JSON 同時產生 GLTF boxes 與 `SceneConfig.propBounds`，使 render、visibility、hit occlusion 共用幾何來源。

## Dependencies

T0。可與 T1 平行；T3 同時依賴 T1+T2。

## Scope

- `src/scene/scenes/peek-ad-corridor.props.json`
- `src/scene/scenes/peek-ad-corridor.ts`
- `scripts/gen-peek-ad-corridor-gltf.mjs`
- `public/assets/scenes/peek-ad-corridor/peek-ad-corridor.gltf`
- scene/clearance/visibility tests

## Geometry invariants

- eyeZ=0、FOV=75°、player corridor 僅允許 A/D 研究範圍。
- target slots 沿用 `TargetManager` L/R positions；中心起點對兩者 visible fraction `<0.5`。
- 沿 cue 方向移動後，每側都存在 visible fraction `>=0.5` 與 full exposure `=1` 的合法區段。
- 左右 prop bounds 為 x 軸鏡像；target crossing position 的絕對值與 tick crossing 誤差 ≤1 tick。
- clearance 只允許指定 cover props 在 hidden envelope 遮擋，exposed rest envelope 必須 clear。

## Definition of Done

- [ ] generator 連跑兩次產物 byte-identical。
- [ ] GLTF node AABB 與 props JSON/SceneConfig 逐項相同。
- [ ] center hidden、correct-side onset、opposite-side仍 hidden、full exposure tests 全綠。
- [ ] 左右鏡像 invariants 全綠。
- [ ] `loadDrill` clearance 可接受 pilot target envelopes；非允許 prop 仍會拒絕。
- [ ] frozen `peek-corridor` config/asset/tests 零修改。
- [ ] `npm.cmd test -- src/scene/scenes/peek-ad-corridor.test.ts src/scene/clearance.test.ts` exit 0。

## Commit

`Add symmetric A-D peek corridor scene`
