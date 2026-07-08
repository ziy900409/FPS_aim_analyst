import type { DisplaySelfReport } from '../display/resolutionMode.ts';

export interface DetectedDisplay {
  screenW: number;
  screenH: number;
}

export interface SessionSetupValues {
  participantId: string;
  sessionLabel?: string;
  monitorModel?: string;
  nativeW?: number;
  nativeH?: number;
  panelInches?: number;
  viewingDistanceCm?: number;
  selfReportUncertain?: boolean;
}

export interface SessionSetupOptions {
  /** 目前自動偵測到的 `screen × dpr` 物理像素,供受試者核對。 */
  getDetectedDisplay: () => DetectedDisplay;
  /** 表單通過最小驗證後送出;caller 接著開 eligibility gate。 */
  onSubmit: (values: SessionSetupValues) => void;
  parent?: HTMLElement;
}

export interface SessionSetupHandle {
  open(): void;
  close(): void;
  dispose(): void;
}

const NATIVE_MIN = 640;
const NATIVE_MAX = 10000;
const PANEL_INCHES_MIN = 10;
const PANEL_INCHES_MAX = 80;
const VIEWING_DISTANCE_MIN_CM = 20;
const VIEWING_DISTANCE_MAX_CM = 200;

export function displaySelfReportFromSessionSetup(
  values: SessionSetupValues,
  detected: DetectedDisplay,
): DisplaySelfReport {
  return {
    ...(values.monitorModel !== undefined ? { monitorModel: values.monitorModel } : {}),
    ...(values.nativeW !== undefined ? { nativeW: values.nativeW } : {}),
    ...(values.nativeH !== undefined ? { nativeH: values.nativeH } : {}),
    ...(values.panelInches !== undefined ? { panelInches: values.panelInches } : {}),
    ...(values.viewingDistanceCm !== undefined ? { viewingDistanceCm: values.viewingDistanceCm } : {}),
    ...(values.selfReportUncertain ? { selfReportUncertain: true } : {}),
    ...(values.nativeW !== undefined && values.nativeH !== undefined
      ? { nativeMismatch: values.nativeW !== detected.screenW || values.nativeH !== detected.screenH }
      : {}),
  };
}

