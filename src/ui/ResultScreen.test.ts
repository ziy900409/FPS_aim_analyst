import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Metrics } from '../metrics/compute.ts';
import type { DiagnosisResult } from '../metrics/diagnosisRules.ts';
import type { PromotedMetrics } from '../metrics/researchMetrics.ts';
import {
  createDiagnosisSummary,
  createPromotedSummary,
  createQualityFlagSummary,
  createRecoilOverlayModel,
  createResultScreen,
  createResultSummary,
  DIAGNOSIS_METRIC_IDS,
  PROMOTED_METRIC_IDS,
  QUALITY_FLAG_IDS,
  type QualityFlagsInput,
  summarizeResidualSpeed,
} from './ResultScreen.ts';

const metrics: Metrics = {
  counterReactionMs: { mean: 63.33, p50: 60, sd: 12.47, n: 3, values: [50, 80, 60] },
  residualSpeed: { mean: 62.5, p50: 0, sd: 108.25, n: 4, values: [0, 250, 0, 0] },
  fireTimingAlignmentMs: { mean: 13.33, p50: 10, sd: 4.71, n: 3, values: [20, 10, 10] },
  firstShotHitRate: 66.666,
  crosshairOffset: { mean: 1.125, p50: 1.25, sd: 0.74, n: 4, values: [0, 2, 1.5, 1] },
  recoilCompensationError: { meanDeg: 0.42, rmsDeg: 0.55 },
  recoilCompensationPath: {
    actual: [
      { pitchDeg: 0, yawDeg: 0 },
      { pitchDeg: -0.8, yawDeg: 0.4 },
      { pitchDeg: -1.7, yawDeg: -0.6 },
    ],
    ideal: [
      { pitchDeg: 0, yawDeg: 0 },
      { pitchDeg: -1, yawDeg: 0.5 },
      { pitchDeg: -2, yawDeg: -1 },
    ],
  },
  switchTimeMs: { mean: 110, p50: 110, sd: 20, n: 2, values: [130, 90] },
  rhythmStability: 0.0834,
  leftRightSymmetry: {
    left: { mean: 80, p50: 80, sd: 0, n: 1, values: [80] },
    right: { mean: 55, p50: 55, sd: 5, n: 2, values: [50, 60] },
    diff: 25,
  },
};

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

describe('createResultSummary', () => {
  it('maps the eight WP-8 metrics to result cards and reaction distribution values', () => {
    const summary = createResultSummary(metrics);

    expect(summary.cards.map((card) => card.id)).toEqual([
      'counterReactionMs',
      'residualSpeed',
      'fireTimingAlignmentMs',
      'firstShotHitRate',
      'crosshairOffset',
      'switchTimeMs',
      'rhythmStability',
      'leftRightSymmetry',
    ]);
    expect(summary.reactionValues).toEqual([50, 80, 60]);
    expect(summary.recoilCompensation).toEqual({
      error: { meanDeg: 0.42, rmsDeg: 0.55 },
      path: metrics.recoilCompensationPath,
    });
    expect(summary.cards.find((card) => card.id === 'residualSpeed')?.title).toBe('Residual speed / overshoot');
    expect(summary.cards.find((card) => card.id === 'residualSpeed')?.value).toBe('62.5 u/s');
    expect(summary.cards.find((card) => card.id === 'residualSpeed')?.detail).toBe(
      'p50 0.0 u/s · SD 108.3 u/s · n=4 · 3/4 under 88 u/s gate',
    );
    expect(summary.cards.find((card) => card.id === 'firstShotHitRate')?.value).toBe('66.7%');
    expect(summary.cards.find((card) => card.id === 'leftRightSymmetry')?.value).toBe('25 ms');
    expect(summary.methodNote).toContain('Subject-relative');
  });

  it('keeps empty samples display-safe', () => {
    const empty = createResultSummary({
      ...metrics,
      counterReactionMs: { mean: 0, p50: 0, sd: 0, n: 0, values: [] },
      residualSpeed: { mean: 0, p50: 0, sd: 0, n: 0, values: [] },
      leftRightSymmetry: {
        left: { mean: 0, p50: 0, sd: 0, n: 0, values: [] },
        right: { mean: 0, p50: 0, sd: 0, n: 0, values: [] },
        diff: 0,
      },
    });

    expect(empty.cards.find((card) => card.id === 'counterReactionMs')?.value).toBe('N/A');
    expect(empty.cards.find((card) => card.id === 'residualSpeed')?.value).toBe('N/A');
    expect(empty.cards.find((card) => card.id === 'leftRightSymmetry')?.value).toBe('N/A');
  });
});

