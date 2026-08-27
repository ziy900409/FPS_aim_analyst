import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHistoryScreen } from './HistoryScreen.ts';
import type { HistoryLibraryController, HistoryLibraryState } from '../../history/HistoryLibraryController.ts';
import type { HistoryNavigator } from '../../history/navigation/HistoryNavigator.ts';
import type { HistoryRoute } from '../../history/navigation/HistoryRoute.ts';

class FakeElement {
  id = '';
  textContent = '';
  type = '';
  disabled = false;
  tabIndex = 0;
  removed = false;
  focused = false;
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = { cssText: '', display: '' };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<() => void>>();

  constructor(readonly tag: string) {}

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

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  focus(): void {
    this.focused = true;
  }

  remove(): void {
    this.removed = true;
  }
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

function flatten(node: FakeElement): FakeElement[] {
  return [node, ...node.children.flatMap(flatten)];
}

function text(node: FakeElement): string {
  return flatten(node)
    .map((n) => n.textContent)
    .filter((t) => t.length > 0)
    .join(' ');
}

function createFakeNavigator(initial: HistoryRoute | undefined) {
  let current = initial;
  const listeners = new Set<(route: HistoryRoute | undefined) => void>();
  return {
    get current() {
      return current;
    },
    push: vi.fn((route: HistoryRoute) => {
      current = route;
      for (const listener of listeners) listener(route);
    }),
    replace: vi.fn(),
    back: vi.fn(),
    close: vi.fn(() => {
      current = undefined;
      for (const listener of listeners) listener(undefined);
    }),
    saveScroll: vi.fn(),
    consumeScroll: vi.fn(() => undefined),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: vi.fn(),
    setRoute(route: HistoryRoute | undefined) {
      current = route;
      for (const listener of listeners) listener(route);
    },
  } satisfies HistoryNavigator & { setRoute(route: HistoryRoute | undefined): void };
}

const IDLE_STATE: HistoryLibraryState = {
  route: undefined,
  participants: { status: 'idle' },
  drills: { status: 'idle' },
  runs: { status: 'idle' },
  observations: { status: 'idle' },
  runDetail: { status: 'idle' },
};

function createFakeController(initial: HistoryLibraryState = IDLE_STATE): HistoryLibraryController & { setState(state: HistoryLibraryState): void } {
  let state = initial;
  const listeners = new Set<(state: HistoryLibraryState) => void>();
  return {
    get state() {
      return state;
    },
    start: vi.fn(),
    retry: vi.fn(),
    loadNextObservationPage: vi.fn(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: vi.fn(),
    setState(next) {
      state = next;
      for (const listener of listeners) listener(state);
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('createHistoryScreen — visibility follows navigator.current', () => {
  it('is hidden when the initial route is undefined (outside the namespace)', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator(undefined);
    const controller = createFakeController();
    const screen = createHistoryScreen({ navigator: navigator as never, controller });

    expect(screen.visible).toBe(false);
    expect((screen.element as unknown as FakeElement).style.display).toBe('none');
  });

  it('becomes visible once the navigator enters the namespace, and hides again on close', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator(undefined);
    const controller = createFakeController();
    const screen = createHistoryScreen({ navigator: navigator as never, controller });

    navigator.setRoute({ kind: 'participants', query: '' });
    expect(screen.visible).toBe(true);
    expect((screen.element as unknown as FakeElement).style.display).toBe('flex');

    navigator.setRoute(undefined);
    expect(screen.visible).toBe(false);
    expect((screen.element as unknown as FakeElement).style.display).toBe('none');
  });

  it('open() pushes the participants root only when not already in the namespace', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator(undefined);
    const controller = createFakeController();
    const screen = createHistoryScreen({ navigator: navigator as never, controller });

    screen.open();
    expect(navigator.push).toHaveBeenCalledWith({ kind: 'participants', query: '' });
    expect(screen.visible).toBe(true);

    navigator.push.mockClear();
    screen.open();
    expect(navigator.push).not.toHaveBeenCalled();
  });

  it('close() delegates to navigator.close()', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createFakeController();
    const screen = createHistoryScreen({ navigator: navigator as never, controller });

    screen.close();
    expect(navigator.close).toHaveBeenCalledOnce();
  });
});

describe('createHistoryScreen — breadcrumb', () => {
  it('renders the full ancestor chain with the current crumb marked aria-current and disabled', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator({ kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const controller = createFakeController();
    createHistoryScreen({ navigator: navigator as never, controller });

    const crumbs = document.created.filter((el) => el.dataset.historyCrumb !== undefined);
    expect(crumbs.map((c) => c.textContent)).toEqual(['歷史紀錄', 'p-1', 'd-1']);
    expect(crumbs[2].disabled).toBe(true);
    expect(crumbs[2].attributes.get('aria-current')).toBe('page');
    expect(crumbs[0].disabled).toBe(false);
    expect(crumbs[0].attributes.get('aria-current')).toBe('false');
  });

  it('clicking a non-current crumb navigates via navigator.push', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator({ kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const controller = createFakeController();
    createHistoryScreen({ navigator: navigator as never, controller });

    const crumbs = document.created.filter((el) => el.dataset.historyCrumb !== undefined);
    crumbs[1].dispatch('click'); // 'drills' crumb
    expect(navigator.push).toHaveBeenCalledWith({ kind: 'drills', participantId: 'p-1' });
  });

  it('is empty when there is no current route (not-found / inactive)', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator(undefined);
    const controller = createFakeController();
    const screen = createHistoryScreen({ navigator: navigator as never, controller });

    const breadcrumbNav = document.created.find((el) => el.tag === 'nav')!;
    expect(breadcrumbNav.children.length).toBe(0);
    expect(text(screen.element as unknown as FakeElement)).toContain('找不到這個歷史頁面');
  });
});

describe('createHistoryScreen — typed state rendering', () => {
  it.each<[HistoryLibraryState['participants'], string]>([
    [{ status: 'idle' }, '載入中'],
    [{ status: 'loading' }, '載入中'],
    [{ status: 'empty' }, '尚無 Participant 紀錄'],
    [{ status: 'ready', value: [{ participantId: 'p-1', drillCount: 1, runCount: 2, latestStartedAt: 'x' }] }, '共 1 筆'],
    [{ status: 'error', code: 'STORAGE_IO', message: 'disk error', retryable: true }, '讀取失敗：disk error'],
  ])('renders participants %o as %s', (participants, expectedSubstring) => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createFakeController({ ...IDLE_STATE, participants });
    const screen = createHistoryScreen({ navigator: navigator as never, controller });

    expect(text(screen.element as unknown as FakeElement)).toContain(expectedSubstring);
  });

  it('re-renders the status region when the controller publishes a new state for the same route', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createFakeController();
    const screen = createHistoryScreen({ navigator: navigator as never, controller });

    expect(text(screen.element as unknown as FakeElement)).toContain('載入中');
    controller.setState({ ...IDLE_STATE, participants: { status: 'empty' } });
    expect(text(screen.element as unknown as FakeElement)).toContain('尚無 Participant 紀錄');
  });
});

