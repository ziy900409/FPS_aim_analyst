import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import { WEAPONS, isWeaponId } from '../weapon/weapons.ts';
import {
  aimForward,
  angularDistanceDeg,
  eyeOriginForTick,
  resolveEyeOrigin,
  type EyeOriginOptions,
  type EyeOriginSource,
  type ResolvedEyeOrigin,
  type TargetPoint,
} from './eyeOrigin.ts';
import { WINDOW_EPSILON_MS } from './peekWindows.ts';
import {
  aliveAt,
  buildTargetWindows,
  type FireEvent,
  type TargetWindow,
  type TargetWorldPos,
} from './targetWindows.ts';

/**
 * WP-63 —— `micro_flick_three_target_test_v8` 的 **L0 結果層**（T4）、**L3 選擇策略層**（T4）與
 * **L1 幾何層**（T5）。
 *
 * L0／L3 的共同性質是**完全不需要意圖歸屬**：L0 只看結果，L3 只看「下一顆被殺的是誰」。L1 則
 * 相反——它整層建立在意圖歸屬（argmin 角誤差）上。免閾值微調與方向預測留給 T6；本檔只交付這
 * 三層，其餘鍵**不先佔位**——空陣列會被讀成「算過了，沒有樣本」，而不是「這一層還沒交付」。
 *
 * 硬紀律：
 *  - **擊殺時刻一律取 `fire.hit === true` 的 `fire.t`**。v8 是 hitscan ⇒ 匯出內 **0 個 `hit` 事件**
 *    （README §0.3）。照抄 `t_hit` 的實作會拿到空陣列而**靜默回傳 0 樣本**。本檔完全不讀 `hit`
 *    事件，窗界一律經 `buildTargetWindows()`。
 *  - **角距一律呼叫既有 canonical 實作**（C-D4）：eye 由 `resolveEyeOrigin()`／`eyeOriginForTick()`
 *    解析，夾角由 `angularDistanceDeg()` 算。本檔不自備任何球面幾何。
 *  - **缺失一律 `undefined` + 具名旗標，不補零、不吞成 NaN**（FR-63.15）。
 *  - **每一發的目標歸屬一律離線重算**（T5／FR-63.7）：`fire.targetId` 只在命中時被 raycast 覆寫，
 *    失手時是陣列首顆；`fire.offsetDeg` **永遠**對陣列首顆算（README §0.1 #4）。本檔一律不讀這兩
 *    個欄位，改以「該發時刻存活集合的 argmin 角誤差」推定，並以 `intended*` 前綴聲明它是推定。
 */

/** 版本字串。`selectionCostRatio` 的貪婪基準線起點 = **被殺目標中心**（OQ-63.2 預設，見下方註解）。 */
export const MICRO_FLICK_METRICS_VERSION = 'micro-flick-v1' as const;

export const MICRO_FLICK_OUTCOME_FLAG_VOCABULARY = [
  /** 整份匯出沒有 `visible` 事件或沒有擊殺 ⇒ `T_valid` 無錨點。 */
  'no_valid_span',
  /** 沒有任何 `fire.hit === true`。 */
  'no_kills',
  /** `T_valid` 內沒有任何 `fire`。 */
  'no_shots',
  /** 只有一次擊殺 ⇒ 沒有任何 kill interval（首顆的延遲另以 `firstKillLatencyMs` 回報）。 */
  'single_kill',
  /** 匯出不帶暫停／失焦的**區間**，`T_valid` 未扣除任何閒置（恆亮，見 `deriveOutcome` 註解）。 */
  'idle_span_unbounded',
  /** `meta.validity.pointerLockLost` ⇒ 這一場錄製中掉過 Pointer Lock，`T_valid` 多算了未知長度。 */
  'focus_lost_during_run',
  /** `T_valid` 內有窗把彈匣打到見底 ⇒ `shotsPerKill`／`shotAccuracy` 已知偏誤，不出數（FM-4）。 */
  'ammo_exhausted_in_run',
] as const;
export type MicroFlickOutcomeFlag = (typeof MICRO_FLICK_OUTCOME_FLAG_VOCABULARY)[number];

export const MICRO_FLICK_SELECTION_FLAG_VOCABULARY = [
  /** 少於兩次擊殺 ⇒ 沒有任何「擊殺轉移」。 */
  'no_kill_transitions',
  /** 有窗缺 `pos`（pre-WP-56 匯出）⇒ 該次擊殺不進任何角距聚合（FM-1）。 */
  'missing_target_position',
  /** 某次擊殺之後沒有補位（drill 結束）⇒ 該次的 `nearest3Deg` 退化為 `nearest2Deg`。 */
  'no_replacement_for_kill',
  /** 下一顆被殺者不在候選集內——真實 v8 不可能，合成 fixture 才會出現。 */
  'next_kill_not_in_candidates',
  /** 同一個 `targetId` 出現在多個窗 ⇒ 以 id 做歸屬不唯一，選擇層聚合一律不出數。 */
  'duplicate_target_id',
  /** replacement 與倖存者兩群的角距分布不可比 ⇒ 只出分層值，不出總量（README §3.1）。 */
  'replacement_distance_not_comparable',
] as const;
export type MicroFlickSelectionFlag = (typeof MICRO_FLICK_SELECTION_FLAG_VOCABULARY)[number];

