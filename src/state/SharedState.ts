import type {
  InputEventView,
  InputMeta,
  InputRing,
  PlayerSnapshot,
  TargetState,
} from './types.ts';
import { CODE_KEY, EV_ADS, EV_FIRE, EV_KEY, EV_MOUSE, RING_CAPACITY } from './types.ts';
import { ak47 } from '../weapon/weapons.ts';
import { createRecoilState, resetRecoilState, type RecoilState } from '../recoil/punch.ts';

/**
 * 彈孔環形格容量（WP-13 / T3）：preallocated 固定格，滿即環狀覆寫最舊。階段 A 場景彈孔為即時
 * 視覺回饋（非研究資料），64 足供連發 pattern 目視；超出以最舊覆寫（不成長、不 realloc）。
 */
export const IMPACT_CAP = 64;

/**
 * 子彈軌跡環形格容量（WP-25 / T1）：render-only tracer 視覺資料，固定格滿即覆寫最舊。
 * 64 對齊彈著格容量，足供連發目視且不成長、不 realloc。
 */
export const TRACER_CAP = 64;

/**
 * 飛行彈 arena 容量（WP-25 / T3）：預設 AK 彈匣 30 × 2 = 60，一匣連發加飛行殘留裕度。
 * 滿載時拒發並升 `overflowCount`，不成長、不 realloc。
 */
export const BULLET_CAP = ak47.magSize * 2;

/**
 * 彈著點環形格（WP-13 / T3）：sim 命中時 `pushImpact` 寫入 world 座標、render（`ImpactView`）唯讀
 * ——雙迴圈邊界（ADR-2）。並行 `Float64Array`（x/y/z/seq）+ 寫入游標 `cursor`，**熱路徑零配置**
 * （CLAUDE.md §4）。`seq[i]` = 該槽的單調寫入序號（1 起；0 = 空槽），供 render 端偵測新彈著做增量同步；
 * `total` = 累計寫入數（render 端比對是否有新彈著）。
 */
export interface ImpactRing {
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly z: Float64Array;
  readonly seq: Float64Array;
  /** 累計寫入彈著總數（單調遞增；render 端據此偵測新彈著）。 */
  total: number;
  /** 下一寫入槽位 [0, IMPACT_CAP)。 */
  cursor: number;
}

/**
 * 子彈軌跡環形格（WP-25 / T1）：sim 產彈點寫 origin→endpoint，render（`TracerView`）唯讀。
 * 並行 typed-array 欄位 + 單調 seq 完全比照 `ImpactRing`，確保熱路徑零配置。
 */
export interface ShotRayRing {
  readonly ox: Float64Array;
  readonly oy: Float64Array;
  readonly oz: Float64Array;
  readonly ex: Float64Array;
  readonly ey: Float64Array;
  readonly ez: Float64Array;
  readonly seq: Float64Array;
  /** 累計寫入軌跡總數（單調遞增；render 端據此偵測新軌跡）。 */
  total: number;
  /** 下一寫入槽位 [0, TRACER_CAP)。 */
  cursor: number;
}

/**
 * 飛行彈 arena（WP-25 / T3）：欄位式 typed arrays，sim tick 熱路徑只覆寫槽位。
 * `alive[i]` = 1 表示活彈；`accurate[i]` 保存 fire 時 velocity gate 結果，命中時才消費。
 */
export interface BulletArena {
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly z: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly vz: Float64Array;
  readonly ox: Float64Array;
  readonly oy: Float64Array;
  readonly oz: Float64Array;
  /** Fire-time muzzle world position; render-only tracer origin, never a physics baseline. */
  readonly mx: Float64Array;
  readonly my: Float64Array;
  readonly mz: Float64Array;
  readonly spawnT: Float64Array;
  readonly shotSeq: Float64Array;
  readonly accurate: Uint8Array;
  readonly alive: Uint8Array;
  activeCount: number;
  overflowCount: number;
  nextShotSeq: number;
}

