import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../../data/DataRecorder.ts';
import type { DrillEvent } from '../../data/DataRecorder.ts';
import { buildExportPayload, type ExportPayload } from '../../data/export.ts';
import { collectMeta } from '../../data/metadata.ts';
import { microFlickThreeTargetTestV8 } from '../../drill/micro_flick_three_target_test_v8.ts';
import { deriveMicroFlickMetrics } from '../../metrics/microFlickMetrics.ts';
import { RAD_PER_COUNT } from '../../input/mouseGain.ts';
import { createTargetManager } from '../../sim/TargetManager.ts';
import { createSharedState } from '../../state/SharedState.ts';
import { pushEvent } from '../../state/inputRingTestUtil.ts';
import { resolveActiveWeapon } from '../../weapon/weapons.ts';
import type { Clock } from '../clock.ts';
import { SIM_HZ } from '../constants.ts';
import { createSimLoop } from '../SimLoop.ts';

/**
 * WP-63 / T-exit — **NFR-63.2**：同一 seed 與輸入序列，在 30／60／144／240 render FPS 下，v8 的
 * 逐 tick trace 與本 WP 全部指標輸出逐位一致。
 *
 * T7 交付的 `NFR-63.2: display FPS metadata does not perturb …` 量的是**另一件事**：它把同一份合成
 * payload 的 `meta.displayHz` 改掉再比對，兩側的 `ticks` 來自同一個 generator ⇒ 那條斷言恆真，與
 * 指標實作無關。它守住的是「指標不讀 `meta.displayHz`」（仍值得有），但**不是** NFR-63.2。本檔補
 * 上真正的閘：**跑真的 v8**（真 `TargetManager` 的 seeded spawn、真 hitscan 命中判定、真
 * `DataRecorder`），以四種 render 幀序列 pump 同一份輸入，再逐位比對 trace 與四層指標。
 *
 * 會紅的失敗模式（這不是抽象風險）：
 *  - 輸入 ring 的排空邊界若沾到 render 幀（而非事件自身 `timeStamp`），`ticks[].dYaw` 的分桶就會
 *    隨 FPS 改變 ⇒ L2 免閾值描述子與方向預測曲線跟著漂（README §0.2 宣稱「真 128 Hz，與顯示率
 *    無關」，本檔是那句話的回歸防線）；
 *  - spawn 取樣若在幀邊界而非 tick 邊界推進，三顆的座標就會分歧 ⇒ L1／L3 的角距全錯。
 *
 * 斷言對象（CLAUDE.md §4）：tick index 對應的 sim 狀態與指標輸出；**不**斷言 wall-clock。
 * 比較一律 `Object.is` 逐欄遞迴（`-0`／`NaN` 不被 `toEqual` 的寬鬆語意吃掉）。
 */

const V8 = microFlickThreeTargetTestV8.drill;
const V8_SEED = V8.sequence.seed;
/** `main.ts` `activeWeaponConfig()` 對 v8 解析出的那把（T1 起為 `usp_s_laser`）。 */
const WEAPON = resolveActiveWeapon(undefined, V8.weaponId);

const TICK_MS = 1000 / SIM_HZ;
/** 收尾落在 tick 窗中段，避免尾端浮點 off-by-one（比照 wp65／wp66 的同一慣例）。 */
const EXPECTED_TICKS = 900;
const END_MS = (EXPECTED_TICKS + 0.5) * TICK_MS;

/** 玩家 locked 在原點 ⇒ eye 恆為此值；camera 世界座標與 `meta.scene.eye` 必須是同一個點。 */
const EYE = { x: 0, y: 1.6, z: 0 } as const;
const SENSITIVITY = 1;
/** `resolveMouseGain({ sensitivity: 1, hipFovDeg })` 的 hip 值；本 drill 無 ADS ⇒ 只有這一檔。 */
const HIP_STEP = SENSITIVITY * RAD_PER_COUNT;

/** 開火節奏：略大於 `usp_s_laser` 的 170 ms cycletime ⇒ 每次點擊恰一發。 */
const CLICK_PERIOD_MS = 190;

