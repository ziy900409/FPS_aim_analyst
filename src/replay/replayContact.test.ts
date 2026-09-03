import { describe, expect, expectTypeOf, it } from 'vitest';
import type { TrackingContactArtifact } from '../metrics/trackingContactArtifact.ts';
import type { TrackingContactSample } from '../metrics/trackingContact.ts';
import {
  buildReplayContactTrace,
  renderReplayContactTraceHtml,
  sampleReplayContact,
  sampleReplayContactArtifact,
  type ReplayContactFrame,
} from './replayContact.ts';

const TARGET_1 = { x: 0, y: 1.6, z: -4 };
const TARGET_2 = { x: 2, y: 1.4, z: -8 };
const AIM_1 = { yaw: 0, pitch: 0 };
const AIM_2 = { yaw: -0.25, pitch: 0.1 };

describe('sampleReplayContact — WP-55 T4 replay/contact alignment', () => {
  it('freezes the available and unavailable frame contracts', () => {
    expectTypeOf<ReplayContactFrame>().toMatchTypeOf<
      | {
          status: 'available';
          replayTimeMs: number;
          sampleIndex: number;
          t: number;
          targetId: string;
          target: unknown;
          aim: unknown;
          onTarget: boolean;
          epsilonDeg: number;
          presentationIndex: number;
          trackingWindow: string;
        }
      | {
          status: 'unavailable';
          replayTimeMs: number;
          sampleIndex: null;
          t: null;
          targetId: null;
          target: null;
          aim: null;
          onTarget: null;
          epsilonDeg: null;
          presentationIndex: null;
          trackingWindow: null;
          reason: string;
        }
    >();
  });

  it('returns the exact contact row at an exact replay time', () => {
    const frame = sampleReplayContact(samples(), 10);

    expect(frame).toEqual({
      status: 'available',
      replayTimeMs: 10,
      sampleIndex: 1,
      t: 10,
      targetId: 'target-1',
      target: TARGET_1,
      aim: AIM_1,
      onTarget: true,
      epsilonDeg: 0,
      presentationIndex: 0,
      trackingWindow: 'pursuit',
    });
  });

  it('samples between ticks from the latest same-presentation row', () => {
    const frame = sampleReplayContact(samples(), 15);

    expect(frame).toMatchObject({
      status: 'available',
      replayTimeMs: 15,
      sampleIndex: 1,
      t: 10,
      targetId: 'target-1',
      onTarget: true,
      epsilonDeg: 0,
    });
  });

  it('returns unavailable before the first sample instead of fake off-target', () => {
    expect(sampleReplayContact(samples(), -1)).toEqual({
      status: 'unavailable',
      replayTimeMs: -1,
      sampleIndex: null,
      t: null,
      targetId: null,
      target: null,
      aim: null,
      onTarget: null,
      epsilonDeg: null,
      presentationIndex: null,
      trackingWindow: null,
      reason: 'before-first-sample',
    });
  });

  it('holds the last contact row after the final sample', () => {
    expect(sampleReplayContact(samples(), 999)).toMatchObject({
      status: 'available',
      replayTimeMs: 999,
      sampleIndex: 3,
      t: 100,
      targetId: 'target-2',
      target: TARGET_2,
      aim: AIM_2,
      onTarget: false,
      epsilonDeg: 7.5,
      presentationIndex: 1,
    });
  });

  it('returns unavailable for an empty or inter-presentation missing sample', () => {
    expect(sampleReplayContact([], 0)).toMatchObject({ status: 'unavailable', reason: 'empty-samples' });

    const frame = sampleReplayContact([contactSample({ t: 0 }), contactSample({ t: 100, targetId: 'target-2', presentationIndex: 1 })], 50);

    expect(frame).toMatchObject({
      status: 'unavailable',
      replayTimeMs: 50,
      targetId: null,
      onTarget: null,
      epsilonDeg: null,
      reason: 'missing-sample',
    });
  });

  it('does not carry contact across a presentation boundary', () => {
    const rows = [
      contactSample({ t: 0, targetId: 'target-1', presentationIndex: 0, onTarget: true }),
      contactSample({ t: 100, targetId: 'target-2', presentationIndex: 1, target: TARGET_2, aim: AIM_2, onTarget: false }),
    ];

    expect(sampleReplayContact(rows, 99.9)).toMatchObject({ status: 'unavailable', reason: 'missing-sample' });
    expect(sampleReplayContact(rows, 100)).toMatchObject({
      status: 'available',
      t: 100,
      targetId: 'target-2',
      target: TARGET_2,
      aim: AIM_2,
      onTarget: false,
      presentationIndex: 1,
    });
  });

  it('is deterministic under seek, playback, and rate-change query order', () => {
    const rows = samples();
    const seekTimes = [0, 5, 10, 15, 20, 100];
    const playbackTimes = [0, 5, 10, 15, 20, 100];
    const rateChangeTimes = [0, 10, 5, 20, 15, 100, 15];

    for (const t of seekTimes) {
      const expected = sampleReplayContact(rows, t);
      expect(playbackTimes.map((time) => sampleReplayContact(rows, time)).find((frame) => frame.replayTimeMs === t)).toEqual(expected);
      expect(rateChangeTimes.map((time) => sampleReplayContact(rows, time)).filter((frame) => frame.replayTimeMs === t)).toContainEqual(expected);
    }
  });
});

