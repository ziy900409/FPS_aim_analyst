import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { SceneManager } from '../SceneManager.ts';
import { placeholderRoom } from '../../scene/scenes/placeholder-room.ts';
import { resolveEyeWorldBase } from '../../scene/eyePose.ts';
import { SIM_TO_WORLD } from '../../loop/constants.ts';
import type { ReplaySample } from '../../replay/contracts.ts';
import { ReplaySceneAdapter } from './ReplaySceneAdapter.ts';

function sample(overrides: { yaw?: number; pitch?: number; px?: number; pz?: number }): ReplaySample {
  return {
    timeMs: 0,
    tickBefore: 0,
    tickAfter: 0,
    alpha: 0,
    camera: { yaw: overrides.yaw ?? 0, pitch: overrides.pitch ?? 0 },
    player: { px: overrides.px ?? 0, pz: overrides.pz ?? 0, speed: 0 },
    input: { keys: [], ads: false },
    targets: [],
    effects: [],
    eventCursor: -1,
  };
}

describe('ReplaySceneAdapter', () => {
  it('sets camera position = eye base + (px, pz) × SIM_TO_WORLD — mirrors the live render loop formula', () => {
    const sceneManager = new SceneManager(placeholderRoom);
    const adapter = new ReplaySceneAdapter(sceneManager, placeholderRoom);
    const eye = resolveEyeWorldBase(placeholderRoom);

    adapter.applySample(sample({ px: 2.5, pz: -1.25 }));

    expect(sceneManager.camera.position.x).toBeCloseTo(eye.x + 2.5 * SIM_TO_WORLD, 10);
    expect(sceneManager.camera.position.y).toBeCloseTo(eye.y, 10);
    expect(sceneManager.camera.position.z).toBeCloseTo(eye.z + -1.25 * SIM_TO_WORLD, 10);
  });

  it('composes quaternion = qYaw(yaw) · qPitch(pitch) — same order as CameraController#applyToCamera (no punch overlay, D-50-P15)', () => {
    const sceneManager = new SceneManager(placeholderRoom);
    const adapter = new ReplaySceneAdapter(sceneManager, placeholderRoom);

    const yaw = 0.4;
    const pitch = -0.15;
    adapter.applySample(sample({ yaw, pitch }));

    const expected = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch));

    expect(sceneManager.camera.quaternion.x).toBeCloseTo(expected.x, 12);
    expect(sceneManager.camera.quaternion.y).toBeCloseTo(expected.y, 12);
    expect(sceneManager.camera.quaternion.z).toBeCloseTo(expected.z, 12);
    expect(sceneManager.camera.quaternion.w).toBeCloseTo(expected.w, 12);
  });

  it('resize() only touches this adapter\'s own isolated camera aspect (active-only resize)', () => {
    const sceneManager = new SceneManager(placeholderRoom);
    const other = new SceneManager(placeholderRoom);
    const adapter = new ReplaySceneAdapter(sceneManager, placeholderRoom);

    adapter.resize(1600, 900);

    expect(sceneManager.camera.aspect).toBeCloseTo(1600 / 900, 10);
    expect(other.camera.aspect).toBe(1); // untouched — no cross-instance leakage (D-50-P5)
  });

  it('dispose() releases this adapter\'s scene without touching a second independent instance', () => {
    const sceneManager = new SceneManager(placeholderRoom);
    const other = new SceneManager(placeholderRoom);
    const adapter = new ReplaySceneAdapter(sceneManager, placeholderRoom);

    expect(sceneManager.scene.children.length).toBeGreaterThan(0);
    adapter.dispose();

    expect(sceneManager.scene.children.length).toBe(0);
    expect(other.scene.children.length).toBeGreaterThan(0);
  });

  it('two adapters built from the same config carry independent camera state (D-50-P5 isolation)', () => {
    const adapterA = new ReplaySceneAdapter(new SceneManager(placeholderRoom), placeholderRoom);
    const adapterB = new ReplaySceneAdapter(new SceneManager(placeholderRoom), placeholderRoom);

    adapterA.applySample(sample({ px: 100, pz: 100, yaw: 1, pitch: 0.5 }));
    adapterB.applySample(sample({ px: 0, pz: 0, yaw: 0, pitch: 0 }));

    expect(adapterA.sceneManager.camera.position.x).not.toBeCloseTo(adapterB.sceneManager.camera.position.x, 3);
  });
});