/** 建一份全空的彈著環形格（預配置 typed-array，不再 realloc）。 */
export function createImpactRing(): ImpactRing {
  return {
    x: new Float64Array(IMPACT_CAP),
    y: new Float64Array(IMPACT_CAP),
    z: new Float64Array(IMPACT_CAP),
    seq: new Float64Array(IMPACT_CAP),
    total: 0,
    cursor: 0,
  };
}

/** 建一份全空的子彈軌跡環形格（預配置 typed-array，不再 realloc）。 */
export function createShotRayRing(): ShotRayRing {
  return {
    ox: new Float64Array(TRACER_CAP),
    oy: new Float64Array(TRACER_CAP),
    oz: new Float64Array(TRACER_CAP),
    ex: new Float64Array(TRACER_CAP),
    ey: new Float64Array(TRACER_CAP),
    ez: new Float64Array(TRACER_CAP),
    seq: new Float64Array(TRACER_CAP),
    total: 0,
    cursor: 0,
  };
}

/** 建一份全空的飛行彈 arena（預配置 typed-array，不再 realloc）。 */
export function createBulletArena(): BulletArena {
  return {
    x: new Float64Array(BULLET_CAP),
    y: new Float64Array(BULLET_CAP),
    z: new Float64Array(BULLET_CAP),
    vx: new Float64Array(BULLET_CAP),
    vy: new Float64Array(BULLET_CAP),
    vz: new Float64Array(BULLET_CAP),
    ox: new Float64Array(BULLET_CAP),
    oy: new Float64Array(BULLET_CAP),
    oz: new Float64Array(BULLET_CAP),
    mx: new Float64Array(BULLET_CAP),
    my: new Float64Array(BULLET_CAP),
    mz: new Float64Array(BULLET_CAP),
    spawnT: new Float64Array(BULLET_CAP),
    shotSeq: new Float64Array(BULLET_CAP),
    accurate: new Uint8Array(BULLET_CAP),
    alive: new Uint8Array(BULLET_CAP),
    activeCount: 0,
    overflowCount: 0,
    nextShotSeq: 1,
  };
}

/**
 * 環狀寫入一個彈著點（覆寫最舊）：就地寫 x/y/z、蓋單調序號、推進游標——熱路徑零配置（GC 紀律）。
 * seq 從 1 起（0 保留為「空槽」哨兵），覆寫最舊時舊槽獲得更大 seq，render 端據此判定為新彈著。
 */
export function pushImpact(ring: ImpactRing, x: number, y: number, z: number): void {
  const i = ring.cursor;
  ring.x[i] = x;
  ring.y[i] = y;
  ring.z[i] = z;
  ring.total += 1;
  ring.seq[i] = ring.total; // 單調序號（1 起）；render 端偵測 seq 變化做增量同步
  ring.cursor = (i + 1) % IMPACT_CAP;
}

/** 環狀寫入一條子彈軌跡（origin→endpoint），覆寫最舊槽並蓋單調 seq。 */
export function pushShotRay(
  ring: ShotRayRing,
  ox: number,
  oy: number,
  oz: number,
  ex: number,
  ey: number,
  ez: number,
): void {
  const i = ring.cursor;
  ring.ox[i] = ox;
  ring.oy[i] = oy;
  ring.oz[i] = oz;
  ring.ex[i] = ex;
  ring.ey[i] = ey;
  ring.ez[i] = ez;
  ring.total += 1;
  ring.seq[i] = ring.total;
  ring.cursor = (i + 1) % TRACER_CAP;
}

/** 原地清空彈著格（重開 drill / reset）：seq 歸零使所有槽視為空、游標歸零；typed-array 不 realloc（GC 紀律）。 */
export function resetImpactRing(ring: ImpactRing): void {
  ring.seq.fill(0); // seq=0 → 空槽哨兵（render 端不繪；x/y/z 殘值待覆寫，免額外清）
  ring.total = 0;
  ring.cursor = 0;
}

