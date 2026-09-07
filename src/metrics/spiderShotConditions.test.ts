import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import { buildCompatibilityKey } from './compatibilityKey.ts';
import { deriveSpiderShotTransitions } from './spiderShotConditions.ts';

const CENTER = { x: 0, y: 0, z: -10 };
const COS_30 = Math.sqrt(3) / 2;
const SIN_30 = 0.5;

const meta: Meta = {
  schemaVersion: 2,
  drillId: 'spider-shot-v1',
  weaponId: 'ak47',
  weaponSeed: 0,
  rngSeed: 36036,
  backend: 'webgl2',
  displayHz: 144,
  simHz: 128,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  fovDeg: 90,
  crossOriginIsolated: true,
  startedAt: '2026-08-24T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  simToWorld: 1,
  scene: {
    sceneId: 'synthetic-eye-origin',
    assetPackVersion: 'synthetic-v1',
    clutterTier: 'low',
    fallback: false,
    eye: { x: 0, y: 0, z: 0 },
  },
  targets: { hitbox: { widthU: 1, heightU: 2, depthU: 1 } },
  spawn: { seed: 36036, spiderShot: { kind: 'center-peripheral' } },
  assessment: {
    protocolVersion: '1.0.0',
    assessmentFeedbackPolicy: 'minimal-end-of-block',
  },
  session: { participantId: 'p-1' },
};

describe('deriveSpiderShotTransitions', () => {
  it('derives D_deg, W_deg, and four axial plus two oblique presentation labels', () => {
    const transitions = deriveSpiderShotTransitions(makePayload());
    const peripheral = transitions.filter((transition) => transition.direction === 'center-to-peripheral');
    const returns = transitions.filter((transition) => transition.direction === 'peripheral-to-center');

    expect(peripheral.map((transition) => transition.quadrant)).toEqual([
      'vertical',
      'horizontal',
      'vertical',
      'horizontal',
      'oblique',
      'oblique',
    ]);
    expect(returns.every((transition) => transition.quadrant === undefined)).toBe(true);

    for (const transition of transitions) {
      expect(transition.angularDistanceDeg).toBeCloseTo(30, 12);
      expect(transition.worldDistanceU).toBeCloseTo(10, 12);
      expect(transition.angularSizeDeg).toBeCloseTo((2 * Math.atan(0.5 / 10) * 180) / Math.PI, 12);
      expect(transition.targetConditionCell).toBe(
        `spider:d=${transition.angularDistanceDeg.toFixed(6)};w=${transition.angularSizeDeg.toFixed(6)}`,
      );
      expect(transition.seed).toBe(36036);
      expect(transition.hitbox).toEqual({ width: 1, height: 2, depth: 1 });
    }

    expect(() => buildCompatibilityKey(meta, 'spider-shot-v1', transitions[0].targetConditionCell, 'ok')).not.toThrow();
  });

  it('uses the exported GD-7 hitbox as the sole angular-size source', () => {
    const standard = deriveSpiderShotTransitions(makePayload())[0];
    const wider: ExportPayload = {
      ...makePayload(),
      meta: { ...meta, targets: { hitbox: { widthU: 2, heightU: 2, depthU: 1 } } },
    };
    const changed = deriveSpiderShotTransitions(wider)[0];

    expect(changed.hitbox.width).toBe(2);
    expect(changed.angularSizeDeg).toBeGreaterThan(standard.angularSizeDeg);
    expect(changed.targetConditionCell).not.toBe(standard.targetConditionCell);
  });

  it('derives delivered D_deg and W_deg from the exported eye position at each visible tick', () => {
    const center = { x: 0, y: 1.5, z: -8 };
    const peripheral = { x: 2, y: 1.5, z: -8 };
    const payload: ExportPayload = {
      meta: {
        ...meta,
        simToWorld: 1,
        scene: {
          sceneId: 'placeholder-room',
          assetPackVersion: 'placeholder-room-v1',
          clutterTier: 'low',
          fallback: false,
          eye: { x: 0, y: 1.6, z: 4 },
        },
      },
      ticks: [tick(0, 0, 0), tick(10, 1, 0)],
      events: [
        visible('center', 'center', center, 0),
        visible('peripheral', 'peripheral', peripheral, 10),
      ],
    };

    const [transition] = deriveSpiderShotTransitions(payload, { strictEyeOrigin: true });
    const centerDirection = normalize({ x: 0, y: -0.1, z: -12 });
    const peripheralDirection = normalize({ x: 1, y: -0.1, z: -12 });
    const expectedDistanceU = Math.hypot(1, -0.1, -12);
    const expectedAngularDistanceDeg =
      (Math.acos(
        centerDirection.x * peripheralDirection.x +
          centerDirection.y * peripheralDirection.y +
          centerDirection.z * peripheralDirection.z,
      ) *
        180) /
      Math.PI;

    expect(transition.worldDistanceU).toBeCloseTo(expectedDistanceU, 12);
    expect(transition.angularDistanceDeg).toBeCloseTo(expectedAngularDistanceDeg, 12);
    expect(transition.angularSizeDeg).toBeCloseTo((2 * Math.atan(0.5 / expectedDistanceU) * 180) / Math.PI, 12);
  });
});

