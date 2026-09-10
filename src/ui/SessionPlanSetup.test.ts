import { afterEach, describe, expect, it, vi } from 'vitest';
import { FAMILY_BY_DRILL_ID, SCHEDULABLE_DRILL_IDS } from '../session/drillFamily.ts';
import { compileSessionProgram, summarizeProgram } from '../session/sessionProgram.ts';
import {
  KNOWN_SESSION_FAMILY_IDS,
  TEST_FAMILY_IDS,
  type SessionFamilyId,
} from '../session/sessionSchedule.ts';
import { WEAPONS } from '../weapon/weapons.ts';
import { createSessionPlanSetup } from './SessionPlanSetup.ts';

interface FakeEvent {
  preventDefault(): void;
  dataTransfer?: FakeDataTransfer;
}

class FakeDataTransfer {
  effectAllowed = '';
  dropEffect = '';
  private readonly data = new Map<string, string>();

  setData(type: string, value: string): void {
    this.data.set(type, value);
  }

  getData(type: string): string {
    return this.data.get(type) ?? '';
  }
}

class FakeElement {
  id = '';
  textContent = '';
  title = '';
  type = '';
  name = '';
  value = '';
  label = '';
  checked = false;
  disabled = false;
  draggable = false;
  min = '';
  max = '';
  step = '';
  readonly style: Record<string, string> = { cssText: '', display: '' };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: FakeEvent) => void>>();

  constructor(readonly tag: string) {}

  append(...children: FakeElement[]): void {
    for (const child of children) this.appendChild(child);
  }

  appendChild(child: FakeElement): void {
    const currentIndex = this.children.indexOf(child);
    if (currentIndex >= 0) this.children.splice(currentIndex, 1);
    this.children.push(child);
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children.splice(0, this.children.length, ...children);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  addEventListener(type: string, listener: (event: FakeEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string, event: Partial<FakeEvent> = {}): void {
    const resolved = { preventDefault: vi.fn(), ...event };
    for (const listener of this.listeners.get(type) ?? []) listener(resolved);
  }

  remove(): void {}
}

class FakeDocument {
  readonly body = new FakeElement('body');
  readonly created: FakeElement[] = [];

  createElement(tag: string): FakeElement {
    const element = new FakeElement(tag);
    this.created.push(element);
    return element;
  }
}

/** Three drills in three distinct families — the shape WP-58's golden scenario is defined over. */
const DRILL_A = 'hold_click_v1';
const DRILL_B = 'spider-shot-v2';
const DRILL_C = 'counterstrafe-reversal-v1';

interface Harness {
  readonly document: FakeDocument;
  readonly handle: ReturnType<typeof createSessionPlanSetup>;
  readonly root: FakeElement;
  readonly onSubmit: ReturnType<typeof vi.fn>;
  readonly form: FakeElement;
  readonly submit: FakeElement;
  readonly status: FakeElement;
  readonly picker: FakeElement;
  readonly addButton: FakeElement;
  readonly itemList: FakeElement;
  readonly previewSummary: FakeElement;
  readonly previewSteps: FakeElement;
  readonly drillRest: FakeElement;
  readonly familyRest: FakeElement;
}

function byName(document: FakeDocument, name: string): FakeElement {
  const found = document.created.find((element) => element.name === name);
  if (found === undefined) throw new Error(`no element named ${name}`);
  return found;
}

function byAttribute(document: FakeDocument, attribute: string): FakeElement {
  const found = document.created.find((element) => element.attributes.has(attribute));
  if (found === undefined) throw new Error(`no element with ${attribute}`);
  return found;
}

function byAriaLabel(document: FakeDocument, label: string): FakeElement {
  const found = document.created.find((element) => element.attributes.get('aria-label') === label);
  if (found === undefined) throw new Error(`no element labelled ${label}`);
  return found;
}

function mount(families: readonly SessionFamilyId[] = TEST_FAMILY_IDS): Harness {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  const onSubmit = vi.fn();
  const handle = createSessionPlanSetup({ families, onSubmit });
  return {
    document,
    handle,
    root: document.created.find((element) => element.id === 'session-plan-setup')!,
    onSubmit,
    form: document.created.find((element) => element.tag === 'form')!,
    submit: document.created.find((element) => element.type === 'submit')!,
    status: document.created.find((element) => element.attributes.get('role') === 'alert')!,
    picker: byName(document, 'sessionPlanDrill'),
    addButton: document.created.find((element) => element.textContent === '加入')!,
    itemList: byAttribute(document, 'data-program-items'),
    previewSummary: byAttribute(document, 'data-program-preview-summary'),
    previewSteps: byAttribute(document, 'data-program-preview-steps'),
    drillRest: byName(document, 'sessionPlanDrillRestSeconds'),
    familyRest: byName(document, 'sessionPlanFamilyRestSeconds'),
  };
}

function selectMode(document: FakeDocument, mode: 'frozen' | 'custom'): void {
  const input = document.created.find(
    (element) => element.name === 'sessionPlanMode' && element.value === mode,
  )!;
  input.checked = true;
  input.dispatch('change');
}

function addItem(harness: Harness, drillId: string, reps?: number): void {
  harness.picker.value = drillId;
  harness.addButton.dispatch('click');
  if (reps === undefined) return;
  setReps(harness, harness.itemList.children.length - 1, String(reps));
}

/** Row controls are looked up positionally: [handle, name, reps, weapon, up, down, remove]. */
function rowControl(
  harness: Harness,
  index: number,
  control: 'reps' | 'weapon' | 'up' | 'down' | 'remove',
): FakeElement {
  const offsets = { reps: 2, weapon: 3, up: 4, down: 5, remove: 6 } as const;
  return harness.itemList.children[index].children[offsets[control]];
}

function setReps(harness: Harness, index: number, value: string): void {
  const input = rowControl(harness, index, 'reps');
  input.value = value;
  input.dispatch('input');
}

function setWeapon(harness: Harness, index: number, value: string): FakeElement {
  const select = rowControl(harness, index, 'weapon');
  select.value = value;
  select.dispatch('change');
  return select;
}

function itemDrillIds(harness: Harness): string[] {
  return harness.itemList.children.map((row) => row.attributes.get('data-drill-id') ?? '');
}

afterEach(() => vi.unstubAllGlobals());

describe('createSessionPlanSetup — frozen track (unchanged behaviour)', () => {
  it('submits a freely selected family subset in dragged order with a free rest duration', () => {
    const { document, onSubmit, form, handle, root } = mount();
    const inputs = document.created.filter((element) => element.tag === 'input');

    handle.open();
    expect(root.style.display).toBe('flex');
    const transfer = new FakeDataTransfer();
    const counterstrafeRow = document.created.find(
      (element) => element.attributes.get('data-session-family') === 'counterstrafe',
    )!;
    const holdClickRow = document.created.find(
      (element) => element.attributes.get('data-session-family') === 'hold-click',
    )!;
    counterstrafeRow.dispatch('dragstart', { dataTransfer: transfer });
    holdClickRow.dispatch('dragover', { dataTransfer: transfer });
    holdClickRow.dispatch('drop', { dataTransfer: transfer });
    inputs.find((input) => input.value === 'hold-track')!.checked = false;
    inputs.find((input) => input.value === 'spider-shot')!.checked = false;
    byName(document, 'sessionPlanRestSeconds').value = '42.5';
    form.dispatch('submit');

    expect(onSubmit).toHaveBeenCalledWith({
      mode: 'frozen',
      families: ['counterstrafe', 'hold-click'],
      restSeconds: 42.5,
      includeWarmup: true,
    });
    expect(root.style.display).toBe('none');
  });

  it('requires at least one family and renders a bounded numeric rest input', () => {
    const { document, onSubmit, form } = mount();
    for (const input of document.created.filter((element) => element.name === 'sessionFamily')) input.checked = false;
    form.dispatch('submit');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(byName(document, 'sessionPlanRestSeconds')).toMatchObject({
      type: 'number',
      min: '0',
      max: '3600',
      step: 'any',
      value: '60',
    });
    expect(document.created.some((element) => element.textContent.includes('至少選擇一個測試家族'))).toBe(true);
  });

  it.each(['', '-1', '3600.1', 'not-a-number'])('rejects an invalid rest duration: %j', (value) => {
    const { document, onSubmit, form } = mount();
    byName(document, 'sessionPlanRestSeconds').value = value;

    form.dispatch('submit');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.created.some((element) => element.textContent.includes('休息秒數必須介於 0 到 3600 秒'))).toBe(
      true,
    );
  });

  it.each(['0', '3600'])('accepts an inclusive rest boundary: %s', (value) => {
    const { document, onSubmit, form } = mount();
    byName(document, 'sessionPlanRestSeconds').value = value;

    form.dispatch('submit');

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ mode: 'frozen', restSeconds: Number(value) }));
  });

  it('lets an operator freely include the peek-click-transfer pilot family alongside the frozen four (WP-52 T2)', () => {
    const { document, onSubmit, form } = mount([...KNOWN_SESSION_FAMILY_IDS]);

    const familyCheckboxes = document.created.filter((element) => element.name === 'sessionFamily');
    expect(familyCheckboxes.map((input) => input.value)).toEqual([
      'hold-click',
      'hold-track',
      'spider-shot',
      'counterstrafe',
      'peek-click-transfer',
      'peek-click-transfer-v1',
      // WP-58 T1: the four schedulable construct families are additive members of the same
      // KI-016 allowlist, so they appear here for free. Offering them does not make them
      // assessments — that stays gated by DrillConfig.mode + the exact-id metric registry.
      'tracking',
      'detection',
      'micro-flick',
      'spider-shot-wide',
    ]);
    for (const input of familyCheckboxes) {
      input.checked =
        input.value === 'hold-click' || input.value === 'counterstrafe' || input.value === 'peek-click-transfer';
    }
    form.dispatch('submit');

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ families: ['hold-click', 'counterstrafe', 'peek-click-transfer'] }),
    );
  });

  it('hides the custom editor while frozen is selected and never blocks its submit button', () => {
    const harness = mount();
    const frozenSection = harness.document.created.find(
      (element) => element.attributes.get('data-plan-section') === 'frozen',
    )!;
    const customSection = harness.document.created.find(
      (element) => element.attributes.get('data-plan-section') === 'custom',
    )!;

    expect(frozenSection.style.display).not.toBe('none');
    expect(customSection.style.display).toBe('none');

    // An empty custom list fails to compile, but switching back must not leave frozen unsubmittable.
    selectMode(harness.document, 'custom');
    expect(customSection.style.display).toBe('grid');
    expect(harness.submit.disabled).toBe(true);
    selectMode(harness.document, 'frozen');
    expect(frozenSection.style.display).toBe('grid');
    expect(customSection.style.display).toBe('none');
    expect(harness.submit.disabled).toBe(false);
  });
});

