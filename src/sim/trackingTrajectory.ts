import { createRan1, randomFloat, type Rng } from '../recoil/rng.ts';
import type { Vec3 } from '../state/types.ts';

/**
 * trackingTrajectory — WP-54 / T1（README §2.2/§2.4 interface contract）
 *
 * Tracking pilot 專用的 2D angular trajectory 純函式核心：`createTrackingTrajectory(config)` 在
 * 建構時一次性算出封閉式（closed-form）係數／schedule，`sample(ageSec, out)` 之後只依
 * `(config, seed, age)` 求值——不讀時鐘（`Date.now`/`performance.now`）、不用 `Math.random()`、
 * 與 render FPS 無關（CLAUDE.md §4 決定性契約 / GD-5）。
 *
 * 與既有 `TargetMotion`（[targetMotion.ts](./targetMotion.ts)）刻意分離（README §2.2 規劃落點）：
 * tracking pilot 需要 band-limited pseudorandom pursuit 與 finite-acceleration random reversal
 * 兩種構念型 trajectory，語意與既有 static/linear/pingpong/sine 四種完全不同，不應共用同一個
 * union 或函式，避免既有 `TargetMotion` 的 cross-module consumer（`scene/clearance.ts`／
 * `drill/DrillConfig.ts`／`drill/schema.ts` 等）被迫認識與自己無關的 tracking-only 語意。
 */

export type TrackingTrajectoryConfig =
  | {
      readonly kind: 'band-limited-2d-v1';
      readonly seed: number;
      readonly durationMs: number;
      readonly yawBoundDeg: number;
      readonly pitchBoundDeg: number;
      readonly targetRmsSpeedDegPerSec: number;
      readonly frequencyBandHz: readonly [number, number];
    }
  | {
      readonly kind: 'reversal-2d-v1';
      readonly seed: number;
      readonly durationMs: number;
      readonly angularBoundsDeg: readonly [number, number];
      readonly speedRangeDegPerSec: readonly [number, number];
      readonly reversalIntervalMs: readonly [number, number];
      readonly accelerationRampMs: number;
    };

export interface TrackingTrajectorySample {
  yawDeg: number;
  pitchDeg: number;
  yawVelocityDegPerSec: number;
  pitchVelocityDegPerSec: number;
}

/**
 * 一筆可由 export 還原的 2D 方向變化事件（README §2.2 `target_motion_change`）。`band-limited-2d-v1`
 * 是連續 pursuit，無離散事件，`changes` 恆為空陣列；`reversal-2d-v1` 每個 leg 邊界（joint 2D
 * reversal——yaw／pitch 共用同一個 timeline，見下方 `createReversal2dV1`）產生一筆。
 */
export interface PrecomputedTrackingChange {
  readonly tMs: number;
  readonly yawVelocityBeforeDegPerSec: number;
  readonly yawVelocityAfterDegPerSec: number;
  readonly pitchVelocityBeforeDegPerSec: number;
  readonly pitchVelocityAfterDegPerSec: number;
}

export interface TrackingTrajectory {
  /** 就地寫入 `out`（呼叫端提供、重用；熱路徑零配置，CLAUDE.md §4 GC 紀律）。`ageSec` 為自
   * trajectory 起點累加的邏輯秒數，超出 `durationMs` 時夾在終點值（sim/drill 邊界由呼叫端另行
   * 判定是否已結束，這裡只保證不外插出未定義行為）。 */
  sample(ageSec: number, out: TrackingTrajectorySample): void;
  readonly changes: readonly PrecomputedTrackingChange[];
}

export function createTrackingTrajectory(config: TrackingTrajectoryConfig): TrackingTrajectory {
  if (config.kind === 'band-limited-2d-v1') return createBandLimited2dV1(config);
  if (config.kind === 'reversal-2d-v1') return createReversal2dV1(config);
  // Runtime guard for config decoded from JSON/未知 version（README §2.4「Unknown trajectory
  // kind/version ... 必須 fail fast」）；TS 已窮盡上面兩支，這支只服務執行期未知輸入。
  const unknownKind = (config as { readonly kind: unknown }).kind;
  throw new Error(`trackingTrajectory: unknown kind "${String(unknownKind)}"`);
}