/**
 * WP-57 / T4（FR-57.11）—— additive `side`。
 *
 * `side` 只讀既有 eye-frame 座標的 `x` 符號，不新增第二套幾何（C-D4）。這一組測試同時守住兩件事：
 * 新欄位的正負向行為，以及**既有七個欄位對 v1/v2 fixture 的輸出逐位不變**（`angularDistanceDeg`／
 * `angularSizeDeg`／`quadrant`／`targetConditionCell`／`worldDistanceU`／`hitbox`／`seed`）。
 */
describe('deriveSpiderShotTransitions — WP-57 T4 side label', () => {
  const EYE_Y = 1.6;

  it('labels right / left arrivals from the eye-frame x sign and omits side at x === 0', () => {
    const right = sideOfArrival({ x: 3, y: EYE_Y, z: -8 });
    const left = sideOfArrival({ x: -3, y: EYE_Y, z: -8 });
    const straightUp = sideOfArrival({ x: 0, y: EYE_Y + 3, z: -8 });

    expect(right).toBe('R');
    expect(left).toBe('L');
    // x === 0 的落點沒有左右語意 ⇒ 省略欄位而非猜一邊（否則資料上分不出「無左右」與「在右邊」）。
    expect(straightUp).toBeUndefined();
  });

  it('emits side only for center-to-peripheral arrivals', () => {
    const transitions = deriveSpiderShotTransitions(makeSidePayload({ x: 3, y: EYE_Y, z: -8 }));
    const outbound = transitions.filter((transition) => transition.direction === 'center-to-peripheral');
    const returns = transitions.filter((transition) => transition.direction === 'peripheral-to-center');

    expect(outbound).toHaveLength(1);
    expect(outbound[0].side).toBe('R');
    expect(returns).toHaveLength(1);
    expect('side' in returns[0]).toBe(false);
  });

  it('reads the sign against the moving eye, not the world origin', () => {
    // 玩家向 +x 位移 400 sim units = 4 world units（simToWorld = 0.01）後，世界座標 x = 3 的目標
    // 落在眼睛**左側**。若 side 誤用世界原點就會回 'R'。
    const payload: ExportPayload = {
      meta: { ...meta, simToWorld: 0.01 },
      ticks: [tick(0, 0, 0), tick(10, 400, 0), tick(20, 400, 0)],
      events: [
        visible('center', 'center', { x: 0, y: EYE_Y, z: -8 }, 0),
        visible('peripheral', 'peripheral', { x: 3, y: EYE_Y, z: -8 }, 10),
        visible('center-2', 'center', { x: 4, y: EYE_Y, z: -8 }, 20),
      ],
    };
    const [outbound] = deriveSpiderShotTransitions(payload, { strictEyeOrigin: true });

    expect(outbound.direction).toBe('center-to-peripheral');
    expect(outbound.side).toBe('L');
  });

  it('keeps the seven existing fields byte-identical on the v1/v2 fixture and adds a non-contradictory side', () => {
    const transitions = deriveSpiderShotTransitions(makePayload());
    const outbound = transitions.filter((transition) => transition.direction === 'center-to-peripheral');
    const expectedCell = `spider:d=30.000000;w=${(((2 * Math.atan(0.5 / 10)) * 180) / Math.PI).toFixed(6)}`;

    // 既有七欄位：逐位釘死（azimuth 0/90/180/270/45/225 六個周邊落點）。
    expect(outbound.map((transition) => transition.quadrant)).toEqual([
      'vertical',
      'horizontal',
      'vertical',
      'horizontal',
      'oblique',
      'oblique',
    ]);
    for (const transition of transitions) {
      expect(transition.angularDistanceDeg).toBeCloseTo(30, 12);
      expect(transition.angularSizeDeg).toBeCloseTo(((2 * Math.atan(0.5 / 10)) * 180) / Math.PI, 12);
      expect(transition.targetConditionCell).toBe(expectedCell);
      expect(transition.worldDistanceU).toBeCloseTo(10, 12);
      expect(transition.seed).toBe(36036);
      expect(transition.hitbox).toEqual({ width: 1, height: 2, depth: 1 });
    }

    // 新欄位對同一組 payload 的輸出。azimuth 90/45 在右、270/225 在左 —— 與方位角一致。
    const sides = outbound.map((transition) => transition.side);
    expect(sides[1]).toBe('R'); // azimuth 90（正右）
    expect(sides[3]).toBe('L'); // azimuth 270（正左）
    expect(sides[4]).toBe('R'); // azimuth 45（右上）
    expect(sides[5]).toBe('L'); // azimuth 225（左下）

    // 兩個 `vertical` 呈現：azimuth 0 的 `sin(0)` 恰為 0 ⇒ 省略；azimuth 180 的 `sin(π) = 1.22e-16`
    // 是**浮點殘值**，符號規則因此輸出一個幾何上無意義的 'R'。這是刻意不加閾值的後果（加閾值等於
    // 為 side 發明第二套幾何容差），故以測試與 analysis 文件明記：判讀時先用 quadrant 篩掉 vertical。
    expect(sides[0]).toBeUndefined();
    expect(sides[2]).toBe('R');
    expect(outbound[2].quadrant).toBe('vertical');

    // 不矛盾性：有 side 的每一筆，其符號都與該筆抵達點的 eye-frame x 同號。
    const arrivals = [
      pointAtAzimuth(0),
      pointAtAzimuth(90),
      pointAtAzimuth(180),
      pointAtAzimuth(270),
      pointAtAzimuth(45),
      pointAtAzimuth(225),
    ];
    outbound.forEach((transition, index) => {
      if (transition.side === undefined) {
        expect(arrivals[index].x).toBe(0);
        return;
      }
      expect(transition.side).toBe(arrivals[index].x > 0 ? 'R' : 'L');
    });
  });

  function sideOfArrival(point: { x: number; y: number; z: number }): 'L' | 'R' | undefined {
    const [outbound] = deriveSpiderShotTransitions(makeSidePayload(point), { strictEyeOrigin: true });
    return outbound.side;
  }

  function makeSidePayload(point: { x: number; y: number; z: number }): ExportPayload {
    return {
      meta: {
        ...meta,
        simToWorld: 1,
        scene: {
          sceneId: 'wide-flick-arena',
          assetPackVersion: 'wide-flick-arena-v1',
          clutterTier: 'low',
          fallback: false,
          eye: { x: 0, y: EYE_Y, z: 0 },
        },
      },
      ticks: [tick(0, 0, 0), tick(10, 0, 0), tick(20, 0, 0)],
      events: [
        visible('center', 'center', { x: 0, y: EYE_Y, z: -8 }, 0),
        visible('peripheral', 'peripheral', point, 10),
        visible('center-2', 'center', { x: 0, y: EYE_Y, z: -8 }, 20),
      ],
    };
  }
});

