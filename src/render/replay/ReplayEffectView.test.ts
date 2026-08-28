import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { ReplayEffectView } from './ReplayEffectView.ts';
import type { NormalizedReplayEvent, ReplayEffectState, ReplaySample } from '../../replay/contracts.ts';

function fireEffect(timeMs: number): ReplayEffectState {
  const raw: NormalizedReplayEvent['raw'] = { type: 'fire', t: timeMs, hit: false, firstShot: false, residualSpeed: 0 };
  return { event: { timeMs, sourceIndex: 0, raw } };
}

function hitEffect(timeMs: number, targetId?: string): ReplayEffectState {
  const raw: NormalizedReplayEvent['raw'] = {
    type: 'hit',
    t: timeMs,
    timeOfFlightMs: 0,
    shotSeq: 0,
    ...(targetId !== undefined ? { targetId } : {}),
  };
  return { event: { timeMs, sourceIndex: 0, raw } };
}

function sampleWith(effects: ReplayEffectState[], targets: ReplaySample['targets'] = []): ReplaySample {
  return {
    timeMs: 0,
    tickBefore: 0,
    tickAfter: 0,
    alpha: 0,
    camera: { yaw: 0, pitch: 0 },
    player: { px: 0, pz: 0, speed: 0 },
    input: { keys: [], ads: false },
    targets,
    effects,
    eventCursor: -1,
  };
}

describe('ReplayEffectView', () => {
  it('shows the hit marker at the matched target position when a hit event with that targetId is active', () => {
    const scene = new THREE.Scene();
    const view = new ReplayEffectView(scene);
    const camera = new THREE.PerspectiveCamera();

    view.sync(sampleWith([hitEffect(100, 't1')], [{ id: 't1', x: 1, y: 2, z: 3 }]), camera);

    expect(view.hitActive).toBe(true);
  });

  it('does not show the hit marker when the hit event targetId matches no currently sampled target', () => {
    const scene = new THREE.Scene();
    const view = new ReplayEffectView(scene);
    const camera = new THREE.PerspectiveCamera();

    view.sync(sampleWith([hitEffect(100, 'gone')], [{ id: 't2', x: 0, y: 0, z: 0 }]), camera);

    expect(view.hitActive).toBe(false);
  });

  it('falls back to the sole active target when the hit event omits targetId', () => {
    const scene = new THREE.Scene();
    const view = new ReplayEffectView(scene);
    const camera = new THREE.PerspectiveCamera();

    view.sync(sampleWith([hitEffect(100)], [{ id: 't1', x: 5, y: 5, z: 5 }]), camera);

    expect(view.hitActive).toBe(true);
  });

  it('shows the fire marker offset in front of the camera along its forward direction (identity orientation)', () => {
    const scene = new THREE.Scene();
    const view = new ReplayEffectView(scene);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 1.6, 4);
    camera.quaternion.identity(); // looking down -Z (three.js default forward)

    view.sync(sampleWith([fireEffect(100)]), camera);

    expect(view.fireActive).toBe(true);
  });

  it('hides both markers when there are no active effects (e.g. after a backward seek out of the window)', () => {
    const scene = new THREE.Scene();
    const view = new ReplayEffectView(scene);
    const camera = new THREE.PerspectiveCamera();

    view.sync(sampleWith([hitEffect(100, 't1'), fireEffect(100)], [{ id: 't1', x: 0, y: 0, z: 0 }]), camera);
    expect(view.hitActive).toBe(true);
    expect(view.fireActive).toBe(true);

    view.sync(sampleWith([]), camera); // seek away — window no longer contains any event
    expect(view.hitActive).toBe(false);
    expect(view.fireActive).toBe(false);
  });

  it('multiple hit events active at once: the last (most recent) one wins', () => {
    const scene = new THREE.Scene();
    const view = new ReplayEffectView(scene);
    const camera = new THREE.PerspectiveCamera();

    view.sync(
      sampleWith(
        [hitEffect(50, 't1'), hitEffect(90, 't2')],
        [
          { id: 't1', x: 1, y: 0, z: 0 },
          { id: 't2', x: 2, y: 0, z: 0 },
        ],
      ),
      camera,
    );

    expect(view.hitActive).toBe(true);
  });

  it('dispose() removes both marker meshes from the scene', () => {
    const scene = new THREE.Scene();
    const view = new ReplayEffectView(scene);
    expect(scene.children.length).toBe(2);

    view.dispose();

    expect(scene.children.length).toBe(0);
  });
});
