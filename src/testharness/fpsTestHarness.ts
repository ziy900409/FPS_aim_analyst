import * as THREE from 'three/webgpu';
import { createSharedState, type SharedState } from '../state/SharedState.ts';
import { KEY_CODE } from '../state/types.ts';
import type { InputEvent, TargetState } from '../state/types.ts';
import { createTargetManager, type TargetManager } from '../sim/TargetManager.ts';
import { createDrillRunner, type DrillRunner } from '../drill/DrillRunner.ts';
import { createSimLoop, DEFAULT_RNG_SEED, type SimLoop } from '../loop/SimLoop.ts';
import { punchToThreeRad } from '../recoil/adapter.ts';
import { loadDrill } from '../drill/DrillLoader.ts';
import { resolveTargetHitbox, targetHitboxToConfig, type DrillConfig } from '../drill/DrillConfig.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { createDataRecorder, type DataRecorder, type DataRecorderSnapshot } from '../data/DataRecorder.ts';
import { collectMeta } from '../data/metadata.ts';
import { buildExportPayload, type ExportPayload } from '../data/export.ts';
import { PERF_FLOOR_MS } from '../display/constants.ts';
import { runEligibilityGate, type GateReport } from '../display/eligibilityGate.ts';
import type { FrameLogExport } from '../display/frameLog.ts';
import { applyResolutionMode, type DisplayState } from '../display/resolutionMode.ts';
import {
  createProtocolRunner,
  validateProtocol,
  type ProtocolConditionContext,
  type ProtocolConfig,
} from '../display/ProtocolRunner.ts';
import { brTrackingProtocol } from '../display/brTrackingProtocol.ts';
import { resolutionDetectionProtocol } from '../display/resolutionDetectionProtocol.ts';
import { computeMetrics, type Metrics } from '../metrics/compute.ts';
import { deriveTrackingMetrics, type TrackingDerivationResult } from '../metrics/trackingDerivation.ts';
import type { Clock } from '../loop/clock.ts';
import type { RenderBackend } from '../render/createRenderer.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import { getWeapon } from '../weapon/weapons.ts';

/**
 * fpsTestHarness — WP-9 / T1（FR-9.1）
 *
 * E2E 端到端整合的**測試掛點**（`window.__fpsTest`，僅 dev/test build，production 剝除）。供
 * Playwright 在真實瀏覽器（帶 COOP/COEP、`crossOriginIsolated===true`）跑「完整 drill → 匯出 →
 * 統計」全鏈路（README §2 data flow）。
 *
 * **設計決策（決定性 vs. 驅動 live 單例）**：本 harness 以**注入合成 clock** 自建一條與生產同源的
 * sim 管線（`createSimLoop`/`createDrillRunner`/`createTargetManager`/`createDataRecorder` +
 * `three/webgpu` camera + `collectMeta`/`buildExportPayload`/`computeMetrics`），**不**驅動 main.ts
 * 由 rAF 每幀 pump 的 live 單例。原因：live `simLoop` 綁 `realClock` 且被 render loop 每幀推進，
 * 對其注入合成輸入會與 rAF 競態、無法決定性重現。獨立管線 + 合成 clock 得到**零競態、exact** 的
 * 全鏈路一輪；E2E 相對 node 決定性單元測試的加值（真瀏覽器 COI / 真 `navigator` metadata / 真
 * drill JSON）完整保留。與 SimLoop 的合成 clock 決定性測試同骨架，抬升為真瀏覽器全鏈路（README §1 T3 相依）。
 *
 * **camera / hit**：目標於 ±SIDE_OFFSET、-distance 生成（TargetManager），故螢幕中心射線需先瞄準
 * active 目標才命中——`aimAtActiveTarget()` 於每次開火前 `lookAt` 當前 active 目標並
 * `updateMatrixWorld`（HitDetector 要求）。
 *
 * **時鐘域對齊**：合成 clock 從 0 起，`advanceOneTick()` 每次把 clock 推進一個 `tickMs` 並 pump
 * **恰好一個 tick**（`accSec += tickSec` → 1 tick），故 `clockMs === simTimeMs`（皆從 0 起、同步
 * 推進）。輸入事件 push 於 `t = clockMs`（= 上一 tick 末），下一 tick 的半開窗（嚴格 `<`）即消費。
 */

