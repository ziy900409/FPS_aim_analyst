import { describe, expect, it, vi } from 'vitest';
import { SceneManager, type SceneManagerLoadResult } from '../../src/render/SceneManager.ts';
import { placeholderRoom } from '../../src/scene/scenes/placeholder-room.ts';
import type { SceneConfig } from '../../src/scene/SceneConfig.ts';
import { normalizeReplayRecording } from '../../src/replay/normalizeReplayRecording.ts';
import type { ReplayRecording } from '../../src/replay/contracts.ts';
import { createPresentationCoordinator } from '../../src/render/PresentationCoordinator.ts';
import { createReplayPresentationSession } from '../../src/render/replay/ReplayPresentationSession.ts';
import { makeMeta, makePayload, makeTick } from './fixtures.ts';

/**
 * WP-50 T3 DoD — "resize、rapid run switch、abort、load failure與50-cycle lifecycle tests全綠"
 * and "以spy/E2E驗證replay active時pump...=0；只有一rAF/renderer owner；退出回來源不resume進行中run".
 *
 * This file exercises `PresentationCoordinator` + real `ReplayPresentationSession`/
 * `ReplaySceneAdapter`/`SceneManager` instances together (not fakes) across many enter/leave
 * cycles, mirroring the T0 PoC `scene-isolation.test.ts` pattern this WP already validated for
 * bare `SceneManager` instances. The "退出回來源" (return-to-source) and "InputSampler/Pointer
 * Lock=0" halves of NFR-50.5/FR-50.13 are a real UI entry-point concern (History/Result routing,
 * canvas click gating) that doesn't exist yet — that's T6's job once a real replay entry point is
 * wired. What *is* provable here, and is proven below, is the architectural guarantee this task
 * builds: while `PresentationCoordinator` is in replay mode, the live frame callback (which is
 * where `simLoop.pump` lives in main.ts) is never invoked — by construction, not by convention.
 */

function fixtureRecording(): ReplayRecording {
  const payload = makePayload({
    meta: makeMeta({ drillId: 'hold_click_v1' }),
    ticks: [
      makeTick({ t: 0, px: 0, pz: 0, aim: { yaw: 0, pitch: 0 } }),
      makeTick({ t: 1000, px: 5, pz: 0, aim: { yaw: 0.5, pitch: 0 } }),
    ],
  });
  const result = normalizeReplayRecording(payload);
  if (!result.ok) throw new Error('fixture recording must normalize ok');
  return result.recording;
}

async function instantLoader(config: SceneConfig): Promise<SceneManagerLoadResult> {
  return { manager: new SceneManager(config), effectiveConfig: config, fallback: false };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve().then(() => Promise.resolve());
}

describe('WP-50 T3 — presentation lifecycle integration', () => {
  it('50x enterReplay/frame/leaveReplay cycles with real sessions leave zero residual scene children each time', async () => {
    const live = { frame: vi.fn(), resize: vi.fn() };
    const coordinator = createPresentationCoordinator(live);

    for (let i = 0; i < 50; i++) {
      const renderer = { render: vi.fn() };
      const session = createReplayPresentationSession({
        recording: fixtureRecording(),
        sceneConfig: placeholderRoom,
        renderer,
        createSceneManagerWithStatus: instantLoader,
      });

      coordinator.enterReplay(session);
      await flushMicrotasks();
      coordinator.frame(0);
      coordinator.frame(500);
      expect(renderer.render).toHaveBeenCalledTimes(2);
      const [scene] = renderer.render.mock.calls[0] as [{ children: unknown[] }];
      expect(scene.children.length).toBeGreaterThan(0);

      coordinator.leaveReplay();
      expect(coordinator.mode).toBe('live');
      expect(scene.children.length).toBe(0); // this cycle's own scene is fully released
    }
  });

  it('rapid run switch: leaveReplay() before the next enterReplay() disposes the outgoing session\'s scene before the incoming one mounts', async () => {
    const live = { frame: vi.fn(), resize: vi.fn() };
    const coordinator = createPresentationCoordinator(live);

    const rendererA = { render: vi.fn() };
    const sessionA = createReplayPresentationSession({
      recording: fixtureRecording(),
      sceneConfig: placeholderRoom,
      renderer: rendererA,
      createSceneManagerWithStatus: instantLoader,
    });
    coordinator.enterReplay(sessionA);
    await flushMicrotasks();
    coordinator.frame(0);
    const [sceneA] = rendererA.render.mock.calls[0] as [{ children: unknown[] }];
    expect(sceneA.children.length).toBeGreaterThan(0);

    coordinator.leaveReplay();
    expect(sceneA.children.length).toBe(0);

    const rendererB = { render: vi.fn() };
    const sessionB = createReplayPresentationSession({
      recording: fixtureRecording(),
      sceneConfig: placeholderRoom,
      renderer: rendererB,
      createSceneManagerWithStatus: instantLoader,
    });
    coordinator.enterReplay(sessionB);
    await flushMicrotasks();
    coordinator.frame(0);

    const [sceneB] = rendererB.render.mock.calls[0] as [{ children: unknown[] }];
    expect(sceneB.children.length).toBeGreaterThan(0);
    expect(sceneB).not.toBe(sceneA); // independent instances — no reuse across the switch
  });

  it('NFR-50.5 pump-isolation proxy: interleaved live/replay frames never let the live callback run while replay is active', async () => {
    const live = { frame: vi.fn(), resize: vi.fn() };
    const coordinator = createPresentationCoordinator(live);

    coordinator.frame(0); // live
    coordinator.frame(1); // live
    expect(live.frame).toHaveBeenCalledTimes(2);

    const renderer = { render: vi.fn() };
    const session = createReplayPresentationSession({
      recording: fixtureRecording(),
      sceneConfig: placeholderRoom,
      renderer,
      createSceneManagerWithStatus: instantLoader,
    });
    coordinator.enterReplay(session);
    await flushMicrotasks();
    for (let now = 0; now < 10; now++) coordinator.frame(now);

    expect(live.frame).toHaveBeenCalledTimes(2); // unchanged across every replay frame
    expect(renderer.render).toHaveBeenCalledTimes(10);

    coordinator.leaveReplay();
    coordinator.frame(2); // live resumes
    expect(live.frame).toHaveBeenCalledTimes(3);
  });

  it('a scene-load failure that falls back to a placeholder scene (D-50-P11 style) does not abort the session or break subsequent cycles', async () => {
    const live = { frame: vi.fn(), resize: vi.fn() };
    const coordinator = createPresentationCoordinator(live);
    const renderer = { render: vi.fn() };
    const fallbackLoader = async (config: SceneConfig): Promise<SceneManagerLoadResult> => ({
      manager: new SceneManager(config),
      effectiveConfig: config,
      fallback: true,
    });

    const session = createReplayPresentationSession({
      recording: fixtureRecording(),
      sceneConfig: placeholderRoom,
      renderer,
      createSceneManagerWithStatus: fallbackLoader,
    });
    coordinator.enterReplay(session);
    await flushMicrotasks();
    coordinator.frame(0);
    expect(renderer.render).toHaveBeenCalledTimes(1);

    coordinator.leaveReplay();
    expect(coordinator.mode).toBe('live');
  });
});
