import {
  DECLARED_WEAPON_BY_DRILL_ID,
  FAMILY_BY_DRILL_ID,
  SCHEDULABLE_DRILL_IDS,
} from '../session/drillFamily.ts';
import {
  compileSessionProgram,
  SessionProgramCompileError,
  summarizeProgram,
  type ProgramStep,
  type SessionProgramItem,
} from '../session/sessionProgram.ts';
import type { SessionFamilyId } from '../session/sessionSchedule.ts';
import { WEAPONS, type WeaponId } from '../weapon/weapons.ts';
import { describeBoundary } from './programBoundaryLabel.ts';

/**
 * WP-58 T4 — what the operator submitted, as a discriminated union over the two tracks (D-58-P4).
 *
 * The frozen arm is the pre-WP-58 payload, unchanged in shape and meaning: a counterbalanced family
 * order, one global rest, and the warmup opt-in. The custom arm carries the flat `(drillId, reps)`
 * list and the two rest durations instead — it has no `includeWarmup`, because on that track a
 * warmup simply *is* the first item (FR-58.17).
 */
export type SessionPlanSelection =
  | {
      readonly mode: 'frozen';
      readonly families: readonly SessionFamilyId[];
      readonly restSeconds: number;
      readonly includeWarmup: boolean;
    }
  | {
      readonly mode: 'custom';
      readonly items: readonly SessionProgramItem[];
      readonly drillRestSeconds: number;
      readonly familyRestSeconds: number;
    };

export interface SessionPlanSetupOptions {
  /** WP-52 T2: widened from TestFamilyId so operators can freely include 'peek-click-transfer'. */
  readonly families: readonly SessionFamilyId[];
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
const DEFAULT_DRILL_REST_SECONDS = 30;
const DEFAULT_REST_SECONDS_BOUNDS = { min: 0, max: 3600 } as const;

interface DrillGroup {
  readonly family: SessionFamilyId;
  readonly drillIds: readonly string[];
}

interface EditableSessionProgramItem {
  drillId: string;
  reps: number;
  weaponId?: WeaponId;
}

/**
 * The roster is 36 drills, so a flat menu is unusable (WP-58 §3.2 debt). `SCHEDULABLE_DRILL_IDS` is
 * already emitted in family order, so grouping is one pass and introduces no second ordering rule.
 */
function groupSchedulableDrills(): readonly DrillGroup[] {
  const groups: { family: SessionFamilyId; drillIds: string[] }[] = [];
  for (const drillId of SCHEDULABLE_DRILL_IDS) {
    const family = FAMILY_BY_DRILL_ID.get(drillId);
    if (family === undefined) continue;
    const last = groups.at(-1);
    if (last !== undefined && last.family === family) last.drillIds.push(drillId);
    else groups.push({ family, drillIds: [drillId] });
  }
  return groups;
}

/** Header copy only — `summarizeProgram()` owns the number, this owns how it reads. */
function formatRestTotal(seconds: number): string {
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return minutes > 0 ? `${minutes} 分 ${String(rest).padStart(2, '0')} 秒` : `${rest} 秒`;
}

function sessionProgramItemFromEditable(item: EditableSessionProgramItem): SessionProgramItem {
  return {
    drillId: item.drillId,
    reps: item.reps,
    ...(item.weaponId === undefined ? {} : { weaponId: item.weaponId }),
  };
}

function previewWeaponId(step: ProgramStep): string | undefined {
  if (step.kind !== 'run') return undefined;
  return step.weaponId ?? DECLARED_WEAPON_BY_DRILL_ID.get(step.drillId) ?? 'default';
}

function previewWeaponLabel(step: ProgramStep): string {
  if (step.kind !== 'run') return '';
  return step.weaponId ?? DECLARED_WEAPON_BY_DRILL_ID.get(step.drillId) ?? '預設';
}

function describeStep(step: ProgramStep, index: number): string {
  if (step.kind === 'run') {
    const warmup = step.warmup === true ? ' · 熱身' : '';
    return `${index + 1}. ▶ ${step.drillId} (${step.repIndex + 1}/${step.repCount}) · 武器 ${previewWeaponLabel(step)}${warmup}`;
  }
  return `${index + 1}. ⏸ ${step.seconds}s · ${describeBoundary(step.boundary)} → ${step.nextDrillId}`;
}

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

