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

  it('roster 現況（T4）：`tracking_br_v1` 家族**八格全部**啟用', async () => {
    const { trackingBrVariants } = await import('./tracking_br_v1.ts');
    expect(trackingBrVariants).toHaveLength(8);
    for (const variant of trackingBrVariants) {
      expect(resolveHitFeedback(variant.drill)).toBe(true);
    }
  });

  /**
   * FR-66.11 的反向面：**未列名者一律不啟用**。若沒有這條，T4 的「只動清單上的 id」就只是
   * commit message 裡的一句話，沒有任何東西會在它被破壞時轉紅。
   *
   * `hold_track_v1` 是這裡最重要的一格——它屬 stage6 `protocolVersion = '1.0.0'` 凍結範圍
   * （GD-23），對它改視覺＝靜默改已凍結協定。
   */
  it('roster 現況（T4）：未列名的 drill 一律不啟用', async () => {
    const [{ holdTrackV1 }, { TRACKING_CORE_PR_PILOT_V1_CANDIDATES }, { trackingReversalPilotV1Medium }] =
      await Promise.all([
        import('./hold_track_v1.ts'),
        import('./tracking_core_pr_pilot_v1.ts'),
        import('./tracking_reversal_pilot_v1.ts'),
      ]);

    expect(resolveHitFeedback(holdTrackV1.drill)).toBe(false);
    expect(resolveHitFeedback(trackingReversalPilotV1Medium)).toBe(false);
    for (const cell of TRACKING_CORE_PR_PILOT_V1_CANDIDATES) {
      expect(resolveHitFeedback(cell)).toBe(false);
    }
  });
});
