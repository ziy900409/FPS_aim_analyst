import { describe, expect, it } from 'vitest';
import { TRANSFER_PILOT_FAMILY_IDS } from './sessionSchedule.ts';
import {
  findSessionPlanPreset,
  SESSION_PLAN_PRESET_PILOT_DEFAULT,
  SESSION_PLAN_PRESET_TRANSFER_PILOT_V1,
  SESSION_PLAN_PRESETS,
} from './sessionPlanPresets.ts';

describe('SESSION_PLAN_PRESET_PILOT_DEFAULT', () => {
  it('is unchanged by the versioned transfer-pilot addition (WP-45 T5)', () => {
    expect(SESSION_PLAN_PRESET_PILOT_DEFAULT.id).toBe('pilot-default');
    expect(Object.keys(SESSION_PLAN_PRESET_PILOT_DEFAULT.perFamilyTrialShape).sort()).toEqual(
      ['counterstrafe', 'hold-click', 'hold-track', 'spider-shot'].sort(),
    );
  });
});

describe('SESSION_PLAN_PRESET_TRANSFER_PILOT_V1', () => {
  it('only draws the transfer-pilot roster, not the stage6 default families', () => {
    expect(SESSION_PLAN_PRESET_TRANSFER_PILOT_V1.id).toBe('transfer-pilot-v1');
    expect(SESSION_PLAN_PRESET_TRANSFER_PILOT_V1.restSeconds).toBe(60);
    expect(Object.keys(SESSION_PLAN_PRESET_TRANSFER_PILOT_V1.perFamilyTrialShape).sort()).toEqual(
      [...TRANSFER_PILOT_FAMILY_IDS].sort(),
    );
    expect(SESSION_PLAN_PRESET_TRANSFER_PILOT_V1.perFamilyTrialShape['hold-track']).toBeUndefined();
    expect(SESSION_PLAN_PRESET_TRANSFER_PILOT_V1.perFamilyTrialShape['spider-shot']).toBeUndefined();
  });

  it('is resolvable by id alongside the unchanged default preset', () => {
    expect(findSessionPlanPreset('transfer-pilot-v1')).toBe(SESSION_PLAN_PRESET_TRANSFER_PILOT_V1);
    expect(findSessionPlanPreset('pilot-default')).toBe(SESSION_PLAN_PRESET_PILOT_DEFAULT);
    expect(SESSION_PLAN_PRESETS).toHaveLength(2);
  });
});
