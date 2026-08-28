import { describe, expect, it, vi } from 'vitest';
import { SceneManager, type SceneManagerLoadResult } from '../../src/render/SceneManager.ts';
import { placeholderRoom } from '../../src/scene/scenes/placeholder-room.ts';
import type { SceneConfig } from '../../src/scene/SceneConfig.ts';
import { normalizeReplayRecording } from '../../src/replay/normalizeReplayRecording.ts';
import type { ReplayRecording } from '../../src/replay/contracts.ts';
import { createReplayPresentationSession } from '../../src/render/replay/ReplayPresentationSession.ts';
import { makeMeta, makePayload, makeTick } from './fixtures.ts';

function fixtureRecording(): ReplayRecording {
  const payload = makePayload({
    meta: makeMeta({ drillId: 'hold_click_v1' }),
    ticks: [
      makeTick({ t: 0, px: 0, pz: 0, aim: { yaw: 0, pitch: 0 } }),
      makeTick({ t: 1000, px: 10, pz: 0, aim: { yaw: 1, pitch: 0 } }),
    ],
  });
  const result = normalizeReplayRecording(payload);
  if (!result.ok) throw new Error('fixture recording must normalize ok');
  return result.recording;
}

function instantLoader(fallback = false): (config: SceneConfig) => Promise<SceneManagerLoadResult> {
  return async (config: SceneConfig): Promise<SceneManagerLoadResult> => ({
    manager: new SceneManager(config),
    effectiveConfig: config,
    fallback,
  });
}

describe('createReplayPresentationSession', () => {
  it('starts "loading"; frame() is a no-op (renderer untouched) until the scene resolves', async () => {
    const renderer = { render: vi.fn() };
    const session = createReplayPresentationSession({
      recording: fixtureRecording(),
      sceneConfig: placeholderRoom,
      renderer,
      createSceneManagerWithStatus: instantLoader(),
    });

    expect(session.status).toBe('loading');
    session.frame(0);
    expect(renderer.render).not.toHaveBeenCalled();

    await Promise.resolve().then(() => Promise.resolve()); // flush the loader's microtask chain

    expect(session.status).toBe('ready');
    session.frame(0);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it('resize() before ready is buffered and applied once the scene mounts (README §2.7/§2.11)', async () => {
    const renderer = { render: vi.fn() };
    const session = createReplayPresentationSession({
      recording: fixtureRecording(),
      sceneConfig: placeholderRoom,
      renderer,
      createSceneManagerWithStatus: instantLoader(),
    });

    session.resize(1280, 720); // called before the scene exists — must not throw
    await Promise.resolve().then(() => Promise.resolve());

    session.frame(0);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    const [scene, camera] = renderer.render.mock.calls[0] as [unknown, { aspect: number }];
    expect(scene).toBeDefined();
    expect(camera.aspect).toBeCloseTo(1280 / 720, 10);
  });

  it('dispose() before the scene load resolves marks the session aborted; the late-arriving manager is disposed on arrival, never rendered (D-50-P5/§2.11 late-dispose)', async () => {
    let resolveLoad: (result: SceneManagerLoadResult) => void = () => {};
    const pending = new Promise<SceneManagerLoadResult>((resolve) => {
      resolveLoad = resolve;
    });
    const renderer = { render: vi.fn() };
    const session = createReplayPresentationSession({
      recording: fixtureRecording(),
      sceneConfig: placeholderRoom,
      renderer,
      createSceneManagerWithStatus: (() => pending) as any,
    });

    session.dispose();
    expect(session.status).toBe('aborted');

    const lateManager = new SceneManager(placeholderRoom);
    const disposeSpy = vi.spyOn(lateManager, 'dispose');
    resolveLoad({ manager: lateManager, effectiveConfig: placeholderRoom, fallback: false });
    await Promise.resolve().then(() => Promise.resolve());

    expect(disposeSpy).toHaveBeenCalledOnce();
    session.frame(0);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('dispose() after ready releases the adapter scene and the player, back to zero scene children', async () => {
    const renderer = { render: vi.fn() };
    const session = createReplayPresentationSession({
      recording: fixtureRecording(),
      sceneConfig: placeholderRoom,
      renderer,
      createSceneManagerWithStatus: instantLoader(),
    });
    await Promise.resolve().then(() => Promise.resolve());
    session.frame(0);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    const [scene] = renderer.render.mock.calls[0] as [{ children: unknown[] }];
    expect(scene.children.length).toBeGreaterThan(0);

    session.dispose();

    expect(scene.children.length).toBe(0);
    expect(() => session.player.play()).toThrow(/disposed/); // ReplayPlayer.dispose() throws on further use (D-50-P18)
  });

  it('a fallback scene load (README D-50-P11 style degrade) still frames/renders without crashing', async () => {
    const renderer = { render: vi.fn() };
    const session = createReplayPresentationSession({
      recording: fixtureRecording(),
      sceneConfig: placeholderRoom,
      renderer,
      createSceneManagerWithStatus: instantLoader(true),
    });
    await Promise.resolve().then(() => Promise.resolve());

    session.frame(500);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it('frame() samples the player and applies camera position matching the recorded tick data', async () => {
    const renderer = { render: vi.fn() };
    const session = createReplayPresentationSession({
      recording: fixtureRecording(),
      sceneConfig: placeholderRoom,
      renderer,
      createSceneManagerWithStatus: instantLoader(),
    });
    await Promise.resolve().then(() => Promise.resolve());

    session.player.seek(1000); // land exactly on the second recorded tick (px=10)
    session.frame(0);

    const [, camera] = renderer.render.mock.calls[0] as [unknown, { position: { x: number } }];
    expect(camera.position.x).not.toBe(0); // moved off the eye-base x by the recorded px offset
  });
});