/** 原地清空子彈軌跡格；typed-array 不 realloc，端點殘值待下次覆寫。 */
export function resetShotRayRing(ring: ShotRayRing): void {
  ring.seq.fill(0);
  ring.total = 0;
  ring.cursor = 0;
}

/** 原地清空飛行彈 arena；typed-array 殘值待下次覆寫。 */
export function resetBulletArena(arena: BulletArena): void {
  arena.alive.fill(0);
  arena.activeCount = 0;
  arena.overflowCount = 0;
  arena.nextShotSeq = 1;
}

/**
 * SharedState — WP-2 / T1（FR-2.1）
 *
 * 三迴圈（input / sim / render）的**唯一**溝通管道（ADR-2）：input 寫入緩衝、sim 消費並
 * 推進 player/targets、render 唯讀 prev/curr 做內插。三者互不直接呼叫。
 *
 * GC 紀律（CLAUDE.md §4）：輸入緩衝 = 固定欄位真 ring（見 `createInputRing`）；position/velocity 用
 * plain number 欄位、不在熱路徑配置 vector；`resetState` **原地**清空、重用既有物件/陣列，不 realloc。
 */
export interface SharedState {
  /** 輸入緩衝：固定欄位 ring buffer（真環狀、靜態容量、消費後槽位重用；CLAUDE.md §4 / OQ-3.2）。 */
  input: InputRing;
  /** 輸入消費 metadata（T4/T4b）：遲到事件計數 + consume 低水位游標 + ring 溢位計數。 */
  inputMeta: InputMeta;
  /**
   * 玩家即時狀態，由 simStep 推進（u / u·s⁻¹，canonical unit）。
   * `stopped`（WP-14 / T1，FR-B12 接縫）= 速度 gate 相容欄位：`MovementController.step`
   * 在 `|vx| < MovementProfile.accuracyThreshold` 時置 true。開火精準 gate（WP-14 / T2）直接讀同源
   * threshold 與即時 `|vx|`，此欄保留給 HUD / 相容觀察，不作為產彈點的權威來源。
   */
  player: { vx: number; vz: number; x: number; z: number; stopped: boolean };
  /**
   * A/D 橫移按住狀態（WP-5 / T3，FR-5.3）：`consume` 依 keydown/keyup 事件更新，
   * `MovementController.step` 每 tick 讀取以積分 velocity（`left`=KeyA、`right`=KeyD）。
   * 為 held 而非 velocity，friction/accelerate integrator 需 per-tick held 狀態。
   */
  held: { left: boolean; right: boolean };
  /** 左鍵開火按住狀態（WP-11 / T2）：由 fire down/up 輸入事件依時序更新，T3 scheduler 讀取。 */
  heldFire: boolean;
  /**
   * 右鍵 ADS 開鏡按住狀態（WP-24 / T1，FR-E4）：由 ads down/up 輸入事件依時序更新（比照 heldFire）。
   * render 端（T2）據此切換 camera FOV 目標值與滑鼠 gain；資料端（T3）逐 tick 記錄為 `ads` flag。
   * **不進 sim 演進/命中幾何**（GD-16 硬約束）：僅 input/render/data 層可讀。
   */
  heldAds: boolean;
  /** 當前武器開火排程狀態（WP-11 / T3）：下一發排程時間 + 當前/最大彈匣。 */
  weapon: { nextFireT: number; ammo: number; magSize: number };
  /**
   * recoil 狀態機（WP-13 / T1）：sim 專屬（punch/velocity/inaccuracy/recoilIndex，`src/recoil`
   * 數學核心）。偶數 tick 以 64Hz 子節奏衰減、產彈點 `recoilOnFire` 施加 kick；`resetState` 呼叫
   * `resetRecoilState` 原地歸零（GC 紀律）。
   */
  recoilState: RecoilState;
  /**
   * recoil 視覺內插快照（WP-13 / T1，比照 position `prev`/`curr`）：sim 每 tick 寫 `prev←curr`
   * 於步①、`curr←aimPunch(deg)` 於步⑥，render 以 alpha lerp → `setViewPunch`（T2）。punch 為
   * **視覺** aimPunch（1×，deg）；彈道用 rawPunch=aimPunch×2（T2）。`lastSpread` = 最近一發於產彈
   * 點取樣的圓盤偏移（source rng 序列位置決定性），T2 消費為彈道射線偏移，T1 只暫存不用於命中。
   */
  recoil: {
    prev: { pitchDeg: number; yawDeg: number };
    curr: { pitchDeg: number; yawDeg: number };
    lastSpread: { x: number; y: number };
  };
  /**
   * 彈著點環形格（WP-13 / T3）：sim 命中時寫入 world 座標、render（`ImpactView`）唯讀繪彈孔
   * （雙迴圈邊界）。固定容量 `IMPACT_CAP`，滿即環狀覆寫最舊；熱路徑零配置（見 `ImpactRing`）。
   */
  impacts: ImpactRing;
  /**
   * 子彈軌跡環形格（WP-25 / T1）：sim 產彈點寫 origin→endpoint，render 唯讀繪 tracer。
   * 不參與命中/資料匯出，固定容量 `TRACER_CAP`，滿即環狀覆寫最舊。
   */
  shotRays: ShotRayRing;
  /**
   * 飛行彈 arena（WP-25 / T3）：`WeaponConfig.bullet` 存在時才由 SimLoop 使用；hitscan 路徑不讀。
   */
  bullets: BulletArena;
  /** 內插用雙快照：sim 每 tick 末更新，render 以 alpha 在 prev→curr 間 lerp（T3）。 */
  prev: PlayerSnapshot;
  curr: PlayerSnapshot;
  /** 準心 overlay 偏移；階段 A 固定中心，保留給 UI，不作為 WP-8 對齊偏移資料來源。 */
  crosshair: { cx: number; cy: number };
  /** CameraController 寫入的 camera 朝向（radians）；WP-8 tick-level aim 軌跡來源。 */
  aim: { yaw: number; pitch: number };
  /** 目標清單（WP-4 寫入；先空）。 */
  targets: TargetState[];
  /** 各目標可見瞬間的 `performance.now()` 時間戳（量測時鐘域，WP-4 寫入；先空）。 */
  tVisible: Map<string, number>;
  /** 各目標 target_stop 的 sim-clock 時間戳；目標撤除或 reset 時同步清除。 */
  tStop: Map<string, number>;
  /** runtime validity observations;純觀測旗標，不 clamp、不改 sim 演進。 */
  validity: { playerCorridorExceeded: boolean };
  /**
   * 首發旗標記憶（WP-5 / T2，FR-5.2）：已計首發的 peekId（= active 目標 id）。`firstShotGate`
   * 每 peek 只放行第一發；新 peek（唯一新 id）隱式 reset。初始 `null`（首發尚未計）。
   */
  firstShotPeekId: string | null;
}