/**
 * 換靶後的起始角誤差（度）。**交替兩個振幅**：小的讓首發在收斂後才開火（命中），大的讓首發
 * 落在角半徑外（失手）⇒ 一份 trace 同時含 hit 與 miss。全部是 tick index 的純函式，無亂數。
 */
const APPROACH_AMPLITUDE_DEG = [1.5, 9] as const;
/**
 * 每 tick 的收斂比例。取 0.97（每 7.8 ms 收 3%）是為了讓**大振幅那一支在首發時仍落在角半徑外**：
 * 190 ms 的點擊節奏 ≈ 24 ticks ⇒ 9° × 0.97^24 ≈ 4.3°，遠大於 v8 的 1.24° 角半徑 ⇒ 首發必失手，
 * 再兩三發才收進去。小振幅那一支同一時刻只剩 0.72° ⇒ 首發即命中。一份 trace 因此同時走過
 * 命中與失手兩條分支（`firstShotHit` 兩種值都出現），逐位比對才不是在比兩條全命中的直線。
 */
const APPROACH_DECAY = 0.97;

interface V8Run {
  readonly ticks: ExportPayload['ticks'];
  readonly events: DrillEvent[];
  readonly tickCount: number;
}

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

/** 固定 FPS 幀序列：等距 `periodMs`，收尾對齊 `END_MS`。 */
function framesAt(periodMs: number): number[] {
  const abs: number[] = [];
  for (let t = periodMs; t < END_MS; t += periodMs) abs.push(t);
  if (abs.length === 0 || abs[abs.length - 1] < END_MS) abs.push(END_MS);
  return abs;
}

/** Ground truth：每幀恰一 tick。 */
function canonicalFrames(): number[] {
  const abs: number[] = [];
  for (let k = 1; k * TICK_MS <= END_MS; k += 1) abs.push(k * TICK_MS);
  return abs;
}

/**
 * 跑一趟 v8。
 *
 * 視角由 `afterTick` 逐 **sim tick** 推進（real app 是 render thread 寫 `state.aim`；此處刻意
 * tick-locked，因為 NFR-63.2 固定的是「同一輸入序列」——視角軌跡屬於輸入，不屬於被測物）。
 * 同一個 delta 另以 `mouse` 事件推進輸入 ring，時間戳落在下一個 tick 窗內 ⇒ `ticks[].dYaw` 與
 * 視角軌跡自洽，且分桶只能由事件自身時間戳決定。這正是本檔要壓的那條路徑。
 */