// ---------------------------------------------------------------------------
// Shared validation
// ---------------------------------------------------------------------------

function requireFiniteSeed(seed: number): number {
  if (!Number.isFinite(seed)) throw new Error('trackingTrajectory: seed must be finite');
  return seed;
}

function requirePositiveFiniteDurationMs(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error('trackingTrajectory: durationMs must be a positive finite number');
  }
  return durationMs;
}

function requirePositiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`trackingTrajectory: ${name} must be a positive finite number`);
  }
  return value;
}

function requireAscendingFiniteRange(range: readonly [number, number], name: string): readonly [number, number] {
  const [lo, hi] = range;
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) {
    throw new Error(`trackingTrajectory: ${name} must be an ascending finite [min, max] pair`);
  }
  return range;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}

// ---------------------------------------------------------------------------
// band-limited-2d-v1 — sum-of-sinusoids band-limited pursuit (FR-54-2)
// ---------------------------------------------------------------------------

/** 每軸疊加的正弦分量數。固定常數（非 config 旋鈕）：足夠讓 RMS 速度的長時間平均逼近解析值，
 * 同時保持 `sample()` 的每次求值成本是小常數。 */
const BAND_LIMITED_COMPONENT_COUNT: number = 5;

interface SinusoidComponent {
  readonly omega: number; // rad/s
  readonly phase: number; // rad
}

/** 頻率在 `[lowHz, highHz]` 內對數等距取樣（比線性等距更不容易讓分量頻率互為整數倍、產生
 * 可預期的共振拍頻），相位由 seeded RNG 抽取。 */
function buildSinusoidComponents(rng: Rng, lowHz: number, highHz: number): readonly SinusoidComponent[] {
  const components: SinusoidComponent[] = [];
  for (let i = 0; i < BAND_LIMITED_COMPONENT_COUNT; i++) {
    const t = BAND_LIMITED_COMPONENT_COUNT === 1 ? 0 : i / (BAND_LIMITED_COMPONENT_COUNT - 1);
    const hz = lowHz * Math.pow(highHz / lowHz, t);
    components.push({ omega: 2 * Math.PI * hz, phase: randomFloat(rng, 0, 2 * Math.PI) });
  }
  return components;
}

/** raw（未縮放）Σcos(ω_i·t+φ_i) 的長時間 RMS：頻率夠分散時 cos² 時間平均趨近 1/2、交叉項趨近
 * 0，故 RMS² ≈ N/2（解析近似，非逐 tick 模擬）。 */
function rawVelocityRms(components: readonly SinusoidComponent[]): number {
  return Math.sqrt(components.length / 2);
}

/** raw 位移振幅的解析上界 Σ|1/ω_i|——不論相位如何對齊，|Σ sin(ω_i·t+φ_i)/ω_i| 恆 ≤ 此值，用來
 * 保證位置不越界（不需要 runtime clamp，純靠建構時的係數縮放）。 */
function rawPositionAmplitudeBound(components: readonly SinusoidComponent[]): number {
  let sum = 0;
  for (const c of components) sum += 1 / c.omega;
  return sum;
}

function sampleRawPosition(components: readonly SinusoidComponent[], ageSec: number): number {
  let sum = 0;
  for (const c of components) sum += Math.sin(c.omega * ageSec + c.phase) / c.omega;
  return sum;
}

function sampleRawVelocity(components: readonly SinusoidComponent[], ageSec: number): number {
  let sum = 0;
  for (const c of components) sum += Math.cos(c.omega * ageSec + c.phase);
  return sum;
}