describe('createSessionPlanSetup — custom program editing (FR-58.12)', () => {
  it('offers every schedulable drill grouped by family, and nothing outside the roster', () => {
    const harness = mount();
    const optgroups = harness.picker.children;
    const familyOrder: string[] = [];
    const offered: string[] = [];
    for (const group of optgroups) {
      familyOrder.push(group.label);
      for (const option of group.children) offered.push(option.value);
    }

    expect(offered).toEqual([...SCHEDULABLE_DRILL_IDS]);
    expect(offered).toHaveLength(36);
    expect(new Set(familyOrder).size).toBe(familyOrder.length);
    expect(familyOrder.every((family) => KNOWN_SESSION_FAMILY_IDS.has(family as SessionFamilyId))).toBe(true);
    for (const drillId of offered) expect(FAMILY_BY_DRILL_ID.has(drillId)).toBe(true);
  });

  it('adds the picked drill with reps defaulting to 1 and ignores an unregistered id', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');

    addItem(harness, DRILL_A);
    addItem(harness, DRILL_B);
    expect(itemDrillIds(harness)).toEqual([DRILL_A, DRILL_B]);
    expect(rowControl(harness, 0, 'reps').value).toBe('1');

    harness.picker.value = 'counterstrafe-cued-v1'; // off-roster: exists as a module, not schedulable
    harness.addButton.dispatch('click');
    expect(itemDrillIds(harness)).toEqual([DRILL_A, DRILL_B]);
  });

  it('reorders with the up/down buttons and removes a row', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    addItem(harness, DRILL_A);
    addItem(harness, DRILL_B);
    addItem(harness, DRILL_C);

    rowControl(harness, 2, 'up').dispatch('click');
    expect(itemDrillIds(harness)).toEqual([DRILL_A, DRILL_C, DRILL_B]);
    rowControl(harness, 0, 'down').dispatch('click');
    expect(itemDrillIds(harness)).toEqual([DRILL_C, DRILL_A, DRILL_B]);

    // Boundaries are inert rather than wrapping — an operator holding ▲ must not rotate the list.
    rowControl(harness, 0, 'up').dispatch('click');
    rowControl(harness, 2, 'down').dispatch('click');
    expect(itemDrillIds(harness)).toEqual([DRILL_C, DRILL_A, DRILL_B]);

    rowControl(harness, 1, 'remove').dispatch('click');
    expect(itemDrillIds(harness)).toEqual([DRILL_C, DRILL_B]);
  });

  it('reorders by drag as well as by button', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    addItem(harness, DRILL_A);
    addItem(harness, DRILL_B);
    addItem(harness, DRILL_C);

    const transfer = new FakeDataTransfer();
    const source = harness.itemList.children[2];
    const target = harness.itemList.children[0];
    source.dispatch('dragstart', { dataTransfer: transfer });
    target.dispatch('dragover', { dataTransfer: transfer });
    target.dispatch('drop', { dataTransfer: transfer });

    expect(itemDrillIds(harness)).toEqual([DRILL_C, DRILL_A, DRILL_B]);
  });

  it('submits the compiled custom plan and closes', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    addItem(harness, DRILL_A, 3);
    addItem(harness, DRILL_B, 2);
    harness.drillRest.value = '30';
    harness.drillRest.dispatch('input');
    harness.familyRest.value = '60';
    harness.familyRest.dispatch('input');

    harness.form.dispatch('submit');

    expect(harness.onSubmit).toHaveBeenCalledWith({
      mode: 'custom',
      items: [
        { drillId: DRILL_A, reps: 3 },
        { drillId: DRILL_B, reps: 2 },
      ],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(harness.root.style.display).toBe('none');
  });

  it('renders one weapon picker per item with the WEAPONS list and magazine sizes', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    addItem(harness, DRILL_A);
    addItem(harness, DRILL_B);

    const weaponSelects = harness.itemList.children.map((_, index) => rowControl(harness, index, 'weapon'));
    expect(weaponSelects).toHaveLength(2);
    for (const select of weaponSelects) {
      expect(select.tag).toBe('select');
      expect(select.children).toHaveLength(Object.keys(WEAPONS).length + 1);
      expect(select.children[0]).toMatchObject({ value: '', textContent: '—（drill 預設）' });
      expect(select.children.map((option) => option.textContent)).toContain('usp_s_laser（12 發）');
      expect(select.children.map((option) => option.textContent)).toContain('ak47（30 發）');
    }
  });

  it('updates preview weapon attributes without rerendering the edited row', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    addItem(harness, DRILL_A, 2);
    const row = harness.itemList.children[0];
    const select = rowControl(harness, 0, 'weapon');

    setWeapon(harness, 0, 'm4a1s');

    expect(harness.itemList.children[0]).toBe(row);
    expect(rowControl(harness, 0, 'weapon')).toBe(select);
    expect(
      harness.previewSteps.children
        .filter((line) => line.attributes.get('data-program-step') === 'run')
        .map((line) => line.attributes.get('data-step-weapon-id')),
    ).toEqual(['m4a1s', 'm4a1s']);
    expect(harness.previewSteps.children[0].textContent).toContain('武器 m4a1s');
  });

  it('submits per-item weapon ids and omits the key for drill defaults', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    addItem(harness, DRILL_A, 3);
    addItem(harness, DRILL_B, 2);
    setWeapon(harness, 0, 'm4a1s');

    harness.form.dispatch('submit');

    expect(harness.onSubmit).toHaveBeenCalledWith({
      mode: 'custom',
      items: [
        { drillId: DRILL_A, reps: 3, weaponId: 'm4a1s' },
        { drillId: DRILL_B, reps: 2 },
      ],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    const submitted = harness.onSubmit.mock.calls[0]![0] as { items: Array<Record<string, unknown>> };
    expect(Object.hasOwn(submitted.items[1], 'weaponId')).toBe(false);
  });

  it('explains reload/ammo behaviour and weapon-based trend grouping before submission', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');

    expect(harness.document.created.some((element) => element.textContent.includes('無玩家 reload'))).toBe(true);
    expect(harness.document.created.some((element) => element.textContent.includes('目標生成會補滿彈匣'))).toBe(
      true,
    );
    expect(harness.document.created.some((element) => element.textContent.includes('趨勢分群'))).toBe(true);
  });
});