export const MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY = [
  /** 該發缺 `viewYaw`／`viewPitch` ⇒ 無法離線重算角誤差，**不**退回 `fire.targetId`（README §0.1 #4）。 */
  'missing_view_angles',
  /** 候選缺 `pos`（pre-WP-56 匯出）⇒ 該顆不進 argmin（FM-1）。 */
  'missing_target_position',
  /** 該發時刻沒有任何帶幾何的存活目標 ⇒ 無從歸屬。 */
  'no_candidates',
  /** 多顆候選的角誤差在容差內併列最小 ⇒ 歸屬不唯一，該發不進聚合（FM-2）。 */
  'multiple_kill_candidates',
  /** 該目標從未被任何一發意圖歸屬 ⇒ 沒有首發，不進 `firstShotHitRate` 的分母。 */
  'no_shot_at_target',
  /** drill 結束時仍存活 ⇒ 修正段沒有右界。 */
  'never_killed',
  /** 首發即命中 ⇒ 沒有修正段可拆（不是缺失，是這顆目標就是一槍解決的）。 */
  'first_shot_hit',
  /** 匯出沒有本 build 認得的武器宣告 ⇒ 節奏地板未知，cadence 拆解不出數。 */
  'unknown_cycletime',
  /** `ticks[]` 沒有 `fire` 欄 ⇒ 無法分辨「點擊」與「按住」（見 `deriveGeometry` 註解）。 */
  'no_held_fire_channel',
  /** 修正區間內有按住 tick ⇒ 那幾發的 `fire.t` 是**排程時刻**而非點擊時刻。 */
  'held_fire_during_correction',
] as const;
export type MicroFlickGeometryFlag = (typeof MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY)[number];

/**
 * 一發射擊的意圖歸屬（FR-63.7）。
 *
 * ⚠️ **命名紀律**：凡帶「這一發的目標」語意的欄位一律 `intended` 前綴——argmin 角誤差只證明「開火
 * 那一刻離誰最近」，不證明玩家想打誰（README §3.1）。本列刻意**不**轉載 `fire.targetId`：交叉檢核
 * 由讀得到 payload 的測試自己做，輸出端不該提供一個會被誤當資料源的欄位。
 */
export interface MicroFlickShotAttribution {
  readonly tMs: number;
  readonly hit: boolean;
  /** 歸屬到的窗（`TargetWindow.index`）。缺席 ⇒ 本發不可歸屬，見 `flags`。 */
  readonly intendedWindowIndex?: number;
  readonly intendedTargetId?: string;
  /** 開火射線與該顆目標中心的無號夾角（度），頂點 = eye。 */
  readonly intendedErrorDeg?: number;
  readonly flags: readonly MicroFlickGeometryFlag[];
}

/** 一顆目標的首發與修正段（FR-63.8／63.9）。一列 = 一個 `TargetWindow`，不是一個 `targetId`。 */
export interface MicroFlickTargetGeometry {
  readonly windowIndex: number;
  readonly targetId: string;
  /** 首發 = **意圖歸屬為本窗的第一發**（不是 `fire.firstShot`，那是對陣列首顆算的）。 */
  readonly intendedFirstShotErrorDeg?: number;
  readonly firstShotHit?: boolean;
  /** `t_kill − t_首發`；首發即命中或未被擊殺時缺席。 */
  readonly correctionMs?: number;
  /** 修正段內被 `cycletimeSec` 排程擋住的累計等待。 */
  readonly cadenceWaitMs?: number;
  /** `correctionMs − cadenceWaitMs` ⇒ 扣掉武器節奏之後真正花在對齊上的時間。 */
  readonly settlingMs?: number;
  readonly flags: readonly MicroFlickGeometryFlag[];
}

export interface MicroFlickGeometryMetrics {
  /** 逐發的意圖歸屬，時間序。 */
  readonly shots: readonly MicroFlickShotAttribution[];
  /** 逐窗的首發與修正段，`TargetWindow` 順序（`visible` 時間序）。 */
  readonly targets: readonly MicroFlickTargetGeometry[];
  /** #(首發命中) / #(有首發的目標)。分母是**有首發的目標**，不是全部 `visible`（FR-63.8）。 */
  readonly firstShotHitRate?: number;
  /** 本場的武器節奏地板（ms），由匯出宣告的武器解析而來——**不是常數**。 */
  readonly cycletimeMs?: number;
  /** 樣本數 = `firstShotHitRate` 的分母（有首發的目標數）。 */
  readonly n: number;
  readonly flags: readonly MicroFlickGeometryFlag[];
}

