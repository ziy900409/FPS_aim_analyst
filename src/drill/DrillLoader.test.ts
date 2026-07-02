import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';

/** 最小合法 config（欄位形狀對齊 DrillConfig / validateDrill）。 */
const VALID = {
  drillId: 'test_ad_v1',
  targets: { count: 10, distance: 4 },
  sequence: { alternation: 'RL' },
  timing: { countdownMs: 3000 },
  endCondition: { type: 'targetCount', value: 10 },
} as const;

describe('loadDrill — 載入邊界（FR-6.2，OQ-6.4）', () => {
  it('接受已解析物件 → 回傳收斂 DrillConfig', () => {
    const cfg = loadDrill(VALID);
    expect(cfg.drillId).toBe('test_ad_v1');
    expect(cfg.targets.count).toBe(10);
    expect(cfg.sequence.alternation).toBe('RL');
    expect(cfg.endCondition).toEqual({ type: 'targetCount', value: 10 });
  });

  it('接受 JSON 字串 → 解析後驗證回傳（fetch().text() 路徑）', () => {
    const cfg = loadDrill(JSON.stringify(VALID));
    expect(cfg.drillId).toBe('test_ad_v1');
    expect(cfg.targets.distance).toBe(4);
  });

  it('JSON 字串語法錯 → throw 明確「載入失敗」錯誤、不回傳半成品', () => {
    expect(() => loadDrill('{ not valid json ')).toThrow(/載入失敗: JSON 解析錯誤/);
  });

  it('schema 不合（缺欄位）→ 委派 validateDrill throw 帶欄位路徑錯誤', () => {
    const bad = { ...VALID, targets: { distance: 4 } }; // 缺 targets.count
    expect(() => loadDrill(bad)).toThrow(/驗證失敗: targets\.count/);
  });

  it('schema 不合（型別錯）→ throw（不啟動 drill，OQ-6.4）', () => {
    const bad = { ...VALID, sequence: { alternation: 'XY' } };
    expect(() => loadDrill(bad)).toThrow(/驗證失敗: sequence\.alternation/);
  });
});
