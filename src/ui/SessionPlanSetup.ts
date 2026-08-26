import type { TestFamilyId } from '../session/sessionSchedule.ts';

export interface SessionPlanSelection {
  readonly families: readonly TestFamilyId[];
  readonly restSeconds: number;
  readonly includeWarmup: boolean;
}

export interface SessionPlanSetupOptions {
  readonly families: readonly TestFamilyId[];
  readonly restSecondsBounds?: { readonly min: number; readonly max: number };
  readonly onSubmit: (selection: SessionPlanSelection) => void;
  readonly parent?: HTMLElement;
}

export interface SessionPlanSetupHandle {
  open(): void;
  close(): void;
  dispose(): void;
}

const DEFAULT_REST_SECONDS = 60;
const DEFAULT_REST_SECONDS_BOUNDS = { min: 0, max: 3600 } as const;

export function createSessionPlanSetup(options: SessionPlanSetupOptions): SessionPlanSetupHandle {
  const restSecondsBounds = options.restSecondsBounds ?? DEFAULT_REST_SECONDS_BOUNDS;
  if (
    !Number.isFinite(restSecondsBounds.min) ||
    !Number.isFinite(restSecondsBounds.max) ||
    restSecondsBounds.min < 0 ||
    restSecondsBounds.max < restSecondsBounds.min
  ) {
    throw new Error('restSecondsBounds must define a finite non-negative range');
  }
  const parent = options.parent ?? document.body;
  const root = document.createElement('section');
  root.id = 'session-plan-setup';
  root.setAttribute('aria-label', 'Session plan setup');
  root.style.cssText = overlayCss;
  root.style.display = 'none';

  const form = document.createElement('form');
  form.style.cssText = cardCss;
  const title = document.createElement('h2');
  title.textContent = 'Session Plan';
  title.style.cssText = headingCss;
  const desc = document.createElement('p');
  desc.textContent = '勾選並拖曳排列本次要執行的測試家族，並設定各家族之間的全域休息秒數。';
  desc.style.cssText = descriptionCss;

  const familyFieldset = document.createElement('fieldset');
  familyFieldset.style.cssText = 'border:0;padding:0;margin:0;display:grid;gap:8px';
  const legend = document.createElement('legend');
  legend.textContent = '測試家族';
  legend.style.cssText = labelCss;
  familyFieldset.appendChild(legend);
  let draggedFamily: TestFamilyId | undefined;
  const familyRows = options.families.map((family) => {
    const row = document.createElement('label');
    row.style.cssText = rowCss;
    row.draggable = true;
    row.setAttribute('data-session-family', family);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'sessionFamily';
    input.value = family;
    input.checked = true;
    const text = document.createElement('span');
    text.textContent = `⋮⋮ ${family}`;
    row.append(input, text);
    familyFieldset.appendChild(row);
    row.addEventListener('dragstart', (event) => {
      draggedFamily = family;
      event.dataTransfer?.setData('text/plain', family);
      if (event.dataTransfer !== null) event.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move';
    });
    row.addEventListener('drop', (event) => {
      event.preventDefault();
      const sourceId = draggedFamily ?? event.dataTransfer?.getData('text/plain');
      const sourceIndex = familyRows.findIndex((entry) => entry.family === sourceId);
      const targetIndex = familyRows.findIndex((entry) => entry.family === family);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
      const [source] = familyRows.splice(sourceIndex, 1);
      familyRows.splice(targetIndex, 0, source);
      for (const entry of familyRows) familyFieldset.appendChild(entry.row);
    });
    row.addEventListener('dragend', () => {
      draggedFamily = undefined;
    });
    return { family, input, row };
  });

  const restSecondsLabel = document.createElement('label');
  restSecondsLabel.style.cssText = 'display:grid;gap:6px';
  const restSecondsText = document.createElement('span');
  restSecondsText.textContent = '家族間休息秒數';
  restSecondsText.style.cssText = labelCss;
  const restSeconds = document.createElement('input');
  restSeconds.type = 'number';
  restSeconds.name = 'sessionPlanRestSeconds';
  restSeconds.min = String(restSecondsBounds.min);
  restSeconds.max = String(restSecondsBounds.max);
  restSeconds.step = 'any';
  restSeconds.value = String(Math.min(restSecondsBounds.max, Math.max(restSecondsBounds.min, DEFAULT_REST_SECONDS)));
  restSeconds.style.cssText = inputCss;
  restSecondsLabel.append(restSecondsText, restSeconds);

  const warmupRow = document.createElement('label');
  warmupRow.style.cssText = rowCss;
  const includeWarmup = document.createElement('input');
  includeWarmup.type = 'checkbox';
  includeWarmup.name = 'includeWarmup';
  includeWarmup.checked = true;
  const warmupText = document.createElement('span');
  warmupText.textContent = '在第一個家族前執行可用熱身';
  warmupRow.append(includeWarmup, warmupText);

  const status = document.createElement('p');
  status.style.cssText = statusCss;
  const submit = makeButton('開始 Session Plan', 'Start selected session plan', 'submit');
  const cancel = makeButton('取消', 'Close session plan setup', 'button');
  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display:flex;gap:8px';
  buttonRow.append(submit, cancel);
  form.append(title, desc, familyFieldset, restSecondsLabel, warmupRow, status, buttonRow);
  root.appendChild(form);
  parent.appendChild(root);

  function open(): void {
    status.textContent = '';
    root.style.display = 'flex';
  }

  function close(): void {
    root.style.display = 'none';
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const families = familyRows.filter((entry) => entry.input.checked).map((entry) => entry.family);
    if (families.length === 0) {
      status.textContent = '至少選擇一個測試家族。';
      return;
    }
    const restSecondsTextValue = restSeconds.value.trim();
    const parsedRestSeconds = Number(restSecondsTextValue);
    if (
      restSecondsTextValue === '' ||
      !Number.isFinite(parsedRestSeconds) ||
      parsedRestSeconds < restSecondsBounds.min ||
      parsedRestSeconds > restSecondsBounds.max
    ) {
      status.textContent = `休息秒數必須介於 ${restSecondsBounds.min} 到 ${restSecondsBounds.max} 秒。`;
      return;
    }
    options.onSubmit({ families, restSeconds: parsedRestSeconds, includeWarmup: includeWarmup.checked });
    close();
  });
  cancel.addEventListener('click', close);

  return { open, close, dispose: () => root.remove() };
}

