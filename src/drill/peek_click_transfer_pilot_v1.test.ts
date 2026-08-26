import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createSharedState, type SharedState } from '../state/SharedState.ts';
import type { TargetManager } from '../sim/TargetManager.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import type { TargetState } from '../state/types.ts';
import { createDrillRunner } from './DrillRunner.ts';
import { loadDrill } from './DrillLoader.ts';
import { resolveTargetHitbox, type DrillConfig } from './DrillConfig.ts';
import {
  formatClearanceViolations,
  TARGET_CENTER_Y_U,
  TARGET_SIDE_OFFSET_U,
  validateClearance,
} from '../scene/clearance.ts';
import type { PropBound } from '../scene/SceneConfig.ts';
import { peekAdCorridor } from '../scene/scenes/peek-ad-corridor.ts';
import { resolveEyeWorldBase } from '../scene/eyePose.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { simStep, type HitscanOcclusionContext } from '../loop/SimLoop.ts';
import {
  angularSizeToHitboxWidthU,
  buildPeekClickTransferPilotConfig,
  PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG,
  PEEK_CLICK_TRANSFER_DISTANCE_U,
  peekClickTransferPilotV1,
} from './peek_click_transfer_pilot_v1.ts';

const TICK_MS = 1000 / SIM_HZ;
const EYE_BASE = resolveEyeWorldBase(peekAdCorridor);
const HALF_WIDTH_U = peekAdCorridor.playerCorridor.halfWidthU;

describe('peek_click_transfer_pilot_v1 candidates (FR-P45-7)', () => {
  it('derives world hitbox width/height from the angular-size formula and keeps a fixed depth', () => {
    for (const angularSizeDeg of PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG) {
      const cfg = buildPeekClickTransferPilotConfig(angularSizeDeg);
      const expectedWidthU = angularSizeToHitboxWidthU(angularSizeDeg, PEEK_CLICK_TRANSFER_DISTANCE_U);
      expect(cfg.drill.targets.hitbox!.widthU).toBeCloseTo(expectedWidthU, 12);
      expect(cfg.drill.targets.hitbox!.heightU).toBeCloseTo(expectedWidthU, 12);
      expect(cfg.drill.targets.hitbox!.depthU).toBe(1);
      expect(cfg.angularSizeDeg).toBe(angularSizeDeg);
    }
  });

  it('gives every candidate a distinct id and a distinct pilot-only seed', () => {
    const configs = PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG.map((deg) => buildPeekClickTransferPilotConfig(deg));
    expect(new Set(configs.map((c) => c.id)).size).toBe(configs.length);
    expect(new Set(configs.map((c) => c.drill.sequence.seed)).size).toBe(configs.length);
    for (const cfg of configs) {
      expect(cfg.drill.sequence.seed).toBeGreaterThan(37002); // above the assessment seed roster
    }
  });

  it('declares the practice/scene/cue/timing/visibility contract (README §2.3 C, §2.4)', () => {
    const cfg = buildPeekClickTransferPilotConfig(2);
    const drill = loadDrill(cfg.drill);

    expect(cfg.sceneId).toBe('peek-ad-corridor-v1');
    expect(cfg.visibility).toEqual({ sampleCount: 9, onsetThreshold: 0.5 });
    expect(drill.mode).toBe('practice');
    expect(drill.cue).toEqual({ kind: 'single' });
    expect(drill.sequence.alternation).toBe('LR');
    expect(drill.sequence.spawnDelayMsRange).toEqual([500, 500]);
    expect(drill.targets.distance).toBe(PEEK_CLICK_TRANSFER_DISTANCE_U);
    expect(drill.timing).toEqual({ countdownMs: 3000, peekTimeoutMs: 3000, timeLimitMs: 120000 });
    expect(drill.endCondition).toEqual({ type: 'targetCount', value: 20 });
  });

  it('is rejected by strict clearance but accepted with the pilot occlusion options (FR-P45-4)', () => {
    const cfg = buildPeekClickTransferPilotConfig(2);
    const strict = validateClearance(peekAdCorridor, loadDrill(cfg.drill));
    const strictIds = new Set(strict.map((v) => v.propId));

    expect(strictIds.has('cover-wall-l'), formatClearanceViolations(strict)).toBe(true);
    expect(strictIds.has('cover-wall-r'), formatClearanceViolations(strict)).toBe(true);
    expect(() => loadDrill(cfg.drill, peekAdCorridor)).toThrow(/cover-wall/);
    expect(() => loadDrill(cfg.drill, peekAdCorridor, { clearance: cfg.clearanceOptions })).not.toThrow();
    expect(validateClearance(peekAdCorridor, loadDrill(cfg.drill), cfg.clearanceOptions)).toEqual([]);
  });

  it('registers the 2° candidate as the researcher-mode default (OQ-S9-5)', () => {
    expect(peekClickTransferPilotV1).toEqual(buildPeekClickTransferPilotConfig(2));
  });
});

