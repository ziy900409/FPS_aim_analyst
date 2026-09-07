import type { SceneConfig } from '../scene/SceneConfig.ts';
import { createSceneManagerWithStatus, type SceneManagerLoadResult } from './SceneManager.ts';

export interface SceneLoadRequest {
  /** Loads at most one scene for this generation; stale arrivals are disposed and reported as null. */
  load(config: SceneConfig): Promise<SceneManagerLoadResult | null>;
  /** Covers generations that do not need an asset load but still supersede an older request. */
  isCurrent(): boolean;
}

export interface SceneLoadCoordinator {
  /** Starts a new live-scene generation and invalidates every older request. */
  begin(): SceneLoadRequest;
  /** Invalidates outstanding work. A manager arriving after disposal is immediately released. */
  dispose(): void;
}

export type SceneManagerFactory = (config: SceneConfig) => Promise<SceneManagerLoadResult>;

/**
 * Owns the generation boundary around async live-scene loads.
 *
 * GLTFLoader cannot reliably abort every underlying browser/cache operation. Instead, each caller
 * starts a generation before resolving its drill/scene transaction. Only the newest generation may
 * install its manager; an older manager that resolves late is disposed before it reaches the active
 * scene tree. The coordinator deliberately does not own the installed manager — main's existing
 * `installSceneLoad` path remains its single presentation owner.
 */
export function createSceneLoadCoordinator(
  createManager: SceneManagerFactory = createSceneManagerWithStatus,
): SceneLoadCoordinator {
  let generation = 0;
  let disposed = false;

  return {
    begin(): SceneLoadRequest {
      if (disposed) throw new Error('SceneLoadCoordinator 已 dispose');
      const requestGeneration = ++generation;
      let loadStarted = false;

      return {
        async load(config): Promise<SceneManagerLoadResult | null> {
          if (loadStarted) throw new Error('SceneLoadRequest.load 只能呼叫一次');
          loadStarted = true;
          const result = await createManager(config);
          if (disposed || requestGeneration !== generation) {
            result.manager.dispose();
            return null;
          }
          return result;
        },
        isCurrent(): boolean {
          return !disposed && requestGeneration === generation;
        },
      };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      generation++;
    },
  };
}
