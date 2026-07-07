import { describe, expect, it } from 'vitest';
import drillJson from '../../../drills/counterstrafe_ad_v1.json';
import { loadDrill } from '../../drill/DrillLoader.ts';
import { validateClearance, formatClearanceViolations } from '../clearance.ts';
import { fieldLow } from './field-low.ts';

describe('field-low SceneConfig', () => {
  it('通過 validateScene(模組載入即自驗)並帶 GLTF 資產', () => {
    expect(fieldLow.sceneId).toBe('field-low');
    expect(fieldLow.clutterTier).toBe('low');
    expect(fieldLow.asset).toEqual({ url: '/assets/scenes/field-low/field-low.gltf', displayScale: 1 });
    expect(fieldLow.propBounds.length).toBeGreaterThan(0);
    expect(fieldLow.propBounds.length).toBeLessThanOrEqual(25); // 低雜亂度預算(T0/GD-9)
  });

  it('每個 propBound min <= max(合法 AABB)', () => {
    for (const p of fieldLow.propBounds) {
      expect(p.min.x).toBeLessThanOrEqual(p.max.x);
      expect(p.min.y).toBeLessThanOrEqual(p.max.y);
      expect(p.min.z).toBeLessThanOrEqual(p.max.z);
    }
  });

  it('field-low × 現行 counter-strafe drill 淨空驗證零違規(DrillLoader 不拒載)', () => {
    const drill = loadDrill(drillJson);
    const violations = validateClearance(fieldLow, drill);
    expect(violations, formatClearanceViolations(violations)).toEqual([]);
    // 端到端:帶 scene 的 loadDrill 不 throw(淨空門放行)。
    expect(() => loadDrill(drillJson, fieldLow)).not.toThrow();
  });
});