export interface MicroFlickOutcomeMetrics {
  readonly killRateHz?: number;
  readonly shotsPerKill?: number;
  readonly shotAccuracy?: number;
  readonly killIntervalP50Ms?: number;
  readonly killIntervalP90Ms?: number;
  /**
   * 首顆的間隔（`T_valid` 起點 → 第一次擊殺）。**單獨回報，不併入 `killInterval` 分布**：它含一次
   * 從靜止起步的視覺搜尋，與「剛打完一顆、手已在動」的後續間隔不是同一個構念。
   */
  readonly firstKillLatencyMs?: number;
  /** `T_valid` 長度（ms）。 */
  readonly validSpanMs?: number;
  /** 樣本數 = 擊殺數。 */
  readonly n: number;
  readonly flags: readonly MicroFlickOutcomeFlag[];
}

/** 一次擊殺的候選集角距（FR-63.4）。`nearest3` 比 `nearest2` 多一顆下一 tick 才補上的 replacement。 */
export interface MicroFlickSelectionMetrics {
  /**
   * 逐次擊殺的「被殺目標中心 → 最近倖存者」角距。與 `nearest3Deg` **逐位對齊**（同一索引 = 同一次
   * 擊殺），故 `nearest3Deg[i] - nearest2Deg[i]` 就是那一次 replacement 搶走的角距。
   */
  readonly nearest2Deg: readonly number[];
  /** 同上，但候選集含下一 tick 才補上的 replacement。長度恆等於 `nearest2Deg`。 */
  readonly nearest3Deg: readonly number[];
  readonly nearestFirstRate?: number;
  readonly selectionCostRatio?: number;
  readonly selectionRankEntropy?: number;
  /**
   * **恆為 `undefined`**（旗標 `replacement_distance_not_comparable`）。理由不是資料缺失，是構念
   * 混淆：WP-59 的 temporal replacement sampler 刻意把補位推離被殺目標中心，量到的兩群角距分布
   * 為 survivor p50 9.22° vs replacement p50 11.28°（README §3.1 要求的可比性前置檢查；數字與
   * 重現方式見 `progress.md` T4 節與 `microFlickMetrics.test.ts` 的同名測試）。⇒ 總量會把「玩家
   * 偏好補位」與「補位比較遠所以少被選」混在一起。改出 `replacementEngagedByRank` 分層值。
   */
  readonly replacementEngagedRate?: number;
  /** 依「replacement 在候選集中的角距 rank」分層的交戰率——rank 控掉上面那條距離混淆。 */
  readonly replacementEngagedByRank: readonly {
    readonly rank: number;
    readonly engagedRate?: number;
    readonly n: number;
  }[];
  /** 樣本數 = 可評估的擊殺轉移數。 */
  readonly n: number;
  readonly flags: readonly MicroFlickSelectionFlag[];
}

export interface MicroFlickMetricsOptions {
  /** eye origin 解析；研究側入口必須傳 `strictEyeOrigin: true`（FM-3）。 */
  readonly eye?: EyeOriginOptions;
}

export interface MicroFlickMetrics {
  readonly outcome: MicroFlickOutcomeMetrics;
  readonly geometry: MicroFlickGeometryMetrics;
  readonly selection: MicroFlickSelectionMetrics;
  readonly version: typeof MICRO_FLICK_METRICS_VERSION;
  readonly eyeOriginSource: EyeOriginSource;
}

/**
 * 由一份 v8 匯出推導 L0 結果層與 L3 選擇策略層。
 *
 * @throws 只在 `options.eye.strictEyeOrigin === true` 且匯出缺 `meta.scene.eye`／`meta.simToWorld`
 *         時，由 `resolveEyeOrigin()` 拋錯（FM-3：不靜默算出一組偏掉的角度）。其餘異常一律旗標。
 */
export function deriveMicroFlickMetrics(
  payload: ExportPayload,
  options: MicroFlickMetricsOptions = {},
): MicroFlickMetrics {
  const eyeOrigin = resolveEyeOrigin(payload, options.eye);
  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const windows = buildTargetWindows(payload);

  return {
    outcome: deriveOutcome(payload, windows.windows),
    geometry: deriveGeometry(payload, windows.windows, ticks, eyeOrigin),
    selection: deriveSelection(windows.windows, ticks, eyeOrigin),
    version: MICRO_FLICK_METRICS_VERSION,
    eyeOriginSource: eyeOrigin.source,
  };
}

// ---------------------------------------------------------------------------
// L0 結果層（FR-63.6）
// ---------------------------------------------------------------------------

/**
 * `T_valid` = `[第一個 visible 的 t, 最後一次擊殺的 t]`。
 *
 * ⚠️ **為什麼不是「countdown 結束」**：`timing.countdownMs` 從來沒有進過匯出 `meta`（`Meta` 無此
 * 欄位），所以規劃期寫的「從 `meta` 的 countdown 結束起算」在資料上不存在。task 文件的退路是
 * 「整場計入並標旗標」，但那會把 3 秒倒數整段算進分母，讓 `killRateHz` 系統性偏低；而 v8 無
 * `spawnDelayMs` ⇒ **第一個 `visible` 就是 running 的第一個 sim tick**，與倒數結束同一刻（差一個
 * tick 之內）。取事件錨比取一個不存在的欄位或一個已知偏掉的分母都好，且與 GD-39 ② 的「v8 指標
 * 一律事件錨定」同一條紀律。
 *
 * 暫停／失焦區間**不扣除**：匯出只有 `meta.validity.pointerLockLost` 這個布林，沒有區間；WP-60 的
 * `pointer_lock` 事件雖有區間，但那是 `?rawMouse=1` 才收的 opt-in 資料——讓指標定義依賴一個採集
 * 開關，會讓開／關兩批 run 的 `killRateHz` 不可混比。⇒ 一律不扣，以 `idle_span_unbounded` 恆亮
 * 聲明，另以 `focus_lost_during_run` 指出這一場實際掉過鎖。
 */
