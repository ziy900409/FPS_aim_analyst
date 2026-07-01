import { beforeEach, describe, expect, it } from 'vitest';
import { createInputSampler } from './InputSampler.ts';
import { createSharedState } from '../state/SharedState.ts';

/**
 * 無 DOM 的假 target：捕捉 addEventListener 註冊的 handler，供測試直接派發合成事件
 * （node 環境無 KeyboardEvent/HTMLElement，且本專案慣以注入假物件測試——見 clock.ts）。
 */
function makeFakeTarget() {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    addEventListener(type: string, cb: EventListener): void {
      let set = listeners.get(type);
      if (!set) listeners.set(type, (set = new Set()));
      set.add(cb);
    },
    removeEventListener(type: string, cb: EventListener): void {
      listeners.get(type)?.delete(cb);
    },
    /** 派發一個合成事件到已註冊的 handler（鍵盤或滑鼠欄位皆可）。 */
    dispatch(type: string, ev: Partial<KeyboardEvent & MouseEvent>): void {
      for (const cb of listeners.get(type) ?? []) cb(ev as unknown as Event);
    },
    count(type: string): number {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function keyEvent(code: string, timeStamp: number, repeat = false): Partial<KeyboardEvent> {
  return { code, timeStamp, repeat };
}

function mouseEvent(button: number, timeStamp: number): Partial<MouseEvent> {
  return { button, timeStamp };
}

describe('InputSampler — 鍵盤採集（keydown/keyup + event.timeStamp）', () => {
  let state: ReturnType<typeof createSharedState>;
  let target: ReturnType<typeof makeFakeTarget>;
  let sampler: ReturnType<typeof createInputSampler>;

  beforeEach(() => {
    state = createSharedState();
    target = makeFakeTarget();
    sampler = createInputSampler(state);
    sampler.attach(target as unknown as EventTarget);
  });

  it('keydown/keyup 蓋 event.timeStamp 寫入緩衝', () => {
    target.dispatch('keydown', keyEvent('KeyD', 10));
    target.dispatch('keyup', keyEvent('KeyD', 100));

    expect(state.input).toEqual([
      { type: 'key', code: 'KeyD', down: true, t: 10 },
      { type: 'key', code: 'KeyD', down: false, t: 100 },
    ]);
  });

  it('採集 A/D/W/S；忽略無關按鍵（不污染緩衝）', () => {
    target.dispatch('keydown', keyEvent('KeyA', 1));
    target.dispatch('keydown', keyEvent('KeyW', 2));
    target.dispatch('keydown', keyEvent('KeyS', 3));
    target.dispatch('keydown', keyEvent('Space', 4)); // 無關
    target.dispatch('keydown', keyEvent('KeyQ', 5)); // 無關

    expect(state.input.map((e) => e.type === 'key' && e.code)).toEqual(['KeyA', 'KeyW', 'KeyS']);
  });

  it('event.repeat 的 keydown 不重複入緩衝（只記真實狀態轉換）', () => {
    target.dispatch('keydown', keyEvent('KeyD', 10, false));
    target.dispatch('keydown', keyEvent('KeyD', 18, true)); // OS 自動重複
    target.dispatch('keydown', keyEvent('KeyD', 26, true));
    target.dispatch('keyup', keyEvent('KeyD', 40));

    expect(state.input).toEqual([
      { type: 'key', code: 'KeyD', down: true, t: 10 },
      { type: 'key', code: 'KeyD', down: false, t: 40 },
    ]);
  });

  it('時間戳原樣保留（不改寫、不用 Date.now）', () => {
    target.dispatch('keydown', keyEvent('KeyA', 1234.5678));
    expect(state.input[0].t).toBe(1234.5678);
  });

  it('detach 後移除監聽、後續事件不再入緩衝', () => {
    sampler.detach();
    expect(target.count('keydown')).toBe(0);
    expect(target.count('keyup')).toBe(0);

    target.dispatch('keydown', keyEvent('KeyD', 10));
    expect(state.input).toHaveLength(0);
  });

  it('重複 attach 冪等（不疊聽 → 單一事件只 push 一次）', () => {
    sampler.attach(target as unknown as EventTarget); // 第二次 attach
    expect(target.count('keydown')).toBe(1);

    target.dispatch('keydown', keyEvent('KeyD', 10));
    expect(state.input).toHaveLength(1);
  });
});

describe('InputSampler — 開火採集（mousedown 左鍵 + event.timeStamp，僅鎖定中）', () => {
  let state: ReturnType<typeof createSharedState>;
  let target: ReturnType<typeof makeFakeTarget>;
  let sampler: ReturnType<typeof createInputSampler>;
  let locked: boolean; // 可變 Pointer Lock 狀態，注入為 isLocked 閘門

  beforeEach(() => {
    state = createSharedState();
    target = makeFakeTarget();
    locked = true;
    sampler = createInputSampler(state, () => locked);
    sampler.attach(target as unknown as EventTarget);
  });

  it('鎖定中左鍵 mousedown 蓋 event.timeStamp 入緩衝', () => {
    target.dispatch('mousedown', mouseEvent(0, 512.25));
    expect(state.input).toEqual([{ type: 'fire', t: 512.25 }]);
  });

  it('未鎖定時不採計（避免取鎖點擊 / UI 點擊誤判為開火）', () => {
    locked = false;
    target.dispatch('mousedown', mouseEvent(0, 512.25));
    expect(state.input).toHaveLength(0);
  });

  it('非左鍵（右鍵/中鍵）不入緩衝', () => {
    target.dispatch('mousedown', mouseEvent(2, 10)); // 右鍵
    target.dispatch('mousedown', mouseEvent(1, 20)); // 中鍵
    expect(state.input).toHaveLength(0);
  });

  it('detach 後移除 mousedown 監聽、後續開火不再入緩衝', () => {
    sampler.detach();
    expect(target.count('mousedown')).toBe(0);

    target.dispatch('mousedown', mouseEvent(0, 10));
    expect(state.input).toHaveLength(0);
  });
});
