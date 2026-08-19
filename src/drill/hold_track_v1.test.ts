import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { holdTrackV1 } from './hold_track_v1.ts';
import { formatClearanceViolations, validateClearance } from '../scene/clearance.ts';
import { peekCorridor } from '../scene/scenes/peek-corridor.ts';

describe('hold_track_v1 scene-drill config', () => {
  it('declares a seeded assessment protocol with a distinct target-stop policy', () => {
    const config = loadDrill(holdTrackV1.drill);

    expect(holdTrackV1.id).toBe('hold_track_v1');
    expect(holdTrackV1.sceneId).toBe('peek-corridor');
    expect(config.mode).toBe('assessment');
    expect(config.sequence).toEqual({ alternation: 'LR', seed: 35035, spawnDelayMsRange: [700, 1700] });
    expect(config.timing.trackingStopMs).toBe(1000);
    expect(config.timing.presentationMs).toBeUndefined();
    expect(config.targets.motion).toEqual({ type: 'linear', axis: 'horizontal', range: 4, speed: 4, spawnKind: 'slide-in' });
  });

  it('uses the explicit occlusion allowance required by the peek-corridor emergence path', () => {
    const config = loadDrill(holdTrackV1.drill);
    const strict = validateClearance(peekCorridor, config);

    expect(strict.some((violation) => violation.propId === 'cover-wall'), formatClearanceViolations(strict)).toBe(true);
    expect(() => loadDrill(holdTrackV1.drill, peekCorridor)).toThrow(/cover-wall/);
    expect(() => loadDrill(holdTrackV1.drill, peekCorridor, { clearance: holdTrackV1.clearanceOptions })).not.toThrow();
  });
});