function deriveOutcome(
  payload: ExportPayload,
  windows: readonly TargetWindow[],
): MicroFlickOutcomeMetrics {
  const flags: MicroFlickOutcomeFlag[] = ['idle_span_unbounded'];
  if (payload.meta?.validity?.pointerLockLost === true) flags.push('focus_lost_during_run');

  const killTimes = windows
    .map((window) => window.tKillMs)
    .filter((t): t is number => t !== undefined)
    .sort((a, b) => a - b);
  const n = killTimes.length;
  if (n === 0) flags.push('no_kills');
  if (n === 1) flags.push('single_kill');

  const firstVisibleMs = windows.reduce((min, window) => Math.min(min, window.tVisibleMs), Infinity);
  const lastKillMs = killTimes.at(-1);
  const hasSpan =
    Number.isFinite(firstVisibleMs) && lastKillMs !== undefined && lastKillMs > firstVisibleMs;
  if (!hasSpan) flags.push('no_valid_span');

  const validSpanMs = hasSpan ? lastKillMs - firstVisibleMs : undefined;
  const shots = hasSpan
    ? payload.events.filter(
        (event) =>
          event.type === 'fire' &&
          event.t + WINDOW_EPSILON_MS >= firstVisibleMs &&
          event.t <= lastKillMs + WINDOW_EPSILON_MS,
      ).length
    : 0;
  if (hasSpan && shots === 0) flags.push('no_shots');

  // FM-4：彈匣見底代表該段有一截「按住但不出彈」的時間洞 ⇒ `shotsPerKill` 已知偏低。README 要求
  // 「該窗不進分母」，但 v8 三顆並發 ⇒ 一發 `fire` 同時落在最多三個窗內，逐窗的發數歸屬要等 T5 的
  // 意圖歸屬才有定義。L0 無法只剔掉那一窗 ⇒ 依 C-D3（寧可少一個指標，不能有一個會說錯話的指標）
  // 整層不出數並具名旗標，而不是輸出一個已知偏誤的數字。
  const ammoExhausted = windows.some(
    (window) =>
      window.flags.includes('ammo_exhausted_in_window') &&
      window.tKillMs !== undefined &&
      window.tKillMs <= (lastKillMs ?? -Infinity) + WINDOW_EPSILON_MS,
  );
  if (ammoExhausted) flags.push('ammo_exhausted_in_run');

  const intervals: number[] = [];
  for (let i = 1; i < killTimes.length; i++) intervals.push(killTimes[i] - killTimes[i - 1]);

  const shotsUsable = shots > 0 && n > 0 && !ammoExhausted;

  return {
    ...(validSpanMs !== undefined && n > 0 ? { killRateHz: n / (validSpanMs / 1000) } : {}),
    ...(shotsUsable ? { shotsPerKill: shots / n, shotAccuracy: n / shots } : {}),
    ...maybe('killIntervalP50Ms', percentile(intervals, 50)),
    ...maybe('killIntervalP90Ms', percentile(intervals, 90)),
    ...(hasSpan && n > 0 ? { firstKillLatencyMs: killTimes[0] - firstVisibleMs } : {}),
    ...maybe('validSpanMs', validSpanMs),
    n,
    flags: ordered(MICRO_FLICK_OUTCOME_FLAG_VOCABULARY, flags),
  };
}

// ---------------------------------------------------------------------------
// L1 幾何層（FR-63.7／63.8／63.9）
// ---------------------------------------------------------------------------

/**
 * 逐發重算意圖目標與開火角誤差，再據此重定義首發與修正段。
 *
 * **為什麼整層要重算**：`fire.targetId` 只在命中時被 raycast 覆寫（`SimLoop.ts:451`），失手時仍是
 * 陣列首顆；`fire.offsetDeg` **永遠**對 `currentPeekId`（陣列首顆）算；`fire.firstShot` 也以首顆為
 * 鍵 ⇒ 陣列首顆存活期間，後續 fire 的 `firstShot` 恆 `false`。三者在三顆並發的 v8 上全部失真
 * （README §0.1 #4），所以本層一個都不讀。
 *
 * **T1 的紅利**：`usp_s_laser` 零散布 ⇒ 命中 ⟺ 角誤差 ≤ 角半徑，無隨機成分 ⇒「這一發本來想打誰、
 * 差了多少」是完全確定的，不需要任何機率推論。
 *
 * **不加 recoil punch**：`fire.viewYaw`／`viewPitch` 是 `state.aim` 的原值，punch 另記於
 * `aimPunch*`。把兩者相加等於在本檔重寫一次彈道朝向（C-D4）；而 `usp_s_laser` 的 punch 逐位為 0
 * （T1 NFR-63.7），故 v8 上兩種讀法本來就同值。
 *
 * **`no_held_fire_channel` 的用途**：`fire.t` 是**排程時刻**不是點擊時刻——單次點擊的首發
 * `nextFireT = ev.t`（真實 mouse-down 時間戳），按住時後續發為 `nextFireT += cycleMs`
 * （`SimLoop.ts:100, 552`）。只有逐 tick 的 `heldFire`（`ticks[].fire`）能分辨兩者，故該欄缺席時
 * 具名聲明；存在且修正區間內有按住 tick 時標 `held_fire_during_correction`。
 */
