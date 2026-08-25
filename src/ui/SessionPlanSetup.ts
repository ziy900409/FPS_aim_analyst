import type { SessionPlanPreset } from '../session/sessionPlanPresets.ts';
import type { TestFamilyId } from '../session/sessionSchedule.ts';

export interface SessionPlanSelection {
  readonly families: readonly TestFamilyId[];
  readonly presetId: string;
  readonly includeWarmup: boolean;
}

export interface SessionPlanSetupOptions {
  readonly presets: readonly SessionPlanPreset[];
  readonly families: readonly TestFamilyId[];
  readonly onSubmit: (selection: SessionPlanSelection) => void;
  readonly parent?: HTMLElement;
}

export interface SessionPlanSetupHandle {
  open(): void;
  close(): void;
  dispose(): void;
}

export function createSessionPlanSetup(options: SessionPlanSetupOptions): SessionPlanSetupHandle {
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
  desc.textContent = '勾選本次要執行的測試家族；trial 與休息設定只能選已命名 preset。';
  desc.style.cssText = descriptionCss;

  const familyFieldset = document.createElement('fieldset');
  familyFieldset.style.cssText = 'border:0;padding:0;margin:0;display:grid;gap:8px';
  const legend = document.createElement('legend');
  legend.textContent = '測試家族';
  legend.style.cssText = labelCss;
  familyFieldset.appendChild(legend);
  const familyInputs = options.families.map((family) => {
    const row = document.createElement('label');
    row.style.cssText = rowCss;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'sessionFamily';
    input.value = family;
    input.checked = true;
    const text = document.createElement('span');
    text.textContent = family;
    row.append(input, text);
    familyFieldset.appendChild(row);
    return input;
  });

  const presetLabel = document.createElement('label');
  presetLabel.style.cssText = 'display:grid;gap:6px';
  const presetText = document.createElement('span');
  presetText.textContent = 'Session-plan preset';
  presetText.style.cssText = labelCss;
  const preset = document.createElement('select');
  preset.name = 'sessionPlanPreset';
  preset.style.cssText = selectCss;
  for (const presetConfig of options.presets) {
    const option = document.createElement('option');
    option.value = presetConfig.id;
    option.textContent = `${presetConfig.id}（休息 ${presetConfig.restSeconds} 秒）`;
    preset.appendChild(option);
  }
  preset.value = options.presets[0]?.id ?? '';
  presetLabel.append(presetText, preset);

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
  form.append(title, desc, familyFieldset, presetLabel, warmupRow, status, buttonRow);
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
    const families = options.families.filter((_family, index) => familyInputs[index].checked);
    if (families.length === 0) {
      status.textContent = '至少選擇一個測試家族。';
      return;
    }
    if (!options.presets.some((candidate) => candidate.id === preset.value)) {
      status.textContent = '請選擇有效的 session-plan preset。';
      return;
    }
    options.onSubmit({ families, presetId: preset.value, includeWarmup: includeWarmup.checked });
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
const selectCss = 'height:36px;padding:0 8px;border:1px solid rgba(255,255,255,0.18);border-radius:6px;background:#171a1e;color:#edf2f7;font:600 13px/1 system-ui,sans-serif';
const statusCss = 'margin:0;min-height:18px;font:650 13px/1.4 system-ui,sans-serif;color:#f0c674';
