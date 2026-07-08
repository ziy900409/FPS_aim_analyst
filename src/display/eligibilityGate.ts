import { PERF_FLOOR_MS } from './constants.ts';
import { createFrameLog } from './frameLog.ts';

/**
 * 資格閘 — GD-10 防線①（FR-C7）。WP-20 T2。
 *
 * 實驗 session 進入前自動檢查三項:**原生解析度 ≥ 實驗最高條件、fullscreen 已進入、
 * 效能地板通過**。任一不合格 = 拒入實驗 session（UI 明示原因）。一般練習不受限。
 *
 * 純函式:讀 `screen`/`devicePixelRatio`/`document.fullscreenElement` 三個環境訊號 +
 * caller 傳入的 warmup p95（見 `probeWarmupP95Ms`;百分位由 T3 frameLog consolidated 來源計算）。
 * `details` 為全量人類可讀字串,進 `meta.display.gate` 供事後審查（跨硬體誤判的稽核依據）。
 */

export interface EligibilityRequirement {
  /** 原生解析度需求(實體像素寬)。 */
  minW: number;
  /** 原生解析度需求(實體像素高)。 */
  minH: number;
}

export interface GateReport {
  /** 三檢查全過。 */
  pass: boolean;
  /** 原生解析度 ≥ 需求。 */
  native: boolean;
  /** fullscreen 已進入。 */
  fullscreen: boolean;
  /** warmup p95 ≤ 效能地板。 */
  perf: boolean;
  /** 全量人類可讀明細(逐項 pass/fail + 實測值 vs 門檻);進 meta.display.gate。 */
  details: string;
}

/**
 * 資格閘三檢查（純判定）。不合格由 caller 拒入實驗 session。
 *
 * @param required 實驗最高條件（原生解析度門檻,實體像素）。
 * @param warmupP95Ms warmup 探測的 frame-time p95（ms;見 `probeWarmupP95Ms`）。
 * @param perfFloorMs 效能地板（預設 `PERF_FLOOR_MS`）。
 */
export function runEligibilityGate(
  required: EligibilityRequirement,
  warmupP95Ms: number,
  perfFloorMs: number = PERF_FLOOR_MS,
): GateReport {
  const minW = requirePositiveNumber(required.minW, 'required.minW');
  const minH = requirePositiveNumber(required.minH, 'required.minH');
  const p95 = requireNonNegativeNumber(warmupP95Ms, 'warmupP95Ms');
  const floor = requirePositiveNumber(perfFloorMs, 'perfFloorMs');

  // 原生解析度 = CSS screen 尺寸 × devicePixelRatio（實體像素）。Windows DPI 縮放（125%/150%）
  // 反映在 dpr,故此換算在縮放環境下仍還原真實面板像素（失效防範:details 全量記供事後審查）。
  const dpr = readDevicePixelRatio();
  const cssScreenW = readScreenDim('width');
  const cssScreenH = readScreenDim('height');
  const nativeW = Math.round(cssScreenW * dpr);
  const nativeH = Math.round(cssScreenH * dpr);
  const native = nativeW >= minW && nativeH >= minH;

  const fullscreen = readFullscreenElement() != null;

  const perf = p95 <= floor;

  const pass = native && fullscreen && perf;

  const details = [
    `native:     ${native ? 'PASS' : 'FAIL'} — 原生 ${nativeW}×${nativeH}（screen ${cssScreenW}×${cssScreenH} × dpr ${dpr}) vs 需求 ${minW}×${minH}`,
    `fullscreen: ${fullscreen ? 'PASS' : 'FAIL'} — document.fullscreenElement ${fullscreen ? '存在' : '不存在'}`,
    `perf:       ${perf ? 'PASS' : 'FAIL'} — warmup p95 ${p95.toFixed(2)}ms vs 地板 ${floor}ms`,
  ].join('\n');

  return { pass, native, fullscreen, perf, details };
}

export interface ProbeWarmupOptions {
  /** 探測樣本數（rAF delta 數）。 */
  samples?: number;
  /** 丟棄的前置樣本數（rAF 冷啟動抖動）。 */
  warmupSamples?: number;
  /** 注入用 rAF（測試/非瀏覽器環境）。 */
  requestAnimationFrame?: ((callback: (time: number) => void) => number) | null;
}

/**
 * warmup 探測:量測既有場景 idle render 的 frame-time p95（局部量測）。丟前 `warmupSamples` 個 rAF
 * 冷啟動幀,其餘 `samples` 幀餵入一個 throwaway `frameLog`——frame-time 百分位一律由 frameLog
 * （T3 consolidated 來源,OQ-S3-1）計算,資格閘不再自帶百分位實作（T2↔T3 對帳收斂）。
 */
export async function probeWarmupP95Ms(options: ProbeWarmupOptions = {}): Promise<number> {
  const samples = requireNonNegativeInteger(options.samples ?? 120, 'samples');
  const warmupSamples = requireNonNegativeInteger(options.warmupSamples ?? 30, 'warmupSamples');
  if (samples < 2) throw new Error('samples must be at least 2');

  const requestAnimationFrame =
    options.requestAnimationFrame === undefined
      ? globalThis.requestAnimationFrame?.bind(globalThis)
      : options.requestAnimationFrame;
  if (!requestAnimationFrame) throw new Error('requestAnimationFrame is not available');

  const timestamps: number[] = [];
  while (timestamps.length < warmupSamples + samples + 1) {
    timestamps.push(await nextAnimationFrame(requestAnimationFrame));
  }

  // 丟前 warmupSamples 個冷啟動幀,其餘餵入 frameLog(delta 過濾 + nearest-rank p95 皆走 T3 來源)。
  const log = createFrameLog(samples);
  for (const t of timestamps.slice(warmupSamples)) log.push(t);
  const summary = log.summary();
  if (summary.count === 0) throw new Error('warmup frame time could not be measured');

  return summary.p95;
}

function nextAnimationFrame(
  requestAnimationFrame: (callback: (time: number) => void) => number,
): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame((time) => resolve(time));
  });
}

function readDevicePixelRatio(): number {
  const dpr = globalThis.window?.devicePixelRatio ?? 1;
  return typeof dpr === 'number' && Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}

function readScreenDim(dim: 'width' | 'height'): number {
  const value = globalThis.screen?.[dim];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`screen.${dim} must be a positive finite number`);
  }
  return Math.round(value);
}

function readFullscreenElement(): unknown {
  return globalThis.document?.fullscreenElement ?? null;
}

function requirePositiveNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
  return value;
}

function requireNonNegativeNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number`);
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}