function deriveGeometry(
  payload: ExportPayload,
  windows: readonly TargetWindow[],
  ticks: readonly TickRecord[],
  eyeOrigin: ResolvedEyeOrigin,
): MicroFlickGeometryMetrics {
  const flags: MicroFlickGeometryFlag[] = [];

  const cycletimeMs = resolveCycletimeMs(payload.meta);
  if (cycletimeMs === undefined) pushFlag(flags, 'unknown_cycletime');

  const hasHeldFireChannel = ticks.some((tick) => tick.fire !== undefined);
  if (!hasHeldFireChannel) pushFlag(flags, 'no_held_fire_channel');

  const fires = payload.events
    .filter((event): event is FireEvent => event.type === 'fire')
    .slice()
    .sort((a, b) => a.t - b.t);
  const fireTimes = fires.map((fire) => fire.t);

  const shots = fires.map((fire) => attributeShot(fire, windows, ticks, eyeOrigin, flags));

  /** 每個窗的首發 = 意圖歸屬為它的第一發。鍵是**窗索引**不是 `targetId`——id 可能被重複使用。 */
  const firstShotByWindow = new Map<number, MicroFlickShotAttribution>();
  for (const shot of shots) {
    if (shot.intendedWindowIndex === undefined) continue;
    if (!firstShotByWindow.has(shot.intendedWindowIndex)) {
      firstShotByWindow.set(shot.intendedWindowIndex, shot);
    }
  }

  const targets = windows.map((window) =>
    targetGeometry(
      window,
      firstShotByWindow.get(window.index),
      fireTimes,
      ticks,
      cycletimeMs,
      flags,
    ),
  );

  const withFirstShot = targets.filter((target) => target.firstShotHit !== undefined);
  const hits = withFirstShot.filter((target) => target.firstShotHit === true).length;

  return {
    shots,
    targets,
    ...(withFirstShot.length > 0 ? { firstShotHitRate: hits / withFirstShot.length } : {}),
    ...maybe('cycletimeMs', cycletimeMs),
    n: withFirstShot.length,
    flags: ordered(MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY, flags),
  };
}

/** 歸屬一發射擊：候選集的 argmin 角誤差（FR-63.7）。併列 ⇒ 不歸屬（FM-2），不以 id 序決勝。 */
function attributeShot(
  fire: FireEvent,
  windows: readonly TargetWindow[],
  ticks: readonly TickRecord[],
  eyeOrigin: ResolvedEyeOrigin,
  traceFlags: MicroFlickGeometryFlag[],
): MicroFlickShotAttribution {
  const shotFlags: MicroFlickGeometryFlag[] = [];
  const raise = (flag: MicroFlickGeometryFlag): void => {
    pushFlag(shotFlags, flag);
    pushFlag(traceFlags, flag);
  };

  if (fire.viewYaw === undefined || fire.viewPitch === undefined) {
    raise('missing_view_angles');
    return {
      tMs: fire.t,
      hit: fire.hit,
      flags: ordered(MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY, shotFlags),
    };
  }

  const aim = aimForward(fire.viewYaw, fire.viewPitch);
  const eye = eyeOriginForTick(tickAtOrBefore(ticks, fire.t), eyeOrigin);

  let best: { readonly index: number; readonly targetId: string; readonly deg: number } | undefined;
  let tied = false;
  for (const window of candidatesForShot(windows, fire.t)) {
    if (window.pos === undefined) {
      raise('missing_target_position');
      continue;
    }
    const to = direction(eye, window.pos);
    if (to === undefined) continue;
    const deg = angularDistanceDeg(aim, to);
    if (best === undefined || deg < best.deg - RANK_TIE_TOLERANCE_DEG) {
      best = { index: window.index, targetId: window.targetId, deg };
      tied = false;
    } else if (deg <= best.deg + RANK_TIE_TOLERANCE_DEG) {
      tied = true;
    }
  }

  if (best === undefined) raise('no_candidates');
  else if (tied) raise('multiple_kill_candidates');

  return {
    tMs: fire.t,
    hit: fire.hit,
    ...(best !== undefined && !tied
      ? {
          intendedWindowIndex: best.index,
          intendedTargetId: best.targetId,
          intendedErrorDeg: best.deg,
        }
      : {}),
    flags: ordered(MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY, shotFlags),
  };
}

