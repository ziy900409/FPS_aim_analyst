import { describe, expect, it } from 'vitest';
import { createInputRing } from './SharedState.ts';
import type { InputEvent, InputEventView, InputRing } from './types.ts';
import { KEY_CODE, RING_CAPACITY } from './types.ts';
import { snapshot } from './inputRingTestUtil.ts';

/**
 * 固定欄位 ring buffer 契約 — WP-3 / T4b（OQ-3.2 / GD-2 / CLAUDE.md §4）
 *
 * 證明真 ring 語意：**消費後槽位繞圈重用**、寫入端 **bounded insertion 保序**、容量滿 **拒收新事件、
 * 不丟最舊**、packed 槽位 `type,t,a,b` 就地解碼進**單一重用 view** 保真、`clear` 原地歸零可續用。
 * consume 端的窗/遲到語意在 [consume.test.ts](../input/consume.test.ts)。
 */

/** 以單一重用 view 排空整個 ring，逐一就地快照為 plain 陣列（不保留 view 參考）。 */
function drainAll(ring: InputRing): InputEvent[] {
  const view: InputEventView = { type: 'key', code: '', down: false, dx: 0, dy: 0, t: 0 };
  const out: InputEvent[] = [];
  while (!ring.isEmpty()) {
    ring.dequeueInto(view);
    out.push(snapshot(view as unknown as InputEvent));
  }
  return out;
}

describe('InputRing — 固定欄位真 ring（繞圈 / 保序 / 溢位 / 重用）', () => {
  it('消費後槽位繞圈重用：寫入超過索引 0 邊界，順序與值仍正確', () => {
    const ring = createInputRing();
    // 推進 head 越過索引 0（近繞一圈）：填近滿再排空
    for (let i = 0; i < RING_CAPACITY - 2; i++) ring.pushKey(KEY_CODE.KeyD, true, i + 1);
    drainAll(ring); // head 推進到近 tail；後續寫入將繞過索引 0
    expect(ring.isEmpty()).toBe(true);

    // 再寫 5 筆 mouse（時間戳遞增）→ 物理槽位繞過索引 0 重用
    const times = [1000, 1001, 1002, 1003, 1004];
    for (const t of times) expect(ring.pushMouse(t, -t, t)).toBe(true);
    expect(ring.size()).toBe(5);

    const drained = drainAll(ring);
    expect(drained.map((e) => e.t)).toEqual(times); // 繞圈後 FIFO 順序正確
    expect(drained.map((e) => e.type === 'mouse' && e.dx)).toEqual(times); // 槽位值無殘留污染
  });

  it('容量滿 → push* 回 false（拒收新事件）、不覆寫最舊槽（不靜默丟最舊，GD-2）', () => {
    const ring = createInputRing();
    for (let i = 0; i < RING_CAPACITY; i++) {
      expect(ring.pushKey(KEY_CODE.KeyA, true, i + 1)).toBe(true);
    }
    expect(ring.size()).toBe(RING_CAPACITY);

    expect(ring.pushKey(KEY_CODE.KeyD, true, 99999)).toBe(false); // 滿 → 拒收
    expect(ring.pushFire(true, 99999)).toBe(false);
    expect(ring.size()).toBe(RING_CAPACITY); // 未增

    const drained = drainAll(ring);
    expect(drained).toHaveLength(RING_CAPACITY);
    expect(drained[0].t).toBe(1); // 最舊仍在（未被新事件覆寫）
    expect(drained[drained.length - 1].t).toBe(RING_CAPACITY); // 拒收者未入
  });

  it('寫入端 bounded insertion：亂序（時間戳交錯）寫入 → 排空升冪（consume 無需排序）', () => {
    const ring = createInputRing();
    for (const t of [5, 1, 3, 2, 4, 10, 8, 9, 7, 6]) ring.pushKey(KEY_CODE.KeyD, true, t);

    const drained = drainAll(ring);
    expect(drained.map((e) => e.t)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('相等時間戳保到達順序（stable：bounded insertion 嚴格 `<` 不換）', () => {
    const ring = createInputRing();
    ring.pushKey(KEY_CODE.KeyA, true, 5); // 先到
    ring.pushKey(KEY_CODE.KeyD, true, 5); // 同 t、後到
    const drained = drainAll(ring);
    expect(drained.map((e) => e.type === 'key' && e.code)).toEqual(['KeyA', 'KeyD']);
  });

  it('packed 槽位就地解碼保真（key / mouse / fire 三型）', () => {
    const ring = createInputRing();
    ring.pushKey(KEY_CODE.KeyA, false, 1);
    ring.pushMouse(3, -4, 2);
    ring.pushFire(true, 3);

    expect(drainAll(ring)).toEqual([
      { type: 'key', code: 'KeyA', down: false, t: 1 },
      { type: 'mouse', dx: 3, dy: -4, t: 2 },
      { type: 'fire', down: true, t: 3 },
    ]);
  });

  it('packed 槽位就地解碼保真（ads 型 b=down，比照 fire；四型並存升冪解碼，WP-24 / T1）', () => {
    const ring = createInputRing();
    ring.pushAds(true, 1);
    ring.pushKey(KEY_CODE.KeyA, false, 2);
    ring.pushFire(true, 3);
    ring.pushAds(false, 4);

    expect(drainAll(ring)).toEqual([
      { type: 'ads', down: true, t: 1 },
      { type: 'key', code: 'KeyA', down: false, t: 2 },
      { type: 'fire', down: true, t: 3 },
      { type: 'ads', down: false, t: 4 },
    ]);
  });

  it('ads 走與 fire 同一 bounded insertion 保序（亂序寫入 → 排空升冪）', () => {
    const ring = createInputRing();
    ring.pushAds(true, 5);
    ring.pushAds(false, 1);
    ring.pushAds(true, 3);
    expect(drainAll(ring).map((e) => e.t)).toEqual([1, 3, 5]);
  });

  it('dequeueInto 覆寫同一重用 view（不配置新物件 — delivery 契約）', () => {
    const ring = createInputRing();
    ring.pushFire(true, 1);
    ring.pushFire(false, 2);
    const view: InputEventView = { type: 'key', code: '', down: false, dx: 0, dy: 0, t: 0 };

    ring.dequeueInto(view);
    expect(view.t).toBe(1);
    expect(view.down).toBe(true);
    ring.dequeueInto(view);
    expect(view.t).toBe(2); // 同一物件被就地覆寫
    expect(view.down).toBe(false);
  });

  it('dequeueInto 空 ring 為 no-op（防呆：不推進 head / count 不變負）', () => {
    const ring = createInputRing();
    const view: InputEventView = { type: 'key', code: '', down: false, dx: 0, dy: 0, t: 0 };

    ring.dequeueInto(view); // 空 → no-op
    expect(ring.size()).toBe(0); // count 未變負
    expect(ring.isEmpty()).toBe(true);

    ring.pushFire(true, 5); // 續用正常（head 未被空呼叫錯推）
    ring.dequeueInto(view);
    expect(view.t).toBe(5);
    expect(ring.size()).toBe(0);
  });

  it('clear 原地歸零游標、可續用（typed-array 重用、不 realloc）', () => {
    const ring = createInputRing();
    ring.pushKey(KEY_CODE.KeyD, true, 1);
    ring.clear();
    expect(ring.size()).toBe(0);
    expect(ring.isEmpty()).toBe(true);

    ring.pushFire(false, 2); // clear 後續用正常
    expect(drainAll(ring)).toEqual([{ type: 'fire', down: false, t: 2 }]);
  });
});
