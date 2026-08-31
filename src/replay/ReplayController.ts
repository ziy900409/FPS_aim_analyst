/**
 * ReplayController — WP-50 / T6（README §2.11/FR-50.13/50.14/50.15）
 *
 * Owns the async load/generation lifecycle that turns a `ReplaySource` (the currently in-memory
 * `ExportPayload`, or a historical `runId`) into a presentation-coordinated replay session, and
 * exposes the outcome as a small state machine a UI layer subscribes to (same shape as
 * `HistoryLibraryController` — state + `subscribe()`, no DOM/Three import here). This module never
 * touches `ReplayScreen`/DOM/Three directly: scene/session construction and canvas ownership are
 * injected callbacks (`createSession`/`mountViewport`/`unmountViewport`) supplied by the composition
 * root (`main.ts`), which is the only place that legitimately knows about the shared renderer/canvas.
 *
 * Every `open()` call starts a new "generation": a stale historical `loadRun` response (superseded
 * by a rapid run switch, or arriving after `close()`) is dropped rather than rendered (README
 * "load/scene generation切換...不得掛入active scene"). `close()`/each new `open()` also disposes any
 * previously-entered replay session via the injected `presentation.leaveReplay()` before doing
 * anything else, so a rapid A→B switch never leaves two sessions alive at once.
 */

import type { ExportPayload } from '../data/export.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import type { PresentationCoordinator, ReplayPresentationSession } from '../render/PresentationCoordinator.ts';
import { resolveReplaySceneConfig, type ReplaySceneResolution } from '../render/replay/replaySceneResolution.ts';
import { HistoryClientError, type HistoryClient } from '../history/HistoryClient.ts';
import { normalizeReplayRecording } from './normalizeReplayRecording.ts';
import type { ReplayCapability, ReplayPlayer, ReplayRecording, ReplaySupport } from './contracts.ts';

export type ReplaySource =
  | { readonly kind: 'current'; readonly payload: ExportPayload }
  | { readonly kind: 'historical'; readonly runId: string };

export type ReplayControllerState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'unsupported'; readonly sourceLabel: string; readonly reasonCodes: readonly string[] }
  | {
      readonly kind: 'ready';
      readonly sourceLabel: string;
      readonly support: ReplaySupport;
      readonly recording: ReplayRecording;
    };

export interface ReplaySessionHandle extends ReplayPresentationSession {
  readonly player: ReplayPlayer;
}

export interface ReplayControllerDeps {
  readonly presentation: Pick<PresentationCoordinator, 'mode' | 'enterReplay' | 'leaveReplay'>;
  readonly historyClient: Pick<HistoryClient, 'loadRun'>;
  /** Currently-installed scene configs (README §2.4/D-50-P11) — used to resolve the recorded
   * `sceneId` and detect an `assetPackVersion` mismatch. */
  readonly availableScenes: readonly SceneConfig[];
  /** Used when the recorded `sceneId` isn't installed at all (OQ-50.4 "沒有可信 scene 只有 camera 才
   * unsupported" — `scene` is never in any profile's `minimumPlayable`, so this never blocks replay,
   * it only degrades `full` to `partial` with a reason code). */
  readonly fallbackSceneConfig: SceneConfig;
  readonly createSession: (recording: ReplayRecording, sceneConfig: SceneConfig) => ReplaySessionHandle;
  /** Reparents the shared canvas into the replay viewport and sizes it — called once, right before
   * entering the 'ready' state. */
  readonly mountViewport: () => void;
  /** Restores the shared canvas to its live position/sizing — called whenever an active session is
   * torn down (a new `open()`, or `close()`). Only actually invoked when a session was mounted. */
  readonly unmountViewport: () => void;
}

export interface ReplayController {
  readonly state: ReplayControllerState;
  /** Defined only while `state.kind === 'ready'` — the same `ReplayPlayer` instance backing the
   * active session, structurally compatible with `ReplayTransportControls` (T5). */
  readonly player: ReplayPlayer | undefined;
  subscribe(listener: () => void): () => void;
  open(source: ReplaySource, sourceLabel: string): void;
  /** Re-runs the most recent `open()` call — wired to the Replay screen's error-panel Retry button. */
  retry(): void;
  /** Tears down any active session/viewport mount and returns to 'idle' — wired to Back/cancel-load. */
  close(): void;
}