/**
 * 一發射擊當下的候選集 = 已 `visible` 且尚未被擊殺的窗，**含被這一發打掉的那顆**。
 *
 * 這裡刻意不用 `aliveAt()`：它的右界是半開的（`tMs < tKillMs`），對 L3「擊殺之後誰還活著」是對的，
 * 對 L1「開火那一刻誰在場上」則會把被這發打掉的目標排除掉——於是命中的那一發永遠歸屬不到它自己，
 * 交叉檢核（T5 D3）必然失敗。
 */
function candidatesForShot(windows: readonly TargetWindow[], tMs: number): readonly TargetWindow[] {
  return windows.filter(
    (window) =>
      window.tVisibleMs <= tMs + WINDOW_EPSILON_MS &&
      (window.tKillMs === undefined || tMs <= window.tKillMs + WINDOW_EPSILON_MS),
  );
}

/** 一顆目標的首發與修正段拆解（FR-63.8／63.9）。 */
function targetGeometry(
  window: TargetWindow,
  firstShot: MicroFlickShotAttribution | undefined,
  fireTimes: readonly number[],
  ticks: readonly TickRecord[],
  cycletimeMs: number | undefined,
  traceFlags: MicroFlickGeometryFlag[],
): MicroFlickTargetGeometry {
  const flags: MicroFlickGeometryFlag[] = [];
  const identity = { windowIndex: window.index, targetId: window.targetId };

  if (firstShot === undefined) {
    pushFlag(flags, 'no_shot_at_target');
    pushFlag(traceFlags, 'no_shot_at_target');
    return { ...identity, flags: ordered(MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY, flags) };
  }

  const head = {
    ...identity,
    ...maybe('intendedFirstShotErrorDeg', firstShot.intendedErrorDeg),
    firstShotHit: firstShot.hit,
  };

  // 首發即命中 ⇒ 沒有修正段可拆；未被擊殺 ⇒ 修正段沒有右界。兩者都不是缺失，故具名而非靜默。
  if (firstShot.hit) pushFlag(flags, 'first_shot_hit');
  if (window.tKillMs === undefined) pushFlag(flags, 'never_killed');
  if (firstShot.hit || window.tKillMs === undefined) {
    return { ...head, flags: ordered(MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY, flags) };
  }

  const correctionMs = window.tKillMs - firstShot.tMs;
  if (heldFireWithin(ticks, firstShot.tMs, window.tKillMs)) {
    pushFlag(flags, 'held_fire_during_correction');
    pushFlag(traceFlags, 'held_fire_during_correction');
  }
  if (cycletimeMs === undefined) {
    pushFlag(flags, 'unknown_cycletime');
    return { ...head, correctionMs, flags: ordered(MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY, flags) };
  }

  const cadenceWaitMs = cadenceWaitWithin(fireTimes, firstShot.tMs, window.tKillMs, cycletimeMs);
  return {
    ...head,
    correctionMs,
    cadenceWaitMs,
    settlingMs: correctionMs - cadenceWaitMs,
    flags: ordered(MICRO_FLICK_GEOMETRY_FLAG_VOCABULARY, flags),
  };
}

/**
 * 修正區間內被武器節奏擋住的累計等待。
 *
 * 對區間內每一對相鄰 `fire`：間隔恰等於 `cycleMs`（排程連發）⇒ 整段是等待；間隔大於 `cycleMs`
 * （玩家還在對齊）⇒ 只有 `cycleMs` 那段是等待。兩種情形合起來就是 `min(間隔, cycleMs)`。
 *
 * 計入**區間內的每一發**而不只是歸屬給本目標的那幾發：節奏地板是武器層級的，玩家中途朝別顆開的
 * 槍一樣會把本顆的補槍往後推。
 */
function cadenceWaitWithin(
  fireTimes: readonly number[],
  fromMs: number,
  toMs: number,
  cycleMs: number,
): number {
  const inWindow = fireTimes.filter(
    (t) => t + WINDOW_EPSILON_MS >= fromMs && t <= toMs + WINDOW_EPSILON_MS,
  );
  let wait = 0;
  for (let i = 1; i < inWindow.length; i++) {
    wait += Math.min(inWindow[i] - inWindow[i - 1], cycleMs);
  }
  return wait;
}

/** 區間內是否有按住左鍵的 tick。`fire` 欄缺席的 tick 不算 `false`——那是「沒這個頻道」。 */
function heldFireWithin(ticks: readonly TickRecord[], fromMs: number, toMs: number): boolean {
  return ticks.some(
    (tick) =>
      tick.fire === true &&
      tick.t + WINDOW_EPSILON_MS >= fromMs &&
      tick.t <= toMs + WINDOW_EPSILON_MS,
  );
}