  function makeSecondsInput(name: string, ariaLabel: string, defaultValue: number): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.name = name;
    input.min = String(restSecondsBounds.min);
    input.max = String(restSecondsBounds.max);
    input.step = 'any';
    input.value = String(Math.min(restSecondsBounds.max, Math.max(restSecondsBounds.min, defaultValue)));
    input.setAttribute('aria-label', ariaLabel);
    input.style.cssText = inputCss;
    return input;
  }

  const form = document.createElement('form');
  form.style.cssText = cardCss;
  const title = document.createElement('h2');
  title.textContent = 'Session Plan';
  title.style.cssText = headingCss;
  const desc = document.createElement('p');
  desc.textContent =
    '標準 Assessment 走凍結的家族協定；自訂 program 可自由編排 drill 清單、每項重複次數與兩級休息秒數。';
  desc.style.cssText = descriptionCss;

  // ---- mode switch (FR-58.12) -----------------------------------------------------------------
  const modeFieldset = document.createElement('fieldset');
  modeFieldset.style.cssText = fieldsetCss;
  const modeLegend = document.createElement('legend');
  modeLegend.textContent = '模式';
  modeLegend.style.cssText = labelCss;
  modeFieldset.appendChild(modeLegend);
  const modeInputs = (
    [
      ['frozen', '標準 Assessment（凍結協定）'],
      ['custom', '自訂 program'],
    ] as const
  ).map(([value, text]) => {
    const row = document.createElement('label');
    row.style.cssText = rowCss;
    row.setAttribute('data-plan-mode', value);
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'sessionPlanMode';
    input.value = value;
    input.checked = value === 'frozen';
    const caption = document.createElement('span');
    caption.textContent = text;
    row.append(input, caption);
    modeFieldset.appendChild(row);
    input.addEventListener('change', () => {
      if (input.checked) applyMode(value);
    });
    return { value, input };
  });

  // ---- frozen track (behaviour unchanged, FR-58.10) --------------------------------------------
  const frozenSection = document.createElement('div');
  frozenSection.setAttribute('data-plan-section', 'frozen');
  frozenSection.style.cssText = sectionCss;
  const familyFieldset = document.createElement('fieldset');
  familyFieldset.style.cssText = fieldsetCss;
  const legend = document.createElement('legend');
  legend.textContent = '測試家族';
  legend.style.cssText = labelCss;
  familyFieldset.appendChild(legend);
  let draggedFamily: SessionFamilyId | undefined;
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
  restSecondsLabel.style.cssText = fieldCss;
  const restSecondsText = document.createElement('span');
  restSecondsText.textContent = '家族間休息秒數';
  restSecondsText.style.cssText = labelCss;
  const restSeconds = makeSecondsInput('sessionPlanRestSeconds', '家族間休息秒數', DEFAULT_REST_SECONDS);
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
  frozenSection.append(familyFieldset, restSecondsLabel, warmupRow);

  // ---- custom track (FR-58.12 / FR-58.13) ------------------------------------------------------
  const customSection = document.createElement('div');
  customSection.setAttribute('data-plan-section', 'custom');
  customSection.style.cssText = sectionCss;
  customSection.style.display = 'none';

  const pickerRow = document.createElement('div');
  pickerRow.style.cssText = 'display:flex;gap:8px;align-items:flex-end';
  const pickerLabel = document.createElement('label');
  pickerLabel.style.cssText = `${fieldCss};flex:1`;
  const pickerText = document.createElement('span');
  pickerText.textContent = '可排程 drill';
  pickerText.style.cssText = labelCss;
  const picker = document.createElement('select');
  picker.name = 'sessionPlanDrill';
  picker.setAttribute('aria-label', '可排程 drill');
  picker.style.cssText = inputCss;
  const drillGroups = groupSchedulableDrills();
  for (const group of drillGroups) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.family;
    for (const drillId of group.drillIds) {
      const option = document.createElement('option');
      option.value = drillId;
      option.textContent = drillId;
      optgroup.appendChild(option);
    }
    picker.appendChild(optgroup);
  }
  picker.value = drillGroups[0]?.drillIds[0] ?? '';
  pickerLabel.append(pickerText, picker);
  const addButton = makeButton('加入', 'Add the selected drill to the program', 'button');
  pickerRow.append(pickerLabel, addButton);

  const itemList = document.createElement('ol');
  itemList.setAttribute('data-program-items', '');
  itemList.setAttribute('aria-label', '執行清單');
  itemList.style.cssText = 'list-style:none;margin:0;padding:0;display:grid;gap:6px';

  const drillRestLabel = document.createElement('label');
  drillRestLabel.style.cssText = fieldCss;
  const drillRestText = document.createElement('span');
  drillRestText.textContent = 'drill 休息秒數（同一 drill 下一輪／同家族換 drill）';
  drillRestText.style.cssText = labelCss;
  const drillRestSeconds = makeSecondsInput(
    'sessionPlanDrillRestSeconds',
    'drill 休息秒數',
    DEFAULT_DRILL_REST_SECONDS,
  );
  drillRestLabel.append(drillRestText, drillRestSeconds);

  const familyRestLabel = document.createElement('label');
  familyRestLabel.style.cssText = fieldCss;
  const familyRestText = document.createElement('span');
  familyRestText.textContent = '家族休息秒數（換家族）';
  familyRestText.style.cssText = labelCss;
  const familyRestSeconds = makeSecondsInput('sessionPlanFamilyRestSeconds', '家族休息秒數', DEFAULT_REST_SECONDS);
  familyRestLabel.append(familyRestText, familyRestSeconds);

  const preview = document.createElement('section');
  preview.setAttribute('data-program-preview', '');
  preview.setAttribute('aria-live', 'polite');
  preview.setAttribute('aria-label', '程式預覽');
  preview.style.cssText = previewCss;
  const previewSummary = document.createElement('p');
  previewSummary.setAttribute('data-program-preview-summary', '');
  previewSummary.style.cssText = labelCss;
  const previewSteps = document.createElement('ol');
  previewSteps.setAttribute('data-program-preview-steps', '');
  previewSteps.style.cssText = 'list-style:none;margin:0;padding:0;display:grid;gap:2px';
  preview.append(previewSummary, previewSteps);
  const weaponNotes = document.createElement('div');
  weaponNotes.style.cssText = descriptionCss;
  const noReloadNote = document.createElement('p');
  noReloadNote.textContent =
    '無玩家 reload：每次目標生成會補滿彈匣；若連續打空仍會停火，受測者的「按住」意圖會被記成放開。';
  noReloadNote.style.cssText = 'margin:0';
  const trendNote = document.createElement('p');
  trendNote.textContent =
    '不同武器的 run 不會併入同一條趨勢線（相容鍵含 weaponId）——逐列換武器會讓 history 趨勢分群。';
  trendNote.style.cssText = 'margin:0';
  weaponNotes.append(noReloadNote, trendNote);
  customSection.append(pickerRow, itemList, weaponNotes, drillRestLabel, familyRestLabel, preview);

  const status = document.createElement('p');
  status.setAttribute('role', 'alert');
  status.style.cssText = statusCss;
  const submit = makeButton('開始 Session Plan', 'Start selected session plan', 'submit');
  const cancel = makeButton('取消', 'Close session plan setup', 'button');
  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display:flex;gap:8px';
  buttonRow.append(submit, cancel);
  form.append(title, desc, modeFieldset, frozenSection, customSection, status, buttonRow);
  root.appendChild(form);
  parent.appendChild(root);

  // ---- custom program state --------------------------------------------------------------------
  const items: EditableSessionProgramItem[] = [];
  let mode: 'frozen' | 'custom' = 'frozen';
  /** The last successful compile. `undefined` means the plan must not be submittable (FR-58.7). */
  let compiled: readonly ProgramStep[] | undefined;
  let draggedItemIndex: number | undefined;

  function moveItem(from: number, to: number): void {
    if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return;
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    renderItems();
  }

  function renderItems(): void {
    const rows = items.map((item, index) => {
      const row = document.createElement('li');
      row.setAttribute('data-program-item', String(index));
      row.setAttribute('data-drill-id', item.drillId);
      row.draggable = true;
      row.style.cssText = itemRowCss;
      const handle = document.createElement('span');
      handle.textContent = '⋮⋮';
      const name = document.createElement('span');
      name.textContent = item.drillId;
      name.style.cssText = 'flex:1';
      const reps = document.createElement('input');
      reps.type = 'number';
      reps.name = 'sessionPlanReps';
      reps.min = '1';
      reps.step = '1';
      reps.value = String(item.reps);
      reps.setAttribute('aria-label', `${item.drillId} 重複次數`);
      reps.style.cssText = `${inputCss};width:72px`;
      // Only the preview is rebuilt on input: re-rendering the row here would destroy the very
      // field being typed into, which in a real browser means losing focus on every keystroke.
      reps.addEventListener('input', () => {
        item.reps = Number(reps.value.trim());
        refreshPreview();
      });
      const weapon = document.createElement('select');
      weapon.name = 'sessionPlanWeapon';
      weapon.value = item.weaponId ?? '';
      weapon.setAttribute('aria-label', `${item.drillId} 武器`);
      weapon.style.cssText = `${inputCss};width:176px`;
      const defaultWeapon = document.createElement('option');
      defaultWeapon.value = '';
      defaultWeapon.textContent = '—（drill 預設）';
      weapon.appendChild(defaultWeapon);
      for (const [weaponId, config] of Object.entries(WEAPONS) as Array<[WeaponId, (typeof WEAPONS)[WeaponId]]>) {
        const option = document.createElement('option');
        option.value = weaponId;
        option.textContent = `${weaponId}（${config.magSize} 發）`;
        weapon.appendChild(option);
      }
      weapon.addEventListener('change', () => {
        item.weaponId = weapon.value === '' ? undefined : (weapon.value as WeaponId);
        refreshPreview();
      });
      const up = makeIconButton('▲', `${item.drillId} 上移`);
      up.addEventListener('click', () => moveItem(index, index - 1));
      const down = makeIconButton('▼', `${item.drillId} 下移`);
      down.addEventListener('click', () => moveItem(index, index + 1));
      const remove = makeIconButton('✕', `移除 ${item.drillId}`);
      remove.addEventListener('click', () => {
        items.splice(index, 1);
        renderItems();
      });
      row.append(handle, name, reps, weapon, up, down, remove);
      row.addEventListener('dragstart', (event) => {
        draggedItemIndex = index;
        event.dataTransfer?.setData('text/plain', String(index));
        if (event.dataTransfer !== null) event.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragover', (event) => {
        event.preventDefault();
        if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move';
      });
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        const source = draggedItemIndex ?? Number(event.dataTransfer?.getData('text/plain'));
        moveItem(source, index);
      });
      row.addEventListener('dragend', () => {
        draggedItemIndex = undefined;
      });
      return row;
    });
    itemList.replaceChildren(...rows);
    refreshPreview();
  }

  function readBoundedSeconds(input: HTMLInputElement): number | undefined {
    const text = input.value.trim();
    const parsed = Number(text);
    if (
      text === '' ||
      !Number.isFinite(parsed) ||
      parsed < restSecondsBounds.min ||
      parsed > restSecondsBounds.max
    ) {
      return undefined;
    }
    return parsed;
  }

  function markInvalidItem(itemIndex: number | undefined): void {
    for (const row of Array.from(itemList.children)) {
      const index = Number(row.getAttribute('data-program-item'));
      if (itemIndex !== undefined && index === itemIndex) row.setAttribute('data-invalid', 'true');
      else row.removeAttribute('data-invalid');
    }
  }

  function setCompileFailure(message: string, itemIndex?: number): void {
    compiled = undefined;
    submit.disabled = true;
    status.textContent = message;
    previewSummary.textContent = '預覽不可用';
    previewSteps.replaceChildren();
    markInvalidItem(itemIndex);
  }

  /**
   * FR-58.13. The preview renders *the compiled program*, never a re-derivation: if the UI worked
   * out boundaries itself there would be two definitions of the rest model, and the operator could
   * approve a schedule the runner would not actually run.
   */
  function refreshPreview(): void {
    if (mode !== 'custom') return;
    const drillRest = readBoundedSeconds(drillRestSeconds);
    const familyRest = readBoundedSeconds(familyRestSeconds);
    if (drillRest === undefined || familyRest === undefined) {
      setCompileFailure(`休息秒數必須介於 ${restSecondsBounds.min} 到 ${restSecondsBounds.max} 秒。`);
      return;
    }
    let program: readonly ProgramStep[];
    try {
      program = compileSessionProgram({
        items: items.map(sessionProgramItemFromEditable),
        drillRestSeconds: drillRest,
        familyRestSeconds: familyRest,
      });
    } catch (error) {
      if (error instanceof SessionProgramCompileError) setCompileFailure(error.message, error.itemIndex);
      else setCompileFailure(error instanceof Error ? error.message : String(error));
      return;
    }
    compiled = program;
    submit.disabled = false;
    status.textContent = '';
    markInvalidItem(undefined);
    const summary = summarizeProgram(program);
    previewSummary.textContent = `預覽（${program.length} 步 · 執行 ${summary.runCount} 輪 · 休息合計 ${formatRestTotal(summary.totalRestSeconds)}）`;
    previewSteps.replaceChildren(
      ...program.map((step, index) => {
        const line = document.createElement('li');
        line.setAttribute('data-program-step', step.kind);
        if (step.kind === 'rest') {
          line.setAttribute('data-step-boundary', step.boundary);
          line.setAttribute('data-step-next-drill-id', step.nextDrillId);
        } else {
          line.setAttribute('data-step-drill-id', step.drillId);
          line.setAttribute('data-step-weapon-id', previewWeaponId(step) ?? '');
        }
        line.textContent = describeStep(step, index);
        line.style.cssText = step.kind === 'rest' ? previewRestCss : previewRunCss;
        return line;
      }),
    );
  }

  function applyMode(next: 'frozen' | 'custom'): void {
    mode = next;
    for (const entry of modeInputs) entry.input.checked = entry.value === next;
    frozenSection.style.display = next === 'frozen' ? 'grid' : 'none';
    customSection.style.display = next === 'custom' ? 'grid' : 'none';
    if (next === 'frozen') {
      // The frozen track compiles nothing here, so it can never be blocked by a preview failure.
      compiled = undefined;
      submit.disabled = false;
      status.textContent = '';
    } else {
      refreshPreview();
    }
  }

  addButton.addEventListener('click', () => {
    const drillId = picker.value;
    if (drillId === '' || !FAMILY_BY_DRILL_ID.has(drillId)) return;
    items.push({ drillId, reps: 1 });
    renderItems();
  });
  drillRestSeconds.addEventListener('input', refreshPreview);
  familyRestSeconds.addEventListener('input', refreshPreview);

  function open(): void {
    status.textContent = '';
    root.style.display = 'flex';
    applyMode(mode);
  }

  function close(): void {
    root.style.display = 'none';
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (mode === 'custom') {
      // Recompile rather than trusting the cached result: what the operator approved in the preview
      // is then literally what starts, and a plan that cannot compile cannot be submitted at all.
      refreshPreview();
      if (compiled === undefined) return;
      options.onSubmit({
        mode: 'custom',
        items: items.map(sessionProgramItemFromEditable),
        drillRestSeconds: Number(drillRestSeconds.value.trim()),
        familyRestSeconds: Number(familyRestSeconds.value.trim()),
      });
      close();
      return;
    }
    const families = familyRows.filter((entry) => entry.input.checked).map((entry) => entry.family);
    if (families.length === 0) {
      status.textContent = '至少選擇一個測試家族。';
      return;
    }
    const parsedRestSeconds = readBoundedSeconds(restSeconds);
    if (parsedRestSeconds === undefined) {
      status.textContent = `休息秒數必須介於 ${restSecondsBounds.min} 到 ${restSecondsBounds.max} 秒。`;
      return;
    }
    options.onSubmit({
      mode: 'frozen',
      families,
      restSeconds: parsedRestSeconds,
      includeWarmup: includeWarmup.checked,
    });
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

/** Reorder/remove controls are real buttons, so the whole list is operable by keyboard (NFR-58.7). */
function makeIconButton(glyph: string, ariaLabel: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = glyph;
  button.title = ariaLabel;
  button.setAttribute('aria-label', ariaLabel);
  button.style.cssText =
    'height:28px;min-width:28px;padding:0 6px;border:1px solid rgba(255,255,255,0.18);border-radius:6px;font:700 12px/1 system-ui,sans-serif;color:#e6e9ec;background:rgba(15,18,21,0.96);cursor:pointer';
  return button;
}

const overlayCss = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,12,14,0.82);pointer-events:auto;z-index:60';
const cardCss = 'display:flex;flex-direction:column;gap:12px;max-width:min(88vw,620px);max-height:88vh;overflow:auto;padding:20px;background:rgba(24,27,30,0.98);border:1px solid rgba(255,255,255,0.14);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,0.4);color:#edf2f7';
const headingCss = 'margin:0;font:750 18px/1.3 system-ui,sans-serif';
const descriptionCss = 'margin:0;font:500 13px/1.5 system-ui,sans-serif;color:#aeb6bf';
const labelCss = 'font:700 13px/1.4 system-ui,sans-serif';
const rowCss = 'display:flex;align-items:center;gap:8px;font:600 13px/1.4 system-ui,sans-serif';
const fieldCss = 'display:grid;gap:6px';
const fieldsetCss = 'border:0;padding:0;margin:0;display:grid;gap:8px';
const sectionCss = 'display:grid;gap:12px';
const itemRowCss = 'display:flex;align-items:center;gap:8px;padding:4px 6px;border:1px solid rgba(255,255,255,0.12);border-radius:6px;font:600 13px/1.4 system-ui,sans-serif';
const previewCss = 'display:grid;gap:6px;max-height:240px;overflow:auto;padding:8px;border:1px solid rgba(255,255,255,0.12);border-radius:6px;background:rgba(15,18,21,0.6)';
const previewRunCss = 'font:600 12px/1.5 ui-monospace,SFMono-Regular,monospace;color:#edf2f7';
const previewRestCss = 'font:600 12px/1.5 ui-monospace,SFMono-Regular,monospace;color:#aeb6bf';
const inputCss = 'height:36px;padding:0 8px;border:1px solid rgba(255,255,255,0.18);border-radius:6px;background:#171a1e;color:#edf2f7;font:600 13px/1 system-ui,sans-serif';
const statusCss = 'margin:0;min-height:18px;font:650 13px/1.4 system-ui,sans-serif;color:#f0c674';
