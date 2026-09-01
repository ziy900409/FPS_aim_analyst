import type { SharedState } from '../state/SharedState.ts';
import {
  resolveTargetHitbox,
  type DrillConfig,
  type SpiderShotStratifiedConfig,
  type TargetHitboxConfig,
  type TargetHitboxSize,
} from '../drill/DrillConfig.ts';
import type { Vec3 } from '../state/types.ts';
import { createRan1, randomFloat, type Rng } from '../recoil/rng.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { isDrivenMotion, motionOffset } from './targetMotion.ts';

/**
 * TargetManager — WP-4 / T2（FR-4.2）；WP-6 / T2（FR-6.2）config 驅動
 *
 * sim 職責（CONTEXT.md §B）:在 **sim tick 內** 管理目標 spawn／可見性,並於目標 `visible`
 * 由 false→true 的轉換 tick 蓋 `t_visible = nowMs`(sim clock)。`t_visible` 是所有反應時間
 * 量測的起點(規格 §5),其時間源與只蓋一次是效度關鍵。
 *
 * **時間源硬約束**:`nowMs` 由 `SimLoop.simStep` 傳入的 sim 邏輯時鐘(累加 tickMs,量測時鐘域,
 * 與 `performance.now()` 同 time origin)——**不可** 用 rAF frame 時間或 `Date.now()`(ADR-4 /
 * README failure-mode「t_visible 蓋在 render frame」)。TargetManager 不讀時鐘、只收注入的 nowMs,
 * 故天然純函式(不碰 DOM/`performance.now`),與 simStep 的 Worker 搬遷紀律(OQ-2.4)相容。
 *
 * **只蓋一次**:以 `state.tVisible.has(id)` 防重複——可見目標只在第一個可見 tick 蓋戳。
 *
 * **左右交替序列(T3,FR-4.3)**:一次只一個 active 目標(counter-strafe peek 節奏)。
 * `markKilled` 撤除目標後翻面 `nextSide`(L↔R),下一個可見 tick 於對側 spawn 並蓋新
 * `t_visible`。輪替純由內部 `nextSide` 布林驅動、無隨機源——確定性(給定首側,序列可重現),
 * 與 WP-2 決定性契約相容(不可用無種子 `Math.random`)。首側由 `reset(seq)` 決定(預設 'R')。
 * 命中訊號(何時呼叫 `markKilled`)屬 WP-5;本 task 用測試/佔位觸發。
 *
 * **config 驅動(WP-6 / T2,FR-6.2)**:`createTargetManager(config)` 由 `DrillConfig` 取代 WP-4
 * 內建佔位——`targets.distance`(位置)、`sequence.alternation` 首字(首側)、`targets.count`
 * (spawn 上限,達標後不再補生)。**換 config 即換 drill,零引擎程式碼改動**(F4)。`config`
 * 省略時退回 WP-4 佔位行為(預設距離、首側 'R'、無限補生),既有 WP-4 測試不變。
 *
 * ⚠️ 範圍:`endCondition` 的 **phase 語意**(running→ended)屬 DrillRunner(T4);此處只把
 * `targets.count` 當 spawn 上限,不判定 drill 結束。WP-21 seeded spawn 只在 config 提供
 * `targets.spawnArea` 或 `sequence.spawnDelayMsRange` 時啟用；seed-only 既有 drill 維持舊 L/R slot
 * 行為。
 *
 * **移動目標驅動(WP-18 / T1,FR-B17 前置)**:`targets.motion` 提供 `linear`/`pingpong`/`sine` 時,
 * `tick` 於**命中判定之前**([SimLoop.ts](../loop/SimLoop.ts) simStep 順序)每 tick 依 `age`(累加
 * `TICK_SEC = 1/SIM_HZ` **常數**,非變動 dt)以純函式 [`motionOffset`](./targetMotion.ts) 就地更新
 * `target.pos`——pos 為 tick 數的純函式,異 render FPS 逐位一致(CLAUDE.md §4)。`static`/`waypoints`/
 * 省略 motion 逐位不變(既有靜止 drill 零破壞)。以每 tick **位移差**增量更新,免存 spawn 原點、
 * 免額外配置(GC 紀律 §4;等價 pos = 原點 + offset(age))。
 */

