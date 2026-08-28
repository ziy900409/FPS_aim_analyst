import type { ReplayPlaybackState, ReplayPlayer, ReplayRate, ReplayRecording, ReplaySample } from './contracts.ts';
import { createReplaySampleBuffer, sampleReplay, type ReplaySampleBuffer } from './sampleReplay.ts';

/**
 * WP-50 / T2 — injected-clock playback state machine (README §2.6). Owns no timer/rAF/DOM of its
 * own: the caller (a later presentation coordinator, T3) drives it by calling `frame(nowMs)` once
 * per app frame, passing whatever wall-clock/measurement-clock source it already owns. This keeps
 * the replay domain free of wall-clock/random/DOM imports (README §2.1) and makes every transition
 * deterministically testable with a fake clock (`frame` takes an explicit `nowMs`, never reads one).
 */
export function createReplayPlayer(recording: ReplayRecording, options: { readonly initialTimeMs?: number } = {}): ReplayPlayer {
  let status: ReplayPlaybackState['status'] = 'paused';
  let timeMs = clamp(options.initialTimeMs ?? 0, 0, recording.durationMs);
  let rate: ReplayRate = 1;
  // `undefined` = no anchor yet; the next `frame()` call establishes one without advancing time.
  // Reset on play/seek/setRate so a stale wall-clock gap (tab hidden, a rate change, a seek) never
  // gets misread as playback progress (README §2.6 "play/seek/rate/visibility change 重設 anchor").
  let lastFrameNowMs: number | undefined;
  let disposed = false;
  const buffer: ReplaySampleBuffer = createReplaySampleBuffer();

  function assertNotDisposed(): void {
    if (disposed) throw new Error('ReplayPlayer: cannot use a disposed player');
  }

  function resetAnchor(): void {
    lastFrameNowMs = undefined;
  }

  // Shared by the public `seek()` and by `previousEvent()`/`nextEvent()` (which are seeks to a
  // computed target time) — defined as a plain closure, not a `this`-bound object method, so it
  // behaves the same whether a caller destructures the returned player's methods or not.
  function doSeek(target: number): void {
    const clamped = clamp(target, 0, recording.durationMs);
    timeMs = clamped;
    if (clamped >= recording.durationMs) {
      status = 'ended';
    } else if (status === 'ended') {
      status = 'paused';
    }
    if (status === 'playing') resetAnchor();
  }

  return {
    get state(): ReplayPlaybackState {
      return { status, timeMs, rate } as ReplayPlaybackState;
    },

    play(): void {
      assertNotDisposed();
      if (status === 'ended') timeMs = 0;
      status = 'playing';
      resetAnchor();
    },

    pause(): void {
      assertNotDisposed();
      if (status === 'playing') status = 'paused';
      resetAnchor();
    },

    seek(target: number): void {
      assertNotDisposed();
      doSeek(target);
    },

    setRate(next: ReplayRate): void {
      assertNotDisposed();
      rate = next;
      if (status === 'playing') resetAnchor();
    },

    frame(nowMs: number): ReplaySample {
      assertNotDisposed();
      if (status === 'playing') {
        if (lastFrameNowMs !== undefined) {
          const elapsed = (nowMs - lastFrameNowMs) * rate;
          const next = timeMs + elapsed;
          if (next >= recording.durationMs) {
            timeMs = recording.durationMs;
            status = 'ended';
          } else {
            timeMs = Math.max(0, next);
          }
        }
        lastFrameNowMs = nowMs;
      }
      return sampleReplay(recording, timeMs, buffer);
    },

    previousEvent(): void {
      assertNotDisposed();
      const index = indexOfLastEventStrictlyBefore(recording.eventTimes, timeMs);
      if (index < 0) return;
      doSeek(recording.eventTimes[index]);
    },

    nextEvent(): void {
      assertNotDisposed();
      const index = indexOfFirstEventStrictlyAfter(recording.eventTimes, timeMs);
      if (index < 0) return;
      doSeek(recording.eventTimes[index]);
    },

    dispose(): void {
      disposed = true;
    },
  };
}

/** Largest index `i` with `eventTimes[i] < t`, or `-1` if none (`t` is at-or-before the first event,
 * or there are no events). Never wraps past the start (README §2.6 "到邊界 disabled，不 wrap"). */
function indexOfLastEventStrictlyBefore(eventTimes: Float64Array, t: number): number {
  const n = eventTimes.length;
  if (n === 0 || eventTimes[0] >= t) return -1;
  let lo = 0;
  let hi = n - 1;
  if (eventTimes[hi] < t) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (eventTimes[mid] < t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Smallest index `i` with `eventTimes[i] > t`, or `-1` if none. */
function indexOfFirstEventStrictlyAfter(eventTimes: Float64Array, t: number): number {
  const n = eventTimes.length;
  if (n === 0 || eventTimes[n - 1] <= t) return -1;
  let lo = 0;
  let hi = n - 1;
  if (eventTimes[0] > t) return 0;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (eventTimes[mid] > t) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