/** 目標 RMS 速度換算的縮放係數，再與「位置解析上界不得超出 `boundDeg`」的安全縮放取 min——
 * 兩者衝突時邊界安全永遠優先於精確命中目標 RMS 速度（README 風險表「0.5 deg target 接近 pixel
 * floor」同一精神：安全邊界不可被統計目標覆寫）。 */
function boundedSpeedScale(
  components: readonly SinusoidComponent[],
  targetRmsSpeedDegPerSec: number,
  boundDeg: number,
): number {
  const speedScale = targetRmsSpeedDegPerSec / rawVelocityRms(components);
  const boundScale = boundDeg / rawPositionAmplitudeBound(components);
  return Math.min(speedScale, boundScale);
}

function createBandLimited2dV1(
  config: Extract<TrackingTrajectoryConfig, { kind: 'band-limited-2d-v1' }>,
): TrackingTrajectory {
  requireFiniteSeed(config.seed);
  requirePositiveFiniteDurationMs(config.durationMs);
  requirePositiveFinite(config.yawBoundDeg, 'yawBoundDeg');
  requirePositiveFinite(config.pitchBoundDeg, 'pitchBoundDeg');
  requirePositiveFinite(config.targetRmsSpeedDegPerSec, 'targetRmsSpeedDegPerSec');
  const [lowHz, highHz] = requireAscendingFiniteRange(config.frequencyBandHz, 'frequencyBandHz');
  requirePositiveFinite(lowHz, 'frequencyBandHz[0]');

  const rng = createRan1(config.seed);
  const yawComponents = buildSinusoidComponents(rng, lowHz, highHz);
  const pitchComponents = buildSinusoidComponents(rng, lowHz, highHz);

  const yawScale = boundedSpeedScale(yawComponents, config.targetRmsSpeedDegPerSec, config.yawBoundDeg);
  const pitchScale = boundedSpeedScale(pitchComponents, config.targetRmsSpeedDegPerSec, config.pitchBoundDeg);

  return {
    changes: [],
    sample(ageSec: number, out: TrackingTrajectorySample): void {
      const t = clamp(ageSec, 0, config.durationMs / 1000);
      out.yawDeg = yawScale * sampleRawPosition(yawComponents, t);
      out.pitchDeg = pitchScale * sampleRawPosition(pitchComponents, t);
      out.yawVelocityDegPerSec = yawScale * sampleRawVelocity(yawComponents, t);
      out.pitchVelocityDegPerSec = pitchScale * sampleRawVelocity(pitchComponents, t);
    },
  };
}

// ---------------------------------------------------------------------------
// reversal-2d-v1 — finite-acceleration random-reversal pursuit (FR-54-3)
//
// 每個 leg 是**靜止到靜止**的 ramp-up/cruise/ramp-down 速度剖面（v(0)=v(duration)=0）：這保證
// leg 邊界永遠是「速度歸零」的瞬間，下一個 leg 的加速方向不可能「先繼續衝向舊方向的牆再回頭」
// （曾嘗試「上一個 leg 巡航速度直接延續」的設計，在邊界附近會因為新 leg 前段加速度仍帶著舊方向
// 殘餘速度而撞牆超界——故改採此設計，位移公式因此可精確解析、bound 安全變成建構期保證而非
// runtime clamp）。加速度恆等於 `magnitude / accelerationRampMs`（未撞牆時）或更小（見
// `solveAxisProfile` 的 triangle 分支——房間不足以完成整趟 ramp-up/ramp-down 時，用相同加速度
// 求解可達到的較低峰值速度，而非縮短 ramp 時間、把加速度推高）。
// ---------------------------------------------------------------------------

/** 安全閥：正常 config（`accelerationRampMs < reversalIntervalMs[0]`）下 leg 數量遠低於此值；
 * 若邊界收斂造成退化 leg 連續出現，寧可 fail fast 也不要無限迴圈。 */
const MAX_REVERSAL_LEGS = 100_000;

