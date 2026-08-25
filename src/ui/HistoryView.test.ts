import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHistoryView } from './HistoryView.ts';
import type { SessionHistoryResult } from '../metrics/sessionHistory.ts';

class FakeElement {
  textContent = '';
  type = '';
  accept = '';
  multiple = false;
  files: FileList | null = null;
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = { cssText: '' };
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, () => void>();
  append(...children: FakeElement[]): void { this.children.push(...children); }
  appendChild(child: FakeElement): void { this.children.push(child); }
  replaceChildren(...children: FakeElement[]): void { this.children.length = 0; this.children.push(...children); }
  addEventListener(name: string, listener: () => void): void { this.listeners.set(name, listener); }
  remove(): void {}
}

class FakeDocument {
  createElement(): FakeElement { return new FakeElement(); }
}

afterEach(() => vi.unstubAllGlobals());

describe('createHistoryView', () => {
  it('shows compatible speed and accuracy baselines together without a directional arrow', () => {
    vi.stubGlobal('document', new FakeDocument());
    const view = createHistoryView();

    view.render(historyOk());

    expect(metricIds(view.element as unknown as FakeElement)).toEqual(['history-speed', 'history-accuracy']);
    expect(text(view.element as unknown as FakeElement)).toContain('median 120');
    expect(text(view.element as unknown as FakeElement)).toContain('population SD 12');
    expect(text(view.element as unknown as FakeElement)).toContain('n=3');
    expect(text(view.element as unknown as FakeElement)).not.toMatch(/[↑↓]/);
  });

  it('shows 資料不足 when compatibility or sample requirements do not produce a baseline', () => {
    vi.stubGlobal('document', new FakeDocument());
    const view = createHistoryView();

    view.render({ status: 'insufficient-data', reason: 'compatible history n=1 is below minN=3' });

    expect(metricIds(view.element as unknown as FakeElement)).toEqual([]);
    expect(text(view.element as unknown as FakeElement)).toContain('資料不足');
    expect(text(view.element as unknown as FakeElement)).toContain('minN=3');
  });
});

function historyOk(): Extract<SessionHistoryResult, { status: 'ok' }> {
  const summary = {
    compatibilityKey: {
      participantId: 'participant-1', taskId: 'hold-click-v1', protocolVersion: '1.0.0', gameMovementProfile: 'cs2-source',
      weaponId: 'rifle', weaponMode: 'rifle', sensitivityFovKey: 'sensitivity=1;fovDeg=90', targetConditionCell: 'default',
      assessmentFeedbackPolicy: 'minimal-end-of-block', qualityGateStatus: 'ok',
    },
    sessionId: 'previous', startedAt: '2026-08-25T12:00:00.000Z', diagnosis: { status: 'ok' as const, recommendationVersion: 'recommendation-v1' },
    speedMetric: { id: 'hold-click.acquisition-ms', value: 120 }, accuracyMetric: { id: 'hold-click.first-shot-hit-rate', value: 80 },
  };
  return { status: 'ok', eligible: [summary, summary, summary], medianSpeed: 120, medianAccuracy: 80, variabilitySpeed: 12, variabilityAccuracy: 4 };
}

function flatten(root: FakeElement): FakeElement[] { return [root, ...root.children.flatMap(flatten)]; }
function metricIds(root: FakeElement): string[] { return flatten(root).map((node) => node.dataset.metricId).filter((value): value is string => value !== undefined); }
function text(root: FakeElement): string { return flatten(root).map((node) => node.textContent).filter(Boolean).join(' '); }