/** camera 幾何對齊 SceneManager 基準朝向（眼高 1.6、立於房間一端朝 -Z；raycast 純數學、無需 renderer）。 */
const EYE_HEIGHT = 1.6;
const CAMERA_Z = 4; // depth(10)/2 - standoff(1)，與 SceneManager 一致

/** 合成輸入序列（`feedInput`）的來源型別：即生產 InputEvent，`t` 為相對本次餵入起點的毫秒偏移。 */
export type HarnessInputEvent = InputEvent;

/** recoil punch 讀數（Source deg）：視覺 aimPunch（渲染用 ×1）與彈道 rawPunch（判定用 ×2）。 */
export interface RecoilReadout {
  aimPunchPitchDeg: number;
  aimPunchYawDeg: number;
  rawPunchPitchDeg: number;
  rawPunchYawDeg: number;
  recoilIndex: number;
  shotsFired: number;
}

export interface FpsTestHarness {
  /** 載入指定 drill → 建全新管線 → start → 推進過 countdown 至 running 且首目標可見。 */
  startDrill(id: string): void;
  /** 低階原語：依相對時間戳推進 sim 並餵入合成輸入（開火前自動瞄準 active 目標）。 */
  feedInput(seq: HarnessInputEvent[]): void;
  /** 便捷驅動：合成完整 counter-strafe 一輪（移動→急停→開火命中，左右交替），跑到 ended 或 peek 上限。 */
  runCounterStrafeRound(maxPeeks?: number): void;
  /** 便捷驅動：不開火，讓 detection pop-in presentations 依 peekTimeoutMs 自行推進直到 ended。 */
  runDetectionTimeoutRound(maxPresentations?: number): void;
  /** 便捷驅動：不開火，讓 tracking timed presentations 自行推進直到 ended。 */
  runTrackingPresentationRound(mode?: 'autoAim' | 'stationary', maxPresentations?: number): void;
  /**
   * WP-13 / T2：按住連發 `shots` 發（不自動瞄準,凍結 state.aim）→ 讓 recoil 純由連發累積,供
   * 「視覺/彈道分離」E2E 讀 punch 漂移方向 + 向量（10 發 = M5 向量）。回傳 kick 後讀數。
   */
  fireRecoilBurst(shots: number): RecoilReadout;
  /** 當前 recoil punch 讀數（視覺 aimPunch 與彈道 rawPunch=×2,Source deg）。 */
  getRecoilReadout(): RecoilReadout;
  /** 建匯出 payload（不觸發下載）；供 E2E 斷言 schema/事件/metadata。 */
  forceExportJSON(): ExportPayload;
  /** 由當前 recorder snapshot 計算 §5 指標（與結果頁同源 `computeMetrics`）。 */
  getMetrics(): Metrics;
  /** 由（可能經 JSON round-trip 的）匯出 payload 反算指標；供「統計＝匯出」一致性斷言。 */
  metricsFromExport(payload: ExportPayload): Metrics;
  /** 由匯出 payload 反算 tracking 指標；供 WP-22 T1 tracking scene E2E sanity。 */
  trackingMetricsFromExport(payload: ExportPayload): TrackingDerivationResult;
  /** 跑完 stage3 解析度 x 偵測 protocol，回傳每個條件的匯出 payload。 */
  runResolutionDetectionProtocol(protocol?: ProtocolConfig): Promise<ExportPayload[]>;
  /** 跑完 WP-26 BR tracking protocol，回傳每個條件的匯出 payload。 */
  runBrTrackingProtocol(protocol?: ProtocolConfig): Promise<ExportPayload[]>;
  /** 只跑資格閘判定；拒入 E2E 用此確認低解析度不會產生 protocol exports。 */
  previewResolutionProtocolGate(protocol?: ProtocolConfig, warmupP95Ms?: number): GateReport;
  /** 當前 drill 相位（唯讀）。 */
  phase(): DrillRunner['phase'];
}