/**
 * 本場的節奏地板（ms）。**由匯出宣告的武器解析，不寫死**。
 *
 * 規劃期（T5 Steps 5）寫的是「從 `meta.weapon` 讀 `cycletimeSec`」，但 `WeaponMeta` 只帶
 * `id`／`ads`／`bullet`／`projectileOverflow`，**沒有** `cycletimeSec`（`metadata.ts:55-67`）。可用
 * 的路徑是拿匯出宣告的武器 id 去查本 build 的 `WEAPONS` registry——那仍然是「從匯出讀」而非常數：
 * 同一份程式碼對 `usp_s_laser` 得 170 ms、對 `ak47` 得 100 ms。認不得的 id ⇒ `undefined` + 具名
 * 旗標，不猜一個預設值（猜錯會讓 `settlingMs` 系統性偏移而離線不可察覺）。
 */
function resolveCycletimeMs(meta: ExportPayload['meta']): number | undefined {
  const id = meta.weapon?.id ?? meta.weaponId;
  if (typeof id !== 'string' || !isWeaponId(id)) return undefined;
  return WEAPONS[id].cycletimeSec * 1000;
}

// ---------------------------------------------------------------------------
// L3 選擇策略層（FR-63.4／63.5）
// ---------------------------------------------------------------------------

interface Candidate {
  readonly targetId: string;
  readonly deg: number;
  readonly isReplacement: boolean;
}

/** 角距相等的容差（度）。同距的候選一律同 rank，不以陣列順序或 id 序決勝（FM-2 的同一條紀律）。 */
const RANK_TIE_TOLERANCE_DEG = 1e-9;

function deriveSelection(
  windows: readonly TargetWindow[],
  ticks: readonly TickRecord[],
  eyeOrigin: ResolvedEyeOrigin,
): MicroFlickSelectionMetrics {
  const flags: MicroFlickSelectionFlag[] = ['replacement_distance_not_comparable'];

  const killed = windows
    .filter((window): window is TargetWindow & { tKillMs: number } => window.tKillMs !== undefined)
    .slice()
    .sort((a, b) => a.tKillMs - b.tKillMs);
  const byVisible = windows.slice().sort((a, b) => a.tVisibleMs - b.tVisibleMs);
  const duplicateIds = new Set(windows.map((window) => window.targetId)).size !== windows.length;
  if (duplicateIds) flags.push('duplicate_target_id');

  const nearest2Deg: number[] = [];
  const nearest3Deg: number[] = [];
  const candidateSets: (readonly Candidate[] | undefined)[] = [];

  for (const window of killed) {
    const set = candidatesAtKill(window, byVisible, ticks, eyeOrigin, flags);
    candidateSets.push(set);
    if (set === undefined) continue;
    // 兩個陣列**逐位對齊**（同一次擊殺同一個索引），故一顆倖存者都沒有的退化情形兩邊都不push
    // ——否則消費端把兩者 zip 起來看「replacement 搶走多少注意力」時會靜靜地錯位。
    const survivorDegs = set.filter((candidate) => !candidate.isReplacement).map((c) => c.deg);
    if (survivorDegs.length === 0) continue;
    nearest2Deg.push(Math.min(...survivorDegs));
    nearest3Deg.push(Math.min(...set.map((candidate) => candidate.deg)));
  }

  let transitions = 0;
  let nearestFirst = 0;
  let actualCostDeg = 0;
  let greedyCostDeg = 0;
  const rankCounts = new Map<number, number>();
  const replacementRankTotals = new Map<number, number>();
  const replacementRankEngaged = new Map<number, number>();

  for (let i = 0; i + 1 < killed.length; i++) {
    const set = candidateSets[i];
    if (set === undefined) continue;
    const chosenId = killed[i + 1].targetId;
    const chosen = set.find((candidate) => candidate.targetId === chosenId);
    if (chosen === undefined) {
      pushFlag(flags, 'next_kill_not_in_candidates');
      continue;
    }

    transitions++;
    const bestDeg = Math.min(...set.map((candidate) => candidate.deg));
    const chosenRank = rankOf(set, chosen.deg);
    if (chosenRank === 1) nearestFirst++;
    rankCounts.set(chosenRank, (rankCounts.get(chosenRank) ?? 0) + 1);
    actualCostDeg += chosen.deg;
    greedyCostDeg += bestDeg;

    const replacement = set.find((candidate) => candidate.isReplacement);
    if (replacement !== undefined) {
      const rank = rankOf(set, replacement.deg);
      replacementRankTotals.set(rank, (replacementRankTotals.get(rank) ?? 0) + 1);
      if (chosen.targetId === replacement.targetId) {
        replacementRankEngaged.set(rank, (replacementRankEngaged.get(rank) ?? 0) + 1);
      }
    }
  }

  if (killed.length < 2) pushFlag(flags, 'no_kill_transitions');
  const usable = transitions > 0 && !duplicateIds;

  return {
    nearest2Deg,
    nearest3Deg,
    ...(usable ? { nearestFirstRate: nearestFirst / transitions } : {}),
    ...(usable && greedyCostDeg > 0 ? { selectionCostRatio: actualCostDeg / greedyCostDeg } : {}),
    ...(usable ? { selectionRankEntropy: shannonEntropyBits([...rankCounts.values()]) } : {}),
    // `replacementEngagedRate` 刻意缺席——見介面上的註解（README §3.1 的可比性前置檢查）。
    replacementEngagedByRank: [...replacementRankTotals.keys()]
      .sort((a, b) => a - b)
      .map((rank) => {
        const total = replacementRankTotals.get(rank) ?? 0;
        return {
          rank,
          ...(usable && total > 0
            ? { engagedRate: (replacementRankEngaged.get(rank) ?? 0) / total }
            : {}),
          n: total,
        };
      }),
    n: transitions,
    flags: ordered(MICRO_FLICK_SELECTION_FLAG_VOCABULARY, flags),
  };
}