/** 剩餘時間低於此值即視為排程結束（浮點殘差不再開一個新 leg）。 */
const LEG_TIME_EPSILON_MS = 1e-6;



/**
 * 方向選擇（KI-019）：若預定方向剩下的空間連一個「最小可用 leg」都放不下，改朝空間較大的另一側。
 *
 * 沒有這一步時，貼牆的那一軸會解出 room≈0 → `solveAxisProfile` 回傳 durationSec≈0 → **共用**的
 * leg 長度被歸零或壓到 1ms 級（兩軸共用同一個 duration/rampSec，見 `createReversal2dV1` 內註解）；
 * 而 sign 是每個 leg 無條件翻面，於是「yaw 貼 +8、pitch 貼 +8」時每次迭代恰好有一軸貼牆，退化狀態
 * 可以永遠交替下去——實測 `tracking_reversal_pilot_v1_medium` 因此產生 6644 筆 1ms 零速度 leg、
 * 整段 32.6% 的時間目標靜止在角落（KI-019 §1）。
 *
 * `minUsableRoomDeg` 由 config 導出（`speedRangeDegPerSec[0] × accelerationRampMs`＝最慢速度跑完
 * 一次 ramp-up/ramp-down 的位移），不是魔術常數：小於這個位移的「leg」在 rest-to-rest 設計下只是
 * 貼牆抖動，不是一次 reversal。
 */
function roomAwareSign(
  sign: number,
  posDeg: number,
  lowDeg: number,
  highDeg: number,
  minUsableRoomDeg: number,
): number {
  const intendedRoom = sign >= 0 ? highDeg - posDeg : posDeg - lowDeg;
  if (intendedRoom >= minUsableRoomDeg) return sign;
  const oppositeRoom = sign >= 0 ? posDeg - lowDeg : highDeg - posDeg;
  return oppositeRoom > intendedRoom ? -sign : sign;
}

interface ReversalLeg {
  readonly startMs: number;
  readonly durationSec: number;
  readonly rampSec: number; //          此 leg 實際 ramp-up（=ramp-down）秒數，恆 ≤ nominal rampSec
  readonly startYawDeg: number;
  readonly startPitchDeg: number;
  readonly cruiseYawVelocity: number; // 實際達到的巡航速度（triangle 分支可能小於抽樣 magnitude）
  readonly cruisePitchVelocity: number;
}

interface AxisProfile {
  readonly rampSec: number;
  readonly cruiseVelocity: number;
  readonly durationSec: number; // 這個 axis 若獨自用完 `roomDeg` 所需的時間（供跨軸取 min 用）
}

/**
 * 給定房間 `roomDeg`、抽樣巡航速度量值 `magnitude`（deg/s，恆正）與 nominal ramp 秒數
 * `rampNominalSec`，解出「靜止到靜止」剖面：房間夠大則是完整 trapezoid（ramp-up `rampNominalSec`
 * + cruise + ramp-down `rampNominalSec`，巡航速度 = `magnitude`）；房間不夠時退化成 triangle
 * （無 cruise 段），**用同一個加速度** `magnitude/rampNominalSec` 反推可達到的較低峰值速度——
 * 加速度因此恆 ≤ `magnitude/rampNominalSec`，不會因為房間變小而升高。
 */
function solveAxisProfile(roomDeg: number, magnitude: number, rampNominalSec: number): AxisProfile {
  const accel = magnitude / rampNominalSec;
  const trapezoidDisplacement = magnitude * rampNominalSec; // ramp-up + ramp-down 兩段合計位移
  if (roomDeg >= trapezoidDisplacement) {
    const durationSec = roomDeg / magnitude + rampNominalSec;
    return { rampSec: rampNominalSec, cruiseVelocity: magnitude, durationSec };
  }
  const peakVelocity = Math.sqrt(Math.max(roomDeg, 0) * accel);
  const rampSec = peakVelocity / accel;
  return { rampSec, cruiseVelocity: peakVelocity, durationSec: 2 * rampSec };
}