export function createSessionSetupForm(options: SessionSetupOptions): SessionSetupHandle {
  const parent = options.parent ?? document.body;

  const root = document.createElement('section');
  root.id = 'session-setup';
  root.setAttribute('aria-label', 'Experiment session setup');
  root.style.cssText = overlayCss;
  root.style.display = 'none';

  const form = document.createElement('form');
  form.style.cssText = cardCss;

  const title = document.createElement('h2');
  title.textContent = '實驗 session setup';
  title.style.cssText = 'grid-column:1 / -1;margin:0;font:750 18px/1.3 system-ui,sans-serif;color:#edf2f7';

  const desc = document.createElement('p');
  desc.textContent = '請填研究者發放代號;顯示硬體欄位為自陳資料,不知道可留空或勾選不確定。';
  desc.style.cssText = 'grid-column:1 / -1;margin:0;font:500 13px/1.5 system-ui,sans-serif;color:#aeb6bf';

  const detectedText = document.createElement('p');
  detectedText.style.cssText =
    'grid-column:1 / -1;margin:0;font:650 13px/1.5 system-ui,sans-serif;color:#9fd0ff';

  const participantId = makeTextField('Participant ID', 'participantId', true);
  const sessionLabel = makeTextField('Session label', 'sessionLabel', false);
  const monitorModel = makeTextField('Monitor model', 'monitorModel', false);
  const nativeW = makeNumberField('Native width', 'nativeW', 'px', NATIVE_MIN, NATIVE_MAX, 1);
  const nativeH = makeNumberField('Native height', 'nativeH', 'px', NATIVE_MIN, NATIVE_MAX, 1);
  const panelInches = makeNumberField(
    'Panel inches',
    'panelInches',
    'in',
    PANEL_INCHES_MIN,
    PANEL_INCHES_MAX,
    0.1,
  );
  const viewingDistanceCm = makeNumberField(
    'Viewing distance',
    'viewingDistanceCm',
    'cm',
    VIEWING_DISTANCE_MIN_CM,
    VIEWING_DISTANCE_MAX_CM,
    1,
  );

  const uncertainRow = document.createElement('label');
  uncertainRow.style.cssText =
    'grid-column:1 / -1;display:flex;align-items:center;gap:8px;font:600 13px/1.4 system-ui,sans-serif';
  const uncertain = document.createElement('input');
  uncertain.type = 'checkbox';
  uncertain.name = 'selfReportUncertain';
  const uncertainText = document.createElement('span');
  uncertainText.textContent = '不確定顯示硬體資訊';
  uncertainRow.append(uncertain, uncertainText);

  const status = document.createElement('p');
  status.style.cssText =
    'grid-column:1 / -1;margin:0;font:650 13px/1.4 system-ui,sans-serif;color:#f0c674;min-height:18px';

  const submitButton = makeButton('下一步', 'Continue to eligibility gate', 'submit');
  const cancelButton = makeButton('取消', 'Close session setup', 'button');
  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'grid-column:1 / -1;display:flex;gap:8px';
  buttonRow.append(submitButton, cancelButton);

  form.append(
    title,
    desc,
    detectedText,
    participantId.row,
    sessionLabel.row,
    monitorModel.row,
    nativeW.row,
    nativeH.row,
    panelInches.row,
    viewingDistanceCm.row,
    uncertainRow,
    status,
    buttonRow,
  );
  root.appendChild(form);
  parent.appendChild(root);

  function open(): void {
    const detected = options.getDetectedDisplay();
    detectedText.textContent = `自動偵測原生解析度: ${detected.screenW}×${detected.screenH}`;
    status.textContent = '';
    root.style.display = 'flex';
  }

  function close(): void {
    root.style.display = 'none';
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = readValues({
      participantId: participantId.input,
      sessionLabel: sessionLabel.input,
      monitorModel: monitorModel.input,
      nativeW: nativeW.input,
      nativeH: nativeH.input,
      panelInches: panelInches.input,
      viewingDistanceCm: viewingDistanceCm.input,
      selfReportUncertain: uncertain,
    });
    if (!result.ok) {
      status.textContent = result.error;
      return;
    }
    status.textContent = '';
    options.onSubmit(result.values);
    close();
  });
  cancelButton.addEventListener('click', close);

  return {
    open,
    close,
    dispose(): void {
      root.remove();
    },
  };
}

interface FormInputs {
  participantId: HTMLInputElement;
  sessionLabel: HTMLInputElement;
  monitorModel: HTMLInputElement;
  nativeW: HTMLInputElement;
  nativeH: HTMLInputElement;
  panelInches: HTMLInputElement;
  viewingDistanceCm: HTMLInputElement;
  selfReportUncertain: HTMLInputElement;
}

type ReadValuesResult = { ok: true; values: SessionSetupValues } | { ok: false; error: string };

