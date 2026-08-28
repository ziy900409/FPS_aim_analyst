import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Metrics } from '../metrics/compute.ts';
import { createResultSummary } from '../results/ResultPresentation.ts';
import type { ResultPresentation } from '../results/ResultPresentation.ts';
import { createResultScreen } from './ResultScreen.ts';

const metrics: Metrics = {
  counterReactionMs: { mean: 63.33, p50: 60, sd: 12.47, n: 3, values: [50, 80, 60] },
  residualSpeed: { mean: 62.5, p50: 0, sd: 108.25, n: 4, values: [0, 250, 0, 0] },
  fireTimingAlignmentMs: { mean: 13.33, p50: 10, sd: 4.71, n: 3, values: [20, 10, 10] },
  firstShotHitRate: 66.666,
  crosshairOffset: { mean: 1.125, p50: 1.25, sd: 0.74, n: 4, values: [0, 2, 1.5, 1] },
  recoilCompensationError: { meanDeg: 0.42, rmsDeg: 0.55 },
  recoilCompensationPath: { actual: [], ideal: [] },
  switchTimeMs: { mean: 110, p50: 110, sd: 20, n: 2, values: [130, 90] },
  rhythmStability: 0.0834,
  leftRightSymmetry: {
    left: { mean: 80, p50: 80, sd: 0, n: 1, values: [80] },
    right: { mean: 55, p50: 55, sd: 5, n: 2, values: [50, 60] },
    diff: 25,
  },
};

const result: ResultPresentation = { summary: createResultSummary(metrics) };

class FakeElement {
  id = '';
  textContent = '';
  type = '';
  disabled = false;
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = { cssText: '', display: '' };
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, () => void>();

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

  remove(): void {}

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }

  click(): void {
    this.listeners.get('click')?.();
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

class FakeDocument {
  readonly body = new FakeElement();

  createElement(): FakeElement {
    return new FakeElement();
  }

  createElementNS(): FakeElement {
    return new FakeElement();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createResultScreen — dialog chrome', () => {
  it('shows the panel and renders the shared body when show() is called', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const screen = createResultScreen();

    screen.show(result);

    expect(document.body.children[0].style.display).toBe('flex');
    expect(screen.visible).toBe(true);
    expect(text(document.body)).toContain('Subject-relative');
  });

  it('hides the panel on hide()', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const screen = createResultScreen();

    screen.show(result);
    screen.hide();

    expect(document.body.children[0].style.display).toBe('none');
    expect(screen.visible).toBe(false);
  });
});

describe('result actions', () => {
  it('keeps export and restart actions inside Results, with restart confirmation before clearing the run', () => {
    const document = new FakeDocument();
    const onRestart = vi.fn();
    const onExportJSON = vi.fn();
    const onExportCSV = vi.fn();
    const confirm = vi.fn(() => true);
    vi.stubGlobal('document', document);
    vi.stubGlobal('window', { confirm, alert: vi.fn() });
    const screen = createResultScreen({ onRestart, onExportJSON, onExportCSV });

    screen.show(result);

    const restart = action(document.body, 'restart');
    const json = action(document.body, 'export-json');
    const csv = action(document.body, 'export-csv');
    const close = action(document.body, 'close');
    expect(text(document.body)).toContain('重新測試會清除目前畫面結果');

    json.click();
    csv.click();
    restart.click();
    close.click();

    expect(onExportJSON).toHaveBeenCalledOnce();
    expect(onExportCSV).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledOnce();
    expect(onRestart).toHaveBeenCalledOnce();
    expect(screen.visible).toBe(false);
  });

  it('does not restart when the user cancels the data-loss confirmation', () => {
    const document = new FakeDocument();
    const onRestart = vi.fn();
    vi.stubGlobal('document', document);
    vi.stubGlobal('window', { confirm: vi.fn(() => false), alert: vi.fn() });
    createResultScreen({ onRestart });

    action(document.body, 'restart').click();

    expect(onRestart).not.toHaveBeenCalled();
  });

  it('hides restart/export actions and the data-loss hint when no handlers are supplied', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    createResultScreen();

    expect(action(document.body, 'restart').style.display).toBe('none');
    expect(action(document.body, 'export-json').style.display).toBe('none');
    expect(action(document.body, 'export-csv').style.display).toBe('none');
  });
});

describe('WP-49 T5 — "查看此 Drill 歷史" entry (FR-49.12)', () => {
  it('is hidden when onOpenHistory is not supplied, even with no target set', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const screen = createResultScreen();

    screen.show(result);

    expect(action(document.body, 'open-history').style.display).toBe('none');
  });

  it('stays hidden right after show() even when onOpenHistory is supplied — no target yet (Practice or not-yet-saved)', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const onOpenHistory = vi.fn();
    const screen = createResultScreen({ onOpenHistory });

    screen.show(result);

    expect(action(document.body, 'open-history').style.display).toBe('none');
  });

  it('becomes visible once setHistoryTarget supplies a target, and clicking navigates to it', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const onOpenHistory = vi.fn();
    const screen = createResultScreen({ onOpenHistory });

    screen.show(result);
    screen.setHistoryTarget({ participantId: 'p-1', drillId: 'd-1' });

    const button = action(document.body, 'open-history');
    expect(button.style.display).toBe('');
    button.click();
    expect(onOpenHistory).toHaveBeenCalledWith({ participantId: 'p-1', drillId: 'd-1' });
  });

  it('a new show() resets the entry to hidden until setHistoryTarget is called again', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const onOpenHistory = vi.fn();
    const screen = createResultScreen({ onOpenHistory });

    screen.show(result);
    screen.setHistoryTarget({ participantId: 'p-1', drillId: 'd-1' });
    expect(action(document.body, 'open-history').style.display).toBe('');

    screen.show(result); // a fresh result — Practice, or Assessment not yet saved
    expect(action(document.body, 'open-history').style.display).toBe('none');
  });

  it('setHistoryTarget(undefined) hides the entry again', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const onOpenHistory = vi.fn();
    const screen = createResultScreen({ onOpenHistory });

    screen.show(result);
    screen.setHistoryTarget({ participantId: 'p-1', drillId: 'd-1' });
    screen.setHistoryTarget(undefined);

    expect(action(document.body, 'open-history').style.display).toBe('none');
  });
});

describe('WP-48 T5 save-status embed seam', () => {
  it('embeds saveStatusView inside the panel when provided, and omits it otherwise', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const saveStatusView = document.createElement();
    saveStatusView.dataset.section = 'history-save-status';
    createResultScreen({ saveStatusView: saveStatusView as unknown as HTMLElement });

    const found = flatten(document.body).find((node) => node.dataset.section === 'history-save-status');
    expect(found).toBe(saveStatusView);
  });

  it('does not render a save-status node when saveStatusView is omitted', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    createResultScreen();

    const found = flatten(document.body).find((node) => node.dataset.section === 'history-save-status');
    expect(found).toBeUndefined();
  });
});

function action(root: FakeElement, name: string): FakeElement {
  const node = flatten(root).find((candidate) => candidate.dataset.resultAction === name);
  if (node === undefined) throw new Error(`Missing result action: ${name}`);
  return node;
}

function text(root: FakeElement): string {
  return flatten(root)
    .map((node) => node.textContent)
    .filter((value) => value.length > 0)
    .join(' ');
}

function flatten(root: FakeElement): FakeElement[] {
  return [root, ...root.children.flatMap(flatten)];
}
