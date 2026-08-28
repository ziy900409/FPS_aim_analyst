import { describe, expect, it } from 'vitest';
import { normalizeReplayRecording } from '../../src/replay/normalizeReplayRecording.ts';
import { makePayload, makeTick } from './fixtures.ts';

describe('WP-50 T2 — normalizeReplayRecording', () => {
  it('zeroes the time origin to the first tick and derives durationMs from the last tick', () => {
    const payload = makePayload({
      ticks: [makeTick({ t: 1000 }), makeTick({ t: 1250 }), makeTick({ t: 1500 })],
    });

    const result = normalizeReplayRecording(payload);
    if (!result.ok) throw new Error(`expected ok: ${JSON.stringify(result)}`);

    expect(Array.from(result.recording.tickTimes)).toEqual([0, 250, 500]);
    expect(result.recording.ticks.map((tick) => tick.timeMs)).toEqual([0, 250, 500]);
    expect(result.recording.durationMs).toBe(500);
  });

  it('carries the classified support and drillId through unchanged', () => {
    const payload = makePayload({ ticks: [makeTick({ t: 0 })] });
    const result = normalizeReplayRecording(payload);
    if (!result.ok) throw new Error('expected ok');
    expect(result.recording.drillId).toBe('hold_click_v1');
    expect(result.recording.support.status).toBe('full');
  });

  it('returns unsupported (not a thrown error) for an unknown exact drillId, with no ticks/events built', () => {
    const payload = makePayload({ meta: { drillId: 'not-a-real-drill' }, ticks: [makeTick({ t: 0 })] });
    const result = normalizeReplayRecording(payload);
    expect(result).toEqual({ ok: false, status: 'unsupported', reasonCodes: ['UNKNOWN_EXACT_DRILL'] });
  });

  it('returns unsupported for empty ticks', () => {
    const payload = makePayload({ ticks: [] });
    const result = normalizeReplayRecording(payload);
    expect(result).toEqual({ ok: false, status: 'unsupported', reasonCodes: ['EMPTY_TICKS'] });
  });

  it('sorts events by normalized time with stable original-array-order tiebreak on duplicate timestamps', () => {
    const payload = makePayload({
      ticks: [makeTick({ t: 0 }), makeTick({ t: 100 })],
      events: [
        { type: 'ads', down: true, t: 100 },
        { type: 'cue', t: 50, direction: 'A' },
        { type: 'counter', key: 'A', t: 100 },
      ],
    });

    const result = normalizeReplayRecording(payload);
    if (!result.ok) throw new Error('expected ok');

    expect(result.recording.events.map((e) => e.raw.type)).toEqual(['cue', 'ads', 'counter']);
    expect(Array.from(result.recording.eventTimes)).toEqual([50, 100, 100]);
    // original payload.events indices preserved for the two same-time events, in source order
    expect(result.recording.events.map((e) => e.sourceIndex)).toEqual([1, 0, 2]);
  });

  it('passes meta.scene through as a ReplaySceneDescriptor when present, and omits it when absent', () => {
    const withScene = normalizeReplayRecording(makePayload({ ticks: [makeTick({ t: 0 })] }));
    if (!withScene.ok) throw new Error('expected ok');
    expect(withScene.recording.scene).toEqual({
      sceneId: 'peek-corridor',
      assetPackVersion: '1',
      clutterTier: 'low',
      fallback: false,
      eye: undefined,
    });

    const withoutScene = normalizeReplayRecording(makePayload({ meta: { scene: undefined }, ticks: [makeTick({ t: 0 })] }));
    if (!withoutScene.ok) throw new Error('expected ok');
    expect(withoutScene.recording.scene).toBeUndefined();
  });

  it('threads an optional runId through to the recording, and omits it when not given', () => {
    const payload = makePayload({ ticks: [makeTick({ t: 0 })] });
    const withRunId = normalizeReplayRecording(payload, { runId: 'run-42' });
    if (!withRunId.ok) throw new Error('expected ok');
    expect(withRunId.recording.runId).toBe('run-42');

    const withoutRunId = normalizeReplayRecording(payload);
    if (!withoutRunId.ok) throw new Error('expected ok');
    expect(withoutRunId.recording.runId).toBeUndefined();
  });
});
