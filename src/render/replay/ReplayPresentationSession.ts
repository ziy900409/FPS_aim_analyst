import * as THREE from 'three/webgpu';
import { createSceneManagerWithStatus } from '../SceneManager.ts';
import { DEFAULT_PROCEDURAL_ROOM } from '../../scene/eyePose.ts';
import type { SceneAssetLoader } from '../sceneLoader.ts';
import type { SceneConfig } from '../../scene/SceneConfig.ts';
import { createReplayPlayer } from '../../replay/ReplayPlayer.ts';
import type { ReplayPlayer, ReplayRecording } from '../../replay/contracts.ts';
import { buildReplayPunchTimeline, resolveReplayCameraVisualState } from '../../replay/replayRecoil.ts';
import { getWeapon } from '../../weapon/weapons.ts';
import type { WeaponConfig } from '../../weapon/WeaponConfig.ts';
import type { ReplayPresentationSession } from '../PresentationCoordinator.ts';
import { ReplaySceneAdapter } from './ReplaySceneAdapter.ts';
import { ReplayTargetView } from './ReplayTargetView.ts';
import { ReplayEffectView } from './ReplayEffectView.ts';

/** Minimal renderer surface this session needs — lets tests inject a fake instead of a real
 * `THREE.WebGPURenderer` (which needs a live GPU adapter to construct). */
export interface ReplayPresentationRenderer {
  render(scene: THREE.Scene, camera: THREE.Camera): void;
}

export type ReplaySessionStatus = 'loading' | 'ready' | 'aborted';

export interface ReplayPresentationSessionDeps {
  readonly recording: ReplayRecording;
  readonly sceneConfig: SceneConfig;
  readonly renderer: ReplayPresentationRenderer;
  readonly loaderOverride?: SceneAssetLoader;
  /** DI seam for tests — defaults to the real async GLTF-capable loader. */
  readonly createSceneManagerWithStatus?: typeof createSceneManagerWithStatus;
}

export interface ReplayPresentationSessionHandle extends ReplayPresentationSession {
  readonly status: ReplaySessionStatus;
  readonly player: ReplayPlayer;
}

/**
 * ReplayPresentationSession — WP-50 / T3（README §2.7/§2.11）
 *
 * Owns exactly one async scene-load generation. `dispose()` immediately marks the session
 * `'aborted'`; if the scene load later resolves anyway, the freshly-built `SceneManager` is
 * disposed on arrival and never mounted into anything (README "late scene不可掛入active tree；
 * dispose所有GPU/listener/controller資源"). Because each session owns its own closure state, a
 * caller can safely dispose one session and immediately construct a new one — no shared
 * generation counter is needed (`PresentationCoordinator` already forbids two concurrent replay
 * sessions from existing at once).
 *
 * `frame()` is a no-op while still loading (T5 owns the loading-UI presentation); once the scene
 * is mounted, every subsequent `frame(nowMs)` samples the player, applies the sample to the
 * isolated camera plus target/effect views, and renders — never touching `simLoop.pump`,
 * `SharedState`, or the live scene (D-50-P5/FR-50.4).
 *
 * WP-50 / T4: `weapon`/`punchTimeline` (recoil punch reconstruction, `replayRecoil.ts`) are resolved
 * once up front — pure CPU work, independent of the async scene load, so it doesn't block/gate
 * `status`. `getWeapon(recording.weaponId)` is wrapped defensively: every profile currently registered
 * uses a known weapon (T0 roster), but a session must degrade to punch=0/hip-FOV rather than throw if
 * a future recording ever names an unregistered id (README failure-mode: never crash/hang the UI).
 */
export function createReplayPresentationSession(deps: ReplayPresentationSessionDeps): ReplayPresentationSessionHandle {
  let status: ReplaySessionStatus = 'loading';
  let adapter: ReplaySceneAdapter | undefined;
  let targetView: ReplayTargetView | undefined;
  let effectView: ReplayEffectView | undefined;
  let pendingSize: { readonly w: number; readonly h: number } | undefined;
  let disposed = false;

  const player = createReplayPlayer(deps.recording);
  const build = deps.createSceneManagerWithStatus ?? createSceneManagerWithStatus;

  const weapon = resolveWeapon(deps.recording.weaponId);
  const punchTimeline = weapon !== undefined ? buildReplayPunchTimeline(deps.recording, weapon) : undefined;
  // SceneManager's own camera-default fallback (SceneManager.ts: `config.proceduralRoom ?? DEFAULT_PROCEDURAL_ROOM`).
  const hipFovDeg = deps.recording.hipFovDeg ?? deps.sceneConfig.proceduralRoom?.fovDeg ?? DEFAULT_PROCEDURAL_ROOM.fovDeg;

  void build(deps.sceneConfig, deps.loaderOverride).then((result) => {
    if (disposed) {
      // Late success after dispose/abort (README §2.11): never mount into an active tree.
      result.manager.dispose();
      return;
    }
    adapter = new ReplaySceneAdapter(result.manager, deps.sceneConfig);
    targetView = new ReplayTargetView(result.manager.scene, deps.recording.targetHitbox);
    effectView = new ReplayEffectView(result.manager.scene);
    if (pendingSize !== undefined) adapter.resize(pendingSize.w, pendingSize.h);
    status = 'ready';
  });

  return {
    get status(): ReplaySessionStatus {
      return status;
    },

    get player(): ReplayPlayer {
      return player;
    },

    frame(nowMs: number): void {
      if (adapter === undefined) return; // still loading — no live/replay work happens either way
      const sample = player.frame(nowMs);
      const extras =
        weapon !== undefined && punchTimeline !== undefined
          ? resolveReplayCameraVisualState(sample, punchTimeline, weapon, hipFovDeg)
          : { punchPitchRad: 0, punchYawRad: 0, fovDeg: hipFovDeg, adsActive: false };
      adapter.applySample(sample, extras);
      targetView?.sync(sample.targets);
      effectView?.sync(sample, adapter.sceneManager.camera);
      deps.renderer.render(adapter.sceneManager.scene, adapter.sceneManager.camera);
    },

    resize(w: number, h: number): void {
      pendingSize = { w, h };
      adapter?.resize(w, h);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      status = 'aborted';
      player.dispose();
      targetView?.dispose();
      effectView?.dispose();
      adapter?.dispose();
    },
  };
}

function resolveWeapon(weaponId: string): WeaponConfig | undefined {
  try {
    return getWeapon(weaponId);
  } catch {
    return undefined;
  }
}
