import { expect, test, type Page } from '@playwright/test';
import { armAndWaitRunning, readDrillArmState } from './support/arm.ts';
import { HIT_FEEDBACK_HOLD_MS } from '../../src/render/TargetView.ts';
import { trackingBrVariants } from '../../src/drill/tracking_br_v1.ts';
import { trackingV1 } from '../../src/drill/tracking_v1.ts';
import { resolveEyeWorldBase } from '../../src/scene/eyePose.ts';
import { placeholderRoom } from '../../src/scene/scenes/placeholder-room.ts';

/**
 * WP-66 / T5 —— 命中視覺回饋的 live 端到端閘（FM-3 / FR-66.5 / FR-66.8）。
 *
 * 單元層（T1 ring、T2 `TargetView`、T3 `resolveHitFeedback`）各自綠燈**不代表 app 接起來了**：
 * `main.ts` 不在 vitest 覆蓋內，而它有兩條只有實機才驗得到的線——
 * ① `setHitFeedback()` 是否在載入／換 drill／換武器／換場景四條路徑都生效（FM-3）；
 * ② `liveFrame` 的 `targetView.sync()` 是否**同時**傳 `hits` 與 `nowMs`（只傳其一會**靜默**退回
 *    本 WP 前的行為、不報錯，見 T3 Open Questions）。
 * 本檔用真瀏覽器把這兩條各自以正反兩面釘死。
 *
 * **怎麼看見材質**：`TargetView` 不對外暴露 mesh，但 three 的 `Scene` 建構子會對
 * `__THREE_DEVTOOLS__` 派發 `observe`（three 0.185 `three.core.js`）。以 `addInitScript` 在頁面
 * 腳本之前掛一個 `EventTarget`，即可**唯讀**取得場景物件——production code 零修改（T5 Invariant）。
 *
 * **怎麼開火**：fire 事件經 `isLocked()` 閘（`InputSampler`），所以必須**真的**取得 Pointer Lock。
 * WP-65 T6 spike A 已證實本環境的 trusted `canvas.click()` 可取真鎖。待命閘一律走既有共用 helper
 * `support/arm.ts`（全 repo 只有那一份取鎖模擬，WP-65 Package DoD），本檔不再自寫一份。
 * 兩者的交互作用是承重的細節：arm 的脈衝在離開時把 `PointerLock.locked` 留在 `false`，所以在
 * 每次 arm **之前**先 `exitPointerLock()`、arm **之後**再以真實點擊取鎖，否則開火會被閘門靜默吃掉
 * （實測：不這麼做時 26 次扣板機一發都不進 ring）。
 */

const URL = 'http://localhost:5173/';

/** 啟用清單上的 drill（T4 八格之一）。取自具名 builder，不手寫 drill id（WP-64 §1.5 紀律）。 */
const ENABLED_DRILL_ID = trackingBrVariants.find(
  (variant) =>
    variant.axes.ads === 'ads_off' && variant.axes.ballistic === 'hitscan' && variant.axes.angularHeight === '2deg',
)!.id;
const ENABLED_SCENE_ID = 'br-field';
/**
 * 未列名的對照 drill。三個條件缺一不可：
 * ① 不在 OQ-66.1 的啟用清單上；
 * ② 目標為 `persistent`（`timing.presentationMs` 提供）——命中**不撤除**，亮起才有東西可以亮。
 *    非 persistent 的 drill（如 spider-shot）命中同一 tick 就 `markKilled`，下一個 render frame
 *    已經沒有 mesh，「命中後恆不亮」會因此恆真而**變成假綠燈**（本檔實際踩過：對照 drill 的
 *    config 被注入 `hitFeedback: 'flash'` 仍然全綠）；
 * ③ 未釘場景（`availableDrills` 無 `sceneId`）⇒ 沿用當下的 br-field，與啟用 drill 同一個 eye base。
 */
const CONTROL_DRILL_ID = trackingV1.drillId;
/**
 * 對照 drill 與換場景往返共用的第二個場景。
 * `tracking_br_v1` 的 28.6 u 交戰距離只有 br-field 與 placeholder-room 過得了 clearance；
 * `tracking_v1` 亦然。eye base 由 `resolveEyeWorldBase()` 解析——**不在本檔重新定義場景幾何**
 * （br-field 本身無法在 Node 下 import：它的 props 是 JSON，Vite 以外的環境需要 import attribute）。
 */
