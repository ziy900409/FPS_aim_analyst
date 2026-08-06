export const DEFAULT_MAX_DRILL_SECONDS = 300;
export const DEFAULT_RECORDER_EXTRA_TICKS = 128;
export const DEFAULT_MAX_FIRE_HZ = 10;

const KEY_A = 1 << 0;
const KEY_D = 1 << 1;
const KEY_W = 1 << 2;
const KEY_S = 1 << 3;

export type KeyName = 'A' | 'D' | 'W' | 'S';

export interface TickRecord {
  t: number;
  vx: number;
  vz: number;
  px: number;
  pz: number;
  tx: number | null;
  ty: number | null;
  tz: number | null;
  aim: { yaw: number; pitch: number };
  keys: KeyName[];
  ads: boolean;
  /** 本 tick 窗內積分的 yaw 角位移（rad）。缺席 = 未啟用 mouse 積分的匯出（KI-005 / A，FR-A-4）。 */
  dYaw?: number;
  /** 本 tick 窗內積分的 pitch 角位移（rad，已含 ±MAX_PITCH 夾角效果）。 */
  dPitch?: number;
}

export interface TickRecordInput {
  t: number;
  vx: number;
  vz: number;
  px?: number;
  pz?: number;
  tx?: number | null;
  ty?: number | null;
  tz?: number | null;
  aim: { readonly yaw: number; readonly pitch: number };
  keys: readonly string[];
  ads?: boolean;
}

export interface TickSourceState {
  player: { vx: number; vz: number; x: number; z: number };
  aim: { yaw: number; pitch: number };
  heldAds: boolean;
  held: { left: boolean; right: boolean };
  targets: Array<{ pos: { x: number; y: number; z: number }; visible: boolean; alive: boolean }>;
}

export interface TickArenaSnapshot {
  ticks: TickRecord[];
  recorderOverflow: boolean;
}

