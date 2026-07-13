import { beforeEach, describe, expect, it } from 'vitest';
import { createInputSampler } from './InputSampler.ts';
import { createSharedState } from '../state/SharedState.ts';
import { KEY_CODE, RING_CAPACITY } from '../state/types.ts';
import { drainToArray } from '../state/inputRingTestUtil.ts';

/**
 * 無 DOM 的假 target：捕捉 addEventListener 註冊的 handler，供測試直接派發合成事件
 * （node 環境無 KeyboardEvent/HTMLElement，且本專案慣以注入假物件測試——見 clock.ts）。
 *
 * T4b：`state.input` 為固定欄位 ring，內容斷言以 `drainToArray`（消費為 plain 快照陣列、升冪）表述，
 * 長度斷言以 `state.input.size()`（取代舊 plain-array 的 `toEqual([...])` / `toHaveLength`）。
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
    /** 派發一個合成事件到已註冊的 handler（鍵盤 / 滑鼠 / 指標欄位皆可）。 */
    dispatch(type: string, ev: Partial<KeyboardEvent & MouseEvent & PointerEvent>): void {
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

/** 單一 coalesced 子樣本（movementX/Y + timeStamp），作為 pointermove 的子事件。 */
function coalescedSample(dx: number, dy: number, timeStamp: number): Partial<PointerEvent> {
  return { movementX: dx, movementY: dy, timeStamp };
}

/**
 * 合成 pointermove：`getCoalescedEvents()` 回傳指定子樣本（多筆 → 次幀軌跡）。
 * 頂層 event 的 movement/timeStamp 取最後一筆（瀏覽器行為：外層為該幀最終值）。
 */
function pointerMoveEvent(samples: Partial<PointerEvent>[]): Partial<PointerEvent> {
  const last = samples[samples.length - 1];
  return {
    movementX: last.movementX,
    movementY: last.movementY,
    timeStamp: last.timeStamp,
    getCoalescedEvents: () => samples as PointerEvent[],
  };
}

/** 舊瀏覽器：無 `getCoalescedEvents`，pointermove 僅頂層 movement/timeStamp。 */
function legacyPointerMoveEvent(dx: number, dy: number, timeStamp: number): Partial<PointerEvent> {
  return { movementX: dx, movementY: dy, timeStamp };
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

    expect(drainToArray(state)).toEqual([
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

    const drained = drainToArray(state);
    expect(drained.map((e) => e.type === 'key' && e.code)).toEqual(['KeyA', 'KeyW', 'KeyS']);
  });

  it('event.repeat 的 keydown 不重複入緩衝（只記真實狀態轉換）', () => {
    target.dispatch('keydown', keyEvent('KeyD', 10, false));
    target.dispatch('keydown', keyEvent('KeyD', 18, true)); // OS 自動重複
    target.dispatch('keydown', keyEvent('KeyD', 26, true));
    target.dispatch('keyup', keyEvent('KeyD', 40));

    expect(drainToArray(state)).toEqual([
      { type: 'key', code: 'KeyD', down: true, t: 10 },
      { type: 'key', code: 'KeyD', down: false, t: 40 },
    ]);
  });

  it('時間戳原樣保留（不改寫、不用 Date.now）', () => {
    target.dispatch('keydown', keyEvent('KeyA', 1234.5678));
    expect(drainToArray(state)[0].t).toBe(1234.5678);
  });

  it('detach 後移除監聽、後續事件不再入緩衝', () => {
    sampler.detach();
    expect(target.count('keydown')).toBe(0);
    expect(target.count('keyup')).toBe(0);

    target.dispatch('keydown', keyEvent('KeyD', 10));
    expect(state.input.size()).toBe(0);
  });

  it('重複 attach 冪等（不疊聽 → 單一事件只寫一次）', () => {
    sampler.attach(target as unknown as EventTarget); // 第二次 attach
    expect(target.count('keydown')).toBe(1);

    target.dispatch('keydown', keyEvent('KeyD', 10));
    expect(state.input.size()).toBe(1);
  });

  it('容量滿 → 溢位升 bufferOverflow、拒收新事件、不丟最舊（GD-2）', () => {
    // 直接填滿 ring 到靜態容量（每槽遞增時間戳，保序 append）
    for (let i = 0; i < RING_CAPACITY; i++) state.input.pushKey(KEY_CODE.KeyD, true, i + 1);
    expect(state.input.size()).toBe(RING_CAPACITY);

    // 經 sampler 再派發一個 keydown → 滿 → 拒收、升溢位、size 不增
    target.dispatch('keydown', keyEvent('KeyD', 99999));
    expect(state.inputMeta.bufferOverflow).toBe(1);
    expect(state.input.size()).toBe(RING_CAPACITY);

    // 最舊（t=1）仍在、未被覆寫（不靜默丟最舊）；全數升冪完整消費
    const drained = drainToArray(state);
    expect(drained).toHaveLength(RING_CAPACITY);
    expect(drained[0].t).toBe(1);
    expect(drained[drained.length - 1].t).toBe(RING_CAPACITY); // 99999 未入（拒收）
    expect(drained.every((e, i) => i === 0 || e.t >= drained[i - 1].t)).toBe(true);
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
    expect(drainToArray(state)).toEqual([{ type: 'fire', down: true, t: 512.25 }]);
  });

  it('已採計 fire-down 後即使解鎖，mouseup 仍送 fire-up（stuck-fire 防護）', () => {
    target.dispatch('mousedown', mouseEvent(0, 512.25));
    locked = false;
    target.dispatch('mouseup', mouseEvent(0, 620.5));

    expect(drainToArray(state)).toEqual([
      { type: 'fire', down: true, t: 512.25 },
      { type: 'fire', down: false, t: 620.5 },
    ]);
  });

  it('未鎖定時不採計（避免取鎖點擊 / UI 點擊誤判為開火）', () => {
    locked = false;
    target.dispatch('mousedown', mouseEvent(0, 512.25));
    target.dispatch('mouseup', mouseEvent(0, 620.5));
    expect(state.input.size()).toBe(0);
  });

  it('中鍵不入緩衝（右鍵 ADS 語意見 WP-24 / T1 describe）', () => {
    // WP-24 / T1：右鍵改採計為 ADS（見下方 ADS describe）；此處僅驗中鍵仍不污染開火緩衝。
    target.dispatch('mousedown', mouseEvent(1, 20)); // 中鍵
    expect(state.input.size()).toBe(0);
  });

  it('detach 後移除 mousedown 監聽、後續開火不再入緩衝', () => {
    sampler.detach();
    expect(target.count('mousedown')).toBe(0);
    expect(target.count('mouseup')).toBe(0);

    target.dispatch('mousedown', mouseEvent(0, 10));
    target.dispatch('mouseup', mouseEvent(0, 20));
    expect(state.input.size()).toBe(0);
  });
});

