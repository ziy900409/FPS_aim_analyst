import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveBackend } from './createRenderer.ts';

describe('resolveBackend — 雙重判定（renderer 實際 backend 為權威）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderer 實際 backend 為 WebGPU → webgpu', () => {
    expect(resolveBackend({}, { isWebGPUBackend: true })).toBe('webgpu');
  });

  it('navigator.gpu 不存在且 renderer 為 WebGL2 → webgl2（正常 fallback，無 warn）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveBackend(undefined, { isWebGPUBackend: false })).toBe('webgl2');
    expect(warn).not.toHaveBeenCalled();
  });

  it('navigator.gpu 存在但 renderer 實際 fallback 成 WebGL2 → webgl2 並 warn（風險表防的誤判情境）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveBackend({}, { isWebGPUBackend: false })).toBe('webgl2');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('renderer.backend 缺失（防禦性）→ webgl2', () => {
    expect(resolveBackend(undefined, undefined)).toBe('webgl2');
    expect(resolveBackend(undefined, null)).toBe('webgl2');
  });
});
