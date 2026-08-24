import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { counterstrafeCuedV1 } from './counterstrafe_cued_v1.ts';
import { buildPeekWindows } from '../metrics/peekWindows.ts';

describe('counterstrafe-cued-v1 protocol', () => {
  it('validates as an assessment drill with a fixed positive cue foreperiod', () => {
    const cfg = loadDrill(counterstrafeCuedV1);

    expect(cfg.drillId).toBe('counterstrafe-cued-v1');
    expect(cfg.mode).toBe('assessment');
    expect(cfg.cue).toEqual({ kind: 'single' });
    expect(cfg.sequence.spawnDelayMsRange).toEqual([500, 500]);
  });

  it('supports the full cue → visible → counter → fire analysis sequence', () => {
    const [window] = buildPeekWindows({
      ticks: [],
      events: [
        { type: 'cue', t: 0, direction: 'A' },
        { type: 'visible', targetId: 't0', side: 'L', t: 500 },
        { type: 'counter', key: 'D', t: 670 },
        { type: 'fire', targetId: 't0', t: 740, hit: true, firstShot: true, residualSpeed: 0 },
      ],
    });

    expect(window.cues).toEqual([{ type: 'cue', t: 0, direction: 'A' }]);
    expect(window.tCounter).toBe(670);
    expect(window.tFirstShot).toBe(740);
  });
});
