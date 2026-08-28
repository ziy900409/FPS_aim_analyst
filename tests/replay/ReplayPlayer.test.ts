import { describe, expect, it } from 'vitest';
import { normalizeReplayRecording } from '../../src/replay/normalizeReplayRecording.ts';
import { createReplayPlayer } from '../../src/replay/ReplayPlayer.ts';
import { makePayload, makeTick } from './fixtures.ts';
import type { ReplayRecording } from '../../src/replay/contracts.ts';

function normalize(payload: Parameters<typeof makePayload>[0]): ReplayRecording {
  const result = normalizeReplayRecording(makePayload(payload));
  if (!result.ok) throw new Error(`expected ok: ${JSON.stringify(result)}`);
  return result.recording;
}

const LONG_RECORDING = normalize({
  ticks: [makeTick({ t: 0, px: 0 }), makeTick({ t: 1000, px: 100 })],
  events: [
    { type: 'cue', t: 200, direction: 'A' },
    { type: 'cue', t: 600, direction: 'D' },
  ],
});

describe('WP-50 T2 — ReplayPlayer: play/pause/seek/rate', () => {
  it('starts paused at t=0 and rate=1', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    expect(player.state).toEqual({ status: 'paused', timeMs: 0, rate: 1 });
  });

  it('advances time while playing, at the configured rate, driven only by injected frame(nowMs)', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.play();
    player.frame(1000); // establishes the anchor; no advance yet
    expect(player.state.timeMs).toBe(0);
    player.frame(1100); // 100ms of wall-clock elapsed at rate 1
    expect(player.state.timeMs).toBeCloseTo(100);
    player.frame(1200);
    expect(player.state.timeMs).toBeCloseTo(200);
  });

  it('does not advance time while paused, even across frame() calls', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.play();
    player.frame(0);
    player.frame(50);
    expect(player.state.timeMs).toBeCloseTo(50);
    player.pause();
    expect(player.state.status).toBe('paused');
    player.frame(500);
    player.frame(900);
    expect(player.state.timeMs).toBeCloseTo(50);
  });

  it('a rate change keeps the current time (no jump), and scales subsequent advancement', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.play();
    player.frame(0);
    player.frame(100); // t=100 at rate 1
    expect(player.state.timeMs).toBeCloseTo(100);

    player.setRate(2);
    expect(player.state.timeMs).toBeCloseTo(100); // unchanged by the rate switch itself
    player.frame(100); // re-anchor, no advance yet
    expect(player.state.timeMs).toBeCloseTo(100);
    player.frame(150); // 50ms wall-clock * rate 2 = 100ms sim time
    expect(player.state.timeMs).toBeCloseTo(200);
  });

  it('seeking mid-playback does not cause the next frame() to jump using stale elapsed time', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.play();
    player.frame(0);
    player.frame(100); // t=100
    player.seek(10);
    player.frame(150); // re-anchors at nowMs=150; no advance from the seek itself
    expect(player.state.timeMs).toBeCloseTo(10);
    player.frame(160); // now 10ms of real elapsed time
    expect(player.state.timeMs).toBeCloseTo(20);
  });

  it('reaches ended exactly at durationMs and clamps there, never overshooting', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.play();
    player.frame(0);
    player.frame(5000); // far past duration (1000ms)
    expect(player.state).toEqual({ status: 'ended', timeMs: 1000, rate: 1 });
  });

  it('pressing play again after ended restarts from 0', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.play();
    player.frame(0);
    player.frame(5000);
    expect(player.state.status).toBe('ended');
    player.play();
    expect(player.state).toEqual({ status: 'playing', timeMs: 0, rate: 1 });
  });

  it('seeking to exactly durationMs transitions straight to ended', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.seek(1000);
    expect(player.state.status).toBe('ended');
  });

  it('seeking away from the end while ended returns to paused', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.seek(1000);
    expect(player.state.status).toBe('ended');
    player.seek(500);
    expect(player.state).toEqual({ status: 'paused', timeMs: 500, rate: 1 });
  });

  it('clamps seek targets outside [0, durationMs]', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.seek(-500);
    expect(player.state.timeMs).toBe(0);
    player.seek(999999);
    expect(player.state.timeMs).toBe(1000);
  });
});

describe('WP-50 T2 — ReplayPlayer: event navigation', () => {
  it('nextEvent jumps to the next event time and previousEvent back to the one before it', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.nextEvent();
    expect(player.state.timeMs).toBe(200);
    player.nextEvent();
    expect(player.state.timeMs).toBe(600);
    player.previousEvent();
    expect(player.state.timeMs).toBe(200);
  });

  it('is disabled (a no-op) past the last/first event, never wrapping', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.seek(700);
    player.nextEvent();
    expect(player.state.timeMs).toBe(700); // no event after 700 -> stays put

    player.seek(100);
    player.previousEvent();
    expect(player.state.timeMs).toBe(100); // no event before 100 -> stays put
  });

  it('an event jump preserves the current playing/paused status (README FR: preserves play state)', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.play();
    player.frame(0);
    player.nextEvent();
    expect(player.state.status).toBe('playing');
  });
});

describe('WP-50 T2 — ReplayPlayer: dispose', () => {
  it('rejects every method after dispose, so no sample can be published post-dispose', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.dispose();
    expect(() => player.frame(0)).toThrow();
    expect(() => player.play()).toThrow();
    expect(() => player.pause()).toThrow();
    expect(() => player.seek(0)).toThrow();
    expect(() => player.setRate(2)).toThrow();
    expect(() => player.previousEvent()).toThrow();
    expect(() => player.nextEvent()).toThrow();
  });
});

describe('WP-50 T2 — ReplayPlayer: any command sequence to the same t agrees with a direct seek', () => {
  it('play/frame/setRate/pause sequences land on the same ReplaySample as seek(t) alone', () => {
    const player = createReplayPlayer(LONG_RECORDING);
    player.play();
    player.frame(0);
    player.frame(37);
    player.setRate(2);
    player.frame(37); // re-anchor
    player.frame(87); // +50ms wall-clock * rate 2 = +100ms sim time -> t = 37+100 = 137
    player.pause();
    expect(player.state.timeMs).toBeCloseTo(137);

    const sampleFromSequence = player.frame(9999); // paused: frame() must not advance further

    const viaDirectSeek = createReplayPlayer(LONG_RECORDING);
    viaDirectSeek.seek(player.state.timeMs);
    const sampleFromDirectSeek = viaDirectSeek.frame(0);

    expect(sampleFromSequence).toEqual(sampleFromDirectSeek);
  });
});