describe('createSessionPlanSetup — program preview (FR-58.13)', () => {
  it('renders the WP-58 golden 17-step program exactly as the compiler emits it', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    for (const drillId of [DRILL_A, DRILL_B, DRILL_C]) addItem(harness, drillId, 3);
    harness.drillRest.value = '30';
    harness.drillRest.dispatch('input');
    harness.familyRest.value = '60';
    harness.familyRest.dispatch('input');

    const expected = compileSessionProgram({
      items: [
        { drillId: DRILL_A, reps: 3 },
        { drillId: DRILL_B, reps: 3 },
        { drillId: DRILL_C, reps: 3 },
      ],
      drillRestSeconds: 30,
      familyRestSeconds: 60,
    });
    expect(expected).toHaveLength(17);
    expect(summarizeProgram(expected)).toEqual({ runCount: 9, totalRestSeconds: 300 });

    // The preview is a rendering *of the compiled program*, not a second derivation of the rest
    // model: every row is checked against the compiler's own step, kind for kind.
    expect(harness.previewSteps.children).toHaveLength(17);
    expect(harness.previewSteps.children.map((line) => line.attributes.get('data-program-step'))).toEqual(
      expected.map((step) => step.kind),
    );
    expect(
      harness.previewSteps.children
        .filter((line) => line.attributes.get('data-program-step') === 'rest')
        .map((line) => [line.attributes.get('data-step-boundary'), line.attributes.get('data-step-next-drill-id')]),
    ).toEqual(
      expected.filter((step) => step.kind === 'rest').map((step) => [step.boundary, step.nextDrillId]),
    );
    expect(harness.previewSummary.textContent).toBe('預覽（17 步 · 執行 9 輪 · 休息合計 5 分 00 秒）');
    expect(harness.previewSteps.children[0].textContent).toBe(`1. ▶ ${DRILL_A} (1/3) · 武器 預設`);
    expect(harness.previewSteps.children[1].textContent).toBe('2. ⏸ 30s · rep（同一 drill 下一輪） → hold_click_v1');
    expect(harness.previewSteps.children[5].textContent).toBe(
      '6. ⏸ 60s · family（換家族） → spider-shot-v2',
    );
    expect(harness.previewSteps.children[16].textContent).toBe(`17. ▶ ${DRILL_C} (3/3) · 武器 預設`);
  });

  it('shows the drill boundary label when two adjacent items share a family (R-58.8)', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    addItem(harness, 'spider-shot-v2');
    addItem(harness, 'spider-shot-v3');
    harness.drillRest.value = '30';
    harness.drillRest.dispatch('input');
    harness.familyRest.value = '60';
    harness.familyRest.dispatch('input');

    // Same family, so the seam takes the *drill* rest (30 s), not the family rest the operator may
    // have assumed — which is precisely what the preview exists to surface before the session runs.
    expect(harness.previewSteps.children[1].textContent).toBe(
      '2. ⏸ 30s · drill（同家族換 drill） → spider-shot-v3',
    );
    expect(harness.previewSummary.textContent).toBe('預覽（3 步 · 執行 2 輪 · 休息合計 30 秒）');
  });

  it('shows declared BR weapons in the preview when the item leaves weapon at drill default', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    addItem(harness, 'tracking_br_v1__ads_off__hitscan__0p5deg');

    expect(harness.previewSteps.children[0].attributes.get('data-step-weapon-id')).toBe('ak47_br_hip_hitscan');
    expect(harness.previewSteps.children[0].textContent).toContain('武器 ak47_br_hip_hitscan');
  });

  it('omits a zero-second rest instead of rendering a step that would flash for one frame', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    addItem(harness, DRILL_A, 3);
    harness.drillRest.value = '0';
    harness.drillRest.dispatch('input');

    expect(harness.previewSteps.children.map((line) => line.attributes.get('data-program-step'))).toEqual([
      'run',
      'run',
      'run',
    ]);
    expect(harness.previewSummary.textContent).toBe('預覽（3 步 · 執行 3 輪 · 休息合計 0 秒）');
  });
});

