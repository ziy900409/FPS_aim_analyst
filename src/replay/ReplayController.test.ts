import { describe, expect, it, vi } from 'vitest';
import { HistoryClientError } from '../history/HistoryClient.ts';
import type { HistoryClient } from '../history/HistoryClient.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import type { ExportPayload } from '../data/export.ts';
import { makeMeta, makePayload, makeTick } from '../../tests/replay/fixtures.ts';
import { createReplayController, type ReplayControllerDeps, type ReplaySessionHandle } from './ReplayController.ts';

function fakeScene(sceneId: string, assetPackVersion: string): SceneConfig {
  return { sceneId, assetPackVersion } as unknown as SceneConfig;
}

const sceneA = fakeScene('peek-corridor', '1');
const sceneB = fakeScene('field-low', '1');
const fallbackScene = fakeScene('placeholder-room', '1');

function fullPayload(overrides: { runId?: string; sceneId?: string; assetPackVersion?: string } = {}): ExportPayload {
  return makePayload({
    meta: makeMeta({
      drillId: 'hold_click_v1',
      scene: { sceneId: overrides.sceneId ?? 'peek-corridor', assetPackVersion: overrides.assetPackVersion ?? '1', clutterTier: 'low', fallback: false },
    }),
    ticks: [makeTick({ t: 0, px: 0, pz: 0 }), makeTick({ t: 1000, px: 1, pz: 0 })],
  });
}

function makeFakeSession(): ReplaySessionHandle {
  const player = {
    state: { status: 'paused', timeMs: 0, rate: 1 },
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    setRate: vi.fn(),
    frame: vi.fn(),
    previousEvent: vi.fn(),
    nextEvent: vi.fn(),
    dispose: vi.fn(),
  } as unknown as ReplaySessionHandle['player'];
  return {
    player,
    frame: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
}

function makeDeps(overrides: Partial<ReplayControllerDeps> = {}): {
  readonly deps: ReplayControllerDeps;
  readonly presentation: { mode: 'live' | 'replay'; enterReplay: ReturnType<typeof vi.fn>; leaveReplay: ReturnType<typeof vi.fn> };
  readonly historyClient: Pick<HistoryClient, 'loadRun'>;
  readonly mountViewport: ReturnType<typeof vi.fn>;
  readonly unmountViewport: ReturnType<typeof vi.fn>;
  readonly createSession: ReturnType<typeof vi.fn>;
} {
  const presentation = {
    mode: 'live' as 'live' | 'replay',
    enterReplay: vi.fn(function (this: typeof presentation) {
      this.mode = 'replay';
    }),
    leaveReplay: vi.fn(function (this: typeof presentation) {
      this.mode = 'live';
    }),
  };
  const historyClient: Pick<HistoryClient, 'loadRun'> = { loadRun: vi.fn() };
  const mountViewport = vi.fn();
  const unmountViewport = vi.fn();
  const createSession = vi.fn(() => makeFakeSession());
  const deps: ReplayControllerDeps = {
    presentation,
    historyClient,
    availableScenes: [sceneA, sceneB],
    fallbackSceneConfig: fallbackScene,
    createSession,
    mountViewport,
    unmountViewport,
    ...overrides,
  };
  return { deps, presentation, historyClient, mountViewport, unmountViewport, createSession };
}

describe('createReplayController — current in-memory payload (OQ-50.2)', () => {
  it('goes straight from loading to ready without ever calling historyClient', async () => {
    const { deps, presentation, mountViewport, createSession } = makeDeps();
    const controller = createReplayController(deps);
    const states: string[] = [];
    controller.subscribe(() => states.push(controller.state.kind));

    controller.open({ kind: 'current', payload: fullPayload() }, '目前結果');
    await flush();

    expect(states).toEqual(['loading', 'ready']);
    expect(controller.state.kind).toBe('ready');
    expect(presentation.enterReplay).toHaveBeenCalledOnce();
    expect(mountViewport).toHaveBeenCalledOnce();
    expect(createSession).toHaveBeenCalledOnce();
    expect(controller.player).toBeDefined();
  });
});

describe('createReplayController — historical run (FR-50.13)', () => {
  it('loads via historyClient.loadRun and reaches ready', async () => {
    const payload = fullPayload({ runId: 'r-1' });
    const { deps, historyClient } = makeDeps();
    (historyClient.loadRun as ReturnType<typeof vi.fn>).mockResolvedValue(payload);
    const controller = createReplayController(deps);

    controller.open({ kind: 'historical', runId: 'r-1' }, 'r-1');
    await flush();

    expect(historyClient.loadRun).toHaveBeenCalledWith('r-1', expect.any(AbortSignal));
    expect(controller.state.kind).toBe('ready');
  });

  it('a load failure (API unavailable / run removed) produces an error state', async () => {
    const { deps, historyClient } = makeDeps();
    (historyClient.loadRun as ReturnType<typeof vi.fn>).mockRejectedValue(new HistoryClientError('RUN_NOT_FOUND', 'run not found', 404));
    const controller = createReplayController(deps);

    controller.open({ kind: 'historical', runId: 'r-gone' }, 'r-gone');
    await flush();

    expect(controller.state).toEqual({ kind: 'error', message: 'run not found' });
  });

  it('an unknown drillId (no registered profile) produces unsupported with reason codes', async () => {
    const payload = makePayload({
      meta: makeMeta({ drillId: 'not-a-registered-drill' }),
      ticks: [makeTick({ t: 0 })],
    });
    const { deps, historyClient } = makeDeps();
    (historyClient.loadRun as ReturnType<typeof vi.fn>).mockResolvedValue(payload);
    const controller = createReplayController(deps);

    controller.open({ kind: 'historical', runId: 'r-1' }, 'r-1');
    await flush();

    expect(controller.state.kind).toBe('unsupported');
    if (controller.state.kind === 'unsupported') {
      expect(controller.state.reasonCodes).toContain('UNKNOWN_EXACT_DRILL');
    }
  });

  it('close() aborts an in-flight loadRun and a late resolution never reaches ready', async () => {
    let resolvePayload: (payload: ExportPayload) => void = () => {};
    const pending = new Promise<ExportPayload>((resolve) => {
      resolvePayload = resolve;
    });
    const { deps, historyClient } = makeDeps();
    (historyClient.loadRun as ReturnType<typeof vi.fn>).mockReturnValue(pending);
    const controller = createReplayController(deps);

    controller.open({ kind: 'historical', runId: 'r-1' }, 'r-1');
    await Promise.resolve();
    expect(controller.state.kind).toBe('loading');

    controller.close();
    expect(controller.state.kind).toBe('idle');

    resolvePayload(fullPayload());
    await flush();

    expect(controller.state.kind).toBe('idle'); // stale resolution dropped, not rendered
  });

  it('a rapid A→B switch disposes the first session before the second one is entered', async () => {
    const { deps, presentation, historyClient, unmountViewport } = makeDeps();
    (historyClient.loadRun as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(fullPayload({ runId: 'r-a' }))
      .mockResolvedValueOnce(fullPayload({ runId: 'r-b' }));
    const controller = createReplayController(deps);

    controller.open({ kind: 'historical', runId: 'r-a' }, 'r-a');
    await flush();
    expect(controller.state.kind).toBe('ready');
    expect(presentation.enterReplay).toHaveBeenCalledTimes(1);

    controller.open({ kind: 'historical', runId: 'r-b' }, 'r-b');
    await flush();

    expect(presentation.leaveReplay).toHaveBeenCalledTimes(1); // the stale r-a session was torn down
    expect(unmountViewport).toHaveBeenCalledTimes(1);
    expect(presentation.enterReplay).toHaveBeenCalledTimes(2);
    expect(controller.state.kind).toBe('ready');
  });
});

describe('createReplayController — scene resolution fallback (OQ-50.4)', () => {
  it('downgrades a would-be full status to partial and adds a reason code when the recorded sceneId is not installed', async () => {
    const { deps, createSession } = makeDeps({ availableScenes: [sceneB] }); // sceneA ('peek-corridor') not installed
    const controller = createReplayController(deps);

    controller.open({ kind: 'current', payload: fullPayload({ sceneId: 'peek-corridor' }) }, '目前結果');
    await flush();

    expect(controller.state.kind).toBe('ready');
    if (controller.state.kind === 'ready') {
      expect(controller.state.support.status).toBe('partial');
      expect(controller.state.support.reasonCodes).toContain('SCENE_LOAD_FAILED');
      expect(controller.state.support.missing).toContain('scene');
    }
    expect(createSession).toHaveBeenCalledWith(expect.anything(), fallbackScene);
  });

  it('downgrades to partial and flags a version mismatch without blocking playback', async () => {
    const { deps, createSession } = makeDeps({ availableScenes: [fakeScene('peek-corridor', '2')] });
    const controller = createReplayController(deps);

    controller.open({ kind: 'current', payload: fullPayload({ sceneId: 'peek-corridor', assetPackVersion: '1' }) }, '目前結果');
    await flush();

    expect(controller.state.kind).toBe('ready');
    if (controller.state.kind === 'ready') {
      expect(controller.state.support.status).toBe('partial');
      expect(controller.state.support.reasonCodes).toContain('SCENE_ASSET_VERSION_MISMATCH');
    }
    expect(createSession).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ assetPackVersion: '2' }));
  });
});

