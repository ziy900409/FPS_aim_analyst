import { describe, expect, it } from 'vitest';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';
import type { ExportPayload, MouseSampleBlock } from '../../src/data/export.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';
import {
  ANNOTATION_MATCH_TOLERANCE_MS,
  assessAnnotationChannel,
  assessCohortSufficiency,
  auditLiftRuns,
  extractAnnotationIntervals,
  GAP_THRESHOLD_SWEEP_MS,
  LIFT_VALIDATION_CONTRACT,
  MAX_LATENCY_MEDIAN_DIFF_MS,
  MIN_ACTIVE_RATE_HZ,
  MIN_HELD_OUT_INTERVALS_PER_CLASS,
  MIN_INTERVALS_PER_CLASS,
  MIN_SESSIONS,
  REQUIRED_DISPLAY_HZ,
  annotationCountToleranceFor,
  sortLiftRunInputs,
  splitBySession,
  type InstructionClass,
  type LiftRunInput,
} from '../../scripts/liftCohortAudit.ts';

/**
 * WP-61 T2 —— cohort 可用性／標註完整性／資料充分性稽核的契約。
 *
 * 本檔**不**重測 `segmentByTimeGap()`／`deriveUnlockedIntervals()`／`deriveSamplingHealth()`
 * （各有自己的測試，C-D4 單一定義）。這裡測的是稽核自己的四件事：
 * ① T0 凍結的門檻有沒有被逐字執行且**具名**作廢，② 標註成對性與 trial 冗餘的偵測力，
 * ③ **F3 檢定在某一組沒有樣本時判 `indeterminate` 而不是「通過」**，
 * ④ 資料不足時判 `blocked-by-data` 且說出**差多少**。
 *
 * ③ 與 ④ 是本模組存在的理由：兩者都是「沒有證據」被誤讀成「證據顯示沒問題」的入口。
 */

describe('T0 凍結契約 —— 值本身就是被測對象', () => {
  it('pins every pre-registered number so a silent edit shows up as a red test', () => {
    expect(LIFT_VALIDATION_CONTRACT).toBe('sensor-lift-validation-v1');
    expect(GAP_THRESHOLD_SWEEP_MS).toEqual([18, 30, 50]);
    expect(ANNOTATION_MATCH_TOLERANCE_MS).toBe(300);
    expect(REQUIRED_DISPLAY_HZ).toBe(240);
    expect(MIN_ACTIVE_RATE_HZ).toBe(500);
    expect(MIN_SESSIONS).toBe(2);
    expect(MIN_INTERVALS_PER_CLASS).toBe(30);
    expect(MIN_HELD_OUT_INTERVALS_PER_CLASS).toBe(10);
    expect(MAX_LATENCY_MEDIAN_DIFF_MS).toBe(150);
  });

  it('scales the annotation-count tolerance with the trial count, with a floor of 1', () => {
    // max(1, floor(0.05 * expectedTrials)) —— 20 trials 才容得下 1 次漏按，40 trials 容得下 2 次。
    expect(annotationCountToleranceFor(0)).toBe(1);
    expect(annotationCountToleranceFor(19)).toBe(1);
    expect(annotationCountToleranceFor(20)).toBe(1);
    expect(annotationCountToleranceFor(40)).toBe(2);
  });
});

describe('extractAnnotationIntervals —— 成對性', () => {
  it('pairs each down with its up and reports zero violations on a clean run', () => {
    const result = extractAnnotationIntervals([
      annotation(1000, true),
      annotation(1200, false),
      annotation(2000, true),
      annotation(2300, false),
    ]);

    expect(result.eventCount).toBe(4);
    expect(result.pairViolations).toBe(0);
    expect(result.intervals).toEqual([
      { startMs: 1000, endMs: 1200 },
      { startMs: 2000, endMs: 2300 },
    ]);
  });

  it('drops a doubled down, an orphan up, and a never-closed down — and counts each once', () => {
    const result = extractAnnotationIntervals([
      annotation(500, false), // orphan up
      annotation(1000, true),
      annotation(1100, true), // doubled down: the 1000 interval has no up
      annotation(1300, false),
      annotation(2000, true), // never closed
    ]);

    expect(result.pairViolations).toBe(3);
    // 只有端點齊全的那一段留下 —— 沒有補一個推測的端點（FR-61.3）。
    expect(result.intervals).toEqual([{ startMs: 1100, endMs: 1300 }]);
  });

  it('ignores every non-annotation event, so a run without the channel yields nothing', () => {
    const result = extractAnnotationIntervals([
      { type: 'key', code: 'KeyD', down: true, t: 100 },
      { type: 'pointer_lock', locked: false, t: 200 },
    ]);

    expect(result).toEqual({ intervals: [], eventCount: 0, pairViolations: 0 });
  });
});

