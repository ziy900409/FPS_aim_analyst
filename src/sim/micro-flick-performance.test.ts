import { performance } from 'node:perf_hooks';
import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { microFlickThreeTargetTestV1 } from '../drill/micro_flick_three_target_test_v1.ts';
import { microFlickThreeTargetTestV8 } from '../drill/micro_flick_three_target_test_v8.ts';
import { TargetView } from '../render/TargetView.ts';
import { createSharedState } from '../state/SharedState.ts';
import { createTargetManager } from './TargetManager.ts';

const WARM_ITERATIONS = 100;
const SAMPLES = 10_000;
const P95_LIMIT_MS = 1;

function percentile95(samples: readonly number[]): number {
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * 0.95) - 1] ?? 0;
}

describe('WP-56 T5 — warmed Micro Flick target/render performance gate', () => {
  it.each([
    ['legacy v1 first-valid sampling', microFlickThreeTargetTestV1.drill],
    ['WP-59 v8 ranked replacement sampling', microFlickThreeTargetTestV8.drill],
  ])('keeps TargetManager.tick + TargetView.sync P95 below 1 ms across 10,000 replacements: %s', (_label, drill) => {
    const state = createSharedState();
    // The practice fixture intentionally ends after 60 kills.  This benchmark measures the same
    // three-target hot path after warming, so it needs a finite budget large enough for all samples.
    const manager = createTargetManager({
      ...drill,
      targets: { ...drill.targets, count: WARM_ITERATIONS + SAMPLES + 3 },
      endCondition: { type: 'targetCount', value: WARM_ITERATIONS + SAMPLES + 3 },
    });
    const scene = new THREE.Scene();
    const view = new TargetView(scene);
    view.setShape('sphere');
    manager.tick(state, 0);
    view.sync(state.targets);

    let nowMs = 0;
    const replacement = (): void => {
      manager.markKilled(state, state.targets[0].id);
      nowMs += 1000 / 128;
      manager.tick(state, nowMs);
      view.sync(state.targets);
    };

    for (let iteration = 0; iteration < WARM_ITERATIONS; iteration++) replacement();

    const samples: number[] = [];
    for (let iteration = 0; iteration < SAMPLES; iteration++) {
      const startedAt = performance.now();
      replacement();
      samples.push(performance.now() - startedAt);
    }

    const p95Ms = percentile95(samples);
    const maxMs = Math.max(...samples);
    // Deliberately separate the measurement from assertions/serialization; this is the production
    // target-manager + render-pool hot path, not the slower property-test instrumentation.
    console.info(
      `[WP-56 T5 perf] target-manager+target-view: samples=${SAMPLES} warm=${WARM_ITERATIONS} p95=${p95Ms.toFixed(4)}ms max=${maxMs.toFixed(4)}ms`,
    );
    expect(p95Ms).toBeLessThan(P95_LIMIT_MS);
    expect(view.poolSize).toBe(3);
    expect(scene.children).toHaveLength(3);
    view.dispose();
  });
});
