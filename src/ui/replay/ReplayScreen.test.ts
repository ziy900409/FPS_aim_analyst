import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReplayRecording } from '../../replay/contracts.ts';
import { createReplayScreen, type ReplayScreenState } from './ReplayScreen.ts';
import type { ReplayTransportControls } from './ReplayTransport.ts';

class FakeElement {
  tag: string;
  id = '';
  title = '';
  textContent = '';
  type = '';
  value = '';
  tabIndex = 0;
  disabled = false;
  removed = false;
  focused = false;
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = { cssText: '', display: '' };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  constructor(tag = 'div') {
    this.tag = tag;
  }

  get tagName(): string {
    return this.tag.toUpperCase();
  }

  get valueAsNumber(): number {
    return Number(this.value);
  }

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children.length = 0;
    this.children.push(...children);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | undefined {
    return this.attributes.get(name);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  focus(): void {
    this.focused = true;
  }

  remove(): void {
    this.removed = true;
  }
}

class FakeDocument {
  readonly body = new FakeElement();
  activeElement: FakeElement | undefined;
  hidden = false;
  readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  createElement(tag: string): FakeElement {
    return new FakeElement(tag);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((l) => l !== listener));
  }

  dispatch(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class FakeWindow {
  readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((l) => l !== listener));
  }