function runV8(frames: readonly number[]): V8Run {
  const state = createSharedState();
  const manager = createTargetManager(V8);
  const recorder = createDataRecorder({
    simHz: SIM_HZ,
    capacity: EXPECTED_TICKS + 16,
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
    WEAPON,
    V8_SEED,
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
        const amplitudeDeg = APPROACH_AMPLITUDE_DEG[switchCount % APPROACH_AMPLITUDE_DEG.length];
        const offsetRad =
          THREE.MathUtils.degToRad(amplitudeDeg) * APPROACH_DECAY ** (tickIndex - switchTick);
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

  for (let t = CLICK_PERIOD_MS; t < END_MS; t += CLICK_PERIOD_MS) {
    pushEvent(state, { type: 'fire', down: true, t });
    pushEvent(state, { type: 'fire', down: false, t: t + 1 });
  }

  let tickCount = 0;
  for (const now of frames) tickCount += sim.pump(now).ticks;

  const snapshot = recorder.snapshot();
  return { ticks: snapshot.ticks, events: snapshot.events, tickCount };
}

function payloadFor(run: V8Run): ExportPayload {
  return buildExportPayload(
    collectMeta({
      drillId: V8.drillId,
      weaponId: WEAPON.id,
      weaponSeed: WEAPON.recoil.seed,
      rngSeed: V8_SEED,
      backend: 'webgpu',
      displayHz: 144,
      simHz: SIM_HZ,
      sensitivity: SENSITIVITY,
      crossOriginIsolated: true,
      startedAt: '2026-09-14T00:00:00.000Z',
      scene: {
        sceneId: microFlickThreeTargetTestV8.sceneId,
        assetPackVersion: 'test',
        clutterTier: 'low',
        fallback: false,
        eye: { ...EYE },
      },
      targets: { hitbox: V8.targets.hitbox! },
    }),
    { ticks: run.ticks, events: run.events, recorderOverflow: false },
  );
}

/** `Object.is` 逐欄遞迴比較（`toEqual` 會把 `-0`／`NaN` 的差異吃掉）。 */
function expectObjectIsDeep(actual: unknown, expected: unknown, path = '$'): void {
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
  if (actual !== null && expected !== null && typeof actual === 'object' && typeof expected === 'object') {
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

const RENDER_FPS = [30, 60, 144, 240] as const;
const CANONICAL = runV8(canonicalFrames());
const CANONICAL_METRICS = deriveMicroFlickMetrics(payloadFor(CANONICAL), {
  eye: { strictEyeOrigin: true },
});

describe('WP-63 T-exit — NFR-63.2：v8 的 tick trace 與四層指標跨 render FPS 逐位一致', () => {
  it('這份 trace 不是空對空：有 kill、有 hit 也有 miss、有真的 dYaw', () => {
    const fires = CANONICAL.events.filter(
      (event): event is Extract<DrillEvent, { type: 'fire' }> => event.type === 'fire',
    );
    const visible = CANONICAL.events.filter((event) => event.type === 'visible');

    expect(CANONICAL.tickCount).toBe(EXPECTED_TICKS);
    expect(fires.filter((fire) => fire.hit).length).toBeGreaterThan(5);
    expect(fires.filter((fire) => !fire.hit).length).toBeGreaterThan(5);
    // 三顆起始 + 每次擊殺補一顆 ⇒ visible 數必然大於 3。
    expect(visible.length).toBeGreaterThan(3);
    expect(CANONICAL.ticks.some((tick) => (tick.dYaw ?? 0) !== 0)).toBe(true);
    // 指標四層都真的出數（否則下面的逐位比對是在比四個空殼）。
    expect(CANONICAL_METRICS.outcome.n).toBeGreaterThan(1);
    expect(CANONICAL_METRICS.geometry.shots.length).toBeGreaterThan(5);
    expect(CANONICAL_METRICS.selection.n).toBeGreaterThan(1);
    expect(CANONICAL_METRICS.microAdjust.n).toBeGreaterThan(0);
  });

  for (const fps of RENDER_FPS) {
    it(`${fps} Hz：逐 tick trace 與 canonical 逐位相同`, () => {
      const run = runV8(framesAt(1000 / fps));
      expect(run.tickCount).toBe(CANONICAL.tickCount);
      expectObjectIsDeep(run.ticks, CANONICAL.ticks, `ticks@${fps}`);
      expectObjectIsDeep(run.events, CANONICAL.events, `events@${fps}`);
    });

    it(`${fps} Hz：deriveMicroFlickMetrics 的四層輸出與 canonical 逐位相同`, () => {
      const metrics = deriveMicroFlickMetrics(payloadFor(runV8(framesAt(1000 / fps))), {
        eye: { strictEyeOrigin: true },
      });
      expectObjectIsDeep(metrics, CANONICAL_METRICS, `metrics@${fps}`);
    });
  }

  it('四種 FPS 序列彼此逐位相等（不只是各自等於 canonical）', () => {
    const runs = RENDER_FPS.map((fps) => runV8(framesAt(1000 / fps)));
    for (const run of runs) expectObjectIsDeep(run.ticks, runs[0].ticks, 'ticks');
  });

  it('重播逐位相同：同一序列跑兩次一致（無時鐘／Math.random 洩漏）', () => {
    const frames = framesAt(1000 / 144);
    expectObjectIsDeep(runV8(frames).ticks, runV8(frames).ticks, 'replay');
  });
});
