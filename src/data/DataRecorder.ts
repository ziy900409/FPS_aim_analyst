import {
  capacityForDrill,
  TickArena,
  type TickRecord,
  type TickRecordInput,
  type TickSourceState,
} from './RingBuffer.ts';

export type DrillEvent =
  | {
      type: 'visible';
      targetId: string;
      side: 'L' | 'R';
      t: number;
      targetX?: number;
      targetY?: number;
      targetZ?: number;
    }
  | { type: 'counter'; key: string; t: number }
  | { type: 'ads'; down: boolean; t: number }
  // WP-29 / T3（使用者 override，additive observability）：鍵 down/up 以 input `timeStamp`（sub-tick）記錄，
  // 供離線推導「鬆原方向鍵」的直接釋放時刻（補 tick-derived release 的 ±1 tick 量化）。`code` 為 canonical
  // 鍵名（`A`/`D`/`W`/`S`，對齊 `ticks[].keys`，不引入第二套鍵名慣例）。**opt-in**：僅 `recordKeyEvents` 啟用時
  // 由 `SimLoop.applyInput` 寫入（預設關閉 → 既有匯出/測試/golden 逐位不變，additive 相容）。
  | { type: 'key'; code: string; down: boolean; t: number }
  | {
      type: 'fire';
      t: number;
      hit: boolean;
      firstShot: boolean;
      residualSpeed: number;
      shotSeq?: number;
      viewYaw?: number;
      viewPitch?: number;
      aimPunchPitch?: number;
      aimPunchYaw?: number;
      spreadX?: number;
      spreadY?: number;
      recoilIndex?: number;
      ammo?: number;
      targetId?: string;
      offsetDeg?: number;
      part?: 'head' | 'body';
    }
  | {
      type: 'hit';
      t: number;
      timeOfFlightMs: number;
      shotSeq: number;
      targetId?: string;
      part?: 'head' | 'body';
    };

export interface DataRecorderSnapshot {
  ticks: TickRecord[];
  events: DrillEvent[];
  recorderOverflow: boolean;
}

export interface DataRecorder {
  readonly capacity: number;
  readonly tickCount: number;
  readonly fireCount: number;
  readonly hitCount: number;
  readonly recorderOverflow: boolean;
  /**
   * WP-29 / T3：是否讓 `SimLoop.applyInput` 記錄 additive `key` 事件（預設 `false`）。旗標讀自本 recorder，
   * 故 `applyInput`/`simStep` 簽章不變；停用時 `applyInput` 完全不配置 key 事件物件（GC 紀律 §4）。
   */
  readonly recordKeyEvents: boolean;
  recordTick(record: TickRecordInput): void;
  recordTickFromState(t: number, state: TickSourceState): void;
  recordEvent(event: DrillEvent): void;
  snapshot(): DataRecorderSnapshot;
  reset(): void;
}

export interface DataRecorderOptions {
  simHz?: number;
  maxDrillSeconds?: number;
  extraTicks?: number;
  capacity?: number;
  /** WP-29 / T3：啟用 additive `key` 事件記錄（預設 `false`；見 `DataRecorder.recordKeyEvents`）。 */
  recordKeyEvents?: boolean;
}

export function createDataRecorder(options: DataRecorderOptions = {}): DataRecorder {
  const capacity = options.capacity ?? capacityForDrill(options.simHz ?? 128, options.maxDrillSeconds, options.extraTicks);
  const recordKeyEvents = options.recordKeyEvents ?? false;
  const ticks = new TickArena(capacity);
  const events: DrillEvent[] = [];
  let fireCount = 0;
  let hitCount = 0;

  return {
    capacity,
    recordKeyEvents,
    get tickCount(): number {
      return ticks.count;
    },
    get fireCount(): number {
      return fireCount;
    },
    get hitCount(): number {
      return hitCount;
    },
    get recorderOverflow(): boolean {
      return ticks.recorderOverflow;
    },
    recordTick(record: TickRecordInput): void {
      ticks.recordTick(record);
    },
    recordTickFromState(t: number, state: TickSourceState): void {
      ticks.recordState(t, state);
    },
    recordEvent(event: DrillEvent): void {
      events.push(event);
      if (event.type === 'fire') {
        fireCount++;
        if (event.hit) hitCount++;
      } else if (event.type === 'hit') {
        hitCount++;
      }
    },
    snapshot(): DataRecorderSnapshot {
      const tickSnapshot = ticks.snapshot();
      return {
        ticks: tickSnapshot.ticks,
        events: events.slice(),
        recorderOverflow: tickSnapshot.recorderOverflow,
      };
    },
    reset(): void {
      ticks.reset();
      events.length = 0;
      fireCount = 0;
      hitCount = 0;
    },
  };
}

export type { TickRecord, TickRecordInput } from './RingBuffer.ts';
