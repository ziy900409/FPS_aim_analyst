import { describe, expect, it } from 'vitest';
import { createSharedState, resetState } from '../state/SharedState.ts';
import type { InputEvent } from '../state/types.ts';
import { pushEvent, snapshot } from '../state/inputRingTestUtil.ts';
import { consume } from './consume.ts';

/**
 * consume 契約驗證 — WP-3 / T4（FR-3.4）+ T4b（固定欄位 ring 游標排空）
 *
 * 證明：依 `timeStamp` **升冪**、**無遺漏**消費落在半開窗 `[.., untilT)`（**嚴格 `<`**，GD-3）
 * 的事件並**排空**緩衝；寫入端 bounded insertion 保序 → 亂序寫入仍升冪交付（consume 不再排序，D-3b）；
 * 遲到事件夾進當前最舊 tick 並計 `lateEventCount`（GD-2）。邊界語意須與 WP-2 佔位一致（`t == untilT`
 * 落下一 tick），否則破壞 M1。交付的是**單一重用 view**，故收集端須就地快照（不保留參考）。
 */

/** 最小合成事件：以 `code` 標記便於斷言交付順序（type/down 對消費順序無關）。 */
function key(t: number, code = 'KeyD'): InputEvent {
  return { type: 'key', code, down: true, t };
}

/**
 * 收集 handle 交付的事件（**就地快照** view 當下欄位，不保留重用參考——delivery 契約）。
 * 保留 `t` 供順序斷言。
 */
function collector(): { handle: (ev: InputEvent) => void; delivered: InputEvent[] } {
  const delivered: InputEvent[] = [];
  return { handle: (ev) => delivered.push(snapshot(ev)), delivered };
}

describe('consume — 依時序消費 + 排空（FR-3.4）', () => {
  it('亂序寫入（時間戳交錯）→ 依 t 升冪交付（寫入端 bounded insertion 保序，consume 不排序）', () => {
    const s = createSharedState();
    for (const t of [5, 1, 3, 2, 4]) pushEvent(s, key(t)); // 到達順序亂
    const { handle, delivered } = collector();

    consume(s, 10, handle);

    expect(delivered.map((e) => e.t)).toEqual([1, 2, 3, 4, 5]); // 升冪交付
    expect(s.input.size()).toBe(0); // 全數 < 10 → 排空
  });

  it('跨 tick 邊界正確分批；邊界事件 t == untilT 落下一 tick（嚴格 `<`，非 `<=`）', () => {
    const s = createSharedState();
    // 5 落本窗；7.8125 恰在邊界（嚴格 < → 不落本窗）；10、20 之後
    for (const t of [5, 7.8125, 10, 20]) pushEvent(s, key(t));

    const first = collector();
    consume(s, 7.8125, first.handle); // 窗 [.., 7.8125)
    expect(first.delivered.map((e) => e.t)).toEqual([5]); // 只 5；邊界 7.8125 不含
    expect(s.input.size()).toBe(3); // 邊界事件 + 之後皆留待下一 tick

    const second = collector();
    consume(s, 15.625, second.handle); // 窗 [7.8125, 15.625)
    expect(second.delivered.map((e) => e.t)).toEqual([7.8125, 10]); // 邊界事件此 tick 才消費
    expect(s.input.size()).toBe(1); // 20 仍待下一 tick

    const third = collector();
    consume(s, Infinity, third.handle);
    expect(third.delivered.map((e) => e.t)).toEqual([20]);
  });

  it('緩衝最終排空：消費後殘留者皆 t >= untilT、且升冪待續', () => {
    const s = createSharedState();
    for (const t of [2, 9, 9.5, 30, 12]) pushEvent(s, key(t));

    const first = collector();
    consume(s, 10, first.handle);
    expect(first.delivered.map((e) => e.t)).toEqual([2, 9, 9.5]); // 到期者升冪
    expect(s.input.size()).toBe(2); // 30、12 未到期

    const rest = collector();
    consume(s, Infinity, rest.handle);
    expect(rest.delivered.map((e) => e.t)).toEqual([12, 30]); // 殘留亦升冪、皆 >= 10
  });

  it('遲到事件夾進當前最舊 tick + lateEventCount 遞增（不丟棄）', () => {
    const s = createSharedState();
    for (const t of [5, 10]) pushEvent(s, key(t));

    const first = collector();
    consume(s, 7.8125, first.handle); // 消費 5；lastConsumedT → 7.8125
    expect(first.delivered.map((e) => e.t)).toEqual([5]);
    expect(s.inputMeta.lateEventCount).toBe(0); // 首窗無遲到

    // 遲到事件：t=3 早於已關閉窗邊界 7.8125，於下一 tick 才進緩衝（bounded insertion 前移至 head 端）
    pushEvent(s, key(3));
    const second = collector();
    consume(s, 15.625, second.handle); // 窗 [7.8125, 15.625)

    expect(second.delivered.map((e) => e.t)).toEqual([3, 10]); // 遲到者夾進、升冪在前、不丟棄
    expect(s.inputMeta.lateEventCount).toBe(1); // 只 t=3 計遲到（t=10 準時）
    expect(s.input.size()).toBe(0);
  });

  it('resetState 歸零 inputMeta（lateEventCount / lastConsumedT / bufferOverflow），重用同一物件', () => {
    const s = createSharedState();
    const metaRef = s.inputMeta;
    const ringRef = s.input;
    pushEvent(s, key(1));
    consume(s, 5, collector().handle); // 推進 lastConsumedT
    s.inputMeta.lateEventCount = 3; // 弄髒
    s.inputMeta.bufferOverflow = 7;

    resetState(s);

    expect(s.inputMeta.lateEventCount).toBe(0);
    expect(s.inputMeta.lastConsumedT).toBe(-Infinity);
    expect(s.inputMeta.bufferOverflow).toBe(0);
    expect(s.input.size()).toBe(0);
    expect(s.inputMeta).toBe(metaRef); // 原地重用、不 realloc（GC 紀律）
    expect(s.input).toBe(ringRef); // ring 物件與 typed-array 重用、不 realloc
  });
});