  dispatch(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function flatten(node: FakeElement): FakeElement[] {
  // Mirrors real `Element.remove()` detachment for read purposes — the fake `.remove()` only flags
  // a node (no parent back-reference to splice), so traversal skips flagged children instead.
  return [node, ...node.children.filter((child) => !child.removed).flatMap(flatten)];
}

function findAll(node: FakeElement, predicate: (n: FakeElement) => boolean): FakeElement[] {
  return flatten(node).filter(predicate);
}

function findByAction(node: FakeElement, action: string): FakeElement[] {
  return findAll(node, (n) => n.dataset.replayAction === action);
}

function text(node: FakeElement): string {
  return flatten(node)
    .map((n) => n.textContent)
    .filter((t) => t.length > 0)
    .join(' ');
}

function makeRecording(): ReplayRecording {
  return {
    drillId: 'hold_click_v1',
    durationMs: 5000,
    support: { status: 'full', available: [], missing: [], reasonCodes: [] },
    ticks: [],
    tickTimes: new Float64Array(0),
    events: [],
    eventTimes: new Float64Array(0),
    weaponId: 'ak47',
  };
}

function makeReadyControls(): ReplayTransportControls {
  return { play: vi.fn(), pause: vi.fn(), seek: vi.fn(), setRate: vi.fn(), previousEvent: vi.fn(), nextEvent: vi.fn() };
}

function setup(options: Parameters<typeof createReplayScreen>[0]) {
  const document = new FakeDocument();
  const win = new FakeWindow();
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', win);
  const screen = createReplayScreen(options);
  return { document, win, screen };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createReplayScreen — state rendering', () => {
  it('loading shows a cancel action that cancels the load and returns to source', () => {
    const onBack = vi.fn();
    const onCancelLoad = vi.fn();
    const { screen } = setup({ onBack, onCancelLoad });

    screen.render({ kind: 'loading' });
    expect(text(screen.element as unknown as FakeElement)).toContain('載入中');

    findByAction(screen.element as unknown as FakeElement, 'cancel-load')[0].dispatch('click');
    expect(onCancelLoad).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('loading still returns to source when onCancelLoad is not provided', () => {
    const onBack = vi.fn();
    const { screen } = setup({ onBack });

    screen.render({ kind: 'loading' });
    findByAction(screen.element as unknown as FakeElement, 'cancel-load')[0].dispatch('click');

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('error shows the message, a retry action (when provided), and always a back action', () => {
    const onBack = vi.fn();
    const onRetry = vi.fn();
    const { screen } = setup({ onBack, onRetry });

    screen.render({ kind: 'error', message: 'scene load failed' });
    expect(text(screen.element as unknown as FakeElement)).toContain('scene load failed');

    findByAction(screen.element as unknown as FakeElement, 'retry')[0].dispatch('click');
    expect(onRetry).toHaveBeenCalledOnce();

    const backButtons = findByAction(screen.element as unknown as FakeElement, 'back');
    backButtons[backButtons.length - 1].dispatch('click');
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('error omits the retry action when onRetry is not provided', () => {
    const { screen } = setup({ onBack: vi.fn() });
    screen.render({ kind: 'error', message: 'boom' });
    const retryButton = findByAction(screen.element as unknown as FakeElement, 'retry')[0];
    expect(retryButton.style.display).toBe('none');
  });

  it('unsupported shows no playable action, only reasons and Back', () => {
    const { screen } = setup({ onBack: vi.fn() });
    screen.render({ kind: 'unsupported', sourceLabel: 'hold_click_v1 · 2026-01-01', reasonCodes: ['UNKNOWN_EXACT_DRILL'] });

    const rendered = text(screen.element as unknown as FakeElement);
    expect(rendered).toContain('此紀錄只能查看結果');
    expect(rendered).toContain('這個 drill 尚未登記重播設定檔');
    expect(findByAction(screen.element as unknown as FakeElement, 'seek')).toHaveLength(0); // no transport mounted
  });

  it('ready with full support hides the partial banner and mounts the transport', () => {
    const { screen } = setup({ onBack: vi.fn() });
    screen.render({
      kind: 'ready',
      sourceLabel: 'hold_click_v1 · 2026-01-01',
      support: { status: 'full', available: ['camera'], missing: [], reasonCodes: [] },
      recording: makeRecording(),
      controls: makeReadyControls(),
    });

    const banner = findAll(screen.element as unknown as FakeElement, (n) => n.dataset.section === 'replay-partial-banner')[0];
    expect(banner.style.display).toBe('none');
    expect(findByAction(screen.element as unknown as FakeElement, 'seek')).toHaveLength(1);
  });

  it('ready with partial support shows a persistent banner listing missing capabilities and reasons', () => {
    const { screen } = setup({ onBack: vi.fn() });
    screen.render({
      kind: 'ready',
      sourceLabel: 'hold_click_v1 · 2026-01-01',
      support: {
        status: 'partial',
        available: ['camera'],
        missing: ['target-lifecycle', 'scene'],
        reasonCodes: ['LEGACY_REPLAY_FIELDS_MISSING', 'SCENE_METADATA_MISSING'],
      },
      recording: makeRecording(),
      controls: makeReadyControls(),
    });

    const banner = findAll(screen.element as unknown as FakeElement, (n) => n.dataset.section === 'replay-partial-banner')[0];
    expect(banner.style.display).not.toBe('none');
    const rendered = text(banner);
    expect(rendered).toContain('目標生命週期');
    expect(rendered).toContain('場景');
    expect(rendered).toContain('這是舊版匯出，缺少重播所需欄位');
  });

  it('re-rendering ready (e.g. an upgraded support classification) disposes the previous transport instead of leaking it', () => {
    const { screen } = setup({ onBack: vi.fn() });
    const state = (support: 'partial' | 'full'): ReplayScreenState => ({
      kind: 'ready',
      sourceLabel: 'hold_click_v1',
      support: { status: support, available: [], missing: [], reasonCodes: [] },
      recording: makeRecording(),
      controls: makeReadyControls(),
    });

    screen.render(state('partial'));
    screen.render(state('full'));

    // Exactly one HUD/transport should be mounted in the viewport, not two stacked instances.
    const viewport = findAll(screen.element as unknown as FakeElement, (n) => n.dataset.section === 'replay-viewport')[0];
    const huds = findAll(viewport, (n) => n.dataset.section === 'replay-hud');
    expect(huds).toHaveLength(1);
    expect(findByAction(screen.element as unknown as FakeElement, 'seek')).toHaveLength(1);
  });
});

describe('createReplayScreen — visibility and focus', () => {
  it('show()/hide() toggle the root display and the visible getter', () => {
    const { screen } = setup({ onBack: vi.fn() });
    screen.render({ kind: 'loading' });

    screen.show();
    expect(screen.visible).toBe(true);
    expect((screen.element as unknown as FakeElement).style.display).toBe('flex');

    screen.hide();
    expect(screen.visible).toBe(false);
    expect((screen.element as unknown as FakeElement).style.display).toBe('none');
  });

  it('focuses the primary control for the current state once shown', () => {
    const { screen } = setup({ onBack: vi.fn() });
    screen.render({ kind: 'loading' });
    screen.show();

    const cancelButton = findByAction(screen.element as unknown as FakeElement, 'cancel-load')[0];
    expect(cancelButton.focused).toBe(true);
  });

  it('re-focuses the new state target when render() changes state kind while visible', () => {
    const { screen } = setup({ onBack: vi.fn(), onRetry: vi.fn() });
    screen.render({ kind: 'loading' });
    screen.show();

    screen.render({ kind: 'error', message: 'boom' });
    const backButtons = findByAction(screen.element as unknown as FakeElement, 'back');
    expect(backButtons.some((b) => b.focused)).toBe(true);
  });
});

describe('createReplayScreen — keyboard shortcut (Space toggles play/pause)', () => {
  it('Space toggles play/pause when focus is not on a form control, and is removed after hide()', () => {
    const { screen, win } = setup({ onBack: vi.fn() });
    const controls = makeReadyControls();
    screen.render({
      kind: 'ready',
      sourceLabel: 'x',
      support: { status: 'full', available: [], missing: [], reasonCodes: [] },
      recording: makeRecording(),
      controls,
    });
    screen.show();

    win.dispatch('keydown', { code: 'Space', target: { tagName: 'DIV' }, preventDefault: vi.fn() });
    expect(controls.play).toHaveBeenCalledOnce();

    screen.hide();
    win.dispatch('keydown', { code: 'Space', target: { tagName: 'DIV' }, preventDefault: vi.fn() });
    expect(controls.play).toHaveBeenCalledOnce(); // still just once — listener was removed on hide()
  });

  it('Space does not toggle play/pause when focus is on a form control', () => {
    const { screen, win } = setup({ onBack: vi.fn() });
    const controls = makeReadyControls();
    screen.render({
      kind: 'ready',
      sourceLabel: 'x',
      support: { status: 'full', available: [], missing: [], reasonCodes: [] },
      recording: makeRecording(),
      controls,
    });
    screen.show();

    win.dispatch('keydown', { code: 'Space', target: { tagName: 'INPUT' }, preventDefault: vi.fn() });

    expect(controls.play).not.toHaveBeenCalled();
  });
});

describe('createReplayScreen — visibility-change auto-pause', () => {
  it('pauses the active recording when the tab becomes hidden, and never auto-resumes', () => {
    const { screen, document } = setup({ onBack: vi.fn() });
    const controls = makeReadyControls();
    screen.render({
      kind: 'ready',
      sourceLabel: 'x',
      support: { status: 'full', available: [], missing: [], reasonCodes: [] },
      recording: makeRecording(),
      controls,
    });
    screen.show();

    document.hidden = true;
    document.dispatch('visibilitychange');

    expect(controls.pause).toHaveBeenCalledOnce();
  });

  it('does nothing when the tab becomes visible again (never auto-resumes)', () => {
    const { screen, document } = setup({ onBack: vi.fn() });
    const controls = makeReadyControls();
    screen.render({
      kind: 'ready',
      sourceLabel: 'x',
      support: { status: 'full', available: [], missing: [], reasonCodes: [] },
      recording: makeRecording(),
      controls,
    });
    screen.show();

    document.hidden = false;
    document.dispatch('visibilitychange');

    expect(controls.pause).not.toHaveBeenCalled();
    expect(controls.play).not.toHaveBeenCalled();
  });
});

describe('createReplayScreen — dispose', () => {
  it('removes the root element and any mounted transport', () => {
    const { screen } = setup({ onBack: vi.fn() });
    screen.render({
      kind: 'ready',
      sourceLabel: 'x',
      support: { status: 'full', available: [], missing: [], reasonCodes: [] },
      recording: makeRecording(),
      controls: makeReadyControls(),
    });

    screen.dispose();

    expect((screen.element as unknown as FakeElement).removed).toBe(true);
  });
});
