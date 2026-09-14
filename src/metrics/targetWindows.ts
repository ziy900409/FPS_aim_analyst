import type { DrillEvent } from '../data/DataRecorder.ts';
import type { ExportPayload } from '../data/export.ts';
import { WINDOW_EPSILON_MS } from './peekWindows.ts';

/**
 * WP-63 / T3 —— population-aware 的**窗界**原語。
 *
 * 既有 `buildPeekWindows()` 的窗界是 `[visible_i.t, visible_{i+1}.t)`，那是嚴格序列單目標模型。
 * `micro_flick_three_target_test_v8` 場上同時三顆，下一個 `visible` 通常屬於**另一顆** ⇒ 每顆的
 * 分析窗會被別人的 spawn 截斷。本模組只回答兩個問題：**每顆目標活在哪一段**、**某時刻誰活著**。
 *
 * ⚠️ 硬紀律（C-D4，WP-63 README §2.3）：本模組**不得**計算 ε(t)、on-target、eye origin 或 ω(t)。
 * 那四個量在 repo 內各有唯一實作；需要它們的消費端一律呼叫既有 canonical derivation。
 * `targetWindows.test.ts` 的符號掃描（NFR-63.4）是這條紀律的機械化判準。
 */

export type VisibleEvent = Extract<DrillEvent, { type: 'visible' }>;
export type FireEvent = Extract<DrillEvent, { type: 'fire' }>;

export const TARGET_WINDOW_FLAG_VOCABULARY = [
  'never_killed',
  'no_position',
  'empty_tick_range',
  'ammo_exhausted_in_window',
  'multiple_kill_candidates',
] as const;
export type TargetWindowFlag = (typeof TARGET_WINDOW_FLAG_VOCABULARY)[number];