describe('createSessionPlanSetup — compile failures disable submit (FR-58.7)', () => {
  it('blocks an empty program with the compiler’s own message', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');

    expect(harness.submit.disabled).toBe(true);
    expect(harness.status.textContent).toContain('items 不得為空');
    expect(harness.previewSummary.textContent).toBe('預覽不可用');
    harness.form.dispatch('submit');
    expect(harness.onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    ['0', 0],
    ['-1', 0],
    ['1.5', 0],
    ['', 0],
    ['not-a-number', 0],
  ])('rejects reps %j and marks the offending row', (value, itemIndex) => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    addItem(harness, DRILL_A);
    addItem(harness, DRILL_B);
    setReps(harness, itemIndex, value);

    expect(harness.submit.disabled).toBe(true);
    expect(harness.status.textContent).toContain(`items[${itemIndex}].reps`);
    expect(harness.status.textContent).toContain('必須為 >= 1 的整數');
    expect(harness.itemList.children[itemIndex].attributes.get('data-invalid')).toBe('true');
    expect(harness.itemList.children[1 - itemIndex].attributes.has('data-invalid')).toBe(false);
    expect(harness.previewSteps.children).toHaveLength(0);

    harness.form.dispatch('submit');
    expect(harness.onSubmit).not.toHaveBeenCalled();

    // Recovering clears both the block and the row marker.
    setReps(harness, itemIndex, '2');
    expect(harness.submit.disabled).toBe(false);
    expect(harness.status.textContent).toBe('');
    expect(harness.itemList.children[itemIndex].attributes.has('data-invalid')).toBe(false);
  });

  it.each([
    ['drillRest', '-1'],
    ['drillRest', '3600.1'],
    ['drillRest', ''],
    ['familyRest', 'not-a-number'],
    ['familyRest', '-0.5'],
  ] as const)('rejects an out-of-bounds %s value %j', (field, value) => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    addItem(harness, DRILL_A);
    const input = field === 'drillRest' ? harness.drillRest : harness.familyRest;
    input.value = value;
    input.dispatch('input');

    expect(harness.submit.disabled).toBe(true);
    expect(harness.status.textContent).toBe('休息秒數必須介於 0 到 3600 秒。');
    harness.form.dispatch('submit');
    expect(harness.onSubmit).not.toHaveBeenCalled();
  });

  it('blocks overriding a BR cell weapon with row-local feedback from the compiler', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    addItem(harness, DRILL_A);
    addItem(harness, 'tracking_br_v1__ads_off__hitscan__0p5deg');

    setWeapon(harness, 1, 'm4a1s');

    expect(harness.submit.disabled).toBe(true);
    expect(harness.status.textContent).toContain('items[1].weaponId');
    expect(harness.status.textContent).toContain('不可指定其他武器');
    expect(harness.itemList.children[1].attributes.get('data-invalid')).toBe('true');
    expect(harness.itemList.children[0].attributes.has('data-invalid')).toBe(false);
    harness.form.dispatch('submit');
    expect(harness.onSubmit).not.toHaveBeenCalled();
  });
});

