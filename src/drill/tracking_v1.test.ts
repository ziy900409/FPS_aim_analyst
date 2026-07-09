import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { trackingV1 } from './tracking_v1.ts';
import { collectMeta, DEFAULT_RNG_SEED, type SpawnMeta } from '../data/metadata.ts';

/** Build the export spawn meta exactly as `main.ts` does for the active drill (WP-18 / T5). */
function spawnMetaFor(cfg = loadDrill(trackingV1)): SpawnMeta {
  return {
    seed: cfg.sequence.seed ?? DEFAULT_RNG_SEED,
    ...(cfg.targets.spawnArea !== undefined ? { spawnArea: cfg.targets.spawnArea } : {}),
    ...(cfg.sequence.spawnDelayMsRange !== undefined ? { spawnDelayMsRange: cfg.sequence.spawnDelayMsRange } : {}),
    ...(cfg.targets.motion !== undefined ? { motion: cfg.targets.motion } : {}),
    ...(cfg.timing.presentationMs !== undefined ? { presentationMs: cfg.timing.presentationMs } : {}),
  };
}

describe('tracking_v1 drill config', () => {
  it('validates as a pure tracking drill with motion + timed presentation', () => {
    const cfg = loadDrill(trackingV1);

    expect(cfg.drillId).toBe('tracking_v1');
    expect(cfg.targets.count).toBe(10);
    // Motion is a T1-driven type with the field-low-compatible envelope fixed in T0 OQ-18.1.
    expect(cfg.targets.motion).toEqual({ type: 'pingpong', axis: 'horizontal', range: 1, speed: 2 });
    // timed presentation (T3): drives advance, not kill-to-advance; no peekTimeoutMs.
    expect(cfg.timing.presentationMs).toBe(2000);
    expect(cfg.timing.peekTimeoutMs).toBeUndefined();
    // seed recorded for reproducibility (metadata).
    expect(cfg.sequence.seed).toBe(18018);
    expect(cfg.endCondition).toEqual({ type: 'targetCount', value: 10 });
  });

  it('keeps the T0 OQ-18.1 field-low-compatible motion envelope bounds', () => {
    const motion = trackingV1.targets.motion!;
    expect(motion.axis).toBe('horizontal');
    expect(motion.range).toBeGreaterThanOrEqual(0.5);
    expect(motion.range).toBeLessThanOrEqual(1.5);
    expect(motion.speed).toBeGreaterThanOrEqual(1);
    expect(motion.speed).toBeLessThanOrEqual(4);
  });

  it('exports motion / seed / presentation reproduction meta (WP-18 T5 drill-registry 掛線)', () => {
    // 追蹤 drill 重現所需的三欄皆進 spawn meta（motion + seed + timed presentation 時長）。
    const spawn = spawnMetaFor();
    expect(spawn).toEqual({
      seed: 18018,
      motion: { type: 'pingpong', axis: 'horizontal', range: 1, speed: 2 },
      presentationMs: 2000,
    });
    // collectMeta 逐欄保留 spawn（含新增的 presentationMs 選填欄）→ 匯出 metadata 完整。
    const meta = collectMeta({
      drillId: trackingV1.drillId,
      backend: 'webgpu',
      displayHz: 144,
      sensitivity: 1,
      crossOriginIsolated: true,
      spawn,
    });
    expect(meta.spawn).toEqual(spawn);
  });
});