function makeButton(label: string, title: string, type: 'button' | 'submit'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = type;
  button.textContent = label;
  button.title = title;
  button.style.cssText =
    'height:38px;padding:0 16px;border:1px solid rgba(255,255,255,0.18);border-radius:6px;font:750 13px/1 system-ui,sans-serif;color:#e6e9ec;background:rgba(15,18,21,0.96);cursor:pointer';
  return button;
}

const overlayCss = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,12,14,0.82);pointer-events:auto;z-index:60';
const cardCss = 'display:flex;flex-direction:column;gap:12px;max-width:min(88vw,520px);padding:20px;background:rgba(24,27,30,0.98);border:1px solid rgba(255,255,255,0.14);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,0.4);color:#edf2f7';
const headingCss = 'margin:0;font:750 18px/1.3 system-ui,sans-serif';
const descriptionCss = 'margin:0;font:500 13px/1.5 system-ui,sans-serif;color:#aeb6bf';
const labelCss = 'font:700 13px/1.4 system-ui,sans-serif';
const rowCss = 'display:flex;align-items:center;gap:8px;font:600 13px/1.4 system-ui,sans-serif';
const inputCss = 'height:36px;padding:0 8px;border:1px solid rgba(255,255,255,0.18);border-radius:6px;background:#171a1e;color:#edf2f7;font:600 13px/1 system-ui,sans-serif';
const statusCss = 'margin:0;min-height:18px;font:650 13px/1.4 system-ui,sans-serif;color:#f0c674';
