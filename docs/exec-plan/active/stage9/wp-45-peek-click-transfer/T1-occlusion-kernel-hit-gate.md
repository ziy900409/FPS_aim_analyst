# WP-45 / T1 — 共用 occlusion kernel + hitscan wall-block gate

## Objective

建立 visibility 與 hitscan 共用的 segment/AABB 純幾何 kernel，並把 scene `propBounds` 以 additive sim option 注入 hitscan fire path。省略 option 的所有既有 drill 必須逐位不變。

## Dependencies

T0。

## Risk

**High**：觸碰 `SimLoop` fire→hit→markKilled→recorder/impact/tracer 核心 data flow。

## Scope

- 新增 `src/scene/occlusionGeometry.ts` 與單元測試。
- `visibilityDerivation.ts` 改用 `visibleFractionForTarget()`，既有 public output 不變。
- `SimLoopOptions.hitscanOcclusion?`；`main.ts`/test harness 在建 loop 時注入 active scene props。
- hitscan target hit point 前有 blocker 時：不 kill、不記 hit，impact/tracer 終止於 blocker。
- projectile path 不變。

## Failure modes covered

- FM-P45-1 stale scene props。
- FM-P45-2 兩套遮擋定義。
- FM-P45-3 tangent/endpoint 浮點邊界。
- NFR-P45-1/2/3/4。

## Tests

1. `firstBlockingIntersection`:empty/outside/inside/tangent/endpoint/nearest/tie。
2. `visibleFractionForTarget`:1-point/9-point/partial/左右 mirror。
3. hitscan behind cover：ray 穿 target AABB 但先碰 prop → fire.hit false、target alive。
4. exposed target：fire.hit true、target removed。
5. no context：既有 fixture deep-equal。
6. scene switch：field-low→peek scene→placeholder，不殘留 props。
7. 60/120/240 Hz deterministic export。

## Definition of Done

- [ ] README §2.3 A/B 簽名或經 ADR 記錄的等價簽名已實作。
- [ ] `visibilityDerivation` 既有 tests 零 fixture 修改全綠。
- [ ] behind-cover/exposed/no-context tests 全綠。
- [ ] blocker hit 的 tracer/impact 終點為 prop intersection，非 target engagement plane。
- [ ] projectile regression tests 全綠且未套用 hitscan option。
- [ ] hot path 無 per-tick/per-fire `Vector`/array allocation；review 記錄寫入 progress。
- [ ] `npm.cmd test -- src/metrics/visibilityDerivation.test.ts src/loop/SimLoop.test.ts src/sim/HitDetector.test.ts` exit 0。
- [ ] `npm run typecheck` exit 0。

## Commit

`Add shared occlusion geometry and hitscan cover gate`
