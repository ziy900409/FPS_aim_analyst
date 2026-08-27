import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Metrics } from '../metrics/compute.ts';
import type { DiagnosisResult } from '../metrics/diagnosisRules.ts';
import type { PromotedMetrics } from '../metrics/researchMetrics.ts';
import { createResultSummary, type QualityFlagsInput } from '../results/ResultPresentation.ts';
import {
  createDiagnosisSummary,
  createPromotedSummary,
  createQualityFlagSummary,
  createRecoilOverlayModel,
  createResultDetailBody,
  DIAGNOSIS_METRIC_IDS,
  PROMOTED_METRIC_IDS,
  QUALITY_FLAG_IDS,
} from './ResultDetailBody.ts';

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

  addEventListener(): void {}

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

function renderBody(...args: Parameters<typeof createResultSummaryResult>): { body: ReturnType<typeof createResultDetailBody>; element: FakeElement } {
  vi.stubGlobal('document', new FakeDocument());
  const body = createResultDetailBody();
  body.render(createResultSummaryResult(...args));
  return { body, element: body.element as unknown as FakeElement };
}

function createResultSummaryResult(
  m: Metrics = metrics,
  promoted?: PromotedMetrics,
  diagnosis?: DiagnosisResult,
  qualityFlags?: QualityFlagsInput,
) {
  return { summary: createResultSummary(m), promoted, diagnosis, qualityFlags };
}

describe('WP-32 T5 promoted result section', () => {
  it('pins the closed promoted metric id set and carries n, flags, and versions', () => {
    const promoted = promotedOk();
    const summary = createPromotedSummary(promoted);
    expect(summary.status).toBe('ok');
    if (summary.status !== 'ok') throw new Error('expected ok summary');

    expect(summary.cards.map((card) => card.id)).toEqual(PROMOTED_METRIC_IDS.slice(0, 6));
    expect(summary.versions).toContain('curve-v1');
    expect(summary.versions).toContain('sg-seg-v2');
  });

  it('renders promoted ok state with the closed id set including both curve charts', () => {
    const { element } = renderBody(metrics, promotedOk());

    expect(metricIds(element)).toEqual([...PROMOTED_METRIC_IDS]);
    expect(text(element)).toContain('n=3');
    expect(text(element)).toContain('phase-v1');
    expect(text(element)).toContain('curve-v1');
  });

  it('renders blocked state without promoted metric cards or charts', () => {
    const { element } = renderBody(metrics, {
      status: 'blocked',
      reason: 'meta.mouseIntegration is missing; promoted phase metrics require tick-integral omega (KI-005)',
    });

    expect(metricIds(element)).toEqual([]);
    expect(text(element)).toContain('Promoted diagnostics blocked');
    expect(text(element)).toContain('KI-005');
  });
});

describe('WP-38 T3 diagnosis result section', () => {
  it('pins the closed diagnosis metric id set and carries source, n, flags, and version', () => {
    const summary = createDiagnosisSummary(diagnosisOk());
    expect(summary.status).toBe('ok');
    if (summary.status !== 'ok') throw new Error('expected ok summary');
    expect(summary.cards.map((card) => card.id)).toEqual(DIAGNOSIS_METRIC_IDS);
  });

  it('renders the diagnosis cards with only the closed metric ids', () => {
    const { element } = renderBody(metrics, undefined, diagnosisOk());

    expect(diagnosisMetricIds(element)).toEqual([...DIAGNOSIS_METRIC_IDS]);
    expect(text(element)).toContain('recommendation-test-v1');
  });

  it('renders insufficient data without findings', () => {
    const { element } = renderBody(metrics, undefined, { status: 'insufficient-data', reason: 'quality gate status: suspect-run' });

    expect(diagnosisMetricIds(element)).toEqual([]);
    expect(text(element)).toContain('資料不足');
    expect(text(element)).toContain('quality gate status: suspect-run');
  });
});

describe('WP-40 T1 quality-flag result section', () => {
  it('pins the six quality-flag cards and maps each individual flag to its severity', () => {
    const cases: readonly { readonly flags: QualityFlagsInput; readonly id: (typeof QUALITY_FLAG_IDS)[number]; readonly severity: 'warn' | 'retest-recommended' }[] = [
      { flags: { ...qualityFlags(), lateEventCount: 1 }, id: 'quality-flag-late-events', severity: 'warn' },
      { flags: { ...qualityFlags(), suspect: true }, id: 'quality-flag-suspect', severity: 'retest-recommended' },
    ];
    for (const testCase of cases) {
      const summary = createQualityFlagSummary(testCase.flags);
      expect(summary.cards.map((card) => card.id)).toEqual(QUALITY_FLAG_IDS);
      expect(summary.cards.find((card) => card.id === testCase.id)?.severity).toBe(testCase.severity);
    }
  });

  it('renders real quality flags with warn styling, and renders no section when they are absent', () => {
    const { body, element } = renderBody(metrics, undefined, undefined, { ...qualityFlags(), lateEventCount: 1 });

    expect(qualityFlagMetricIds(element)).toEqual(QUALITY_FLAG_IDS);
    const lateEvents = flatten(element).find((node) => node.dataset.metricId === 'quality-flag-late-events');
    expect(lateEvents?.dataset.qualityFlagSeverity).toBe('warn');

    body.render(createResultSummaryResult(metrics));
    expect(qualityFlagMetricIds(element)).toEqual([]);
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
  });

  it('hides the recoil path block when there are no fire path samples', () => {
    const summary = createResultSummary({ ...metrics, recoilCompensationPath: { actual: [], ideal: [] } });
    expect(createRecoilOverlayModel(summary.recoilCompensation)).toBeUndefined();
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

function promotedOk(): Extract<PromotedMetrics, { status: 'ok' }> {
  const curve = { mean: [0, 1, 0], lower: [0, 0.5, 0], upper: [0, 1.5, 0], n: 3 };
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
        { metric: 'release_to_fire_ms', n: 12, sampleSdMs: 3, quantizationSdMs: 2.25, verdict: 'sufficient', reason: 'ok' },
        { metric: 'counter_hold_ms', n: 12, sampleSdMs: 2, quantizationSdMs: 2.25, verdict: 'sufficient', reason: 'ok' },
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
  return { lateEventCount: 0, bufferOverflow: false, recorderOverflow: false, suspect: false, validity: { corridorExceeded: false, perfFloor: false } };
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
