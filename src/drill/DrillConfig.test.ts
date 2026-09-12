import { describe, expect, it } from 'vitest';
import { resolveHitFeedback, type DrillConfig } from './DrillConfig.ts';
import { validateDrill } from './schema.ts';

/**
 * WP-66 / T3 — `resolveHitFeedback()` 的四個分支。
 *
 * 這個 helper 是 `main.ts` 五條 drill 進入路徑**共用的單一比較式**（FM-3：四處各寫一次 =
 * 漏一處就換 drill 後行為不一致）。四個分支全部釘住，改壞任何一個都會 RED。
 */
function configWith(targets: Partial<DrillConfig['targets']>): DrillConfig {
  return validateDrill({
    drillId: 'counterstrafe_ad_v1',
    targets: { count: 20, distance: 4, ...targets },
    sequence: { alternation: 'RL' },
    timing: { countdownMs: 3000 },
    endCondition: { type: 'targetCount', value: 20 },
  });
}

describe('resolveHitFeedback（WP-66 / T3，FR-66.8／FR-66.9）', () => {
  it('config 省略（尚未載入任何 drill）→ false', () => {
    expect(resolveHitFeedback(undefined)).toBe(false);
  });

  it('targets.hitFeedback 省略 → false（既有 drill 不啟用）', () => {
    expect(resolveHitFeedback(configWith({}))).toBe(false);
  });

  it("targets.hitFeedback === 'flash' → true", () => {
    expect(resolveHitFeedback(configWith({ hitFeedback: 'flash' }))).toBe(true);
  });

  it('非法值走不到這裡——schema 在載入時就攔下（單一驗證點，不在 resolver 內再判一次）', () => {
    expect(() => configWith({ hitFeedback: 'blink' as 'flash' })).toThrow(/targets\.hitFeedback/);
  });

  it('roster 現況：本 task 不啟用任何 drill（值變更屬 T4）', async () => {
    const { trackingBrVariants } = await import('./tracking_br_v1.ts');
    for (const variant of trackingBrVariants) {
      expect(resolveHitFeedback(variant.drill)).toBe(false);
    }
  });
});
