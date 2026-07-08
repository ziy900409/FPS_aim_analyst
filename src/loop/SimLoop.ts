import * as THREE from 'three/webgpu';
import { consume } from '../input/consume.ts';
import { pushImpact, type SharedState } from '../state/SharedState.ts';
import type { TargetManager } from '../sim/TargetManager.ts';
import { raycastWithRay, targetCenterOffsetDeg, type HitPointOut, type RaycastResult } from '../sim/HitDetector.ts';
import { punchToThreeRad } from '../recoil/adapter.ts';
import { currentPeekId, firstShotGate } from '../sim/firstShot.ts';
import { CS2_PROFILE, createMovementController, type MovementController } from '../sim/MovementController.ts';
import type { DrillRunner } from '../drill/DrillRunner.ts';
import type { InputEvent } from '../state/types.ts';
import type { DataRecorder } from '../data/DataRecorder.ts';
import type { WeaponConfig } from '../weapon/WeaponConfig.ts';
import { ak47 } from '../weapon/weapons.ts';
import { recoilOnFire, recoilTick } from '../recoil/punch.ts';
import { sampleSpread } from '../recoil/spread.ts';
import { generateRecoilTable, type RecoilTableEntry } from '../recoil/recoilTable.ts';
import { createRan1, type Rng } from '../recoil/rng.ts';
import type { Clock } from './clock.ts';

/**
 * spread RNG 預設種子（WP-13 / T1，OQ-13.1）：drill 未帶 `sequence.seed` 時的後援值。單一 seed
 * 同管 spawn 序列與 spread 圓盤取樣（決定性）；drill restart 重建 stream。具體值 + 每 run 記錄交
 * WP-16 寫入匯出 meta（研究可重現）。
 */
export const DEFAULT_RNG_SEED = 1;

/** 速度 gate / spread normalization 的 movement profile 單一來源。 */
const MOVEMENT_PROFILE = CS2_PROFILE;

/**
 * recoil 執行期依賴（WP-13 / T1）：由 `createSimLoop` 建一次並注入 `simStep`——`table` 為武器 recoil
 * 樣式表（`generateRecoilTable`，決定性），`rng` 為 spread 圓盤取樣的 seeded stream（閉包持有，
 * drill restart 由重建 loop 重置）。省略即不接 recoil（WP-2 決定性/單元測試向後相容路徑）。
 */
export interface RecoilRuntime {
  table: readonly RecoilTableEntry[];
  rng: Rng;
}

/**
 * SimLoop — WP-2 / T2（FR-2.2，§4.3 accumulator）
 *
 * 固定步長 accumulator：以注入式 clock 取時間基準，`pump(nowMs)` 累加 frame delta、每滿一個
 * TICK 跑一次 `simStep`，餘量夾住 0.25s 避免 spiral of death。與 render 解耦（render 在 T3 用
 * 回傳的 `alpha` 內插）。
 *
 * 決定性根源（ADR-3 / §6）：`simStep` **只**用固定 TICK 推進、**絕不**用 frame delta；一段
 * 邏輯時間內的 tick 數只由累積時間決定，與 render FPS 無關（T4 驗證）。
 */

/** app / 測試直呼 `simStep` 的預設 movement controller（無內部狀態，可安全共用）。 */
const defaultMovement = createMovementController();

/**
 * 輸入套用（handle）：鍵事件更新 A/D **held 狀態**（`MovementController.step` 每 tick 讀 held 積分
 * velocity + stopped gate）。fire down/up 只維護 `heldFire` 與首發排程時間；實際產彈由
 * `scheduleFire` 依 weapon cycletime 在 tick 內累加產生。mouse 事件仍忽略。
 *
 * 依時序、無遺漏的排序消費與排空責任已抽到 [`consume`](../input/consume.ts)（T4）；本函式只負責
 * 「每個到期事件如何改狀態」，不管排序/分桶/排空。
 */
function applyInput(
  state: SharedState,
  ev: InputEvent,
  recorder?: DataRecorder,
): void {
  if (ev.type === 'key') {
    if (ev.code === 'KeyD') {
      if (ev.down && !state.held.right && state.player.vx < 0) recorder?.recordEvent({ type: 'counter', key: 'D', t: ev.t });
      state.held.right = ev.down;
    } else if (ev.code === 'KeyA') {
      if (ev.down && !state.held.left && state.player.vx > 0) recorder?.recordEvent({ type: 'counter', key: 'A', t: ev.t });
      state.held.left = ev.down;
    }
  } else if (ev.type === 'fire') {
    const wasHeld = state.heldFire;
    state.heldFire = ev.down;
    if (ev.down && !wasHeld) state.weapon.nextFireT = ev.t;
    if (!ev.down) state.weapon.nextFireT = Infinity;
  }
}

