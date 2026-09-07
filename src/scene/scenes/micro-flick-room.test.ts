import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { MICRO_FLICK_TARGET_DIAMETER_U } from '../../drill/micro_flick_three_target_test_v1.ts';
import { SceneManager } from '../../render/SceneManager.ts';
import { TargetView } from '../../render/TargetView.ts';
import type { TargetState } from '../../state/types.ts';
import { microFlickRoom } from './micro-flick-room.ts';

const microFlickRoomGltfText = Object.values(
  import.meta.glob<string>('../../../public/assets/scenes/micro-flick-room/micro-flick-room.gltf', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0];

const BANNED_GAMEPLAY_NAME = /(weapon|gun|rifle|pistol|hand|arm|muzzle|target|camera|light)/i;
const ALLOWED_NODE_NAME = /^(floor|ceiling|end-wall|side-panel-[lr]-0[1-9])$/;
const TARGET_CENTER_Y = 1.5;

interface GltfJson {
  readonly scenes: ReadonlyArray<{ readonly nodes?: readonly number[] }>;
  readonly nodes: ReadonlyArray<{
    readonly name?: string;
    readonly mesh?: number;
    readonly translation?: readonly number[];
    readonly rotation?: readonly number[];
    readonly scale?: readonly number[];
  }>;
  readonly meshes: ReadonlyArray<{
    readonly name?: string;
    readonly primitives: readonly unknown[];
  }>;
  readonly materials: ReadonlyArray<{
    readonly name?: string;
    readonly pbrMetallicRoughness?: { readonly baseColorFactor?: readonly number[] };
  }>;
  readonly buffers: ReadonlyArray<{ readonly uri?: string }>;
  readonly cameras?: readonly unknown[];
  readonly extensions?: Record<string, unknown>;
}

function target(id: string, x: number): TargetState {
  return {
    id,
    side: x < 0 ? 'L' : 'R',
    pos: { x, y: TARGET_CENTER_Y, z: -13 },
    visible: true,
    alive: true,
    hitbox: {
      width: MICRO_FLICK_TARGET_DIAMETER_U,
      height: MICRO_FLICK_TARGET_DIAMETER_U,
      depth: MICRO_FLICK_TARGET_DIAMETER_U,
      shape: 'sphere',
    },
  };
}

function linearChannel(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: THREE.Color): number {
  return 0.2126 * linearChannel(color.r) + 0.7152 * linearChannel(color.g) + 0.0722 * linearChannel(color.b);
}

function contrastRatio(a: THREE.Color, b: THREE.Color): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function positionAt(yawDeg: number, pitchDeg: number, distance: number): THREE.Vector3 {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  return new THREE.Vector3(
    Math.sin(yaw) * distance,
    TARGET_CENTER_Y + Math.tan(pitch) * distance,
    -Math.cos(yaw) * distance,
  );
}

describe('WP-56 T3 micro-flick corridor asset contract', () => {
  it('registers the stable scene id as the versioned local GLTF presentation', () => {
    expect(microFlickRoom.sceneId).toBe('micro-flick-room');
    expect(microFlickRoom.assetPackVersion).toBe('micro-flick-room-v1');
    expect(microFlickRoom.asset).toEqual({
      url: '/assets/scenes/micro-flick-room/micro-flick-room.gltf',
      displayScale: 1,
    });
    expect(microFlickRoom.proceduralRoom).toMatchObject({
      roomSize: [16, 36, 12],
      eyeZ: 0,
      floorY: -4,
      eyeHeight: 1.6,
      fovDeg: 75,
    });
  });

  it('is a bounded environment-only inventory with finite transforms and embedded geometry', () => {
    const gltf = JSON.parse(microFlickRoomGltfText) as GltfJson;
    const nodeNames = gltf.nodes.map((node) => node.name ?? '');
    const allNames = [...nodeNames, ...gltf.meshes.map((mesh) => mesh.name ?? ''), ...gltf.materials.map((m) => m.name ?? '')];

    expect(gltf.scenes).toHaveLength(1);
    expect(gltf.scenes[0].nodes).toHaveLength(21);
    expect(gltf.nodes).toHaveLength(21);
    expect(gltf.nodes.every((node) => node.mesh !== undefined)).toBe(true);
    expect(gltf.meshes).toHaveLength(3);
    expect(gltf.meshes.reduce((sum, mesh) => sum + mesh.primitives.length, 0)).toBe(3);
    expect(gltf.materials).toHaveLength(3);
    expect(gltf.cameras).toBeUndefined();
    expect(gltf.extensions).toBeUndefined();
    expect(allNames.every((name) => !BANNED_GAMEPLAY_NAME.test(name))).toBe(true);
    expect(nodeNames.every((name) => ALLOWED_NODE_NAME.test(name))).toBe(true);
    expect(gltf.buffers).toHaveLength(1);
    expect(gltf.buffers[0].uri).toMatch(/^data:application\/octet-stream;base64,/);

    for (const node of gltf.nodes) {
      for (const transform of [node.translation, node.rotation, node.scale]) {
        if (transform !== undefined) expect(transform.every(Number.isFinite)).toBe(true);
      }
      expect(node.scale?.every((value) => value > 0)).toBe(true);
    }
  });

  it('parses through the production Three.js GLTF parser into 21 environment meshes', async () => {
    const hadProgressEvent = 'ProgressEvent' in globalThis;
    const previousProgressEvent = globalThis.ProgressEvent;
    if (!hadProgressEvent) {
      Object.defineProperty(globalThis, 'ProgressEvent', {
        configurable: true,
        value: class TestProgressEvent extends Event {
          readonly lengthComputable = false;
          readonly loaded = 0;
          readonly total = 0;
        },
      });
    }

    try {
      const parsed = await new GLTFLoader().parseAsync(microFlickRoomGltfText, '');
      const meshes: THREE.Mesh[] = [];
      parsed.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) meshes.push(child);
      });
      expect(meshes).toHaveLength(21);
      expect(meshes.every((mesh) => !BANNED_GAMEPLAY_NAME.test(mesh.name))).toBe(true);
    } finally {
      if (hadProgressEvent) {
        Object.defineProperty(globalThis, 'ProgressEvent', { configurable: true, value: previousProgressEvent });
      } else {
        Reflect.deleteProperty(globalThis, 'ProgressEvent');
      }
    }
  });

  it('keeps nine regular panels per side symmetric around the corridor centreline', () => {
    const gltf = JSON.parse(microFlickRoomGltfText) as GltfJson;
    const left = gltf.nodes.filter((node) => node.name?.startsWith('side-panel-l-'));
    const right = gltf.nodes.filter((node) => node.name?.startsWith('side-panel-r-'));

    expect(left).toHaveLength(9);
    expect(right).toHaveLength(9);
    for (let i = 0; i < left.length; i++) {
      expect(left[i].translation).toEqual([-(right[i].translation?.[0] ?? 0), 2, right[i].translation?.[2]]);
      expect(left[i].scale).toEqual(right[i].scale);
    }
  });

  it.each([
    [1920, 1080],
    [1280, 720],
  ])('projects the complete Candidate A spawn field inside a 24 px safe region at %ix%i', (width, height) => {
    const manager = new SceneManager(microFlickRoom);
    manager.resize(width, height);
    manager.camera.updateMatrixWorld(true);
    const radius = MICRO_FLICK_TARGET_DIAMETER_U / 2;

    const vanishingPoint = new THREE.Vector3(0, 1.6, -18).project(manager.camera);
    expect(Math.abs(vanishingPoint.x * width * 0.5)).toBeLessThanOrEqual(1);
    expect(Math.abs(vanishingPoint.y * height * 0.5)).toBeLessThanOrEqual(1);

    for (const yaw of [-22, 22]) {
      for (const pitch of [-12, 12]) {
        const center = positionAt(yaw, pitch, 12);
        for (const [dx, dy] of [[-radius, 0], [radius, 0], [0, -radius], [0, radius]] as const) {
          const projected = center.clone().add(new THREE.Vector3(dx, dy, 0)).project(manager.camera);
          const screenX = (projected.x + 1) * width * 0.5;
          const screenY = (1 - projected.y) * height * 0.5;
          expect(screenX).toBeGreaterThanOrEqual(24);
          expect(screenX).toBeLessThanOrEqual(width - 24);
          expect(screenY).toBeGreaterThanOrEqual(24);
          expect(screenY).toBeLessThanOrEqual(height - 24);
        }
      }
    }
    manager.dispose();
  });

  it('renders three red spheres from hitbox dimensions, keeps a pool of three, and clears it on dispose', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);
    view.setShape('sphere');

    for (let replacement = 0; replacement < 1000; replacement++) {
      view.sync([target(`t${replacement}`, -2), target(`t${replacement + 1}`, 0), target(`t${replacement + 2}`, 2)]);
    }

    const meshes = scene.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    expect(view.poolSize).toBe(3);
    expect(meshes).toHaveLength(3);
    expect(meshes.every((mesh) => mesh.geometry instanceof THREE.SphereGeometry)).toBe(true);
    expect(meshes.every((mesh) => mesh.scale.toArray().every((axis) => axis === MICRO_FLICK_TARGET_DIAMETER_U))).toBe(true);

    const material = meshes[0].material as THREE.MeshStandardMaterial;
    const wall = new THREE.Color(microFlickRoom.proceduralRoom?.colors.wall ?? 0);
    expect(contrastRatio(material.color, wall)).toBeGreaterThanOrEqual(3);

    view.dispose();
    expect(view.poolSize).toBe(0);
    expect(scene.children).toHaveLength(0);
  });
});
