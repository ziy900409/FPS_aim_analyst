// WP-0 / T2（FR-0.2）— cross-origin isolation 執行期斷言 + performance.now() 解析度量測。
//
// crossOriginIsolated === true 是後續所有 performance.now() 量測的效度前提（ADR-4）：
// isolated 時瀏覽器把計時器解析度從 ~100 µs 收緊到 ~5 µs，並解鎖階段 B 的 SharedArrayBuffer。
// 禁用 Date.now()（ADR-4）——本檔只讀 crossOriginIsolated 與 performance.now()。

export interface IsolationStatus {
  /** 由 COOP/COEP 標頭決定；false 代表計時精度不足、量測效度受損。 */
  crossOriginIsolated: boolean;
  /** 量測到的 performance.now() 解析度（µs）；isolated 預期 ~5 µs，非 isolated 約 100 µs。 */
  timerResolutionUs: number;
}

/**
 * 量測 performance.now() 的解析度：連續取樣，取相鄰差值的最小非零值近似時鐘粒度。
 * 僅供 log / sanity（環境噪音大），不作硬斷言；硬斷言只放在 crossOriginIsolated（布林、可靠）。
 */
function measureTimerResolutionUs(samples = 50_000): number {
  let minDeltaMs = Infinity;
  let prev = performance.now();
  for (let i = 0; i < samples; i++) {
    const now = performance.now();
    const delta = now - prev;
    if (delta > 0 && delta < minDeltaMs) {
      minDeltaMs = delta;
    }
    prev = now;
  }
  return Number.isFinite(minDeltaMs) ? minDeltaMs * 1000 : Number.NaN;
}

/**
 * 讀取 crossOriginIsolated 並量測計時器解析度。
 * crossOriginIsolated === false 時 console.warn（標頭未生效 → 量測效度受損）。
 */
export function assertIsolation(): IsolationStatus {
  const isolated = globalThis.crossOriginIsolated === true;
  const timerResolutionUs = measureTimerResolutionUs();
  if (!isolated) {
    console.warn(
      '[isolation] crossOriginIsolated === false — performance.now() 解析度不足，量測效度受損（ADR-4）。' +
        '請確認 dev/preview/線上主機皆帶 COOP: same-origin + COEP: require-corp。',
    );
  }
  return { crossOriginIsolated: isolated, timerResolutionUs };
}
