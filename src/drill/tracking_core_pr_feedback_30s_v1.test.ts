import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { createDrillRunner } from './DrillRunner.ts';
import { resolveHitFeedback } from './DrillConfig.ts';
import { trackingCorePrFeedback30sV1 } from './tracking_core_pr_feedback_30s_v1.ts';
import { trackingCorePrFeedbackV1 } from './tracking_core_pr_feedback_v1.ts';
import { TRACKING_CORE_PR_PILOT_V1_CANDIDATES } from './tracking_core_pr_pilot_v1.ts';
import { ALL_TRACKING_PILOT_CONFIGS } from '../session/trackingPilotSchedulableDrills.ts';
import { FAMILY_BY_DRILL_ID } from '../session/drillFamily.ts';
import { formatClearanceViolations, validateClearance } from '../scene/clearance.ts';
import { fieldLow } from '../scene/scenes/field-low.ts';
import { createTrackingTrajectory } from '../sim/trackingTrajectory.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import { createSharedState } from '../state/SharedState.ts';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { simStep } from '../loop/SimLoop.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { trackingPilotHold } from '../weapon/weapons.ts';
import type { DrillConfig } from './DrillConfig.ts';

/**
 * 使用者 2026-09-14 — `tracking_core_pr_3deg_14dps_feedback_30s_noprep_v1`。
 *
 * 兩條核心宣告，各自要能被單一斷言推翻：
 * (a) **30 秒**——三個時長欄位（trajectory `durationMs` / `endCondition.value` / `presentationMs`
 *     餘裕）必須彼此一致，任一個漏改都會讓實際測試時長不是 30 s。
 * (b) **目標從計時第一個 tick 就動**——不是只看 `trackingPrepMs === undefined`（那只是實作細節），
 *     而是把兩個 drill 都推過 sim，證明參照 drill 在頭 1 秒逐位靜止、本 drill 不是。
 */

function trajectoryOf(drill: DrillConfig) {
  const config = drill.targets.trackingTrajectory;
  if (config?.kind !== 'band-limited-2d-v1') throw new Error(`${drill.drillId}: expected band-limited-2d-v1`);
  return config;
}

/** 把 drill 推到 running 後，回傳前 `sampleMs` 毫秒內每個 tick 的目標世界座標。 */
function targetPathAfterCountdown(source: DrillConfig, sampleMs: number): { x: number; y: number; z: number }[] {
  const drill = loadDrill(source, fieldLow);
  const state = createSharedState();
  const tm = createTargetManager(drill);
  const runner = createDrillRunner(state, tm);
  const recorder = createDataRecorder({ capacity: 8192, maxDrillSeconds: 60 });
  runner.start(drill);

  const tickMs = 1000 / SIM_HZ;
  const countdownTicks = Math.round(drill.timing.countdownMs / tickMs);
  const sampleTicks = Math.round(sampleMs / tickMs);
  const path: { x: number; y: number; z: number }[] = [];
  let nowMs = 0;
  for (let i = 0; i < countdownTicks + sampleTicks; i++) {
    nowMs += tickMs;
    simStep(state, 1 / SIM_HZ, nowMs, tm, undefined, undefined, undefined, runner, recorder);
    const target = state.targets[0];
    if (target !== undefined && target.visible) path.push({ ...target.pos });
  }
  return path;
}

function maxDisplacementFromFirst(path: readonly { x: number; y: number; z: number }[]): number {
  const first = path[0];
  let max = 0;
  for (const p of path) {
    max = Math.max(max, Math.hypot(p.x - first.x, p.y - first.y, p.z - first.z));
  }
  return max;
}

