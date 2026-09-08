import { describe, expect, it } from 'vitest';

import { createDataRecorder, type DataRecorderSnapshot } from '../data/DataRecorder.ts';
import { loadDrill } from '../drill/DrillLoader.ts';
import { createDrillRunner } from '../drill/DrillRunner.ts';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { detectionPopinV1 } from '../drill/detection_popin_v1.ts';
import { spiderShotV2 } from '../drill/spider_shot_v2.ts';
import type { Clock } from '../loop/clock.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { createSimLoop, DEFAULT_RNG_SEED } from '../loop/SimLoop.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import { createSharedState } from '../state/SharedState.ts';
import { ak47 } from '../weapon/weapons.ts';

/**
 * WP-58 T3 — what a rep actually replays.
 *
 * A rep is a plain drill restart: the schedule layer asks `loadDrillById` for the same id again and
 * the whole object graph (`SharedState` / `TargetManager` / `DrillRunner` / `DataRecorder` /
 * `SimLoop`) is rebuilt from the drill's static config, exactly as `activateDrill()` does. Two
 * consequences are pinned here, and they pull in opposite directions:
 *
 * 1. **No residue.** Rep 2 must not inherit velocity, recoil, arena rows or spawn-RNG position from
 *    rep 1 — otherwise a repeated block would not be a repeated block.
 * 2. **No fresh sampling.** The seed is a config constant, so every rep replays the *same* stimulus
 *    sequence (OQ-58.1, resolved 2026-09-08: identical per rep, current behaviour kept). Reps are
 *    therefore repeated exposure to one stimulus set, with a practice effect between them — not
 *    i.i.d. draws from a difficulty level. Analysis must not treat them as independent (D-58-T0-3).
 */

const TICK_MS = 1_000 / SIM_HZ;
const REPS = 3;

interface RepSnapshot {
  readonly seed: number;
  readonly start: { readonly x: number; readonly z: number; readonly vx: number; readonly vz: number };
  readonly spawnPositions: readonly string[];
  readonly recorded: DataRecorderSnapshot;
}

/** Rebuilds the whole per-drill graph the way `activateDrill()` does, then runs a fixed tick count. */
function runRep(source: DrillConfig, tickCount: number): RepSnapshot {
  const drill = loadDrill(source);
  const state = createSharedState();
  const targetManager = createTargetManager(drill);
  const drillRunner = createDrillRunner(state, targetManager);
  const recorder = createDataRecorder({ simHz: SIM_HZ, maxDrillSeconds: 120 });
  const clock: Clock = { now: () => 0 };
  const seed = drill.spiderShot?.seed ?? drill.sequence.seed ?? DEFAULT_RNG_SEED;
  const sim = createSimLoop(state, clock, SIM_HZ, targetManager, undefined, drillRunner, recorder, ak47, seed, {
    translation: drill.playerControl?.translation ?? 'enabled',
  });

  const start = { x: state.curr.x, z: state.curr.z, vx: state.player.vx, vz: state.player.vz };
  drillRunner.start(drill);

  // Distinct target positions in spawn order — the stimulus the participant actually sees.
  const spawnPositions: string[] = [];
  const seen = new Set<string>();
  for (let tick = 1; tick <= tickCount; tick += 1) {
    sim.pump(tick * TICK_MS);
    for (const target of state.targets) {
      if (seen.has(target.id)) continue;
      seen.add(target.id);
      spawnPositions.push(`${target.pos.x},${target.pos.y},${target.pos.z}`);
    }
  }

  return { seed, start, spawnPositions, recorded: recorder.snapshot() };
}

describe.each([
  { label: 'detection_popin_v1', source: detectionPopinV1, ticks: 2_000 },
  { label: 'spider-shot-v2', source: spiderShotV2, ticks: 400 },
])('WP-58 T3 — $label replays identically across $REPS consecutive reps', ({ source, ticks }) => {
  const reps = Array.from({ length: REPS }, () => runRep(source, ticks));

  it('starts every rep from a bit-identical, residue-free sim state', () => {
    for (const rep of reps) expect(rep.start).toEqual({ x: 0, z: 0, vx: 0, vz: 0 });
    expect(reps[1].recorded).toEqual(reps[0].recorded);
    expect(reps[2].recorded).toEqual(reps[0].recorded);
  });

  it('draws the same seed and therefore the same spawn sequence every rep (OQ-58.1)', () => {
    expect(new Set(reps.map((rep) => rep.seed)).size).toBe(1);
    expect(reps[0].spawnPositions.length).toBeGreaterThan(0);
    expect(reps[1].spawnPositions).toEqual(reps[0].spawnPositions);
    expect(reps[2].spawnPositions).toEqual(reps[0].spawnPositions);
  });
});