describe('replay contact artifact trace', () => {
  it('maps a blocked contact artifact to a reason-coded unavailable frame', () => {
    expect(sampleReplayContactArtifact(blockedArtifact(), 25)).toEqual({
      status: 'unavailable',
      replayTimeMs: 25,
      sampleIndex: null,
      t: null,
      targetId: null,
      target: null,
      aim: null,
      onTarget: null,
      epsilonDeg: null,
      presentationIndex: null,
      trackingWindow: null,
      reason: 'blocked-artifact',
      reasons: ['missing-eye-origin'],
    });
  });

  it('builds a deterministic JSON trace with replay frame/contact row parity', () => {
    const artifact = okArtifact(samples());
    const first = buildReplayContactTrace(artifact, { replayTimesMs: [0, 15, 99.9, 100] });
    const second = buildReplayContactTrace(artifact, { replayTimesMs: [0, 15, 99.9, 100] });

    expect(second).toEqual(first);
    expect(first.frames.map((frame) => [frame.replayTimeMs, frame.t, frame.targetId, frame.onTarget, frame.epsilonDeg])).toEqual([
      [0, 0, 'target-1', false, 6],
      [15, 10, 'target-1', true, 0],
      [99.9, null, null, null, null],
      [100, 100, 'target-2', false, 7.5],
    ]);
  });

  it('renders a self-contained HTML trace with text labels for contact state and blocked reasons', () => {
    const html = renderReplayContactTraceHtml(blockedArtifact(), { replayTimesMs: [0] });
    const embedded = html.match(/<script type="application\/json" id="replay-contact-trace-data">(.+)<\/script>/)?.[1];

    expect(html).toContain('<style>');
    expect(html).not.toContain('<script src=');
    expect(html).not.toContain('<link rel=');
    expect(html).toContain('on-target');
    expect(html).toContain('off-target');
    expect(html).toContain('unavailable: ');
    expect(embedded).toBeDefined();
    expect(JSON.parse(embedded!)).toMatchObject({
      traceSchemaVersion: 'replay-contact-trace-v1',
      generatedFrom: 'tracking-contact-artifact',
      contactArtifact: { status: 'blocked', reasons: ['missing-eye-origin'] },
      frames: [{ status: 'unavailable', reason: 'blocked-artifact', reasons: ['missing-eye-origin'] }],
    });
  });
});

function samples(): TrackingContactSample[] {
  return [
    contactSample({ t: 0, onTarget: false, epsilonDeg: 6, trackingWindow: 'pre-acquire' }),
    contactSample({ t: 10, onTarget: true, epsilonDeg: 0, trackingWindow: 'pursuit' }),
    contactSample({ t: 20, onTarget: true, epsilonDeg: 0.5, trackingWindow: 'pursuit' }),
    contactSample({ t: 100, targetId: 'target-2', target: TARGET_2, aim: AIM_2, onTarget: false, epsilonDeg: 7.5, presentationIndex: 1 }),
  ];
}

function contactSample(overrides: Partial<TrackingContactSample> = {}): TrackingContactSample {
  return {
    t: 0,
    targetId: 'target-1',
    target: TARGET_1,
    aim: AIM_1,
    onTarget: true,
    epsilonDeg: 0,
    presentationIndex: 0,
    trackingWindow: 'pursuit',
    ...overrides,
  };
}

function okArtifact(rows: readonly TrackingContactSample[]): TrackingContactArtifact {
  return {
    artifactSchemaVersion: 'tracking-contact-artifact-v1',
    analysisVersion: 'tracking-contact-v1',
    generatedFrom: 'export-derived',
    status: 'ok',
    sourceId: 'run-001',
    sourceIdKind: 'sourceRunId',
    sourceRunId: 'run-001',
    drillId: 'tracking_v1',
    schemaVersion: 2,
    simHz: 128,
    startedAt: '2026-09-03T04:00:00.000Z',
    geometry: {
      hitbox: { source: 'default-h1', widthU: 1, heightU: 2, depthU: 1, shape: 'box' },
      eyeOrigin: { source: 'meta', x: 0, y: 1.6, z: 0, simToWorld: 1 },
    },
    sampleCount: rows.length,
    samples: rows,
  };
}

function blockedArtifact(): TrackingContactArtifact {
  return {
    artifactSchemaVersion: 'tracking-contact-artifact-v1',
    analysisVersion: 'tracking-contact-v1',
    generatedFrom: 'export-derived',
    status: 'blocked',
    drillId: 'tracking_v1',
    schemaVersion: 2,
    simHz: 128,
    geometry: {
      hitbox: { source: 'default-h1', widthU: 1, heightU: 2, depthU: 1, shape: 'box' },
      eyeOrigin: null,
    },
    sampleCount: 0,
    reasons: ['missing-eye-origin'],
  };
}
