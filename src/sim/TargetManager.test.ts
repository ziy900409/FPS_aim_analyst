import { describe, expect, it } from 'vitest';
import type { Clock } from '../loop/clock.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { createSimLoop } from '../loop/SimLoop.ts';
import { createSharedState } from '../state/SharedState.ts';
import { createTargetManager } from './TargetManager.ts';

const TICK_MS = 1000 / SIM_HZ; // 7.8125

/** 固定基準的注入式 sim clock（與 SimLoop 測試同型）。 */
function fixedClock(t: number): Clock {
  return { now: () => t };
}

describe('TargetManager — 可見性 + t_visible 在 sim tick 內蓋戳（FR-4.2）', () => {
  it('tick：無存活目標時 spawn 一個（spawn 即可見，OQ-4.2）', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 100);

    expect(state.targets).toHaveLength(1);
    expect(state.targets[0].visible).toBe(true);
    expect(state.targets[0].alive).toBe(true);
    // hitbox 與 mesh 同來源（box）。
    expect(state.targets[0].hitbox).toEqual({ width: 1, height: 2, depth: 1 });
  });

  it('可見轉換 tick 蓋 t_visible = nowMs', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 42.5);

    const id = state.targets[0].id;
    expect(state.tVisible.get(id)).toBe(42.5);
  });

  it('t_visible 只蓋一次：後續 tick 不覆寫、不重複 spawn', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 100);
    const id = state.targets[0].id;
    tm.tick(state, 200); // 仍可見、已蓋過
    tm.tick(state, 300);

    expect(state.tVisible.get(id)).toBe(100); // 維持首次值，未被覆寫
    expect(state.tVisible.size).toBe(1);
    expect(state.targets).toHaveLength(1); // 未重複 spawn
  });

  it('時間源為注入 sim clock（非 Date.now/rAF）：t_visible = sim tick 邏輯時間', () => {
    const state = createSharedState();
    const tm = createTargetManager();
    // 注入 baseline=1000 的 sim clock；跑一個 tick → simTimeMs = 1000 + TICK_MS。
    const loop = createSimLoop(state, fixedClock(1000), SIM_HZ, tm);

    loop.pump(1000 + TICK_MS);

    const id = state.targets[0].id;
    const stamped = state.tVisible.get(id)!;
    // 值落在注入 sim clock 域（~1007.8），而非 Date.now()（~1.7e12）或 rAF frame 時間。
    expect(stamped).toBeCloseTo(1000 + TICK_MS, 10);
    expect(stamped).toBeLessThan(1e6); // 明確排除 Date.now 域
  });

  it('markKilled：撤除目標並清 t_visible；下一 tick 補生新目標', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 100);
    const first = state.targets[0].id;
    tm.markKilled(state, first);

    expect(state.targets).toHaveLength(0);
    expect(state.tVisible.has(first)).toBe(false);

    tm.tick(state, 200); // 無存活目標 → 補生
    expect(state.targets).toHaveLength(1);
    expect(state.targets[0].id).not.toBe(first); // 新 id
    expect(state.tVisible.get(state.targets[0].id)).toBe(200);
  });

  it('reset：清空目標與 tVisible；seq 首字定首個 spawn 側', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 100); // 預設 spawn 'R'
    expect(state.targets[0].side).toBe('R');

    tm.reset(state, 'LR');
    expect(state.targets).toHaveLength(0);
    expect(state.tVisible.size).toBe(0);

    tm.tick(state, 200);
    expect(state.targets[0].side).toBe('L'); // seq 'LR' → 首側 'L'
  });
});
