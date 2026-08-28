import { afterEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { createTrendChart } from './TrendChart.ts';
import type { MetricDescriptor } from '../../history/DrillMetricRegistry.ts';
import type { TrendPoint } from '../../history/HistoryTrend.ts';

class FakeElement {
  textContent = '';
  title = '';
  scope = '';
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = { cssText: '' };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();

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

  remove(): void {
    // no-op for tests
  }
}

class FakeDocument {
  createElement(tag: string): FakeElement {
    return new FakeElement(tag);
  }

  createElementNS(_ns: string, tag: string): FakeElement {
    return new FakeElement(tag);
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

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  return createTrendChart();
}

const higherIsBetter: MetricDescriptor = {
  id: 'metric.higher',
  label: '周邊有效命中速度',
  unit: 'hits/min',
  direction: 'higher-is-better',
  primary: true,
  format: 'decimal-1',
};

const lowerIsBetter: MetricDescriptor = {
  id: 'metric.lower',
  label: '周邊命中時間中位數（含一個非常非常長的說明文字用來測試長標籤是否正常顯示不會截斷）',
  unit: 'ms',
  direction: 'lower-is-better',
  primary: false,
  format: 'decimal-1',
};

const neutral: MetricDescriptor = {
  id: 'metric.neutral',
  label: '中性指標',
  unit: 'deg',
  direction: 'neutral',
  primary: false,
  format: 'decimal-2',
};

function point(startedAt: string, value: number, deltaFromPrevious?: number): TrendPoint {
  return { runId: `run-${startedAt}`, startedAt, value, ...(deltaFromPrevious === undefined ? {} : { deltaFromPrevious }) };
}

describe('createTrendChart — 0/1/2+ points', () => {
  it('renders a "no data" message for zero points', () => {
    const chart = setup();
    chart.render({ descriptor: higherIsBetter, points: [] });
    const element = chart.element as unknown as FakeElement;
    expect(text(element)).toContain('尚無資料');
    expect(findByTag(element, 'table')[0].children.length).toBe(0);
  });

  it('renders a single value with "尚無變化資料" for one point, no polyline', () => {
    const chart = setup();
    chart.render({ descriptor: higherIsBetter, points: [point('2026-01-01T00:00:00Z', 5)] });
    const element = chart.element as unknown as FakeElement;
    expect(text(element)).toContain('尚無變化資料');
    expect(text(element)).toContain('5.0 hits/min');
    expect(findByTag(element, 'polyline').length).toBe(0);
  });

  it('renders a polyline + one circle per point + accessible table for 2+ points', () => {
    const chart = setup();
    chart.render({
      descriptor: higherIsBetter,
      points: [point('2026-01-01T00:00:00Z', 5), point('2026-01-02T00:00:00Z', 8, 3)],
    });
    const element = chart.element as unknown as FakeElement;
    expect(findByTag(element, 'polyline').length).toBe(1);
    expect(findByTag(element, 'circle').length).toBe(2);
    const rows = findByTag(element, 'tr');
    // header row + 2 data rows
    expect(rows.length).toBe(3);
  });
});

describe('createTrendChart — direction/delta text (not color alone)', () => {
  it('higher-is-better: a positive delta reads as 進步', () => {
    const chart = setup();
    chart.render({
      descriptor: higherIsBetter,
      points: [point('2026-01-01T00:00:00Z', 5), point('2026-01-02T00:00:00Z', 8, 3)],
    });
    expect(text(chart.element as unknown as FakeElement)).toContain('進步');
  });

  it('higher-is-better: a negative delta reads as 退步', () => {
    const chart = setup();
    chart.render({
      descriptor: higherIsBetter,
      points: [point('2026-01-01T00:00:00Z', 8), point('2026-01-02T00:00:00Z', 5, -3)],
    });
    expect(text(chart.element as unknown as FakeElement)).toContain('退步');
  });

  it('lower-is-better: a decrease reads as 進步, not 退步 (must not label a drop as worse)', () => {
    const chart = setup();
    chart.render({
      descriptor: lowerIsBetter,
      points: [point('2026-01-01T00:00:00Z', 300), point('2026-01-02T00:00:00Z', 200, -100)],
    });
    const rendered = text(chart.element as unknown as FakeElement);
    expect(rendered).toContain('進步');
    expect(rendered).not.toContain('退步');
  });

  it('lower-is-better: an increase reads as 退步', () => {
    const chart = setup();
    chart.render({
      descriptor: lowerIsBetter,
      points: [point('2026-01-01T00:00:00Z', 200), point('2026-01-02T00:00:00Z', 300, 100)],
    });
    expect(text(chart.element as unknown as FakeElement)).toContain('退步');
  });

  it('neutral direction: uses 上升/下降 rather than 進步/退步', () => {
    const chart = setup();
    chart.render({
      descriptor: neutral,
      points: [point('2026-01-01T00:00:00Z', 1), point('2026-01-02T00:00:00Z', 2, 1)],
    });
    const rendered = text(chart.element as unknown as FakeElement);
    expect(rendered).toContain('上升');
    expect(rendered).not.toContain('進步');
    expect(rendered).not.toContain('退步');
  });

  it('zero delta reads as 持平', () => {
    const chart = setup();
    chart.render({
      descriptor: higherIsBetter,
      points: [point('2026-01-01T00:00:00Z', 5), point('2026-01-02T00:00:00Z', 5, 0)],
    });
    expect(text(chart.element as unknown as FakeElement)).toContain('持平');
  });
});

describe('createTrendChart — table mirrors the same data as the chart', () => {
  it('the table has one data row per point plus a header row, with matching values', () => {
    const chart = setup();
    chart.render({
      descriptor: higherIsBetter,
      points: [point('2026-01-01T00:00:00Z', 5), point('2026-01-02T00:00:00Z', 8, 3), point('2026-01-03T00:00:00Z', 6, -2)],
    });
    const element = chart.element as unknown as FakeElement;
    expect(findByTag(element, 'circle').length).toBe(3);
    expect(findByTag(element, 'tr').length).toBe(4); // header + 3 rows
    const rendered = text(element);
    expect(rendered).toContain('5.0 hits/min');
    expect(rendered).toContain('8.0 hits/min');
    expect(rendered).toContain('6.0 hits/min');
  });
});

describe('createTrendChart — long labels', () => {
  it('renders a long descriptor label in full without truncation', () => {
    const chart = setup();
    chart.render({
      descriptor: lowerIsBetter,
      points: [point('2026-01-01T00:00:00Z', 1), point('2026-01-02T00:00:00Z', 2, 1)],
    });
    const captions = findByTag(chart.element as unknown as FakeElement, 'caption');
    expect(captions[0].textContent).toContain(lowerIsBetter.label);
  });
});

describe('createTrendChart — dispose', () => {
  it('is safe to call and does not throw', () => {
    const chart = setup();
    expect(() => chart.dispose()).not.toThrow();
  });
});