describe('auditLiftRuns —— 逐份可用性覆核（step 2）', () => {
  it('passes a healthy 240 Hz lift run with every check carrying an actual value', () => {
    const [audit] = auditLiftRuns([liftRun({})]);

    expect(audit.voidReasons).toEqual([]);
    expect(audit.usable).toBe(true);
    expect(audit.crossOriginIsolated).toBe(true);
    expect(audit.displayHz).toBe(240);
    expect(audit.dpi).toBe(800);
    expect(audit.recordedSamples).toBeGreaterThan(0);
    expect(audit.sampleOverflow).toBe(false);
    expect(audit.activeRateHz).toBeCloseTo(1000, 6);
    expect(audit.unlockedIntervalCount).toBe(0);
    expect(audit.annotationIntervalCount).toBe(4);
    expect(audit.expectedTrials).toBe(4);
    expect(audit.trialDelta).toBe(0);
  });

  it.each([
    ['a 60 Hz display', { meta: { displayHz: 60 } }, 'displayHz'],
    ['a capture without cross-origin isolation', { meta: { crossOriginIsolated: false } }, 'crossOriginIsolated'],
    ['a missing DPI', { meta: { dpi: undefined } }, 'meta.dpi'],
    ['an overflowed arena', { overflow: true }, '原始取樣溢位'],
    ['a manifest without an instruction class', { instructionClass: undefined }, 'instructionClass'],
    ['a manifest without a session id', { sessionId: undefined }, 'sessionId'],
  ])('voids %s and names exactly which check failed', (_label, override, marker) => {
    const [audit] = auditLiftRuns([liftRun(override as Parameters<typeof liftRun>[0])]);

    expect(audit.usable).toBe(false);
    expect(audit.voidReasons.some((reason) => reason.includes(marker))).toBe(true);
  });

  it('voids a stream that degraded to rAF rate but not a 1000 Hz capture with long pauses', () => {
    // 240 Hz 顯示的 rAF 率 ≈ 4.17 ms/sample ⇒ 連續期間 240 Hz < 500 Hz。真人的停頓則不該觸發它
    // （D-60.X1：平均率被停頓拉低一個量級，連續期間率才是 F1 要問的量）。
    const [degraded, paused] = auditLiftRuns([
      liftRun({ sampleIntervalUs: 4167 }),
      liftRun({ trace: [move(200), gap(5000), move(200)] }),
    ]);

    expect(degraded.activeRateHz).toBeCloseTo(240, 0);
    expect(degraded.voidReasons.some((reason) => reason.includes('連續期間事件率'))).toBe(true);
    expect(paused.activeRateHz).toBeCloseTo(1000, 6);
    expect(paused.voidReasons.some((reason) => reason.includes('連續期間事件率'))).toBe(false);
  });

  it('voids a run whose Pointer Lock broke, and counts the break', () => {
    const [audit] = auditLiftRuns([
      liftRun({ extraEvents: [{ type: 'pointer_lock', locked: false, t: 1500 }, { type: 'pointer_lock', locked: true, t: 1600 }] }),
    ]);

    expect(audit.unlockedIntervalCount).toBe(1);
    expect(audit.voidReasons.some((reason) => reason.includes('Pointer Lock 中斷'))).toBe(true);
  });

  it('voids a run whose export carries no raw sampling block at all', () => {
    const [audit] = auditLiftRuns([liftRun({ trace: undefined })]);

    expect(audit.recordedSamples).toBeUndefined();
    expect(audit.activeRateHz).toBeUndefined();
    expect(audit.voidReasons.some((reason) => reason.includes('rawMouse'))).toBe(true);
  });
});