const SECOND_SCENE_ID = placeholderRoom.sceneId;
const SECOND_SCENE_EYE = resolveEyeWorldBase(placeholderRoom);

/** 頁面腳本之前掛上的 three devtools 匯流排；`Scene` 建構子會把自己派發過來。 */
const INSTALL_SCENE_OBSERVER = (): void => {
  const bus = new EventTarget();
  (window as unknown as Record<string, unknown>).__THREE_DEVTOOLS__ = bus;
  const observed: unknown[] = [];
  (window as unknown as Record<string, unknown>).__wp66Observed = observed;
  bus.addEventListener('observe', (event) => observed.push((event as CustomEvent).detail));
};

interface ProbeOptions {
  /**
   * 怎麼把準心放到目標上。
   *
   * - `center`：把準心**壓在** yaw 0，只在目標經過它（spawn yaw 0 的 tracking 目標每個呈現窗會來回
   *   穿越兩次）時扣板機。最像「站著不動追蹤」，而且不需要知道該場景的 eye base。
   * - `steer`：以合成 `mousemove` 主動把準心帶到目標上——`PointerLock.onMove` 監聽的正是 `mousemove`
   *   （`pointermove` 走的是 recorder 那條，且合成事件的 `getCoalescedEvents()` 為空，動不了視角）。
   *   `eye` 為該場景的 camera 世界座標（由 `resolveEyeWorldBase()` 解析，不在此重新定義幾何）。
   */
  readonly aim:
    | { readonly mode: 'center'; readonly nearU: number; readonly settledDeg: number }
    | { readonly mode: 'steer'; readonly eye: { x: number; y: number; z: number }; readonly tolDeg: number };
  /**
   * 兩次扣板機的**最小**間隔。取大於 recoil 回復時間，使每一發都是乾淨的首發——連發時
   * aimPunch 會把彈道推離目標，實測一串 80 ms 間隔的 23 發可以整串落空。
   */
  readonly tapGapMs: number;
  readonly maxMs: number;
  readonly holdMs: number;
}

interface ProbeResult {
  taps: number;
  /** 本次探測期間 `targetHits.total` 的增量（sim 側命中訊號，與是否亮起無關）。 */
  hits: number;
  hitAtMs: number;
  firstLitAtMs: number;
  lastLitAtMs: number;
  litSamples: number;
  litHexes: string[];
  /** 同時被判定為「目標 mesh」的最大數量；應等於同時在場的目標數。 */
  targetMeshCountMax: number;
  finalLit: number;
  phase: string;
  /** 最後幾發的命中與準心偏離角，失敗時直接看得出是「沒打中」還是「打中了沒亮」。 */
  lastShots: Array<{ hit: boolean; offsetDeg: number }>;
  /** 視角增益校準（deg/count）；為 0 代表合成 `mousemove` 根本沒轉到視角。 */
  steerGain: { yawDegPerCount: number; pitchDegPerCount: number };
  /** 判定「已就位、可以扣板機」時的最大瞄準誤差；用來確認控制器真的收斂過。 */
  maxAimErrWhenSettledDeg: number;
  /**
   * 診斷欄位。留著是因為本檔每一次失敗都**不是**「亮不亮」的問題，而是「有沒有打中」的問題，
   * 而那又拆成瞄準、取鎖、drill 還在不在跑三件事——沒有這幾個數字就只能靠重跑猜。
   */
  corrections: number;
  iterations: number;
  loopMs: number;
  phaseAtStart: string;
  minAimErrDeg: number;
  /** 探測期間第一次觀測到失去 Pointer Lock 的時刻（-1 = 全程持有）。 */
  lockLostAtMs: number;
  /** 收工當下是否仍持有 Pointer Lock；drill 跑完時 app 自己會釋鎖，所以 0 不一定是異常。 */
  lockedAtEnd: number;
  /**
   * 收工時準心距原點的殘留角。`steer` 模式必然留下殘留（準心被帶去目標），所以下一次
   * `armAndTakeRealLock()` 一定要重新歸位——否則下一個 drill 的每一發都會落空。記在結果裡是
   * 為了讓那條因果在失敗輸出上直接讀得到。
   */
  residualAimDeg: number;
  /**
   * 最後一段亮起之後，**同一個目標**（亮起當下那一顆的 `TargetState.id`）仍在場卻已經是暗的取樣數。
   * 「熄滅」若只斷言 `lit === 0`，會被「目標整個消失」或「換了下一顆目標」滿足——本檔的對照 drill
   * 就因為前者當過假綠燈（見 `CONTROL_DRILL_ID` 的註解）。綁 id 才能把「熄了」與「不見了」分開。
   */
  sameTargetDarkAfterLit: number;
}

