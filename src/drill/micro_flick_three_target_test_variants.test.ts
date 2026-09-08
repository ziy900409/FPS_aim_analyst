import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import {
  MICRO_FLICK_V2_TARGET_DIAMETER_U,
  microFlickThreeTargetTestV2,
} from './micro_flick_three_target_test_v2.ts';
import {
  MICRO_FLICK_V3_TARGET_DIAMETER_U,
  microFlickThreeTargetTestV3,
} from './micro_flick_three_target_test_v3.ts';
import {
  MICRO_FLICK_V4_TARGET_DIAMETER_U,
  microFlickThreeTargetTestV4,
} from './micro_flick_three_target_test_v4.ts';
import {
  MICRO_FLICK_V5_TARGET_DIAMETER_U,
  microFlickThreeTargetTestV5,
} from './micro_flick_three_target_test_v5.ts';
import {
  MICRO_FLICK_V6_TARGET_DIAMETER_U,
  microFlickThreeTargetTestV6,
} from './micro_flick_three_target_test_v6.ts';
import { microFlickRoomV2 } from '../scene/scenes/micro-flick-room-v2.ts';
import { microFlickRoomV3 } from '../scene/scenes/micro-flick-room-v3.ts';
import { microFlickRoomV4 } from '../scene/scenes/micro-flick-room-v4.ts';
import { microFlickRoomV5 } from '../scene/scenes/micro-flick-room-v5.ts';
import { microFlickRoomV6 } from '../scene/scenes/micro-flick-room-v6.ts';
import { microFlickRoomV7 } from '../scene/scenes/micro-flick-room-v7.ts';
import { microFlickThreeTargetTestV7, MICRO_FLICK_V7_TARGET_DIAMETER_U } from './micro_flick_three_target_test_v7.ts';
import { microFlickRoomV8 } from '../scene/scenes/micro-flick-room-v8.ts';
import { microFlickThreeTargetTestV8, MICRO_FLICK_V8_TARGET_DIAMETER_U } from './micro_flick_three_target_test_v8.ts';

const variants = [
  { label: 'v2', fixture: microFlickThreeTargetTestV2, scene: microFlickRoomV2, distance: 17, range: [16, 18], diameter: MICRO_FLICK_V2_TARGET_DIAMETER_U, room: [16, 44, 12], endZ: -22.06, yaw: [-22, 22], pitch: [-12, 12], expectedApparentDiameterDeg: 3 },
  { label: 'v3', fixture: microFlickThreeTargetTestV3, scene: microFlickRoomV3, distance: 21, range: [20, 22], diameter: MICRO_FLICK_V3_TARGET_DIAMETER_U, room: [20, 52, 12], endZ: -26.06, yaw: [-22, 22], pitch: [-12, 12], expectedApparentDiameterDeg: 3 },
  { label: 'v4', fixture: microFlickThreeTargetTestV4, scene: microFlickRoomV4, distance: 25, range: [24, 26], diameter: MICRO_FLICK_V4_TARGET_DIAMETER_U, room: [24, 60, 12], endZ: -30.06, yaw: [-22, 22], pitch: [-12, 12], expectedApparentDiameterDeg: 3 },
  { label: 'v5', fixture: microFlickThreeTargetTestV5, scene: microFlickRoomV5, distance: 25, range: [24, 26], diameter: MICRO_FLICK_V5_TARGET_DIAMETER_U, room: [12.9, 60, 12], endZ: -30.06, yaw: [-10, 10], pitch: [-8, 8], expectedApparentDiameterDeg: 3.436716 },
  { label: 'v6', fixture: microFlickThreeTargetTestV6, scene: microFlickRoomV6, distance: 25, range: [24, 26], diameter: MICRO_FLICK_V6_TARGET_DIAMETER_U, room: [10.965, 60, 10.2], endZ: -30.06, yaw: [-8.5, 8.5], pitch: [-8, 8], expectedApparentDiameterDeg: 2.921452 },
] as const;

