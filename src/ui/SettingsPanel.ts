/**
 * SettingsPanel — WP-1 / T5（FR-1.5）
 *
 * 純 TS + DOM overlay（D1，不引框架）：sensitivity / FOV 兩個滑桿與解析度模式選單，拖動即時生效
 * （無「套用」鈕，`input` 事件直接回呼）。屬「UI」層：只負責設定值與其 DOM，
 * 透過 callback 通知變更，**不**相依 CameraController / PointerLock（由 main 組裝）。
 *
 * 本面板為這兩個設定的**單一真實來源**：建構時即把預設值經 callback 推給 controller，
 * 避免與 CameraController/SceneManager 各自的預設漂移。`sensitivity`/`fov` getter 供
 * WP-7 metadata 讀取。可見性由外部 `setVisible` 控制（鎖定中隱藏、解除時顯示，OQ-1.3）。
 *
 * 數值範圍為佔位（pilot 校準，OQ-1.1）：sensitivity 0.1–5.0、FOV 60–120°。
 */

import {
  RESOLUTION_MODE_OPTIONS,
  resolutionModeLabel,
  type ResolutionMode,
} from '../display/resolutionMode.ts';

const SENSITIVITY_DEFAULT = 1.0;
const SENSITIVITY_MIN = 0.1;
const SENSITIVITY_MAX = 5.0;
const SENSITIVITY_STEP = 0.1;

const FOV_DEFAULT = 75;
const FOV_MIN = 60;
const FOV_MAX = 120;
const FOV_STEP = 1;

export interface SettingsPanelOptions {
  /** sensitivity 變更（拖動 slider 或建構時的初值推送）即時回呼。 */
  onSensitivityChange: (sensitivity: number) => void;
  /** FOV（度）變更即時回呼。 */
  onFovChange: (fovDeg: number) => void;
  /** 解析度模式變更即時回呼。 */
  onResolutionModeChange?: (mode: ResolutionMode) => void;
  /** 初始解析度模式；預設 native。 */
  initialResolutionMode?: ResolutionMode;
}

export interface SettingsPanelHandle {
  /** 目前 sensitivity（WP-7 metadata）。 */
  readonly sensitivity: number;
  /** 目前 FOV（度）（WP-7 metadata）。 */
  readonly fov: number;
  /** 目前解析度模式（WP-20 display metadata）。 */
  readonly resolutionMode: ResolutionMode;
  /** 顯示/隱藏面板（locked 時隱藏，OQ-1.3）。 */
  setVisible(visible: boolean): void;
  /** 外部流程（例如 protocol 條件）套用解析度模式後同步 UI 顯示。 */
  setResolutionMode(mode: ResolutionMode): void;
  /** protocol 鎖定解析度條件時停用切換；WP-22 T2 消費。 */
  lockMode(locked: boolean): void;
}