/**
 * 擊殺瞬間的候選集：兩顆倖存者（`aliveAt`，FR-63.2）＋ 下一 tick 才補上的 replacement。
 *
 * 角距的頂點是 eye、起點是**被殺目標中心**（OQ-63.2 預設）——基準線是幾何量，不該被擊殺瞬間的
 * 瞄準誤差污染。`undefined` = 這次擊殺沒有可用幾何（自己缺座標，或候選全數缺座標）。
 */
function candidatesAtKill(
  window: TargetWindow & { tKillMs: number },
  byVisible: readonly TargetWindow[],
  ticks: readonly TickRecord[],
  eyeOrigin: ResolvedEyeOrigin,
  flags: MicroFlickSelectionFlag[],
): readonly Candidate[] | undefined {
  if (window.pos === undefined) {
    pushFlag(flags, 'missing_target_position');
    return undefined;
  }
  const eye = eyeOriginForTick(tickAtOrBefore(ticks, window.tKillMs), eyeOrigin);
  const from = direction(eye, window.pos);
  if (from === undefined) return undefined;

  const survivors = aliveAt(byVisible, window.tKillMs).targets.filter(
    (target) => target.targetId !== window.targetId,
  );
  const replacement = byVisible.find(
    (candidate) => candidate.tVisibleMs + WINDOW_EPSILON_MS >= window.tKillMs,
  );
  if (replacement === undefined) pushFlag(flags, 'no_replacement_for_kill');

  const candidates: Candidate[] = [];
  for (const survivor of survivors) {
    const deg = separationDeg(from, eye, survivor.pos);
    if (deg === undefined) pushFlag(flags, 'missing_target_position');
    else candidates.push({ targetId: survivor.targetId, deg, isReplacement: false });
  }
  if (replacement !== undefined) {
    const deg = separationDeg(from, eye, replacement.pos);
    if (deg === undefined) pushFlag(flags, 'missing_target_position');
    else candidates.push({ targetId: replacement.targetId, deg, isReplacement: true });
  }
  return candidates.length > 0 ? candidates : undefined;
}

function separationDeg(
  from: TargetPoint,
  eye: TargetPoint,
  pos: TargetWorldPos | undefined,
): number | undefined {
  if (pos === undefined) return undefined;
  const to = direction(eye, pos);
  if (to === undefined) return undefined;
  return angularDistanceDeg(from, to);
}

/** eye → 目標中心的單位方向。零長度（目標與 eye 重合）時無方向可言 ⇒ `undefined`。 */
function direction(eye: TargetPoint, pos: TargetWorldPos): TargetPoint | undefined {
  const dx = pos.x - eye.x;
  const dy = pos.y - eye.y;
  const dz = pos.z - eye.z;
  const length = Math.hypot(dx, dy, dz);
  if (length === 0) return undefined;
  return { x: dx / length, y: dy / length, z: dz / length };
}

/** 最後一個 `t <= tMs` 的 tick（沒有則取第一個）。v8 是 `translation: 'locked'` ⇒ 逐 tick 同一個 eye。 */
function tickAtOrBefore(ticks: readonly TickRecord[], tMs: number): { px: number; pz: number } {
  if (ticks.length === 0) return { px: 0, pz: 0 };
  let low = 0;
  let high = ticks.length - 1;
  let found = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (ticks[mid].t <= tMs + WINDOW_EPSILON_MS) {
      found = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return ticks[found];
}

/** 1-based rank；同距（容差內）一律同 rank，不以陣列順序決勝。 */
function rankOf(candidates: readonly Candidate[], deg: number): number {
  return 1 + candidates.filter((candidate) => candidate.deg < deg - RANK_TIE_TOLERANCE_DEG).length;
}

function shannonEntropyBits(counts: readonly number[]): number {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;
  let bits = 0;
  for (const count of counts) {
    if (count === 0) continue;
    const p = count / total;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/** 線性內插百分位（沿用 `compute.ts`／`spiderShotMetrics.ts` 的定義）。空集合回 `undefined`，不回 0。 */
function percentile(values: readonly number[], p: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = values.slice().sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

function maybe<K extends string>(key: K, value: number | undefined): Partial<Record<K, number>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, number>);
}

function pushFlag<F>(flags: F[], flag: F): void {
  if (!flags.includes(flag)) flags.push(flag);
}

function ordered<F>(vocabulary: readonly F[], flags: readonly F[]): F[] {
  const present = new Set(flags);
  return vocabulary.filter((flag) => present.has(flag));
}