export function capacityForDrill(
  simHz: number,
  maxDrillSeconds = DEFAULT_MAX_DRILL_SECONDS,
  extraTicks = DEFAULT_RECORDER_EXTRA_TICKS,
  maxFireHz = DEFAULT_MAX_FIRE_HZ,
): number {
  if (!Number.isFinite(simHz) || simHz <= 0) throw new Error('simHz must be a positive finite number');
  if (!Number.isFinite(maxDrillSeconds) || maxDrillSeconds <= 0) {
    throw new Error('maxDrillSeconds must be a positive finite number');
  }
  if (!Number.isFinite(extraTicks) || extraTicks < 0) throw new Error('extraTicks must be a non-negative finite number');
  if (!Number.isFinite(maxFireHz) || maxFireHz < 0) throw new Error('maxFireHz must be a non-negative finite number');
  return Math.ceil(maxDrillSeconds * (simHz + maxFireHz)) + Math.ceil(extraTicks);
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
  private readonly px: Float64Array;
  private readonly pz: Float64Array;
  private readonly tx: Float64Array;
  private readonly ty: Float64Array;
  private readonly tz: Float64Array;
  private readonly hasTarget: Uint8Array;
  private readonly yaw: Float64Array;
  private readonly pitch: Float64Array;
  private readonly keyMask: Uint8Array;
  private readonly ads: Uint8Array;
  // KI-005 / A（FR-A-4）：tick 窗積分 mouse delta，preallocated（固定佈局紀律，C-7）。
  // `hasMouseIntegration` 逐 row 記錄該 tick 是否帶積分（決定 snapshot() 是否輸出 dYaw/dPitch key）。
  private readonly dYaw: Float64Array;
  private readonly dPitch: Float64Array;
  private readonly hasMouseIntegration: Uint8Array;
  private countValue = 0;
  private overflowValue = false;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('capacity must be a positive integer');
    this.t = new Float64Array(capacity);
    this.vx = new Float64Array(capacity);
    this.vz = new Float64Array(capacity);
    this.px = new Float64Array(capacity);
    this.pz = new Float64Array(capacity);
    this.tx = new Float64Array(capacity);
    this.ty = new Float64Array(capacity);
    this.tz = new Float64Array(capacity);
    this.hasTarget = new Uint8Array(capacity);
    this.yaw = new Float64Array(capacity);
    this.pitch = new Float64Array(capacity);
    this.keyMask = new Uint8Array(capacity);
    this.ads = new Uint8Array(capacity);
    this.dYaw = new Float64Array(capacity);
    this.dPitch = new Float64Array(capacity);
    this.hasMouseIntegration = new Uint8Array(capacity);
  }

  get count(): number {
    return this.countValue;
  }

  get recorderOverflow(): boolean {
    return this.overflowValue;
  }

  recordTick(record: TickRecordInput, dYaw?: number, dPitch?: number): boolean {
    return this.recordFields(
      record.t,
      record.vx,
      record.vz,
      record.px ?? 0,
      record.pz ?? 0,
      record.tx ?? null,
      record.ty ?? null,
      record.tz ?? null,
      record.aim.yaw,
      record.aim.pitch,
      keyMaskFromKeys(record.keys),
      record.ads === true,
      dYaw,
      dPitch,
    );
  }

  recordState(t: number, state: TickSourceState, dYaw?: number, dPitch?: number): boolean {
    let tx: number | null = null;
    let ty: number | null = null;
    let tz: number | null = null;
    for (let i = 0; i < state.targets.length; i++) {
      const target = state.targets[i];
      if (target.visible && target.alive) {
        tx = target.pos.x;
        ty = target.pos.y;
        tz = target.pos.z;
        break;
      }
    }
    return this.recordFields(
      t,
      state.player.vx,
      state.player.vz,
      state.player.x,
      state.player.z,
      tx,
      ty,
      tz,
      state.aim.yaw,
      state.aim.pitch,
      keyMaskFromState(state),
      state.heldAds,
      dYaw,
      dPitch,
    );
  }

  recordFields(
    t: number,
    vx: number,
    vz: number,
    px: number,
    pz: number,
    tx: number | null,
    ty: number | null,
    tz: number | null,
    yaw: number,
    pitch: number,
    keyMask: number,
    ads: boolean,
    dYaw?: number,
    dPitch?: number,
  ): boolean {
    if (this.countValue >= this.capacity) {
      this.overflowValue = true;
      return false;
    }

    const i = this.countValue;
    this.t[i] = t;
    this.vx[i] = vx;
    this.vz[i] = vz;
    this.px[i] = px;
    this.pz[i] = pz;
    if (tx !== null && ty !== null && tz !== null) {
      this.tx[i] = tx;
      this.ty[i] = ty;
      this.tz[i] = tz;
      this.hasTarget[i] = 1;
    } else {
      this.hasTarget[i] = 0;
    }
    this.yaw[i] = yaw;
    this.pitch[i] = pitch;
    this.keyMask[i] = keyMask;
    this.ads[i] = ads ? 1 : 0;
    if (dYaw !== undefined && dPitch !== undefined) {
      this.dYaw[i] = dYaw;
      this.dPitch[i] = dPitch;
      this.hasMouseIntegration[i] = 1;
    } else {
      this.hasMouseIntegration[i] = 0;
    }
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
        px: this.px[i],
        pz: this.pz[i],
        tx: this.hasTarget[i] ? this.tx[i] : null,
        ty: this.hasTarget[i] ? this.ty[i] : null,
        tz: this.hasTarget[i] ? this.tz[i] : null,
        aim: { yaw: this.yaw[i], pitch: this.pitch[i] },
        keys: keysFromMask(this.keyMask[i]),
        ads: this.ads[i] === 1,
        ...(this.hasMouseIntegration[i] === 1 ? { dYaw: this.dYaw[i], dPitch: this.dPitch[i] } : {}),
      };
    }
    return { ticks, recorderOverflow: this.overflowValue };
  }

  reset(): void {
    this.countValue = 0;
    this.overflowValue = false;
  }
}
