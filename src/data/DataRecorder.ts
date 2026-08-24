import {
  capacityForDrill,
  TickArena,
  type TickRecord,
  type TickRecordInput,
  type TickSourceState,
} from './RingBuffer.ts';
import { createAimIntegrator, type MouseGain } from '../input/mouseGain.ts';

export type DrillEvent =
  | {
      type: 'visible';
      targetId: string;
      side: 'L' | 'R';
      /** Spider Shot schedule marker; omitted for legacy drills. */
      zone?: 'center' | 'peripheral';
      t: number;
      targetX?: number;
      targetY?: number;
      targetZ?: number;
    }
  /** Counter-strafe protocol direction prompt; `t` is the start of its foreperiod. */
  | { type: 'cue'; t: number; direction: 'A' | 'D' }
  | { type: 'counter'; key: string; t: number }
  | { type: 'ads'; down: boolean; t: number }
  /** hold-track target_stop: target motion froze and fire gating was released on this sim tick. */
  | { type: 'target_stop'; targetId: string; t: number; targetX: number; targetY: number; targetZ: number }
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

/** KI-005 / A（FR-A-1）：tick 窗積分 mouse delta 所需的感度 gain（來源 = `resolveMouseGain`）。 */
export interface MouseIntegrationConfig {
  gain: MouseGain;
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
  /** KI-005 / A（FR-A-1）：未啟用時為 `undefined`；`applyInput` 以此判定是否進入 mouse 分支。 */
  readonly mouseIntegration?: MouseIntegrationConfig;
  /**
   * KI-005 / A：drill 開始時由 main.ts 以當前 settings/weapon 重新佈線。SettingsPanel 於 Pointer
   * Lock 鎖定中整組隱藏（KI-003）⇒ drill 內 sensitivity/FOV 不可能變動，單一快照即足夠。
   */
  configureMouseIntegration(config: MouseIntegrationConfig | undefined): void;
  /**
   * KI-005 / A：`applyInput` 專用，依事件自身順序累加進當前 tick 的累加器。`ads` 取**事件時刻**的
   * `state.heldAds`（ads 事件與 mouse 事件在同一 consume 迴圈內依 timeStamp 排序）。
   */
  accumulateMouse(dx: number, dy: number, ads: boolean): void;
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
  /** KI-005 / A（FR-A-1）：啟用 tick 窗 mouse 積分；省略 = 關閉 ⇒ 匯出逐位不變（NFR-A-2）。 */
  mouseIntegration?: MouseIntegrationConfig;
}

export function createDataRecorder(options: DataRecorderOptions = {}): DataRecorder {
  const capacity = options.capacity ?? capacityForDrill(options.simHz ?? 128, options.maxDrillSeconds, options.extraTicks);
  const recordKeyEvents = options.recordKeyEvents ?? false;
  const ticks = new TickArena(capacity);
  const events: DrillEvent[] = [];
  let fireCount = 0;
  let hitCount = 0;
  let mouseIntegration = options.mouseIntegration;
  // KI-005 / A：積分器狀態放本閉包（data 層），不進 SharedState（README §2.7）；累加器在寫入
  // arena 後歸零，含 overflow 路徑（見 consumeMouseAccum）。
  const aimIntegrator = createAimIntegrator();
  let dYawAccum = 0;
  let dPitchAccum = 0;

  function consumeMouseAccum(): { dYaw: number; dPitch: number } | undefined {
    if (mouseIntegration === undefined) return undefined;
    const out = { dYaw: dYawAccum, dPitch: dPitchAccum };
    dYawAccum = 0;
    dPitchAccum = 0;
    return out;
  }

  return {
    capacity,
    recordKeyEvents,
    get mouseIntegration(): MouseIntegrationConfig | undefined {
      return mouseIntegration;
    },
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
    configureMouseIntegration(config: MouseIntegrationConfig | undefined): void {
      mouseIntegration = config;
    },
    accumulateMouse(dx: number, dy: number, ads: boolean): void {
      if (mouseIntegration === undefined) return;
      const step = ads ? mouseIntegration.gain.adsStep : mouseIntegration.gain.hipStep;
      const delta = aimIntegrator.applyDelta(dx, dy, step);
      dYawAccum += delta.dYaw;
      dPitchAccum += delta.dPitch;
    },
    recordTick(record: TickRecordInput): void {
      const m = consumeMouseAccum();
      ticks.recordTick(record, m?.dYaw, m?.dPitch);
    },
    recordTickFromState(t: number, state: TickSourceState): void {
      const m = consumeMouseAccum();
      ticks.recordState(t, state, m?.dYaw, m?.dPitch);
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
      aimIntegrator.reset();
      dYawAccum = 0;
      dPitchAccum = 0;
    },
  };
}

export type { TickRecord, TickRecordInput } from './RingBuffer.ts';