/**
 * 目標距玩家的前方(-Z)距離(u,source unit;佔位,WP-6 drill config 接管)。
 * ⚠️ 須 < 佔位房間半深(`placeholder-room` `roomSize` depth=20 → 北牆 z=−10;KI-012 修復前
 * depth=10 → z=−5),否則目標生在牆後被遮擋(WP-5 T1 手動驗證發現:距離 8 → z=−8 落在北牆後方；
 * spider-shot-v1/v2 的 `centerDistanceU`/`distanceURange=8` 曾重蹈此坑,見 KI-012)。
 * 4 → z=−4,落在房間內、camera 前方。
 */
const DEFAULT_DISTANCE = 4;
/** 目標中心高(u;略低於眼高 1.6,使準心正對軀幹)。 */
const TARGET_Y = 1.5;
/** 左右 peek 槽位相對中軸的水平偏移(u)。 */
const SIDE_OFFSET = 2;
const DEG_TO_RAD = Math.PI / 180;
/**
 * 每 tick age 累加步長(邏輯秒)= sim tick 週期 `1/SIM_HZ`,**常數**(不代入變動 dt;決定性根源,
 * WP-18 / T1,CLAUDE.md §4)。與 recoil 64Hz 子節奏用固定 `1/64` 同紀律——sim 子速率一律常數。
 */
const TICK_SEC = 1 / SIM_HZ;
// 移動目標位移差計算的模組層級重用向量(每 tick 熱路徑零配置,GC 紀律 §4)。
const offsetPrev: Vec3 = { x: 0, y: 0, z: 0 };
const offsetCurr: Vec3 = { x: 0, y: 0, z: 0 };

function sideX(side: 'L' | 'R'): number {
  return side === 'R' ? SIDE_OFFSET : -SIDE_OFFSET;
}

/**
 * Converts a center-relative spherical offset (azimuth around the center sightline, radial angle
 * off it, and distance from the player) into a world position. Shared by both `spiderShot` kinds
 * (WP-36 `center-peripheral` and WP-44 `center-peripheral-stratified`) — pure function, no RNG
 * consumption, so extracting it does not change either kind's sampling sequence or output.
 */
function peripheralPos(centerDistanceU: number, azimuthRad: number, radiusRad: number, distanceU: number): Vec3 {
  // Center sightline is (0, TARGET_Y, -centerDistanceU). Its projected world-up axis makes
  // azimuth 0/90/180/270 map to up/right/down/left without reusing legacy horizontal yaw.
  const centerLength = Math.hypot(TARGET_Y, centerDistanceU);
  const forwardY = TARGET_Y / centerLength;
  const forwardZ = -centerDistanceU / centerLength;
  const upY = centerDistanceU / centerLength;
  const upZ = TARGET_Y / centerLength;
  const radialSin = Math.sin(radiusRad);
  const radialCos = Math.cos(radiusRad);
  const azimuthSin = Math.sin(azimuthRad);
  const azimuthCos = Math.cos(azimuthRad);
  return {
    x: distanceU * radialSin * azimuthSin,
    y: distanceU * (radialCos * forwardY + radialSin * azimuthCos * upY),
    z: distanceU * (radialCos * forwardZ + radialSin * azimuthCos * upZ),
  };
}

/**
 * One cell of the WP-44 stratified peripheral schedule: an azimuth bin (equal-width) crossed with
 * a radius bin (equal solid angle, via `cos` — the sphere-correct analog of an equal-area annulus
 * slice; NOT the flat `sqrt(area)` approximation a screen-projected radius would use). Scheduling
 * only — independent from the presentation-layer `SpiderQuadrant` labels in spiderShotConditions.ts.
 */
interface SpiderZoneCell {
  readonly azimuthDegRange: readonly [number, number];
  /** [cosLower, cosUpper]; a sample's radiusRad = acos(uniform draw in this range). */
  readonly cosRadiusRange: readonly [number, number];
}