/** 單軸在一個 leg 內的封閉式位置/速度：ramp-up（0→cruise）／cruise／ramp-down（cruise→0）三段，
 * `v(0)=v(durationSec)=0`——leg 邊界恆為靜止瞬間，故位置與速度在邊界處連續。`rampSec===durationSec/2`
 * 時 cruise 段長度為 0（triangle），三段公式在該邊界自然收斂、不需另外特判。 */
function evaluateAxis(
  startDeg: number,
  rampSec: number,
  cruiseVelocity: number,
  durationSec: number,
  localSec: number,
): { readonly deg: number; readonly velocityDegPerSec: number } {
  const t = clamp(localSec, 0, durationSec);
  if (rampSec <= 0) return { deg: startDeg, velocityDegPerSec: 0 };

  const cruiseEndSec = durationSec - rampSec; // ramp-down 開始的局部時刻（可等於 rampSec，即 triangle）
  if (t <= rampSec) {
    const v = (cruiseVelocity * t) / rampSec;
    const deg = startDeg + (cruiseVelocity * t * t) / (2 * rampSec);
    return { deg, velocityDegPerSec: v };
  }
  const degAtRampEnd = startDeg + 0.5 * cruiseVelocity * rampSec;
  if (t <= cruiseEndSec) {
    const cruiseSec = t - rampSec;
    return { deg: degAtRampEnd + cruiseVelocity * cruiseSec, velocityDegPerSec: cruiseVelocity };
  }
  const degAtCruiseEnd = degAtRampEnd + cruiseVelocity * Math.max(cruiseEndSec - rampSec, 0);
  const tDown = t - cruiseEndSec;
  const v = cruiseVelocity * (1 - tDown / rampSec);
  const deg = degAtCruiseEnd + cruiseVelocity * tDown - (cruiseVelocity * tDown * tDown) / (2 * rampSec);
  return { deg, velocityDegPerSec: v };
}

function evaluateLeg(leg: ReversalLeg, localSec: number): TrackingTrajectorySample {
  const yaw = evaluateAxis(leg.startYawDeg, leg.rampSec, leg.cruiseYawVelocity, leg.durationSec, localSec);
  const pitch = evaluateAxis(leg.startPitchDeg, leg.rampSec, leg.cruisePitchVelocity, leg.durationSec, localSec);
  return {
    yawDeg: yaw.deg,
    pitchDeg: pitch.deg,
    yawVelocityDegPerSec: yaw.velocityDegPerSec,
    pitchVelocityDegPerSec: pitch.velocityDegPerSec,
  };
}

function findLeg(legs: readonly ReversalLeg[], ms: number): ReversalLeg {
  // Legs are sorted ascending by startMs. A pilot block has on the order of tens to a few hundred
  // legs, so a linear scan per sample() call is negligible against the 128 Hz sim budget — no need
  // for a binary search until a real profile says otherwise (README §2.6 "未量先加 concurrency").
  let candidate = legs[0];
  for (const leg of legs) {
    if (leg.startMs > ms) break;
    candidate = leg;
  }
  return candidate;
}

