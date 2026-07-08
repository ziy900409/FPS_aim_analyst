import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEligibilityGateScreen } from './EligibilityGate.ts';
import type { GateReport } from '../display/eligibilityGate.ts';

class FakeElement {
  tag: string;
  id = '';
  textContent = '';
  title = '';
  type = '';
  disabled = false;
  readonly attributes = new Map<string, string>();
  readonly style: Record<string, string> = { cssText: '', display: '' };
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, Array<() => void>>();
  removed = false;

  constructor(tag: string) {
    this.tag = tag;
  }

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  remove(): void {
    this.removed = true;
  }
}

class FakeDocument {
  readonly body = new FakeElement('body');
  readonly buttons: FakeElement[] = [];
  readonly created: FakeElement[] = [];

  createElement(tag: string): FakeElement {
    const element = new FakeElement(tag);
    this.created.push(element);
    if (tag === 'button') this.buttons.push(element);
    return element;
  }
}

const PASS_REPORT: GateReport = { pass: true, native: true, fullscreen: true, perf: true, details: 'ok' };
const FAIL_REPORT: GateReport = {
  pass: false,
  native: false,
  fullscreen: true,
  perf: true,
  details: 'native:     FAIL — 原生 1920×1080 vs 需求 2560×1440',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function setup(runGate: () => GateReport) {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  const onEnter = vi.fn();
  const handle = createEligibilityGateScreen({
    required: { minW: 2560, minH: 1440 },
    requestFullscreen: () => Promise.resolve(),
    probeWarmupP95Ms: () => Promise.resolve(8),
    runGate,
    onEnter,
  });
  const root = document.created.find((el) => el.id === 'eligibility-gate')!;
  return { document, onEnter, handle, root, start: document.buttons[0], cancel: document.buttons[1] };
}

describe('createEligibilityGateScreen', () => {
  it('enters the experiment session and hides the screen when the gate passes', async () => {
    const { handle, onEnter, root, start } = setup(() => PASS_REPORT);
    handle.open();
    expect(root.style.display).toBe('flex');

    start.dispatch('click');
    await flush();

    expect(onEnter).toHaveBeenCalledWith(PASS_REPORT);
    expect(root.style.display).toBe('none');
  });

  it('rejects with per-check reasons and offers retry when the gate fails', async () => {
    const { handle, onEnter, document, start } = setup(() => FAIL_REPORT);
    handle.open();
    start.dispatch('click');
    await flush();

    expect(onEnter).not.toHaveBeenCalled();
    const report = document.created.find((el) => el.tag === 'pre')!;
    expect(report.style.display).toBe('block');
    expect(report.textContent).toContain('✗ FAIL');
    expect(report.textContent).toContain('需求 2560×1440');
    expect(start.textContent).toBe('重試');
  });

  it('toggles the mid-session fullscreen-exit warning banner', () => {
    const { handle, document } = setup(() => PASS_REPORT);
    const banner = document.created.find((el) => el.attributes.get('role') === 'alert')!;
    expect(banner.style.display).toBe('none');
    handle.showSuspectWarning();
    expect(banner.style.display).toBe('block');
    handle.hideSuspectWarning();
    expect(banner.style.display).toBe('none');
  });

  it('cancel button closes the screen without entering a session', () => {
    const { handle, onEnter, root, cancel } = setup(() => PASS_REPORT);
    handle.open();
    cancel.dispatch('click');
    expect(root.style.display).toBe('none');
    expect(onEnter).not.toHaveBeenCalled();
  });
});
