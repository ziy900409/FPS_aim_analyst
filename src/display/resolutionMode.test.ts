import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyResolutionMode } from './resolutionMode.ts';

class FakeRenderer {
  readonly domElement = {
    width: 0,
    height: 0,
    style: { width: '', height: '' },
  } as HTMLCanvasElement;
  pixelRatio = 1;

  setPixelRatio(pixelRatio: number): void {
    this.pixelRatio = pixelRatio;
  }

  setSize(width: number, height: number, updateStyle = true): void {
    this.domElement.width = Math.round(width * this.pixelRatio);
    this.domElement.height = Math.round(height * this.pixelRatio);
    if (updateStyle) {
      this.domElement.style.width = `${width}px`;
      this.domElement.style.height = `${height}px`;
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('applyResolutionMode', () => {
  it('preserves native mode behavior with capped device pixel ratio', () => {
    stubDisplayGlobals({ innerWidth: 1280, innerHeight: 720, dpr: 2.5, screenWidth: 1920, screenHeight: 1080 });
    const renderer = new FakeRenderer();

    const state = applyResolutionMode(renderer, 'native');

    expect(renderer.pixelRatio).toBe(2);
    expect(renderer.domElement.width).toBe(2560);
    expect(renderer.domElement.height).toBe(1440);
    expect(renderer.domElement.style.width).toBe('1280px');
    expect(renderer.domElement.style.height).toBe('720px');
    expect(state).toMatchObject({
      mode: 'native',
      bufferW: 2560,
      bufferH: 1440,
      cssW: 1280,
      cssH: 720,
      dpr: 2.5,
      screenW: 4800,
      screenH: 2700,
      fullscreen: false,
      refreshEstimateHz: 0,
    });
  });

  it('uses explicit 1080p buffer with CSS fullscreen upscale', () => {
    stubDisplayGlobals({ innerWidth: 1600, innerHeight: 900, dpr: 1.25, screenWidth: 1600, screenHeight: 900, fullscreen: true });
    const renderer = new FakeRenderer();

    const state = applyResolutionMode(renderer, 'fhd-1080');

    expect(renderer.pixelRatio).toBe(1);
    expect(renderer.domElement.width).toBe(1920);
    expect(renderer.domElement.height).toBe(1080);
    expect(renderer.domElement.style.width).toBe('100%');
    expect(renderer.domElement.style.height).toBe('100%');
    expect(state).toMatchObject({
      mode: 'fhd-1080',
      bufferW: 1920,
      bufferH: 1080,
      cssW: 1600,
      cssH: 900,
      dpr: 1.25,
      screenW: 2000,
      screenH: 1125,
      fullscreen: true,
    });
  });

  it('uses explicit 1440p buffer independent of viewport size', () => {
    stubDisplayGlobals({ innerWidth: 1280, innerHeight: 720, dpr: 1, screenWidth: 1280, screenHeight: 720 });
    const renderer = new FakeRenderer();

    const state = applyResolutionMode(renderer, 'qhd-1440');

    expect(state.bufferW).toBe(2560);
    expect(state.bufferH).toBe(1440);
    expect(state.cssW).toBe(1280);
    expect(state.cssH).toBe(720);
  });
});

function stubDisplayGlobals(args: {
  innerWidth: number;
  innerHeight: number;
  dpr: number;
  screenWidth: number;
  screenHeight: number;
  fullscreen?: boolean;
}): void {
  vi.stubGlobal('window', {
    innerWidth: args.innerWidth,
    innerHeight: args.innerHeight,
    devicePixelRatio: args.dpr,
  });
  vi.stubGlobal('screen', { width: args.screenWidth, height: args.screenHeight });
  vi.stubGlobal('document', { fullscreenElement: args.fullscreen ? {} : null });
}