describe('auditLiftRuns —— 標註完整性稽核（step 3）', () => {
  it('voids a lift run that missed more presses than the frozen tolerance allows', () => {
    // 20 trials ⇒ 上限 ±1。18 次標註 = 差 −2 ⇒ 作廢。
    const [audit] = auditLiftRuns([liftRun({ trials: 20, annotations: 18 })]);

    expect(audit.expectedTrials).toBe(20);
    expect(audit.annotationIntervalCount).toBe(18);
    expect(audit.trialDelta).toBe(-2);
    expect(audit.trialDeltaLimit).toBe(1);
    expect(audit.voidReasons.some((reason) => reason.includes('expected trials'))).toBe(true);
  });

  it('keeps a lift run that missed exactly the tolerated number of presses', () => {
    const [audit] = auditLiftRuns([liftRun({ trials: 20, annotations: 19 })]);

    expect(audit.trialDelta).toBe(-1);
    expect(audit.usable).toBe(true);
  });

  it('exempts oneshot from the trial-delta gate but still enforces pairing', () => {
    // oneshot 的指示是「一次到位，遇到實際抬滑鼠才標註」—— 標註數本來就遠少於 trial 數。套用 trial
    // 差額閘會把整個 oneshot 負例組作廢，而那組正是 T3 的對照。成對性閘不因此放寬。
    const [clean, broken] = auditLiftRuns([
      liftRun({ trials: 20, annotations: 2, instructionClass: 'oneshot' }),
      liftRun({ trials: 20, annotations: 2, instructionClass: 'oneshot', unpairedAnnotation: true }),
    ]);

    expect(clean.trialDelta).toBe(-18);
    expect(clean.usable).toBe(true);
    expect(broken.pairViolations).toBe(1);
    expect(broken.voidReasons.some((reason) => reason.includes('成對性違規'))).toBe(true);
  });

  it('voids a run whose annotation landed inside a Pointer Lock break', () => {
    const [audit] = auditLiftRuns([
      liftRun({
        // 標註區間 [1000, 1200] 完全落在未取鎖區間 [900, 1300] 之內。
        extraEvents: [{ type: 'pointer_lock', locked: false, t: 900 }, { type: 'pointer_lock', locked: true, t: 1300 }],
      }),
    ]);

    expect(audit.annotationsInUnlocked).toBeGreaterThan(0);
    expect(audit.voidReasons.some((reason) => reason.includes('未取鎖區間'))).toBe(true);
  });

  it('counts candidate gaps at every frozen theta rather than at one chosen value', () => {
    // 三個空洞：20 / 40 / 60 ms ⇒ θ=18 抓到三個、θ=30 抓到兩個、θ=50 抓到一個。
    const [audit] = auditLiftRuns([
      liftRun({ trace: [move(50), gap(20), move(50), gap(40), move(50), gap(60), move(50)] }),
    ]);

    expect(audit.candidateCountsByTheta).toEqual([
      { thetaMs: 18, candidateCount: 3 },
      { thetaMs: 30, candidateCount: 2 },
      { thetaMs: 50, candidateCount: 1 },
    ]);
  });
});

