import { counterstrafeReversalV1 } from '../drill/counterstrafe_reversal_v1.ts';
import { holdClickV1 } from '../drill/hold_click_v1.ts';
import { holdTrackV1 } from '../drill/hold_track_v1.ts';
import { spiderShotV1 } from '../drill/spider_shot_v1.ts';
import type { TestFamilyId } from './sessionSchedule.ts';

export type PerFamilyTrialShape =
  | { readonly trialsPerCell: number }
  | { readonly targetCount: number; readonly timeLimitMs: number };

export interface SessionPlanPreset {
  readonly id: string;
  readonly restSeconds: number;
  readonly perFamilyTrialShape: Readonly<Record<TestFamilyId, PerFamilyTrialShape>>;
}

/**
 * The only operator-selectable session plan for the v1 frozen protocols.
 * Values deliberately reference their protocol configs rather than creating
 * a second independently editable source of trial counts.
 */
export const SESSION_PLAN_PRESET_PILOT_DEFAULT: SessionPlanPreset = {
  id: 'pilot-default',
  restSeconds: 60,
  perFamilyTrialShape: {
    'hold-click': { trialsPerCell: holdClickV1.drill.endCondition.value },
    'hold-track': { trialsPerCell: holdTrackV1.drill.endCondition.value },
    'spider-shot': {
      targetCount: spiderShotV1.targets.count,
      timeLimitMs: spiderShotV1.timing.timeLimitMs!,
    },
    counterstrafe: { trialsPerCell: counterstrafeReversalV1.endCondition.value },
  },
} as const;

export const SESSION_PLAN_PRESETS: readonly SessionPlanPreset[] = [SESSION_PLAN_PRESET_PILOT_DEFAULT];

export function findSessionPlanPreset(id: string): SessionPlanPreset | undefined {
  return SESSION_PLAN_PRESETS.find((preset) => preset.id === id);
}
