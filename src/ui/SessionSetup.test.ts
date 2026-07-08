import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionSetupForm, displaySelfReportFromSessionSetup } from './SessionSetup.ts';

class FakeElement {
  id = '';
  textContent = '';
  title = '';
  type = '';
  name = '';
  value = '';
  min = '';
  max = '';
  step = '';
  required = false;
  checked = false;
  removed = false;
  readonly style: Record<string, string> = { cssText: '', display: '' };
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, Array<(event: { preventDefault(): void }) => void>>();

  constructor(readonly tag: string) {}

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: (event: { preventDefault(): void }) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string): void {
    const event = { preventDefault: vi.fn() };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  remove(): void {
    this.removed = true;
  }
}

class FakeDocument {
  readonly body = new FakeElement('body');
  readonly created: FakeElement[] = [];
  readonly forms: FakeElement[] = [];
  readonly inputs: FakeElement[] = [];

  createElement(tag: string): FakeElement {
    const element = new FakeElement(tag);
    this.created.push(element);
    if (tag === 'form') this.forms.push(element);
    if (tag === 'input') this.inputs.push(element);
    return element;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  const onSubmit = vi.fn();
  const handle = createSessionSetupForm({
    getDetectedDisplay: () => ({ screenW: 2560, screenH: 1440 }),
    onSubmit,
  });
  const root = document.created.find((el) => el.id === 'session-setup')!;
  const input = (name: string) => document.inputs.find((el) => el.name === name)!;
  return { document, handle, onSubmit, root, input };
}

describe('createSessionSetupForm', () => {
  it('submits trimmed session identifiers and optional display self-report fields', () => {
    const { document, handle, input, onSubmit, root } = setup();
    handle.open();
    expect(root.style.display).toBe('flex');
    expect(document.created.some((el) => el.textContent.includes('2560×1440'))).toBe(true);

    input('participantId').value = ' P001 ';
    input('sessionLabel').value = ' day-1 ';
    input('monitorModel').value = ' BenQ XL ';
    input('nativeW').value = '2560';
    input('nativeH').value = '1440';
    input('panelInches').value = '24.5';
    input('viewingDistanceCm').value = '60';
    document.forms[0].dispatch('submit');

    expect(onSubmit).toHaveBeenCalledWith({
      participantId: 'P001',
      sessionLabel: 'day-1',
      monitorModel: 'BenQ XL',
      nativeW: 2560,
      nativeH: 1440,
      panelInches: 24.5,
      viewingDistanceCm: 60,
    });
    expect(root.style.display).toBe('none');
  });

  it('requires participantId but keeps display self-report fields optional', () => {
    const { document, handle, onSubmit, root } = setup();
    handle.open();
    document.forms[0].dispatch('submit');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(root.style.display).toBe('flex');
    expect(document.created.some((el) => el.textContent.includes('Participant ID 必填'))).toBe(true);
  });

  it('records the uncertain checkbox without requiring display hardware fields', () => {
    const { document, handle, input, onSubmit } = setup();
    handle.open();
    input('participantId').value = 'P002';
    input('selfReportUncertain').checked = true;
    document.forms[0].dispatch('submit');

    expect(onSubmit).toHaveBeenCalledWith({
      participantId: 'P002',
      selfReportUncertain: true,
    });
  });

  it('rejects out-of-range numeric self-report fields', () => {
    const { document, handle, input, onSubmit, root } = setup();
    handle.open();
    input('participantId').value = 'P003';
    input('nativeW').value = '12.5';
    document.forms[0].dispatch('submit');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(root.style.display).toBe('flex');
    expect(document.created.some((el) => el.textContent.includes('Native width'))).toBe(true);
  });
});

describe('displaySelfReportFromSessionSetup', () => {
  it('marks nativeMismatch only when self-reported native size disagrees with automatic screenxdpr', () => {
    expect(
      displaySelfReportFromSessionSetup(
        { participantId: 'P001', nativeW: 1920, nativeH: 1080, selfReportUncertain: true },
        { screenW: 2560, screenH: 1440 },
      ),
    ).toEqual({
      nativeW: 1920,
      nativeH: 1080,
      selfReportUncertain: true,
      nativeMismatch: true,
    });

    expect(
      displaySelfReportFromSessionSetup(
        { participantId: 'P001', nativeW: 2560, nativeH: 1440 },
        { screenW: 2560, screenH: 1440 },
      ),
    ).toEqual({ nativeW: 2560, nativeH: 1440, nativeMismatch: false });
  });
});