describe('peek_click_transfer_pilot_v1 gameplay contract (2° cell, no fire)', () => {
  /** Advances a fresh DrillRunner/TargetManager pair purely via peekTimeoutMs (no fire), collecting
   * spawn sides and cue directions in order — proves the config's cue/alternation/timeout/backstop
   * wiring without needing a camera or hitscan fire path (FR-P45-1/9, OQ-S9-4). */
  function runTimeoutOnly(drill: DrillConfig): {
    sides: Array<'L' | 'R'>;
    cueDirections: Array<'A' | 'D'>;
    endedAtMs: number;
    phase: string;
  } {
    const state = createSharedState();
    const targetManager = createTargetManager(drill);
    const runner = createDrillRunner(state, targetManager);
    runner.start(drill);

    const sides: Array<'L' | 'R'> = [];
    const seenIds = new Set<string>();
    let nowMs = 0;
    let guard = 0;
    while (runner.phase !== 'ended' && guard < 30000) {
      nowMs += TICK_MS;
      runner.tick(state, nowMs);
      for (const t of state.targets) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          sides.push(t.side);
        }
      }
      guard++;
    }
    return {
      sides,
      cueDirections: state.cues.map((c) => c.direction),
      endedAtMs: nowMs,
      phase: runner.phase,
    };
  }

  it('spawns exactly 20 targets alternating L/R starting with L, one cue per spawn matching its side', () => {
    const { sides, cueDirections, phase } = runTimeoutOnly(buildPeekClickTransferPilotConfig(2).drill);

    expect(phase).toBe('ended');
    expect(sides).toHaveLength(20);
    expect(sides[0]).toBe('L');
    expect(sides.filter((s) => s === 'L')).toHaveLength(10);
    expect(sides.filter((s) => s === 'R')).toHaveLength(10);
    expect(cueDirections).toHaveLength(20);
    expect(cueDirections).toEqual(sides.map((side) => (side === 'L' ? 'A' : 'D')));
  });

  it('advances every presentation via the spawn-anchored peekTimeoutMs and ends well before the 120s backstop', () => {
    const { endedAtMs, phase } = runTimeoutOnly(buildPeekClickTransferPilotConfig(2).drill);

    expect(phase).toBe('ended');
    expect(endedAtMs).toBeLessThan(120000);
  });

  it('replays an identical spawn sequence across an independent restart with the same seed', () => {
    const drill = buildPeekClickTransferPilotConfig(2).drill;
    const first = runTimeoutOnly(drill);
    const second = runTimeoutOnly(drill);

    expect(second.sides).toEqual(first.sides);
    expect(second.cueDirections).toEqual(first.cueDirections);
    expect(second.endedAtMs).toBe(first.endedAtMs);
  });
});

