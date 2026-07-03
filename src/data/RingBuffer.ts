export const DEFAULT_MAX_DRILL_SECONDS = 300;
export const DEFAULT_RECORDER_EXTRA_TICKS = 128;

const KEY_A = 1 << 0;
const KEY_D = 1 << 1;
const KEY_W = 1 << 2;
const KEY_S = 1 << 3;

export type KeyName = 'A' | 'D' | 'W' | 'S';

export interface TickRecord {
  t: number;
  vx: number;
  vz: number;
  aim: { yaw: number; pitch: number };
  keys: KeyName[];
}

export interface TickRecordInput {
  t: number;
  vx: number;
  vz: number;
  aim: { readonly yaw: number; readonly pitch: number };
  keys: readonly string[];
}

export interface TickSourceState {
  player: { vx: number; vz: number };
  aim: { yaw: number; pitch: number };
  held: { left: boolean; right: boolean };
}

export interface TickArenaSnapshot {
  ticks: TickRecord[];
  recorderOverflow: boolean;
}

export function capacityForDrill(
  simHz: number,
  maxDrillSeconds = DEFAULT_MAX_DRILL_SECONDS,
  extraTicks = DEFAULT_RECORDER_EXTRA_TICKS,
): number {
  if (!Number.isFinite(simHz) || simHz <= 0) throw new Error('simHz must be a positive finite number');
  if (!Number.isFinite(maxDrillSeconds) || maxDrillSeconds <= 0) {
    throw new Error('maxDrillSeconds must be a positive finite number');
  }
  if (!Number.isFinite(extraTicks) || extraTicks < 0) throw new Error('extraTicks must be a non-negative finite number');
  return Math.ceil(maxDrillSeconds * simHz) + Math.ceil(extraTicks);
}

export function keyMaskFromKeys(keys: readonly string[]): number {
  let mask = 0;
  for (const key of keys) {
    if (key === 'A' || key === 'KeyA') mask |= KEY_A;
    else if (key === 'D' || key === 'KeyD') mask |= KEY_D;
    else if (key === 'W' || key === 'KeyW') mask |= KEY_W;
    else if (key === 'S' || key === 'KeyS') mask |= KEY_S;
  }
  return mask;
}

export function keyMaskFromState(state: TickSourceState): number {
  let mask = 0;
  if (state.held.left) mask |= KEY_A;
  if (state.held.right) mask |= KEY_D;
  return mask;
}

function keysFromMask(mask: number): KeyName[] {
  const keys: KeyName[] = [];
  if ((mask & KEY_A) !== 0) keys.push('A');
  if ((mask & KEY_D) !== 0) keys.push('D');
  if ((mask & KEY_W) !== 0) keys.push('W');
  if ((mask & KEY_S) !== 0) keys.push('S');
  return keys;
}

/**
 * Preallocated tick arena. Despite the historical file name, this is intentionally not circular:
 * overflow marks the drill suspect and later writes are refused so older rows remain exportable.
 */
export class TickArena {
  private readonly t: Float64Array;
  private readonly vx: Float64Array;
  private readonly vz: Float64Array;
  private readonly yaw: Float64Array;
  private readonly pitch: Float64Array;
  private readonly keyMask: Uint8Array;
  private countValue = 0;
  private overflowValue = false;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('capacity must be a positive integer');
    this.t = new Float64Array(capacity);
    this.vx = new Float64Array(capacity);
    this.vz = new Float64Array(capacity);
    this.yaw = new Float64Array(capacity);
    this.pitch = new Float64Array(capacity);
    this.keyMask = new Uint8Array(capacity);
  }

  get count(): number {
    return this.countValue;
  }

  get recorderOverflow(): boolean {
    return this.overflowValue;
  }

  recordTick(record: TickRecordInput): boolean {
    return this.recordFields(
      record.t,
      record.vx,
      record.vz,
      record.aim.yaw,
      record.aim.pitch,
      keyMaskFromKeys(record.keys),
    );
  }

  recordState(t: number, state: TickSourceState): boolean {
    return this.recordFields(t, state.player.vx, state.player.vz, state.aim.yaw, state.aim.pitch, keyMaskFromState(state));
  }

  recordFields(t: number, vx: number, vz: number, yaw: number, pitch: number, keyMask: number): boolean {
    if (this.countValue >= this.capacity) {
      this.overflowValue = true;
      return false;
    }

    const i = this.countValue;
    this.t[i] = t;
    this.vx[i] = vx;
    this.vz[i] = vz;
    this.yaw[i] = yaw;
    this.pitch[i] = pitch;
    this.keyMask[i] = keyMask;
    this.countValue++;
    return true;
  }

  snapshot(): TickArenaSnapshot {
    const ticks: TickRecord[] = new Array(this.countValue);
    for (let i = 0; i < this.countValue; i++) {
      ticks[i] = {
        t: this.t[i],
        vx: this.vx[i],
        vz: this.vz[i],
        aim: { yaw: this.yaw[i], pitch: this.pitch[i] },
        keys: keysFromMask(this.keyMask[i]),
      };
    }
    return { ticks, recorderOverflow: this.overflowValue };
  }

  reset(): void {
    this.countValue = 0;
    this.overflowValue = false;
  }
}