function createReversal2dV1(
  config: Extract<TrackingTrajectoryConfig, { kind: 'reversal-2d-v1' }>,
): TrackingTrajectory {
  requireFiniteSeed(config.seed);
  const durationMs = requirePositiveFiniteDurationMs(config.durationMs);
  const [lowDeg, highDeg] = requireAscendingFiniteRange(config.angularBoundsDeg, 'angularBoundsDeg');
  const [speedMin, speedMax] = requireAscendingFiniteRange(config.speedRangeDegPerSec, 'speedRangeDegPerSec');
  requirePositiveFinite(speedMin, 'speedRangeDegPerSec[0]');
  const [intervalMin, intervalMax] = requireAscendingFiniteRange(config.reversalIntervalMs, 'reversalIntervalMs');
  requirePositiveFinite(intervalMin, 'reversalIntervalMs[0]');
  const rampMsConfig = requirePositiveFinite(config.accelerationRampMs, 'accelerationRampMs');
  if (rampMsConfig >= intervalMin) {
    throw new Error('trackingTrajectory: accelerationRampMs must be smaller than reversalIntervalMs[0]');
  }
  const rampNominalSec = rampMsConfig / 1000;
  // 見 `roomAwareSign`：一個 leg 至少要放得下「最慢速度的完整 ramp-up + ramp-down」位移，否則它
  // 只是貼牆抖動。純由 config 導出，不引入新的 config 旋鈕。
  const minUsableRoomDeg = speedMin * rampNominalSec;

  const rng = createRan1(config.seed);
  const legs: ReversalLeg[] = [];
  const changes: PrecomputedTrackingChange[] = [];

  let tMs = 0;
  let yawPos = 0;
  let pitchPos = 0;
  let prevYawCruise = 0;
  let prevPitchCruise = 0;
  // Offset by one flip so yaw/pitch don't always reverse toward the same diagonal quadrant.
  let yawSign = 1;
  let pitchSign = -1;

  while (durationMs - tMs > LEG_TIME_EPSILON_MS) {
    if (legs.length >= MAX_REVERSAL_LEGS) {
      throw new Error('trackingTrajectory: reversal-2d-v1 exceeded MAX_REVERSAL_LEGS — check config bounds');
    }

    const candidateDurationSec = randomFloat(rng, intervalMin, intervalMax) / 1000;
    const yawMagnitude = randomFloat(rng, speedMin, speedMax);
    const pitchMagnitude = randomFloat(rng, speedMin, speedMax);

    // KI-019：貼牆的軸改朝有空間的一側，否則它會把共用的 leg 長度壓到抖動級並無限交替退化。
    yawSign = roomAwareSign(yawSign, yawPos, lowDeg, highDeg, minUsableRoomDeg);
    pitchSign = roomAwareSign(pitchSign, pitchPos, lowDeg, highDeg, minUsableRoomDeg);

    const yawRoomDeg = Math.max(yawSign >= 0 ? highDeg - yawPos : yawPos - lowDeg, 0);
    const pitchRoomDeg = Math.max(pitchSign >= 0 ? highDeg - pitchPos : pitchPos - lowDeg, 0);
    const yawProfile = solveAxisProfile(yawRoomDeg, yawMagnitude, rampNominalSec);
    const pitchProfile = solveAxisProfile(pitchRoomDeg, pitchMagnitude, rampNominalSec);

    const remainingSec = (durationMs - tMs) / 1000;
    const durationSecThisLeg = Math.max(
      Math.min(candidateDurationSec, yawProfile.durationSec, pitchProfile.durationSec, remainingSec),
      0,
    );

    // Re-solve each axis at the shared (possibly shorter) leg duration: both axes always land on
    // the same rampSec here (a pure function of durationSecThisLeg, identical for both axes), which
    // is what lets a single `leg.rampSec` drive both `evaluateAxis` calls in `evaluateLeg`. Fixing
    // acceleration at magnitude/rampNominalSec and using less than an axis's own ideal duration
    // always yields a displacement <= that axis's own room (monotonic in duration), so bound safety
    // still holds even though the achieved cruise velocity may fall below the drawn `magnitude`.
    const rampSec = Math.min(rampNominalSec, durationSecThisLeg / 2);
    const yawCruiseVelocity =
      durationSecThisLeg >= 2 * rampNominalSec ? yawMagnitude : rampSec * (yawMagnitude / rampNominalSec);
    const pitchCruiseVelocity =
      durationSecThisLeg >= 2 * rampNominalSec ? pitchMagnitude : rampSec * (pitchMagnitude / rampNominalSec);

    const leg: ReversalLeg = {
      startMs: tMs,
      durationSec: durationSecThisLeg,
      rampSec,
      startYawDeg: yawPos,
      startPitchDeg: pitchPos,
      cruiseYawVelocity: yawSign * yawCruiseVelocity,
      cruisePitchVelocity: pitchSign * pitchCruiseVelocity,
    };
    legs.push(leg);
    changes.push({
      tMs,
      yawVelocityBeforeDegPerSec: prevYawCruise,
      yawVelocityAfterDegPerSec: leg.cruiseYawVelocity,
      pitchVelocityBeforeDegPerSec: prevPitchCruise,
      pitchVelocityAfterDegPerSec: leg.cruisePitchVelocity,
    });

    const endState = evaluateLeg(leg, durationSecThisLeg);
    yawPos = endState.yawDeg;
    pitchPos = endState.pitchDeg;
    prevYawCruise = leg.cruiseYawVelocity;
    prevPitchCruise = leg.cruisePitchVelocity;
    yawSign = -yawSign;
    pitchSign = -pitchSign;

    // KI-019：`roomAwareSign` 保證每個 leg 至少有一側的完整 window 可走，故 duration 恆為正
    // （唯一的下界是剩餘時間，而 while 條件已排除剩餘時間 ≈ 0）。若仍走到 0，代表 bounds 本身
    // 退化——fail fast，不再用「推進 1ms」的安全閥產生零速度 leg 洗掉整段刺激。
    if (durationSecThisLeg <= 0) {
      throw new Error('trackingTrajectory: reversal-2d-v1 produced a zero-length leg — check angularBoundsDeg');
    }
    tMs += durationSecThisLeg * 1000;
  }

  return {
    changes,
    sample(ageSec: number, out: TrackingTrajectorySample): void {
      const ms = clamp(ageSec * 1000, 0, durationMs);
      const leg = findLeg(legs, ms);
      const state = evaluateLeg(leg, (ms - leg.startMs) / 1000);
      out.yawDeg = state.yawDeg;
      out.pitchDeg = state.pitchDeg;
      out.yawVelocityDegPerSec = state.yawVelocityDegPerSec;
      out.pitchVelocityDegPerSec = state.pitchVelocityDegPerSec;
    },
  };
}

