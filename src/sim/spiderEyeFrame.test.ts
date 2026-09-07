import { describe, expect, it } from 'vitest';
import { PLAYER_EYE_HEIGHT_U } from './playerEye.ts';
import {
  SPIDER_WIDE_EYE_ORIGIN,
  halfHorizontalFovRad,
  ndcForEyeAngles,
  spiderWideEyeAngles,
  spiderWideEyePos,
} from './spiderEyeFrame.ts';

const DEG_TO_RAD = Math.PI / 180;

function eyeDistance(pos: { x: number; y: number; z: number }): number {
  const dx = pos.x - SPIDER_WIDE_EYE_ORIGIN.x;
  const dy = pos.y - SPIDER_WIDE_EYE_ORIGIN.y;
  const dz = pos.z - SPIDER_WIDE_EYE_ORIGIN.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

describe('WP-57 T1 — spiderWideEyePos（FR-57.2 eye-frame 球面）', () => {
  it('眼睛在 sim 原點正上方 PLAYER_EYE_HEIGHT_U，不另立第二個眼高常數', () => {
    expect(SPIDER_WIDE_EYE_ORIGIN).toEqual({ x: 0, y: PLAYER_EYE_HEIGHT_U, z: 0 });
    expect(PLAYER_EYE_HEIGHT_U).toBe(1.6);
  });

  it('yaw=0, pitch=0 就是中心目標 (0, eyeY, -d)——不需要偏移換算', () => {
    const pos = spiderWideEyePos(0, 0, 8);
    expect(pos.x).toBeCloseTo(0, 12);
    expect(pos.y).toBeCloseTo(PLAYER_EYE_HEIGHT_U, 12);
    expect(pos.z).toBeCloseTo(-8, 12);
  });

  it('yaw 正號在右（+x）、pitch 正號在上（+y）', () => {
    expect(spiderWideEyePos(30, 0, 8).x).toBeGreaterThan(0);
    expect(spiderWideEyePos(-30, 0, 8).x).toBeLessThan(0);
    expect(spiderWideEyePos(0, 6.5, 8).y).toBeGreaterThan(PLAYER_EYE_HEIGHT_U);
    expect(spiderWideEyePos(0, -6.5, 8).y).toBeLessThan(PLAYER_EYE_HEIGHT_U);
  });

  it('yaw 與 pitch 完全解耦：|pos - eye| 恆為 distanceU（角徑不隨 yaw/pitch 漂移）', () => {
    for (const yawDeg of [0, 12.5, 43.5771, -58.6324, 70.3098]) {
      for (const pitchDeg of [-6.5, -3.25, 0, 3.25, 6.5]) {
        const relativeError = Math.abs(eyeDistance(spiderWideEyePos(yawDeg, pitchDeg, 8)) - 8) / 8;
        expect(relativeError).toBeLessThanOrEqual(1e-12);
      }
    }
  });

  it('side 的 x 對稱、pitch 的 y 對稱（分層佇列的 L/R 與上下半區等價）', () => {
    const right = spiderWideEyePos(43.5771, 4.25, 8);
    const left = spiderWideEyePos(-43.5771, 4.25, 8);
    expect(left.x).toBeCloseTo(-right.x, 12);
    expect(left.y).toBeCloseTo(right.y, 12);
    expect(left.z).toBeCloseTo(right.z, 12);

    const down = spiderWideEyePos(43.5771, -4.25, 8);
    expect(down.y - PLAYER_EYE_HEIGHT_U).toBeCloseTo(-(right.y - PLAYER_EYE_HEIGHT_U), 12);
  });

  it('與圓柱參數化 angularSpawnPose() 不同源：3D 距離不隨 pitch 增長', () => {
    // angularSpawnPose(): y = TARGET_Y + tan(pitch)·d ⇒ |pos| = d / cos(pitch)（pitch 15° → +3.5%）。
    const cylindricalDistance = 8 / Math.cos(6.5 * DEG_TO_RAD);
    expect(cylindricalDistance).toBeGreaterThan(8);
    expect(eyeDistance(spiderWideEyePos(0, 6.5, 8))).toBeCloseTo(8, 12);
  });
});

describe('WP-57 T1 — spiderWideEyeAngles（離線重建的反函式）', () => {
  it('yaw/pitch → pos → yaw/pitch round-trip 誤差 ≤ 1e-12', () => {
    for (const yawDeg of [-70.3098, -43.5771, -0.5, 0, 12.25, 51.6343, 74.5578]) {
      for (const pitchDeg of [-6.5, -1.75, 0, 1.75, 6.5]) {
        const back = spiderWideEyeAngles(spiderWideEyePos(yawDeg, pitchDeg, 8));
        expect(Math.abs(back.yawDeg - yawDeg)).toBeLessThanOrEqual(1e-12);
        expect(Math.abs(back.pitchDeg - pitchDeg)).toBeLessThanOrEqual(1e-12);
        expect(Math.abs(back.distanceU - 8)).toBeLessThanOrEqual(1e-12);
      }
    }
  });
});

describe('WP-57 T1 — ndcForEyeAngles（FR-57.4 判定式）', () => {
  it('halfHFOV = atan(tan(fov/2)·aspect)：16:9 的四個 FOV 檔位與 README §2.4 相符', () => {
    const expected: readonly [number, number][] = [
      [60, 45.7464],
      [75, 53.7562],
      [90, 60.6422],
      [120, 72.0083],
    ];
    for (const [fovDeg, halfHFovDeg] of expected) {
      expect(halfHorizontalFovRad(fovDeg, 16 / 9) / DEG_TO_RAD).toBeCloseTo(halfHFovDeg, 4);
    }
  });

  it('ndc_x 只含 yaw：同一 yaw 下不同 pitch 的 ndc_x 逐位一致', () => {
    const a = ndcForEyeAngles(43.5771, 0, 60, 16 / 9);
    const b = ndcForEyeAngles(43.5771, 6.5, 60, 16 / 9);
    const c = ndcForEyeAngles(43.5771, -6.5, 60, 16 / 9);
    expect(b.x).toBe(a.x);
    expect(c.x).toBe(a.x);
  });

  it('畫面中心為 (0, 0)，halfHFOV/halfVFOV 恰落在 NDC ±1', () => {
    expect(ndcForEyeAngles(0, 0, 75, 16 / 9)).toEqual({ x: 0, y: 0 });
    const halfHFovDeg = halfHorizontalFovRad(75, 16 / 9) / DEG_TO_RAD;
    expect(ndcForEyeAngles(halfHFovDeg, 0, 75, 16 / 9).x).toBeCloseTo(1, 12);
    expect(ndcForEyeAngles(0, 37.5, 75, 16 / 9).y).toBeCloseTo(1, 12);
  });

  it('ndc_y 含 yaw：同一 pitch 在大 yaw 下佔畫面比例更大（1/cos(yaw)）', () => {
    const center = ndcForEyeAngles(0, 6.5, 60, 16 / 9);
    const edge = ndcForEyeAngles(43.5771, 6.5, 60, 16 / 9);
    expect(edge.y).toBeGreaterThan(center.y);
    expect(edge.y).toBeCloseTo(center.y / Math.cos(43.5771 * DEG_TO_RAD), 12);
  });
});
