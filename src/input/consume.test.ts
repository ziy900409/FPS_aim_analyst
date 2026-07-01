import { describe, expect, it } from 'vitest';
import { createSharedState, resetState } from '../state/SharedState.ts';
import type { InputEvent } from '../state/types.ts';
import { consume } from './consume.ts';

/**
 * consume 契約驗證 — WP-3 / T4（FR-3.4）
 *
 * 證明：依 `timeStamp` **升冪**、**無遺漏**消費落在半開窗 `[.., untilT)`（**嚴格 `<`**，GD-3）
 * 的事件並**排空**緩衝；亂序 push 仍升冪交付（局部窗排序，D-3b）；遲到事件夾進當前最舊 tick 並計
 * `lateEventCount`（GD-2）。邊界語意須與 WP-2 佔位一致（`t == untilT` 落下一 tick），否則破壞 M1。
 */

/** 最小合成事件：以 `code` 標記便於斷言交付順序（type/down 對消費順序無關）。 */
function key(t: number, code = 'KeyD'): InputEvent {
  return { type: 'key', code, down: true, t };
}

/** 收集 handle 交付的事件（含其 `t`），供順序/內容斷言。 */
function collector(): { handle: (ev: InputEvent) => void; delivered: InputEvent[] } {
  const delivered: InputEvent[] = [];
  return { handle: (ev) => delivered.push(ev), delivered };
}

describe('consume — 依時序消費 + 排空（FR-3.4）', () => {
  it('亂序 push（時間戳交錯）→ 依 t 升冪交付', () => {
    const s = createSharedState();
    s.input.push(key(5), key(1), key(3), key(2), key(4)); // 到達順序亂
    const { handle, delivered } = collector();

    consume(s, 10, handle);

    expect(delivered.map((e) => e.t)).toEqual([1, 2, 3, 4, 5]); // 升冪交付
    expect(s.input).toHaveLength(0); // 全數 < 10 → 排空
  });

  it('跨 tick 邊界正確分批；邊界事件 t == untilT 落下一 tick（嚴格 `<`，非 `<=`）', () => {
    const s = createSharedState();
    // 5 落本窗；7.8125 恰在邊界（嚴格 < → 不落本窗）；10、20 之後
    s.input.push(key(5), key(7.8125), key(10), key(20));

    const first = collector();
    consume(s, 7.8125, first.handle); // 窗 [.., 7.8125)
    expect(first.delivered.map((e) => e.t)).toEqual([5]); // 只 5；邊界 7.8125 不含
    expect(s.input.map((e) => e.t)).toEqual([7.8125, 10, 20]); // 邊界事件留待下一 tick

    const second = collector();
    consume(s, 15.625, second.handle); // 窗 [7.8125, 15.625)
    expect(second.delivered.map((e) => e.t)).toEqual([7.8125, 10]); // 邊界事件此 tick 才消費
    expect(s.input.map((e) => e.t)).toEqual([20]); // 20 仍待下一 tick
  });

  it('緩衝最終排空：消費後殘留者皆 t >= untilT', () => {
    const s = createSharedState();
    s.input.push(key(2), key(9), key(9.5), key(30), key(12));
    const { handle } = collector();

    consume(s, 10, handle);

    expect(s.input.every((e) => e.t >= 10)).toBe(true); // 殘留皆未到期
    expect(s.input.map((e) => e.t).sort((a, b) => a - b)).toEqual([12, 30]);
  });

  it('遲到事件夾進當前最舊 tick + lateEventCount 遞增（不丟棄）', () => {
    const s = createSharedState();
    s.input.push(key(5), key(10));

    const first = collector();
    consume(s, 7.8125, first.handle); // 消費 5；lastConsumedT → 7.8125
    expect(first.delivered.map((e) => e.t)).toEqual([5]);
    expect(s.inputMeta.lateEventCount).toBe(0); // 首窗無遲到

    // 遲到事件：t=3 早於已關閉窗邊界 7.8125，於下一 tick 才進緩衝
    s.input.push(key(3));
    const second = collector();
    consume(s, 15.625, second.handle); // 窗 [7.8125, 15.625)

    expect(second.delivered.map((e) => e.t)).toEqual([3, 10]); // 遲到者夾進、升冪在前、不丟棄
    expect(s.inputMeta.lateEventCount).toBe(1); // 只 t=3 計遲到（t=10 準時）
    expect(s.input).toHaveLength(0);
  });

  it('resetState 歸零 inputMeta（lateEventCount / lastConsumedT），重用同一物件', () => {
    const s = createSharedState();
    const metaRef = s.inputMeta;
    s.input.push(key(1));
    consume(s, 5, collector().handle); // 推進 lastConsumedT
    s.inputMeta.lateEventCount = 3; // 弄髒

    resetState(s);

    expect(s.inputMeta.lateEventCount).toBe(0);
    expect(s.inputMeta.lastConsumedT).toBe(-Infinity);
    expect(s.inputMeta).toBe(metaRef); // 原地重用、不 realloc（GC 紀律）
  });
});