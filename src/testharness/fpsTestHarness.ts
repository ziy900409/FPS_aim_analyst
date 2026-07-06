import * as THREE from 'three/webgpu';
import { createSharedState, type SharedState } from '../state/SharedState.ts';
import { KEY_CODE } from '../state/types.ts';
import type { InputEvent, TargetState } from '../state/types.ts';
import { createTargetManager, type TargetManager } from '../sim/TargetManager.ts';
import { createDrillRunner, type DrillRunner } from '../drill/DrillRunner.ts';
import { createSimLoop, type SimLoop } from '../loop/SimLoop.ts';
import { loadDrill } from '../drill/DrillLoader.ts';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { createDataRecorder, type DataRecorder, type DataRecorderSnapshot } from '../data/DataRecorder.ts';
import { collectMeta } from '../data/metadata.ts';
import { buildExportPayload, type ExportPayload } from '../data/export.ts';
import { computeMetrics, type Metrics } from '../metrics/compute.ts';
import type { Clock } from '../loop/clock.ts';
import type { RenderBackend } from '../render/createRenderer.ts';

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

export interface FpsTestHarness {
  /** 載入指定 drill → 建全新管線 → start → 推進過 countdown 至 running 且首目標可見。 */
  startDrill(id: string): void;
  /** 低階原語：依相對時間戳推進 sim 並餵入合成輸入（開火前自動瞄準 active 目標）。 */
  feedInput(seq: HarnessInputEvent[]): void;
  /** 便捷驅動：合成完整 counter-strafe 一輪（移動→急停→開火命中，左右交替），跑到 ended 或 peek 上限。 */
  runCounterStrafeRound(maxPeeks?: number): void;
  /** 建匯出 payload（不觸發下載）；供 E2E 斷言 schema/事件/metadata。 */
  forceExportJSON(): ExportPayload;
  /** 由當前 recorder snapshot 計算 §5 指標（與結果頁同源 `computeMetrics`）。 */
  getMetrics(): Metrics;
  /** 由（可能經 JSON round-trip 的）匯出 payload 反算指標；供「統計＝匯出」一致性斷言。 */
  metricsFromExport(payload: ExportPayload): Metrics;
  /** 當前 drill 相位（唯讀）。 */
  phase(): DrillRunner['phase'];
}

export interface HarnessDeps {
  /** 可載入的 drill（id → 未解析 JSON 來源，交 loadDrill 驗證）。 */
  availableDrills: ReadonlyArray<{ id: string; source: unknown }>;
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

  function aimAtActiveTarget(): void {
    const target = activeTarget();
    if (target === undefined) return;
    camera.lookAt(target.pos.x, target.pos.y, target.pos.z);
    camera.updateMatrixWorld(true); // HitDetector：raycast 前 caller 須更新 matrixWorld
  }

  /** 推進恰好一個固定 tick（clockMs += tickMs → pump 跑 1 tick；clockMs 與內部 simTimeMs 同步）。 */
  function advanceOneTick(): void {
    aimAtActiveTarget(); // 開火於 consume（movement 之前）判定命中，故瞄準須先於本 tick pump
    clockMs += tickMs;
    simLoop.pump(clockMs);
  }

  function advanceTicks(n: number): void {
    for (let i = 0; i < n; i++) advanceOneTick();
  }

  function pushInputEvent(ev: InputEvent, t: number): void {
    if (ev.type === 'key') state.input.pushKey(KEY_CODE[ev.code] ?? 0, ev.down, t);
    else if (ev.type === 'mouse') state.input.pushMouse(ev.dx, ev.dy, t);
    else state.input.pushFire(ev.down, t);
  }

  return {
    startDrill(id: string): void {
      const entry = deps.availableDrills.find((candidate) => candidate.id === id);
      if (entry === undefined) throw new Error(`Unknown drill: ${id}`);
      config = loadDrill(entry.source);

      // 全新管線（乾淨起步、與 live 單例隔離）。
      clockMs = 0;
      state = createSharedState();
      recorder = createDataRecorder({ simHz: SIM_HZ });
      targetManager = createTargetManager(config);
      drillRunner = createDrillRunner(state, targetManager);
      simLoop = createSimLoop(state, makeClock(), SIM_HZ, targetManager, camera, drillRunner, recorder);
      startedAt = new Date().toISOString(); // wall-clock session metadata（非量測時鐘；main.ts 亦如此）

      drillRunner.start(config);
      // 推進過 countdown 直到 running 且首目標可見（上限保護避免卡死）。
      let guard = 0;
      while ((drillRunner.phase !== 'running' || activeTarget() === undefined) && guard < 4000) {
        advanceOneTick();
        guard++;
      }
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
        pushInputEvent({ type: 'key', code: 'KeyA', down: false, t: clockMs }, clockMs);
        pushInputEvent({ type: 'key', code: 'KeyD', down: false, t: clockMs }, clockMs);
        advanceTicks(2); // 清 held，下一 peek 乾淨起步
        done++;
      }
      advanceTicks(4); // 讓相位機偵測 endCondition（達標晚一 tick）
    },

    forceExportJSON(): ExportPayload {
      if (config === null) throw new Error('forceExportJSON requires startDrill first');
      const snapshot = recorder.snapshot();
      const meta = collectMeta({
        drillId: config.drillId,
        backend: deps.backend,
        displayHz: deps.displayHz,
        simHz: SIM_HZ,
        sensitivity: deps.sensitivity,
        crossOriginIsolated: deps.crossOriginIsolated,
        startedAt,
        lateEventCount: state.inputMeta.lateEventCount,
        bufferOverflow: state.inputMeta.bufferOverflow,
        recorderOverflow: snapshot.recorderOverflow,
      });
      return buildExportPayload(meta, snapshot);
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

    phase(): DrillRunner['phase'] {
      return drillRunner.phase;
    },
  };
}
