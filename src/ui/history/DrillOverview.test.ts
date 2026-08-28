import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDrillOverview } from './DrillOverview.ts';
import type { HistoryLibraryController, HistoryLibraryState, HistoryObservationCollection } from '../../history/HistoryLibraryController.ts';
import type { HistoryRunProjection, HistoryRunSummary } from '../../history/contracts.ts';
import type { HistoryNavigator } from '../../history/navigation/HistoryNavigator.ts';
import type { CompatibilityKey, QualityGateStatus } from '../../metrics/compatibilityKey.ts';
import type { DrillMetricRegistration, DrillMetricRegistry, HistoryProjectionResult } from '../../history/DrillMetricRegistry.ts';

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

  createElementNS(_ns: string, tag: string): FakeElement {
    const element = new FakeElement(tag);
    this.created.push(element);
    return element;
  }

  createTextNode(text: string): FakeElement {
    const element = new FakeElement('#text');
    element.textContent = text;
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

const IDLE_OBSERVATIONS: HistoryLibraryState['observations'] = { status: 'idle' };

function createFakeRegistry(registration?: DrillMetricRegistration): DrillMetricRegistry {
  return {
    registrationForExactDrill: vi.fn((drillId: string) => (registration?.drillId === drillId ? registration : undefined)),
    project: vi.fn(),
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

function setup(registration?: DrillMetricRegistration) {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  const navigator = createFakeNavigator();
  const controller = createFakeController();
  const registry = createFakeRegistry(registration);
  const overview = createDrillOverview({ navigator, controller, registry });
  return { document, navigator, controller, registry, overview };
}

afterEach(() => vi.unstubAllGlobals());

describe('createDrillOverview — async status rendering (runFilter=all)', () => {
  it('idle/loading renders a loading message', () => {
    const { overview } = setup();
    overview.render({ runs: { status: 'idle' }, observations: IDLE_OBSERVATIONS, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    expect(text(overview.element as unknown as FakeElement)).toContain('載入中');
  });

  it('empty renders a drill-specific "no runs" message', () => {
    const { overview } = setup();
    overview.render({ runs: { status: 'empty' }, observations: IDLE_OBSERVATIONS, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    expect(text(overview.element as unknown as FakeElement)).toContain('尚無 Assessment run 紀錄');
  });

  it('a retryable error shows a Retry button wired to controller.retry("runs")', () => {
    const { overview, controller } = setup();
    overview.render({
      runs: { status: 'error', code: 'STORAGE_IO', message: 'disk error', retryable: true },
      observations: IDLE_OBSERVATIONS,
      participantId: 'p-1',
      drillId: 'd-1',
      runFilter: 'all',
    });
    const element = overview.element as unknown as FakeElement;
    expect(text(element)).toContain('讀取失敗：disk error');
    const retryButton = findByTag(element, 'button').find((b) => b.textContent === '重試')!;
    retryButton.dispatch('click');
    expect(controller.retry).toHaveBeenCalledWith('runs');
  });

  it('a non-retryable error omits the Retry button', () => {
    const { overview } = setup();
    overview.render({
      runs: { status: 'error', code: 'INVALID_EXPORT', message: 'bad', retryable: false },
      observations: IDLE_OBSERVATIONS,
      participantId: 'p-1',
      drillId: 'd-1',
      runFilter: 'all',
    });
    expect(findByTag(overview.element as unknown as FakeElement, 'button').some((b) => b.textContent === '重試')).toBe(false);
  });
});

describe('createDrillOverview — run ordering and navigation (FR-49.4)', () => {
  it('renders runs in the order the controller already provides them (startedAt desc, server-sorted) without re-sorting', () => {
    const { overview } = setup();
    overview.render({ runs: { status: 'ready', value: [runA, runB] }, observations: IDLE_OBSERVATIONS, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const element = overview.element as unknown as FakeElement;
    const rows = findByTag(element, 'ul')[0].children;
    expect(flatten(rows[0]).some((c) => c.textContent === 'run-a')).toBe(true);
    expect(flatten(rows[1]).some((c) => c.textContent === 'run-b')).toBe(true);
    expect(text(element)).toContain('共 2 筆');
  });

  it('clicking a run navigates via navigator.push to the run route', () => {
    const { overview, navigator } = setup();
    overview.render({ runs: { status: 'ready', value: [runA] }, observations: IDLE_OBSERVATIONS, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const element = overview.element as unknown as FakeElement;
    const row = findByTag(element, 'button').find((b) => b.children.some((c) => c.textContent === 'run-a'))!;
    row.dispatch('click');
    expect(navigator.push).toHaveBeenCalledWith({ kind: 'run', participantId: 'p-1', drillId: 'd-1', runId: 'run-a' });
  });

  it('marks a suspect run in its row text', () => {
    const { overview } = setup();
    overview.render({ runs: { status: 'ready', value: [runB] }, observations: IDLE_OBSERVATIONS, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    expect(text(overview.element as unknown as FakeElement)).toContain('suspect');
  });
});

describe('createDrillOverview — runFilter (T3 Steps §4)', () => {
  it('clicking a filter button navigates via navigator.replace with the same participant/drill and the new runFilter', () => {
    const { overview, navigator } = setup();
    overview.render({ runs: { status: 'ready', value: [runA] }, observations: IDLE_OBSERVATIONS, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const element = overview.element as unknown as FakeElement;
    const eligibleButton = findByTag(element, 'button').find((b) => b.dataset.runFilter === 'trend-eligible')!;
    eligibleButton.dispatch('click');
    expect(navigator.replace).toHaveBeenCalledWith({
      kind: 'drill',
      participantId: 'p-1',
      drillId: 'd-1',
      metricId: undefined,
      cohortId: undefined,
      runFilter: 'trend-eligible',
    });
  });

  it('shows a pending-analysis notice instead of the run list for trend-eligible/excluded (no metric registry until T4)', () => {
    const { overview } = setup();
    overview.render({ runs: { status: 'ready', value: [runA] }, observations: IDLE_OBSERVATIONS, participantId: 'p-1', drillId: 'd-1', runFilter: 'trend-eligible' });
    expect(text(overview.element as unknown as FakeElement)).toContain('尚未提供');
  });

  it('marks the active filter button aria-pressed=true', () => {
    const { overview } = setup();
    overview.render({ runs: { status: 'empty' }, observations: IDLE_OBSERVATIONS, participantId: 'p-1', drillId: 'd-1', runFilter: 'excluded' });
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
    overview.render({ runs: { status: 'ready', value: many }, observations: IDLE_OBSERVATIONS, participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
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

// ---------------------------------------------------------------------------
// WP-49 T5 — trend section
// ---------------------------------------------------------------------------

const PRIMARY_METRIC = 'spider-v2.peripheral-hits-per-minute';
const SECONDARY_METRIC = 'spider-v2.peripheral-first-shot-hit-rate';

const REGISTRATION: DrillMetricRegistration = {
  drillId: 'd-1',
  version: '1.0.0',
  descriptors: [
    { id: PRIMARY_METRIC, label: '主要指標', unit: 'hits/min', direction: 'higher-is-better', primary: true, format: 'decimal-1' },
    { id: SECONDARY_METRIC, label: '次要指標', unit: '%', direction: 'higher-is-better', primary: false, format: 'percent' },
  ],
  project: () => [],
};

function makeKey(overrides: Partial<CompatibilityKey> = {}): CompatibilityKey {
  return {
    participantId: 'p-1',
    taskId: 'd-1',
    protocolVersion: '1.0.0',
    gameMovementProfile: 'cs2-source',
    weaponId: 'ak47',
    weaponMode: 'ak47',
    sensitivityFovKey: 'sensitivity=1;fovDeg=90',
    targetConditionCell: 'cell-a',
    assessmentFeedbackPolicy: 'minimal-end-of-block',
    qualityGateStatus: 'ok',
    ...overrides,
  };
}

function makeProjection(
  runId: string,
  startedAt: string,
  value: number,
  keyOverrides: Partial<Omit<CompatibilityKey, 'qualityGateStatus'>> & { qualityGateStatus?: QualityGateStatus } = {},
): HistoryRunProjection {
  const qualityGateStatus = keyOverrides.qualityGateStatus ?? 'ok';
  const key = makeKey({ ...keyOverrides, qualityGateStatus });
  const projection: HistoryProjectionResult = {
    status: 'ready',
    compatibilityKey: key,
    qualityGateStatus,
    observations: [{ metricId: PRIMARY_METRIC, unit: 'hits/min', value }],
  };
  return { run: { ...runA, runId, startedAt }, projection };
}

function readyObservations(items: readonly HistoryRunProjection[], total = items.length): HistoryLibraryState['observations'] {
  const value: HistoryObservationCollection = { items, total, registryVersion: '1.0.0', loadingMore: false, nextCursor: undefined };
  return { status: 'ready', value };
}

describe('createDrillOverview — trend section: unregistered drill (FM-49.6)', () => {
  it('shows an explicit unregistered-drill message and no selectors when the registry has no registration', () => {
    const { overview } = setup(); // no registration passed
    overview.render({
      runs: { status: 'empty' },
      observations: readyObservations([]),
      participantId: 'p-1',
      drillId: 'd-1',
      runFilter: 'all',
    });
    const element = overview.element as unknown as FakeElement;
    expect(text(element)).toContain('尚未註冊歷史指標');
    expect(findByTag(element, 'button').some((b) => b.dataset.metricId !== undefined)).toBe(false);
  });
});

describe('createDrillOverview — trend section: loading/empty/error', () => {
  it('shows a loading message while observations are loading', () => {
    const { overview } = setup(REGISTRATION);
    overview.render({
      runs: { status: 'idle' },
      observations: { status: 'loading' },
      participantId: 'p-1',
      drillId: 'd-1',
      runFilter: 'all',
    });
    expect(text(overview.element as unknown as FakeElement)).toContain('趨勢資料載入中');
  });

  it('shows a retryable error wired to controller.retry("observations")', () => {
    const { overview, controller } = setup(REGISTRATION);
    overview.render({
      runs: { status: 'idle' },
      observations: { status: 'error', code: 'STORAGE_IO', message: 'disk error', retryable: true },
      participantId: 'p-1',
      drillId: 'd-1',
      runFilter: 'all',
    });
    const element = overview.element as unknown as FakeElement;
    expect(text(element)).toContain('趨勢資料讀取失敗：disk error');
    const retryButton = findByTag(element, 'button').find((b) => b.textContent === '重試')!;
    retryButton.dispatch('click');
    expect(controller.retry).toHaveBeenCalledWith('observations');
  });

  it('shows an insufficient-data message when observations are empty', () => {
    const { overview } = setup(REGISTRATION);
    overview.render({
      runs: { status: 'empty' },
      observations: { status: 'empty' },
      participantId: 'p-1',
      drillId: 'd-1',
      runFilter: 'all',
    });
    expect(text(overview.element as unknown as FakeElement)).toContain('沒有足夠的合格資料');
  });
});

describe('createDrillOverview — trend section: chart + metric/cohort selectors', () => {
  it('renders the chart for the default (primary) metric and shows loaded/total progress', () => {
    const { overview } = setup(REGISTRATION);
    const projections = [makeProjection('r1', '2026-08-01T00:00:00Z', 5), makeProjection('r2', '2026-08-02T00:00:00Z', 8)];
    overview.render({
      runs: { status: 'ready', value: [] },
      observations: readyObservations(projections, 5),
      participantId: 'p-1',
      drillId: 'd-1',
      runFilter: 'all',
    });
    const element = overview.element as unknown as FakeElement;
    expect(text(element)).toContain('已載入 2／5 筆');
    expect(findByTag(element, 'polyline').length).toBe(1);
    const primaryButton = findByTag(element, 'button').find((b) => b.dataset.metricId === PRIMARY_METRIC)!;
    expect(primaryButton.attributes.get('aria-pressed')).toBe('true');
  });

  it('clicking a metric button navigates via navigator.replace with metricId set, cohortId/runFilter preserved', () => {
    const { overview, navigator } = setup(REGISTRATION);
    const projections = [makeProjection('r1', '2026-08-01T00:00:00Z', 5), makeProjection('r2', '2026-08-02T00:00:00Z', 8)];
    overview.render({
      runs: { status: 'ready', value: [] },
      observations: readyObservations(projections),
      participantId: 'p-1',
      drillId: 'd-1',
      runFilter: 'trend-eligible',
      cohortId: 'cohort-x',
    });
    const element = overview.element as unknown as FakeElement;
    const secondaryButton = findByTag(element, 'button').find((b) => b.dataset.metricId === SECONDARY_METRIC)!;
    secondaryButton.dispatch('click');
    expect(navigator.replace).toHaveBeenCalledWith({
      kind: 'drill',
      participantId: 'p-1',
      drillId: 'd-1',
      metricId: SECONDARY_METRIC,
      cohortId: 'cohort-x',
      runFilter: 'trend-eligible',
    });
  });

  it('shows a cohort selector only when there is more than one compatibility cohort, and marks the resolved default active', () => {
    const { overview } = setup(REGISTRATION);
    const cohortA = makeProjection('a1', '2026-08-01T00:00:00Z', 5, { sensitivityFovKey: 'sensitivity=1;fovDeg=90' });
    const cohortB = makeProjection('b1', '2026-08-10T00:00:00Z', 9, { sensitivityFovKey: 'sensitivity=2;fovDeg=100' });
    overview.render({
      runs: { status: 'ready', value: [] },
      observations: readyObservations([cohortA, cohortB]),
      participantId: 'p-1',
      drillId: 'd-1',
      runFilter: 'all',
    });
    const element = overview.element as unknown as FakeElement;
    const cohortButtons = findByTag(element, 'button').filter((b) => b.dataset.cohortId !== undefined);
    expect(cohortButtons).toHaveLength(2);
    // cohort B has the latest run, so it is the default-selected cohort (D-49.P10).
    expect(cohortButtons.some((b) => b.attributes.get('aria-pressed') === 'true')).toBe(true);
  });

  it('does not show a cohort selector when there is only one cohort', () => {
    const { overview } = setup(REGISTRATION);
    const projections = [makeProjection('r1', '2026-08-01T00:00:00Z', 5)];
    overview.render({
      runs: { status: 'ready', value: [] },
      observations: readyObservations(projections),
      participantId: 'p-1',
      drillId: 'd-1',
      runFilter: 'all',
    });
    const element = overview.element as unknown as FakeElement;
    expect(findByTag(element, 'button').some((b) => b.dataset.cohortId !== undefined)).toBe(false);
  });

  it('renders an exclusion summary with human-readable reasons and counts', () => {
    const { overview } = setup(REGISTRATION);
    const ok = makeProjection('r1', '2026-08-01T00:00:00Z', 5);
    const suspect = makeProjection('r2', '2026-08-02T00:00:00Z', 8, { qualityGateStatus: 'suspect-run' });
    overview.render({
      runs: { status: 'ready', value: [] },
      observations: readyObservations([ok, suspect]),
      participantId: 'p-1',
      drillId: 'd-1',
      runFilter: 'all',
    });
    const rendered = text(overview.element as unknown as FakeElement);
    expect(rendered).toContain('已排除');
    expect(rendered).toContain('未通過 quality gate：1 筆');
  });

  it('shows a "loading more in the background" hint while a later page is still fetching', () => {
    const { overview } = setup(REGISTRATION);
    const projections = [makeProjection('r1', '2026-08-01T00:00:00Z', 5)];
    const value: HistoryObservationCollection = {
      items: projections,
      total: 3,
      registryVersion: '1.0.0',
      loadingMore: true,
      nextCursor: 'cursor-1',
    };
    overview.render({
      runs: { status: 'ready', value: [] },
      observations: { status: 'ready', value },
      participantId: 'p-1',
      drillId: 'd-1',
      runFilter: 'all',
    });
    expect(text(overview.element as unknown as FakeElement)).toContain('背景載入中');
  });

  it('shows a retry-load-more control wired to controller.loadNextObservationPage() when a later page failed', () => {
    const { overview, controller } = setup(REGISTRATION);
    const projections = [makeProjection('r1', '2026-08-01T00:00:00Z', 5)];
    const value: HistoryObservationCollection = {
      items: projections,
      total: 3,
      registryVersion: '1.0.0',
      loadingMore: false,
      nextCursor: 'cursor-1',
      loadMoreError: { message: 'network blip', retryable: true },
    };
    overview.render({
      runs: { status: 'ready', value: [] },
      observations: { status: 'ready', value },
      participantId: 'p-1',
      drillId: 'd-1',
      runFilter: 'all',
    });
    const element = overview.element as unknown as FakeElement;
    expect(text(element)).toContain('network blip');
    const retryButton = findByTag(element, 'button').find((b) => b.textContent === '重試載入更多')!;
    retryButton.dispatch('click');
    expect(controller.loadNextObservationPage).toHaveBeenCalledOnce();
  });
});