/**
 * 在頁面內扣板機並持續取樣目標 mesh 的 `emissive`。
 *
 * 目標 mesh 的辨識**不依賴任何 render 內部常數**（`TARGET_COLOR`／`HIT_EMISSIVE` 皆未匯出）：
 * 取最新建立的 `Scene`（場景重載會建新的），在它的直接子節點中找位置落在某個存活可見目標附近的
 * mesh。程序房場景的牆與地板同為 `MeshStandardMaterial`，只有這個位置條件能把它們排除。
 */
const PROBE = async (options: ProbeOptions): Promise<ProbeResult> => {
  const win = window as unknown as {
    __aimDebug: {
      state: {
        targets: ReadonlyArray<{
          id: string;
          alive: boolean;
          visible: boolean;
          pos: { x: number; y: number; z: number };
        }>;
        targetHits: { total: number };
        aim: { yaw: number; pitch: number };
      };
      recorder: { snapshot: () => { events: ReadonlyArray<Record<string, unknown>> } };
      pointerLock: { locked: boolean };
      drillPhase: () => string;
    };
    __wp66Observed: ReadonlyArray<{ isScene?: boolean; children?: unknown[] }>;
  };
  const debug = win.__aimDebug;
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  const sample = (): { count: number; lit: number; hexes: string[] } => {
    const scenes = win.__wp66Observed.filter((entry) => entry.isScene === true);
    const scene = scenes[scenes.length - 1];
    const live = debug.state.targets.filter((target) => target.alive && target.visible);
    let count = 0;
    let lit = 0;
    const hexes: string[] = [];
    for (const child of (scene?.children ?? []) as Array<Record<string, unknown>>) {
      const material = child.material as { emissive?: { getHexString(): string } } | undefined;
      const position = child.position as { x: number; y: number; z: number } | undefined;
      if (child.isMesh !== true || child.visible !== true) continue;
      if (material?.emissive === undefined || position === undefined) continue;
      const isTarget = live.some(
        (target) => Math.hypot(position.x - target.pos.x, position.y - target.pos.y, position.z - target.pos.z) < 1,
      );
      if (!isTarget) continue;
      count++;
      const hex = material.emissive.getHexString();
      if (hex !== '000000') {
        lit++;
        if (!hexes.includes(hex)) hexes.push(hex);
      }
    }
    return { count, lit, hexes };
  };

  /** 合成滑鼠位移（`PointerLock` 掛在 `document` 上，往 window 派發到不了那個 listener）。 */
  const moveMouse = (dx: number, dy: number): void => {
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, movementX: dx, movementY: dy }));
  };

  /**
   * 以一次已知位移量測 deg/count。**兩種模式都要**：`center` 模式也得主動把準心**壓在** yaw 0，
   * 不能假設它會待在那裡——Chromium 在取得 Pointer Lock 前後會送出帶位移的 `mousemove`（指標歸位），
   * 量與時機都不固定，可能落在 `armAndTakeRealLock()` 的歸位**之後**。實測在全量回歸裡漂了 3.3°～5.9°，
   * 13 發全部落空。這個校準同時是「合成 mousemove 真的轉得動視角」的執行式證據。
   */
  const probeCounts = 200;
  const beforeCal = { yaw: debug.state.aim.yaw, pitch: debug.state.aim.pitch };
  moveMouse(probeCounts, probeCounts);
  await new Promise((resolve) => setTimeout(resolve, 60));
  const steerGain = {
    yawDegPerCount: ((debug.state.aim.yaw - beforeCal.yaw) * 180) / Math.PI / probeCounts,
    pitchDegPerCount: ((debug.state.aim.pitch - beforeCal.pitch) * 180) / Math.PI / probeCounts,
  };

  const hitsBefore = debug.state.targetHits.total;
  const litHexes: string[] = [];
  let taps = 0;
  let hitAtMs = -1;
  let firstLitAtMs = -1;
  let lastLitAtMs = -1;
  let litSamples = 0;
  let targetMeshCountMax = 0;
  let finalLit = 0;
  let sameTargetDarkAfterLit = 0;
  /** 本段亮起是哪一顆目標亮的；熄滅的取樣只認這一顆。 */
  let litTargetId = '';
  let previousLit = 0;
  let lastTapAtMs = -Infinity;
  let pendingReleaseAtMs = -1;
  let lastCorrectionAtMs = -Infinity;
  let maxAimErrWhenSettledDeg = 0;
  let corrections = 0;
  let minAimErrDeg = Infinity;
  let lockLostAtMs = -1;
  let iterations = 0;
  const phaseAtStart = debug.drillPhase();
  const start = performance.now();

  while (performance.now() - start < options.maxMs) {
    const phase = debug.drillPhase();
    if (phase !== 'running' && phase !== 'countdown') break;
    iterations++;
    const now = performance.now() - start;
    const snapshot = sample();
    targetMeshCountMax = Math.max(targetMeshCountMax, snapshot.count);
    finalLit = snapshot.lit;
    const liveNow = debug.state.targets.filter((candidate) => candidate.alive && candidate.visible);
    if (snapshot.lit > 0) {
      if (previousLit === 0) {
        // 新的一段亮起：重新記這段是誰亮的，並把熄滅計數歸零。
        firstLitAtMs = now;
        litTargetId = liveNow[0]?.id ?? '';
        sameTargetDarkAfterLit = 0;
      }
      lastLitAtMs = now;
      litSamples++;
      for (const hex of snapshot.hexes) if (!litHexes.includes(hex)) litHexes.push(hex);
    } else if (firstLitAtMs >= 0 && liveNow.some((candidate) => candidate.id === litTargetId)) {
      sameTargetDarkAfterLit++;
    }
    previousLit = snapshot.lit;
    if (hitAtMs < 0 && debug.state.targetHits.total > hitsBefore) hitAtMs = now;
    // 已經取到一段完整的亮起→熄滅（且熄滅時那一顆目標還在），沒有必要再打下去。
    if (sameTargetDarkAfterLit >= 6) break;
    // 命中後遲遲不亮 ⇒ 對照組的預期路徑；給足 1.5 s（≈ 12 個 hold 窗）再收工。
    if (hitAtMs >= 0 && litSamples === 0 && now - hitAtMs > 1500) break;

    // 放開必須與取樣同在一個迴圈裡：亮起只有 HOLD_MS 長，任何「扣完板機睡一段」的寫法都會
    // 把整段亮起睡過去，量到的就永遠是暗的。
    if (pendingReleaseAtMs >= 0 && now >= pendingReleaseAtMs) {
      window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
      pendingReleaseAtMs = -1;
    }
    // 兩種模式共用同一個比例控制器，差別只在**設定點**：
    //   center → 準心壓在 yaw 0（目標自己會穿越過來）；steer → 準心追到目標身上。
    const target = debug.state.targets.find((candidate) => candidate.alive && candidate.visible);
    let wantYawRad = 0;
    let wantPitchRad = 0;
    if (options.aim.mode === 'steer' && target !== undefined) {
      // 角度慣例與 `ballisticRaycast` / `aimAt()` 一致：yaw = atan2(-dx, -dz)、pitch = asin(dy/len)。
      const dx = target.pos.x - options.aim.eye.x;
      const dy = target.pos.y - options.aim.eye.y;
      const dz = target.pos.z - options.aim.eye.z;
      wantYawRad = Math.atan2(-dx, -dz);
      wantPitchRad = Math.asin(dy / Math.hypot(dx, dy, dz));
    }
    const errYawDeg = ((wantYawRad - debug.state.aim.yaw) * 180) / Math.PI;
    const errPitchDeg = ((wantPitchRad - debug.state.aim.pitch) * 180) / Math.PI;
    const aimErrDeg = Math.hypot(errYawDeg, errPitchDeg);
    // `PROBE` 在頁面內求值，取不到模組作用域的常數 —— 門檻一律由 options 帶進來。
    const settled = aimErrDeg < (options.aim.mode === 'steer' ? options.aim.tolDeg : options.aim.settledDeg);
    // 修正之間留一個 render frame 的間隔：`state.aim` 一幀才更新一次，取樣迴圈卻是 8 ms 一圈，
    // 不節流會拿同一個過期誤差連送好幾次修正而過衝。
    // **以時間節流，不以「aim 有沒有變」當閘**：後者一旦有一次修正沒被觀測到變化就**永久卡死**
    // （實測 corrections 停在 1、瞄準誤差凍在 0.638°、整整 2358 圈 20 秒一發都沒打）。
    if (!settled && now - lastCorrectionAtMs >= 16) {
      const clamp = (value: number): number => Math.max(-400, Math.min(400, value));
      moveMouse(
        clamp((errYawDeg / steerGain.yawDegPerCount) * 0.5),
        clamp((errPitchDeg / steerGain.pitchDegPerCount) * 0.5),
      );
      lastCorrectionAtMs = now;
      corrections++;
    }
    maxAimErrWhenSettledDeg = Math.max(maxAimErrWhenSettledDeg, settled ? aimErrDeg : 0);
    minAimErrDeg = Math.min(minAimErrDeg, aimErrDeg);
    if (lockLostAtMs < 0 && !debug.pointerLock.locked) lockLostAtMs = now;
    const onTarget =
      target !== undefined &&
      settled &&
      (options.aim.mode === 'steer' || Math.abs(target.pos.x) < options.aim.nearU);
    if (phase === 'running' && onTarget && pendingReleaseAtMs < 0 && now - lastTapAtMs >= options.tapGapMs) {
      window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
      lastTapAtMs = now;
      pendingReleaseAtMs = now + 25;
      taps++;
    }
    await sleep(8);
  }
  if (pendingReleaseAtMs >= 0) window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
  const residualAimDeg = Math.hypot(debug.state.aim.yaw, debug.state.aim.pitch) * (180 / Math.PI);

  return {
    taps,
    hits: debug.state.targetHits.total - hitsBefore,
    hitAtMs: Math.round(hitAtMs),
    firstLitAtMs: Math.round(firstLitAtMs),
    lastLitAtMs: Math.round(lastLitAtMs),
    litSamples,
    litHexes,
    targetMeshCountMax,
    finalLit,
    phase: debug.drillPhase(),
    lastShots: debug.recorder
      .snapshot()
      .events.filter((event) => event.type === 'fire')
      .slice(-6)
      .map((event) => ({ hit: event.hit === true, offsetDeg: Math.round((event.offsetDeg as number) * 100) / 100 })),
    steerGain,
    maxAimErrWhenSettledDeg: Math.round(maxAimErrWhenSettledDeg * 1000) / 1000,
    corrections,
    iterations,
    loopMs: Math.round(performance.now() - start),
    minAimErrDeg: Math.round(minAimErrDeg * 1000) / 1000,
    lockLostAtMs: Math.round(lockLostAtMs),
    lockedAtEnd: debug.pointerLock.locked ? 1 : 0,
    phaseAtStart,
    residualAimDeg: Math.round(residualAimDeg * 100) / 100,
    sameTargetDarkAfterLit,
  };
};

