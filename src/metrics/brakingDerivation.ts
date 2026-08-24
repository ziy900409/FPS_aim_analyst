import type { ExportPayload } from '../data/export.ts';
import { CS2_PROFILE } from '../sim/MovementController.ts';
import { buildPeekWindows } from './peekWindows.ts';

export interface BrakingSample {
  readonly peekIndex: number;
  readonly side: 'L' | 'R';
  readonly timeToAccuracyGateMs?: number;
  readonly zeroCrossingMs?: number;
  readonly stopDistanceU?: number;
  readonly overReversalUPerS?: number;
  readonly flags: readonly string[];
}

/**
 * Derive per-peek braking measurements from the recorded movement trace.
 *
 * A first shot ends the usable braking trace: continuing to examine movement
 * after firing would mix this peek with the post-shot target lifecycle.
 */
export function deriveBrakingSamples(payload: ExportPayload): readonly BrakingSample[] {
  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  return buildPeekWindows(payload).map((peek) => {
    const flags: string[] = [];
    if (peek.tCounter === undefined) {
      return { peekIndex: peek.index, side: peek.side, flags: ['no_counter'] };
    }

    const endT = peek.tFirstShot ?? peek.tEnd;
    const windowTicks = ticks
      .slice(peek.tickRange.start, peek.tickRange.end)
      .filter((tick) => tick.t >= peek.tCounter! && tick.t <= endT);
    const counterTick = windowTicks[0];
    if (counterTick === undefined) {
      return { peekIndex: peek.index, side: peek.side, flags: ['no_counter_tick'] };
    }

    const gateTick = windowTicks.find((tick) => Math.abs(tick.vx) < CS2_PROFILE.accuracyThreshold);
    if (gateTick === undefined) flags.push('no_accuracy_gate');

    const initialSign = Math.sign(counterTick.vx);
    const zeroCrossingIndex =
      initialSign === 0 ? -1 : windowTicks.findIndex((tick) => Math.sign(tick.vx) === -initialSign);
    if (zeroCrossingIndex < 0) flags.push('no_zero_crossing');

    if (peek.tFirstShot !== undefined && zeroCrossingIndex < 0) flags.push('window_truncated_by_fire');

    const zeroCrossingTick = zeroCrossingIndex >= 0 ? windowTicks[zeroCrossingIndex] : undefined;
    const overReversalUPerS =
      zeroCrossingTick === undefined
        ? undefined
        : Math.max(...windowTicks.slice(zeroCrossingIndex).map((tick) => Math.abs(tick.vx)));

    return {
      peekIndex: peek.index,
      side: peek.side,
      ...(gateTick !== undefined ? { timeToAccuracyGateMs: gateTick.t - peek.tCounter } : {}),
      ...(zeroCrossingTick !== undefined ? { zeroCrossingMs: zeroCrossingTick.t - peek.tCounter } : {}),
      ...(gateTick !== undefined ? { stopDistanceU: Math.abs(gateTick.px - counterTick.px) } : {}),
      ...(overReversalUPerS !== undefined ? { overReversalUPerS } : {}),
      flags,
    };
  });
}