describe('InputSampler — ADS 開鏡採集（右鍵 mousedown/mouseup + contextmenu 抑制 + stuck 防護，WP-24 / T1）', () => {
  let state: ReturnType<typeof createSharedState>;
  let target: ReturnType<typeof makeFakeTarget>;
  let sampler: ReturnType<typeof createInputSampler>;
  let locked: boolean;

  beforeEach(() => {
    state = createSharedState();
    target = makeFakeTarget();
    locked = true;
    sampler = createInputSampler(state, () => locked);
    sampler.attach(target as unknown as EventTarget);
  });

  it('鎖定中右鍵 mousedown/mouseup 蓋 event.timeStamp 入緩衝（ads down/up）', () => {
    target.dispatch('mousedown', mouseEvent(2, 300.5));
    target.dispatch('mouseup', mouseEvent(2, 480.25));

    expect(drainToArray(state)).toEqual([
      { type: 'ads', down: true, t: 300.5 },
      { type: 'ads', down: false, t: 480.25 },
    ]);
  });

  it('已採計 ads-down 後即使解鎖，mouseup 仍送 ads-up（stuck-ads 防護）', () => {
    target.dispatch('mousedown', mouseEvent(2, 300.5));
    locked = false; // 按住期間 Esc/失焦解鎖
    target.dispatch('mouseup', mouseEvent(2, 480.25));

    expect(drainToArray(state)).toEqual([
      { type: 'ads', down: true, t: 300.5 },
      { type: 'ads', down: false, t: 480.25 },
    ]);
  });

  it('未鎖定時右鍵不採計（避免取鎖前右鍵 / UI 右鍵污染量測）', () => {
    locked = false;
    target.dispatch('mousedown', mouseEvent(2, 300.5));
    target.dispatch('mouseup', mouseEvent(2, 480.25)); // 未採計 down → up 亦不送
    expect(state.input.size()).toBe(0);
  });

  it('快速點放（同序列 down+up）依到達順序入緩衝', () => {
    target.dispatch('mousedown', mouseEvent(2, 100));
    target.dispatch('mouseup', mouseEvent(2, 108));
    expect(drainToArray(state)).toEqual([
      { type: 'ads', down: true, t: 100 },
      { type: 'ads', down: false, t: 108 },
    ]);
  });

  it('releaseAds：解鎖中仍按住右鍵時補送 ads-up（stuck 防護接縫）', () => {
    target.dispatch('mousedown', mouseEvent(2, 300.5)); // 按住、無 mouseup
    sampler.releaseAds(900); // PointerLock 解鎖掛點觸發

    expect(drainToArray(state)).toEqual([
      { type: 'ads', down: true, t: 300.5 },
      { type: 'ads', down: false, t: 900 },
    ]);
  });

  it('releaseAds 未按住時為 no-op（不送多餘 ads-up）', () => {
    sampler.releaseAds(900);
    expect(state.input.size()).toBe(0);

    // 一次完整 down→up 後 releaseAds 亦不重複補 up（已消耗 held 狀態）
    target.dispatch('mousedown', mouseEvent(2, 100));
    target.dispatch('mouseup', mouseEvent(2, 108));
    sampler.releaseAds(200);
    expect(drainToArray(state)).toEqual([
      { type: 'ads', down: true, t: 100 },
      { type: 'ads', down: false, t: 108 },
    ]);
  });

  it('contextmenu：鎖定中 preventDefault（抑制右鍵選單）；未鎖定不抑制', () => {
    let prevented = 0;
    const ctx = () => ({ preventDefault: () => { prevented++; } });

    target.dispatch('contextmenu', ctx() as unknown as Partial<MouseEvent>);
    expect(prevented).toBe(1); // 鎖定中抑制

    locked = false;
    target.dispatch('contextmenu', ctx() as unknown as Partial<MouseEvent>);
    expect(prevented).toBe(1); // 未鎖定不再抑制（放行一般右鍵選單）
  });

  it('detach 後移除右鍵/contextmenu 監聽、releaseAds 不再補 up', () => {
    target.dispatch('mousedown', mouseEvent(2, 100)); // 採計 down
    sampler.detach();
    expect(target.count('mousedown')).toBe(0);
    expect(target.count('contextmenu')).toBe(0);

    // detach 清空 held → releaseAds no-op；後續右鍵事件亦不入緩衝
    const before = state.input.size();
    sampler.releaseAds(200);
    target.dispatch('mousedown', mouseEvent(2, 300));
    expect(state.input.size()).toBe(before);
  });
});