/**
 * 把視角轉回原點（yaw = pitch = 0），並回傳校準到的視角增益。
 *
 * 為什麼每次取鎖之後都要做：`CameraController` 的朝向**跨 drill 不歸零**，而視角會從兩個地方被
 * 動到——① `steer` 模式的探測本身把準心帶去目標；② Chromium 在取得 Pointer Lock 的當下會送出
 * 帶位移的 `mousemove`（指標歸位），量不固定。兩者都會留下數度的殘留，而 `center` 模式的探測
 * 完全靠「目標經過 yaw 0」開火，殘留 5.75° 就足以讓整場 21 發全部落空（實測）。
 * 走的是生產路徑（`document` 上的 `mousemove` → `PointerLock.onMove` → `CameraController`），
 * 不直接寫 `state.aim`。
 */
const RECENTER_AIM = async (): Promise<{ startedDeg: number; residualDeg: number; degPerCount: number }> => {
  const debug = (window as unknown as { __aimDebug: { state: { aim: { yaw: number; pitch: number } } } }).__aimDebug;
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
  const moveMouse = (dx: number, dy: number): void => {
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, movementX: dx, movementY: dy }));
  };
  const toDeg = (radians: number): number => (radians * 180) / Math.PI;
  const offsetDeg = (): number => Math.hypot(toDeg(debug.state.aim.yaw), toDeg(debug.state.aim.pitch));
  /** 等到 `state.aim` 被下一個 render frame 寫過（`CameraController` 每幀寫一次）。 */
  const nextFrame = (): Promise<void> =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  const startedDeg = offsetDeg();
  const probeCounts = 200;
  const beforeYaw = debug.state.aim.yaw;
  moveMouse(probeCounts, 0);
  await sleep(60);
  const degPerCount = toDeg(debug.state.aim.yaw - beforeYaw) / probeCounts;
  if (degPerCount !== 0) {
    const clamp = (value: number): number => Math.max(-400, Math.min(400, value));
    // 收斂門檻必須大於一個 count 的角度（實測 0.022°/count），否則迴圈**永遠**達不到而跑滿上限；
    // 每圈要等一幀，300 圈就是 10 秒——足以讓這一場 drill 在探測開始前就跑完（實測 taps=0、
    // 探測一開始相位就是 `'ended'`）。上限一併收到 60 圈（≈2 s）當硬止血。
    for (let i = 0; i < 60 && offsetDeg() >= 0.05; i++) {
      moveMouse(
        clamp((-toDeg(debug.state.aim.yaw) / degPerCount) * 0.9),
        clamp((-toDeg(debug.state.aim.pitch) / degPerCount) * 0.9),
      );
      // **必須等一幀**：`state.aim` 每個 render frame 才更新一次。以固定 sleep 迴圈連送修正，
      // 等於用同一個過期誤差重複下指令 ⇒ 過衝、且退出條件讀到的是飛行途中的值（實測退出時
      // 報 0.049°，探測期間卻漂到 15°，整場 20 發全空）。
      await nextFrame();
    }
  }
  return { startedDeg: Math.round(startedDeg * 100) / 100, residualDeg: Math.round(offsetDeg() * 1000) / 1000, degPerCount };
};

