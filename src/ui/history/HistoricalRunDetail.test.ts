import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeAssessmentPayload } from '../../../tests/history/payloadFixtures.ts';
import { buildResultPresentation, exportBasename } from '../../results/ResultPresentation.ts';
import type { HistoricalRunPresentation } from '../../history/HistoryLibraryController.ts';

const { downloadJSON, downloadCSV } = vi.hoisted(() => ({ downloadJSON: vi.fn(), downloadCSV: vi.fn() }));
vi.mock('../../data/export.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/export.ts')>();
  return { ...actual, downloadJSON, downloadCSV };
});

import { createHistoricalRunDetail } from './HistoricalRunDetail.ts';

class FakeElement {
  textContent = '';
  type = '';
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

  createElementNS(): FakeElement {
    return new FakeElement('svg');
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

afterEach(() => {
  vi.unstubAllGlobals();
  downloadJSON.mockClear();
  downloadCSV.mockClear();
});

function setup(options: Parameters<typeof createHistoricalRunDetail>[0] = { onBack: vi.fn(), onRetry: vi.fn() }) {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  const detail = createHistoricalRunDetail(options);
  return { document, detail, options };
}

function readyValue(overrides: Partial<{ runId: string; participantId: string; drillId: string }> = {}): HistoricalRunPresentation {
  const payload = makeAssessmentPayload({
    participantId: overrides.participantId ?? 'p-1',
    drillId: overrides.drillId ?? 'd-1',
    startedAt: '2026-01-01T00:00:00.000Z',
  });
  return {
    run: {
      runId: overrides.runId ?? 'r-1',
      participantId: overrides.participantId ?? 'p-1',
      drillId: overrides.drillId ?? 'd-1',
      startedAt: payload.meta.startedAt,
      schemaVersion: payload.meta.schemaVersion,
      suspect: payload.meta.suspect,
      byteLength: 100,
      replaySupport: 'unchecked',
    },
    payload,
    result: buildResultPresentation(payload),
  };
}

describe('createHistoricalRunDetail — async status rendering', () => {
  it('idle/loading renders a loading message and hides the body/actions', () => {
    const { detail } = setup();
    detail.render({ runDetail: { status: 'loading' }, runId: 'r-1' });
    expect(text(detail.element as unknown as FakeElement)).toContain('載入中');
  });

  it('empty renders a not-found message', () => {
    const { detail } = setup();
    detail.render({ runDetail: { status: 'empty' }, runId: 'r-1' });
    expect(text(detail.element as unknown as FakeElement)).toContain('找不到這筆 Assessment run');
  });

  it('a retryable error shows a Retry button wired to onRetry', () => {
    const onRetry = vi.fn();
    const { detail } = setup({ onBack: vi.fn(), onRetry });
    detail.render({ runDetail: { status: 'error', code: 'STORAGE_IO', message: 'disk error', retryable: true }, runId: 'r-1' });
    const element = detail.element as unknown as FakeElement;
    expect(text(element)).toContain('讀取失敗：disk error');
    const retryButton = findByTag(element, 'button').find((b) => b.textContent === '重試')!;
    retryButton.dispatch('click');
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('a non-retryable error omits the Retry button', () => {
    const { detail } = setup();
    detail.render({ runDetail: { status: 'error', code: 'RUN_NOT_FOUND', message: 'gone', retryable: false }, runId: 'r-1' });
    expect(findByTag(detail.element as unknown as FakeElement, 'button').some((b) => b.textContent === '重試')).toBe(false);
  });
});

describe('createHistoricalRunDetail — Back action (FR-49.6)', () => {
  it('clicking Back calls onBack', () => {
    const onBack = vi.fn();
    const { detail } = setup({ onBack, onRetry: vi.fn() });
    detail.render({ runDetail: { status: 'empty' }, runId: 'r-1' });
    const backButton = findByTag(detail.element as unknown as FakeElement, 'button').find((b) => b.dataset.historyAction === 'back')!;
    backButton.dispatch('click');
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('createHistoricalRunDetail — ready state renders the shared body and binds downloads to this run (FM-49.8)', () => {
  it('renders diagnosis/metrics content from result.result via the shared ResultDetailBody', () => {
    const { detail } = setup();
    detail.render({ runDetail: { status: 'ready', value: readyValue() }, runId: 'r-1' });
    expect(text(detail.element as unknown as FakeElement)).toContain('Subject-relative');
  });

  it('Download JSON downloads this route\'s payload with the shared exportBasename rule, not a different run\'s payload', () => {
    const { detail } = setup();
    const valueA = readyValue({ runId: 'r-a', drillId: 'd-a' });
    detail.render({ runDetail: { status: 'ready', value: valueA }, runId: 'r-a' });

    const jsonButton = findByTag(detail.element as unknown as FakeElement, 'button').find((b) => b.dataset.historyAction === 'export-json')!;
    jsonButton.dispatch('click');
    expect(downloadJSON).toHaveBeenCalledWith(valueA.payload, { basename: exportBasename(valueA.payload) });

    downloadJSON.mockClear();
    const valueB = readyValue({ runId: 'r-b', drillId: 'd-b' });
    detail.render({ runDetail: { status: 'ready', value: valueB }, runId: 'r-b' });
    const jsonButtonB = findByTag(detail.element as unknown as FakeElement, 'button').find((b) => b.dataset.historyAction === 'export-json')!;
    jsonButtonB.dispatch('click');
    expect(downloadJSON).toHaveBeenCalledWith(valueB.payload, { basename: exportBasename(valueB.payload) });
    expect(downloadJSON).not.toHaveBeenCalledWith(valueA.payload, expect.anything());
  });

  it('Download CSV downloads this route\'s payload', () => {
    const { detail } = setup();
    const value = readyValue();
    detail.render({ runDetail: { status: 'ready', value }, runId: 'r-1' });
    const csvButton = findByTag(detail.element as unknown as FakeElement, 'button').find((b) => b.dataset.historyAction === 'export-csv')!;
    csvButton.dispatch('click');
    expect(downloadCSV).toHaveBeenCalledWith(value.payload, { basename: exportBasename(value.payload) });
  });
});

describe('createHistoricalRunDetail — optional replay port (FR-49.13)', () => {
  it('renders no replay button when onReplay is not provided', () => {
    const { detail } = setup();
    detail.render({ runDetail: { status: 'ready', value: readyValue() }, runId: 'r-1' });
    expect(findByTag(detail.element as unknown as FakeElement, 'button').some((b) => b.dataset.historyAction === 'replay')).toBe(false);
  });

  it('renders an enabled replay button when onReplay is provided and the run is ready, wired with the current runId', () => {
    const onReplay = vi.fn();
    const { detail } = setup({ onBack: vi.fn(), onRetry: vi.fn(), onReplay });
    detail.render({ runDetail: { status: 'ready', value: readyValue({ runId: 'r-1' }) }, runId: 'r-1' });
    const replayButton = findByTag(detail.element as unknown as FakeElement, 'button').find((b) => b.dataset.historyAction === 'replay')!;

    expect(replayButton.disabled).toBe(false);
    replayButton.dispatch('click');
    expect(onReplay).toHaveBeenCalledWith('r-1');
  });

  it('the replay button is disabled while the run is not ready (loading/error/empty)', () => {
    const onReplay = vi.fn();
    const { detail } = setup({ onBack: vi.fn(), onRetry: vi.fn(), onReplay });

    detail.render({ runDetail: { status: 'loading' }, runId: 'r-1' });
    const replayButton = findByTag(detail.element as unknown as FakeElement, 'button').find((b) => b.dataset.historyAction === 'replay')!;
    expect(replayButton.disabled).toBe(true);
  });
});

describe('createHistoricalRunDetail — dispose', () => {
  it('removes the element', () => {
    const { detail } = setup();
    detail.dispose();
    expect((detail.element as unknown as FakeElement).removed).toBe(true);
  });
});
