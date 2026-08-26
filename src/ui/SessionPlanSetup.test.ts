import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEST_FAMILY_IDS } from '../session/sessionSchedule.ts';
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
  checked = false;
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

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
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

afterEach(() => vi.unstubAllGlobals());

describe('createSessionPlanSetup', () => {
  it('submits a freely selected family subset in dragged order with a free rest duration', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const onSubmit = vi.fn();
    const handle = createSessionPlanSetup({ families: TEST_FAMILY_IDS, onSubmit });
    const root = document.created.find((element) => element.id === 'session-plan-setup')!;
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
    document.created.find((element) => element.name === 'sessionPlanRestSeconds')!.value = '42.5';
    document.created.find((element) => element.tag === 'form')!.dispatch('submit');

    expect(onSubmit).toHaveBeenCalledWith({
      families: ['counterstrafe', 'hold-click'],
      restSeconds: 42.5,
      includeWarmup: true,
    });
    expect(root.style.display).toBe('none');
  });

  it('requires at least one family and renders a bounded numeric rest input', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const onSubmit = vi.fn();
    const handle = createSessionPlanSetup({ families: TEST_FAMILY_IDS, onSubmit });
    handle.open();
    for (const input of document.created.filter((element) => element.name === 'sessionFamily')) input.checked = false;
    document.created.find((element) => element.tag === 'form')!.dispatch('submit');

    expect(onSubmit).not.toHaveBeenCalled();
    const restInput = document.created.find((element) => element.name === 'sessionPlanRestSeconds')!;
    expect(restInput).toMatchObject({ type: 'number', min: '0', max: '3600', step: 'any', value: '60' });
    expect(document.created.some((element) => element.textContent.includes('至少選擇一個測試家族'))).toBe(true);
  });

  it.each(['', '-1', '3600.1', 'not-a-number'])('rejects an invalid rest duration: %j', (value) => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const onSubmit = vi.fn();
    createSessionPlanSetup({ families: TEST_FAMILY_IDS, onSubmit });
    document.created.find((element) => element.name === 'sessionPlanRestSeconds')!.value = value;

    document.created.find((element) => element.tag === 'form')!.dispatch('submit');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.created.some((element) => element.textContent.includes('休息秒數必須介於 0 到 3600 秒'))).toBe(
      true,
    );
  });
});