/**
 * `center` 模式的就位門檻。與 `nearU` 一起決定最差情況的瞄準誤差：
 * 0.15° + 0.10 u（於 28.6 u ⇒ 0.20°）= 0.35°，小於目標半寬 0.25 u（⇒ 0.50°）——所以「就位且目標在窗內」
 * 的每一發在幾何上都該中。兩個數字任一放寬都會開始出現該中卻沒中的發數。
 */
const CENTER_SETTLED_DEG = 0.15;

const TRACKING_PROBE: ProbeOptions = {
  aim: { mode: 'center', nearU: 0.1, settledDeg: CENTER_SETTLED_DEG },
  tapGapMs: 450,
  maxMs: 28_000,
  holdMs: HIT_FEEDBACK_HOLD_MS,
};
const CONTROL_PROBE: ProbeOptions = {
  aim: { mode: 'steer', eye: SECOND_SCENE_EYE, tolDeg: 0.5 },
  tapGapMs: 500,
  maxMs: 30_000,
  holdMs: HIT_FEEDBACK_HOLD_MS,
};

async function openDrillControls(page: Page): Promise<void> {
  await page.addInitScript(INSTALL_SCENE_OBSERVER);
  // 平行 session 觸發的 vite full reload 會把狀態悄悄歸零、drill 退回預設值（T5 task file 警示）。
  await page.route('**/@vite/client', (route) => route.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __aimDebug?: unknown }).__aimDebug)), {
      timeout: 20_000,
    })
    .toBe(true);
  await page.getByRole('button', { name: '研究員模式', exact: true }).click();
  await page.locator('#researcher-menu').getByRole('button', { name: '單一 Drill 調整', exact: true }).click();
  await expect(page.locator('#drill-controls')).toBeVisible();
}