export interface HarnessDeps {
  /** 可載入的 drill（id → 未解析 JSON 來源，交 loadDrill 驗證）。 */
  availableDrills: ReadonlyArray<{ id: string; source: unknown; scene?: SceneConfig }>;
  /** 可載入的場景 config（protocol condition 的 sceneId 解析用）。 */
  availableScenes?: ReadonlyArray<SceneConfig>;
  /** 真實 render backend（createRenderer seam），寫入匯出 metadata。 */
  backend: RenderBackend;
  /** 真實 crossOriginIsolated（runtime global），寫入匯出 metadata。 */
  crossOriginIsolated: boolean;
  /** 顯示更新率估計（Hz），寫入匯出 metadata。 */
  displayHz: number;
  /** 靈敏度設定，寫入匯出 metadata。 */
  sensitivity: number;
}

export function createFpsTestHarness(deps: HarnessDeps): FpsTestHarness {
  const tickMs = 1000 / SIM_HZ;
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, EYE_HEIGHT, CAMERA_Z);
  camera.lookAt(0, EYE_HEIGHT, -CAMERA_Z);
  camera.updateMatrixWorld(true);

  // 以下於每次 startDrill 重建，形成乾淨、與生產同源的獨立管線。
  let clockMs = 0;
  let state: SharedState = createSharedState();
  let recorder: DataRecorder = createDataRecorder({ simHz: SIM_HZ });
  let targetManager: TargetManager = createTargetManager();
  let drillRunner: DrillRunner = createDrillRunner(state, targetManager);
  let simLoop: SimLoop = createSimLoop(state, makeClock(), SIM_HZ, targetManager, camera, drillRunner, recorder);
  let config: DrillConfig | null = null;
  let sceneConfig: SceneConfig | undefined;
  let startedAt = '';

  function makeClock(): Clock {
    return { now: () => clockMs };
  }

  function activeTarget(): TargetState | undefined {
    for (let i = 0; i < state.targets.length; i++) {
      const t = state.targets[i];
      if (t.visible && t.alive) return t;
    }
    return undefined;
  }

  function activeWeaponConfig(): ReturnType<typeof getWeapon> {
    return getWeapon(config?.weaponId ?? 'ak47');
  }

  function findSceneConfig(sceneId: string): SceneConfig {
    const scene = deps.availableScenes?.find((candidate) => candidate.sceneId === sceneId);
    if (scene === undefined) throw new Error(`Unknown protocol scene: ${sceneId}`);
    return scene;
  }

  function createProtocolDisplayRenderer(): {
    renderer: {
      domElement: HTMLCanvasElement;
      setPixelRatio(pixelRatio: number): void;
      setSize(width: number, height: number, updateStyle?: boolean): void;
    };
  } {
    let pixelRatio = 1;
    const canvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
    } as HTMLCanvasElement;
    return {
      renderer: {
        domElement: canvas,
        setPixelRatio(next: number): void {
          pixelRatio = next;
        },
        setSize(width: number, height: number, updateStyle = true): void {
          canvas.width = Math.round(width * pixelRatio);
          canvas.height = Math.round(height * pixelRatio);
          if (updateStyle) {
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
          }
        },
      },
    };
  }

  function passedHarnessGate(required: ProtocolConfig['requiredDisplay']): GateReport {
    return {
      pass: true,
      native: true,
      fullscreen: true,
      perf: true,
      details: `harness pass: native/fullscreen/perf satisfy ${required.minW}x${required.minH}`,
    };
  }

  function harnessFrameLog(): FrameLogExport {
    const delta = Math.min(1000 / deps.displayHz, PERF_FLOOR_MS);
    return {
      series: [delta],
      summary: { count: 1, p50: delta, p95: delta, p99: delta, overBudgetWindows: 0, overflow: false },
    };
  }

  function aimAtActiveTarget(): void {
    const target = activeTarget();
    if (target === undefined) return;
    camera.lookAt(target.pos.x, target.pos.y, target.pos.z);
    camera.updateMatrixWorld(true); // HitDetector：raycast 前 caller 須更新 matrixWorld（offsetDeg 仍讀 camera）

    // WP-13 / T2：彈道走 `state.aim` + rawPunch(=aimPunch×2)——非 camera 中心。合成瞄準須把
    // state.aim 設為「指向目標並補償 −rawPunch」（模擬玩家壓槍），使 recoil 下彈道回正命中
    // （E2E firstShotHitRate=100 前提）。角度慣例與 SimLoop.ballisticRaycast / anglesToDir 一致。
    const dx = target.pos.x - camera.position.x;
    const dy = target.pos.y - camera.position.y;
    const dz = target.pos.z - camera.position.z;
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) return;
    const targetPitch = Math.asin(dy / len);
    const targetYaw = Math.atan2(-dx / len, -dz / len);
    const raw = punchToThreeRad(state.recoilState.aimPunchPitchDeg * 2, state.recoilState.aimPunchYawDeg * 2);
    state.aim.yaw = targetYaw - raw.yawRad;
    state.aim.pitch = targetPitch - raw.pitchRad;
  }

  function aimAtActiveTargetFromPlayerOrigin(): void {
    const target = activeTarget();
    if (target === undefined) return;
    const dx = target.pos.x - state.player.x;
    const dy = target.pos.y - EYE_HEIGHT;
    const dz = target.pos.z - state.player.z;
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) return;
    state.aim.yaw = Math.atan2(-dx, -dz);
    state.aim.pitch = Math.asin(dy / len);
  }

  /** 推進恰好一個固定 tick（clockMs += tickMs → pump 跑 1 tick；clockMs 與內部 simTimeMs 同步）。 */
  function advanceOneTick(): void {
    aimAtActiveTarget(); // 開火於 consume（movement 之前）判定命中，故瞄準須先於本 tick pump
    clockMs += tickMs;
    simLoop.pump(clockMs);
  }

  /** 推進一 tick 但**不**自動瞄準（供 recoil burst：凍結 state.aim,讓 recoil 純由連發累積）。 */
  function advanceOneTickNoAim(): void {
    clockMs += tickMs;
    simLoop.pump(clockMs);
  }

  function advanceOneTrackingTick(mode: 'autoAim' | 'stationary'): void {
    if (mode === 'autoAim') aimAtActiveTargetFromPlayerOrigin();
    advanceOneTickNoAim();
  }

  function advanceTicks(n: number): void {
    for (let i = 0; i < n; i++) advanceOneTick();
  }

  /** recoil punch 讀數（rawPunch = aimPunch×2；shotsFired 相對 baseAmmo）。 */
  function readRecoil(baseAmmo: number): RecoilReadout {
    const r = state.recoilState;
    return {
      aimPunchPitchDeg: r.aimPunchPitchDeg,
      aimPunchYawDeg: r.aimPunchYawDeg,
      rawPunchPitchDeg: r.aimPunchPitchDeg * 2,
      rawPunchYawDeg: r.aimPunchYawDeg * 2,
      recoilIndex: r.recoilIndex,
      shotsFired: baseAmmo - state.weapon.ammo,
    };
  }

  function pushInputEvent(ev: InputEvent, t: number): void {
    if (ev.type === 'key') state.input.pushKey(KEY_CODE[ev.code] ?? 0, ev.down, t);
    else if (ev.type === 'mouse') state.input.pushMouse(ev.dx, ev.dy, t);
    else if (ev.type === 'fire') state.input.pushFire(ev.down, t);
    else state.input.pushAds(ev.down, t);
  }

  function startDrillWithScene(id: string, sceneOverride?: SceneConfig): void {
      const entry = deps.availableDrills.find((candidate) => candidate.id === id);
      if (entry === undefined) throw new Error(`Unknown drill: ${id}`);
      sceneConfig = sceneOverride ?? entry.scene;
      config = loadDrill(entry.source, sceneConfig);

      // 全新管線（乾淨起步、與 live 單例隔離）。
      clockMs = 0;
      state = createSharedState();
      recorder = createDataRecorder({ simHz: SIM_HZ });
      targetManager = createTargetManager(config);
      drillRunner = createDrillRunner(state, targetManager);
      simLoop = createSimLoop(
        state,
        makeClock(),
        SIM_HZ,
        targetManager,
        camera,
        drillRunner,
        recorder,
        activeWeaponConfig(),
        config.sequence.seed,
      );
      startedAt = new Date().toISOString(); // wall-clock session metadata（非量測時鐘；main.ts 亦如此）

      drillRunner.start(config);
      // 推進過 countdown 直到 running 且首目標可見（上限保護避免卡死）。
      let guard = 0;
      while ((drillRunner.phase !== 'running' || activeTarget() === undefined) && guard < 4000) {
        advanceOneTick();
        guard++;
      }
  }

  function buildHarnessExport(
    protocolContext?: ProtocolConditionContext,
    display?: DisplayState,
    frames?: FrameLogExport,
  ): ExportPayload {
    if (config === null) throw new Error('forceExportJSON requires startDrill first');
    const snapshot = recorder.snapshot();
    const weaponConfig = activeWeaponConfig();
    const meta = collectMeta({
      drillId: config.drillId,
      weaponId: weaponConfig.id,
      weaponSeed: weaponConfig.recoil.seed,
      rngSeed: config.sequence.seed ?? DEFAULT_RNG_SEED,
      backend: deps.backend,
      displayHz: deps.displayHz,
      simHz: SIM_HZ,
      sensitivity: deps.sensitivity,
      crossOriginIsolated: deps.crossOriginIsolated,
      startedAt,
      lateEventCount: state.inputMeta.lateEventCount,
      bufferOverflow: state.inputMeta.bufferOverflow,
      recorderOverflow: snapshot.recorderOverflow,
      suspect: protocolContext?.suspect ?? false,
      weapon: {
        id: weaponConfig.id,
        ...(weaponConfig.ads !== undefined ? { ads: weaponConfig.ads } : {}),
        ...(weaponConfig.bullet !== undefined ? { bullet: weaponConfig.bullet } : {}),
        ...(weaponConfig.bullet !== undefined ? { projectileOverflow: state.bullets.overflowCount > 0 } : {}),
      },
      targets: {
        hitbox: targetHitboxToConfig(resolveTargetHitbox(config)),
      },
      spawn: {
        seed: config.sequence.seed ?? DEFAULT_RNG_SEED,
        ...(config.targets.spawnArea !== undefined ? { spawnArea: config.targets.spawnArea } : {}),
        ...(config.sequence.spawnDelayMsRange !== undefined ? { spawnDelayMsRange: config.sequence.spawnDelayMsRange } : {}),
        ...(config.targets.motion !== undefined ? { motion: config.targets.motion } : {}),
        ...(config.timing.presentationMs !== undefined ? { presentationMs: config.timing.presentationMs } : {}),
      },
      ...(sceneConfig !== undefined
        ? {
            scene: {
              sceneId: sceneConfig.sceneId,
              assetPackVersion: sceneConfig.assetPackVersion,
              clutterTier: sceneConfig.clutterTier,
              fallback: false,
            },
          }
        : {}),
      ...(display !== undefined ? { display } : {}),
      ...(frames !== undefined ? { frames } : {}),
      ...(protocolContext !== undefined
        ? {
            protocol: {
              protocolId: protocolContext.protocolId,
              conditionIndex: protocolContext.conditionIndex,
              conditionLabel: protocolContext.conditionLabel,
            },
          }
        : {}),
    });
    return buildExportPayload(meta, snapshot);
  }

  function runDetectionTimeoutRoundInternal(maxPresentations = Infinity): void {
    if (config === null) throw new Error('runDetectionTimeoutRound requires startDrill first');
    const seen = new Set<string>();
    let guard = 0;
    while (seen.size < maxPresentations && drillRunner.phase !== 'ended' && guard < 200000) {
      const target = activeTarget();
      if (target !== undefined) seen.add(target.id);
      advanceOneTick();
      guard++;
    }
    advanceTicks(4); // 讓 timeout 後的 targetCount 判定穩定落到 ended
  }

  function runTrackingPresentationRoundInternal(mode: 'autoAim' | 'stationary' = 'autoAim', maxPresentations = Infinity): void {
    if (config === null) throw new Error('runTrackingPresentationRound requires startDrill first');
    const seen = new Set<string>();
    let guard = 0;
    while (seen.size < maxPresentations && drillRunner.phase !== 'ended' && guard < 300000) {
      const target = activeTarget();
      if (target !== undefined) seen.add(target.id);
      advanceOneTrackingTick(mode);
      guard++;
    }
    for (let i = 0; i < 4; i++) advanceOneTrackingTick(mode);
  }

  async function runProtocol(
    protocol: ProtocolConfig,
    driveCondition: (context: ProtocolConditionContext) => void,
  ): Promise<ExportPayload[]> {
    const resolved = validateProtocol(protocol);
    const gate = passedHarnessGate(resolved.requiredDisplay);
    const { renderer } = createProtocolDisplayRenderer();
    let display: DisplayState | undefined;
    const payloads: ExportPayload[] = [];
    const runner = createProtocolRunner<ExportPayload>({
      config: resolved,
      applyCondition: (condition) => {
        const nextScene = findSceneConfig(condition.sceneId);
        display = {
          ...applyResolutionMode(renderer, condition.mode),
          fullscreen: true,
          refreshEstimateHz: deps.displayHz,
          gate,
        };
        startDrillWithScene(condition.drillId, nextScene);
        return {
          mode: display.mode,
          sceneId: nextScene.sceneId,
          drillId: config?.drillId ?? condition.drillId,
        };
      },
      exportCondition: (context) => buildHarnessExport(context, display, harnessFrameLog()),
    });

    let context: ProtocolConditionContext | undefined = await runner.start();
    while (context !== undefined) {
      driveCondition(context);
      const result = await runner.completeCurrentCondition();
      payloads.push(result.payload);
      if (result.context.conditionIndex >= resolved.conditions.length - 1) break;
      context = await runner.beginNextCondition();
    }
    return payloads;
  }

  return {
    startDrill(id: string): void {
      startDrillWithScene(id);
    },

    feedInput(seq: HarnessInputEvent[]): void {
      const sorted = [...seq].sort((a, b) => a.t - b.t);
      const base = clockMs;
      for (const ev of sorted) {
        const target = base + ev.t;
        while (clockMs < target) advanceOneTick();
        aimAtActiveTarget();
        pushInputEvent(ev, clockMs); // 對齊 tick grid 的當前 sim 時間；下一 tick 半開窗消費
        advanceOneTick();
      }
    },

    runCounterStrafeRound(maxPeeks = Infinity): void {
      if (config === null) throw new Error('runCounterStrafeRound requires startDrill first');
      let done = 0;
      let guard = 0;
      while (done < maxPeeks && drillRunner.phase !== 'ended' && guard < 100000) {
        guard++;
        if (activeTarget() === undefined) {
          advanceOneTick(); // 等目標生成（kill→spawn 有 1 tick 延遲）
          continue;
        }
        // 移動一方向 → 反向鍵急停（記 counter）→ 停止態開火命中（首發）→ kill → 對側補生。
        pushInputEvent({ type: 'key', code: 'KeyA', down: true, t: clockMs }, clockMs);
        advanceTicks(3); // vx → -vStrafe
        pushInputEvent({ type: 'key', code: 'KeyD', down: true, t: clockMs }, clockMs);
        advanceTicks(2); // counter 記錄（vx<0 + 按 D）；下一 tick 急停 vx→0
        aimAtActiveTarget();
        pushInputEvent({ type: 'fire', down: true, t: clockMs }, clockMs);
        advanceTicks(3); // 開火命中 → markKilled → 對側補生 + 蓋新 t_visible
        // WP-13 / T2：**tap fire**（每 peek 放開扳機）——counter-strafe 為單點射擊,亦使 recoil 不跨
        // peek 累積（否則 held 連發 recoilIndex climbs、彈道大幅上跳右漂 → 首發脫靶）。
        pushInputEvent({ type: 'fire', down: false, t: clockMs }, clockMs);
        pushInputEvent({ type: 'key', code: 'KeyA', down: false, t: clockMs }, clockMs);
        pushInputEvent({ type: 'key', code: 'KeyD', down: false, t: clockMs }, clockMs);
        advanceTicks(2); // 清 held，下一 peek 乾淨起步
        done++;
      }
      advanceTicks(4); // 讓相位機偵測 endCondition（達標晚一 tick）
    },

    runDetectionTimeoutRound(maxPresentations = Infinity): void {
      runDetectionTimeoutRoundInternal(maxPresentations);
    },

    runTrackingPresentationRound(mode = 'autoAim', maxPresentations = Infinity): void {
      runTrackingPresentationRoundInternal(mode, maxPresentations);
    },

    fireRecoilBurst(shots: number): RecoilReadout {
      if (config === null) throw new Error('fireRecoilBurst requires startDrill first');
      const startAmmo = state.weapon.ammo;
      pushInputEvent({ type: 'fire', down: true, t: clockMs }, clockMs);
      let guard = 0;
      // 不自動瞄準（凍結 state.aim）→ 命中/脫靶不影響 recoil 累積;連發至已產 shots 發。
      while (startAmmo - state.weapon.ammo < shots && guard < 100000) {
        advanceOneTickNoAim();
        guard++;
      }
      pushInputEvent({ type: 'fire', down: false, t: clockMs }, clockMs);
      advanceOneTickNoAim(); // 消費 fire-up、停止產彈（末發即取樣,不含其後尾端衰減）
      return readRecoil(startAmmo);
    },

    getRecoilReadout(): RecoilReadout {
      return readRecoil(state.weapon.magSize);
    },

    forceExportJSON(): ExportPayload {
      return buildHarnessExport();
    },

    getMetrics(): Metrics {
      return computeMetrics(recorder.snapshot());
    },

    metricsFromExport(payload: ExportPayload): Metrics {
      const snapshot: DataRecorderSnapshot = {
        ticks: payload.ticks,
        events: payload.events,
        recorderOverflow: payload.meta.recorderOverflow,
      };
      return computeMetrics(snapshot);
    },

    trackingMetricsFromExport(payload: ExportPayload): TrackingDerivationResult {
      return deriveTrackingMetrics(payload);
    },

    async runResolutionDetectionProtocol(protocol = resolutionDetectionProtocol): Promise<ExportPayload[]> {
      return runProtocol(protocol, (context) => {
        if (context.condition.drillId === 'detection_popin_v1') runDetectionTimeoutRoundInternal();
      });
    },

    async runBrTrackingProtocol(protocol = brTrackingProtocol): Promise<ExportPayload[]> {
      return runProtocol(protocol, () => {
        const weapon = activeWeaponConfig();
        const holdAds = weapon.ads !== undefined;
        if (holdAds) {
          pushInputEvent({ type: 'ads', down: true, t: clockMs }, clockMs);
          advanceOneTrackingTick('autoAim');
        }
        runTrackingPresentationRoundInternal('autoAim');
        if (holdAds) {
          pushInputEvent({ type: 'ads', down: false, t: clockMs }, clockMs);
          advanceOneTrackingTick('autoAim');
        }
      });
    },

    previewResolutionProtocolGate(protocol = resolutionDetectionProtocol, warmupP95Ms = 8): GateReport {
      const resolved = validateProtocol(protocol);
      return runEligibilityGate(resolved.requiredDisplay, warmupP95Ms);
    },

    phase(): DrillRunner['phase'] {
      return drillRunner.phase;
    },
  };
}
