import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDrillBrowser } from './DrillBrowser.ts';
import type { HistoryLibraryController, HistoryLibraryState } from '../../history/HistoryLibraryController.ts';
import type { HistoryDrillSummary } from '../../history/contracts.ts';
import type { HistoryNavigator } from '../../history/navigation/HistoryNavigator.ts';

class FakeElement {
  textContent = '';
  type = '';
  title = '';
  disabled = false;
  removed = false;
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

  remove(): void {
    this.removed = true;
  }
}

class FakeDocument {
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

function createFakeNavigator(): HistoryNavigator {
  return {
    current: { kind: 'drills', participantId: 'p-1' },
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    close: vi.fn(),
    saveScroll: vi.fn(),
    consumeScroll: vi.fn(() => undefined),
    subscribe: vi.fn(() => () => {}),
    dispose: vi.fn(),
  };
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

const drillA: HistoryDrillSummary = { drillId: 'drill-a', runCount: 4, latestStartedAt: '2026-01-01T00:00:00Z' };
const drillAV2: HistoryDrillSummary = { drillId: 'drill-a-v2', runCount: 2, latestStartedAt: '2026-02-01T00:00:00Z' };

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  const navigator = createFakeNavigator();
  const controller = createFakeController();
  const browser = createDrillBrowser({ navigator, controller });
  return { document, navigator, controller, browser };
}

describe('createDrillBrowser — async status rendering', () => {
  it('idle/loading renders a loading message', () => {
    const { browser } = setup();
    browser.render({ drills: { status: 'idle' }, participantId: 'p-1' });
    expect(text(browser.element as unknown as FakeElement)).toContain('載入中');
  });

  it('empty renders a Participant-specific "no drills" message', () => {
    const { browser } = setup();
    browser.render({ drills: { status: 'empty' }, participantId: 'p-1' });
    expect(text(browser.element as unknown as FakeElement)).toContain('尚無 Assessment drill 紀錄');
  });

  it('a retryable error shows a Retry button wired to controller.retry("drills")', () => {
    const { browser, controller } = setup();
    browser.render({ drills: { status: 'error', code: 'STORAGE_IO', message: 'disk error', retryable: true }, participantId: 'p-1' });
    const element = browser.element as unknown as FakeElement;
    expect(text(element)).toContain('讀取失敗：disk error');
    const retryButton = findByTag(element, 'button').find((b) => b.textContent === '重試')!;
    retryButton.dispatch('click');
    expect(controller.retry).toHaveBeenCalledWith('drills');
  });

  it('a non-retryable error omits the Retry button', () => {
    const { browser } = setup();
    browser.render({ drills: { status: 'error', code: 'INVALID_EXPORT', message: 'bad', retryable: false }, participantId: 'p-1' });
    expect(findByTag(browser.element as unknown as FakeElement, 'button').some((b) => b.textContent === '重試')).toBe(false);
  });
});

describe('createDrillBrowser — exact grouping (D-49.P3, FR-49.3)', () => {
  it('renders two separate cards for similarly-prefixed exact drillIds — never merged', () => {
    const { browser } = setup();
    browser.render({ drills: { status: 'ready', value: [drillA, drillAV2] }, participantId: 'p-1' });
    const content = text(browser.element as unknown as FakeElement);
    expect(content).toContain('drill-a');
    expect(content).toContain('drill-a-v2');
    expect(content).toContain('共 2 筆');
  });

  it('clicking a drill card navigates via navigator.push to the exact drill route', () => {
    const { browser, navigator } = setup();
    browser.render({ drills: { status: 'ready', value: [drillA] }, participantId: 'p-1' });
    const element = browser.element as unknown as FakeElement;
    const row = findByTag(element, 'button').find((b) => b.children.some((c) => c.textContent === 'drill-a'))!;
    row.dispatch('click');
    expect(navigator.push).toHaveBeenCalledWith({ kind: 'drill', participantId: 'p-1', drillId: 'drill-a', runFilter: 'all' });
  });
});

describe('createDrillBrowser — chunked rendering', () => {
  it('renders only the first 100 rows plus a "load more" control when there are more than 100 drills', () => {
    const { browser } = setup();
    const many: HistoryDrillSummary[] = Array.from({ length: 130 }, (_, i) => ({
      drillId: `drill-${String(i).padStart(4, '0')}`,
      runCount: 1,
      latestStartedAt: '2026-01-01T00:00:00Z',
    }));
    browser.render({ drills: { status: 'ready', value: many }, participantId: 'p-1' });
    const element = browser.element as unknown as FakeElement;
    expect(findByTag(element, 'ul')[0].children.length).toBe(100);
    const loadMore = findByTag(element, 'button').find((b) => b.textContent.startsWith('顯示更多'))!;
    loadMore.dispatch('click');
    expect(findByTag(element, 'ul')[0].children.length).toBe(130);
  });
});

describe('createDrillBrowser — dispose', () => {
  it('removes the element', () => {
    const { browser } = setup();
    browser.dispose();
    expect((browser.element as unknown as FakeElement).removed).toBe(true);
  });
});
