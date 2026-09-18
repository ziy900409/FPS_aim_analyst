import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConditionRecoveryScreen } from './ConditionRecoveryScreen.ts';
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
  native: true,
  fullscreen: false,
  perf: true,
  details: 'fullscreen: FAIL',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function setup(options: {
  requestFullscreen?: () => Promise<void>;
  probeWarmupP95Ms?: () => Promise<number>;
  runGate?: () => GateReport;
} = {}) {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  const onRecovered = vi.fn();
  const requestFullscreen = vi.fn(options.requestFullscreen ?? (() => Promise.resolve()));
  const probeWarmupP95Ms = vi.fn(options.probeWarmupP95Ms ?? (() => Promise.resolve(8)));
  const runGate = vi.fn(options.runGate ?? (() => PASS_REPORT));
  const handle = createConditionRecoveryScreen({
    required: { minW: 2560, minH: 1440 },
    requestFullscreen,
    probeWarmupP95Ms,
    runGate,
  });
  const root = document.created.find((el) => el.id === 'condition-recovery-screen')!;
  return {
    document,
    handle,
    onRecovered,
    requestFullscreen,
    probeWarmupP95Ms,
    runGate,
    root,
    recover: document.buttons[0],
    close: document.buttons[1],
    report: document.created.find((el) => el.tag === 'pre')!,
    status: document.created.find((el) => el.attributes.get('role') === 'status')!,
  };
}

describe('createConditionRecoveryScreen', () => {
  it('reruns fullscreen plus the three-check gate and calls onRecovered only after pass', async () => {
    const { handle, onRecovered, requestFullscreen, probeWarmupP95Ms, runGate, root, recover } = setup();
    handle.open({ onRecovered });

    recover.dispatch('click');
    await flush();

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(probeWarmupP95Ms).toHaveBeenCalledTimes(1);
    expect(runGate).toHaveBeenCalledWith(8);
    expect(onRecovered).toHaveBeenCalledWith(PASS_REPORT);
    expect(root.style.display).toBe('none');
    expect(root.attributes.get('aria-hidden')).toBe('true');
  });

  it('calls requestFullscreen synchronously inside the click stack before warmup awaits', async () => {
    let releaseFullscreen!: () => void;
    const calls: string[] = [];
    const { handle, onRecovered, recover, probeWarmupP95Ms } = setup({
      requestFullscreen: () => {
        calls.push('fullscreen');
        return new Promise<void>((resolve) => {
          releaseFullscreen = resolve;
        });
      },
      probeWarmupP95Ms: () => {
        calls.push('probe');
        return Promise.resolve(8);
      },
    });
    handle.open({ onRecovered });

    recover.dispatch('click');

    expect(calls).toEqual(['fullscreen']);
    expect(probeWarmupP95Ms).not.toHaveBeenCalled();

    releaseFullscreen();
    await flush();
    expect(calls).toEqual(['fullscreen', 'probe']);
  });

  it('rejected fullscreen request does not probe, recover, restart, advance, export, or save by proxy', async () => {
    const { handle, onRecovered, recover, probeWarmupP95Ms, runGate, status } = setup({
      requestFullscreen: () => Promise.reject(new Error('denied')),
    });
    handle.open({ onRecovered });

    recover.dispatch('click');
    await flush();

    expect(probeWarmupP95Ms).not.toHaveBeenCalled();
    expect(runGate).not.toHaveBeenCalled();
    expect(onRecovered).not.toHaveBeenCalled();
    expect(status.textContent).toContain('fullscreen');
  });

  it('failed gate shows details and does not call the recovery callback', async () => {
    const { handle, onRecovered, recover, report, root } = setup({ runGate: () => FAIL_REPORT });
    handle.open({ onRecovered });

    recover.dispatch('click');
    await flush();

    expect(onRecovered).not.toHaveBeenCalled();
    expect(report.style.display).toBe('block');
    expect(report.textContent).toContain('fullscreen: FAIL');
    expect(root.style.display).toBe('flex');
  });

  it('cancel closes without recovering', () => {
    const { handle, onRecovered, root, close } = setup();
    handle.open({ onRecovered });

    close.dispatch('click');

    expect(root.style.display).toBe('none');
    expect(onRecovered).not.toHaveBeenCalled();
  });

  it('open and retry reuse the existing DOM nodes', async () => {
    const { document, handle, onRecovered, recover } = setup({ runGate: () => FAIL_REPORT });
    const createdAfterMount = document.created.length;

    handle.open({ onRecovered });
    recover.dispatch('click');
    await flush();
    handle.open({ onRecovered });
    recover.dispatch('click');
    await flush();

    expect(document.created).toHaveLength(createdAfterMount);
  });
});

describe('WP-70 T4 condition recovery source guards', () => {
  const rawScreen = import.meta.glob<string>('./ConditionRecoveryScreen.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })['./ConditionRecoveryScreen.ts']!;
  const rawMain = import.meta.glob<string>('../main.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })['../main.ts']!;
  const stripComments = (text: string): string =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const screenSource = stripComments(rawScreen);
  const mainSource = stripComments(rawMain);

  it('calls requestFullscreen before the first await in the recovery click path', () => {
    const start = screenSource.indexOf('async function recover()');
    expect(start).toBeGreaterThan(-1);
    const body = screenSource.slice(start, screenSource.indexOf('function renderReport', start));
    const requestAt = body.indexOf('options.requestFullscreen()');
    const awaitAt = body.indexOf('await ');

    expect(requestAt).toBeGreaterThan(-1);
    expect(awaitAt).toBeGreaterThan(requestAt);
  });

  it('keeps the recovery screen decoupled from session/protocol orchestrator entry points', () => {
    for (const forbidden of ['startSessionPlan', 'startProtocol', 'sessionPlanRunner', 'downloadJSON', 'historyPersistence']) {
      expect(screenSource).not.toContain(forbidden);
    }
  });

  it('routes pause restart through recovery without advancing, completing, exporting, or saving', () => {
    const recoveryStart = mainSource.indexOf('function recoverActiveCondition()');
    expect(recoveryStart).toBeGreaterThan(-1);
    const recoveryBody = mainSource.slice(recoveryStart, mainSource.indexOf('const sessionPlanSetup', recoveryStart));

    expect(mainSource).toContain('onRestart: () => recoverActiveCondition()');
    expect(recoveryBody).toContain('conditionRecoveryScreen.open');
    expect(recoveryBody).toContain('onRecovered: () => restartActiveDrill()');
    for (const forbidden of [
      'startSessionPlan',
      'startProtocol',
      'sessionPlanRunner.start',
      'sessionPlanRunner.advance',
      'completeCurrentCondition',
      'downloadJSON',
      'historyPersistence.save',
    ]) {
      expect(recoveryBody).not.toContain(forbidden);
    }
  });
});