describe('tracking_core_pr_3deg_14dps_feedback_30s_noprep_v1 — 30 秒、全程移動的變體', () => {
  it('刺激本體逐欄等同參照 drill——只有時長與起動時機改變', () => {
    expect(trackingCorePrFeedback30sV1.drillId).toBe('tracking_core_pr_3deg_14dps_feedback_30s_noprep_v1');
    // seed / 振幅 / 速度 / 頻帶：把 durationMs 對齊後必須逐欄相等，否則「只改時長」是假的
    // （seed 若跟著變，同一個 id 底下就是另一條軌跡）。
    const base = trajectoryOf(trackingCorePrFeedbackV1);
    const next = trajectoryOf(trackingCorePrFeedback30sV1);
    expect({ ...next, durationMs: base.durationMs }).toEqual(base);
    expect(trackingCorePrFeedback30sV1.targets.hitbox).toEqual(trackingCorePrFeedbackV1.targets.hitbox);
    expect(trackingCorePrFeedback30sV1.targets.count).toBe(trackingCorePrFeedbackV1.targets.count);
    expect(trackingCorePrFeedback30sV1.targets.distance).toBe(trackingCorePrFeedbackV1.targets.distance);
    expect(trackingCorePrFeedback30sV1.weaponId).toBe(trackingCorePrFeedbackV1.weaponId);
    expect(trackingCorePrFeedback30sV1.mode).toBe(trackingCorePrFeedbackV1.mode);
    expect(trackingCorePrFeedback30sV1.sequence).toEqual(trackingCorePrFeedbackV1.sequence);
    expect(trackingCorePrFeedback30sV1.protocolGuard).toEqual(trackingCorePrFeedbackV1.protocolGuard);
    expect(resolveHitFeedback(trackingCorePrFeedback30sV1)).toBe(true);
    expect(trackingCorePrFeedback30sV1.timing.countdownMs).toBe(trackingCorePrFeedbackV1.timing.countdownMs);
  });

  it('測試時間就是 30 秒：三個時長欄位彼此一致', () => {
    expect(trackingCorePrFeedback30sV1.endCondition).toEqual({ type: 'timeLimit', value: 30_000 });
    // trajectory 的 durationMs 是 `sample()` 的夾取上界：短於 timeLimit 會讓最後幾秒目標靜止在終點值。
    expect(trajectoryOf(trackingCorePrFeedback30sV1).durationMs).toBe(30_000);
    // presentationMs 必須明顯大於 timeLimit，否則 timed presentation 會在 endCondition 之前先推進目標。
    expect(trackingCorePrFeedback30sV1.timing.presentationMs).toBeGreaterThan(30_000);
    // 參照 drill 的 26 s（1 s prep + 25 s scored）是被取代的那個數字，寫在這裡讓差異無法被誤讀成筆誤。
    expect(trackingCorePrFeedbackV1.endCondition.value).toBe(26_000);
  });

  it('沒有置中準備窗：timing 不帶 trackingPrepMs', () => {
    expect(trackingCorePrFeedback30sV1.timing.trackingPrepMs).toBeUndefined();
    expect('trackingPrepMs' in trackingCorePrFeedback30sV1.timing).toBe(false);
    // 參照 drill 帶 1 s——這正是使用者看到的「一開始一兩秒不會動」。
    expect(trackingCorePrFeedbackV1.timing.trackingPrepMs).toBe(1000);
  });

  it('端到端：倒數結束後的第一秒內，參照 drill 逐位靜止、本 drill 持續移動', () => {
    const referencePath = targetPathAfterCountdown(trackingCorePrFeedbackV1, 1000);
    const nextPath = targetPathAfterCountdown(trackingCorePrFeedback30sV1, 1000);
    expect(referencePath.length).toBeGreaterThan(100);
    expect(nextPath.length).toBe(referencePath.length);

    // 參照 drill：prep 窗內 trajectory 凍結在 sample(0) ⇒ 逐位同一點（不是「幾乎不動」）。
    expect(maxDisplacementFromFirst(referencePath)).toBe(0);
    // 本 drill：第一個 tick 就開始推進。14 deg/s、4 u 距離 ⇒ 1 s 內遠超 0.1 u。
    expect(maxDisplacementFromFirst(nextPath)).toBeGreaterThan(0.1);
    // 而且是「第一個 tick 就動」，不是「第 20 個 tick 才動」。
    expect(maxDisplacementFromFirst(nextPath.slice(0, 2))).toBeGreaterThan(0);
  });

  it('端到端：scored_start 在第一個 drive tick 觸發（prepSec=0 退化路徑），protocolGuard 仍有窗可用', () => {
    const drill = loadDrill(trackingCorePrFeedback30sV1, fieldLow);
    const state = createSharedState();
    const tm = createTargetManager(drill);
    const runner = createDrillRunner(state, tm);
    const recorder = createDataRecorder({ capacity: 4096, maxDrillSeconds: 60 });
    runner.start(drill);

    const tickMs = 1000 / SIM_HZ;
    let nowMs = 0;
    for (let i = 0; i < Math.round(drill.timing.countdownMs / tickMs) + 5; i++) {
      nowMs += tickMs;
      simStep(state, 1 / SIM_HZ, nowMs, tm, undefined, undefined, undefined, runner, recorder);
    }
    const events = recorder.snapshot().events;
    const visible = events.filter((e) => e.type === 'visible');
    const scoredStart = events.filter((e) => e.type === 'scored_start');
    expect(visible).toHaveLength(1);
    expect(scoredStart).toHaveLength(1);
    // 窗界與目標出現同一 tick——沒有 prep 窗可言，但 scored 窗本身存在（eligibility/guard 依賴它）。
    expect(scoredStart[0].t).toBe(visible[0].t);
    expect(state.tScoredStart.size).toBe(1);
  });

  it('30 秒視窗上重新量過：交付 RMS 速度仍是標稱值，excursion 仍在地板/垂直 FOV 餘裕內', () => {
    const config = trajectoryOf(trackingCorePrFeedback30sV1);
    const trajectory = createTrackingTrajectory(config);
    const out = { yawDeg: 0, pitchDeg: 0, yawVelocityDegPerSec: 0, pitchVelocityDegPerSec: 0 };
    const tickCount = Math.round((config.durationMs / 1000) * SIM_HZ);
    let sumSquares = 0;
    let maxAbsDeg = 0;
    for (let i = 0; i < tickCount; i++) {
      trajectory.sample(i / SIM_HZ, out);
      sumSquares += out.yawVelocityDegPerSec ** 2 + out.pitchVelocityDegPerSec ** 2;
      maxAbsDeg = Math.max(maxAbsDeg, Math.abs(out.yawDeg), Math.abs(out.pitchDeg));
    }
    const deliveredRms = Math.sqrt(sumSquares / tickCount);
    expect(deliveredRms / config.targetRmsSpeedDegPerSec).toBeGreaterThan(0.9);
    expect(deliveredRms / config.targetRmsSpeedDegPerSec).toBeLessThan(1.1);
    // 與 pilot 同一條界線（`tracking_core_pr_pilot_v1.test.ts`）：多走 5 秒不得把目標推到地板下或畫面外。
    expect(maxAbsDeg, 'max excursion over 30 s').toBeLessThan(20);
  });

  it('載入並通過 field-low clearance', () => {
    expect(() => loadDrill(trackingCorePrFeedback30sV1, fieldLow)).not.toThrow();
    const violations = validateClearance(fieldLow, trackingCorePrFeedback30sV1);
    expect(violations, formatClearanceViolations(violations)).toEqual([]);
  });

  it('彈匣撐得過 30 秒，held-fire 不會被空匣清掉', () => {
    const sustainableMs = trackingPilotHold.magSize * trackingPilotHold.cycletimeSec * 1000;
    expect(sustainableMs).toBeGreaterThan(trackingCorePrFeedback30sV1.endCondition.value);
  });

  it('**不是** tracking-pilot block，也不是 core matrix 候選格', () => {
    const censusIds = ALL_TRACKING_PILOT_CONFIGS.map((config) => config.drillId);
    expect(censusIds).toHaveLength(9);
    expect(censusIds).not.toContain(trackingCorePrFeedback30sV1.drillId);
    expect(TRACKING_CORE_PR_PILOT_V1_CANDIDATES).not.toContain(trackingCorePrFeedback30sV1);
  });

  it('可被 Session Plan 排程：落在 tracking 家族 roster 內', () => {
    expect(FAMILY_BY_DRILL_ID.get(trackingCorePrFeedback30sV1.drillId)).toBe('tracking');
  });
});
