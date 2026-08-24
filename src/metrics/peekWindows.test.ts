import { describe, expect, it } from 'vitest';
import { buildPeekWindows } from './peekWindows.ts';

describe('buildPeekWindows — counter-strafe cues', () => {
  it('attaches each foreperiod cue to its corresponding visible target in chronological order', () => {
    const windows = buildPeekWindows({
      ticks: [],
      events: [
        { type: 'cue', t: 100, direction: 'A' },
        { type: 'visible', targetId: 't0', side: 'L', t: 200 },
        { type: 'counter', key: 'D', t: 260 },
        { type: 'cue', t: 350, direction: 'D' },
        { type: 'visible', targetId: 't1', side: 'R', t: 500 },
      ],
    });

    expect(windows[0].cues).toEqual([{ type: 'cue', t: 100, direction: 'A' }]);
    expect(windows[1].cues).toEqual([{ type: 'cue', t: 350, direction: 'D' }]);
    expect(windows.every((window) => window.cues.every((cue) => cue.t < window.tVisible))).toBe(true);
  });

  it('preserves the empty cues array for legacy payloads', () => {
    const [window] = buildPeekWindows({
      ticks: [],
      events: [{ type: 'visible', targetId: 't0', side: 'L', t: 200 }],
    });

    expect(window.cues).toEqual([]);
  });
});