describe('micro-flick deep-corridor variants', () => {
  it('keeps the v6 sphere while shrinking the v7 end-wall by 20%', () => {
    const parsed = loadDrill(microFlickThreeTargetTestV7.drill, microFlickRoomV7);
    expect(microFlickRoomV7.proceduralRoom?.roomSize).toEqual([8.772, 60, 8.16]);
    expect(parsed.targets.hitbox).toEqual({ widthU: MICRO_FLICK_V7_TARGET_DIAMETER_U, heightU: MICRO_FLICK_V7_TARGET_DIAMETER_U, depthU: MICRO_FLICK_V7_TARGET_DIAMETER_U, shape: 'sphere' });
    expect(parsed.targets.spawnArea).toMatchObject({ yawDegRange: [-6.5, 6.5], pitchDegRange: [-5, 6], distanceURange: [24, 26] });
  });

  it('pins the v8 replacement policy without changing its room or spawn envelope', () => {
    const parsed = loadDrill(microFlickThreeTargetTestV8.drill, microFlickRoomV8);

    expect(microFlickThreeTargetTestV8.sceneId).toBe('micro-flick-room-v8');
    expect(microFlickRoomV8.proceduralRoom).toEqual(microFlickRoomV7.proceduralRoom);
    expect(parsed.mode).toBe('practice');
    expect(parsed.targets.count).toBe(60);
    expect(parsed.targets.distance).toBe(25);
    expect(parsed.targets.population).toEqual({ activeCount: 3, replacement: 'next-tick' });
    expect(parsed.targets.hitbox).toEqual({
      widthU: MICRO_FLICK_V8_TARGET_DIAMETER_U,
      heightU: MICRO_FLICK_V8_TARGET_DIAMETER_U,
      depthU: MICRO_FLICK_V8_TARGET_DIAMETER_U,
      shape: 'sphere',
    });
    expect(parsed.targets.spawnArea).toEqual({
      yawDegRange: [-6.5, 6.5],
      distanceURange: [24, 26],
      pitchDegRange: [-5, 6],
      minAngularSeparationDeg: 5,
      preferredReplacementSeparationDeg: 2.6,
    });
    expect(parsed.sequence.seed).toBe(56008);
  });

  it.each(variants)('$label binds its practice drill, deep corridor, and target envelope', ({ fixture, scene, distance, range, diameter, room, endZ, expectedApparentDiameterDeg }) => {
    const parsed = loadDrill(fixture.drill, scene);
    expect(fixture.sceneId).toBe(scene.sceneId);
    expect(parsed.mode).toBe('practice');
    expect(parsed.playerControl).toEqual({ translation: 'locked' });
    expect(parsed.targets.distance).toBe(distance);
    expect(parsed.targets.spawnArea?.distanceURange).toEqual(range);
    expect(parsed.targets.hitbox).toEqual({ widthU: diameter, heightU: diameter, depthU: diameter, shape: 'sphere' });
    expect(scene.proceduralRoom?.roomSize).toEqual(room);
    expect(scene.asset?.url).toBe(`/assets/scenes/${scene.sceneId}/${scene.sceneId}.gltf`);

    // v2–v4 retain v1's 3° appearance; v5 is calibrated to the reference image's 15% wall ratio.
    const apparentDiameterDeg = (2 * Math.atan((diameter / 2) / distance) * 180) / Math.PI;
    expect(apparentDiameterDeg).toBeCloseTo(expectedApparentDiameterDeg, 5);
    if (fixture.id === 'micro_flick_three_target_test_v5' || fixture.id === 'micro_flick_three_target_test_v6') {
      expect((diameter / distance) / (room[2] / Math.abs(endZ))).toBeCloseTo(0.15, 2);
    }

    // The farthest sphere remains at least 3u in front of its corridor end wall.
    expect(Math.abs(endZ) - (range[1] + diameter / 2)).toBeGreaterThanOrEqual(3);
  });

  it('orders the three variants from near to far without changing the angular spawn field', () => {
    expect(variants.map((variant) => variant.distance)).toEqual([17, 21, 25, 25, 25]);
    expect(variants.map((variant) => variant.range)).toEqual([[16, 18], [20, 22], [24, 26], [24, 26], [24, 26]]);
    for (const { fixture, yaw, pitch } of variants) {
      expect(fixture.drill.targets.spawnArea).toMatchObject({
        yawDegRange: yaw, pitchDegRange: pitch, minAngularSeparationDeg: 7,
      });
    }
  });
});
