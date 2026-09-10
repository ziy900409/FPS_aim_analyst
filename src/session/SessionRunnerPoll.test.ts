import { describe, expect, it, vi } from 'vitest';
import { buildFrozenSessionPlan, createSessionRunner } from './SessionRunner.ts';
import { compileSessionProgram } from './sessionProgram.ts';
import type { WeaponId } from '../weapon/weapons.ts';

async function settleTransitions(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function twoFamilyPlan(restSeconds = 60): ReturnType<typeof buildFrozenSessionPlan>['plan'] {
  return buildFrozenSessionPlan({
    participantId: 'P001',
    sessionIndex: 0,
    families: ['hold-click', 'hold-track'],
    restSeconds,
    includeWarmup: false,
  }).plan;
}

describe('SessionRunner.poll', () => {
  it('is a no-op outside rest and automatically starts the next family when rest expires', async () => {
    const loadDrillById = vi.fn<(drillId: string, weaponId?: WeaponId) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    await runner.start(twoFamilyPlan());

    runner.poll(1_000);
    expect(runner.phase).toMatchObject({ kind: 'run', cursor: 0, step: { drillId: 'hold_click_v1' } });

    await runner.advance();
    expect(runner.phase).toMatchObject({ kind: 'rest', cursor: 1, remainingMs: 60_000 });
    runner.poll(2_000);
    expect(runner.phase).toMatchObject({ kind: 'rest', cursor: 1, remainingMs: 60_000 });
    runner.poll(62_000);
    await settleTransitions();

    expect(runner.phase).toMatchObject({ kind: 'run', cursor: 2, step: { drillId: 'hold_track_v1' } });
    expect(loadDrillById).toHaveBeenLastCalledWith('hold_track_v1', undefined);
  });

  it('carries the step weapon through the unattended auto-advance too (WP-62 T3)', async () => {
    // The poll()-driven advance is the path no operator touches, so it is the one that would
    // silently drop the planned weapon: the researcher would see the right drill with the wrong gun.
    const loadDrillById = vi.fn<(drillId: string, weaponId?: WeaponId) => Promise<void>>(async () => {});
    const runner = createSessionRunner({ loadDrillById });
    await runner.start({
      participantId: 'P001',
      sessionIndex: 0,
      mode: 'custom',
      items: [],
      program: compileSessionProgram({
        items: [
          { drillId: 'hold_click_v1', reps: 1, weaponId: 'm4a1s' },
          { drillId: 'hold_track_v1', reps: 1, weaponId: 'usp_s_laser' },
        ],
        drillRestSeconds: 30,
        familyRestSeconds: 60,
      }),
    });

    expect(loadDrillById).toHaveBeenLastCalledWith('hold_click_v1', 'm4a1s');
    await runner.advance();
    expect(runner.phase.kind).toBe('rest');
    runner.poll(0);
    runner.poll(61_000); // hold-click -> hold-track is a *family* seam, so it takes familyRestSeconds
    await settleTransitions();

    expect(runner.phase).toMatchObject({ kind: 'run', step: { drillId: 'hold_track_v1' } });
    expect(loadDrillById).toHaveBeenLastCalledWith('hold_track_v1', 'usp_s_laser');
  });

  it('recovers from a failed auto-advance instead of leaving the rest phase (and its overlay) stuck forever', async () => {
    const loadDrillById = vi
      .fn<(drillId: string) => Promise<void>>()
      .mockImplementationOnce(async () => {})
      .mockImplementationOnce(async () => {
        throw new Error('scene load failed');
      });
    const onStatus = vi.fn();
    const onPhaseChange = vi.fn();
    const runner = createSessionRunner({ loadDrillById, onStatus, onPhaseChange });
    await runner.start(twoFamilyPlan());

    await runner.advance();
    expect(runner.phase).toMatchObject({ kind: 'rest', cursor: 1, remainingMs: 60_000 });
    onPhaseChange.mockClear();

    runner.poll(2_000);
    runner.poll(62_000);
    await settleTransitions();

    // The failed loadDrillById must not leave the state machine (and therefore the rest
    // overlay driven by onPhaseChange) stuck at 'rest' forever.
    expect(runner.phase.kind).not.toBe('rest');
    expect(onPhaseChange).toHaveBeenCalledWith(expect.objectContaining({ kind: runner.phase.kind }));
    expect(onStatus).toHaveBeenCalledWith(expect.stringContaining('scene load failed'));
  });

  it('counts down against the render clock it is handed, never a wall clock', async () => {
    const runner = createSessionRunner({ loadDrillById: async () => {} });
    await runner.start(twoFamilyPlan(30));

    await runner.advance();
    // The first poll of a rest establishes the origin, so the countdown never depends on when the
    // render loop happened to next run after the transition.
    runner.poll(500_000);
    expect(runner.phase).toMatchObject({ remainingMs: 30_000 });
    runner.poll(510_000);
    expect(runner.phase).toMatchObject({ remainingMs: 20_000 });
    runner.poll(529_999);
    expect(runner.phase).toMatchObject({ remainingMs: 1 });
  });

  it('allocates nothing per frame: the rest phase is one object written in place (NFR-58.3)', async () => {
    const seen: unknown[] = [];
    const runner = createSessionRunner({
      loadDrillById: async () => {},
      onPhaseChange: (phase) => {
        if (phase.kind === 'rest') seen.push(phase);
      },
    });
    await runner.start(twoFamilyPlan(60));
    await runner.advance();

    const first = runner.phase;
    for (let frame = 1; frame <= 3_000; frame += 1) runner.poll(frame * 16);

    // Identity, not just equality: a fresh object per frame would be a per-frame allocation on the
    // render hot path, which is what the fixed-layout discipline forbids.
    expect(runner.phase).toBe(first);
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).toBe(first);
    expect(runner.phase).toMatchObject({ kind: 'rest', remainingMs: 60_000 - 2_999 * 16 });
  });

  it('stops polling once disposed, leaving no phase behind', async () => {
    const onPhaseChange = vi.fn();
    const runner = createSessionRunner({ loadDrillById: async () => {}, onPhaseChange });
    await runner.start(twoFamilyPlan(60));
    await runner.advance();
    expect(runner.phase.kind).toBe('rest');

    runner.dispose();
    expect(runner.phase).toEqual({ kind: 'idle' });
    onPhaseChange.mockClear();
    runner.poll(1_000_000);
    expect(runner.phase).toEqual({ kind: 'idle' });
    expect(onPhaseChange).not.toHaveBeenCalled();
  });
});
