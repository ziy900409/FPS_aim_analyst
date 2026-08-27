import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDrillOverview } from './DrillOverview.ts';
import type { HistoryLibraryController, HistoryLibraryState } from '../../history/HistoryLibraryController.ts';
import type { HistoryRunSummary } from '../../history/contracts.ts';
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
    current: { kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'all' },
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

const runA: HistoryRunSummary = {
  runId: 'run-a',
  participantId: 'p-1',
  drillId: 'd-1',
  startedAt: '2026-01-02T00:00:00Z',
  schemaVersion: 2,
  suspect: false,
  byteLength: 100,
  replaySupport: 'unchecked',
};
const runB: HistoryRunSummary = { ...runA, runId: 'run-b', startedAt: '2026-01-01T00:00:00Z', suspect: true };

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  const navigator = createFakeNavigator();
  const controller = createFakeController();
  const overview = createDrillOverview({ navigator, controller });
  return { document, navigator, controller, overview };
}

describe('createDrillOverview — async status rendering (runFilter=all)', () => {
  it('idle/loading renders a loading message', () => {
    const { overview } = setup();
    overview.render({ runs: { status: 'idle' }, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    expect(text(overview.element as unknown as FakeElement)).toContain('載入中');
  });

  it('empty renders a drill-specific "no runs" message', () => {
    const { overview } = setup();
    overview.render({ runs: { status: 'empty' }, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    expect(text(overview.element as unknown as FakeElement)).toContain('尚無 Assessment run 紀錄');
  });

  it('a retryable error shows a Retry button wired to controller.retry("runs")', () => {
    const { overview, controller } = setup();
    overview.render({ runs: { status: 'error', code: 'STORAGE_IO', message: 'disk error', retryable: true }, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const element = overview.element as unknown as FakeElement;
    expect(text(element)).toContain('讀取失敗：disk error');
    const retryButton = findByTag(element, 'button').find((b) => b.textContent === '重試')!;
    retryButton.dispatch('click');
    expect(controller.retry).toHaveBeenCalledWith('runs');
  });

  it('a non-retryable error omits the Retry button', () => {
    const { overview } = setup();
    overview.render({ runs: { status: 'error', code: 'INVALID_EXPORT', message: 'bad', retryable: false }, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    expect(findByTag(overview.element as unknown as FakeElement, 'button').some((b) => b.textContent === '重試')).toBe(false);
  });
});

describe('createDrillOverview — run ordering and navigation (FR-49.4)', () => {
  it('renders runs in the order the controller already provides them (startedAt desc, server-sorted) without re-sorting', () => {
    const { overview } = setup();
    overview.render({ runs: { status: 'ready', value: [runA, runB] }, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const element = overview.element as unknown as FakeElement;
    const rows = findByTag(element, 'ul')[0].children;
    expect(flatten(rows[0]).some((c) => c.textContent === 'run-a')).toBe(true);
    expect(flatten(rows[1]).some((c) => c.textContent === 'run-b')).toBe(true);
    expect(text(element)).toContain('共 2 筆');
  });

  it('clicking a run navigates via navigator.push to the run route', () => {
    const { overview, navigator } = setup();
    overview.render({ runs: { status: 'ready', value: [runA] }, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const element = overview.element as unknown as FakeElement;
    const row = findByTag(element, 'button').find((b) => b.children.some((c) => c.textContent === 'run-a'))!;
    row.dispatch('click');
    expect(navigator.push).toHaveBeenCalledWith({ kind: 'run', participantId: 'p-1', drillId: 'd-1', runId: 'run-a' });
  });

  it('marks a suspect run in its row text', () => {
    const { overview } = setup();
    overview.render({ runs: { status: 'ready', value: [runB] }, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    expect(text(overview.element as unknown as FakeElement)).toContain('suspect');
  });
});

describe('createDrillOverview — runFilter (T3 Steps §4)', () => {
  it('clicking a filter button navigates via navigator.replace with the same participant/drill and the new runFilter', () => {
    const { overview, navigator } = setup();
    overview.render({ runs: { status: 'ready', value: [runA] }, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const element = overview.element as unknown as FakeElement;
    const eligibleButton = findByTag(element, 'button').find((b) => b.dataset.runFilter === 'trend-eligible')!;
    eligibleButton.dispatch('click');
    expect(navigator.replace).toHaveBeenCalledWith({ kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'trend-eligible' });
  });

  it('shows a pending-analysis notice instead of the run list for trend-eligible/excluded (no metric registry until T4)', () => {
    const { overview } = setup();
    overview.render({ runs: { status: 'ready', value: [runA] }, participantId: 'p-1', drillId: 'd-1', runFilter: 'trend-eligible' });
    expect(text(overview.element as unknown as FakeElement)).toContain('尚未提供');
  });

  it('marks the active filter button aria-pressed=true', () => {
    const { overview } = setup();
    overview.render({ runs: { status: 'empty' }, participantId: 'p-1', drillId: 'd-1', runFilter: 'excluded' });
    const element = overview.element as unknown as FakeElement;
    const excludedButton = findByTag(element, 'button').find((b) => b.dataset.runFilter === 'excluded')!;
    const allButton = findByTag(element, 'button').find((b) => b.dataset.runFilter === 'all')!;
    expect(excludedButton.attributes.get('aria-pressed')).toBe('true');
    expect(allButton.attributes.get('aria-pressed')).toBe('false');
  });
});

describe('createDrillOverview — chunked rendering', () => {
  it('renders only the first 100 rows plus a "load more" control when there are more than 100 runs', () => {
    const { overview } = setup();
    const many: HistoryRunSummary[] = Array.from({ length: 130 }, (_, i) => ({
      ...runA,
      runId: `run-${String(i).padStart(4, '0')}`,
    }));
    overview.render({ runs: { status: 'ready', value: many }, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const element = overview.element as unknown as FakeElement;
    expect(findByTag(element, 'ul')[0].children.length).toBe(100);
    const loadMore = findByTag(element, 'button').find((b) => b.textContent.startsWith('顯示更多'))!;
    loadMore.dispatch('click');
    expect(findByTag(element, 'ul')[0].children.length).toBe(130);
  });
});

describe('createDrillOverview — dispose', () => {
  it('removes the element', () => {
    const { overview } = setup();
    overview.dispose();
    expect((overview.element as unknown as FakeElement).removed).toBe(true);
  });
});
