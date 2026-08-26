import { describe, expect, it } from 'vitest';
import type { PropBound } from './SceneConfig.ts';
import { firstBlockingIntersection, visibleFractionForTarget } from './occlusionGeometry.ts';

function box(id: string, min: PropBound['min'], max: PropBound['max']): PropBound {
  return { id, min, max };
}

describe('firstBlockingIntersection', () => {
  it('回 undefined：空 props 陣列', () => {
    expect(firstBlockingIntersection({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -5 }, [])).toBeUndefined();
  });

  it('回 undefined：線段完全在 box 外側（不相交）', () => {
    const props = [box('wall', { x: 10, y: 0, z: -1 }, { x: 12, y: 3, z: 1 })];
    expect(firstBlockingIntersection({ x: 0, y: 1.5, z: 5 }, { x: 0, y: 1.5, z: -5 }, props)).toBeUndefined();
  });

  it('起點在 box 內：alpha=0，交點=起點', () => {
    const props = [box('wall', { x: -1, y: -1, z: -1 }, { x: 1, y: 1, z: 1 })];
    const result = firstBlockingIntersection({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -10 }, props);
    expect(result).toEqual({ propId: 'wall', alpha: 0, point: { x: 0, y: 0, z: 0 } });
  });

  it('tangent：線段沿 box 邊界擦過（inclusive 邊界視為相交）', () => {
    // box x∈[0,2]；線段固定 x=0（貼齊 min.x 邊界，未真正穿入內部）。
    const props = [box('wall', { x: 0, y: 0, z: -1 }, { x: 2, y: 3, z: 1 })];
    const result = firstBlockingIntersection({ x: 0, y: 1.5, z: 5 }, { x: 0, y: 1.5, z: -5 }, props);
    expect(result?.propId).toBe('wall');
    expect(result?.point.z).toBeCloseTo(1, 12); // 進入點在 box 近面 z=max.z=1
  });

  it('endpoint：交點恰好落在線段終點（to 本身在 box 邊界上）', () => {
    const props = [box('wall', { x: -1, y: -1, z: -5 }, { x: 1, y: 1, z: -3 })];
    const result = firstBlockingIntersection({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -3 }, props);
    expect(result).toEqual({ propId: 'wall', alpha: 1, point: { x: 0, y: 0, z: -3 } });
  });

  it('nearest：兩個 prop 相交時取最近者（alpha 較小）', () => {
    const near = box('near-wall', { x: -1, y: -1, z: 0 }, { x: 1, y: 1, z: 2 });
    const far = box('far-wall', { x: -1, y: -1, z: -4 }, { x: 1, y: 1, z: -2 });
    const result = firstBlockingIntersection({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -5 }, [far, near]);
    expect(result?.propId).toBe('near-wall');
    expect(result?.point.z).toBeCloseTo(2, 12);
  });

  it('tie：alpha 相同時依 props 原順序決定（deterministic）', () => {
    // 兩個完全重疊的 box（相同 alpha）；原順序 [a, b] → 取 a。
    const a = box('a', { x: -1, y: -1, z: -1 }, { x: 1, y: 1, z: 1 });
    const b = box('b', { x: -1, y: -1, z: -1 }, { x: 1, y: 1, z: 1 });
    const result1 = firstBlockingIntersection({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -5 }, [a, b]);
    expect(result1?.propId).toBe('a');
    const result2 = firstBlockingIntersection({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -5 }, [b, a]);
    expect(result2?.propId).toBe('b');
  });
});

describe('visibleFractionForTarget', () => {
  const HITBOX = { width: 2, height: 2, depth: 2, shape: 'box' as const };

  it('sampleCount=1：只測中心，未遮擋回 1', () => {
    const fraction = visibleFractionForTarget({ x: 0, y: 1.5, z: 5 }, { x: 0, y: 1.5, z: -5 }, HITBOX, [], 1);
    expect(fraction).toBe(1);
  });

  it('sampleCount=1：中心被遮擋回 0', () => {
    const props = [box('wall', { x: -1, y: 0, z: -1 }, { x: 1, y: 3, z: 1 })];
    const fraction = visibleFractionForTarget({ x: 0, y: 1.5, z: 5 }, { x: 0, y: 1.5, z: -5 }, HITBOX, props, 1);
    expect(fraction).toBe(0);
  });

  it('sampleCount=9：無 props 時全可見（9/9）', () => {
    const fraction = visibleFractionForTarget({ x: 0, y: 1.5, z: 5 }, { x: 0, y: 1.5, z: -5 }, HITBOX, [], 9);
    expect(fraction).toBe(1);
  });

  it('sampleCount=9：部分遮擋（只擋 x<0 半側）回介於 0 與 1 之間的精確比例', () => {
    // 目標中心 (0,1.5,-5)，半寬 1 → 角點 x ∈ {-1,+1}。牆只覆蓋 x∈[-2,0]，僅擋 x=-1 側的採樣點。
    const props = [box('half-wall', { x: -2, y: 0, z: -6 }, { x: 0, y: 3, z: -4 })];
    const fraction = visibleFractionForTarget({ x: -1, y: 1.5, z: 5 }, { x: 0, y: 1.5, z: -5 }, HITBOX, props, 9);
    expect(fraction).toBeGreaterThan(0);
    expect(fraction).toBeLessThan(1);
  });

  it('鏡像：對稱 eye/target/prop 座標系（x → −x）得到相同可見比例', () => {
    const props = [box('half-wall', { x: -2, y: 0, z: -6 }, { x: 0, y: 3, z: -4 })];
    const mirroredProps = [box('half-wall', { x: 0, y: 0, z: -6 }, { x: 2, y: 3, z: -4 })];
    const left = visibleFractionForTarget({ x: -1, y: 1.5, z: 5 }, { x: 0, y: 1.5, z: -5 }, HITBOX, props, 9);
    const right = visibleFractionForTarget({ x: 1, y: 1.5, z: 5 }, { x: 0, y: 1.5, z: -5 }, HITBOX, mirroredProps, 9);
    expect(right).toBe(left);
  });

  it('sampleCount 非 1/9 時 runtime throw', () => {
    expect(() =>
      visibleFractionForTarget({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, HITBOX, [], 5 as unknown as 1 | 9),
    ).toThrow('sampleCount must be 1 or 9');
  });
});