describe('assessAnnotationChannel —— F3 檢定（step 4）', () => {
  it('reports usable when both groups self-report at the same latency', () => {
    const runs = latencyCohort(120, 120);
    const assessment = assessAnnotationChannel(runs, 30);

    expect(assessment.lift?.n).toBe(4);
    expect(assessment.pause?.n).toBe(4);
    expect(assessment.medianDiffMs).toBeCloseTo(0, 6);
    expect(assessment.verdict).toBe('usable');
  });

  it('declares the channel unusable when lift is systematically slower than pause', () => {
    // 300 ms vs 100 ms ⇒ 中位數差 200 ms > 150 ms 上限。匹配容差本身就會製造可分性假象。
    const assessment = assessAnnotationChannel(latencyCohort(300, 100), 30);

    expect(assessment.medianDiffMs).toBeCloseTo(200, 6);
    expect(assessment.verdict).toBe('annotation-channel-unusable');
    expect(assessment.reasons.some((reason) => reason.includes('系統性差異'))).toBe(true);
  });

  it('reports indeterminate — never usable — when one group has no samples at all', () => {
    // 這是本檔最重要的一條：沒有 pause run 時，「兩組無系統性差異」在邏輯上未被檢定。判 usable
    // 會讓一個從未做過的檢定看起來通過了。
    const liftOnly = latencyCohort(120, 120).filter((run) => run.audit.instructionClass === 'lift');
    const assessment = assessAnnotationChannel(liftOnly, 30);

    expect(assessment.pause).toBeUndefined();
    expect(assessment.medianDiffMs).toBeUndefined();
    expect(assessment.verdict).toBe('indeterminate');
    expect(assessment.reasons.some((reason) => reason.includes('這不是通過'))).toBe(true);
  });

  it('ignores voided runs, so a dirty run cannot rescue or poison the check', () => {
    const cohort = latencyCohort(120, 120);
    const withVoided = [
      ...cohort,
      ...latencyCohort(3000, 3000).map((run) => ({
        ...run,
        audit: { ...run.audit, usable: false, voidReasons: ['作廢（測試注入）'] },
      })),
    ];

    expect(assessAnnotationChannel(withVoided, 30).lift?.n).toBe(assessAnnotationChannel(cohort, 30).lift?.n);
  });
});

describe('assessCohortSufficiency —— 資料充分性判定（step 7）', () => {
  it('judges an empty cohort blocked-by-data and says how much is missing on every axis', () => {
    const sufficiency = assessCohortSufficiency([]);

    expect(sufficiency.verdict).toBe('blocked-by-data');
    expect(sufficiency.contract).toBe(LIFT_VALIDATION_CONTRACT);
    expect(sufficiency.shortfalls.some((line) => line.includes(`session 數 0 < ${MIN_SESSIONS}`))).toBe(true);
    expect(sufficiency.shortfalls.some((line) => line.includes(`lift 標註區間 0 < ${MIN_INTERVALS_PER_CLASS}`))).toBe(true);
    expect(sufficiency.shortfalls.some((line) => line.includes(`pause 標註區間 0 < ${MIN_INTERVALS_PER_CLASS}`))).toBe(true);
    expect(sufficiency.split).toBeUndefined();
  });

  it('counts only usable runs — a voided run does not close the gap it was recorded to close', () => {
    const audits = auditLiftRuns([
      liftRun({ sessionId: 's1', trials: 40, annotations: 40 }),
      // 同樣 40 個標註，但錄在 60 Hz ⇒ 作廢，不得計入充分性。
      liftRun({ sessionId: 's2', trials: 40, annotations: 40, meta: { displayHz: 60 } }),
    ]);
    const sufficiency = assessCohortSufficiency(audits);

    expect(sufficiency.usableRunCount).toBe(1);
    expect(sufficiency.voidedRunCount).toBe(1);
    expect(sufficiency.liftIntervals).toBe(40);
    expect(sufficiency.verdict).toBe('blocked-by-data');
    expect(sufficiency.shortfalls.some((line) => line.includes('session 數 1'))).toBe(true);
  });

  it('judges a cohort sufficient once every frozen floor is met', () => {
    const audits = auditLiftRuns([
      liftRun({ sessionId: 's1', instructionClass: 'lift', trials: 40, annotations: 40 }),
      liftRun({ sessionId: 's1', instructionClass: 'pause', trials: 40, annotations: 40 }),
      liftRun({ sessionId: 's2', instructionClass: 'lift', trials: 40, annotations: 40 }),
      liftRun({ sessionId: 's2', instructionClass: 'pause', trials: 40, annotations: 40 }),
    ]);
    const sufficiency = assessCohortSufficiency(audits);

    expect(audits.every((audit) => audit.usable)).toBe(true);
    expect(sufficiency.shortfalls).toEqual([]);
    expect(sufficiency.verdict).toBe('sufficient');
    expect(sufficiency.sessionCount).toBe(2);
    expect(sufficiency.liftIntervals).toBe(80);
    expect(sufficiency.split?.heldOutLiftIntervals).toBe(40);
    expect(sufficiency.split?.heldOutPauseIntervals).toBe(40);
  });
});

