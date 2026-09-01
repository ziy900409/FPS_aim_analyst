import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { formatClearanceViolations, validateClearance } from '../scene/clearance.ts';
import { peekAdCorridor } from '../scene/scenes/peek-ad-corridor.ts';
import { angularSizeToHitboxWidthU, PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG } from './peek_click_transfer_pilot_v1.ts';
import { PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG } from './peek_click_transfer_pilot_v2.ts';
import {
  peekClickTransferV1,
  PEEK_CLICK_TRANSFER_V1_ANGULAR_SIZE_DEG,
  PEEK_CLICK_TRANSFER_V1_DISTANCE_U,
  PEEK_CLICK_TRANSFER_V1_ID,
  PEEK_CLICK_TRANSFER_V1_PROTOCOL_VERSION,
} from './peek_click_transfer_v1.ts';

/**
 * WP-53 / T1 — formal Assessment config tests. Frozen by GD-29 (2026-09-01) — see
 * `peek_click_transfer_v1.ts`'s file header for the evidence behind `angularSizeDeg=2.5`.
 */
describe('peek_click_transfer_v1 formal config (WP-53 T1, GD-29 formal freeze)', () => {
  it('uses a formal-only drill id and assessment mode, distinct from every pilot id', () => {
    expect(peekClickTransferV1.id).toBe(PEEK_CLICK_TRANSFER_V1_ID);
    expect(peekClickTransferV1.id).toBe('peek_click_transfer_v1');
    expect(peekClickTransferV1.drill.drillId).toBe(peekClickTransferV1.id);
    expect(peekClickTransferV1.drill.mode).toBe('assessment');
    expect(peekClickTransferV1.id).not.toMatch(/pilot/);
  });

  it('declares the scene/cue/count/timeout/visibility/hitbox contract', () => {
    expect(peekClickTransferV1.sceneId).toBe('peek-ad-corridor-v1');
    expect(peekClickTransferV1.visibility).toEqual({ sampleCount: 9, onsetThreshold: 0.5 });
    expect(peekClickTransferV1.drill.cue).toEqual({ kind: 'single' });
    expect(peekClickTransferV1.drill.targets.count).toBe(20);
    expect(peekClickTransferV1.drill.targets.distance).toBe(PEEK_CLICK_TRANSFER_V1_DISTANCE_U);
    expect(peekClickTransferV1.drill.timing).toEqual({
      countdownMs: 3000,
      peekTimeoutMs: 3000,
      timeLimitMs: 120000,
    });
    expect(peekClickTransferV1.drill.endCondition).toEqual({ type: 'targetCount', value: 20 });

    const expectedWidthU = angularSizeToHitboxWidthU(
      PEEK_CLICK_TRANSFER_V1_ANGULAR_SIZE_DEG,
      PEEK_CLICK_TRANSFER_V1_DISTANCE_U,
    );
    expect(peekClickTransferV1.drill.targets.hitbox).toEqual({
      widthU: expectedWidthU,
      heightU: expectedWidthU,
      depthU: 1,
    });
  });

  it('carries a seed disjoint from every pilot v1/v2 seed, so exports can never collide across cohorts', () => {
    const v1Seeds = new Set(PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG.map((deg) => 94000 + Math.round(deg * 10)));
    const v2Seeds = new Set([
      ...PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG.map((deg) => 95000 + Math.round(deg * 10)),
      95100,
      95200,
    ]);
    const seed = peekClickTransferV1.drill.sequence.seed!;
    expect(v1Seeds.has(seed)).toBe(false);
    expect(v2Seeds.has(seed)).toBe(false);
  });

  it('validates through loadDrill against peek-ad-corridor-v1 with its own clearance options', () => {
    const strict = validateClearance(peekAdCorridor, loadDrill(peekClickTransferV1.drill));
    const strictIds = new Set(strict.map((v) => v.propId));
    expect(strictIds.has('cover-wall-l'), formatClearanceViolations(strict)).toBe(true);
    expect(strictIds.has('cover-wall-r'), formatClearanceViolations(strict)).toBe(true);
    expect(() => loadDrill(peekClickTransferV1.drill, peekAdCorridor)).toThrow(/cover-wall/);
    expect(() =>
      loadDrill(peekClickTransferV1.drill, peekAdCorridor, { clearance: peekClickTransferV1.clearanceOptions }),
    ).not.toThrow();
  });

  it('carries the GD-29 formal freeze values — protocol version and the 2.5deg candidate', () => {
    expect(peekClickTransferV1.protocolVersion).toBe(PEEK_CLICK_TRANSFER_V1_PROTOCOL_VERSION);
    expect(peekClickTransferV1.protocolVersion).toBe('peek-click-transfer-v1.0.0');
    expect(peekClickTransferV1.protocolVersion).not.toContain('provisional');
    expect(PEEK_CLICK_TRANSFER_V1_ANGULAR_SIZE_DEG).toBe(2.5);
  });
});