describe('createReplayController — retry', () => {
  it('re-issues the exact same request that last failed', async () => {
    const { deps, historyClient } = makeDeps();
    (historyClient.loadRun as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new HistoryClientError('NETWORK_ERROR', 'offline'))
      .mockResolvedValueOnce(fullPayload({ runId: 'r-1' }));
    const controller = createReplayController(deps);

    controller.open({ kind: 'historical', runId: 'r-1' }, 'r-1');
    await flush();
    expect(controller.state.kind).toBe('error');

    controller.retry();
    await flush();

    expect(controller.state.kind).toBe('ready');
    expect(historyClient.loadRun).toHaveBeenCalledTimes(2);
    expect(historyClient.loadRun).toHaveBeenNthCalledWith(2, 'r-1', expect.any(AbortSignal));
  });
});

describe('createReplayController — close (Back)', () => {
  it('leaves an active replay session, unmounts the viewport, and returns to idle', async () => {
    const { deps, presentation, unmountViewport } = makeDeps();
    const controller = createReplayController(deps);
    controller.open({ kind: 'current', payload: fullPayload() }, '目前結果');
    await flush();
    expect(controller.state.kind).toBe('ready');

    controller.close();

    expect(presentation.leaveReplay).toHaveBeenCalledOnce();
    expect(unmountViewport).toHaveBeenCalledOnce();
    expect(controller.state.kind).toBe('idle');
    expect(controller.player).toBeUndefined();
  });

  it('is a harmless no-op when nothing is open', () => {
    const { deps, presentation, unmountViewport } = makeDeps();
    const controller = createReplayController(deps);

    controller.close();

    expect(presentation.leaveReplay).not.toHaveBeenCalled();
    expect(unmountViewport).not.toHaveBeenCalled();
    expect(controller.state.kind).toBe('idle');
  });
});

function flush(): Promise<void> {
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => Promise.resolve());
}