/**
 * 解除待命並取得**真實** Pointer Lock（開火的前提）。
 *
 * 順序不可調換：`exitPointerLock()` 必須落在 `'armed'` 相位（釋鎖在待命期不算「錄製中掉鎖」，
 * WP-65 FR-65.12），且必須在 `armDrill()` 的脈衝**之前**——脈衝離開時 `PointerLock.locked` 為
 * `false`，若此時瀏覽器仍真的持著鎖，之後的點擊不會再派發 `pointerlockchange`，開火就永遠被閘掉。
 */
async function armAndTakeRealLock(page: Page): Promise<void> {
  const t0 = Date.now();
  await expect.poll(async () => (await readDrillArmState(page))?.phase ?? null, { timeout: 30_000 }).toBe('armed');
  const tArmed = Date.now();
  await page.evaluate(() => {
    if (document.pointerLockElement !== null) document.exitPointerLock();
  });
  await armAndWaitRunning(page);
  const tRunning = Date.now();
  await page.locator('canvas').click({ position: { x: 400, y: 300 } });
  await expect.poll(async () => (await readDrillArmState(page))?.locked ?? null, { timeout: 15_000 }).toBe(true);
  const tLocked = Date.now();
  console.log(`[hit-feedback] timing armed=${tArmed - t0} running=${tRunning - tArmed} locked=${tLocked - tRunning}`);
  const recentered = await page.evaluate(RECENTER_AIM);
  console.log('[hit-feedback] recenter =', JSON.stringify(recentered));
  expect(recentered.degPerCount, '合成 mousemove 轉不動視角 ⇒ 之後的瞄準全部失效').not.toBe(0);
  // 0.2° 的餘裕：視角的最小可解析步進是一個 count（實測 0.022°/count），再收斂也只會停在幾個
  // count 之內；相對目標 0.5° 的半寬，這個殘留不影響任何一發。
  expect(recentered.residualDeg, '視角未回到原點').toBeLessThan(0.2);
}

