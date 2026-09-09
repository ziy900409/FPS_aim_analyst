export const DEFAULT_MOUSE_SAMPLE_HZ = 1000;
export const DEFAULT_MOUSE_SAMPLE_CAPACITY_HEADROOM = 1.2;

export interface MouseSampleBlock {
  readonly t0Ms: number;
  readonly dtUs: readonly number[];
  readonly dx: readonly number[];
  readonly dy: readonly number[];
}

export interface MouseSampleArenaSnapshot {
  readonly samples: MouseSampleBlock;
  readonly recorded: number;
  readonly capacity: number;
  readonly overflow: boolean;
  readonly observedRateHz: number;
}

export function mouseSampleCapacityForDrill(maxDrillSeconds: number): number {
  if (!Number.isFinite(maxDrillSeconds) || maxDrillSeconds <= 0) {
    throw new Error('maxDrillSeconds must be a positive finite number');
  }
  return Math.ceil(maxDrillSeconds * DEFAULT_MOUSE_SAMPLE_HZ * DEFAULT_MOUSE_SAMPLE_CAPACITY_HEADROOM);
}

/**
 * Preallocated raw mouse sample arena. Drill-time writes never grow arrays and overflow keeps the
 * oldest contiguous prefix so `t0Ms + sum(dtUs)` remains a truthful reconstruction.
 */
export class MouseSampleArena {
  private readonly dxValues: Float64Array;
  private readonly dyValues: Float64Array;
  private readonly tMsValues: Float64Array;
  private countValue = 0;
  private overflowValue = false;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('capacity must be a positive integer');
    this.dxValues = new Float64Array(capacity);
    this.dyValues = new Float64Array(capacity);
    this.tMsValues = new Float64Array(capacity);
  }

  get count(): number {
    return this.countValue;
  }

  get overflow(): boolean {
    return this.overflowValue;
  }

  record(dx: number, dy: number, tMs: number): boolean {
    if (this.countValue >= this.capacity) {
      this.overflowValue = true;
      return false;
    }

    const i = this.countValue;
    this.dxValues[i] = dx;
    this.dyValues[i] = dy;
    this.tMsValues[i] = tMs;
    this.countValue++;
    return true;
  }

  snapshot(): MouseSampleArenaSnapshot {
    const recorded = this.countValue;
    const dx = new Array<number>(recorded);
    const dy = new Array<number>(recorded);
    const dtUs = new Array<number>(recorded);
    const t0Ms = recorded > 0 ? this.tMsValues[0] : 0;

    for (let i = 0; i < recorded; i++) {
      dx[i] = this.dxValues[i];
      dy[i] = this.dyValues[i];
      dtUs[i] = i === 0 ? 0 : Math.round((this.tMsValues[i] - this.tMsValues[i - 1]) * 1000);
    }

    const spanMs = recorded > 1 ? this.tMsValues[recorded - 1] - this.tMsValues[0] : 0;
    const observedRateHz = spanMs > 0 && Number.isFinite(spanMs) ? ((recorded - 1) * 1000) / spanMs : 0;

    return {
      samples: { t0Ms, dtUs, dx, dy },
      recorded,
      capacity: this.capacity,
      overflow: this.overflowValue,
      observedRateHz,
    };
  }

  reset(): void {
    this.countValue = 0;
    this.overflowValue = false;
  }
}
