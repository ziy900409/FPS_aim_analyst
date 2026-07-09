import { describe, expect, it } from 'vitest';
import type { TargetMotion, Vec3 } from '../state/types.ts';
import { isDrivenMotion, motionOffset } from './targetMotion.ts';

/** 便捷:對給定 motion + age 取位移(每次呼叫新 out,測試不受重用干擾)。 */
function offsetAt(motion: TargetMotion, age: number): Vec3 {
  const out: Vec3 = { x: 0, y: 0, z: 0 };
  motionOffset(motion, age, out);
  return out;
}

describe('motionOffset — 原點語意(offset(_, 0) = 0;WP-18 / T1)', () => {
  it('所有驅動 type 在 age=0 位移為零(spawn 位置即原點)', () => {
    const motions: TargetMotion[] = [
      { type: 'linear', speed: 3 },
      { type: 'pingpong', speed: 2, range: 1 },
      { type: 'sine', speed: 2, range: 1 },
    ];
    for (const m of motions) {
      expect(offsetAt(m, 0)).toEqual({ x: 0, y: 0, z: 0 });
    }
  });

  it('static / waypoints / 缺速度參數 → 位移恆零(既有靜止 drill 零破壞)', () => {
    expect(offsetAt({ type: 'static' }, 5)).toEqual({ x: 0, y: 0, z: 0 });
    expect(offsetAt({ type: 'waypoints', waypoints: [] }, 5)).toEqual({ x: 0, y: 0, z: 0 });
    expect(offsetAt({ type: 'linear' }, 5)).toEqual({ x: 0, y: 0, z: 0 }); // speed 省略 → 0
    expect(offsetAt({ type: 'sine', speed: 2 }, 5)).toEqual({ x: 0, y: 0, z: 0 }); // range 省略 → 0
  });
});

describe('motionOffset — linear 等速位移(逐位 golden)', () => {
  it('horizontal:offset.x = speed·age、y/z 恆 0', () => {
    const m: TargetMotion = { type: 'linear', speed: 2, axis: 'horizontal' };
    expect(offsetAt(m, 0.5)).toEqual({ x: 1, y: 0, z: 0 });
    expect(offsetAt(m, 1)).toEqual({ x: 2, y: 0, z: 0 });
    expect(offsetAt(m, 3)).toEqual({ x: 6, y: 0, z: 0 });
  });

  it('vertical:位移落在 y、x/z 恆 0', () => {
    const m: TargetMotion = { type: 'linear', speed: 2, axis: 'vertical' };
    expect(offsetAt(m, 1)).toEqual({ x: 0, y: 2, z: 0 });
  });

  it('axis 省略時預設 horizontal', () => {
    expect(offsetAt({ type: 'linear', speed: 2 }, 1)).toEqual({ x: 2, y: 0, z: 0 });
  });
});

describe('motionOffset — pingpong 三角波(逐位 golden;值域 [−range, +range])', () => {
  // speed=2、range=1 → period = 4·range = 4;phase d = speed·age = 2·age。起步往 + 、恆定速率。
  const m: TargetMotion = { type: 'pingpong', speed: 2, range: 1 };

  it('一個完整週期的逐位 golden(0 → +range → 0 → −range → 0)', () => {
    expect(offsetAt(m, 0).x).toBe(0); //     d=0   起點
    expect(offsetAt(m, 0.25).x).toBe(0.5); // d=0.5 上升段
    expect(offsetAt(m, 0.5).x).toBe(1); //   d=1   +range 峰
    expect(offsetAt(m, 1).x).toBe(0); //     d=2   回原點
    expect(offsetAt(m, 1.5).x).toBe(-1); //  d=3   −range 峰
    expect(offsetAt(m, 2).x).toBe(0); //     d=4   完整週期回原點
  });

  it('週期性:age 與 age+period/speed 位移相同', () => {
    // 完整空間週期 = 4·range;時間週期 = 4·range/speed = 2s。
    expect(offsetAt(m, 0.3).x).toBeCloseTo(offsetAt(m, 2.3).x, 12);
    expect(offsetAt(m, 0.7).x).toBeCloseTo(offsetAt(m, 2.7).x, 12);
  });
});

describe('motionOffset — sine 正弦(峰值速率 = speed;值域 [−range, +range])', () => {
  // speed=π、range=1 → ω = speed/range = π;offset = range·sin(π·age)。
  const m: TargetMotion = { type: 'sine', speed: Math.PI, range: 1 };

  it('關鍵相位 golden', () => {
    expect(offsetAt(m, 0).x).toBe(0);
    expect(offsetAt(m, 0.5).x).toBeCloseTo(1, 12); //  sin(π/2)=+range
    expect(offsetAt(m, 1).x).toBeCloseTo(0, 12); //    sin(π)=0
    expect(offsetAt(m, 1.5).x).toBeCloseTo(-1, 12); // sin(3π/2)=−range
  });
});

describe('motionOffset — 運動包絡(T0 OQ-18.1:pingpong/sine 位移不超 range 半幅)', () => {
  it('pingpong 位移 ∈ [−range, +range] 且觸及兩端(range=1.5)', () => {
    const m: TargetMotion = { type: 'pingpong', speed: 4, range: 1.5 };
    let max = -Infinity;
    let min = Infinity;
    for (let i = 0; i <= 2000; i++) {
      const v = offsetAt(m, i * 0.005).x;
      expect(Math.abs(v)).toBeLessThanOrEqual(1.5 + 1e-9);
      if (v > max) max = v;
      if (v < min) min = v;
    }
    expect(max).toBeCloseTo(1.5, 6);
    expect(min).toBeCloseTo(-1.5, 6);
  });

  it('sine 位移 ∈ [−range, +range] 且觸及兩端(range=1.5)', () => {
    const m: TargetMotion = { type: 'sine', speed: 4, range: 1.5 };
    let max = -Infinity;
    let min = Infinity;
    for (let i = 0; i <= 2000; i++) {
      const v = offsetAt(m, i * 0.005).x;
      expect(Math.abs(v)).toBeLessThanOrEqual(1.5 + 1e-9);
      if (v > max) max = v;
      if (v < min) min = v;
    }
    expect(max).toBeCloseTo(1.5, 3);
    expect(min).toBeCloseTo(-1.5, 3);
  });
});

describe('isDrivenMotion — 僅 linear/pingpong/sine 驅動(T1 範圍)', () => {
  it('驅動 type → true', () => {
    expect(isDrivenMotion({ type: 'linear' })).toBe(true);
    expect(isDrivenMotion({ type: 'pingpong' })).toBe(true);
    expect(isDrivenMotion({ type: 'sine' })).toBe(true);
  });
  it('static / waypoints / undefined → false(pos 逐位不變)', () => {
    expect(isDrivenMotion({ type: 'static' })).toBe(false);
    expect(isDrivenMotion({ type: 'waypoints' })).toBe(false);
    expect(isDrivenMotion(undefined)).toBe(false);
  });
});