// 彈道方向合成（WP-13 / T2）用的模組層級重用向量/quaternion（開火熱路徑零配置，GC 紀律 §4）。
// 旋轉軸與 CameraController 同慣例：yaw 繞 world +Y、pitch 繞 local +X、forward 為 −Z。
const BALLISTIC_WORLD_UP = new THREE.Vector3(0, 1, 0);
const BALLISTIC_LOCAL_RIGHT = new THREE.Vector3(1, 0, 0);
const BALLISTIC_FORWARD = new THREE.Vector3(0, 0, -1);
const ballisticYawQ = new THREE.Quaternion();
const ballisticPitchQ = new THREE.Quaternion();
const ballisticQ = new THREE.Quaternion();
const ballisticForward = new THREE.Vector3();
const ballisticRight = new THREE.Vector3();
const ballisticUp = new THREE.Vector3();
const ballisticOrigin = new THREE.Vector3();
const ballisticDir = new THREE.Vector3();
// 彈道命中點回填的重用欄位（WP-13 / T3）：命中時 raycastWithRay 就地寫入 world 座標，fireOneShot
// 據此寫入 `state.impacts`（彈孔）——開火熱路徑零配置（GC 紀律 §4）。
const ballisticHitPoint: HitPointOut = { valid: false, x: 0, y: 0, z: 0 };

/**
 * 彈道射線（WP-13 / T2，研究計畫 Phase 2「視覺 ≠ 實際」）：方向 = 使用者視角 `state.aim`
 * + **rawPunch = aimPunch×2**（實際彈道偏移為視覺 punch 兩倍，經 `adapter` 轉 three rad）
 * + spread 圓盤偏移（`recoil.lastSpread`，於本函式產彈點先取樣）。起點取 camera world 位置。
 *
 * 與視覺分離：camera 朝向（render 端）用 aimPunch×1，彈道用 rawPunch×2 + spread——故準心對準
 * 目標時實際彈著仍會上跳 + 右漂（QA「打不準」的設計來源，debug overlay 於 T3 可視化）。
 * 無 recoil（punch/spread 皆 0）時退化為 `state.aim` 中心射線（WP-2/WP-5 向後相容路徑）。
 */
function ballisticRaycast(camera: THREE.Camera, state: SharedState): RaycastResult {
  const punch = punchToThreeRad(
    state.recoilState.aimPunchPitchDeg * 2,
    state.recoilState.aimPunchYawDeg * 2,
  );
  const yaw = state.aim.yaw + punch.yawRad;
  const pitch = state.aim.pitch + punch.pitchRad;

  ballisticYawQ.setFromAxisAngle(BALLISTIC_WORLD_UP, yaw);
  ballisticPitchQ.setFromAxisAngle(BALLISTIC_LOCAL_RIGHT, pitch);
  ballisticQ.copy(ballisticYawQ).multiply(ballisticPitchQ);

  ballisticForward.copy(BALLISTIC_FORWARD).applyQuaternion(ballisticQ);
  ballisticRight.copy(BALLISTIC_LOCAL_RIGHT).applyQuaternion(ballisticQ);
  ballisticUp.copy(BALLISTIC_WORLD_UP).applyQuaternion(ballisticQ);

  // spread (x,y) 以 forward + x·right + y·up 疊加後正規化（契約 README §2；小角度近似切平面偏移）。
  ballisticDir
    .copy(ballisticForward)
    .addScaledVector(ballisticRight, state.recoil.lastSpread.x)
    .addScaledVector(ballisticUp, state.recoil.lastSpread.y)
    .normalize();

  camera.getWorldPosition(ballisticOrigin);
  // 命中點回填 `ballisticHitPoint`（重用；T3 彈孔來源），不改 RaycastResult 形狀。
  const result = raycastWithRay(ballisticOrigin, ballisticDir, state.targets, ballisticHitPoint);
  // WP-13 / T4：脫靶時把彈著投影到「交戰平面」（= active 目標所在 z 深度）。彈道漂移的壓槍 pattern
  // 因此以彈孔可視化（彈孔沿目標周圍 climb→之字 浮現）——解 T-exit 手動驗證②「見不到 pattern」:
  // 目標一發即死、牆面無 hitbox,原本脫靶不留痕。命中判定/擊殺仍只看 `result.hit`,脫靶不計 hit。
  if (!result.hit) projectMissOntoEngagementPlane(state);
  return result;
}

