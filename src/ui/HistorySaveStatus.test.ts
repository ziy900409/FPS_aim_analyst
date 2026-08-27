import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHistorySaveStatus } from './HistorySaveStatus.ts';
import type { HistoryRunSummary } from '../history/contracts.ts';

class FakeElement {
  textContent = '';
  type = '';
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = { cssText: '', display: '' };
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, () => void>();

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  remove(): void {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }

  click(): void {
    this.listeners.get('click')?.();
  }
}

class FakeDocument {
  createElement(): FakeElement {
    return new FakeElement();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function runSummary(overrides: Partial<HistoryRunSummary> = {}): HistoryRunSummary {
  return {
    runId: 'run-1',
    participantId: 'P-001',
    drillId: 'counterstrafe_reversal_v1',
    startedAt: '2026-08-27T14:32:11.321Z',
    schemaVersion: 2,
    suspect: false,
    byteLength: 42,
    replaySupport: 'unchecked' as const,
    ...overrides,
  };
}

describe('createHistorySaveStatus', () => {
  it('is keyboard/ARIA operable: status role + live region on the root, labeled retry button', () => {
    vi.stubGlobal('document', new FakeDocument());
    const element = createHistorySaveStatus().element as unknown as FakeElement;

    expect(element.attributes.get('role')).toBe('status');
    expect(element.attributes.get('aria-live')).toBe('polite');
    const retryButton = element.children[1];
    expect(retryButton.type).toBe('button');
    expect(retryButton.attributes.get('aria-label')).toBeTruthy();
  });

  it('idle: hidden, no message', () => {
    vi.stubGlobal('document', new FakeDocument());
    const status = createHistorySaveStatus();
    const element = status.element as unknown as FakeElement;

    status.render({ kind: 'idle' });

    expect(element.style.display).toBe('none');
    expect(element.dataset.historySaveStatus).toBe('idle');
  });

  it('excluded: neutral Practice explanation, no retry button', () => {
    vi.stubGlobal('document', new FakeDocument());
    const status = createHistorySaveStatus();
    const element = status.element as unknown as FakeElement;

    status.render({ kind: 'excluded', reason: 'practice' });

    expect(element.style.display).not.toBe('none');
    expect(element.children[0].textContent).toContain('Practice');
    expect(element.children[1].style.display).toBe('none');
  });

  it('saving: shows a progress message', () => {
    vi.stubGlobal('document', new FakeDocument());
    const status = createHistorySaveStatus();
    const element = status.element as unknown as FakeElement;

    status.render({ kind: 'saving', runKey: 'P-001/drill/2026-08-27T14:32:11.321Z' });

    expect(element.children[0].textContent).toContain('Saving');
    expect(element.children[1].style.display).toBe('none');
  });

  it('saved(created) and saved(existing) render distinct messages', () => {
    vi.stubGlobal('document', new FakeDocument());
    const status = createHistorySaveStatus();
    const element = status.element as unknown as FakeElement;

    status.render({ kind: 'saved', run: runSummary(), disposition: 'created' });
    const createdText = element.children[0].textContent;

    status.render({ kind: 'saved', run: runSummary(), disposition: 'existing' });
    const existingText = element.children[0].textContent;

    expect(createdText).toContain('Saved');
    expect(existingText).not.toBe(createdText);
    expect(element.children[1].style.display).toBe('none');
  });

  it('failed retryable: shows the retry button and calls onRetry when clicked', () => {
    vi.stubGlobal('document', new FakeDocument());
    const onRetry = vi.fn();
    const status = createHistorySaveStatus({ onRetry });
    const element = status.element as unknown as FakeElement;

    status.render({ kind: 'failed', message: 'network request failed', retryable: true });

    expect(element.children[0].textContent).toContain('network request failed');
    expect(element.children[1].style.display).not.toBe('none');

    element.children[1].click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('failed non-retryable: hides the retry button', () => {
    vi.stubGlobal('document', new FakeDocument());
    const status = createHistorySaveStatus();
    const element = status.element as unknown as FakeElement;

    status.render({ kind: 'failed', message: 'a run with the same identity but different content already exists', retryable: false });

    expect(element.children[1].style.display).toBe('none');
  });

  it('dispose removes the element', () => {
    vi.stubGlobal('document', new FakeDocument());
    const status = createHistorySaveStatus();
    const remove = vi.spyOn(status.element as unknown as FakeElement, 'remove');

    status.dispose();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
