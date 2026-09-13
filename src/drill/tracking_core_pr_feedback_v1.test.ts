import { describe, expect, it } from 'vitest';
import { resolveHitFeedback } from './DrillConfig.ts';
import { trackingCorePrFeedbackV1 } from './tracking_core_pr_feedback_v1.ts';
import { TRACKING_CORE_PR_PILOT_V1_CANDIDATES } from './tracking_core_pr_pilot_v1.ts';
import { ALL_TRACKING_PILOT_CONFIGS } from '../session/trackingPilotSchedulableDrills.ts';
import { FAMILY_BY_DRILL_ID } from '../session/drillFamily.ts';

/**
 * WP-66 後續（使用者 2026-09-13）— `tracking_core_pr_3deg_14dps_feedback_v1`。
 *
 * 與 [`tracking_reversal_feedback_v1.test.ts`](./tracking_reversal_feedback_v1.test.ts) 同一組性質，
 * 外加一條該檔不需要的：本 drill 走 **builder** 取格（而非 spread 既有 exported const），所以必須另外
 * 證明「builder 產出的那一格**就是** census 上的同名格」，否則「只差兩欄」是拿錯的基準比出來的。
 */

function flatten(value: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (value === null || typeof value !== 'object') {
    out.set(prefix, value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      for (const [k, v] of flatten(item, `${prefix}[${i}]`)) out.set(k, v);
    });
    return out;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    for (const [k, v] of flatten(item, `${prefix}.${key}`)) out.set(k, v);
  }
  return out;
}

function diffFields(a: unknown, b: unknown): { added: string[]; removed: string[]; changed: string[] } {
  const fa = flatten(a);
  const fb = flatten(b);
  return {
    added: [...fb.keys()].filter((k) => !fa.has(k)),
    removed: [...fa.keys()].filter((k) => !fb.has(k)),
    changed: [...fa.keys()].filter((k) => fb.has(k) && !Object.is(fa.get(k), fb.get(k))),
  };
}

/** census 上的同名格——**用 drillId 找**，不用候選陣列索引（WP-64 §1.5）。 */
const censusCell = ALL_TRACKING_PILOT_CONFIGS.find(
  (config) => config.drillId === 'tracking_core_pr_pilot_v1_3deg_14dps',
);

describe('tracking_core_pr_3deg_14dps_feedback_v1 — 帶命中回饋的 core pursuit 格', () => {
  it('取到的基準格確實存在於 census（否則以下比較全部沒有意義）', () => {
    expect(censusCell).toBeDefined();
    expect(TRACKING_CORE_PR_PILOT_V1_CANDIDATES).toContain(censusCell);
  });

  it('相對 census 上的 3deg/14dps 格**只差兩欄**：drillId 與 targets.hitFeedback', () => {
    const { added, removed, changed } = diffFields(censusCell, trackingCorePrFeedbackV1);
    // 特別重要：`trackingTrajectory.seed` 必須落在「零變更」那一側——builder 的 seed 由 candidate
    // 索引決定，取錯格會在這裡顯示成 seed 改變，而不是無聲地變成另一個刺激。
    expect(added).toEqual(['.targets.hitFeedback']);
    expect(removed).toEqual([]);
    expect(changed).toEqual(['.drillId']);
  });

  it('命中回饋實際啟用', () => {
    expect(trackingCorePrFeedbackV1.targets.hitFeedback).toBe('flash');
    expect(resolveHitFeedback(trackingCorePrFeedbackV1)).toBe(true);
  });

  it('沿用 pilot 的固定研究因子：tracking_pilot_hold 與 mode practice', () => {
    expect(trackingCorePrFeedbackV1.weaponId).toBe('tracking_pilot_hold');
    expect(trackingCorePrFeedbackV1.mode).toBe('practice');
    expect(trackingCorePrFeedbackV1.protocolGuard).toEqual(censusCell?.protocolGuard);
  });

  it('**不是** tracking-pilot block：不在九個 block 的普查表裡', () => {
    const censusIds = ALL_TRACKING_PILOT_CONFIGS.map((config) => config.drillId);
    expect(censusIds).toHaveLength(9);
    expect(censusIds).not.toContain(trackingCorePrFeedbackV1.drillId);
    expect(TRACKING_CORE_PR_PILOT_V1_CANDIDATES).not.toContain(trackingCorePrFeedbackV1);
  });

  it('OQ-66.6 仍然成立：九個 tracking-pilot block 一個都沒有命中回饋', () => {
    for (const config of ALL_TRACKING_PILOT_CONFIGS) {
      expect(resolveHitFeedback(config), `${config.drillId} 不得帶命中回饋`).toBe(false);
    }
  });

  it('可被 Session Plan 排程：落在 tracking 家族 roster 內', () => {
    expect(FAMILY_BY_DRILL_ID.get(trackingCorePrFeedbackV1.drillId)).toBe('tracking');
  });
});