describe('InputSampler — 滑鼠 coalesced 採集（pointermove + getCoalescedEvents 次幀採樣）', () => {
  let state: ReturnType<typeof createSharedState>;
  let target: ReturnType<typeof makeFakeTarget>;
  let sampler: ReturnType<typeof createInputSampler>;

  beforeEach(() => {
    state = createSharedState();
    target = makeFakeTarget();
    sampler = createInputSampler(state);
    sampler.attach(target as unknown as EventTarget);
  });

  it('單一 pointermove 的多個 coalesced 子事件各記一筆（次幀樣本無遺漏）', () => {
    target.dispatch(
      'pointermove',
      pointerMoveEvent([
        coalescedSample(3, -1, 100),
        coalescedSample(5, 0, 100.5),
        coalescedSample(2, 2, 101),
      ]),
    );

    // 樣本數 = 子事件數（> 1 筆，證明次幀採樣），dx/dy 對應、timeStamp 遞增
    const drained = drainToArray(state);
    expect(drained).toEqual([
      { type: 'mouse', dx: 3, dy: -1, t: 100 },
      { type: 'mouse', dx: 5, dy: 0, t: 100.5 },
      { type: 'mouse', dx: 2, dy: 2, t: 101 },
    ]);
    const times = drained.map((e) => e.t);
    expect(times).toEqual([...times].sort((a, b) => a - b)); // 遞增
  });

  it('getCoalescedEvents 不存在（舊瀏覽器）時 fallback 到單筆頂層事件', () => {
    target.dispatch('pointermove', legacyPointerMoveEvent(7, -4, 250));
    expect(drainToArray(state)).toEqual([{ type: 'mouse', dx: 7, dy: -4, t: 250 }]);
  });

  it('detach 後移除 pointermove 監聽、後續移動不再入緩衝', () => {
    sampler.detach();
    expect(target.count('pointermove')).toBe(0);

    target.dispatch('pointermove', pointerMoveEvent([coalescedSample(1, 1, 10)]));
    expect(state.input.size()).toBe(0);
  });
});
