import * as THREE from 'three/webgpu';
import { expect } from 'vitest';
import { createDataRecorder } from '../../data/DataRecorder.ts';
import type { DrillEvent } from '../../data/DataRecorder.ts';
import { buildExportPayload, type ExportPayload } from '../../data/export.ts';
import { collectMeta } from '../../data/metadata.ts';
import type { DrillConfig } from '../../drill/DrillConfig.ts';
import { deriveMicroFlickMetrics, type MicroFlickMetrics } from '../../metrics/microFlickMetrics.ts';
import { RAD_PER_COUNT } from '../../input/mouseGain.ts';
import { createTargetManager } from '../../sim/TargetManager.ts';
import { createSharedState } from '../../state/SharedState.ts';
import { pushEvent } from '../../state/inputRingTestUtil.ts';
import { resolveActiveWeapon } from '../../weapon/weapons.ts';
import type { Clock } from '../clock.ts';
import { SIM_HZ } from '../constants.ts';
import { createSimLoop } from '../SimLoop.ts';

/**
 * micro-flick 跨 render FPS 決定性 harness —— **WP-63 T-exit（v8／NFR-63.2）與 WP-68 T2（v9／
 * NFR-68.3）共用的同一份實作**。
 *
 * 跑的是**真的 drill**：真 `TargetManager` 的 seeded spawn、真 hitscan 命中判定、真 `DataRecorder`，
 * 以四種 render 幀序列 pump 同一份輸入，再逐位比對 trace 與四層指標。
 *
 * **為什麼抽成共用模組**：v9 的決定性契約與 v8 逐字相同，只有 drill config 與瞄準參數不同。照抄一份
 * 就是同一個構念的第二套實作（C-D4 的同一條紀律）——兩份 harness 會各自漂移，而「v8 綠、v9 紅」到時
 * 分不清是 drill 的差異還是 harness 的差異。參數化之後，兩支 drill 走的是**同一條**程式路徑。
 *
 * 會紅的失敗模式（這不是抽象風險）：
 *  - 輸入 ring 的排空邊界若沾到 render 幀（而非事件自身 `timeStamp`），`ticks[].dYaw` 的分桶就會隨
 *    FPS 改變 ⇒ L2 免閾值描述子與方向預測曲線跟著漂；
 *  - spawn 取樣若在幀邊界而非 tick 邊界推進，三顆的座標就會分歧 ⇒ L1／L3 的角距全錯。
 *
 * 斷言對象（CLAUDE.md §4）：tick index 對應的 sim 狀態與指標輸出；**不**斷言 wall-clock。
 */

export interface MicroFlickVariant {
  readonly sceneId: string;
  readonly drill: DrillConfig;
}

export interface HarnessTuning {
  /** 收尾 tick 數。收尾落在 tick 窗中段，避免尾端浮點 off-by-one（比照 wp65／wp66 的同一慣例）。 */
  readonly expectedTicks: number;
  /**
   * 換靶後的起始角誤差（度）。**交替兩個振幅**：小的讓首發在收斂後才開火（命中），大的讓首發落在
   * 角半徑外（失手）⇒ 一份 trace 同時含 hit 與 miss。全部是 tick index 的純函式，無亂數。
   */
  readonly approachAmplitudeDeg: readonly number[];
  /** 每 tick 的收斂比例。與 `clickPeriodMs` 一起決定首發時還剩多少角誤差。 */
  readonly approachDecay: number;
  /** 開火節奏（ms）。須略大於武器 cycletime，否則一次點擊不只一發。 */
  readonly clickPeriodMs: number;
}

export interface MicroFlickRun {
  readonly ticks: ExportPayload['ticks'];
  readonly events: DrillEvent[];
  readonly tickCount: number;
}

export interface MicroFlickHarness {
  readonly expectedTicks: number;
  readonly canonical: MicroFlickRun;
  readonly canonicalMetrics: MicroFlickMetrics;
  readonly canonicalPayload: ExportPayload;
  run(frames: readonly number[]): MicroFlickRun;
  payloadFor(run: MicroFlickRun): ExportPayload;
  metricsFor(run: MicroFlickRun): MicroFlickMetrics;
  canonicalFrames(): number[];
  framesAt(periodMs: number): number[];
}