/**
 * 脫靶彈著投影（WP-13 / T4）：把彈道射線投影到「交戰平面」——第一個存活目標所在的 z 深度平面
 * （world 座標）。命中即寫 `ballisticHitPoint`（valid=true）供 `fireOneShot` 產彈孔;無存活目標
 * 或射線非朝該平面（`dir.z ≥ 0`）/ 平面在起點後方則維持 `valid=false`（`raycastWithRay` 已置）。
 * 複用 `ballisticRaycast` 已填的模組層級 `ballisticOrigin`/`ballisticDir`（零配置,GC 紀律 §4）。
 *
 * **GD-6（純裝飾場景）**:平面深度取自**目標**（sim 實體),**不讀** SceneManager 牆面幾何——故
 * 換裝飾場景時彈孔位置與決定性 baseline 皆不變（場景幾何不入 sim）。彈孔本即 render-only、不匯出。
 */
function projectMissOntoEngagementPlane(state: SharedState): void {
  let planeZ: number | undefined;
  for (let i = 0; i < state.targets.length; i++) {
    if (state.targets[i].alive) {
      planeZ = state.targets[i].pos.z;
      break;
    }
  }
  if (planeZ === undefined) return; // 無存活目標（drill 收尾）→ 不產彈孔
  const dz = ballisticDir.z;
  if (dz >= -1e-6) return; // 射線幾乎平行/背向交戰平面 → 不投影
  const t = (planeZ - ballisticOrigin.z) / dz;
  if (t <= 0) return; // 平面在射線起點後方 → 不投影
  ballisticHitPoint.valid = true;
  ballisticHitPoint.x = ballisticOrigin.x + ballisticDir.x * t;
  ballisticHitPoint.y = ballisticOrigin.y + ballisticDir.y * t;
  ballisticHitPoint.z = planeZ;
}

