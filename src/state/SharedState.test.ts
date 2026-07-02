import { describe, expect, it } from 'vitest';
import { createSharedState, resetState, sharedState } from './SharedState.ts';
import { pushEvent } from './inputRingTestUtil.ts';

describe('SharedState — 三迴圈溝通管道（型別 + 單例）', () => {
  it('createSharedState 回傳全零的獨立實例', () => {
    const a = createSharedState();
    expect(a.player).toEqual({ vx: 0, vz: 0, x: 0, z: 0 });
    expect(a.prev).toEqual({ x: 0, z: 0 });
    expect(a.curr).toEqual({ x: 0, z: 0 });
    expect(a.crosshair).toEqual({ cx: 0, cy: 0 });
    expect(a.input.size()).toBe(0);
    expect(a.targets).toHaveLength(0);
    expect(a.tVisible.size).toBe(0);

    // 實例彼此獨立、且不污染單例
    const b = createSharedState();
    b.player.x = 5;
    expect(a.player.x).toBe(0);
    expect(sharedState.player.x).toBe(0);
  });

  it('單例存在且導出穩定（同一物件參考）', () => {
    expect(sharedState).toBeDefined();
    expect(sharedState).toBe(sharedState);
  });

  it('resetState 原地清空緩衝與快照，並重用既有物件/陣列（GC 紀律）', () => {
    const s = createSharedState();
    const inputRef = s.input;
    const playerRef = s.player;
    const prevRef = s.prev;
    const targetsRef = s.targets;
    const tVisibleRef = s.tVisible;

    // 弄髒所有欄位
    pushEvent(s, { type: 'fire', t: 1 });
    s.player.vx = 250;
    s.player.x = 12;
    s.player.z = -3;
    s.prev.x = 1;
    s.curr.z = 2;
    s.crosshair.cx = 9;
    s.crosshair.cy = -9;
    s.targets.push({
      id: 't1',
      side: 'R',
      pos: { x: 0, y: 1, z: 8 },
      visible: true,
      alive: true,
      hitbox: { width: 1, height: 2, depth: 1 },
    });
    s.tVisible.set('t1', 123.4);

    resetState(s);

    expect(s.input.size()).toBe(0);
    expect(s.player).toEqual({ vx: 0, vz: 0, x: 0, z: 0 });
    expect(s.prev).toEqual({ x: 0, z: 0 });
    expect(s.curr).toEqual({ x: 0, z: 0 });
    expect(s.crosshair).toEqual({ cx: 0, cy: 0 });
    expect(s.targets).toHaveLength(0);
    expect(s.tVisible.size).toBe(0);

    // 重用同一參考（不 realloc）— GC 紀律
    expect(s.input).toBe(inputRef);
    expect(s.player).toBe(playerRef);
    expect(s.prev).toBe(prevRef);
    expect(s.targets).toBe(targetsRef);
    expect(s.tVisible).toBe(tVisibleRef);
  });

  it('resetState() 預設作用於單例', () => {
    sharedState.player.x = 99;
    pushEvent(sharedState, { type: 'key', code: 'KeyD', down: true, t: 0 });
    resetState();
    expect(sharedState.player.x).toBe(0);
    expect(sharedState.input.size()).toBe(0);
  });
});