const TICK_MS = 1000 / SIM_HZ;
/** 玩家 locked 在原點 ⇒ eye 恆為此值；camera 世界座標與 `meta.scene.eye` 必須是同一個點。 */
const EYE = { x: 0, y: 1.6, z: 0 } as const;
const SENSITIVITY = 1;
/** `resolveMouseGain({ sensitivity: 1, hipFovDeg })` 的 hip 值；這兩支 drill 無 ADS ⇒ 只有這一檔。 */
const HIP_STEP = SENSITIVITY * RAD_PER_COUNT;

function fixedClock(nowMs: number): Clock {
  return { now: () => nowMs };
}

/** `aimForward()` 的反解：從 eye 指向 `pos` 的 (yaw, pitch)。 */
function viewAnglesTo(pos: { x: number; y: number; z: number }): { yaw: number; pitch: number } {
  const dx = pos.x - EYE.x;
  const dy = pos.y - EYE.y;
  const dz = pos.z - EYE.z;
  const length = Math.hypot(dx, dy, dz);
  return { pitch: Math.asin(dy / length), yaw: Math.atan2(-dx / length, -dz / length) };
}

/** `Object.is` 逐欄遞迴比較（`toEqual` 會把 `-0`／`NaN` 的差異吃掉）。 */
export function expectObjectIsDeep(actual: unknown, expected: unknown, path = '$'): void {
  if (typeof expected === 'number' || typeof actual === 'number') {
    if (!Object.is(actual, expected)) {
      throw new Error(`${path}: expected ${String(expected)}, got ${String(actual)}`);
    }
    return;
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    expect(Array.isArray(actual)).toBe(true);
    expect(Array.isArray(expected)).toBe(true);
    const a = actual as readonly unknown[];
    const b = expected as readonly unknown[];
    if (a.length !== b.length) {
      throw new Error(`${path}: expected length ${b.length}, got ${a.length}`);
    }
    for (let i = 0; i < b.length; i++) expectObjectIsDeep(a[i], b[i], `${path}[${i}]`);
    return;
  }
  if (
    actual !== null &&
    expected !== null &&
    typeof actual === 'object' &&
    typeof expected === 'object'
  ) {
    const a = actual as Record<string, unknown>;
    const b = expected as Record<string, unknown>;
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    for (const key of Object.keys(b)) expectObjectIsDeep(a[key], b[key], `${path}.${key}`);
    return;
  }
  if (!Object.is(actual, expected)) {
    throw new Error(`${path}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

export const RENDER_FPS = [30, 60, 144, 240] as const;

export function createMicroFlickHarness(
  variant: MicroFlickVariant,
  tuning: HarnessTuning,
): MicroFlickHarness {
  const drill = variant.drill;
  const seed = drill.sequence!.seed!;
  /** `main.ts` `activeWeaponConfig()` 對這支 drill 解析出的那把。 */
  const weapon = resolveActiveWeapon(undefined, drill.weaponId);
  const endMs = (tuning.expectedTicks + 0.5) * TICK_MS;

  /** 固定 FPS 幀序列：等距 `periodMs`，收尾對齊 `endMs`。 */
  function framesAt(periodMs: number): number[] {
    const abs: number[] = [];
    for (let t = periodMs; t < endMs; t += periodMs) abs.push(t);
    if (abs.length === 0 || abs[abs.length - 1] < endMs) abs.push(endMs);
    return abs;
  }

  /** Ground truth：每幀恰一 tick。 */
  function canonicalFrames(): number[] {
    const abs: number[] = [];
    for (let k = 1; k * TICK_MS <= endMs; k += 1) abs.push(k * TICK_MS);
    return abs;
  }

  /**
   * 跑一趟 drill。
   *
   * 視角由 `afterTick` 逐 **sim tick** 推進（real app 是 render thread 寫 `state.aim`；此處刻意
   * tick-locked，因為決定性契約固定的是「同一輸入序列」——視角軌跡屬於輸入，不屬於被測物）。
   * 同一個 delta 另以 `mouse` 事件推進輸入 ring，時間戳落在下一個 tick 窗內 ⇒ `ticks[].dYaw` 與
   * 視角軌跡自洽，且分桶只能由事件自身時間戳決定。這正是本 harness 要壓的那條路徑。
   */
  function run(frames: readonly number[]): MicroFlickRun {
    const state = createSharedState();
    const manager = createTargetManager(drill);
    const recorder = createDataRecorder({
      simHz: SIM_HZ,
      capacity: tuning.expectedTicks + 16,
      mouseIntegration: { gain: { hipStep: HIP_STEP, adsStep: HIP_STEP } },
    });
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(EYE.x, EYE.y, EYE.z);
    camera.updateMatrixWorld(true);

    let engagedId: string | undefined;
    let switchTick = 0;
    let switchCount = 0;

    const sim = createSimLoop(
      state,
      fixedClock(0),
      SIM_HZ,
      manager,
      camera,
      undefined,
      recorder,
      weapon,
      seed,
      {
        translation: 'locked',
        afterTick(current, tickEndMs, tickIndex): void {
          const alive = current.targets.filter((target) => target.alive && target.visible);
          if (alive.length === 0) return;
          if (engagedId === undefined || !alive.some((target) => target.id === engagedId)) {
            // 換靶一律取**存活最久**的那顆（`visible` 時間序 = 陣列順序），不取陣列首顆之外的隨機
            // 決勝——換靶規則必須是 tick index 的純函式，否則四條序列會從這裡就分歧。
            engagedId = alive[0].id;
            switchTick = tickIndex;
            switchCount += 1;
          }
          const target = alive.find((candidate) => candidate.id === engagedId)!;
          const amplitudeDeg =
            tuning.approachAmplitudeDeg[switchCount % tuning.approachAmplitudeDeg.length];
          const offsetRad =
            THREE.MathUtils.degToRad(amplitudeDeg) *
            tuning.approachDecay ** (tickIndex - switchTick);
          const aimed = viewAnglesTo(target.pos);
          const nextYaw = aimed.yaw + offsetRad;
          const nextPitch = aimed.pitch;

          // 與視角同一份 delta 進輸入 ring：`dYaw = −dx × step`（`mouseGain.ts` 的唯一定義）。
          // 時間戳落在**下一個** tick 窗中段 ⇒ 該 delta 必然被下一 tick 排空，與幀邊界無關。
          const dYaw = nextYaw - current.aim.yaw;
          const dPitch = nextPitch - current.aim.pitch;
          pushEvent(state, {
            type: 'mouse',
            dx: -dYaw / HIP_STEP,
            dy: -dPitch / HIP_STEP,
            t: tickEndMs + TICK_MS / 2,
          });

          current.aim.yaw = nextYaw;
          current.aim.pitch = nextPitch;
        },
      },
    );

    for (let t = tuning.clickPeriodMs; t < endMs; t += tuning.clickPeriodMs) {
      pushEvent(state, { type: 'fire', down: true, t });
      pushEvent(state, { type: 'fire', down: false, t: t + 1 });
    }

    let tickCount = 0;
    for (const now of frames) tickCount += sim.pump(now).ticks;

    const snapshot = recorder.snapshot();
    return { ticks: snapshot.ticks, events: snapshot.events, tickCount };
  }

  function payloadFor(runResult: MicroFlickRun): ExportPayload {
    return buildExportPayload(
      collectMeta({
        drillId: drill.drillId,
        weaponId: weapon.id,
        weaponSeed: weapon.recoil.seed,
        rngSeed: seed,
        backend: 'webgpu',
        displayHz: 144,
        simHz: SIM_HZ,
        sensitivity: SENSITIVITY,
        crossOriginIsolated: true,
        startedAt: '2026-09-14T00:00:00.000Z',
        scene: {
          sceneId: variant.sceneId,
          assetPackVersion: 'test',
          clutterTier: 'low',
          fallback: false,
          eye: { ...EYE },
        },
        targets: { hitbox: drill.targets.hitbox! },
      }),
      { ticks: runResult.ticks, events: runResult.events, recorderOverflow: false },
    );
  }

  function metricsFor(runResult: MicroFlickRun): MicroFlickMetrics {
    return deriveMicroFlickMetrics(payloadFor(runResult), { eye: { strictEyeOrigin: true } });
  }

  const canonical = run(canonicalFrames());
  const canonicalPayload = payloadFor(canonical);

  return {
    expectedTicks: tuning.expectedTicks,
    canonical,
    canonicalPayload,
    canonicalMetrics: deriveMicroFlickMetrics(canonicalPayload, { eye: { strictEyeOrigin: true } }),
    run,
    payloadFor,
    metricsFor,
    canonicalFrames,
    framesAt,
  };
}