describe('createSessionPlanSetup — keyboard and ARIA (NFR-58.7)', () => {
  it('exposes an accessible name on every custom-track control', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    addItem(harness, DRILL_A);

    expect(harness.picker.attributes.get('aria-label')).toBe('可排程 drill');
    expect(harness.drillRest.attributes.get('aria-label')).toBe('drill 休息秒數');
    expect(harness.familyRest.attributes.get('aria-label')).toBe('家族休息秒數');
    expect(byName(harness.document, 'sessionPlanRestSeconds').attributes.get('aria-label')).toBe('家族間休息秒數');
    expect(harness.itemList.attributes.get('aria-label')).toBe('執行清單');
    expect(rowControl(harness, 0, 'reps').attributes.get('aria-label')).toBe(`${DRILL_A} 重複次數`);
    expect(rowControl(harness, 0, 'weapon').attributes.get('aria-label')).toBe(`${DRILL_A} 武器`);
    expect(rowControl(harness, 0, 'up').attributes.get('aria-label')).toBe(`${DRILL_A} 上移`);
    expect(rowControl(harness, 0, 'down').attributes.get('aria-label')).toBe(`${DRILL_A} 下移`);
    expect(rowControl(harness, 0, 'remove').attributes.get('aria-label')).toBe(`移除 ${DRILL_A}`);
  });

  it('announces errors and the preview to assistive technology', () => {
    const harness = mount();
    const preview = byAttribute(harness.document, 'data-program-preview');

    expect(harness.status.attributes.get('role')).toBe('alert');
    expect(preview.attributes.get('aria-live')).toBe('polite');
    expect(byAriaLabel(harness.document, '程式預覽')).toBe(preview);
  });

  it('completes add → reorder → reps → submit through focusable controls only, without any drag', () => {
    const harness = mount();
    // Mode is chosen with a radio; every custom control below is a native button/input/select, so
    // the whole flow is reachable by Tab + Space/Enter with no pointer gesture anywhere.
    selectMode(harness.document, 'custom');
    addItem(harness, DRILL_A);
    addItem(harness, DRILL_B);
    rowControl(harness, 1, 'up').dispatch('click');
    setReps(harness, 0, '2');
    harness.familyRest.value = '45';
    harness.familyRest.dispatch('input');
    harness.form.dispatch('submit');

    expect(harness.onSubmit).toHaveBeenCalledWith({
      mode: 'custom',
      items: [
        { drillId: DRILL_B, reps: 2 },
        { drillId: DRILL_A, reps: 1 },
      ],
      drillRestSeconds: 30,
      familyRestSeconds: 45,
    });
    for (const row of harness.itemList.children) {
      for (const control of row.children.slice(2)) {
        expect(['input', 'select', 'button']).toContain(control.tag);
        expect(control.attributes.get('aria-label')).toBeTruthy();
      }
    }
  });
});

describe('createSessionPlanSetup — preview redraw cost (NFR-58.4)', () => {
  it('redraws a 400-run preview well inside the 50 ms budget', () => {
    const harness = mount();
    selectMode(harness.document, 'custom');
    // 20 items x 20 reps = 400 runs, 399 rests = 799 steps: the ceiling NFR-58.4 is written against.
    for (let i = 0; i < 20; i++) addItem(harness, SCHEDULABLE_DRILL_IDS[i], 20);
    expect(harness.previewSteps.children).toHaveLength(799);

    const samples: number[] = [];
    for (let i = 0; i < 20; i++) harness.familyRest.dispatch('input'); // warm
    for (let i = 0; i < 100; i++) {
      const started = performance.now();
      harness.familyRest.dispatch('input');
      samples.push(performance.now() - started);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1] ?? 0;
    console.log(
      `[WP-58 T4 perf] preview redraw(799 steps): samples=${samples.length} p95=${p95.toFixed(4)}ms max=${samples.at(-1)?.toFixed(4)}ms`,
    );
    expect(p95).toBeLessThan(50);
  });
});
