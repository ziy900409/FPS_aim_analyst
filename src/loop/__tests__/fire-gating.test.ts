import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../../data/DataRecorder.ts';
import type { Clock } from '../clock.ts';
import { SIM_HZ } from '../constants.ts';
import { createSimLoop } from '../SimLoop.ts';
import { createSharedState } from '../../state/SharedState.ts';
import { pushEvent } from '../../state/inputRingTestUtil.ts';
import { ak47 } from '../../weapon/weapons.ts';

describe('scheduleFire — hold-track fire gate (WP-35 / T1)', () => {
  it('鎖定時不消費 held fire、ammo 或 nextFireT；解鎖後沿用既有 cadence 消費首發', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ simHz: SIM_HZ });
    const clock: Clock = { now: () => 0 };
    const sim = createSimLoop(state, clock, SIM_HZ, undefined, undefined, undefined, recorder, ak47);
    state.targets.push({
      id: 'locked',
      side: 'R',
      pos: { x: 0, y: 1.5, z: -4 },
      visible: true,
      alive: true,
      hitbox: { width: 1, height: 2, depth: 1, shape: 'box' },
      fireLocked: true,
    });
    pushEvent(state, { type: 'fire', down: true, t: 5 });

    sim.pump(1000 / SIM_HZ);
    expect(state.heldFire).toBe(true);
    expect(state.weapon.ammo).toBe(ak47.magSize);
    expect(state.weapon.nextFireT).toBe(5);
    expect(recorder.snapshot().events.filter((event) => event.type === 'fire')).toHaveLength(0);

    state.targets[0].fireLocked = false;
    sim.pump((1000 / SIM_HZ) * 2);
    expect(state.weapon.ammo).toBe(ak47.magSize - 1);
    expect(state.weapon.nextFireT).toBe(105);
    expect(recorder.snapshot().events.filter((event) => event.type === 'fire')).toHaveLength(1);
  });
});