/**
 * 建固定欄位輸入 ring（[`InputRing`](./types.ts)）。並行 typed-array 槽位 `type,t,a,b`、`head`/`count`
 * 游標繞圈（`& MASK`，`RING_CAPACITY` 為 2 的冪）、槽位重用、**熱路徑不配置物件**（CLAUDE.md §4）。
 *
 * 寫入端 **bounded insertion 保序**（D-3b）：append 到 tail 後，若 `t` 小於前一槽（罕見亂序）就地
 * 往 head 方向前移交換，直到升冪或抵 head——`event.timeStamp` 近單調故近 O(1)。使 `consume` 只需從
 * head 排空、免每 tick 排序 scratch。溢位（GD-2）：滿則 `push*` 回 `false`（拒收、不覆寫最舊槽）。
 */
export function createInputRing(): InputRing {
  const MASK = RING_CAPACITY - 1; // RING_CAPACITY 為 2 的冪 → 繞圈用位遮罩
  const typeArr = new Uint8Array(RING_CAPACITY); // packed: 事件 type 碼（EV_KEY/EV_MOUSE/EV_FIRE/EV_ADS）
  const tArr = new Float64Array(RING_CAPACITY); //  packed: 時間戳（量測時鐘域，float 精確）
  const aArr = new Float64Array(RING_CAPACITY); //  packed a: key→code enum / mouse→dx
  const bArr = new Float64Array(RING_CAPACITY); //  packed b: key→down(0/1) / mouse→dy
  let head = 0; //  最舊未消費槽位的物理索引
  let count = 0; // 未消費事件數（tail 物理索引 = (head + count) & MASK）

  /** 交換兩物理槽位的全部欄位（bounded insertion 前移用）。 */
  function swap(i: number, j: number): void {
    const ty = typeArr[i]; typeArr[i] = typeArr[j]; typeArr[j] = ty;
    const t = tArr[i]; tArr[i] = tArr[j]; tArr[j] = t;
    const a = aArr[i]; aArr[i] = aArr[j]; aArr[j] = a;
    const b = bArr[i]; bArr[i] = bArr[j]; bArr[j] = b;
  }

  /**
   * append 一槽 + bounded insertion 保序。滿（count === CAPACITY）回 `false`（拒收、不丟最舊）。
   * 新槽落 tail，若 `t` < 前一槽則就地往 head 方向交換前移，直到升冪或抵 head。
   */
  function enqueue(type: number, t: number, a: number, b: number): boolean {
    if (count === RING_CAPACITY) return false; // 滿：溢位由呼叫端計 bufferOverflow（GD-2）
    let cur = (head + count) & MASK; // tail 物理索引
    typeArr[cur] = type;
    tArr[cur] = t;
    aArr[cur] = a;
    bArr[cur] = b;
    count++;
    while (cur !== head) {
      const prev = (cur - 1) & MASK;
      if (tArr[cur] < tArr[prev]) {
        swap(cur, prev); // 罕見亂序：前移至升冪位（stable：相等不換 → 保到達順序）
        cur = prev;
      } else break;
    }
    return true;
  }

  return {
    size: () => count,
    isEmpty: () => count === 0,
    peekT: () => tArr[head], // 呼叫端須先 isEmpty() 判定；空時值無意義
    pushKey: (codeInt, down, t) => enqueue(EV_KEY, t, codeInt, down ? 1 : 0),
    pushMouse: (dx, dy, t) => enqueue(EV_MOUSE, t, dx, dy),
    pushFire: (down, t) => enqueue(EV_FIRE, t, 0, down ? 1 : 0),
    pushAds: (down, t) => enqueue(EV_ADS, t, 0, down ? 1 : 0), // WP-24 / T1：比照 fire（a=0、b=down）
    dequeueInto(view: InputEventView): void {
      if (count === 0) return; // 空防呆：勿讀殘值/推進 head/使 count 變負（呼叫端仍應先 isEmpty()）
      const i = head;
      const ty = typeArr[i];
      view.t = tArr[i];
      if (ty === EV_KEY) {
        view.type = 'key';
        view.code = CODE_KEY[aArr[i]];
        view.down = bArr[i] === 1;
      } else if (ty === EV_MOUSE) {
        view.type = 'mouse';
        view.dx = aArr[i];
        view.dy = bArr[i];
      } else if (ty === EV_FIRE) {
        view.type = 'fire';
        view.down = bArr[i] === 1;
      } else {
        view.type = 'ads'; // EV_ADS（WP-24 / T1）：b=down，比照 fire
        view.down = bArr[i] === 1;
      }
      head = (head + 1) & MASK; // 推進 head、槽位留待繞圈重用（不清值）
      count--;
    },
    clear(): void {
      head = 0;
      count = 0; // 原地歸零游標；typed-array 不 realloc、殘值待覆寫（GC 紀律）
    },
  };
}