export function createReplayController(deps: ReplayControllerDeps): ReplayController {
  let state: ReplayControllerState = { kind: 'idle' };
  let session: ReplaySessionHandle | undefined;
  let generation = 0;
  let pendingLoad: AbortController | undefined;
  let lastRequest: { readonly source: ReplaySource; readonly sourceLabel: string } | undefined;
  const listeners = new Set<() => void>();

  function setState(next: ReplayControllerState): void {
    state = next;
    for (const listener of listeners) listener();
  }

  function resetForNewRequest(): void {
    generation += 1;
    pendingLoad?.abort();
    pendingLoad = undefined;
    if (deps.presentation.mode === 'replay') deps.presentation.leaveReplay(); // disposes `session`
    if (session !== undefined) deps.unmountViewport();
    session = undefined;
  }

  async function run(source: ReplaySource, sourceLabel: string): Promise<void> {
    resetForNewRequest();
    const myGeneration = generation;
    lastRequest = { source, sourceLabel };
    setState({ kind: 'loading' });

    let payload: ExportPayload;
    if (source.kind === 'current') {
      payload = source.payload;
    } else {
      const abortController = new AbortController();
      pendingLoad = abortController;
      try {
        payload = await deps.historyClient.loadRun(source.runId, abortController.signal);
      } catch (error) {
        if (myGeneration !== generation) return; // superseded by close()/a newer open()
        setState({ kind: 'error', message: describeError(error) });
        return;
      }
    }
    if (myGeneration !== generation) return; // superseded while awaiting

    const result = normalizeReplayRecording(payload, source.kind === 'historical' ? { runId: source.runId } : {});
    if (!result.ok) {
      setState({ kind: 'unsupported', sourceLabel, reasonCodes: result.reasonCodes });
      return;
    }
    const recording = result.recording;

    const resolution = resolveReplaySceneConfig(recording.scene, deps.availableScenes);
    const { sceneConfig, support } = resolveSessionScene(recording, resolution, deps.fallbackSceneConfig);

    session = deps.createSession(recording, sceneConfig);
    deps.presentation.enterReplay(session);
    // `setState` runs subscribers synchronously — by the time it returns, `ReplayScreen.render()`
    // has already switched the DOM into its 'ready' layout (the viewport host goes from `display:
    // none` to a real box). Only *then* call `mountViewport()`, so its `getBoundingClientRect()`
    // measures the actual box instead of a still-hidden ancestor's zero size.
    setState({ kind: 'ready', sourceLabel, support, recording });
    deps.mountViewport();
  }

  return {
    get state(): ReplayControllerState {
      return state;
    },
    get player(): ReplayPlayer | undefined {
      return session?.player;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open(source: ReplaySource, sourceLabel: string): void {
      void run(source, sourceLabel);
    },
    retry(): void {
      if (lastRequest === undefined) return;
      void run(lastRequest.source, lastRequest.sourceLabel);
    },
    close(): void {
      resetForNewRequest();
      setState({ kind: 'idle' });
    },
  };
}

function describeError(error: unknown): string {
  if (error instanceof HistoryClientError) return error.message;
  return error instanceof Error ? error.message : '讀取失敗，請重試。';
}

function resolveSessionScene(
  recording: ReplayRecording,
  resolution: ReplaySceneResolution | undefined,
  fallbackSceneConfig: SceneConfig,
): { readonly sceneConfig: SceneConfig; readonly support: ReplaySupport } {
  if (resolution === undefined) {
    return { sceneConfig: fallbackSceneConfig, support: downgradeForScene(recording.support, 'SCENE_LOAD_FAILED') };
  }
  if (resolution.versionMismatch) {
    return { sceneConfig: resolution.config, support: downgradeForScene(recording.support, 'SCENE_ASSET_VERSION_MISMATCH') };
  }
  return { sceneConfig: resolution.config, support: recording.support };
}

/** Never forces `unsupported` — `scene` is never in a profile's `minimumPlayable` (D-50-P11), so a
 * scene resolution problem only ever caps `full` down to `partial` and records why. */
function downgradeForScene(support: ReplaySupport, reasonCode: string): ReplaySupport {
  const missing: readonly ReplayCapability[] = support.missing.includes('scene') ? support.missing : [...support.missing, 'scene'];
  const available = support.available.filter((capability) => capability !== 'scene');
  const reasonCodes = support.reasonCodes.includes(reasonCode) ? support.reasonCodes : [...support.reasonCodes, reasonCode];
  return {
    ...support,
    status: support.status === 'full' ? 'partial' : support.status,
    available,
    missing,
    reasonCodes,
  };
}
