import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { holdClickV1 } from './hold_click_v1.ts';
import { formatClearanceViolations, validateClearance } from '../scene/clearance.ts';
import { peekCorridor } from '../scene/scenes/peek-corridor.ts';

describe('hold_click_v1 scene-drill config', () => {
  it('declares the WP-33 assessment contract and required peek-corridor scene', () => {
    const cfg = loadDrill(holdClickV1.drill);

    expect(holdClickV1.id).toBe('hold_click_v1');
    expect(holdClickV1.sceneId).toBe('peek-corridor');
    expect(cfg.drillId).toBe('hold_click_v1');
    expect(cfg.mode).toBe('assessment');
    expect(cfg.sequence.seed).toBe(34034);
    expect(cfg.targets.motion).toEqual({
      type: 'linear',
      axis: 'horizontal',
      range: 4,
      speed: 4,
      spawnKind: 'slide-in',
    });
  });

  it('is rejected by strict clearance but accepted with explicit hold-click occlusion options', () => {
    const strict = validateClearance(peekCorridor, loadDrill(holdClickV1.drill));

    expect(strict.some((violation) => violation.propId === 'cover-wall'), formatClearanceViolations(strict)).toBe(
      true,
    );
    expect(() => loadDrill(holdClickV1.drill, peekCorridor)).toThrow(/cover-wall/);
    expect(() => loadDrill(holdClickV1.drill, peekCorridor, { clearance: holdClickV1.clearanceOptions })).not.toThrow();
  });

  it('freezes the T1 visibility-v1 candidate knobs for protocol-level metric assembly', () => {
    expect(holdClickV1.visibility).toEqual({ sampleCount: 9, onsetThreshold: 0.5 });
  });
});
