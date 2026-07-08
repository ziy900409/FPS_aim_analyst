import type { GateReport } from './eligibilityGate.ts';

export type ResolutionMode = 'native' | 'fhd-1080' | 'qhd-1440';

export interface DisplaySelfReport {
  /** 自陳螢幕型號;瀏覽器無法可靠讀取,僅供 moderator 事後審查。 */
  monitorModel?: string;
  /** 自陳原生解析度;自動 `screenW/screenH` 仍是資格閘依據。 */
  nativeW?: number;
  nativeH?: number;
  /** 自陳面板尺寸與觀看距離;moderator-only,不作 gate。 */
  panelInches?: number;
  viewingDistanceCm?: number;
  /** 受試者明確勾選「不確定」。 */
  selfReportUncertain?: boolean;
  /** 自陳 nativeW/H 與自動 `screen × dpr` 不一致時標記。 */
  nativeMismatch?: boolean;
}

export interface DisplayState extends DisplaySelfReport {
  mode: ResolutionMode;
  bufferW: number;
  bufferH: number;
  cssW: number;
  cssH: number;
  dpr: number;
  screenW: number;
  screenH: number;
  fullscreen: boolean;
  refreshEstimateHz: number;
  refreshMedianDeltaMs?: number;
  /** 資格閘全量明細（GD-10 防線①,T2）——僅實驗 session 進入時填入,供事後審查。 */
  gate?: GateReport;
}

export interface ResolutionModeOption {
  mode: ResolutionMode;
  label: string;
}

interface ResolutionRenderer {
  domElement: HTMLCanvasElement;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
}

interface FixedModeSize {
  width: number;
  height: number;
}

const FIXED_MODE_SIZES: Record<Exclude<ResolutionMode, 'native'>, FixedModeSize> = {
  'fhd-1080': { width: 1920, height: 1080 },
  'qhd-1440': { width: 2560, height: 1440 },
};

export const RESOLUTION_MODE_OPTIONS: readonly ResolutionModeOption[] = [
  { mode: 'native', label: 'Native' },
  { mode: 'fhd-1080', label: 'FHD 1080' },
  { mode: 'qhd-1440', label: 'QHD 1440' },
];

export function isResolutionMode(value: unknown): value is ResolutionMode {
  return value === 'native' || value === 'fhd-1080' || value === 'qhd-1440';
}

export function resolutionModeLabel(mode: ResolutionMode): string {
  return RESOLUTION_MODE_OPTIONS.find((option) => option.mode === mode)?.label ?? mode;
}

export function applyResolutionMode(renderer: ResolutionRenderer, mode: ResolutionMode): DisplayState {
  const viewport = readViewport();
  const dpr = readDevicePixelRatio();
  const canvas = renderer.domElement;

  if (mode === 'native') {
    const pixelRatio = Math.min(dpr, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(viewport.cssW, viewport.cssH);
  } else {
    const size = FIXED_MODE_SIZES[mode];
    renderer.setPixelRatio(1);
    renderer.setSize(size.width, size.height, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  return {
    mode,
    bufferW: canvas.width,
    bufferH: canvas.height,
    cssW: viewport.cssW,
    cssH: viewport.cssH,
    dpr,
    screenW: viewport.screenW,
    screenH: viewport.screenH,
    fullscreen: globalThis.document?.fullscreenElement !== null && globalThis.document?.fullscreenElement !== undefined,
    refreshEstimateHz: 0,
  };
}

function readViewport(): Pick<DisplayState, 'cssW' | 'cssH' | 'screenW' | 'screenH'> {
  const win = globalThis.window;
  const dpr = readDevicePixelRatio();
  const cssW = requirePositiveInteger(win?.innerWidth ?? 1, 'window.innerWidth');
  const cssH = requirePositiveInteger(win?.innerHeight ?? 1, 'window.innerHeight');
  const screenW = Math.round(requirePositiveInteger(globalThis.screen?.width ?? cssW, 'screen.width') * dpr);
  const screenH = Math.round(requirePositiveInteger(globalThis.screen?.height ?? cssH, 'screen.height') * dpr);
  return { cssW, cssH, screenW, screenH };
}

function readDevicePixelRatio(): number {
  const dpr = globalThis.window?.devicePixelRatio ?? 1;
  return typeof dpr === 'number' && Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}

function requirePositiveInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
  return Math.round(value);
}