function tick(t: number, px: number, pz: number): ExportPayload['ticks'][number] {
  return {
    t,
    vx: 0,
    vz: 0,
    px,
    pz,
    tx: null,
    ty: null,
    tz: null,
    aim: { yaw: 0, pitch: 0 },
    keys: [],
    ads: false,
  };
}

function normalize(point: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const length = Math.hypot(point.x, point.y, point.z);
  return { x: point.x / length, y: point.y / length, z: point.z / length };
}

function makePayload(): ExportPayload {
  const peripheral = [
    pointAtAzimuth(0),
    pointAtAzimuth(90),
    pointAtAzimuth(180),
    pointAtAzimuth(270),
    pointAtAzimuth(45),
    pointAtAzimuth(225),
  ];
  const events: ExportPayload['events'] = [];

  events.push(visible('center-0', 'center', CENTER, 0));
  peripheral.forEach((point, index) => {
    events.push(visible(`peripheral-${index}`, 'peripheral', point, index * 2 + 1));
    events.push(visible(`center-${index + 1}`, 'center', CENTER, index * 2 + 2));
  });

  return { meta, ticks: [], events };
}

function pointAtAzimuth(azimuthDeg: number): { x: number; y: number; z: number } {
  const azimuthRad = (azimuthDeg * Math.PI) / 180;
  return {
    x: 10 * SIN_30 * Math.sin(azimuthRad),
    y: 10 * SIN_30 * Math.cos(azimuthRad),
    z: -10 * COS_30,
  };
}

function visible(
  targetId: string,
  zone: 'center' | 'peripheral',
  point: { x: number; y: number; z: number },
  t: number,
): Extract<ExportPayload['events'][number], { type: 'visible' }> {
  return { type: 'visible', targetId, side: 'R', zone, t, targetX: point.x, targetY: point.y, targetZ: point.z };
}