describe('createHistoryScreen — composes ParticipantBrowser/DrillBrowser per route kind (T2)', () => {
  it('shows ParticipantBrowser content and hides DrillBrowser content on a participants route', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createFakeController({
      ...IDLE_STATE,
      participants: { status: 'ready', value: [{ participantId: 'p-alpha', drillCount: 1, runCount: 2, latestStartedAt: '2026-01-01T00:00:00Z' }] },
    });
    const screen = createHistoryScreen({ navigator: navigator as never, controller });

    const participantSection = document.created.find((el) => el.dataset.section === 'participant-browser')!;
    const drillSection = document.created.find((el) => el.dataset.section === 'drill-browser')!;
    expect(participantSection.style.display).not.toBe('none');
    expect(drillSection.style.display).toBe('none');
    expect(text(screen.element as unknown as FakeElement)).toContain('p-alpha');
  });

  it('shows DrillBrowser content and hides ParticipantBrowser content on a drills route', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator({ kind: 'drills', participantId: 'p-1' });
    const controller = createFakeController({
      ...IDLE_STATE,
      drills: { status: 'ready', value: [{ drillId: 'exact-drill-1', runCount: 3, latestStartedAt: '2026-01-01T00:00:00Z' }] },
    });
    const screen = createHistoryScreen({ navigator: navigator as never, controller });

    const participantSection = document.created.find((el) => el.dataset.section === 'participant-browser')!;
    const drillSection = document.created.find((el) => el.dataset.section === 'drill-browser')!;
    expect(drillSection.style.display).not.toBe('none');
    expect(participantSection.style.display).toBe('none');
    expect(text(screen.element as unknown as FakeElement)).toContain('exact-drill-1');
  });

  it('shows DrillOverview content and hides every other route body on a drill route (T3)', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator({ kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const controller = createFakeController({
      ...IDLE_STATE,
      runs: { status: 'ready', value: [{ runId: 'r-alpha', participantId: 'p-1', drillId: 'd-1', startedAt: '2026-01-01T00:00:00Z', schemaVersion: 2, suspect: false, byteLength: 10, replaySupport: 'unchecked' }] },
    });
    const screen = createHistoryScreen({ navigator: navigator as never, controller });

    const participantSection = document.created.find((el) => el.dataset.section === 'participant-browser')!;
    const drillSection = document.created.find((el) => el.dataset.section === 'drill-browser')!;
    const overviewSection = document.created.find((el) => el.dataset.section === 'drill-overview')!;
    const detailSection = document.created.find((el) => el.dataset.section === 'historical-run-detail')!;
    expect(participantSection.style.display).toBe('none');
    expect(drillSection.style.display).toBe('none');
    expect(overviewSection.style.display).not.toBe('none');
    expect(detailSection.style.display).toBe('none');
    expect(text(screen.element as unknown as FakeElement)).toContain('r-alpha');
  });

  it('shows HistoricalRunDetail content and hides every other route body on a run route (T3)', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator({ kind: 'run', participantId: 'p-1', drillId: 'd-1', runId: 'r-1' });
    const controller = createFakeController({
      ...IDLE_STATE,
      runDetail: { status: 'empty' },
    });
    createHistoryScreen({ navigator: navigator as never, controller });

    const overviewSection = document.created.find((el) => el.dataset.section === 'drill-overview')!;
    const detailSection = document.created.find((el) => el.dataset.section === 'historical-run-detail')!;
    expect(overviewSection.style.display).toBe('none');
    expect(detailSection.style.display).not.toBe('none');
  });

  it('HistoricalRunDetail Back navigates to the parent drill route with runFilter "all"', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator({ kind: 'run', participantId: 'p-1', drillId: 'd-1', runId: 'r-1' });
    const controller = createFakeController({ ...IDLE_STATE, runDetail: { status: 'empty' } });
    createHistoryScreen({ navigator: navigator as never, controller });

    const backButton = document.created.find((el) => el.dataset.historyAction === 'back')!;
    backButton.dispatch('click');
    expect(navigator.push).toHaveBeenCalledWith({ kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
  });
});