function fireOneShot(
  state: SharedState,
  t: number,
  camera?: THREE.Camera,
  targetManager?: TargetManager,
  recorder?: DataRecorder,
  weapon?: WeaponConfig,
  recoilRuntime?: RecoilRuntime,
): void {
  // 開火：首發旗標**先於命中判定**——peek 錨為 fire 當下的 active 目標；命中即擊殺會撤除該目標、
  // 換 peek，故 firstShot 須在 markKilled 之前對「當前 peek」判定（FR-5.2，OQ-5.3）。未命中亦計首發
  // （P2：未命中可補槍，首發＝peek 內第一個 fire，無論中否）。
  let firstShot = false;
  let hit = false;
  let part: 'head' | 'body' | undefined;
  let targetId: string | undefined;
  let offsetDeg: number | undefined;

  const residualSpeed = Math.abs(state.player.vx);
  // Velocity gate（WP-14 / T2，FR-B12）：**在命中判定與 markKilled 之前**讀 fire 當下速度
  // （＝上一 tick movement.step 所定，本 tick movement.step 尚未跑）。`stopped` 只是 HUD/相容欄位；
  // 產彈點直接以同一 profile threshold 判定，避免 stale stopped flag 污染開火精準度。
  const accurate = residualSpeed < MOVEMENT_PROFILE.accuracyThreshold;

  // WP-13 / T2：**先** sampleSpread（用本發 kick 之前的 inaccuracy，對齊 CS2；序列位置決定性），把圓盤
  // 偏移暫存供本發彈道射線消費——次序 = sampleSpread → 彈道 raycast → recoilOnFire（本發沿 kick 前
  // 朝向出膛，kick 影響後續發與視覺 punch）。無 recoilRuntime 時 lastSpread 維持 0（向後相容）。
  if (recoilRuntime !== undefined && weapon !== undefined) {
    const speedRatio = Math.min(1, residualSpeed / MOVEMENT_PROFILE.maxSpeed);
    const spread = sampleSpread(state.recoilState, weapon, speedRatio, recoilRuntime.rng);
    state.recoil.lastSpread.x = spread.x;
    state.recoil.lastSpread.y = spread.y;
  }

  // 彈道射線（viewAngles + rawPunch×2 + spread）→ 命中 → 第一次命中即擊殺（FR-5.1，OQ-5.4）。
  if (camera !== undefined && targetManager !== undefined) {
    const peekId = currentPeekId(state);
    targetId = peekId;
    firstShot = peekId !== undefined ? firstShotGate(state, peekId) : false;
    if (peekId !== undefined) {
      const target = state.targets.find((candidate) => candidate.id === peekId);
      if (target !== undefined) offsetDeg = targetCenterOffsetDeg(camera, target);
    }
    const result = ballisticRaycast(camera, state);
    hit = accurate && result.hit;
    part = hit ? result.part : undefined;
    if (result.targetId !== undefined) targetId = result.targetId;
    if (hit && result.targetId !== undefined) targetManager.markKilled(state, result.targetId);
    // WP-13 / T3+T4：命中（目標近面）或脫靶（交戰平面投影,T4）皆寫彈孔（world 座標,render
    // `ImpactView` 唯讀繪製）；環狀覆寫最舊。脫靶彈孔使壓槍漂移 pattern 可視化;`ballisticHitPoint`
    // 由 `ballisticRaycast` 統一回填（命中→目標近面;脫靶→交戰平面;無存活目標→valid=false 不產）。
    if (ballisticHitPoint.valid) {
      pushImpact(state.impacts, ballisticHitPoint.x, ballisticHitPoint.y, ballisticHitPoint.z);
    }
  }

  // fire 結果事件（含 firstShot / accurate / residualSpeed）產出 → WP-7 記錄 / WP-8 統計；
  // t 使用排程時刻而非 input event 時刻，WP-16 schema v2 需對帳此欄位語意。
  recorder?.recordEvent({
    type: 'fire',
    t,
    hit,
    firstShot,
    residualSpeed,
    viewYaw: state.aim.yaw,
    viewPitch: state.aim.pitch,
    aimPunchPitch: state.recoilState.aimPunchPitchDeg,
    aimPunchYaw: state.recoilState.aimPunchYawDeg,
    spreadX: state.recoil.lastSpread.x,
    spreadY: state.recoil.lastSpread.y,
    recoilIndex: state.recoilState.recoilIndex,
    ammo: state.weapon.ammo,
    ...(targetId !== undefined ? { targetId } : {}),
    ...(offsetDeg !== undefined ? { offsetDeg } : {}),
    ...(part !== undefined ? { part } : {}),
  });

  // WP-13 / T2：施加本發 recoil kick（於彈道判定之後）——影響後續發的 rawPunch 與視覺 punch，
  // 本發已沿 kick 前朝向出膛。無 recoilRuntime 時不接（WP-2 決定性/單元測試向後相容，punch 恆零）。
  if (recoilRuntime !== undefined && weapon !== undefined) {
    recoilOnFire(state.recoilState, weapon, recoilRuntime.table);
  }
}

function scheduleFire(
  state: SharedState,
  untilMs: number,
  weapon: WeaponConfig,
  camera?: THREE.Camera,
  targetManager?: TargetManager,
  recorder?: DataRecorder,
  recoilRuntime?: RecoilRuntime,
): void {
  const cycleMs = weapon.cycletimeSec * 1000;
  while (state.heldFire && state.weapon.ammo > 0 && state.weapon.nextFireT <= untilMs) {
    fireOneShot(state, state.weapon.nextFireT, camera, targetManager, recorder, weapon, recoilRuntime);
    state.weapon.ammo--;
    state.weapon.nextFireT += cycleMs;
  }
  if (state.heldFire && state.weapon.ammo <= 0) {
    state.heldFire = false;
    state.weapon.nextFireT = Infinity;
  }
}

function recordVisibleEvents(state: SharedState, t: number, recorder?: DataRecorder): void {
  if (recorder === undefined) return;
  for (let i = 0; i < state.targets.length; i++) {
    const target = state.targets[i];
    if (target.visible && state.tVisible.get(target.id) === t) {
      recorder.recordEvent({ type: 'visible', targetId: target.id, side: target.side, t });
    }
  }
}

