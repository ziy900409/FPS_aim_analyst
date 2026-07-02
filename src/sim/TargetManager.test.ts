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

describe('TargetManager — 左右交替序列（FR-4.3）', () => {
  /** 驅動一輪「擊殺 → 下一 tick 生成對側」;回傳每次 spawn 的 side（依序）。 */
  function killSequence(seq: 'LR' | 'RL', rounds: number): Array<'L' | 'R'> {
    const state = createSharedState();
    const tm = createTargetManager();
    tm.reset(state, seq);
    const sides: Array<'L' | 'R'> = [];
    let now = 100;
    for (let i = 0; i < rounds; i++) {
      tm.tick(state, now); // 無存活目標 → spawn
      sides.push(state.targets[0].side);
      tm.markKilled(state, state.targets[0].id); // 擊殺 → 翻面
      now += 100;
    }
    return sides;
  }

  it('連續 markKilled → side 嚴格交替（R→L→R→L…）', () => {
    expect(killSequence('RL', 5)).toEqual(['R', 'L', 'R', 'L', 'R']);
  });

  it('首側由 reset(seq) 決定，之後嚴格交替（L→R→L…）', () => {
    expect(killSequence('LR', 4)).toEqual(['L', 'R', 'L', 'R']);
  });

  it('每次生成對側目標蓋一枚新 t_visible（不同 id、新戳值）', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 100);
    const first = state.targets[0];
    expect(state.tVisible.get(first.id)).toBe(100);

    tm.markKilled(state, first.id);
    expect(state.tVisible.has(first.id)).toBe(false); // 舊戳清掉

    tm.tick(state, 250); // 生成對側
    const second = state.targets[0];
    expect(second.id).not.toBe(first.id); // 新 id
    expect(second.side).not.toBe(first.side); // 對側
    expect(state.tVisible.get(second.id)).toBe(250); // 新 t_visible
    expect(state.tVisible.size).toBe(1); // 一次只一枚（單 active 目標）
  });

  it('決定性：相同 seq 重跑產生完全相同的 side 序列', () => {
    expect(killSequence('RL', 6)).toEqual(killSequence('RL', 6));
    expect(killSequence('LR', 6)).toEqual(killSequence('LR', 6));
  });

  it('擊殺不存在的 id 不推進序列（不翻面）', () => {
    const state = createSharedState();
    const tm = createTargetManager();

    tm.tick(state, 100); // spawn 'R'
    expect(state.targets[0].side).toBe('R');

    tm.markKilled(state, 'nonexistent'); // 無效擊殺
    tm.markKilled(state, state.targets[0].id); // 真擊殺 → 翻面

    tm.tick(state, 200);
    expect(state.targets[0].side).toBe('L'); // 只翻一次 → 對側
  });
});
