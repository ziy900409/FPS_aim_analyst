import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { createSharedState } from '../state/SharedState.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import { createDrillRunner } from './DrillRunner.ts';
import { loadDrill } from './DrillLoader.ts';
import type { DrillConfig } from './DrillConfig.ts';
import { formatClearanceViolations, validateClearance } from '../scene/clearance.ts';
import { peekAdCorridor } from '../scene/scenes/peek-ad-corridor.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { createSimLoop } from '../loop/SimLoop.ts';
import { angularSizeToHitboxWidthU, PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG } from './peek_click_transfer_pilot_v1.ts';
import {
  buildPeekClickTransferPilotV2Config,
  PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG,
  PEEK_CLICK_TRANSFER_PILOT_V2_DISTANCE_U,
  peekClickTransferPilotV2,
} from './peek_click_transfer_pilot_v2.ts';

describe('peek_click_transfer_pilot_v2 candidates (WP-52 T1/T4, D-52.5/9)', () => {
  it('widens the angular-size candidate set away from pilot v1, per manual pilot feedback (D-52.9)', () => {
    expect(PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG).toEqual([1, 2.5, 5]);
    expect(PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG).not.toEqual(PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG);
  });

  it('derives world hitbox width/height from the angular-size formula and keeps a fixed depth', () => {
    for (const angularSizeDeg of PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG) {
      const cfg = buildPeekClickTransferPilotV2Config(angularSizeDeg);
      const expectedWidthU = angularSizeToHitboxWidthU(angularSizeDeg, PEEK_CLICK_TRANSFER_PILOT_V2_DISTANCE_U);
      expect(cfg.drill.targets.hitbox!.widthU).toBeCloseTo(expectedWidthU, 12);
      expect(cfg.drill.targets.hitbox!.heightU).toBeCloseTo(expectedWidthU, 12);
      expect(cfg.drill.targets.hitbox!.depthU).toBe(1);
      expect(cfg.angularSizeDeg).toBe(angularSizeDeg);
      expect(cfg.candidateLabel).toBe(`${angularSizeDeg}°`);
    }
  });

  it('gives every candidate a distinct id and a distinct pilot-only seed that never collides with v1', () => {
    const v1Seeds = new Set(
      PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG.map((deg) => 94000 + Math.round(deg * 10)),
    );
    const configs = PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG.map((deg) =>
      buildPeekClickTransferPilotV2Config(deg),
    );
    expect(new Set(configs.map((c) => c.id)).size).toBe(configs.length);
    expect(new Set(configs.map((c) => c.drill.sequence.seed)).size).toBe(configs.length);
    for (const cfg of configs) {
      expect(cfg.id).not.toMatch(/^peek_click_transfer_pilot_v1_/);
      expect(cfg.drill.sequence.seed).toBeGreaterThan(37002); // above the assessment seed roster
      expect(v1Seeds.has(cfg.drill.sequence.seed!)).toBe(false);
    }
  });

  it('declares the practice/scene/cue/timing/visibility contract — timing/visibility unchanged from v1 (D-52.5)', () => {
    const cfg = buildPeekClickTransferPilotV2Config(2.5);
    const drill = loadDrill(cfg.drill);

    expect(cfg.sceneId).toBe('peek-ad-corridor-v1');
    expect(cfg.visibility).toEqual({ sampleCount: 9, onsetThreshold: 0.5 });
    expect(drill.mode).toBe('practice');
    expect(drill.cue).toEqual({ kind: 'single' });
    expect(drill.sequence.alternation).toBe('LR');
    expect(drill.sequence.spawnDelayMsRange).toEqual([500, 500]);
    expect(drill.targets.distance).toBe(PEEK_CLICK_TRANSFER_PILOT_V2_DISTANCE_U);
    expect(drill.timing).toEqual({ countdownMs: 3000, peekTimeoutMs: 3000, timeLimitMs: 120000 });
    expect(drill.endCondition).toEqual({ type: 'targetCount', value: 20 });
  });

  it('is rejected by strict clearance but accepted with the pilot occlusion options (scene compatibility)', () => {
    const cfg = buildPeekClickTransferPilotV2Config(2.5);
    const strict = validateClearance(peekAdCorridor, loadDrill(cfg.drill));
    const strictIds = new Set(strict.map((v) => v.propId));

    expect(strictIds.has('cover-wall-l'), formatClearanceViolations(strict)).toBe(true);
    expect(strictIds.has('cover-wall-r'), formatClearanceViolations(strict)).toBe(true);
    expect(() => loadDrill(cfg.drill, peekAdCorridor)).toThrow(/cover-wall/);
    expect(() => loadDrill(cfg.drill, peekAdCorridor, { clearance: cfg.clearanceOptions })).not.toThrow();
    expect(validateClearance(peekAdCorridor, loadDrill(cfg.drill), cfg.clearanceOptions)).toEqual([]);
  });

  it('registers the 2.5° candidate as the researcher-mode default (D-52.9)', () => {
    expect(peekClickTransferPilotV2).toEqual(buildPeekClickTransferPilotV2Config(2.5));
  });
});