function readValues(inputs: FormInputs): ReadValuesResult {
  const participantId = optionalText(inputs.participantId.value);
  if (participantId === undefined) return { ok: false, error: 'Participant ID 必填。' };

  try {
    const values: SessionSetupValues = { participantId };
    assignOptionalText(values, 'sessionLabel', inputs.sessionLabel.value);
    assignOptionalText(values, 'monitorModel', inputs.monitorModel.value);
    assignOptionalNumber(
      values,
      'nativeW',
      inputs.nativeW.value,
      'Native width',
      NATIVE_MIN,
      NATIVE_MAX,
      true,
    );
    assignOptionalNumber(
      values,
      'nativeH',
      inputs.nativeH.value,
      'Native height',
      NATIVE_MIN,
      NATIVE_MAX,
      true,
    );
    assignOptionalNumber(
      values,
      'panelInches',
      inputs.panelInches.value,
      'Panel inches',
      PANEL_INCHES_MIN,
      PANEL_INCHES_MAX,
      false,
    );
    assignOptionalNumber(
      values,
      'viewingDistanceCm',
      inputs.viewingDistanceCm.value,
      'Viewing distance',
      VIEWING_DISTANCE_MIN_CM,
      VIEWING_DISTANCE_MAX_CM,
      false,
    );
    if (inputs.selfReportUncertain.checked) values.selfReportUncertain = true;
    return { ok: true, values };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function assignOptionalText<T extends 'sessionLabel' | 'monitorModel'>(
  values: SessionSetupValues,
  key: T,
  raw: string,
): void {
  const value = optionalText(raw);
  if (value !== undefined) values[key] = value;
}

function assignOptionalNumber<T extends 'nativeW' | 'nativeH' | 'panelInches' | 'viewingDistanceCm'>(
  values: SessionSetupValues,
  key: T,
  raw: string,
  label: string,
  min: number,
  max: number,
  integer: boolean,
): void {
  const trimmed = raw.trim();
  if (trimmed === '') return;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${label} must be ${integer ? 'an integer' : 'a number'} between ${min} and ${max}.`);
  }
  values[key] = value as SessionSetupValues[T];
}

function optionalText(raw: string): string | undefined {
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

function makeTextField(
  labelText: string,
  name: keyof Pick<SessionSetupValues, 'participantId' | 'sessionLabel' | 'monitorModel'>,
  required: boolean,
): { row: HTMLElement; input: HTMLInputElement } {
  const row = document.createElement('label');
  row.style.cssText = fieldCss;
  const label = document.createElement('span');
  label.textContent = required ? `${labelText} *` : labelText;
  const input = document.createElement('input');
  input.type = 'text';
  input.name = name;
  input.required = required;
  input.style.cssText = inputCss;
  row.append(label, input);
  return { row, input };
}

function makeNumberField(
  labelText: string,
  name: keyof Pick<SessionSetupValues, 'nativeW' | 'nativeH' | 'panelInches' | 'viewingDistanceCm'>,
  suffix: string,
  min: number,
  max: number,
  step: number,
): { row: HTMLElement; input: HTMLInputElement } {
  const row = document.createElement('label');
  row.style.cssText = fieldCss;
  const label = document.createElement('span');
  label.textContent = `${labelText} (${suffix})`;
  const input = document.createElement('input');
  input.type = 'number';
  input.name = name;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.style.cssText = inputCss;
  row.append(label, input);
  return { row, input };
}

function makeButton(label: string, title: string, type: 'button' | 'submit'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = type;
  button.textContent = label;
  button.title = title;
  button.style.cssText = [
    'height:38px',
    'padding:0 16px',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:6px',
    'font:750 13px/1 system-ui,sans-serif',
    'color:#e6e9ec',
    'background:rgba(15,18,21,0.96)',
    'cursor:pointer',
  ].join(';');
  return button;
}

const overlayCss = [
  'position:fixed',
  'inset:0',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  'background:rgba(10,12,14,0.82)',
  'pointer-events:auto',
  'z-index:60',
].join(';');

const cardCss = [
  'display:grid',
  'grid-template-columns:minmax(0,1fr) minmax(0,1fr)',
  'gap:12px',
  'width:min(90vw,640px)',
  'padding:20px',
  'background:rgba(24,27,30,0.98)',
  'border:1px solid rgba(255,255,255,0.14)',
  'border-radius:10px',
  'box-shadow:0 18px 48px rgba(0,0,0,0.4)',
  'color:#e6e9ec',
].join(';');

const fieldCss = 'display:flex;flex-direction:column;gap:4px;font:600 13px/1.4 system-ui,sans-serif';
const inputCss = [
  'height:32px',
  'padding:0 8px',
  'border:1px solid rgba(255,255,255,0.18)',
  'border-radius:6px',
  'font:600 13px/1 system-ui,sans-serif',
  'color:#edf2f7',
  'background:rgba(255,255,255,0.08)',
].join(';');
