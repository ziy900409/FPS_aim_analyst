import type { SceneConfig } from '../../scene/SceneConfig.ts';
import type { ReplaySceneDescriptor } from '../../replay/contracts.ts';

export interface ReplaySceneResolution {
  readonly config: SceneConfig;
  /** `true` when the recorded `assetPackVersion` differs from the currently-installed config's. */
  readonly versionMismatch: boolean;
}

/**
 * WP-50 / T3 — pure scene-config lookup for a recorded `ReplaySceneDescriptor` (README §2.4,
 * OQ-50.4 / D-50-P11): resolves the currently-installed `SceneConfig` for the recorded `sceneId`
 * and flags an `assetPackVersion` mismatch so the caller can degrade to `partial` and show a
 * version-gap warning instead of silently treating the recorded and installed asset packs as
 * identical. Returns `undefined` when the descriptor is absent or the `sceneId` is not (or no
 * longer) installed — the caller decides what "no playable scene" means (unsupported vs. a
 * placeholder), this function only reports what it found.
 */
export function resolveReplaySceneConfig(
  scene: ReplaySceneDescriptor | undefined,
  availableScenes: readonly SceneConfig[],
): ReplaySceneResolution | undefined {
  if (scene?.sceneId === undefined) return undefined;
  const config = availableScenes.find((candidate) => candidate.sceneId === scene.sceneId);
  if (config === undefined) return undefined;
  return {
    config,
    versionMismatch: scene.assetPackVersion !== undefined && scene.assetPackVersion !== config.assetPackVersion,
  };
}