describe('WP-32 T5 promoted result section', () => {
  it('pins the closed promoted metric id set and carries n, flags, and versions', () => {
    const promoted = promotedOk();
    const summary = createPromotedSummary(promoted);
    expect(summary.status).toBe('ok');
    if (summary.status !== 'ok') throw new Error('expected ok summary');

    expect(summary.cards.map((card) => card.id)).toEqual(PROMOTED_METRIC_IDS.slice(0, 6));
    for (const card of summary.cards) {
      expect(card.detail).toMatch(/n=|No samples/);
      expect(card.meta).toMatch(/flagged/);
      expect(card.meta).toMatch(/phase-v1|sync-v1/);
    }
    expect(summary.cards.find((card) => card.id === 'sync-release-to-fire-ms')?.meta).toContain('sufficient');
    expect(summary.versions).toContain('curve-v1');
    expect(summary.versions).toContain('sg-seg-v2');
  });

  it('renders promoted ok state with the closed id set including both curve charts', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const screen = createResultScreen();

    screen.show(metrics, promotedOk());

    expect(document.body.children[0].style.display).toBe('flex');
    expect(metricIds(document.body)).toEqual([...PROMOTED_METRIC_IDS]);
    expect(text(document.body)).toContain('n=3');
    expect(text(document.body)).toContain('1 flagged');
    expect(text(document.body)).toContain('phase-v1');
    expect(text(document.body)).toContain('curve-v1');
  });

  it('renders n=0 as No samples instead of a numeric zero', () => {
    const summary = createPromotedSummary({
      ...promotedOk(),
      phase: {
        ...promotedOk().phase,
        recMs: { mean: 0, p50: 0, sd: 0, n: 0 },
      },
    });

    expect(summary.status).toBe('ok');
    if (summary.status !== 'ok') throw new Error('expected ok summary');
    expect(summary.cards.find((card) => card.id === 'phase-rec-ms')?.value).toBe('No samples');
    expect(summary.cards.find((card) => card.id === 'phase-rec-ms')?.detail).toBe('No samples');
  });

  it('renders blocked state without promoted metric cards or charts', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const screen = createResultScreen();

    screen.show(metrics, {
      status: 'blocked',
      reason: 'meta.mouseIntegration is missing; promoted phase metrics require tick-integral omega (KI-005)',
    });

    expect(metricIds(document.body)).toEqual([]);
    expect(text(document.body)).toContain('Promoted diagnostics blocked');
    expect(text(document.body)).toContain('KI-005');
  });
});

describe('WP-38 T3 diagnosis result section', () => {
  it('pins the closed diagnosis metric id set and carries source, n, flags, and version', () => {
    const summary = createDiagnosisSummary(diagnosisOk());
    expect(summary.status).toBe('ok');
    if (summary.status !== 'ok') throw new Error('expected ok summary');

    expect(summary.cards.map((card) => card.id)).toEqual(DIAGNOSIS_METRIC_IDS);
    expect(summary.cards.find((card) => card.id === 'diagnosis-primary-label')).toMatchObject({
      value: 'flick-control',
      detail: '降速 Spider Shot、一次乾淨停止',
    });
    const evidence = summary.cards.find((card) => card.id === 'diagnosis-primary-evidence');
    expect(evidence?.value).toContain('spider-shot.movement-execution-ms 320.00');
    expect(evidence?.detail).toContain('n=4');
    expect(evidence?.detail).toContain('1 flagged');
    expect(evidence?.meta).toBe('n=8 · 1 flagged');
    expect(summary.cards.find((card) => card.id === 'diagnosis-recommendation-version')?.value).toBe(
      'recommendation-test-v1',
    );
  });

  it('renders the diagnosis cards with only the closed metric ids', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const screen = createResultScreen();

    screen.show(metrics, undefined, diagnosisOk());

    expect(diagnosisMetricIds(document.body)).toEqual([...DIAGNOSIS_METRIC_IDS]);
    expect(text(document.body)).toContain('recommendation-test-v1');
    expect(text(document.body)).toContain('n=4');
    expect(text(document.body)).toContain('1 flagged');
  });

  it('renders insufficient data without findings or progress arrows', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const screen = createResultScreen();

    screen.show(metrics, undefined, { status: 'insufficient-data', reason: 'quality gate status: suspect-run' });

    expect(diagnosisMetricIds(document.body)).toEqual([]);
    expect(text(document.body)).toContain('資料不足');
    expect(text(document.body)).toContain('quality gate status: suspect-run');
    expect(text(document.body)).not.toContain('flick-control');
    expect(text(document.body)).not.toMatch(/[↑↓]/);
  });
});