/**
 * 推進一個固定 tick（純函式邊界，OQ-2.4：只讀寫傳入 state、不讀 `performance.now()`、不碰 DOM；
 * 預留階段 B Worker 搬遷）。`tickEndMs` = 本 tick 邏輯窗結束時間（量測時鐘域 ms），供輸入分桶。
 *
 * 順序（對齊 CONTEXT「simStep 順序」雛形 + WP-13 recoil）：① prev←curr（含 recoil 視覺快照，內插
 * 基準，T3/T2）；② 目標系統（spawn/可見性/蓋 t_visible，**命中判定之前**，F5 seam / WP-5，WP-4）；
 * ③ recoil 衰減（偶數 tick 64Hz 子節奏，dtSec 恆 1/64；**decay 先於本 tick 產彈 kick**，WP-13 T1）；
 * ④ 依時序消費本 tick 輸入（`consume` 排序 + 排空，T4；鍵事件更新 held、fire 更新 scheduler state）；
 * ⑤ weapon cycletime scheduler 產彈（產彈點注入 spread 取樣 + recoil kick，WP-13 T1）；
 * ⑥ `MovementController.step` 依 held 積分 velocity 並推進位置（**只用 dtSec**，WP-14 T1）；
 * ⑦ curr←新位置（含 recoil.curr←aimPunch 視覺快照）。
 *
 * `tickIndex`（`createSimLoop` 維護）決定 recoil 64Hz 子節奏（偶數跑 decay）；`recoilRuntime` 省略
 * 即不接 recoil（WP-2 決定性/單元測試向後相容，punch 恆零）。
 *
 * `targetManager` 選填：注入即在 tick 內推進目標（WP-4）；省略則維持純位移（WP-2 決定性測試路徑）。
 * `camera` 選填：注入即在產彈點處理命中判定（WP-5 T1）；省略則 fire 只記錄 miss（決定性測試路徑）。
 * `movement` 預設共用 `defaultMovement`；`createSimLoop` 綁定自己的實例（WP-6 vStrafe config seam）。
 * `drillRunner` 選填（WP-6 / T4）：注入即由 runner 在 running 相位驅動目標（countdown/idle/ended
 * 不 spawn）——**取代**本函式直呼 `targetManager.tick`（避免雙重 tick）；省略則沿用 WP-4 直驅路徑。
 * 注意：fire→markKilled 仍走 `targetManager`（同一實例），故 `targetManager` 與 `drillRunner` 併傳。
 */
export function simStep(
  state: SharedState,
  dtSec: number,
  tickEndMs: number,
  targetManager?: TargetManager,
  camera?: THREE.Camera,
  movement: MovementController = defaultMovement,
  handle?: (ev: InputEvent) => void,
  drillRunner?: DrillRunner,
  recorder?: DataRecorder,
  weapon: WeaponConfig = ak47,
  tickIndex = 0,
  recoilRuntime?: RecoilRuntime,
): void {
  state.prev.x = state.curr.x;
  state.prev.z = state.curr.z;
  // recoil 視覺快照 prev←curr（比照 position；render 以 alpha 在 prev→curr 間 lerp aimPunch，T2）。
  state.recoil.prev.pitchDeg = state.recoil.curr.pitchDeg;
  state.recoil.prev.yawDeg = state.recoil.curr.yawDeg;

  // 目標 spawn/可見性/蓋 t_visible：在命中判定（WP-5 fire raycast）之前，且時間源為 sim tick
  // 的 `tickEndMs`（量測時鐘域，非 rAF/Date.now）——反應時間效度關鍵（README failure-mode）。
  // WP-6 / T4：有 drillRunner 則由其相位機驅動目標（running 才 spawn）；否則 WP-4 直驅（向後相容）。
  if (drillRunner !== undefined) drillRunner.tick(state, tickEndMs);
  else targetManager?.tick(state, tickEndMs);
  recordVisibleEvents(state, tickEndMs, recorder);

  // recoil 衰減（WP-13 / T1）：64Hz 子節奏 = 偶數 tick（128Hz sim）；dtSec **恆常數 1/64**（GD-5，
  // 不代入 sim dtSec）。位置在目標系統與 consume 之間 → 本 tick decay 先於本 tick 產彈 kick（README
  // §2.4 契約：decay 先於 kick）。`recoilRuntime` 省略即不接（WP-2 決定性測試向後相容）。
  if (recoilRuntime !== undefined && (tickIndex & 1) === 0) recoilTick(state.recoilState, 1 / 64);

  // 半開窗 [tickStart, tickEndMs)、嚴格 `<`（GD-3）。每個事件前先補發上一段已到期子彈；
  // fire-down 套用後立即跑到該事件時間，鎖定 down→up 同 tick 仍至少產 1 發（OQ-11.1）。
  const apply = handle ?? ((ev: InputEvent) => applyInput(state, ev, recorder));
  consume(state, tickEndMs, (ev) => {
    scheduleFire(state, ev.t, weapon, camera, targetManager, recorder, recoilRuntime);
    apply(ev);
    scheduleFire(state, ev.t, weapon, camera, targetManager, recorder, recoilRuntime);
  });
  scheduleFire(state, tickEndMs, weapon, camera, targetManager, recorder, recoilRuntime);

  // MovementController：依 held 以 friction/accelerate 積分 vx，並以固定 dtSec 推進 x（WP-14 T1）。
  movement.step(state, dtSec);
  state.player.z += state.player.vz * dtSec; // z 軸階段 A 無前後移動（vz 恆 0）；沿用 WP-2 位移

  state.curr.x = state.player.x;
  state.curr.z = state.player.z;
  // recoil 視覺快照 curr←本 tick 末 aimPunch（deg，1× 視覺；彈道用 rawPunch=aimPunch×2，T2）。
  state.recoil.curr.pitchDeg = state.recoilState.aimPunchPitchDeg;
  state.recoil.curr.yawDeg = state.recoilState.aimPunchYawDeg;

  recorder?.recordTickFromState(tickEndMs, state);
}

