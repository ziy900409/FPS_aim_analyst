/**
 * RenderLoop — WP-2 / T3（FR-2.3）
 *
 * rAF 渲染迴圈驅動：每幀以 rAF 時間戳（DOMHighResTimeStamp，與 `performance.now()` 同域）
 * 呼叫 `onFrame`。**單一職責 = 排程幀**——pump / 內插 / 繪製的編排由呼叫端（main.ts）負責，
 * RenderLoop 不知 sim（雙迴圈解耦，ADR-2）。render 端唯讀 sim 的 `prev/curr` 做內插、不寫回
 * `SharedState`。
 */

export interface RenderLoop {
  start(): void;
  stop(): void;
}

/** 線性內插：render 在兩個 sim tick 快照間以 `alpha ∈ [0,1)` 取中間值，高 FPS 下畫面不抖（FR-2.3）。 */
export function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

export function createRenderLoop(onFrame: (nowMs: number) => void): RenderLoop {
  let rafId = 0;
  let running = false;

  function frame(nowMs: number): void {
    if (!running) return; // stop() 後殘留的已排程 callback 在此被擋下
    onFrame(nowMs);
    rafId = requestAnimationFrame(frame);
  }

  return {
    start(): void {
      if (running) return; // 重複 start 不疊迴圈
      running = true;
      rafId = requestAnimationFrame(frame);
    },
    stop(): void {
      if (!running) return;
      running = false;
      cancelAnimationFrame(rafId);
      rafId = 0;
    },
  };
}
