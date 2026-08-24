import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { counterstrafeReversalV1 } from './counterstrafe_reversal_v1.ts';
import { buildPeekWindows } from '../metrics/peekWindows.ts';

describe('counterstrafe-reversal-v1 protocol', () => {
  it('validates as an assessment drill without a second target-expiry rule', () => {
    const cfg = loadDrill(counterstrafeReversalV1);

    expect(cfg.drillId).toBe('counterstrafe-reversal-v1');
    expect(cfg.mode).toBe('assessment');
    expect(cfg.cue).toEqual({ kind: 'hold-reversal', holdDurationMs: 500 });
    expect(cfg.timing.peekTimeoutMs).toBeUndefined();
    expect(cfg.timing.presentationMs).toBeUndefined();
  });

  it('supports the full cue → hold → reversal cue → counter → fire analysis sequence', () => {
    const [window] = buildPeekWindows({
      ticks: [],
      events: [
        { type: 'cue', t: 0, direction: 'A' },
        { type: 'visible', targetId: 't0', side: 'L', t: 0 },
        { type: 'cue', t: 500, direction: 'D' },
        { type: 'counter', key: 'D', t: 560 },
        { type: 'fire', targetId: 't0', t: 640, hit: true, firstShot: true, residualSpeed: 0 },
      ],
    });

    expect(window.cues).toEqual([
      { type: 'cue', t: 0, direction: 'A' },
      { type: 'cue', t: 500, direction: 'D' },
    ]);
    expect(window.tCounter).toBe(560);
    expect(window.tFirstShot).toBe(640);
  });
});
