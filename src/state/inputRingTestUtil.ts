import type { SharedState } from './SharedState.ts';
import type { InputEvent } from './types.ts';
import { KEY_CODE } from './types.ts';
import { consume } from '../input/consume.ts';

/**
 * 測試設施 — 固定欄位 ring buffer（T4b）
 *
 * 生產寫入端（`InputSampler`）以 primitive 的 `pushKey/pushMouse/pushFire` 寫入 ring（零物件配置）；
 * 測試多以邏輯 `InputEvent` 表述合成序列，故此處提供對等的編碼/快照 helper，取代舊 plain-array
 * 時代的 `state.input.push({...})`。
 */

/** 把邏輯 `InputEvent` 編碼寫入 ring（對應生產的 typed push）；回傳是否被接受（滿則 false）。 */
export function pushEvent(state: SharedState, ev: InputEvent): boolean {
  if (ev.type === 'key') return state.input.pushKey(KEY_CODE[ev.code], ev.down, ev.t);
  if (ev.type === 'mouse') return state.input.pushMouse(ev.dx, ev.dy, ev.t);
  if (ev.type === 'ads') return state.input.pushAds(ev.down, ev.t);
  return state.input.pushFire(ev.down, ev.t);
}

/**
 * 消費 `[.., untilT)` 的事件為 plain 快照陣列（**複製欄位**、不保留重用 view 參考）。
 * 供內容/順序斷言；預設 `Infinity` 排空全部。會推進 `inputMeta.lastConsumedT`（與正式 consume 同）。
 */
export function drainToArray(state: SharedState, untilT = Infinity): InputEvent[] {
  const out: InputEvent[] = [];
  consume(state, untilT, (ev) => out.push(snapshot(ev)));
  return out;
}

/** 就地複製一份 view 的當下欄位（避免保留重用 view 參考——delivery 契約）。 */
export function snapshot(ev: InputEvent): InputEvent {
  if (ev.type === 'key') return { type: 'key', code: ev.code, down: ev.down, t: ev.t };
  if (ev.type === 'mouse') return { type: 'mouse', dx: ev.dx, dy: ev.dy, t: ev.t };
  if (ev.type === 'ads') return { type: 'ads', down: ev.down, t: ev.t };
  return { type: 'fire', down: ev.down, t: ev.t };
}
