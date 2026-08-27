import { afterEach, describe, expect, it, vi } from 'vitest';
import { createParticipantBrowser } from './ParticipantBrowser.ts';
import type { HistoryLibraryController, HistoryLibraryState } from '../../history/HistoryLibraryController.ts';
import type { HistoryIndexReport, HistoryParticipantSummary } from '../../history/contracts.ts';
import type { HistoryNavigator } from '../../history/navigation/HistoryNavigator.ts';
import type { HistoryRoute } from '../../history/navigation/HistoryRoute.ts';

class FakeElement {
  value = '';
  placeholder = '';
  textContent = '';
  type = '';
  title = '';
  disabled = false;
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
  activeElement: FakeElement | undefined;
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

function findByTag(node: FakeElement, tag: string): FakeElement[] {
  return flatten(node).filter((n) => n.tag === tag);
}

function findByDataset(node: FakeElement, key: string, value: string): FakeElement | undefined {
  return flatten(node).find((n) => n.dataset[key] === value);
}

function createFakeNavigator(initial: HistoryRoute | undefined) {
  let current = initial;
  return {
    get current() {
      return current;
    },
    push: vi.fn(),
    replace: vi.fn((route: HistoryRoute) => {
      current = route;
    }),
    back: vi.fn(),
    close: vi.fn(),
    saveScroll: vi.fn(),
    consumeScroll: vi.fn(() => undefined),
    subscribe: vi.fn(() => () => {}),
    dispose: vi.fn(),
  } satisfies HistoryNavigator;
}

function createFakeController(): HistoryLibraryController {
  return {
    state: {} as HistoryLibraryState,
    start: vi.fn(),
    retry: vi.fn(),
    loadNextObservationPage: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    dispose: vi.fn(),
  };
}

const p1: HistoryParticipantSummary = { participantId: 'alpha-01', drillCount: 2, runCount: 5, latestStartedAt: '2026-01-01T00:00:00Z' };
const p2: HistoryParticipantSummary = { participantId: 'beta-02', drillCount: 1, runCount: 1, latestStartedAt: '2026-02-01T00:00:00Z' };

afterEach(() => vi.unstubAllGlobals());

function setup(navigatorRoute: HistoryRoute = { kind: 'participants', query: '' }) {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  const navigator = createFakeNavigator(navigatorRoute);
  const controller = createFakeController();
  const browser = createParticipantBrowser({ navigator, controller });
  return { document, navigator, controller, browser };
}

describe('createParticipantBrowser — async status rendering', () => {
  it('idle/loading renders a loading message', () => {
    const { browser } = setup();
    browser.render({ participants: { status: 'idle' }, query: '' });
    expect(text(browser.element as unknown as FakeElement)).toContain('載入中');
  });

  it('empty renders a distinct "no participants" message (not the generic empty text)', () => {
    const { browser } = setup();
    browser.render({ participants: { status: 'empty' }, query: '' });
    expect(text(browser.element as unknown as FakeElement)).toContain('尚無 Participant 紀錄');
  });

  it('a retryable error shows a Retry button wired to controller.retry("participants")', () => {
    const { browser, controller } = setup();
    browser.render({ participants: { status: 'error', code: 'STORAGE_IO', message: 'disk error', retryable: true }, query: '' });
    const element = browser.element as unknown as FakeElement;
    expect(text(element)).toContain('讀取失敗：disk error');
    const retryButton = findByTag(element, 'button').find((b) => b.textContent === '重試')!;
    retryButton.dispatch('click');
    expect(controller.retry).toHaveBeenCalledWith('participants');
  });

  it('a non-retryable error omits the Retry button', () => {
    const { browser } = setup();
    browser.render({ participants: { status: 'error', code: 'INVALID_EXPORT', message: 'bad', retryable: false }, query: '' });
    const element = browser.element as unknown as FakeElement;
    expect(findByTag(element, 'button').some((b) => b.textContent === '重試')).toBe(false);
  });

  it('ready renders a count summary and one row per participant with raw ids intact', () => {
    const { browser } = setup();
    browser.render({ participants: { status: 'ready', value: [p1, p2] }, query: '' });
    const content = text(browser.element as unknown as FakeElement);
    expect(content).toContain('共 2 筆');
    expect(content).toContain('alpha-01');
    expect(content).toContain('beta-02');
  });

  it('loading with previous data keeps showing the previous list underneath the loading message', () => {
    const { browser } = setup();
    browser.render({ participants: { status: 'loading', previous: [p1] }, query: '' });
    const content = text(browser.element as unknown as FakeElement);
    expect(content).toContain('載入中');
    expect(content).toContain('alpha-01');
  });
});

describe('createParticipantBrowser — search filtering (client-side only)', () => {
  it('filters the ready list by case-insensitive substring without mutating raw ids', () => {
    const { browser } = setup();
    browser.render({ participants: { status: 'ready', value: [p1, p2] }, query: 'ALPHA' });
    const content = text(browser.element as unknown as FakeElement);
    expect(content).toContain('alpha-01');
    expect(content).not.toContain('beta-02');
    expect(content).toContain('共 1 筆');
  });

  it('a non-empty query with zero matches renders a distinct "search empty" message', () => {
    const { browser } = setup();
    browser.render({ participants: { status: 'ready', value: [p1, p2] }, query: 'zzz-no-match' });
    expect(text(browser.element as unknown as FakeElement)).toContain('搜尋無結果');
  });

  it('typing in the search input calls navigator.replace with the participants route and the new query, not push', () => {
    const { browser, navigator } = setup();
    browser.render({ participants: { status: 'ready', value: [p1] }, query: '' });
    const input = findByTag(browser.element as unknown as FakeElement, 'input')[0];
    input.value = 'alpha';
    input.dispatch('input');
    expect(navigator.replace).toHaveBeenCalledWith({ kind: 'participants', query: 'alpha' });
    expect(navigator.push).not.toHaveBeenCalled();
  });

  it('clicking "清除搜尋" clears the query via navigator.replace', () => {
    const { browser, navigator } = setup({ kind: 'participants', query: 'alpha' });
    browser.render({ participants: { status: 'ready', value: [p1] }, query: 'alpha' });
    const element = browser.element as unknown as FakeElement;
    const clearButton = findByTag(element, 'button').find((b) => b.textContent === '清除搜尋')!;
    clearButton.dispatch('click');
    expect(navigator.replace).toHaveBeenCalledWith({ kind: 'participants', query: '' });
  });

  it('clicking a participant row navigates via navigator.push to the drills route for that raw id', () => {
    const { browser, navigator } = setup();
    browser.render({ participants: { status: 'ready', value: [p1] }, query: '' });
    const element = browser.element as unknown as FakeElement;
    const row = findByTag(element, 'button').find((b) => b.children.some((c) => c.textContent === 'alpha-01'))!;
    row.dispatch('click');
    expect(navigator.push).toHaveBeenCalledWith({ kind: 'drills', participantId: 'alpha-01' });
  });
});

describe('createParticipantBrowser — chunked rendering (NFR-49.1)', () => {
  it('renders only the first 100 rows plus a "load more" control when there are more than 100 matches', () => {
    const { browser } = setup();
    const many: HistoryParticipantSummary[] = Array.from({ length: 250 }, (_, i) => ({
      participantId: `p-${String(i).padStart(4, '0')}`,
      drillCount: 1,
      runCount: 1,
      latestStartedAt: '2026-01-01T00:00:00Z',
    }));
    browser.render({ participants: { status: 'ready', value: many }, query: '' });
    const element = browser.element as unknown as FakeElement;
    const list = findByTag(element, 'ul')[0];
    expect(list.children.length).toBe(100);
    const loadMore = findByTag(element, 'button').find((b) => b.textContent.startsWith('顯示更多'))!;
    expect(loadMore).toBeDefined();

    loadMore.dispatch('click');
    browser.render({ participants: { status: 'ready', value: many }, query: '' });
    const listAfter = findByTag(element, 'ul')[0];
    expect(listAfter.children.length).toBe(200);
  });

  it('resets the reveal cursor when the search query narrows the result set', () => {
    const { browser } = setup();
    const many: HistoryParticipantSummary[] = Array.from({ length: 150 }, (_, i) => ({
      participantId: `p-${String(i).padStart(4, '0')}`,
      drillCount: 1,
      runCount: 1,
      latestStartedAt: '2026-01-01T00:00:00Z',
    }));
    browser.render({ participants: { status: 'ready', value: many }, query: '' });
    const element = browser.element as unknown as FakeElement;
    const loadMore = findByTag(element, 'button').find((b) => b.textContent.startsWith('顯示更多'))!;
    loadMore.dispatch('click');
    browser.render({ participants: { status: 'ready', value: many }, query: '' });
    expect(findByTag(element, 'ul')[0].children.length).toBe(150);

    browser.render({ participants: { status: 'ready', value: many }, query: 'p-01' });
    expect(findByTag(element, 'ul')[0].children.length).toBeLessThanOrEqual(100);
  });
});

describe('createParticipantBrowser — health banner (OQ-49.5)', () => {
  const zeroHealth: HistoryIndexReport = { validRunCount: 10, invalidFileCount: 0, unsupportedFileCount: 0, excludedPracticeFileCount: 0, rebuiltAt: 'x' };

  it('shows nothing when health is undefined or all exclusion counts are zero', () => {
    const { browser } = setup();
    browser.render({ participants: { status: 'empty' }, query: '', health: undefined });
    let banner = findByDataset(browser.element as unknown as FakeElement, 'section', 'history-health-banner')!;
    expect(banner.style.display).toBe('none');

    browser.render({ participants: { status: 'empty' }, query: '', health: zeroHealth });
    banner = findByDataset(browser.element as unknown as FakeElement, 'section', 'history-health-banner')!;
    expect(banner.style.display).toBe('none');
  });

  it('shows a non-blocking count summary without filenames/paths when any exclusion count is non-zero', () => {
    const { browser } = setup();
    const health: HistoryIndexReport = { validRunCount: 10, invalidFileCount: 2, unsupportedFileCount: 1, excludedPracticeFileCount: 3, rebuiltAt: 'x' };
    browser.render({ participants: { status: 'empty' }, query: '', health });
    const banner = findByDataset(browser.element as unknown as FakeElement, 'section', 'history-health-banner')!;
    expect(banner.style.display).toBe('');
    expect(text(banner)).toContain('6');
    expect(text(banner)).not.toMatch(/[/\\]/); // no path separators — no filenames/paths leaked
  });
});

describe('createParticipantBrowser — accessible names and safe text', () => {
  it('the search input has a non-empty accessible name', () => {
    const { browser } = setup();
    const input = findByTag(browser.element as unknown as FakeElement, 'input')[0];
    expect(input.attributes.get('aria-label')).toBeTruthy();
  });

  it('a participant id containing angle brackets is rendered via textContent, not executed as markup', () => {
    const { browser } = setup();
    const hostile: HistoryParticipantSummary = { participantId: '<img src=x onerror=alert(1)>', drillCount: 1, runCount: 1, latestStartedAt: '2026-01-01T00:00:00Z' };
    browser.render({ participants: { status: 'ready', value: [hostile] }, query: '' });
    expect(text(browser.element as unknown as FakeElement)).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('createParticipantBrowser — dispose', () => {
  it('removes the element', () => {
    const { browser } = setup();
    browser.dispose();
    expect((browser.element as unknown as FakeElement).removed).toBe(true);
  });
});
