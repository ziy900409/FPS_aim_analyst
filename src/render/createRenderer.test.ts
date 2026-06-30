import { describe, expect, it } from 'vitest';
import { pickBackend } from './createRenderer.ts';

describe('pickBackend', () => {
  it('falls back to webgl2 when navigator.gpu is unavailable', () => {
    expect(pickBackend(undefined)).toBe('webgl2');
  });

  it('selects webgpu when navigator.gpu is available', () => {
    expect(pickBackend({})).toBe('webgpu');
  });
});