describe('splitBySession —— 校準／held-out 隔離（FR-61.7）', () => {
  it('never puts one session on both sides', () => {
    const audits = auditLiftRuns([
      liftRun({ sourcePath: 'a.json', sessionId: 's1' }),
      liftRun({ sourcePath: 'b.json', sessionId: 's1' }),
      liftRun({ sourcePath: 'c.json', sessionId: 's2' }),
      liftRun({ sourcePath: 'd.json', sessionId: 's2' }),
    ]);
    const split = splitBySession(audits);

    expect(split?.calibration).toEqual(['a.json', 'b.json']);
    expect(split?.heldOut).toEqual(['c.json', 'd.json']);
  });

  it('refuses to split a single-session cohort instead of cutting it in half', () => {
    const audits = auditLiftRuns([
      liftRun({ sourcePath: 'a.json', sessionId: 's1' }),
      liftRun({ sourcePath: 'b.json', sessionId: 's1' }),
    ]);

    expect(splitBySession(audits)).toBeUndefined();
  });
});

describe('sortLiftRunInputs —— 分割前的正規順序', () => {
  it('prefers recordedAt, falls back to the filename stamp, then to the manifest order', () => {
    const ordered = sortLiftRunInputs([
      { sourcePath: 'third.json', payload: liftPayload({}), order: 9 },
      { sourcePath: 'run-2026-09-15T02_20_00.000Z.json', payload: liftPayload({}) },
      { sourcePath: 'first.json', payload: liftPayload({}), recordedAt: '2026-09-15T01:00:00.000Z' },
      { sourcePath: 'run-2026-09-15T02_00_00.000Z.json', payload: liftPayload({}) },
    ] satisfies LiftRunInput[]);

    expect(ordered.map((input) => input.sourcePath)).toEqual([
      'first.json',
      'run-2026-09-15T02_00_00.000Z.json',
      'run-2026-09-15T02_20_00.000Z.json',
      'third.json',
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

type TraceStep = { readonly kind: 'move'; readonly samples: number } | { readonly kind: 'gap'; readonly ms: number };

function move(samples: number): TraceStep {
  return { kind: 'move', samples };
}

function gap(ms: number): TraceStep {
  return { kind: 'gap', ms };
}

function annotation(t: number, down: boolean): DrillEvent {
  return { type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down, t };
}

const SAMPLING_META = {
  recorded: 0,
  capacity: 144_000,
  overflow: false,
  timeSource: 'event.timeStamp',
  deltaUnit: 'counts',
  observedRateHz: 1000,
} as const;

/**
 * 一段原始取樣：`move(n)` 產 n 筆間隔 `sampleIntervalUs` 的樣本，`gap(ms)` 產一個該長度的空洞。
 * `dtUs[0]` 依契約恆為 0。
 */
function traceBlock(t0Ms: number, steps: readonly TraceStep[], sampleIntervalUs: number): MouseSampleBlock {
  const dtUs: number[] = [];
  for (const step of steps) {
    if (step.kind === 'gap') {
      dtUs.push(step.ms * 1000);
      continue;
    }
    for (let i = 0; i < step.samples; i++) dtUs.push(sampleIntervalUs);
  }
  if (dtUs.length > 0) dtUs[0] = 0;
  return {
    t0Ms,
    dtUs,
    dx: dtUs.map((_, i) => (i % 3) - 1),
    dy: dtUs.map(() => 0),
  };
}

interface LiftRunArgs {
  readonly sourcePath?: string;
  readonly sessionId?: string | undefined;
  readonly instructionClass?: InstructionClass | undefined;
  readonly meta?: Record<string, unknown>;
  readonly trace?: readonly TraceStep[] | undefined;
  readonly sampleIntervalUs?: number;
  readonly overflow?: boolean;
  readonly trials?: number;
  readonly annotations?: number;
  readonly annotationStartMs?: number;
  readonly annotationLatencyMs?: number;
  readonly unpairedAnnotation?: boolean;
  readonly extraEvents?: readonly DrillEvent[];
}

/** 預設形狀：240 Hz、COI、1000 Hz 取樣、4 個 peripheral trial、4 段成對標註、零 lock 中斷。 */
function liftPayload(args: LiftRunArgs): ExportPayload {
  const trials = args.trials ?? 4;
  const annotationCount = args.annotations ?? trials;
  const trace = 'trace' in args ? args.trace : [move(400), gap(200), move(400)];
  const block = trace === undefined ? undefined : traceBlock(1000, trace, args.sampleIntervalUs ?? 1000);

  const ticks: TickRecord[] = [];
  for (let i = 0; i < 60; i++) ticks.push(makeTick({ t: i * 10, dYaw: 0, dPitch: 0, tx: 6.2, ty: 1.5, tz: -5 }));

  const events: DrillEvent[] = [];
  for (let i = 0; i < trials; i++) {
    events.push({
      type: 'visible',
      targetId: `p${i}`,
      side: 'R',
      zone: 'peripheral',
      t: 1000 + i * 500,
      targetX: 6.2,
      targetY: 1.5,
      targetZ: -5,
    });
  }
  const annotationStartMs = args.annotationStartMs ?? 1000;
  const latency = args.annotationLatencyMs ?? 0;
  for (let i = 0; i < annotationCount; i++) {
    const start = annotationStartMs + latency + i * 500;
    events.push(annotation(start, true));
    events.push(annotation(start + 200, false));
  }
  if (args.unpairedAnnotation === true) events.push(annotation(annotationStartMs + annotationCount * 500 + 400, true));
  events.push(...(args.extraEvents ?? []));
  events.sort((a, b) => a.t - b.t);

  const payload = makePayload({
    meta: {
      drillId: 'spider-shot-wide-v1',
      sensitivity: 1,
      dpi: 800,
      fovDeg: 75,
      displayHz: REQUIRED_DISPLAY_HZ,
      crossOriginIsolated: true,
      ...(block !== undefined
        ? { mouseSampling: { ...SAMPLING_META, recorded: block.dtUs.length, overflow: args.overflow ?? false } }
        : {}),
      ...args.meta,
    } as never,
    ticks,
    events,
  });

  return block === undefined ? payload : { ...payload, mouseSamples: block };
}

function liftRun(args: LiftRunArgs): LiftRunInput {
  const sessionId = 'sessionId' in args ? args.sessionId : 's1';
  const instructionClass = 'instructionClass' in args ? args.instructionClass : ('lift' as InstructionClass);
  return {
    sourcePath: args.sourcePath ?? 'run.json',
    payload: liftPayload(args),
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(instructionClass !== undefined ? { instructionClass } : {}),
  };
}

/**
 * 兩份 run（一 lift 一 pause），每份四段標註，標註時刻各自落在空洞起點之後 `latencyMs`。
 * 空洞每 500 ms 一個 ⇒ 「最近的候選空洞起點」對每一段標註都是唯一的。
 */
function latencyCohort(liftLatencyMs: number, pauseLatencyMs: number) {
  const trace = [move(300), gap(200), move(300), gap(200), move(300), gap(200), move(300), gap(200), move(300)];
  const inputs = [
    liftRun({ sourcePath: 'lift.json', instructionClass: 'lift', trace, annotationLatencyMs: liftLatencyMs }),
    liftRun({ sourcePath: 'pause.json', instructionClass: 'pause', trace, annotationLatencyMs: pauseLatencyMs }),
  ];
  const audits = auditLiftRuns(inputs);
  return inputs.map((input, index) => ({ audit: audits[index], payload: input.payload }));
}
