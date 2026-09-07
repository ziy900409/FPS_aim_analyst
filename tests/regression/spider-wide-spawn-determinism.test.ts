import { describe, expect, it } from 'vitest';
import {
  END_MS,
  FIRE_COUNT,
  canonicalWideFrames,
  runWide,
  wideFrameSequences,
} from './spiderWideDeterminismFixture.ts';

/**
 * WP-57 / T2 —— NFR-57.1（跨 render FPS 決定性）與 NFR-57.5（GD-10 aspect 不變性）。
 *
 * 兩條都是「render 狀態不得進 sim」的回歸防線，只是切入面不同：
 * - NFR-57.1 擋的是**幀切法**（rAF 節流／抖動）滲進 spawn 或 tick 演進；
 * - NFR-57.5 擋的是**幀內容**（camera aspect／FOV）滲進 spawn 幾何。本 WP 唯一一次讀 FOV/aspect
 *   發生在 arm 時的 `resolveSpiderShotWideV1()`，之後解析結果凍結成 config 常數；run 內 resize 因此
 *   不得改變任何 tick 的 target 位置。
 */

describe('WP-57 T2 — NFR-57.1：spider-shot-wide-v1 跨 render FPS 決定性', () => {
  const canonical = runWide(canonicalWideFrames());

  it('harness 真的走完多個 spawn 循環（否則 parity 斷言無證明力）', () => {
    // 每次開火撤除中心目標 → 周邊 spawn → 周邊逾時撤除 → 中心 spawn，故 spawn 數 ≈ 2 × 開火數。
    expect(canonical.hitCount).toBe(FIRE_COUNT);
    expect(canonical.fireCount).toBe(FIRE_COUNT);
    expect(canonical.spawnIds.length).toBeGreaterThanOrEqual(2 * FIRE_COUNT);
    // 周邊落點左右皆出現過 ⇒ 分層佇列確實在這段 run 內推進，不是單一 cell 重複。
    const peripheralX = canonical.spawnPositions.map((pos) => pos.x).filter((x) => Math.abs(x) > 1e-9);
    expect(peripheralX.some((x) => x < 0)).toBe(true);
    expect(peripheralX.some((x) => x > 0)).toBe(true);
  });

  it.each(Object.entries(wideFrameSequences))(
    '%s 的逐 tick target 位置與 canonical 每幀一 tick 逐位一致',
    (_name, frames) => {
      const run = runWide(frames);
      expect(run.ticks).toBe(canonical.ticks);
      expect(run.phase).toBe(canonical.phase);
      expect(run.fireCount).toBe(canonical.fireCount);
      expect(run.hitCount).toBe(canonical.hitCount);
      // tick index 對應的 id 與 position 逐位相同；wall-clock 時間戳不入斷言（CLAUDE.md §4）。
      expect(run.samples).toEqual(canonical.samples);
      expect(run.spawnIds).toEqual(canonical.spawnIds);
      expect(run.spawnPositions).toEqual(canonical.spawnPositions);
    },
  );
});

describe('WP-57 T2 — NFR-57.5：run 內改 camera aspect／FOV 不改 spawn 序列', () => {
  const frames = canonicalWideFrames();
  const control = runWide(frames);

  const resizes = [
    { label: '16:9 → 21:9 超寬', aspect: 21 / 9, fovDeg: 75 },
    { label: '16:9 → 4:3 且 FOV 75 → 120', aspect: 4 / 3, fovDeg: 120 },
    { label: '16:9 → 極窄 1:2 且 FOV 75 → 60', aspect: 0.5, fovDeg: 60 },
  ];

  it.each(resizes)('$label：逐 tick target 位置與未 resize 對照組逐位一致', ({ aspect, fovDeg }) => {
    // 在 run 中段（約 40% 處，此時已完成多次 spawn、佇列仍未耗盡）改變 camera。
    const resizeAfterFrame = { frameIndex: Math.floor(frames.length * 0.4), aspect, fovDeg };
    const resized = runWide(frames, { resizeAfterFrame });

    expect(resized.samples).toEqual(control.samples);
    expect(resized.spawnIds).toEqual(control.spawnIds);
    expect(resized.spawnPositions).toEqual(control.spawnPositions);
    expect(resized.hitCount).toBe(control.hitCount);
  });

  it('對照組本身在 resize 點之後仍有新 spawn（否則不變性測到的是空區間）', () => {
    const resizeFrameMs = frames[Math.floor(frames.length * 0.4)];
    expect(resizeFrameMs).toBeLessThan(END_MS);
    const spawnsBefore = control.spawnIds.length;
    const truncated = runWide(frames.slice(0, Math.floor(frames.length * 0.4) + 1));
    expect(truncated.spawnIds.length).toBeGreaterThan(0);
    expect(truncated.spawnIds.length).toBeLessThan(spawnsBefore);
  });
});