/** 世界座標（source unit）。v8 無 `motion` ⇒ 存活期恆定（README §0.2）。 */
export interface TargetWorldPos {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 一顆目標的完整存活窗。窗數恆等於 `visible` 事件數（FR-63.1）。 */
export interface TargetWindow {
  readonly index: number;
  readonly targetId: string;
  readonly side: 'L' | 'R';
  /** `visible` 事件時刻（量測時鐘域 ms）。 */
  readonly tVisibleMs: number;
  /** 擊殺時刻 = `fire.hit === true` 且 raycast 歸屬為本目標的那一發；未被擊殺時缺席。 */
  readonly tKillMs?: number;
  /**
   * 世界座標。**缺席**（＋`no_position` 旗標）＝ `visible` 事件沒帶座標（pre-WP-56 匯出）。
   * 不猜位置、不回退到 `ticks[].tx`——後者正是 README §0.1 #1 的錯誤來源（它只描述三顆中的一顆，
   * 且由陣列順序這個實作產物決定）。
   */
  readonly pos?: TargetWorldPos;
  /** 該窗涵蓋的 ticks 索引半開區間 `[start, end)`。 */
  readonly tickRange: { readonly start: number; readonly end: number };
  readonly flags: readonly TargetWindowFlag[];
}

/** 某一時刻的存活集合快照（FR-63.2）。用於「候選集」語意。 */
export interface AliveSnapshot {
  readonly tMs: number;
  readonly targets: readonly Pick<TargetWindow, 'targetId' | 'pos'>[];
}

export interface TargetWindowResult {
  readonly windows: readonly TargetWindow[];
  readonly version: 'target-windows-v1';
  /** 全 trace 出現過的旗標聯集（詞彙表順序、去重）——讓稽核端一眼看出這份匯出有沒有異常窗。 */
  readonly traceFlags: readonly TargetWindowFlag[];
}

/**
 * 重建每一顆目標的存活窗。
 *
 * @param payload 匯出 payload（只讀 `events` 與 `ticks`）
 * @returns 窗陣列 + trace 旗標。窗數 === `visible` 事件數，不丟窗不合併窗。
 * @throws 不拋錯。所有異常狀況一律以封閉詞彙表旗標表達（缺失是資料，不是例外）。
 */
export function buildTargetWindows(
  payload: Pick<ExportPayload, 'ticks' | 'events'>,
): TargetWindowResult {
  const events = payload.events.slice().sort((a, b) => a.t - b.t);
  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const tickTimes = ticks.map((tick) => tick.t);
  const visibleEvents = events.filter((event): event is VisibleEvent => event.type === 'visible');
  const fireEvents = events.filter((event): event is FireEvent => event.type === 'fire');
  const fireTimes = fireEvents.map((event) => event.t);
  const occupancyEnd = occupancyEndByIndex(visibleEvents);

  const windows = visibleEvents.map((visible, index) => {
    // 同一個 id 若在本場被重複使用（`TargetManager` 現況是 `t${nextId++}` 全場唯一，但窗界原語不該
    // 把那個實作細節當前提），歸屬一律收斂在這一次 presentation 的佔用區間內。
    const idEnd = occupancyEnd[index];
    const kill = fireEvents.find(
      (event) =>
        event.hit === true &&
        event.targetId === visible.targetId &&
        event.t + WINDOW_EPSILON_MS >= visible.t &&
        event.t < idEnd,
    );
    const tKillMs = kill?.t;
    const windowEnd = tKillMs ?? Infinity;
    const tickRange = tickRangeForWindow(tickTimes, visible.t, windowEnd);
    const pos = worldPos(visible);

    const flags: TargetWindowFlag[] = [];
    if (tKillMs === undefined) flags.push('never_killed');
    if (pos === undefined) flags.push('no_position');
    if (tickRange.start === tickRange.end) flags.push('empty_tick_range');
    if (magazineRanDry(fireEvents, fireTimes, visible.t, windowEnd)) {
      flags.push('ammo_exhausted_in_window');
    }
    // `multiple_kill_candidates` 的**槽位**在此建立，判定留給 WP-63 / T5——它需要逐顆角誤差，
    // 而角誤差是 canonical derivation 的事，不是窗界原語的事（C-D4）。

    return {
      index,
      targetId: visible.targetId,
      side: visible.side,
      tVisibleMs: visible.t,
      ...(tKillMs !== undefined ? { tKillMs } : {}),
      ...(pos !== undefined ? { pos } : {}),
      tickRange,
      flags: orderedFlags(flags),
    } satisfies TargetWindow;
  });

  return {
    windows,
    version: 'target-windows-v1',
    traceFlags: orderedFlags(windows.flatMap((window) => window.flags)),
  };
}

/**
 * 查某時刻誰活著。`t` 落在多個窗內 ⇒ 全部回傳（v8 正常情況恆為 2 或 3 顆）。
 * 回傳順序 = 窗順序（`visible` 時間序），不依 id 排序——排序不是語意的一部分。
 */
export function aliveAt(windows: readonly TargetWindow[], tMs: number): AliveSnapshot {
  const targets = windows
    .filter((window) => window.tVisibleMs <= tMs && (window.tKillMs === undefined || tMs < window.tKillMs))
    .map((window) => ({
      targetId: window.targetId,
      ...(window.pos !== undefined ? { pos: window.pos } : {}),
    }));
  return { tMs, targets };
}

/** 每個 `visible` 的「同 id 下一次 presentation」時刻；沒有下一次則 `Infinity`。 */
function occupancyEndByIndex(visibleEvents: readonly VisibleEvent[]): number[] {
  const ends = new Array<number>(visibleEvents.length).fill(Infinity);
  const nextByTargetId = new Map<string, number>();
  for (let i = visibleEvents.length - 1; i >= 0; i--) {
    const visible = visibleEvents[i];
    ends[i] = nextByTargetId.get(visible.targetId) ?? Infinity;
    nextByTargetId.set(visible.targetId, visible.t);
  }
  return ends;
}

function worldPos(visible: VisibleEvent): TargetWorldPos | undefined {
  const { targetX, targetY, targetZ } = visible;
  if (targetX === undefined || targetY === undefined || targetZ === undefined) return undefined;
  return { x: targetX, y: targetY, z: targetZ };
}

/**
 * 窗內是否有一發把彈匣打到見底（FR-63.13）。
 *
 * ⚠️ 規劃期的字面判準 `fire.ammo === 0` 在真實匯出上**永遠不成立**：`SimLoop.ts:510` 記的是本發
 * **扣彈前**的存量，而 `SimLoop.ts:538` 的 while gate 是 `ammo > 0` ⇒ 記到的最小值是 1（＝這發打完
 * 就空倉）。故判準取 `<= 1`；保留 `0` 的涵蓋是為了手工 fixture 與未來 schema 變動的防禦。
 */
function magazineRanDry(
  fireEvents: readonly FireEvent[],
  fireTimes: readonly number[],
  windowStart: number,
  windowEnd: number,
): boolean {
  const start = firstIndexAtOrAfter(fireTimes, windowStart);
  for (let i = start; i < fireEvents.length; i++) {
    const event = fireEvents[i];
    if (event.t >= windowEnd) break;
    if (event.ammo !== undefined && event.ammo <= 1) return true;
  }
  return false;
}

function tickRangeForWindow(
  tickTimes: readonly number[],
  windowStart: number,
  windowEnd: number,
): { readonly start: number; readonly end: number } {
  const start = firstIndexAtOrAfter(tickTimes, windowStart);
  const end = Number.isFinite(windowEnd)
    ? Math.max(start, firstIndexAtOrAfter(tickTimes, windowEnd))
    : tickTimes.length;
  return { start, end };
}

/** 第一個滿足 `times[i] + WINDOW_EPSILON_MS >= t` 的索引（容差語意比照 `peekWindows.ts`）。 */
function firstIndexAtOrAfter(times: readonly number[], t: number): number {
  let low = 0;
  let high = times.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (times[mid] + WINDOW_EPSILON_MS >= t) high = mid;
    else low = mid + 1;
  }
  return low;
}

function orderedFlags(flags: readonly TargetWindowFlag[]): TargetWindowFlag[] {
  const present = new Set(flags);
  return TARGET_WINDOW_FLAG_VOCABULARY.filter((flag) => present.has(flag));
}
