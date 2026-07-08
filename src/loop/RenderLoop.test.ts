import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRenderLoop, lerp } from './RenderLoop.ts';

describe('lerp', () => {
  it('端點與中點正確', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(-4, 4, 0.25)).toBe(-2);
  });
});

describe('createRenderLoop（rAF 驅動，單一職責 = 排程幀）', () => {
  let rafCbs: FrameRequestCallback[];

  beforeEach(() => {
    rafCbs = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCbs.push(cb);
      return rafCbs.length; // 充當 raf id
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('start 後每幀以 rAF 時間戳呼叫 onFrame', () => {
    const seen: number[] = [];
    const loop = createRenderLoop((now) => seen.push(now));
    loop.start();
    rafCbs.shift()!(16); // frame 1
    rafCbs.shift()!(32); // frame 2
    expect(seen).toEqual([16, 32]);
  });

  it('stop 後殘留的已排程 callback 不再呼叫 onFrame', () => {
    let count = 0;
    const loop = createRenderLoop(() => count++);
    loop.start();
    rafCbs.shift()!(16); // 觸發 1 次（count=1）並排程下一幀
    loop.stop();
    const pending = rafCbs.shift();
    if (pending) pending(32); // 殘留 callback → 被 running guard 擋下
    expect(count).toBe(1);
  });

  it('重複 start 不疊迴圈', () => {
    const loop = createRenderLoop(() => {});
    loop.start();
    loop.start();
    expect(rafCbs).toHaveLength(1);
  });

  it('可在每幀以 primitive rAF timestamp 掛入 frame log sink', () => {
    const seen: number[] = [];
    const loop = createRenderLoop(() => {}, {
      frameLog: {
        push(tMs) {
          expect(typeof tMs).toBe('number');
          seen.push(tMs);
        },
      },
    });

    loop.start();
    rafCbs.shift()!(16);
    rafCbs.shift()!(32);

    expect(seen).toEqual([16, 32]);
  });
});