/** 建一份全零的獨立 SharedState。app 用下方單例；測試（T4 決定性）以此取獨立實例比對不同 FPS。 */
export function createSharedState(): SharedState {
  return {
    input: createInputRing(),
    inputMeta: { lateEventCount: 0, lastConsumedT: -Infinity, bufferOverflow: 0 },
    player: { vx: 0, vz: 0, x: 0, z: 0, stopped: false },
    held: { left: false, right: false },
    heldFire: false,
    heldAds: false,
    weapon: { nextFireT: Infinity, ammo: ak47.magSize, magSize: ak47.magSize },
    recoilState: createRecoilState(),
    recoil: {
      prev: { pitchDeg: 0, yawDeg: 0 },
      curr: { pitchDeg: 0, yawDeg: 0 },
      lastSpread: { x: 0, y: 0 },
    },
    impacts: createImpactRing(),
    shotRays: createShotRayRing(),
    bullets: createBulletArena(),
    prev: { x: 0, z: 0 },
    curr: { x: 0, z: 0 },
    crosshair: { cx: 0, cy: 0 },
    aim: { yaw: 0, pitch: 0 },
    targets: [],
    tVisible: new Map(),
    tStop: new Map(),
    validity: { playerCorridorExceeded: false },
    firstShotPeekId: null,
  };
}