describe('WP-40 T1 quality-flag result section', () => {
  it('pins the six quality-flag cards and maps each individual flag to its severity', () => {
    const cases: readonly {
      readonly flags: QualityFlagsInput;
      readonly id: (typeof QUALITY_FLAG_IDS)[number];
      readonly severity: 'warn' | 'retest-recommended';
    }[] = [
      { flags: { ...qualityFlags(), lateEventCount: 1 }, id: 'quality-flag-late-events', severity: 'warn' },
      { flags: { ...qualityFlags(), bufferOverflow: true }, id: 'quality-flag-buffer-overflow', severity: 'warn' },
      { flags: { ...qualityFlags(), recorderOverflow: true }, id: 'quality-flag-recorder-overflow', severity: 'retest-recommended' },
      {
        flags: { ...qualityFlags(), validity: { corridorExceeded: true, perfFloor: false } },
        id: 'quality-flag-corridor-exceeded',
        severity: 'warn',
      },
      {
        flags: { ...qualityFlags(), validity: { corridorExceeded: false, perfFloor: true } },
        id: 'quality-flag-perf-floor',
        severity: 'warn',
      },
      { flags: { ...qualityFlags(), suspect: true }, id: 'quality-flag-suspect', severity: 'retest-recommended' },
    ];

    for (const testCase of cases) {
      const summary = createQualityFlagSummary(testCase.flags);
      expect(summary.cards.map((card) => card.id)).toEqual(QUALITY_FLAG_IDS);
      expect(summary.cards.find((card) => card.id === testCase.id)?.severity).toBe(testCase.severity);
      expect(summary.overallSeverity).toBe(testCase.severity);
    }
  });

  it('keeps a single late event as a warning rather than recommending a re-test', () => {
    expect(createQualityFlagSummary({ ...qualityFlags(), lateEventCount: 1 }).overallSeverity).toBe('warn');
  });

  it('renders real quality flags with warn styling, and renders no section when they are absent', () => {
    const document = new FakeDocument();
    vi.stubGlobal('document', document);
    const screen = createResultScreen();

    screen.show(metrics, undefined, undefined, { ...qualityFlags(), lateEventCount: 1 });

    expect(qualityFlagMetricIds(document.body)).toEqual(QUALITY_FLAG_IDS);
    const lateEvents = flatten(document.body).find((node) => node.dataset.metricId === 'quality-flag-late-events');
    expect(lateEvents?.dataset.qualityFlagSeverity).toBe('warn');
    expect(lateEvents?.style.cssText).toContain('#f5a623');
    expect(text(document.body)).toContain('Overall: Warning');

    screen.show(metrics);

    expect(qualityFlagMetricIds(document.body)).toEqual([]);
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

    screen.show(metrics);

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
});

describe('createRecoilOverlayModel', () => {
  it('creates a stable recoil path overlay model with actual and ideal series plus mean and RMS', () => {
    const summary = createResultSummary({
      ...metrics,
      recoilCompensationError: { meanDeg: 0.3333, rmsDeg: 0.4444 },
      recoilCompensationPath: buildSyntheticPath(10),
    });
    const model = createRecoilOverlayModel(summary.recoilCompensation);

    expect(model?.meanText).toBe('0.33 deg');
    expect(model?.rmsText).toBe('0.44 deg');
    expect(model?.actual).toHaveLength(10);
    expect(model?.ideal).toHaveLength(10);
    expect(formatPointList(model?.ideal ?? [])).toMatchInlineSnapshot(
      `"311.143,158 278.571,142.444 408.857,126.889 213.429,111.333 506.571,95.778 148.286,80.222 604.286,64.667 83.143,49.111 702,33.556 18,18"`,
    );
  });

  it('hides the recoil path block when there are no fire path samples', () => {
    const summary = createResultSummary({
      ...metrics,
      recoilCompensationPath: { actual: [], ideal: [] },
    });

    expect(createRecoilOverlayModel(summary.recoilCompensation)).toBeUndefined();
  });

  it('keeps a single fire renderable as point markers without path lines', () => {
    const summary = createResultSummary({
      ...metrics,
      recoilCompensationPath: {
        actual: [{ pitchDeg: 0, yawDeg: 0 }],
        ideal: [{ pitchDeg: 0, yawDeg: 0 }],
      },
    });
    const model = createRecoilOverlayModel(summary.recoilCompensation);

    expect(model?.actual).toHaveLength(1);
    expect(model?.ideal).toHaveLength(1);
    expect(model?.actual[0]).toEqual({ x: 18, y: 18 });
    expect(model?.ideal[0]).toEqual({ x: 18, y: 18 });
  });
});

describe('summarizeResidualSpeed', () => {
  it('keeps the velocity gate as detail derived from continuous u/s samples', () => {
    expect(summarizeResidualSpeed(metrics.residualSpeed)).toMatchObject({
      detail: 'p50 0.0 u/s · SD 108.3 u/s · n=4 · 3/4 under 88 u/s gate',
      withinGate: 3,
      overGate: 1,
    });
  });
});

function buildSyntheticPath(count: number): Metrics['recoilCompensationPath'] {
  const actual = [];
  const ideal = [];
  for (let i = 0; i < count; i++) {
    actual.push({ pitchDeg: -i * 0.9, yawDeg: i % 2 === 0 ? i * 0.16 : -i * 0.11 });
    ideal.push({ pitchDeg: -i, yawDeg: i % 2 === 0 ? i * 0.18 : -i * 0.12 });
  }
  return { actual, ideal };
}

function formatPointList(points: readonly { x: number; y: number }[]): string {
  return points.map((point) => `${formatNumber(point.x)},${formatNumber(point.y)}`).join(' ');
}

function formatNumber(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '');
}

function promotedOk(): Extract<PromotedMetrics, { status: 'ok' }> {
  const curve = {
    mean: [0, 1, 0],
    lower: [0, 0.5, 0],
    upper: [0, 1.5, 0],
    n: 3,
  };
  return {
    status: 'ok',
    phase: {
      recMs: { mean: 32, p50: 30, sd: 4, n: 3 },
      mrMs: { mean: 45, p50: 44, sd: 5, n: 3 },
      vMs: { mean: 70, p50: 68, sd: 6, n: 3 },
      peakOmegaDegPerSec: { mean: 120, p50: 118, sd: 8, n: 3 },
      flagCounts: { no_primary_flick: 1 },
      version: 'phase-v1',
    },
    sync: {
      releaseToFireMs: { mean: 81, p50: 80, sd: 3, n: 12 },
      counterHoldMs: { mean: 24, p50: 23, sd: 2, n: 12 },
      counterToFireMs: { mean: 55, p50: 54, sd: 4, n: 12 },
      verdicts: [
        {
          metric: 'release_to_fire_ms',
          n: 12,
          sampleSdMs: 3,
          quantizationSdMs: 2.25,
          verdict: 'sufficient',
          reason: 'ok',
        },
        {
          metric: 'counter_hold_ms',
          n: 12,
          sampleSdMs: 2,
          quantizationSdMs: 2.25,
          verdict: 'sufficient',
          reason: 'ok',
        },
      ],
      flagCounts: {},
      version: 'sync-v1',
    },
    curve: {
      omega: { left: curve, right: curve },
      epsilon: { left: curve, right: curve },
      flagCounts: {},
      version: 'curve-v1',
    },
  };
}

function action(root: FakeElement, name: string): FakeElement {
  const node = flatten(root).find((candidate) => candidate.dataset.resultAction === name);
  if (node === undefined) throw new Error(`Missing result action: ${name}`);
  return node;
}

function diagnosisOk(): Extract<DiagnosisResult, { status: 'ok' }> {
  return {
    status: 'ok',
    recommendationVersion: 'recommendation-test-v1',
    primary: {
      label: 'flick-control',
      nextTrainingDirection: '降速 Spider Shot、一次乾淨停止',
      evidence: [
        { metricId: 'spider-shot.movement-execution-ms', value: 320, n: 4, flags: ['late-correct'] },
        { metricId: 'spider-shot.stop-control-overshoot-deg', value: 2.5, n: 4, flags: [] },
      ],
    },
  };
}

function qualityFlags(): QualityFlagsInput {
  return {
    lateEventCount: 0,
    bufferOverflow: false,
    recorderOverflow: false,
    suspect: false,
    validity: { corridorExceeded: false, perfFloor: false },
  };
}

function metricIds(root: FakeElement): string[] {
  return flatten(root)
    .map((node) => node.dataset.metricId)
    .filter((id): id is string => id !== undefined && PROMOTED_METRIC_IDS.includes(id as never));
}

function diagnosisMetricIds(root: FakeElement): string[] {
  return flatten(root)
    .map((node) => node.dataset.metricId)
    .filter((id): id is string => id !== undefined && DIAGNOSIS_METRIC_IDS.includes(id as never));
}

function qualityFlagMetricIds(root: FakeElement): string[] {
  return flatten(root)
    .map((node) => node.dataset.metricId)
    .filter((id): id is string => id !== undefined && QUALITY_FLAG_IDS.includes(id as never));
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
