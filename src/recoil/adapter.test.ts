import { describe, expect, it } from 'vitest';
import { punchToThreeRad } from './adapter.ts';

/**
 * WP-13 / T2 — punch 角度轉換單點（±向量對照表）
 *
 * 鎖死 A6 契約：pitch 翻號（Source 下正 → three 上正）、yaw 同號（皆左正）。方向錯 = 彈道/視覺
 * 上下或左右反轉，此表即回歸攔截點。
 */
describe('adapter — punchToThreeRad（Source deg → three rad，pitch 翻號）', () => {
  it('pitch −10° Source（上跳）→ +0.17453 rad three（向上）', () => {
    const { pitchRad } = punchToThreeRad(-10, 0);
    expect(pitchRad).toBeCloseTo(0.174532925, 9);
  });

  it('pitch +10° Source（下沉）→ −0.17453 rad three（向下）', () => {
    const { pitchRad } = punchToThreeRad(10, 0);
    expect(pitchRad).toBeCloseTo(-0.174532925, 9);
  });

  it('yaw −1.5° Source（向右漂）→ −0.02618 rad three（向右，同號）', () => {
    const { yawRad } = punchToThreeRad(0, -1.5);
    expect(yawRad).toBeCloseTo(-0.026179939, 9);
  });

  it('yaw +1.5° Source（向左漂）→ +0.02618 rad three（向左，同號）', () => {
    const { yawRad } = punchToThreeRad(0, 1.5);
    expect(yawRad).toBeCloseTo(0.026179939, 9);
  });

  it('AK 10 發 rawPunch 向量（pitch −10.18 / yaw −1.56）→ 上 + 右（three 正 pitch / 負 yaw）', () => {
    const { pitchRad, yawRad } = punchToThreeRad(-10.18, -1.56);
    expect(pitchRad).toBeGreaterThan(0); // 上跳
    expect(yawRad).toBeLessThan(0); //     向右
  });

  it('零 punch → 零 rad（無偏移）', () => {
    const { pitchRad, yawRad } = punchToThreeRad(0, 0);
    expect(Math.abs(pitchRad)).toBe(0); // −0 亦視為零偏移
    expect(Math.abs(yawRad)).toBe(0);
  });
});