describe('peek_click_transfer_pilot_v1 hitscan occlusion contract (2° cell)', () => {
  function aimAt(state: SharedState, from: THREE.Vector3, to: TargetState['pos']): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    state.aim.yaw = Math.atan2(-dx, -dz);
    state.aim.pitch = Math.asin(dy / len);
  }

  function makeStubTargetManager(): { tm: TargetManager; killed: string[] } {
    const killed: string[] = [];
    const tm: TargetManager = {
      tick() {},
      markKilled(s, id) {
        killed.push(id);
        const i = s.targets.findIndex((t) => t.id === id);
        if (i >= 0) s.targets.splice(i, 1);
      },
      reset() {},
    };
    return { tm, killed };
  }

  function fireFrom(state: SharedState, tm: TargetManager, camera: THREE.PerspectiveCamera, cameraPx: number, targetPos: TargetState['pos'], tickEndMs: number, hitscanOcclusion: HitscanOcclusionContext): void {
    camera.position.set(cameraPx, EYE_BASE.y, EYE_BASE.z);
    camera.updateMatrixWorld(true);
    aimAt(state, camera.position, targetPos);
    state.heldFire = true;
    state.weapon.nextFireT = 0;
    simStep(state, 1 / SIM_HZ, tickEndMs, tm, camera, undefined, undefined, undefined, undefined, undefined, undefined, undefined, hitscanOcclusion);
  }

  function pushTarget(state: SharedState, id: string, side: 'L' | 'R', drill: DrillConfig): TargetState {
    const hitbox = resolveTargetHitbox(drill);
    const target: TargetState = {
      id,
      side,
      pos: {
        x: side === 'R' ? TARGET_SIDE_OFFSET_U : -TARGET_SIDE_OFFSET_U,
        y: TARGET_CENTER_Y_U,
        z: -drill.targets.distance,
      },
      visible: true,
      alive: true,
      hitbox: { ...hitbox },
    };
    state.targets.push(target);
    return target;
  }

  it('blocks a shot fired from the corridor center (hidden by the cover pillar for both sides)', () => {
    const drill = buildPeekClickTransferPilotConfig(2).drill;
    const propBounds: readonly PropBound[] = peekAdCorridor.propBounds;
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const state = createSharedState();
    const { tm, killed } = makeStubTargetManager();
    const target = pushTarget(state, 't0', 'L', drill);

    fireFrom(state, tm, camera, 0, target.pos, TICK_MS, { propBounds });

    expect(killed).toEqual([]);
    expect(state.targets).toHaveLength(1);
    expect(state.targets[0].id).toBe('t0');
  });

  it('hits after peeking clear of the pillar, then advances (first miss retained, second shot kills)', () => {
    const drill = buildPeekClickTransferPilotConfig(2).drill;
    const propBounds: readonly PropBound[] = peekAdCorridor.propBounds;
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const state = createSharedState();
    const { tm, killed } = makeStubTargetManager();
    const target = pushTarget(state, 't0', 'L', drill);

    // First shot: still standing at the hidden center — blocked, target stays alive (FR-P45-5).
    fireFrom(state, tm, camera, 0, target.pos, TICK_MS, { propBounds });
    expect(killed).toEqual([]);
    expect(state.targets).toHaveLength(1);

    // Second shot: peeked out to the fully-exposed corridor edge — no longer occluded.
    fireFrom(state, tm, camera, -HALF_WIDTH_U, target.pos, 2 * TICK_MS, { propBounds });
    expect(killed).toEqual(['t0']);
    expect(state.targets).toHaveLength(0);
  });

  it('symmetrically hits the right-side target after peeking to the opposite corridor edge', () => {
    const drill = buildPeekClickTransferPilotConfig(2).drill;
    const propBounds: readonly PropBound[] = peekAdCorridor.propBounds;
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const state = createSharedState();
    const { tm, killed } = makeStubTargetManager();
    const target = pushTarget(state, 't0', 'R', drill);

    fireFrom(state, tm, camera, 0, target.pos, TICK_MS, { propBounds });
    expect(killed).toEqual([]);

    fireFrom(state, tm, camera, HALF_WIDTH_U, target.pos, 2 * TICK_MS, { propBounds });
    expect(killed).toEqual(['t0']);
  });
});
