import { describe, expect, it } from 'vitest';
import { placeholderRoom } from '../../scene/scenes/placeholder-room.ts';
import { fieldLow } from '../../scene/scenes/field-low.ts';
import { resolveReplaySceneConfig } from './replaySceneResolution.ts';

describe('resolveReplaySceneConfig', () => {
  it('returns undefined when the descriptor is absent', () => {
    expect(resolveReplaySceneConfig(undefined, [placeholderRoom, fieldLow])).toBeUndefined();
  });

  it('returns undefined when the recorded sceneId is not currently installed', () => {
    const resolution = resolveReplaySceneConfig(
      { sceneId: 'no-longer-exists', assetPackVersion: 'v1', clutterTier: 'low', fallback: false },
      [placeholderRoom, fieldLow],
    );
    expect(resolution).toBeUndefined();
  });

  it('resolves the installed config with no mismatch when assetPackVersion matches', () => {
    const resolution = resolveReplaySceneConfig(
      {
        sceneId: placeholderRoom.sceneId,
        assetPackVersion: placeholderRoom.assetPackVersion,
        clutterTier: placeholderRoom.clutterTier,
        fallback: false,
      },
      [placeholderRoom, fieldLow],
    );
    expect(resolution?.config).toBe(placeholderRoom);
    expect(resolution?.versionMismatch).toBe(false);
  });

  it('flags a version mismatch (OQ-50.4/D-50-P11) without refusing the resolution', () => {
    const resolution = resolveReplaySceneConfig(
      { sceneId: placeholderRoom.sceneId, assetPackVersion: 'stale-v0', clutterTier: 'low', fallback: false },
      [placeholderRoom, fieldLow],
    );
    expect(resolution?.config).toBe(placeholderRoom);
    expect(resolution?.versionMismatch).toBe(true);
  });

  it('treats a missing recorded assetPackVersion as no mismatch (nothing to compare against)', () => {
    const resolution = resolveReplaySceneConfig(
      { sceneId: placeholderRoom.sceneId, clutterTier: 'low', fallback: false },
      [placeholderRoom, fieldLow],
    );
    expect(resolution?.versionMismatch).toBe(false);
  });
});
