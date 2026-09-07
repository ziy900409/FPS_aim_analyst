import { describe, expect, it, vi } from 'vitest';
import { microFlickRoom } from '../scene/scenes/micro-flick-room.ts';
import { placeholderRoom } from '../scene/scenes/placeholder-room.ts';
import { SceneManager, type SceneManagerLoadResult } from './SceneManager.ts';
import { createSceneLoadCoordinator } from './SceneLoadCoordinator.ts';

interface DeferredLoad {
  readonly promise: Promise<SceneManagerLoadResult>;
  resolve(result: SceneManagerLoadResult): void;
}

function deferredLoad(): DeferredLoad {
  let resolve = (_result: SceneManagerLoadResult): void => {};
  const promise = new Promise<SceneManagerLoadResult>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function result(scene = microFlickRoom): SceneManagerLoadResult {
  return { manager: new SceneManager(scene), effectiveConfig: scene, fallback: false };
}

describe('SceneLoadCoordinator — live scene generation ownership', () => {
  it('returns the newest completed manager to the caller for installation', async () => {
    const coordinator = createSceneLoadCoordinator(async () => result());
    const request = coordinator.begin();

    const loaded = await request.load(microFlickRoom);

    expect(loaded?.effectiveConfig).toBe(microFlickRoom);
    expect(request.isCurrent()).toBe(true);
    loaded?.manager.dispose();
  });

  it('rapid A→B switch keeps B current and disposes A when A arrives late', async () => {
    const a = deferredLoad();
    const b = deferredLoad();
    const createManager = vi.fn((config) => (config.sceneId === 'micro-flick-room' ? a.promise : b.promise));
    const coordinator = createSceneLoadCoordinator(createManager);
    const requestA = coordinator.begin();
    const pendingA = requestA.load(microFlickRoom);
    const requestB = coordinator.begin();
    const pendingB = requestB.load(placeholderRoom);

    const resultB = result(placeholderRoom);
    b.resolve(resultB);
    await expect(pendingB).resolves.toBe(resultB);

    const resultA = result();
    const disposeA = vi.spyOn(resultA.manager, 'dispose');
    a.resolve(resultA);
    await expect(pendingA).resolves.toBeNull();
    expect(disposeA).toHaveBeenCalledOnce();
    expect(requestA.isCurrent()).toBe(false);
    expect(requestB.isCurrent()).toBe(true);
    resultB.manager.dispose();
  });

  it('a no-load generation still cancels an older pending scene request', async () => {
    const pending = deferredLoad();
    const coordinator = createSceneLoadCoordinator(async () => pending.promise);
    const oldRequest = coordinator.begin();
    const oldLoad = oldRequest.load(microFlickRoom);
    const noLoadRequest = coordinator.begin();

    const late = result();
    const disposeLate = vi.spyOn(late.manager, 'dispose');
    pending.resolve(late);

    await expect(oldLoad).resolves.toBeNull();
    expect(disposeLate).toHaveBeenCalledOnce();
    expect(noLoadRequest.isCurrent()).toBe(true);
  });

  it('dispose prevents a late manager from mounting and is idempotent', async () => {
    const pending = deferredLoad();
    const coordinator = createSceneLoadCoordinator(async () => pending.promise);
    const request = coordinator.begin();
    const load = request.load(microFlickRoom);
    coordinator.dispose();
    coordinator.dispose();

    const late = result();
    const disposeLate = vi.spyOn(late.manager, 'dispose');
    pending.resolve(late);

    await expect(load).resolves.toBeNull();
    expect(disposeLate).toHaveBeenCalledOnce();
    expect(request.isCurrent()).toBe(false);
    expect(() => coordinator.begin()).toThrow(/dispose/);
  });

  it('rejects accidental reuse of one request for two asset loads', async () => {
    const coordinator = createSceneLoadCoordinator(async () => result());
    const request = coordinator.begin();
    const loaded = await request.load(microFlickRoom);

    await expect(request.load(microFlickRoom)).rejects.toThrow(/只能呼叫一次/);
    loaded?.manager.dispose();
  });
});
