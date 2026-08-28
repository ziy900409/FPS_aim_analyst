import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { normalizeReplayRecording } from '../../src/replay/normalizeReplayRecording.ts';
import { sampleReplay } from '../../src/replay/sampleReplay.ts';
import type { ReplayRecording } from '../../src/replay/contracts.ts';
import { ReplayTargetView } from '../../src/render/replay/ReplayTargetView.ts';
import { ReplayEffectView } from '../../src/render/replay/ReplayEffectView.ts';
import { makeMeta, makePayload, makeTick } from './fixtures.ts';

/**
 * WP-50 T4 DoD — "direct seek vs sequential state hash 等價；backward seek 無 target/effect 殘留"
 * (README §2.10/T4 DoD). `ReplayTargetView`/`ReplayEffectView` only depend on their CURRENT
 * `ReplaySample` (no cross-frame accumulator besides bounded mesh-pool reuse, which must not leak
 * visible state) — this drives real `sampleReplay()` output from a single fixture recording through
 * both a single direct seek and a full sequential walk, and asserts the rendered mesh state at the
 * same final `t` is identical either way.
 *
 * Fixture timeline (ms): target `t1` visible on ticks [500, 1500] (spawn/despawn boundaries at 400/1600
 * are target-absent, testing the discrete-hold edges too); `fire` at 600, `hit` (targetId t1) at 650 —
 * both fall inside EFFECT_WINDOW_MS (200ms) of t=700 but not of t=1000.
 */
function fixtureRecording(): ReplayRecording {
  const ticks = [];
  for (let ms = 0; ms <= 2000; ms += 100) {
    const hasTarget = ms >= 500 && ms <= 1500;
    ticks.push(
      makeTick({
        t: ms,
        ...(hasTarget ? { replayTargetId: 't1', tx: ms / 1000, ty: 0, tz: -5 } : {}),
      }),
    );
  }
  const payload = makePayload({
    meta: makeMeta({ drillId: 'hold_click_v1' }),
    ticks,
    events: [
      { type: 'fire', t: 600, hit: true, firstShot: true, residualSpeed: 0, targetId: 't1' },
      { type: 'hit', t: 650, timeOfFlightMs: 50, shotSeq: 0, targetId: 't1' },
    ],
  });
  const result = normalizeReplayRecording(payload);
  if (!result.ok) throw new Error('fixture recording must normalize ok');
  return result.recording;
}

interface VisualStateHash {
  readonly targetVisible: boolean;
  readonly targetPosition?: readonly [number, number, number];
  readonly hitActive: boolean;
  readonly fireActive: boolean;
}

function renderAt(recording: ReplayRecording, times: readonly number[]): VisualStateHash {
  const scene = new THREE.Scene();
  const targetView = new ReplayTargetView(scene, recording.targetHitbox);
  const effectView = new ReplayEffectView(scene);
  const camera = new THREE.PerspectiveCamera();

  let sample = sampleReplay(recording, times[0]);
  for (const t of times) {
    sample = sampleReplay(recording, t);
    targetView.sync(sample.targets);
    effectView.sync(sample, camera);
  }

  const targetMesh = scene.children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh && child.visible && child.geometry.type === 'BoxGeometry');

  return {
    targetVisible: sample.targets.length > 0,
    ...(targetMesh !== undefined ? { targetPosition: targetMesh.position.toArray() as [number, number, number] } : {}),
    hitActive: effectView.hitActive,
    fireActive: effectView.fireActive,
  };
}

describe('WP-50 T4 — ReplayTargetView/ReplayEffectView direct-seek vs sequential-walk parity', () => {
  const recording = fixtureRecording();

  it('inside both fire and hit windows (t=700): direct seek matches a full sequential walk from 0', () => {
    const direct = renderAt(recording, [700]);
    const sequential = renderAt(recording, Array.from({ length: 15 }, (_, i) => i * 50)); // 0..700 step 50

    expect(direct.targetVisible).toBe(true);
    expect(direct.hitActive).toBe(true);
    expect(direct.fireActive).toBe(true);
    expect(sequential).toEqual(direct);
  });

  it('outside the effect windows but target still alive (t=1000): direct seek matches sequential walk', () => {
    const direct = renderAt(recording, [1000]);
    const sequential = renderAt(recording, Array.from({ length: 21 }, (_, i) => i * 50)); // 0..1000

    expect(direct.targetVisible).toBe(true);
    expect(direct.hitActive).toBe(false);
    expect(direct.fireActive).toBe(false);
    expect(sequential).toEqual(direct);
  });

  it('after the target despawns (t=1800): direct seek matches sequential walk, target hidden', () => {
    const direct = renderAt(recording, [1800]);
    const sequential = renderAt(recording, Array.from({ length: 37 }, (_, i) => i * 50)); // 0..1800

    expect(direct.targetVisible).toBe(false);
    expect(sequential).toEqual(direct);
  });

  it('backward seek: scrubbing forward through the fire/hit window then back to t=0 leaves no residue', () => {
    const scene = new THREE.Scene();
    const targetView = new ReplayTargetView(scene, recording.targetHitbox);
    const effectView = new ReplayEffectView(scene);
    const camera = new THREE.PerspectiveCamera();

    // Forward through the window — markers become active.
    let sample = sampleReplay(recording, 700);
    targetView.sync(sample.targets);
    effectView.sync(sample, camera);
    expect(effectView.hitActive).toBe(true);
    expect(effectView.fireActive).toBe(true);

    // Seek backward to before the target ever spawns and before either event fires.
    sample = sampleReplay(recording, 0);
    targetView.sync(sample.targets);
    effectView.sync(sample, camera);

    expect(sample.targets.length).toBe(0);
    expect(effectView.hitActive).toBe(false);
    expect(effectView.fireActive).toBe(false);
    // Direct seek to t=0 from a fresh view must show the exact same (empty) state — no leftover pool growth artifacts.
    expect(renderAt(recording, [0])).toEqual({ targetVisible: false, hitActive: false, fireActive: false });
  });
});
