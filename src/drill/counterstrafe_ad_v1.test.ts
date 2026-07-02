import { describe, expect, it } from 'vitest';
import { createSharedState } from '../state/SharedState.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import { loadDrill } from './DrillLoader.ts';
// drills/ 在 src 外(專案根);Vite 原生 JSON import（同 main.ts 未來載入 drill 的路徑）。
import drillJson from '../../drills/counterstrafe_ad_v1.json';

/**
 * counterstrafe_ad_v1 端到端可玩性驗證 — WP-6 / T3（FR-6.3）
 *
 * 驗收 T3 交付的範例 drill 檔本身可端到端遊玩:import 磁碟上的
 * `drills/counterstrafe_ad_v1.json`（Vite JSON import 路徑）→ `loadDrill` 驗證通過 →
 * 以其驅動 `createTargetManager` 跑滿一輪,斷言左右交替（首側 L）與 count 上限（20）。
 * `drillId` 對齊規格附錄 C（WP-7 匯出 metadata 會用）。
 */

describe('counterstrafe_ad_v1 drill 檔（FR-6.3）', () => {
  it('經 loadDrill 驗證通過,drillId 對齊附錄 C metadata', () => {
    const cfg = loadDrill(drillJson);
    expect(cfg.drillId).toBe('counterstrafe_ad_v1');
    expect(cfg.targets.count).toBe(20);
    expect(cfg.sequence.alternation).toBe('LR');
    expect(cfg.endCondition).toEqual({ type: 'targetCount', value: 20 });
  });

  it('目標距離落在佔位房間內（z=-distance 不越北牆 z=-5,可見不被遮擋）', () => {
    const cfg = loadDrill(drillJson);
    // roomSize 預設 [10,10,3] → 北牆 z=-5;distance 須 < 5 否則目標生在牆後（TargetManager 註解）。
    expect(cfg.targets.distance).toBeLessThan(5);
  });

  it('config 驅動 TargetManager:跑滿一輪為左右交替（首側 L）、spawn 上限 = count', () => {
    const cfg = loadDrill(drillJson);
    const state = createSharedState();
    const tm = createTargetManager(cfg);
    tm.reset(state);

    const sides: ('L' | 'R')[] = [];
    // 模擬 counter-strafe 節奏:每輪 tick 生成→記錄→擊殺,直到不再補生（達 count 上限）。
    for (let i = 0; i < cfg.targets.count + 5; i++) {
      tm.tick(state, i * 100);
      if (state.targets.length === 0) break; // 達 count 上限後不再補生 → 輪次結束
      const t = state.targets[0];
      sides.push(t.side);
      tm.markKilled(state, t.id);
    }

    // 恰好 spawn count 個目標,不多不少（換 config 即換數量,F4）。
    expect(sides).toHaveLength(cfg.targets.count);
    // 首側 L（alternation 'LR'）、之後嚴格 L↔R 交替。
    expect(sides[0]).toBe('L');
    for (let i = 1; i < sides.length; i++) {
      expect(sides[i]).not.toBe(sides[i - 1]);
    }
  });
});