export interface SimLoop {
  /** 餵入當前時間（ms，量測時鐘域）；推進 0+ 個固定 tick，回傳本幀 tick 數與 alpha 內插係數 [0,1)。 */
  pump(nowMs: number): { ticks: number; alpha: number };
}

export interface SimLoopOptions {
  /** 每個 sim tick 完成後的純觀測 hook；不得 clamp 或改寫演進來源。 */
  afterTick?: (state: SharedState, tickEndMs: number, tickIndex: number) => void;
}

/**
 * 建 accumulator sim loop。`clock` 僅用於取時間基準（`pump` 的 nowMs 才是每幀驅動源），
 * `simHz` 注入使 tick rate 可調（ADR-3）。
 */
export function createSimLoop(
  state: SharedState,
  clock: Clock,
  simHz: number,
  targetManager?: TargetManager,
  camera?: THREE.Camera,
  drillRunner?: DrillRunner,
  recorder?: DataRecorder,
  weapon: WeaponConfig = ak47,
  seedOrOptions: number | SimLoopOptions = DEFAULT_RNG_SEED,
  options?: SimLoopOptions,
): SimLoop {
  const seed = typeof seedOrOptions === 'number' ? seedOrOptions : DEFAULT_RNG_SEED;
  const loopOptions = typeof seedOrOptions === 'number' ? options : seedOrOptions;
  state.weapon.nextFireT = Infinity;
  state.weapon.magSize = weapon.magSize;
  state.weapon.ammo = weapon.magSize;
  const tickSec = 1 / simHz;
  const tickMs = 1000 / simHz;
  let accSec = 0;
  let lastMs = clock.now();
  let simTimeMs = lastMs; // 邏輯 sim 時鐘（量測時鐘域 ms），每 tick 推進 tickMs；決定 tick 窗

  // 綁定一次的輸入 handle：閉包 over state，避免每 tick 配置 applyInput arrow（GC 紀律 §4）。
  const handleInput = (ev: InputEvent): void => applyInput(state, ev, recorder);

  // 綁定一次的 MovementController（WP-14 T1）：profile 預設 CS2_PROFILE。
  const movement = createMovementController();

  // recoil 執行期依賴（WP-13 / T1）：樣式表由武器 recoil 參數一次生成（決定性）；spread rng 由 seed
  // 建 seeded stream（`drill.sequence.seed ?? DEFAULT_RNG_SEED`，OQ-13.1）。restart 走重建 loop 重置
  // stream；seed 值交 WP-16 記入 meta。`tickIndex` 驅動 64Hz 子節奏（偶數 tick 跑 recoil decay）。
  const recoilRuntime: RecoilRuntime = { table: generateRecoilTable(weapon.recoil), rng: createRan1(seed) };
  let tickIndex = 0;

  return {
    pump(nowMs: number): { ticks: number; alpha: number } {
      accSec += Math.min((nowMs - lastMs) / 1000, 0.25); // 夾住避免 spiral of death
      lastMs = nowMs;

      let ticks = 0;
      while (accSec >= tickSec) {
        simTimeMs += tickMs;
        simStep(state, tickSec, simTimeMs, targetManager, camera, movement, handleInput, drillRunner, recorder, weapon, tickIndex, recoilRuntime);
        loopOptions?.afterTick?.(state, simTimeMs, tickIndex);
        accSec -= tickSec;
        ticks++;
        tickIndex++;
      }

      return { ticks, alpha: accSec / tickSec };
    },
  };
}
