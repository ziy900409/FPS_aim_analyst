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
   * FR-66.11 的反向面：**未列名者一律不啟用**。若沒有這條，「只動清單上的 id」就只是 commit
   * message 裡的一句話，沒有任何東西會在它被破壞時轉紅。
   *
   * `hold_track_v1`：stage6 `protocolVersion = '1.0.0'` 凍結範圍（GD-23），對它改視覺＝靜默改
   * 已凍結協定。
   */
  it('roster 現況（T4）：未列名的 drill 一律不啟用', async () => {
    const { holdTrackV1 } = await import('./hold_track_v1.ts');

    expect(resolveHitFeedback(holdTrackV1.drill)).toBe(false);
  });

  /**
   * OQ-66.6（使用者 2026-09-12 裁決 A）——**整個 WP-54 tracking-pilot 家族排除在外**。
   *
   * 這不是「還沒做到」，是**刻意的**。T0 的 OQ-66.1 原本把 `tracking_core_pr_pilot_v1_2deg_5dps`
   * 與 `tracking_reversal_pilot_v1_high` 列入啟用清單；T4 執行期讀碼發現兩者是
   * [`tracking-pilot-v2`](../pilot/trackingCompatibilityKey.ts) 這個**已版本化協定**六個 scored
   * block 中的兩個。只開那兩個會同時踩兩個效度地雷：
   *
   * 1. **協定內條件混淆**：2/6 帶回饋、4/6 不帶。該協定的主要結果定義在 scored block 之間的比較
   *    上 ⇒ size／speed／reversal 三個對比全部與「有無回饋」共變。
   * 2. **cohort key 無法分池**：`checkTrackingCompatibility()` 逐欄比十個軸，**沒有一個是
   *    `hitFeedback`** ⇒ 啟用前與啟用後的同一 block 取得相同相容性鍵。這正是 KI-025 的失效模式
   *    （`TRACKING_PILOT_PROTOCOL_VERSION` 停在 `v1` 三個切片，使兩代共用同一把鍵）。
   *
   * 斷言寫在 `ALL_TRACKING_PILOT_CONFIGS`（全部九個 block 的普查表）與策展註冊表**兩處**上，因為
   * 那正是兩個會被誤改的入口：前者是協定 runner 解析 manifest 用的 census，後者是 Session Plan
   * 排程用的策展清單。兩者對 `tracking_core_pr_pilot_v1_2deg_5dps` **是不同的物件參考**，所以只
   * 守一邊會讓同一個 `drillId` 依進入路徑帶兩種刺激。
   *
   * 要啟用此家族，必須連同 `TRACKING_PILOT_PROTOCOL_VERSION` 升版一起做（該常數自述「Bumping
   * this is a research-visible act … may only move together with a new protocol decision row」），
   * 屬另一個 WP 的範圍。
   */
  it('OQ-66.6：整個 tracking-pilot-v2 家族排除在外（含 manifest census 與策展註冊表兩個入口）', async () => {
    const [{ ALL_TRACKING_PILOT_CONFIGS, TRACKING_PILOT_SCHEDULABLE_DRILLS }] = await Promise.all([
      import('../session/trackingPilotSchedulableDrills.ts'),
    ]);

    expect(ALL_TRACKING_PILOT_CONFIGS).toHaveLength(9);
    for (const config of ALL_TRACKING_PILOT_CONFIGS) {
      expect(resolveHitFeedback(config), config.drillId).toBe(false);
    }

    expect(TRACKING_PILOT_SCHEDULABLE_DRILLS).toHaveLength(2);
    for (const entry of TRACKING_PILOT_SCHEDULABLE_DRILLS) {
      expect(resolveHitFeedback(entry.config), entry.config.drillId).toBe(false);
    }
  });
});