/** Builds the `azimuthQuadrants × radiusTiers` cells covering one stratified schedule's declared ranges. */
function buildSpiderZoneCells(config: SpiderShotStratifiedConfig): SpiderZoneCell[] {
  const { peripheral, grid } = config;
  const [azMin, azMax] = peripheral.azimuthDegRange;
  const azimuthStep = (azMax - azMin) / grid.azimuthQuadrants;
  const [radMinDeg, radMaxDeg] = peripheral.angularRadiusDegRange;
  const cosInner = Math.cos(radMinDeg * DEG_TO_RAD);
  const cosOuter = Math.cos(radMaxDeg * DEG_TO_RAD);
  const cosSpan = cosInner - cosOuter; // > 0 (schema requires radMinDeg < radMaxDeg for this kind)

  const cells: SpiderZoneCell[] = [];
  for (let a = 0; a < grid.azimuthQuadrants; a++) {
    const azimuthDegRange: [number, number] = [azMin + a * azimuthStep, azMin + (a + 1) * azimuthStep];
    for (let r = 0; r < grid.radiusTiers; r++) {
      // Tier r=0 is innermost (nearest the center sightline); tiers cover equal solid angle.
      const cosUpper = cosInner - (cosSpan * r) / grid.radiusTiers;
      const cosLower = cosInner - (cosSpan * (r + 1)) / grid.radiusTiers;
      cells.push({ azimuthDegRange, cosRadiusRange: [cosLower, cosUpper] });
    }
  }
  return cells;
}