describe('peek_click_transfer_pilot_v2 determinism (WP-52 NFR-52-1)', () => {
  function runTimeoutOnly(drill: DrillConfig): { sides: Array<'L' | 'R'>; endedAtMs: number; phase: string } {
    const state = createSharedState();
    const targetManager = createTargetManager(drill);
    const runner = createDrillRunner(state, targetManager);
    runner.start(drill);

    const sides: Array<'L' | 'R'> = [];
    const seenIds = new Set<string>();
    const tickMs = 1000 / SIM_HZ;
    let nowMs = 0;
    let guard = 0;
    while (runner.phase !== 'ended' && guard < 30000) {
      nowMs += tickMs;
      runner.tick(state, nowMs);
      for (const t of state.targets) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          sides.push(t.side);
        }
      }
      guard++;
    }
    return { sides, endedAtMs: nowMs, phase: runner.phase };
  }

  it('replays an identical spawn sequence across an independent restart with the same seed', () => {
    const drill = buildPeekClickTransferPilotV2Config(2.5).drill;
    const first = runTimeoutOnly(drill);
    const second = runTimeoutOnly(drill);

    expect(second.sides).toEqual(first.sides);
    expect(second.endedAtMs).toBe(first.endedAtMs);
  });

  it('produces a tick/event-identical 20-trial timeout export at 60/120/240 Hz pump cadence', () => {
    const expected = runCadenceTimeoutExport(60);
    for (const hz of [60, 120, 240]) {
      const actual = runCadenceTimeoutExport(hz);
      expect(actual.phase).toBe('ended');
      expect(actual.snapshot).toEqual(expected.snapshot);
    }
  });
});

function runCadenceTimeoutExport(hz: number) {
  const drill = buildPeekClickTransferPilotV2Config(2.5).drill;
  const state = createSharedState();
  const recorder = createDataRecorder({ simHz: SIM_HZ });
  const targetManager = createTargetManager(drill);
  const runner = createDrillRunner(state, targetManager);
  let clockMs = 0;
  const loop = createSimLoop(
    state,
    { now: () => clockMs },
    SIM_HZ,
    targetManager,
    undefined,
    runner,
    recorder,
    undefined,
    drill.sequence.seed,
    { hitscanOcclusion: { propBounds: peekAdCorridor.propBounds } },
  );

  runner.start(drill);
  const endMs = 80_000;
  const frameMs = 1000 / hz;
  for (let nowMs = frameMs; nowMs < endMs; nowMs += frameMs) {
    clockMs = nowMs;
    loop.pump(clockMs);
  }
  clockMs = endMs;
  loop.pump(clockMs);
  return { phase: runner.phase, snapshot: recorder.snapshot() };
}
