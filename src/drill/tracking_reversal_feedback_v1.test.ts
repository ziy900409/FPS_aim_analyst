import { describe, expect, it } from 'vitest';
import { resolveHitFeedback } from './DrillConfig.ts';
import { trackingReversalFeedbackV1 } from './tracking_reversal_feedback_v1.ts';
import { trackingReversalPilotV1High, TRACKING_REVERSAL_PILOT_V1_CANDIDATES } from './tracking_reversal_pilot_v1.ts';
import { ALL_TRACKING_PILOT_CONFIGS } from '../session/trackingPilotSchedulableDrills.ts';
import { FAMILY_BY_DRILL_ID } from '../session/drillFamily.ts';

/**
 * WP-66 後續（使用者 2026-09-12）— `tracking_reversal_high_feedback_v1`。
 *
 * 這個檔案守的不是「新 drill 存在」，而是**它與 `tracking-pilot-v2` 的邊界**：新 drill 只差命中回饋，
 * 而協定本身**逐位不變**。沒有這兩面，日後一次「順手統一」就會把回饋漏進協定的 scored block，
 * 而那正是 OQ-66.6 裁決要擋的事（協定內混淆 + cohort key 無法分池）。
 */

/** 把 config 攤平成葉欄位路徑 → 值，供逐欄集合比較（T4 §3 的同一手法）。 */
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
  const added = [...fb.keys()].filter((k) => !fa.has(k));
  const removed = [...fa.keys()].filter((k) => !fb.has(k));
  const changed = [...fa.keys()].filter((k) => fb.has(k) && !Object.is(fa.get(k), fb.get(k)));
  return { added, removed, changed };
}

describe('tracking_reversal_high_feedback_v1 — 帶命中回饋的 reversal tracking', () => {
  it('相對 pilot high cell **只差兩欄**：drillId 與 targets.hitFeedback', () => {
    const { added, removed, changed } = diffFields(trackingReversalPilotV1High, trackingReversalFeedbackV1);
    // 新增恰一欄（回饋），刪除零欄，變動恰一欄（id）——其餘 seed／reversalIntervalMs／角度視窗／
    // 速度範圍／hitbox／timing／protocolGuard／weaponId 全部落在「零變更」那一側。
    expect(added).toEqual(['.targets.hitFeedback']);
    expect(removed).toEqual([]);
    expect(changed).toEqual(['.drillId']);
  });

  it('命中回饋實際啟用（resolveHitFeedback 為 true）', () => {
    expect(trackingReversalFeedbackV1.targets.hitFeedback).toBe('flash');
    expect(resolveHitFeedback(trackingReversalFeedbackV1)).toBe(true);
  });

  it('沿用 pilot 的固定研究因子：tracking_pilot_hold 與 mode practice', () => {
    expect(trackingReversalFeedbackV1.weaponId).toBe('tracking_pilot_hold');
    expect(trackingReversalFeedbackV1.mode).toBe('practice');
    expect(trackingReversalFeedbackV1.protocolGuard).toEqual(trackingReversalPilotV1High.protocolGuard);
  });

  it('**不是** tracking-pilot block：不在九個 block 的普查表裡', () => {
    const censusIds = ALL_TRACKING_PILOT_CONFIGS.map((config) => config.drillId);
    expect(censusIds).toHaveLength(9);
    expect(censusIds).not.toContain(trackingReversalFeedbackV1.drillId);
    // 它也不得混進 reversal 家族的候選陣列（那個陣列會被 manifest 解析）。
    expect(TRACKING_REVERSAL_PILOT_V1_CANDIDATES).not.toContain(trackingReversalFeedbackV1);
  });

  it('OQ-66.6 仍然成立：九個 tracking-pilot block 一個都沒有命中回饋', () => {
    for (const config of ALL_TRACKING_PILOT_CONFIGS) {
      expect(resolveHitFeedback(config), `${config.drillId} 不得帶命中回饋`).toBe(false);
      expect(config.targets.hitFeedback).toBeUndefined();
    }
  });

  it('可被 Session Plan 排程：落在 tracking 家族 roster 內', () => {
    expect(FAMILY_BY_DRILL_ID.get(trackingReversalFeedbackV1.drillId)).toBe('tracking');
  });
});