/** 應用程式單例：三迴圈唯一溝通管道。 */
export const sharedState: SharedState = createSharedState();

/**
 * 原地重置（測試 / 重開 drill）。清空緩衝、歸零 player/快照/準心、清空目標與 tVisible。
 * 重用既有物件與陣列（不 realloc）以守 GC 紀律；預設作用於單例。
 */
export function resetState(state: SharedState = sharedState): void {
  state.input.clear(); // 原地歸零 ring 游標、重用同一 typed-array（不 realloc，GC 紀律）
  state.inputMeta.lateEventCount = 0; // 原地歸零、重用既有 inputMeta 物件（GC 紀律）
  state.inputMeta.lastConsumedT = -Infinity;
  state.inputMeta.bufferOverflow = 0;
  state.player.vx = 0;
  state.player.vz = 0;
  state.player.x = 0;
  state.player.z = 0;
  state.player.stopped = false; // 速度 gate 歸零（重開 drill → 尚未經 movement step；GC 紀律原地清）
  state.held.left = false; // 原地清 held（重用既有物件，GC 紀律）；重開 drill → 橫移歸靜止
  state.held.right = false;
  state.heldFire = false;
  state.heldAds = false; // 重開 drill → ADS 歸位（stuck-ads 不跨 drill 汙染，WP-24 / T1）
  state.weapon.nextFireT = Infinity;
  state.weapon.ammo = state.weapon.magSize;
  resetRecoilState(state.recoilState); // 原地歸零 recoil 狀態機（重用既有物件，GC 紀律；重開 drill → punch 清）
  state.recoil.prev.pitchDeg = 0; // 原地清 recoil 視覺快照 + spread 暫存（重用既有物件，GC 紀律）
  state.recoil.prev.yawDeg = 0;
  state.recoil.curr.pitchDeg = 0;
  state.recoil.curr.yawDeg = 0;
  state.recoil.lastSpread.x = 0;
  state.recoil.lastSpread.y = 0;
  resetImpactRing(state.impacts); // 原地清空彈著格（重開 drill → 彈孔清；typed-array 不 realloc，GC 紀律）
  resetShotRayRing(state.shotRays); // 原地清空 tracer 格（render-only；重開 drill → 軌跡清）
  resetBulletArena(state.bullets); // 原地清空飛行彈 arena（重開 drill → 不保留飛行中子彈）
  state.prev.x = 0;
  state.prev.z = 0;
  state.curr.x = 0;
  state.curr.z = 0;
  state.crosshair.cx = 0;
  state.crosshair.cy = 0;
  state.aim.yaw = 0;
  state.aim.pitch = 0;
  state.targets.length = 0;
  state.tVisible.clear();
  state.tStop.clear();
  state.validity.playerCorridorExceeded = false;
  state.firstShotPeekId = null; // 首發旗標記憶歸零（重開 drill → 首發重新從第一 peek 計）
}