/** Seeded Fisher–Yates in place (GD-5: no `Math.random`; consumes the same spawn RNG as sampling). */
function shuffleInPlace<T>(items: T[], rng: Rng): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(randomFloat(rng, 0, i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}

export interface TargetManager {
  /** sim tick 內呼叫:spawn/可見性 → 可見轉換即蓋 `t_visible`(nowMs = sim clock)。 */
  tick(state: SharedState, nowMs: number): void;
  /** 標記某目標被擊殺 → 撤除並翻面 `nextSide`,下一 tick 於對側 spawn(WP-5 命中後呼叫)。 */
  markKilled(state: SharedState, id: string): void;
  /** 重置目標/tVisible/spawn 計數;`seq` 首字定首側,省略時用 config 首側(或無 config 預設 'R')。 */
  reset(state: SharedState, seq?: 'LR' | 'RL'): void;
}

export function createTargetManager(config?: DrillConfig): TargetManager {
  const distance = config?.targets.distance ?? DEFAULT_DISTANCE;
  const hitbox = resolveTargetHitbox(config);
  // spawn 上限:config 的目標總數;無 config 時不設限(向後相容 WP-4 佔位——無限補生)。
  const spawnLimit = config ? config.targets.count : Infinity;
  // F5 接縫:config 帶 motion 即寫入目標(階段 A 不驅動移動,WP-6.5 接管)。
  const motion = config?.targets.motion;
  // timed presentation（WP-18 / T3）:config.timing.presentationMs 提供即把目標標為 persistent
  //（命中不撤除,只由 DrillRunner 呈現時長到期推進）。省略＝命中即撤(既有政策,persistent 為 undefined)。
  const persistent = config?.timing.presentationMs !== undefined;
  // hold-track target_stop 不用 persistent：停止後的首發命中應依既有命中路徑撤除目標。
  const trackingStopMs = config?.timing.trackingStopMs;
  // 首側:config.sequence.alternation 首字(對齊 reset 語意);無 config 時預設 'R'(WP-4)。
  const defaultFirstSide: 'L' | 'R' = config ? (config.sequence.alternation[0] as 'L' | 'R') : 'R';
  const spawnArea = config?.targets.spawnArea;
  const spawnDelayMsRange = config?.sequence.spawnDelayMsRange;
  const hitboxCandidates = config?.targets.hitboxCandidates;
  const spiderShot = config?.spiderShot;
  const cue = config?.cue;
  const usesSeededSpawn =
    config?.sequence.seed !== undefined &&
    (spawnArea !== undefined || spawnDelayMsRange !== undefined || hitboxCandidates !== undefined);

  let nextId = 0;
  // 下一個 spawn 側;`markKilled` 每次擊殺翻面以實現左右交替(FR-4.3)。首側由 reset 設。
  let nextSide: 'L' | 'R' = defaultFirstSide;
  // Spider Shot keeps independent center/peripheral state; it never reads or mutates legacy nextSide.
  let nextSpiderZone: 'center' | 'peripheral' = 'center';
  // WP-44 stratified schedule only: shuffled zone-cell queue, rebuilt+reshuffled whenever exhausted.
  let spiderZoneQueue: SpiderZoneCell[] = [];
  // 已 spawn 目標數(對照 spawnLimit;reset 歸零)——config 驅動的「換 config 即換數量」判準。
  let spawnedCount = 0;
  let spawnRng: Rng | undefined = usesSeededSpawn
    ? createRan1(config.sequence.seed!)
    : spiderShot !== undefined
      ? createRan1(spiderShot.seed)
      : undefined;
  let pendingSpawnAtMs: number | null = null;
  // WP-52 T5: balanced-shuffle hitbox-candidate queue — built once per run (spawnLimit is exactly
  // divisible by candidate count, schema.ts-enforced) so every candidate appears an equal number of
  // times; consumed one per spawn, never rebuilt mid-run (unlike the spider-shot zone queue, which
  // cycles for a potentially unbounded drill).
  let hitboxQueue: TargetHitboxConfig[] = buildHitboxQueue();

  function buildHitboxQueue(): TargetHitboxConfig[] {
    if (hitboxCandidates === undefined || spawnRng === undefined) return [];
    const perCandidate = spawnLimit / hitboxCandidates.length;
    const queue: TargetHitboxConfig[] = [];
    for (const candidate of hitboxCandidates) {
      for (let i = 0; i < perCandidate; i++) queue.push(candidate);
    }
    shuffleInPlace(queue, spawnRng);
    return queue;
  }

  function sampleDelayMs(): number {
    if (spawnRng === undefined || spawnDelayMsRange === undefined) return 0;
    return randomFloat(spawnRng, spawnDelayMsRange[0], spawnDelayMsRange[1]);
  }

  function sampleSpawnPose(): { side: 'L' | 'R'; zone?: 'center' | 'peripheral'; pos: { x: number; y: number; z: number } } {
    if (spawnRng === undefined || spawnArea === undefined) {
      return { side: nextSide, pos: { x: sideX(nextSide), y: TARGET_Y, z: -distance } };
    }
    const yawDeg = randomFloat(spawnRng, spawnArea.yawDegRange[0], spawnArea.yawDegRange[1]);
    const distanceU = randomFloat(spawnRng, spawnArea.distanceURange[0], spawnArea.distanceURange[1]);
    const yawRad = yawDeg * DEG_TO_RAD;
    return {
      side: yawDeg < 0 ? 'L' : yawDeg > 0 ? 'R' : nextSide,
      pos: {
        x: Math.sin(yawRad) * distanceU,
        y: TARGET_Y,
        z: -Math.cos(yawRad) * distanceU,
      },
    };
  }

  function sampleSpiderShotPose(): {
    side: 'L' | 'R';
    zone: 'center' | 'peripheral';
    pos: { x: number; y: number; z: number };
  } {
    if (spiderShot === undefined) throw new Error('spiderShot schedule is required');
    if (nextSpiderZone === 'center') {
      return {
        side: 'R',
        zone: 'center',
        pos: { x: 0, y: TARGET_Y, z: -spiderShot.centerDistanceU },
      };
    }

    if (spiderShot.kind === 'center-peripheral-stratified') {
      return { side: 'R', zone: 'peripheral', pos: sampleStratifiedPeripheralPos(spiderShot) };
    }

    const { peripheral } = spiderShot;
    const azimuthRad =
      randomFloat(spawnRng!, peripheral.azimuthDegRange[0], peripheral.azimuthDegRange[1]) * DEG_TO_RAD;
    const radiusRad =
      randomFloat(spawnRng!, peripheral.angularRadiusDegRange[0], peripheral.angularRadiusDegRange[1]) * DEG_TO_RAD;
    const distanceU = randomFloat(spawnRng!, peripheral.distanceURange[0], peripheral.distanceURange[1]);
    return { side: 'R', zone: 'peripheral', pos: peripheralPos(spiderShot.centerDistanceU, azimuthRad, radiusRad, distanceU) };
  }

  /** WP-44: pop one shuffled zone cell (rebuilding+reshuffling on exhaustion) and sample within it. */
  function sampleStratifiedPeripheralPos(config: SpiderShotStratifiedConfig): Vec3 {
    if (spiderZoneQueue.length === 0) {
      spiderZoneQueue = buildSpiderZoneCells(config);
      shuffleInPlace(spiderZoneQueue, spawnRng!);
    }
    const cell = spiderZoneQueue.pop()!;
    const azimuthRad = randomFloat(spawnRng!, cell.azimuthDegRange[0], cell.azimuthDegRange[1]) * DEG_TO_RAD;
    const cosSample = randomFloat(spawnRng!, cell.cosRadiusRange[0], cell.cosRadiusRange[1]);
    const radiusRad = Math.acos(cosSample);
    const distanceU = randomFloat(spawnRng!, config.peripheral.distanceURange[0], config.peripheral.distanceURange[1]);
    return peripheralPos(config.centerDistanceU, azimuthRad, radiusRad, distanceU);
  }

  /** WP-52 T5: pop this spawn's balanced-shuffle hitbox candidate, or the drill's fixed hitbox. */
  function pickHitbox(): { size: TargetHitboxSize; varies: boolean } {
    if (hitboxCandidates === undefined) return { size: hitbox, varies: false };
    const candidate = hitboxQueue.pop()!;
    return {
      size: { width: candidate.widthU, height: candidate.heightU, depth: candidate.depthU, shape: candidate.shape ?? 'box' },
      varies: true,
    };
  }

  /** 生成一個目標(OQ-4.2:spawn 瞬間即可見)。spawn 屬低頻事件(peek 節奏),非每 tick 熱路徑。 */
  function spawn(state: SharedState): void {
    const pose = spiderShot !== undefined ? sampleSpiderShotPose() : sampleSpawnPose();
    const spawnedHitbox = pickHitbox();
    state.weapon.ammo = state.weapon.magSize;
    state.targets.push({
      id: `t${nextId++}`,
      side: pose.side,
      ...(spiderShot !== undefined ? { zone: pose.zone } : {}),
      pos: pose.pos,
      visible: true,
      alive: true,
      hitbox: { ...spawnedHitbox.size },
      ...(spawnedHitbox.varies ? { hitboxVaries: true } : {}),
      // motion 提供即寫入(F5 接縫);`age` 一律 spawn 起算 0——motion drive 以 age 累加驅動 pos
      // （T1)。無 motion 時 age 仍設 0(語意一致、零成本),drive 步驟會依 motion 缺省而跳過。
      age: 0,
      // posPrev 快照欄(WP-18/T2,FR-B17):spawn 時初始化為 spawn 位置(= 本 tick drive 之前的
      // 起始位置);後續 tick 由 simStep 在 drive 前就地更新。目標各持一份重用 Vec3(GC 紀律 §4,
      // 不 push 額外物件)。sub-tick 命中內插以 lerp(posPrev, pos, subAlpha) 對齊 fire 時間戳。
      posPrev: { x: pose.pos.x, y: pose.pos.y, z: pose.pos.z },
      ...(motion ? { motion: { ...motion } } : {}),
      ...(persistent ? { persistent: true } : {}),
      ...(trackingStopMs !== undefined ? { fireLocked: true } : {}),
    });
    spawnedCount++;
  }

  function spawnWhenDue(state: SharedState, nowMs: number): void {
    if (pendingSpawnAtMs === null) {
      pendingSpawnAtMs = nowMs + sampleDelayMs();
      // The cue begins the existing foreperiod and never changes its sampled delay or side schedule.
      if (cue?.kind === 'single') state.cues.push({ t: nowMs, direction: nextSide === 'L' ? 'A' : 'D' });
    }
    if (nowMs >= pendingSpawnAtMs) {
      pendingSpawnAtMs = null;
      spawn(state);
    }
  }

  function hasAliveTarget(state: SharedState): boolean {
    for (let i = 0; i < state.targets.length; i++) {
      if (state.targets[i].alive) return true;
    }
    return false;
  }

  return {
    tick(state: SharedState, nowMs: number): void {
      // ① spawn:無存活目標且未達 spawn 上限時補一個(單 active 目標;side 由 nextSide 交替)。
      //    達 spawnLimit(config.targets.count)後不再補生——drill 目標序列耗盡(結束判定屬 T4)。
      if (!hasAliveTarget(state) && spawnedCount < spawnLimit) {
        if (usesSeededSpawn || cue?.kind === 'single') spawnWhenDue(state, nowMs);
        else spawn(state);
      }
      // ② 蓋 t_visible:可見且尚未蓋過者蓋一次(sim clock nowMs)——只在可見轉換 tick 蓋。
      //    穩態(已蓋戳)只做 Map.has 掃描,零配置(GC 紀律)。
      for (let i = 0; i < state.targets.length; i++) {
        const t = state.targets[i];
        if (t.visible && !state.tVisible.has(t.id)) {
          state.tVisible.set(t.id, nowMs);
        }
      }
      // ③ 移動目標 motion drive(WP-18 / T1):age 累加 TICK_SEC 常數 → 以純函式位移差就地更新
      //    pos——pos 為 tick 數的純函式(異 FPS 逐位一致),在命中判定之前(simStep 順序)。無 motion /
      //    static / waypoints 跳過(pos 逐位不變,既有 drill 零破壞)。z 恆不動(走廊縱深,GD-6)。
      for (let i = 0; i < state.targets.length; i++) {
        const t = state.targets[i];
        // 已觸發 target_stop 的目標保留 motion config 供資料/診斷讀取，但不再進 motion drive。
        if (state.tStop.has(t.id)) continue;
        const pendingStop = trackingStopMs !== undefined && t.fireLocked === true;
        if (!isDrivenMotion(t.motion)) {
          if (!pendingStop) continue;
          const nextAge = (t.age ?? 0) + TICK_SEC;
          t.age = nextAge;
          if (nextAge * 1000 >= trackingStopMs) {
            t.fireLocked = false;
            state.tStop.set(t.id, nowMs);
          }
          continue;
        }
        const prevAge = t.age ?? 0;
        const nextAge = prevAge + TICK_SEC;
        t.age = nextAge;
        // target_stop 是同一 tick 的原子事件：解鎖與 tStop 一起寫入，並從此不再 drive motion。
        if (pendingStop && nextAge * 1000 >= trackingStopMs) {
          t.fireLocked = false;
          state.tStop.set(t.id, nowMs);
          continue;
        }
        // 位移差 offset(age) − offset(age−TICK_SEC):等價 pos = spawn 原點 + offset(age) 的增量形式
        //（免存原點;offset(_,0)=0 → 首個 drive tick 由 spawn 位置起步)。
        motionOffset(t.motion, prevAge, offsetPrev);
        motionOffset(t.motion, nextAge, offsetCurr);
        t.pos.x += offsetCurr.x - offsetPrev.x;
        t.pos.y += offsetCurr.y - offsetPrev.y;
        t.pos.z += offsetCurr.z - offsetPrev.z;
      }
    },

    markKilled(state: SharedState, id: string): void {
      let removed = false;
      for (let i = 0; i < state.targets.length; i++) {
        if (state.targets[i].id === id) {
          state.targets.splice(i, 1);
          removed = true;
          break;
        }
      }
      // 只有真的撤除了目標才翻面(擊殺不存在 id 不推進序列)——確定性輪替 L↔R(FR-4.3),
      // 下一個可見 tick 於對側 spawn 並蓋新 t_visible。
      if (removed) {
        if (spiderShot !== undefined) {
          nextSpiderZone = nextSpiderZone === 'center' ? 'peripheral' : 'center';
        } else {
          nextSide = nextSide === 'R' ? 'L' : 'R';
        }
        // t_visible 隨目標撤除清掉;下次 spawn 為新 id、重新蓋戳(可見→不可見→再可見視為新目標)。
        state.tVisible.delete(id);
        state.tStop.delete(id);
      }
    },

    reset(state: SharedState, seq?: 'LR' | 'RL'): void {
      state.targets.length = 0;
      state.tVisible.clear();
      state.tStop.clear();
      state.cues.length = 0;
      nextId = 0;
      spawnedCount = 0;
      pendingSpawnAtMs = null;
      spawnRng = usesSeededSpawn
        ? createRan1(config!.sequence.seed!)
        : spiderShot !== undefined
          ? createRan1(spiderShot.seed)
          : undefined;
      // seq 顯式優先(既有 WP-4 呼叫);省略時退回 config 首側(或無 config 的預設 'R')。
      nextSide = seq ? (seq[0] as 'L' | 'R') : defaultFirstSide;
      nextSpiderZone = 'center';
      spiderZoneQueue = [];
      hitboxQueue = buildHitboxQueue();
    },
  };
}