// ---------------------------------------------------------------------------
// Angular-to-world projection (README §2.2 T1 line item)
// ---------------------------------------------------------------------------

const DEG_TO_RAD = Math.PI / 180;

/** 目標所在的視線/走廊幾何：與既有 `TargetManager` 的 `centerDistanceU`/`TARGET_Y` 慣例同語意
 * （yaw=pitch=0 時目標落在 `(0, centerY, -distanceU)`），但刻意獨立宣告——這是 trajectory 幾何的
 * 純輸入，不依賴 `TargetManager` 內部常數，維持本檔零場景依賴（GD-6）。 */
export interface TrackingProjectionOrigin {
  readonly distanceU: number; // 視線深度（u）
  readonly centerY: number; //  視線高度（u）
}

/**
 * 把 `sample()` 產出的 `(yawDeg, pitchDeg)` 投影成世界座標（就地寫入 `out`，GC 紀律）。純函式：
 * 只依 `(yawDeg, pitchDeg, origin)`，不讀場景/時鐘/RNG。yaw 繞垂直軸（水平面內），pitch 繞水平軸
 * （抬頭/低頭）；`yaw=pitch=0` 時輸出恰為 `(0, centerY, -distanceU)`，與既有 sightline 慣例一致。
 */
export function projectTrackingAngles(
  yawDeg: number,
  pitchDeg: number,
  origin: TrackingProjectionOrigin,
  out: Vec3,
): void {
  const yawRad = yawDeg * DEG_TO_RAD;
  const pitchRad = pitchDeg * DEG_TO_RAD;
  const cosPitch = Math.cos(pitchRad);
  out.x = origin.distanceU * cosPitch * Math.sin(yawRad);
  out.y = origin.centerY + origin.distanceU * Math.sin(pitchRad);
  out.z = -origin.distanceU * cosPitch * Math.cos(yawRad);
}