export function createSettingsPanel(opts: SettingsPanelOptions): SettingsPanelHandle {
  let sensitivity = SENSITIVITY_DEFAULT;
  let fov = FOV_DEFAULT;
  let resolutionMode = opts.initialResolutionMode ?? 'native';
  let resolutionModeLocked = false;

  const root = document.createElement('div');
  root.id = 'settings-panel';
  root.style.cssText = [
    'position:fixed',
    'top:16px',
    'left:16px',
    'display:flex',
    'flex-direction:column',
    'gap:12px',
    'min-width:200px',
    'padding:14px 16px',
    'font:500 13px/1.4 system-ui,sans-serif',
    'color:#e6e9ec',
    'background:rgba(24,27,30,0.92)',
    'border:1px solid rgba(255,255,255,0.12)',
    'border-radius:8px',
    'pointer-events:auto', // 僅面板可互動；canvas 點擊鎖定不受影響（lockHint 為 pointer-events:none）
    'user-select:none',
    'z-index:11', // 蓋在 lockHint（z-index:10）之上
  ].join(';');

  const fmtSens = (v: number): string => v.toFixed(2);
  const fmtFov = (v: number): string => `${v.toFixed(0)}°`;

  const sens = makeRow('Sensitivity', SENSITIVITY_MIN, SENSITIVITY_MAX, SENSITIVITY_STEP, sensitivity, fmtSens);
  const fovRow = makeRow('FOV', FOV_MIN, FOV_MAX, FOV_STEP, fov, fmtFov);
  const resolutionRow = makeSelectRow('Resolution', resolutionMode);
  root.append(sens.row, fovRow.row, resolutionRow.row);
  document.body.appendChild(root);

  sens.input.addEventListener('input', () => {
    sensitivity = sens.input.valueAsNumber;
    sens.value.textContent = fmtSens(sensitivity);
    opts.onSensitivityChange(sensitivity);
  });
  fovRow.input.addEventListener('input', () => {
    fov = fovRow.input.valueAsNumber;
    fovRow.value.textContent = fmtFov(fov);
    opts.onFovChange(fov);
  });
  resolutionRow.select.addEventListener('change', () => {
    if (resolutionModeLocked) return;
    resolutionMode = resolutionRow.select.value as ResolutionMode;
    resolutionRow.value.textContent = resolutionModeLabel(resolutionMode);
    opts.onResolutionModeChange?.(resolutionMode);
  });

  // 建構時把預設值推給 controller，使滑桿位置與實際視角一致（單一真實來源）。
  opts.onSensitivityChange(sensitivity);
  opts.onFovChange(fov);
  opts.onResolutionModeChange?.(resolutionMode);

  return {
    get sensitivity(): number {
      return sensitivity;
    },
    get fov(): number {
      return fov;
    },
    get resolutionMode(): ResolutionMode {
      return resolutionMode;
    },
    setVisible(visible: boolean): void {
      root.style.display = visible ? 'flex' : 'none';
    },
    setResolutionMode(mode: ResolutionMode): void {
      resolutionMode = mode;
      resolutionRow.select.value = mode;
      resolutionRow.value.textContent = resolutionModeLabel(mode);
    },
    lockMode(locked: boolean): void {
      resolutionModeLocked = locked;
      resolutionRow.select.disabled = locked;
    },
  };
}

/** 建一列：標題 + 數值顯示 + range slider。回傳 input 與數值 span 供綁定。 */
function makeRow(
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  format: (v: number) => string,
): { row: HTMLElement; input: HTMLInputElement; value: HTMLElement } {
  const row = document.createElement('label');
  row.style.cssText = 'display:flex;flex-direction:column;gap:4px';

  const head = document.createElement('span');
  head.style.cssText = 'display:flex;justify-content:space-between;gap:12px';
  const name = document.createElement('span');
  name.textContent = label;
  const valueSpan = document.createElement('span');
  valueSpan.textContent = format(value);
  valueSpan.style.cssText = 'color:#9fd0ff;font-variant-numeric:tabular-nums';
  head.append(name, valueSpan);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.style.cssText = 'width:100%;cursor:pointer';

  row.append(head, input);
  return { row, input, value: valueSpan };
}

function makeSelectRow(
  label: string,
  value: ResolutionMode,
): { row: HTMLElement; select: HTMLSelectElement; value: HTMLElement } {
  const row = document.createElement('label');
  row.style.cssText = 'display:flex;flex-direction:column;gap:4px';

  const head = document.createElement('span');
  head.style.cssText = 'display:flex;justify-content:space-between;gap:12px';
  const name = document.createElement('span');
  name.textContent = label;
  const valueSpan = document.createElement('span');
  valueSpan.textContent = resolutionModeLabel(value);
  valueSpan.style.cssText = 'color:#9fd0ff;font-variant-numeric:tabular-nums';
  head.append(name, valueSpan);

  const select = document.createElement('select');
  select.style.cssText = 'width:100%;cursor:pointer';
  for (const option of RESOLUTION_MODE_OPTIONS) {
    const el = document.createElement('option');
    el.value = option.mode;
    el.textContent = option.label;
    select.appendChild(el);
  }
  select.value = value;

  row.append(head, select);
  return { row, select, value: valueSpan };
}
