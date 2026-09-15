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

  it('renders the fullscreen-exit banner from the current run flag without creating another DOM node', () => {
    const { handle, document } = setup(() => PASS_REPORT);
    const createdCount = document.created.length;
    const banner = document.created.find((el) => el.attributes.get('role') === 'alert')!;

    handle.renderSuspectWarning(true);
    expect(banner.style.display).toBe('block');
    handle.renderSuspectWarning(false);
    expect(banner.style.display).toBe('none');
    expect(document.created).toHaveLength(createdCount);
  });

  // WP-70 / T6（FR-70.7）— T5.6 交棒的未結項：T3 交付了真值驅動但沒改文案。舊文案是 session 級
  // sticky 旗標的產物，在 run 級判準下對「下一場乾淨的 run」是錯的（KI-040 缺陷 A）。
  it('states run-scoped invalidity in the banner instead of session-scoped wording', () => {
    const { document } = setup(() => PASS_REPORT);
    const banner = document.created.find((el) => el.attributes.get('role') === 'alert')!;
    const text = banner.textContent ?? '';

    expect(text).not.toContain('本 session');
    expect(text).toContain('本次測試');
    expect(text).toContain('下一次測試不受影響');
    // 恢復路徑的按鈕字樣必須與 `PauseOverlay.ts` 的 `RESTART_LABEL` 逐字一致,不另造說法。
    expect(text).toContain('重新測試');
  });

  it('cancel button closes the screen without entering a session', () => {
    const { handle, onEnter, root, cancel } = setup(() => PASS_REPORT);
    handle.open();
    cancel.dispatch('click');
    expect(root.style.display).toBe('none');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('resolves a function-typed `required` freshly on each open (e.g. per-mode threshold)', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    let currentRequired = { minW: 1920, minH: 1080 };
    const handle = createEligibilityGateScreen({
      required: () => currentRequired,
      requestFullscreen: () => Promise.resolve(),
      probeWarmupP95Ms: () => Promise.resolve(8),
      runGate: () => PASS_REPORT,
      onEnter: vi.fn(),
    });
    const desc = document.created.filter((el) => el.tag === 'p')[0]!;

    handle.open();
    expect(desc.textContent).toContain('1920×1080');

    currentRequired = { minW: 2560, minH: 1440 };
    handle.open();
    expect(desc.textContent).toContain('2560×1440');
  });
});

describe('WP-70 T3 main.ts suspect banner wiring', () => {
  const raw = import.meta.glob<string>('../main.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })['../main.ts']!;
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  it('renders the banner from sharedState.validity.fullscreenExitedDuringRun', () => {
    expect(source).toContain(
      'eligibilityGateScreen.renderSuspectWarning(sharedState.validity.fullscreenExitedDuringRun)',
    );
    expect(source).not.toContain('eligibilityGateScreen.showSuspectWarning(');
    expect(source).not.toContain('eligibilityGateScreen.hideSuspectWarning(');
  });

  it('syncs after fullscreenchange updates the per-run flag', () => {
    const start = source.indexOf("document.addEventListener('fullscreenchange'");
    expect(start).toBeGreaterThan(-1);
    const handler = source.slice(start, source.indexOf('\n});', start));
    const flagAt = handler.indexOf('sharedState.validity.fullscreenExitedDuringRun = true');
    const sessionAt = handler.indexOf('experimentSession.handleFullscreenChange(fullscreen, recording)');
    const syncAt = handler.indexOf('syncFullscreenSuspectWarning()');

    expect(flagAt).toBeGreaterThan(-1);
    expect(sessionAt).toBeGreaterThan(flagAt);
    expect(syncAt).toBeGreaterThan(sessionAt);
  });

  it('syncs in the full-restart presentation reset path', () => {
    const start = source.indexOf('function resetRunPresentation()');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('function armOnPointerLock', start));
    const restartAt = body.indexOf('runAttempt.restart()');
    const syncAt = body.indexOf('syncFullscreenSuspectWarning()');

    expect(restartAt).toBeGreaterThan(-1);
    expect(syncAt).toBeGreaterThan(restartAt);
  });
});