/**
 * 跑一次探測，然後**立刻釋鎖**。
 *
 * 釋鎖不是收尾禮儀，是正確性：鎖定中 Playwright 的任何滑鼠移動（例如去點 `Scene` 按鈕）都會被
 * `PointerLock.onMove` 當成玩家轉視角灌進 `CameraController`，準心就此離開目標再也回不來
 * （實測殘留 `offsetDeg ≈ 7°`，之後每一發必落空）。
 */
async function probe(page: Page, options: ProbeOptions, label: string): Promise<ProbeResult> {
  const result = await page.evaluate(PROBE, options);
  await page.evaluate(() => {
    if (document.pointerLockElement !== null) document.exitPointerLock();
  });
  console.log(`[hit-feedback] ${label} =`, JSON.stringify(result));
  return result;
}

async function selectDrill(page: Page, drillId: string, sceneId: string): Promise<void> {
  await page.locator('#drill-select').selectOption(drillId);
  await expect(page.locator('#scene-select')).toHaveValue(sceneId, { timeout: 30_000 });
}

/** 換場景走 Controls 的 `Scene` 按鈕（下拉本身不觸發載入，見 `Controls.ts` 的 loadSceneButton）。 */
async function loadScene(page: Page, sceneId: string): Promise<void> {
  await page.locator('#scene-select').selectOption(sceneId);
  await page.getByRole('button', { name: 'Scene', exact: true }).click();
  await expect.poll(async () => (await readDrillArmState(page))?.phase ?? null, { timeout: 30_000 }).toBe('armed');
}

/** 啟用清單上的 drill 打中就該亮；順帶釘住「亮起只發生在命中之後」。 */
function expectFlashed(result: ProbeResult): void {
  expect(
    result.hits,
    `命中未發生（taps=${result.taps}, lastShots=${JSON.stringify(result.lastShots)}）⇒ 本次探測無法證明任何事`,
  ).toBeGreaterThan(0);
  expect(result.targetMeshCountMax, '目標 mesh 辨識應恰為同時在場的一個目標').toBe(1);
  expect(result.litSamples, '命中後目標未亮起').toBeGreaterThan(0);
  expect(result.firstLitAtMs).toBeGreaterThanOrEqual(result.hitAtMs);
  expect(result.litHexes).toHaveLength(1);
  expect(result.litHexes[0]).not.toBe('000000');
}

