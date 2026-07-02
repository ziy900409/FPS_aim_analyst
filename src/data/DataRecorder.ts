import {
  capacityForDrill,
  TickArena,
  type TickRecord,
  type TickRecordInput,
  type TickSourceState,
} from './RingBuffer.ts';

export type DrillEvent =
  | { type: 'visible'; targetId: string; t: number }
  | { type: 'counter'; key: string; t: number }
  | { type: 'fire'; t: number; hit: boolean; firstShot: boolean; residualSpeed: number; part?: 'head' | 'body' };

export interface DataRecorderSnapshot {
  ticks: TickRecord[];
  events: DrillEvent[];
  recorderOverflow: boolean;
}

export interface DataRecorder {
  readonly capacity: number;
  readonly tickCount: number;
  readonly recorderOverflow: boolean;
  recordTick(record: TickRecordInput): void;
  recordTickFromState(t: number, state: TickSourceState): void;
  snapshot(): DataRecorderSnapshot;
  reset(): void;
}

export interface DataRecorderOptions {
  simHz?: number;
  maxDrillSeconds?: number;
  extraTicks?: number;
  capacity?: number;
}

export function createDataRecorder(options: DataRecorderOptions = {}): DataRecorder {
  const capacity = options.capacity ?? capacityForDrill(options.simHz ?? 128, options.maxDrillSeconds, options.extraTicks);
  const ticks = new TickArena(capacity);
  const events: DrillEvent[] = [];

  return {
    capacity,
    get tickCount(): number {
      return ticks.count;
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
    },
  };
}

export type { TickRecord, TickRecordInput } from './RingBuffer.ts';