describe('createHistoryScreen — focus management', () => {
  it('moves focus into the main landmark when the route changes', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator(undefined);
    const controller = createFakeController();
    createHistoryScreen({ navigator: navigator as never, controller });

    const main = document.created.find((el) => el.tag === 'main')!;
    expect(main.focused).toBe(false);

    navigator.setRoute({ kind: 'participants', query: '' });
    expect(main.focused).toBe(true);
  });

  it('does not refocus on a data-only re-render for the same route', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createFakeController();
    createHistoryScreen({ navigator: navigator as never, controller });

    const main = document.created.find((el) => el.tag === 'main')!;
    main.focused = false; // reset after the initial-route focus to isolate this assertion

    controller.setState({ ...IDLE_STATE, participants: { status: 'empty' } });
    expect(main.focused).toBe(false);
  });
});

describe('createHistoryScreen — accessible names', () => {
  it('every button-like control has a non-empty accessible name (textContent or aria-label)', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator({ kind: 'run', participantId: 'p-1', drillId: 'd-1', runId: 'r-1' });
    const controller = createFakeController({
      ...IDLE_STATE,
      runDetail: { status: 'error', code: 'RUN_NOT_FOUND', message: 'gone', retryable: false },
    });
    createHistoryScreen({ navigator: navigator as never, controller });

    const buttons = document.created.filter((el) => el.tag === 'button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      const accessibleName = button.textContent.length > 0 ? button.textContent : button.attributes.get('aria-label');
      expect(accessibleName ?? '').not.toBe('');
    }
  });

  it('the shell root has an accessible dialog name', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator(undefined);
    const controller = createFakeController();
    const screen = createHistoryScreen({ navigator: navigator as never, controller });

    const root = screen.element as unknown as FakeElement;
    expect(root.attributes.get('role')).toBe('dialog');
    expect(root.attributes.get('aria-label')).toBe('歷史紀錄');
  });
});

describe('createHistoryScreen — dispose', () => {
  it('stops reacting to navigator/controller updates and removes the element', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createFakeController();
    const screen = createHistoryScreen({ navigator: navigator as never, controller });

    screen.dispose();
    expect((screen.element as unknown as FakeElement).removed).toBe(true);

    navigator.setRoute({ kind: 'drills', participantId: 'p-1' });
    // No throw, and visibility no longer tracks navigator once disposed.
    expect(screen.visible).toBe(true); // last computed value before dispose; screen no longer updates
  });
});