test.describe('WP-66 命中視覺回饋 live e2e', () => {
  test.describe.configure({ timeout: 180_000 });

  test('啟用清單上的 tracking drill：命中當下亮起，HOLD 窗內熄滅（FR-66.4/66.5）', async ({ page }) => {
    await openDrillControls(page);
    await selectDrill(page, ENABLED_DRILL_ID, ENABLED_SCENE_ID);
    await armAndTakeRealLock(page);

    const result = await probe(page, TRACKING_PROBE, 'enabled/first');
    expectFlashed(result);
    // 衰減：亮起總長應為一個 hold 窗的量級。上界放寬到 2× 吸收取樣顆粒與連續命中重新起算；
    // 真正不可放寬的是**它必須熄**——最後一個取樣為暗。
    expect(result.lastLitAtMs - result.firstLitAtMs).toBeLessThanOrEqual(2 * HIT_FEEDBACK_HOLD_MS);
    expect(result.finalLit, '命中態未熄滅（卡在亮態）').toBe(0);
    // 熄滅必須發生在**目標還在場**的時候，否則「不亮了」只是「目標被撤掉了」的同義詞。
    expect(result.sameTargetDarkAfterLit, '未觀測到「被打中的那一顆仍在、但已熄滅」的畫面').toBeGreaterThanOrEqual(6);
  });

  test('換 drill：對照 drill 命中不亮，換回啟用 drill 又亮（FM-3 wiring #2 / FR-66.8）', async ({ page }) => {
    await openDrillControls(page);
    await selectDrill(page, ENABLED_DRILL_ID, ENABLED_SCENE_ID);
    await armAndTakeRealLock(page);
    expectFlashed(await probe(page, TRACKING_PROBE, 'enabled/before-switch'));

    // 未列名的 drill：sim 照樣寫環形格（命中訊號與設定無關），但 render 不得上色。
    // 對照 drill 未釘場景 ⇒ 選它不換場；再以 Scene 按鈕帶進 placeholder-room，才有可解析的 eye base。
    await selectDrill(page, CONTROL_DRILL_ID, ENABLED_SCENE_ID);
    await loadScene(page, SECOND_SCENE_ID);
    await armAndTakeRealLock(page);
    const control = await probe(page, CONTROL_PROBE, 'control');
    expect(
      control.hits,
      `對照 drill 未命中（taps=${control.taps}, lastShots=${JSON.stringify(control.lastShots)}）⇒ 無法證明「命中也不亮」`,
    ).toBeGreaterThan(0);
    expect(control.litSamples, '未列名的 drill 命中後仍亮起 —— 設定閘失效').toBe(0);

    // 換回啟用 drill：`setHitFeedback` 必須兩個方向都跟著 drill 走，不只是開機那一次。
    await selectDrill(page, ENABLED_DRILL_ID, ENABLED_SCENE_ID);
    await armAndTakeRealLock(page);
    expectFlashed(await probe(page, TRACKING_PROBE, 'enabled/after-switch-back'));
  });

  test('換場景：離開再載回 br-field 後仍生效（FM-3 wiring #3/#4）', async ({ page }) => {
    await openDrillControls(page);
    await selectDrill(page, ENABLED_DRILL_ID, ENABLED_SCENE_ID);
    await armAndTakeRealLock(page);
    expectFlashed(await probe(page, TRACKING_PROBE, 'enabled/before-scene-trip'));

    // `loadSceneById()` 會 dispose 並**重建** `TargetView`（逐 mesh material 與命中態一併歸零）。
    // 走一趟離開再回來，回程那一次即是 wiring #3 + #4 同時發生。
    await loadScene(page, SECOND_SCENE_ID);
    await loadScene(page, ENABLED_SCENE_ID);
    await armAndTakeRealLock(page);
    expectFlashed(await probe(page, TRACKING_PROBE, 'enabled/after-scene-trip'));
  });
});
