import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_PLAN_PRESETS } from '../session/sessionPlanPresets.ts';
import { TEST_FAMILY_IDS } from '../session/sessionSchedule.ts';
import { createSessionPlanSetup } from './SessionPlanSetup.ts';

class FakeElement {
  id = '';
  textContent = '';
  title = '';
  type = '';
  name = '';
  value = '';
  checked = false;
  readonly style: Record<string, string> = { cssText: '', display: '' };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
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
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ preventDefault: vi.fn() });
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
  it('submits a freely selected family subset with a configured preset', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const onSubmit = vi.fn();
    const handle = createSessionPlanSetup({ presets: SESSION_PLAN_PRESETS, families: TEST_FAMILY_IDS, onSubmit });
    const root = document.created.find((element) => element.id === 'session-plan-setup')!;
    const inputs = document.created.filter((element) => element.tag === 'input');

    handle.open();
    expect(root.style.display).toBe('flex');
    inputs.find((input) => input.value === 'hold-track')!.checked = false;
    inputs.find((input) => input.value === 'spider-shot')!.checked = false;
    document.created.find((element) => element.tag === 'form')!.dispatch('submit');

    expect(onSubmit).toHaveBeenCalledWith({
      families: ['hold-click', 'counterstrafe'],
      presetId: 'pilot-default',
      includeWarmup: true,
    });
    expect(root.style.display).toBe('none');
  });

  it('requires at least one family and renders no numeric input', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const onSubmit = vi.fn();
    const handle = createSessionPlanSetup({ presets: SESSION_PLAN_PRESETS, families: TEST_FAMILY_IDS, onSubmit });
    handle.open();
    for (const input of document.created.filter((element) => element.name === 'sessionFamily')) input.checked = false;
    document.created.find((element) => element.tag === 'form')!.dispatch('submit');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.created.some((element) => element.type === 'number')).toBe(false);
    expect(document.created.some((element) => element.textContent.includes('至少選擇一個測試家族'))).toBe(true);
  });
});
