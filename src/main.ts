import { assertIsolation } from './env/isolation.ts';
import { createRenderer } from './render/createRenderer.ts';
import { createSceneManagerWithStatus } from './render/SceneManager.ts';
import { TargetView } from './render/TargetView.ts';
import { ImpactView } from './render/ImpactView.ts';
import { TracerView } from './render/TracerView.ts';
import { createPointerLock } from './input/PointerLock.ts';
import { createInputSampler } from './input/InputSampler.ts';
import { CameraController } from './view/CameraController.ts';
import { createSettingsPanel } from './ui/SettingsPanel.ts';
import { createCrosshair } from './ui/Crosshair.ts';
import { createScopeOverlay } from './ui/ScopeOverlay.ts';
import { createExportPanel } from './ui/ExportPanel.ts';
import { createHUD, createHUDStats, type HUDStats } from './ui/HUD.ts';
import { createResultScreen, type QualityFlagsInput } from './ui/ResultScreen.ts';
import { createHistoryView } from './ui/HistoryView.ts';
import { createControls } from './ui/Controls.ts';
import { applyResolutionMode, type DisplayState, type ResolutionMode } from './display/resolutionMode.ts';
import {
  createProtocolRunner,
  type ProtocolConditionContext,
  type ProtocolConfig,
  type ProtocolRunner,
} from './display/ProtocolRunner.ts';
import { brTrackingProtocol } from './display/brTrackingProtocol.ts';
import { resolutionDetectionProtocol } from './display/resolutionDetectionProtocol.ts';
import { probeWarmupP95Ms } from './display/eligibilityGate.ts';
import { createExperimentSession } from './display/experimentSession.ts';
import { PERF_FLOOR_MS, SESSION_PLAN_MIN_CONDITION } from './display/constants.ts';
import { createFrameLog, frameLogCapacity } from './display/frameLog.ts';
import { createEligibilityGateScreen } from './ui/EligibilityGate.ts';
import {
  createSessionSetupForm,
  displaySelfReportFromSessionSetup,
  type SessionSetupValues,
} from './ui/SessionSetup.ts';
import { createSessionPlanSetup, type SessionPlanSelection } from './ui/SessionPlanSetup.ts';
import { createRestOverlay } from './ui/RestOverlay.ts';
import { createSessionRunner, type SessionRunnerHandle } from './session/SessionRunner.ts';
import { SESSION_PLAN_PRESETS } from './session/sessionPlanPresets.ts';
import { TEST_FAMILY_IDS } from './session/sessionSchedule.ts';
import { sharedState } from './state/SharedState.ts';
import { createTargetManager, type TargetManager } from './sim/TargetManager.ts';
import { loadDrill, type DrillLoadOptions } from './drill/DrillLoader.ts';
import { createDrillRunner, type DrillRunner } from './drill/DrillRunner.ts';
import { resolveTargetHitbox, targetHitboxToConfig, type DrillConfig } from './drill/DrillConfig.ts';
import { createSimLoop, DEFAULT_RNG_SEED, type SimLoop } from './loop/SimLoop.ts';
import { punchToThreeRad } from './recoil/adapter.ts';
import { createRenderLoop, lerp } from './loop/RenderLoop.ts';
import { realClock } from './loop/clock.ts';
import { SIM_HZ, SIM_TO_WORLD } from './loop/constants.ts';
import { createDataRecorder, type DataRecorderSnapshot } from './data/DataRecorder.ts';
import { DEFAULT_MAX_DRILL_SECONDS } from './data/RingBuffer.ts';
import { collectMeta, measureDisplayHz, measureDisplayRefresh, type AssessmentMeta } from './data/metadata.ts';
import { RAD_PER_COUNT, resolveMouseGain } from './input/mouseGain.ts';
import { buildExportPayload, downloadCSV, downloadJSON, type ExportPayload } from './data/export.ts';
import { loadAssessmentSessionSummaries } from './data/sessionHistoryLoader.ts';
import { createMetricsDashboard } from './metrics/MetricsDashboard.ts';
import { buildCompatibilityKey, checkQualityGate, deriveSessionId, type QualityGateStatus } from './metrics/compatibilityKey.ts';
import { evaluateDiagnosis, DIAGNOSIS_THRESHOLDS_V1, type DiagnosisInputs, type DiagnosisResult } from './metrics/diagnosisRules.ts';
import { STAGE6_BASELINE_MIN_N, STAGE6_BASELINE_WINDOW_SIZE, STAGE6_PROTOCOL_VERSION } from './drill/protocolVersion.ts';
import { deriveHoldClickMetrics } from './metrics/holdClickMetrics.ts';
import { deriveTrackingMetrics } from './metrics/trackingDerivation.ts';
import { buildSessionHistory, type SessionSummary } from './metrics/sessionHistory.ts';
import { getWeapon } from './weapon/weapons.ts';
import type { SceneConfig } from './scene/SceneConfig.ts';
import { resolveEyeWorldBase } from './scene/eyePose.ts';
import { isOutsideCorridor } from './scene/corridor.ts';
import { placeholderRoom } from './scene/scenes/placeholder-room.ts';
import { fieldLow } from './scene/scenes/field-low.ts';
import { urbanHigh } from './scene/scenes/urban-high.ts';
import { brField } from './scene/scenes/br-field.ts';
import { peekCorridor } from './scene/scenes/peek-corridor.ts';
import { detectionPopinV1 } from './drill/detection_popin_v1.ts';
import { trackingV1 } from './drill/tracking_v1.ts';
import { trackingSceneV1 } from './drill/tracking_scene_v1.ts';
import { trackingLongrangeV1 } from './drill/tracking_longrange_v1.ts';
import { trackingBrVariants } from './drill/tracking_br_v1.ts';
import { HOLD_CLICK_ONSET_THRESHOLD, HOLD_CLICK_VISIBILITY_SAMPLE_COUNT, holdClickV1 } from './drill/hold_click_v1.ts';
import { holdTrackV1 } from './drill/hold_track_v1.ts';
import { spiderShotV1 } from './drill/spider_shot_v1.ts';
import { counterstrafeReversalV1 } from './drill/counterstrafe_reversal_v1.ts';
import { counterstrafeFreeV1 } from './drill/counterstrafe_free_v1.ts';
import defaultDrillSource from '../drills/counterstrafe_ad_v1.json';

// 進入點必須走 'three/webgpu'（見 createRenderer），否則拿不到 WebGPURenderer。

// WP-0 / T2（FR-0.2）— 啟動先驗 cross-origin isolation（計時量測效度前置，ADR-4）。
const isolation = assertIsolation();
console.info('[isolation]', isolation);

const canvas = document.querySelector<HTMLCanvasElement>('#app')!;

// WP-0 seam：async bootstrap，取得 renderer + backend（backend 供 WP-7 metadata）。
const { renderer, backend } = await createRenderer(canvas);

interface AvailableDrill {
  id: string;
  label: string;
  source: unknown;
  sceneId?: string;
  loadOptions?: DrillLoadOptions;
}

interface AvailableScene {
  id: string;
  label: string;
  config: SceneConfig;
}

const availableScenes: AvailableScene[] = [
  { id: placeholderRoom.sceneId, label: 'placeholder-room', config: placeholderRoom },
  { id: fieldLow.sceneId, label: 'field-low', config: fieldLow },
  { id: urbanHigh.sceneId, label: 'urban-high', config: urbanHigh },
  { id: brField.sceneId, label: 'br-field', config: brField },
  { id: peekCorridor.sceneId, label: 'peek-corridor', config: peekCorridor },
];
let activeSceneConfig: SceneConfig = fieldLow;
let activeSceneFallback = false;

const initialDrillConfig = loadDrill(defaultDrillSource, activeSceneConfig);
const availableDrills: AvailableDrill[] = [
  { id: initialDrillConfig.drillId, label: initialDrillConfig.drillId, source: defaultDrillSource },
  { id: detectionPopinV1.drillId, label: detectionPopinV1.drillId, source: detectionPopinV1, sceneId: 'field-low' },
  { id: trackingV1.drillId, label: trackingV1.drillId, source: trackingV1 },
  {
    id: trackingSceneV1.id,
    label: trackingSceneV1.id,
    source: trackingSceneV1.drill,
    sceneId: trackingSceneV1.sceneId,
  },
  {
    id: trackingLongrangeV1.id,
    label: trackingLongrangeV1.id,
    source: trackingLongrangeV1.drill,
    sceneId: trackingLongrangeV1.sceneId,
  },
  {
    id: holdClickV1.id,
    label: holdClickV1.id,
    source: holdClickV1.drill,
    sceneId: holdClickV1.sceneId,
    loadOptions: { clearance: holdClickV1.clearanceOptions },
  },
  {
    id: holdTrackV1.id,
    label: holdTrackV1.id,
    source: holdTrackV1.drill,
    sceneId: holdTrackV1.sceneId,
    loadOptions: { clearance: holdTrackV1.clearanceOptions },
  },
  { id: spiderShotV1.drillId, label: spiderShotV1.drillId, source: spiderShotV1 },
  { id: counterstrafeReversalV1.drillId, label: counterstrafeReversalV1.drillId, source: counterstrafeReversalV1 },
  { id: counterstrafeFreeV1.drillId, label: counterstrafeFreeV1.drillId, source: counterstrafeFreeV1 },
  ...trackingBrVariants.map((variant) => ({
    id: variant.id,
    label: variant.id,
    source: variant.drill,
    sceneId: variant.sceneId,
  })),
];
let activeDrillConfig: DrillConfig = initialDrillConfig;
let activeDrillSource: unknown = defaultDrillSource;
let activeDrillLoadOptions: DrillLoadOptions = {};
let recorderStartedAt = new Date().toISOString();

// WP-1 / T1（FR-1.1）+ WP-19 / T2（FR-C2）— 舞台 + camera:async 場景載入管線。
// 預設載入 field-low GLTF 場景;載入失敗(斷網/壞 URL)自動 fallback 佔位房間(同一 config 路徑)。
// T4 接手場景切換 UI;此處先讓 field-low 實機可見(T2 DoD)。
const initialSceneLoad = await createSceneManagerWithStatus(activeSceneConfig);
let sceneManager = initialSceneLoad.manager;
activeSceneFallback = initialSceneLoad.fallback;

// WP-4 / T1（FR-4.1）— 目標渲染:唯讀 sharedState.targets 顯示/隱藏 mesh（狀態由 sim 改，見 T2/T3）。
let targetView = new TargetView(sceneManager.scene);

// WP-13 / T3（FR-B10）— 彈孔渲染:唯讀 sharedState.impacts（sim 命中時寫入）以單一 InstancedMesh
// 繪彈孔（1 draw call）。狀態由 sim 寫、本層唯讀（雙迴圈邊界）。
let impactView = new ImpactView(sceneManager.scene);

// WP-25 / T1（FR-E7）— tracer 渲染:唯讀 sharedState.shotRays（sim 產彈點寫入 origin→endpoint）。
// 顯示開關只存在 render 層，不進 sim / recorder / export。
let tracerView = new TracerView(sceneManager.scene);
let tracerEnabled = true;

let activeResolutionMode: ResolutionMode = 'native';
let displayState: DisplayState = applyResolutionMode(renderer, activeResolutionMode);

function resize(): void {
  displayState = applyResolutionMode(renderer, activeResolutionMode);
  sceneManager.resize(displayState.cssW, displayState.cssH);
}
resize();
window.addEventListener('resize', resize);

function activeWeaponConfig() {
  return getWeapon(activeDrillConfig.weaponId ?? 'ak47');
}

// WP-1 / T2（FR-1.2）— Pointer Lock：click 取得、Esc/失焦解除、可重取。
const pointerLock = createPointerLock(canvas);

// 「點擊以鎖定」提示（DOM overlay, D1）：解鎖時顯示、鎖定時隱藏（OQ-1.3）。
// pointer-events:none 讓點擊穿透到 canvas；T5 會接更完整的設定面板。
const lockHint = document.createElement('div');
lockHint.id = 'lock-hint';
lockHint.textContent = '點擊以鎖定滑鼠視角（Esc 解除）';
lockHint.style.cssText = [
  'position:fixed',
  'inset:0',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  'font:600 18px/1.4 system-ui,sans-serif',
  'color:#e6e9ec',
  'background:rgba(16,18,20,0.55)',
  'pointer-events:none',
  'user-select:none',
  'z-index:10',
].join(';');
document.body.appendChild(lockHint);

function updateLockHint(locked: boolean): void {
  lockHint.style.display = locked ? 'none' : 'flex';
}
updateLockHint(pointerLock.locked);
pointerLock.onChange(updateLockHint);

// T3（FR-1.3）— 鎖定後回報是否啟用原始輸入（unadjustedMovement）。false = 走 fallback，
// 影響可重現性，WP-7 需寫入匯出 metadata。
pointerLock.onChange((locked) => {
  if (locked) console.info('[pointerlock] rawInputEnabled =', pointerLock.rawInputEnabled);
});

canvas.addEventListener('click', () => {
  if (pointerLock.locked) return;
  // 失敗時由 pointerlockerror 事件驅動 UI 復原，故吞掉 request 的 rejection。
  void pointerLock.request().catch(() => {});
});

// WP-1 / T4（FR-1.4）— yaw/pitch 視角：鎖定中的滑鼠 delta 累積到 camera 朝向。
// 走輸入/render 路徑，不入 sim（雙迴圈邊界，WP-2）；onMove 僅 locked 時轉發（T2）。
const cameraController = new CameraController(sceneManager.camera, sharedState.aim);
pointerLock.onMove((dx, dy) => cameraController.applyDelta(dx, dy));
// WP-24 / T2（FR-E5）— 當前武器 ADS 光學佈線（render loop 每幀讀 heldAds → FOV/gain）；
// undefined = 該武器不可開鏡。換 drill/武器時於 loadDrillById 重設。
cameraController.setAdsConfig(activeWeaponConfig().ads);

// WP-1 / T5（FR-1.5）— sensitivity/FOV 設定面板（DOM overlay, D1）：拖動即時生效。
// 面板為這兩個設定的單一真實來源（建構時推預設給 controller），值供 WP-7 metadata。
// 鎖定中隱藏、解除時顯示（OQ-1.3）。
const topLeftControls = document.createElement('div');
topLeftControls.id = 'top-left-controls';
topLeftControls.style.cssText = [
  'position:fixed',
  'top:16px',
  'left:16px',
  'display:flex',
  'flex-direction:column',
  'align-items:stretch',
  'gap:12px',
  'pointer-events:auto',
].join(';');
const sessionLaunchControls = document.createElement('div');
sessionLaunchControls.id = 'session-launch-controls';
sessionLaunchControls.setAttribute('aria-label', 'Session launch controls');
sessionLaunchControls.style.cssText = [
  'position:relative',
  'display:flex',
  'flex-direction:column',
  'gap:8px',
  'z-index:40',
].join(';');
topLeftControls.appendChild(sessionLaunchControls);
document.body.appendChild(topLeftControls);

const settingsPanel = createSettingsPanel({
  onSensitivityChange: (s) => cameraController.setSensitivity(s),
  onFovChange: (deg) => cameraController.setFov(deg),
  initialResolutionMode: activeResolutionMode,
  parent: topLeftControls,
  onResolutionModeChange: (mode) => {
    activeResolutionMode = mode;
    resize();
  },
});

// WP-4 / T4（FR-4.4）— 螢幕中心準心（DOM overlay, D1）：瞄準參考 + §5 準心對齊偏移的視覺基準。
// 恆顯示（不隨鎖定切換）：第一人稱射線走 camera 中心，準心即射線方向指示。
createCrosshair();
const scopeOverlay = createScopeOverlay();

// WP-20 / T2（FR-C7）— 資格閘 + 實驗 session 進入流程（GD-10 防線①）。通過三檢查（原生解析度 ≥
// 實驗最高條件、fullscreen 已進入、warmup 效能地板）才進入實驗 session;不合格 = **拒入並明示原因**
// （防 FHD 面板混入 QHD 條件）。session 進行中退出 fullscreen → 標 suspect（純觀測,OR 進匯出 meta,
// 不中斷 drill）;gate 全量進 meta.display.gate 供事後審查。protocol 排程本體歸 WP-22 T2（此為最小落地）。
const experimentSession = createExperimentSession({
  onSuspect: () => eligibilityGateScreen.showSuspectWarning(),
});
let pendingSessionSetupValues: SessionSetupValues | undefined;
let sessionSetupValues: SessionSetupValues | undefined;
let pendingSessionPlanSelection: SessionPlanSelection | undefined;
let activeSessionPlanPreset: string | undefined;
let pendingSessionMode: 'session' | 'resolution-protocol' | 'br-tracking-protocol' | 'session-plan' = 'session';
let markProtocolFullscreenExit: (() => void) | undefined;
const eligibilityGateScreen = createEligibilityGateScreen({
  // Session Plan（選手表現測試,WP-42）不操弄/比較解析度條件——四家族一律 native 載入,
  // 不適用 resolution/BR protocol 的 QHD 門檻(那是給「受試者內解析度操弄」研究效度用的,見
  // constants.ts GD-10)。其餘模式（實驗 session、解析度/BR protocol）維持既有 QHD 門檻。
  required: () =>
    pendingSessionMode === 'session-plan'
      ? SESSION_PLAN_MIN_CONDITION
      : resolutionDetectionProtocol.requiredDisplay,
  requestFullscreen: () => document.documentElement.requestFullscreen(),
  probeWarmupP95Ms: () => probeWarmupP95Ms(),
  onEnter: (report) => {
    const requestedMode = pendingSessionMode;
    pendingSessionMode = 'session';
    if (pendingSessionSetupValues !== undefined) {
      sessionSetupValues = pendingSessionSetupValues;
      pendingSessionSetupValues = undefined;
    }
    eligibilityGateScreen.hideSuspectWarning();
    experimentSession.enter(report);
    if (requestedMode === 'resolution-protocol') void startResolutionProtocol();
    else if (requestedMode === 'br-tracking-protocol') void startBrTrackingProtocol();
    else if (requestedMode === 'session-plan') void startSessionPlan();
  },
});
const sessionPlanSetup = createSessionPlanSetup({
  presets: SESSION_PLAN_PRESETS,
  families: TEST_FAMILY_IDS,
  onSubmit: (selection) => {
    pendingSessionPlanSelection = selection;
    eligibilityGateScreen.open();
  },
});
const sessionSetupForm = createSessionSetupForm({
  getDetectedDisplay: () => ({ screenW: displayState.screenW, screenH: displayState.screenH }),
  onSubmit: (values) => {
    pendingSessionSetupValues = values;
    if (pendingSessionMode === 'session-plan') sessionPlanSetup.open();
    else eligibilityGateScreen.open();
  },
});
document.addEventListener('fullscreenchange', () => {
  const fullscreen = document.fullscreenElement != null;
  // KI-007（2026-08-07）：只在 drill 實際錄製中（countdown/running）才視為 GD-10 條件失效；idle
  // （drill 之間,單一「實驗 session」流程不會為此呼叫 experimentSession.exit()）與 ended（已收工,
  // 準備匯出)退出全螢幕不算,避免把「錄完正常退出全螢幕去抓匯出檔」誤判為錄製中途失效。
  const recording = drillRunner.phase === 'countdown' || drillRunner.phase === 'running';
  experimentSession.handleFullscreenChange(fullscreen, recording);
  if (!fullscreen) markProtocolFullscreenExit?.();
});

// 最小啟動器：解鎖時可開資格閘（fullscreen 請求須在 user gesture 內,故走按鈕點擊）。
const experimentButton = document.createElement('button');
experimentButton.type = 'button';
experimentButton.textContent = '實驗 session';
experimentButton.title = '進入資格閘（GD-10 防線①）';
experimentButton.style.cssText = [
  'width:100%',
  'height:34px',
  'padding:0 14px',
  'border:1px solid rgba(255,255,255,0.18)',
  'border-radius:6px',
  'font:750 12px/1 system-ui,sans-serif',
  'color:#e6e9ec',
  'background:rgba(15,18,21,0.96)',
  'cursor:pointer',
].join(';');
experimentButton.addEventListener('click', () => {
  pendingSessionMode = 'session';
  sessionSetupForm.open();
});
sessionLaunchControls.appendChild(experimentButton);

const protocolButton = document.createElement('button');
protocolButton.type = 'button';
protocolButton.textContent = '解析度 protocol';
protocolButton.title = '執行受試者內解析度 × 偵測 protocol';
protocolButton.style.cssText = experimentButton.style.cssText;
protocolButton.addEventListener('click', () => {
  pendingSessionMode = 'resolution-protocol';
  sessionSetupForm.open();
});
sessionLaunchControls.appendChild(protocolButton);
const brProtocolButton = document.createElement('button');
brProtocolButton.type = 'button';
brProtocolButton.textContent = 'BR protocol';
brProtocolButton.title = '執行 BR 跟槍 ADS × 彈道 × 角尺寸 protocol';
brProtocolButton.style.cssText = experimentButton.style.cssText;
brProtocolButton.addEventListener('click', () => {
  pendingSessionMode = 'br-tracking-protocol';
  sessionSetupForm.open();
});
sessionLaunchControls.appendChild(brProtocolButton);
const sessionPlanButton = document.createElement('button');
sessionPlanButton.type = 'button';
sessionPlanButton.textContent = 'Session Plan';
sessionPlanButton.title = '選擇家族與具名 preset 後執行 session plan';
sessionPlanButton.style.cssText = experimentButton.style.cssText;
sessionPlanButton.addEventListener('click', () => {
  pendingSessionMode = 'session-plan';
  sessionSetupForm.open();
});
sessionLaunchControls.appendChild(sessionPlanButton);
pointerLock.onChange((locked) => {
  topLeftControls.style.display = locked ? 'none' : 'flex';
});

// KI-005 / A（FR-A-1/7）— tick 窗 mouse 積分的感度 gain：與 collectMeta 的 meta.mouseIntegration
// 用**同一個 MouseGain 物件**產生（buildCurrentExportPayload 內另算一份，值必然相同），故兩者不可能發散。
function currentMouseGain() {
  return resolveMouseGain({
    sensitivity: settingsPanel.sensitivity,
    hipFovDeg: settingsPanel.fov,
    ads: activeWeaponConfig().ads,
  });
}

// WP-7 / T4（FR-7.4）— 匯出控制：讀取 recorder snapshot + metadata 後下載 JSON/CSV。
// 讀取與序列化只在 click handler 內發生，不進 sim tick 熱路徑。
// KI-005 / A（FR-A-7，OQ-A-1「全域開」）：app 佈線層啟用 mouse 積分——opt-in 只保 golden 逐位不變，
// 不得成為「功能上線但實務未生效」。
// KI-005-A / OQ-A-2 / TD-5（2026-08-07 A2-T1 前置決策再拍板：開）：啟用 additive `key` 事件記錄，
// 供離線推導原移動鍵的 sub-tick 釋放時刻（KI-006 構念分析需要，補 tick-derived release 的 ±1 tick
// 量化）。關閉時匯出逐位不變（NFR-A-2 同一紀律），開啟只新增資料，不改既有欄位語意。
const recorder = createDataRecorder({
  simHz: SIM_HZ,
  mouseIntegration: { gain: currentMouseGain() },
  recordKeyEvents: true,
});
const frameLog = createFrameLog(frameLogCapacity(DEFAULT_MAX_DRILL_SECONDS));
async function buildCurrentExportPayload(
  protocolContext?: ProtocolConditionContext,
  assessmentFeedbackPolicy: AssessmentMeta['assessmentFeedbackPolicy'] = 'minimal-end-of-block',
): Promise<ExportPayload> {
  const snapshot = recorder.snapshot();
  const weaponConfig = activeWeaponConfig();
  const frames = frameLog.export(PERF_FLOOR_MS);
  const displayRefresh = frameLog.refreshEstimate() ?? (await measureDisplayRefresh());
  const displayHz = displayRefresh.refreshEstimateHz;
  const displaySelfReport =
    sessionSetupValues === undefined
      ? {}
      : displaySelfReportFromSessionSetup(sessionSetupValues, {
          screenW: displayState.screenW,
          screenH: displayState.screenH,
        });
  const currentDisplay: DisplayState = {
    ...displayState,
    ...displaySelfReport,
    refreshEstimateHz: displayRefresh.refreshEstimateHz,
    refreshMedianDeltaMs: displayRefresh.medianDeltaMs,
    // GD-10 防線①:資格閘全量明細,僅實驗 session 進入時填入（事後審查依據）。
    ...(experimentSession.gate !== undefined ? { gate: experimentSession.gate } : {}),
  };
  // KI-005 / A T2(FR-A-5/6):meta 自我描述滑鼠感度鏈,ADS gain 才可離線重建。
  const mouseGain = resolveMouseGain({
    sensitivity: settingsPanel.sensitivity,
    hipFovDeg: settingsPanel.fov,
    ads: weaponConfig.ads,
  });
  const meta = collectMeta({
    drillId: activeDrillConfig.drillId,
    weaponId: weaponConfig.id,
    weaponSeed: weaponConfig.recoil.seed,
    rngSeed: activeDrillConfig.spiderShot?.seed ?? activeDrillConfig.sequence.seed ?? DEFAULT_RNG_SEED,
    backend,
    displayHz,
    simHz: SIM_HZ,
    sensitivity: settingsPanel.sensitivity,
    ...(sessionSetupValues?.dpi !== undefined ? { dpi: sessionSetupValues.dpi } : {}),
    ...(sessionPlanRunner.phase.kind === 'family' && activeSessionPlanPreset !== undefined
      ? { sessionPlanPreset: activeSessionPlanPreset }
      : {}),
    fovDeg: settingsPanel.fov,
    crossOriginIsolated: isolation.crossOriginIsolated,
    startedAt: recorderStartedAt,
    lateEventCount: sharedState.inputMeta.lateEventCount,
    bufferOverflow: sharedState.inputMeta.bufferOverflow,
    recorderOverflow: snapshot.recorderOverflow,
    // 純觀測 suspect:實驗 session 中途退出 fullscreen(GD-10 failure mode)、或 drill frame p95
    // 超過效能地板(GD-10 防線③)。玩家逸出走廊**不在此列**(K-3,KI-004 / S1 T3):越界的真實
    // 後果是視覺遮擋,而場景幾何永不進 sim(GD-6),不可能影響命中判定 —— 屬「該記錄的觀測」而非
    // 「該作廢的 run」,越界事實改由下方 meta.validity.corridorExceeded 記錄。
    suspect:
      (protocolContext === undefined ? experimentSession.suspect : protocolContext.suspect) ||
      frames.summary.p95 > PERF_FLOOR_MS,
    simToWorld: SIM_TO_WORLD,
    // meta.validity(KI-004 / S1 T2,FR-S1-15):與上面的 suspect **不是同一集合**,純觀測拆解,
    // 前拉自 OQ-S1-2;`suspect` 本身的 OR 集合逐位不變。
    validity: {
      corridorExceeded: sharedState.validity.playerCorridorExceeded,
      perfFloor: frames.summary.p95 > PERF_FLOOR_MS,
      recorderOverflow: snapshot.recorderOverflow,
      bufferOverflow: sharedState.inputMeta.bufferOverflow > 0,
    },
    weapon: {
      id: weaponConfig.id,
      ...(weaponConfig.ads !== undefined ? { ads: weaponConfig.ads } : {}),
      ...(weaponConfig.bullet !== undefined ? { bullet: weaponConfig.bullet } : {}),
      ...(weaponConfig.bullet !== undefined ? { projectileOverflow: sharedState.bullets.overflowCount > 0 } : {}),
    },
    mouseIntegration: {
      model: 'tick-window-integral',
      radPerCount: RAD_PER_COUNT,
      hipStep: mouseGain.hipStep,
      adsStep: mouseGain.adsStep,
    },
    targets: {
      hitbox: targetHitboxToConfig(resolveTargetHitbox(activeDrillConfig)),
    },
    spawn: {
      seed: activeDrillConfig.spiderShot?.seed ?? activeDrillConfig.sequence.seed ?? DEFAULT_RNG_SEED,
      ...(activeDrillConfig.targets.spawnArea !== undefined ? { spawnArea: activeDrillConfig.targets.spawnArea } : {}),
      ...(activeDrillConfig.spiderShot !== undefined ? { spiderShot: activeDrillConfig.spiderShot } : {}),
      ...(activeDrillConfig.sequence.spawnDelayMsRange !== undefined
        ? { spawnDelayMsRange: activeDrillConfig.sequence.spawnDelayMsRange }
        : {}),
      ...(activeDrillConfig.targets.motion !== undefined ? { motion: activeDrillConfig.targets.motion } : {}),
      ...(activeDrillConfig.timing.presentationMs !== undefined
        ? { presentationMs: activeDrillConfig.timing.presentationMs }
        : {}),
    },
    scene: {
      sceneId: activeSceneConfig.sceneId,
      assetPackVersion: activeSceneConfig.assetPackVersion,
      clutterTier: activeSceneConfig.clutterTier,
      fallback: activeSceneFallback,
      // eye world base(KI-004 / S1 T2,FR-S1-14):data 層純函式決定性算出,**不**從
      // sceneManager.camera.position 讀(camera 經 alpha 內插,讀它會破壞決定性 + 違反 ADR-2)。
      eye: resolveEyeWorldBase(activeSceneConfig),
    },
    display: currentDisplay,
    frames,
    ...(sessionSetupValues !== undefined
      ? {
          session: {
            participantId: sessionSetupValues.participantId,
            ...(sessionSetupValues.sessionLabel !== undefined
              ? { sessionLabel: sessionSetupValues.sessionLabel }
              : {}),
          },
        }
      : {}),
    ...(protocolContext !== undefined
      ? {
          protocol: {
            protocolId: protocolContext.protocolId,
            conditionIndex: protocolContext.conditionIndex,
            conditionLabel: protocolContext.conditionLabel,
          },
        }
      : {}),
    ...(activeDrillConfig.mode === 'assessment'
      ? {
          assessment: {
            protocolVersion: STAGE6_PROTOCOL_VERSION,
            assessmentFeedbackPolicy,
          },
        }
      : {}),
  });
  return buildExportPayload(meta, snapshot);
}

function diagnosisForPayload(payload: ExportPayload): DiagnosisResult {
  return evaluateDiagnosis(
    diagnosisInputsForPayload(payload),
    DIAGNOSIS_THRESHOLDS_V1,
    qualityGateStatusFor(payload),
  );
}

function qualityFlagsForPayload(payload: ExportPayload): QualityFlagsInput {
  return {
    lateEventCount: payload.meta.lateEventCount,
    bufferOverflow: payload.meta.bufferOverflow,
    recorderOverflow: payload.meta.recorderOverflow,
    suspect: payload.meta.suspect,
    ...(payload.meta.validity === undefined
      ? {}
      : {
          validity: {
            corridorExceeded: payload.meta.validity.corridorExceeded,
            perfFloor: payload.meta.validity.perfFloor,
          },
        }),
  };
}

function sessionSummaryFromPayload(payload: ExportPayload): SessionSummary {
  const qualityGateStatus = qualityGateStatusFor(payload);
  const inputs = diagnosisInputsForPayload(payload);
  const diagnosis = evaluateDiagnosis(inputs, DIAGNOSIS_THRESHOLDS_V1, qualityGateStatus);
  const historyMetrics = historyMetricsFor(payload, inputs);
  return {
    compatibilityKey: buildCompatibilityKey(payload.meta, payload.meta.drillId, targetConditionCell(payload), qualityGateStatus),
    sessionId: deriveSessionId(payload.meta),
    startedAt: payload.meta.startedAt,
    diagnosis,
    speedMetric: historyMetrics.speedMetric,
    accuracyMetric: historyMetrics.accuracyMetric,
  };
}

function diagnosisInputsForPayload(payload: ExportPayload): DiagnosisInputs {
  const trackingOptions = payload.meta.targets === undefined ? {} : { hitbox: targetHitboxFromMeta(payload) };
  if (payload.meta.drillId === holdClickV1.drill.drillId) {
    const scene = sceneForPayload(payload);
    return {
      holdClick: deriveHoldClickMetrics(payload, scene, {
        sampleCount: HOLD_CLICK_VISIBILITY_SAMPLE_COUNT,
        onsetThreshold: HOLD_CLICK_ONSET_THRESHOLD,
        ...trackingOptions,
      }),
    };
  }
  if (payload.meta.drillId === holdTrackV1.drill.drillId) {
    const tracking = deriveTrackingMetrics(payload, trackingOptions);
    const totValues = tracking.presentations.flatMap((presentation) =>
      presentation.totPercent === undefined ? [] : [presentation.totPercent],
    );
    return {
      holdTrack: {
        totPercent: average(totValues),
        dropCount: 0,
      },
    };
  }
  return {};
}

function historyMetricsFor(
  payload: ExportPayload,
  inputs: DiagnosisInputs,
): Pick<SessionSummary, 'speedMetric' | 'accuracyMetric'> {
  if (inputs.holdClick !== undefined) {
    const acquisition = inputs.holdClick.presentations.flatMap((item) =>
      item.acquisitionFromDetectMs === undefined ? [] : [item.acquisitionFromDetectMs],
    );
    const firstShots = inputs.holdClick.presentations.flatMap((item) => (item.firstShotHit === undefined ? [] : [item.firstShotHit]));
    return {
      speedMetric: { id: 'hold-click.acquisition-ms', value: average(acquisition) },
      accuracyMetric: { id: 'hold-click.first-shot-hit-rate', value: firstShots.filter(Boolean).length / firstShots.length },
    };
  }
  if (inputs.holdTrack !== undefined) {
    const tracking = deriveTrackingMetrics(payload, { hitbox: targetHitboxFromMeta(payload) });
    const acquisition = tracking.presentations.flatMap((item) => (item.tAcquireMs === undefined ? [] : [item.tAcquireMs]));
    return {
      speedMetric: { id: 'hold-track.acquisition-ms', value: average(acquisition) },
      accuracyMetric: { id: 'hold-track.tot-percent', value: inputs.holdTrack.totPercent },
    };
  }
  throw new Error(`No history metric mapping for drill ${payload.meta.drillId}`);
}

function qualityGateStatusFor(payload: ExportPayload): QualityGateStatus {
  const visibleSampleCount = payload.events.filter((event) => event.type === 'visible').length;
  return checkQualityGate({ n: visibleSampleCount, minN: 1, suspect: payload.meta.suspect, compatible: true });
}

function targetConditionCell(payload: ExportPayload): string {
  const hitbox = targetHitboxFromMeta(payload);
  return `scene=${payload.meta.scene?.sceneId ?? 'unspecified'};hitbox=${hitbox.width}x${hitbox.height}x${hitbox.depth}`;
}

function targetHitboxFromMeta(payload: ExportPayload): { width: number; height: number; depth: number } {
  const hitbox = payload.meta.targets?.hitbox;
  return hitbox === undefined
    ? resolveTargetHitbox()
    : { width: hitbox.widthU, height: hitbox.heightU, depth: hitbox.depthU };
}

function sceneForPayload(payload: ExportPayload): SceneConfig {
  const sceneId = payload.meta.scene?.sceneId;
  return availableScenes.find((candidate) => candidate.id === sceneId)?.config ?? activeSceneConfig;
}

function average(values: readonly number[]): number {
  if (values.length === 0) throw new Error('No finite samples are available for this history metric');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function exportBasename(payload: ExportPayload): string {
  const protocol = payload.meta.protocol;
  const condition = protocol === undefined ? '' : `-${protocol.conditionIndex + 1}-${protocol.conditionLabel}`;
  return `${payload.meta.drillId}${condition}-${payload.meta.startedAt}`;
}

function snapshotFromExportPayload(payload: ExportPayload): DataRecorderSnapshot {
  return {
    ticks: payload.ticks,
    events: payload.events,
    recorderOverflow: payload.meta.recorderOverflow,
  };
}

createExportPanel({
  async onExportJSON(): Promise<void> {
    const payload = await buildCurrentExportPayload();
    downloadJSON(payload, { basename: exportBasename(payload) });
  },
  async onExportCSV(): Promise<void> {
    const payload = await buildCurrentExportPayload();
    downloadCSV(payload, { basename: exportBasename(payload) });
  },
});

// WP-8 / T2（FR-8.2）— 賽後結果頁：drill ended 後以同一 recorder snapshot 計算並呈現 §5 指標。
const metricsDashboard = createMetricsDashboard();
let currentHistorySession: SessionSummary | undefined;
const historyView = createHistoryView({
  async onFilesSelected(files) {
    if (currentHistorySession === undefined) {
      return { status: 'insufficient-data', reason: 'Complete an Assessment session before loading history exports.' };
    }
    const past = await loadAssessmentSessionSummaries(files, sessionSummaryFromPayload);
    return buildSessionHistory(currentHistorySession, past, STAGE6_BASELINE_WINDOW_SIZE, STAGE6_BASELINE_MIN_N);
  },
});
const resultScreen = createResultScreen({ historyView: historyView.element });
// WP-8 / T3（FR-8.3）— 即時 HUD：rAF 只讀 SharedState + recorder counters，不進 sim、不 snapshot。
const hud = createHUD();

// WP-3 / T1+T3（FR-3.1/3.3）— 輸入採集：keydown/keyup（A/D/W/S）與開火 mousedown（左鍵）蓋
// event.timeStamp 寫入 sharedState.input，供 sim（T4）依時序消費。事件驅動（非固定迴圈，ADR-2）；
// 掛在 window（鍵盤事件不落在 canvas；lock 中滑鼠事件亦冒泡至 window）。開火以 pointerLock.locked
// 為採計閘門——否則「點擊 canvas 取鎖」與 UI 點擊會被誤判為開火（T3）。與 CameraController（視角走
// pointerLock.onMove）互不干擾——此處只入緩衝供量測（WP-3 目的）。
const inputSampler = createInputSampler(sharedState, () => pointerLock.locked);
inputSampler.attach(window);
pointerLock.onChange((locked) => {
  if (!locked) {
    sharedState.heldFire = false;
    sharedState.weapon.nextFireT = Infinity;
    // WP-24 / T2 stuck-ads 防護（D-T1.1）：解鎖時仍按住右鍵 → 補送可被消費/記錄的 ads-up
    // 事件（非直接寫 heldAds 旗標），避免 heldAds 永真污染後續 drill。
    inputSampler.releaseAds(performance.now());
  }
});

// WP-2 / T2+T3（FR-2.2/2.3）— 雙迴圈：sim（128 Hz 固定步長 accumulator）與 render（rAF）解耦，
// 全透過 sharedState 溝通（ADR-2）。階段 A 單執行緒下，sim 在 render 的 rAF callback 內 pump（§4.3
// 「單一 rAF 超級迴圈」，DESIGN §1）；階段 B 才把 sim 搬入 worker。
// WP-4 / T2（FR-4.2）— 目標系統在 sim tick 內 spawn/可見性/蓋 t_visible（傳入 simLoop，
// tick 由 simStep 呼叫；時間源為 sim clock，非 rAF）。
// WP-5 / T1（FR-5.1）— fire 事件在 sim tick 內就地 raycast（camera 中心射線 → 命中即擊殺）。
// 傳入 sceneManager.camera：sim 唯讀其朝向（由 CameraController 走輸入路徑寫入，非 sim；雙迴圈邊界）。
let activeTargetManager = createTargetManager(activeDrillConfig);
let activeDrillRunner = createDrillRunner(sharedState, activeTargetManager);
const targetManager: TargetManager = {
  tick(state, nowMs): void {
    activeTargetManager.tick(state, nowMs);
  },
  markKilled(state, id): void {
    activeTargetManager.markKilled(state, id);
  },
  reset(state, seq): void {
    activeTargetManager.reset(state, seq);
  },
};
const drillRunner: DrillRunner = {
  start(config): void {
    frameLog.reset();
    activeDrillRunner.start(config);
  },
  tick(state, nowMs): void {
    activeDrillRunner.tick(state, nowMs);
  },
  restart(): void {
    activeDrillRunner.restart();
  },
  get phase() {
    return activeDrillRunner.phase;
  },
};
drillRunner.start(activeDrillConfig);

// WP-13 / T2 — spread/recoil RNG seed 佈線（OQ-13.1）：seed 取自 `drill.sequence.seed`（省略即
// createSimLoop 內後援 DEFAULT_RNG_SEED）。restart / 換 drill 走**重建 loop** 重置 rng stream 與
// tickIndex（決定性:同 seed 同輸入序列位元一致）。seed 值交 WP-16 記入匯出 meta（研究可重現）。
function buildSimLoop(): SimLoop {
  return createSimLoop(
    sharedState,
    realClock,
    SIM_HZ,
    targetManager,
    sceneManager.camera,
    drillRunner,
    recorder,
    activeWeaponConfig(),
    activeDrillConfig.spiderShot?.seed ?? activeDrillConfig.sequence.seed,
    {
      afterTick(state): void {
        if (isOutsideCorridor(state.player.x, activeSceneConfig.playerCorridor.halfWidthU, SIM_TO_WORLD)) {
          state.validity.playerCorridorExceeded = true;
        }
      },
    },
  );
}
let simLoop = buildSimLoop();

// WP-3 / T5 — dev/e2e 觀測縫：**僅 dev**（`import.meta.env.DEV`，production build 剝除）唯讀暴露量測
// 單例,供 Playwright 端到端斷言「事件帶 timeStamp 入 ring → sim 依時序消費」。不影響三迴圈
// （ADR-2;只讀不寫）;e2e 用法見 tests/e2e/input-sampler.spec.ts + WP-3 manual-verification.md。
if (import.meta.env.DEV) {
  // KI-005 / A（FR-A-7）：一併唯讀暴露 recorder，供 e2e 驗證 app 佈線層（非僅 API 層 opt-in）真的
  // 對正式單例啟用了 mouse 積分——不透過此縫，`recordKeyEvents` 至今未啟用即無法被 e2e 觀測到。
  (window as unknown as { __aimDebug?: unknown }).__aimDebug = { state: sharedState, pointerLock, recorder };
}

// WP-10 / T4 — dev-only recoil pattern viewer. Dynamic import keeps the canvas tool out of production.
if (import.meta.env.DEV && window.location.hash === '#pattern') {
  const { mountPatternViewer } = await import('./recoil/patternViewer.ts');
  mountPatternViewer();
}

// WP-9 / T1（FR-9.1）— E2E 端到端測試掛點：**僅 dev**（`import.meta.env.DEV`，production 剝除；
// 動態 import 使 harness 模組不進 prod bundle）。以合成 clock 自建與生產同源的獨立 sim 管線跑
// 「完整 drill → 匯出 → 統計」全鏈路，供 Playwright 在真瀏覽器（COOP/COEP、crossOriginIsolated）
// 斷言 schema/事件/metadata + 統計＝匯出。與 live 三迴圈隔離（不驅動 rAF pump 的單例，避免競態）。
// 用法見 tests/e2e/full-drill.spec.ts。
if (import.meta.env.DEV) {
  const { createFpsTestHarness } = await import('./testharness/fpsTestHarness.ts');
  const displayHz = await measureDisplayHz({ samples: 10 });
  const fpsTestHarness = createFpsTestHarness({
    availableDrills: availableDrills.map(({ id, source, sceneId, loadOptions }) => ({
      id,
      source,
      ...(sceneId !== undefined ? { scene: findSceneOption(sceneId).config } : {}),
      ...(loadOptions !== undefined ? { loadOptions } : {}),
    })),
    availableScenes: availableScenes.map(({ config }) => config),
    backend,
    crossOriginIsolated: isolation.crossOriginIsolated,
    displayHz,
    sensitivity: settingsPanel.sensitivity,
  });
  (window as unknown as { __fpsTest?: unknown }).__fpsTest = {
    ...fpsTestHarness,
    showResult(): void {
      const payload = fpsTestHarness.forceExportJSON();
      resultScreen.show(
        fpsTestHarness.metricsFromExport(payload),
        fpsTestHarness.promotedMetricsFromExport(payload),
        diagnosisForPayload(payload),
        qualityFlagsForPayload(payload),
      );
    },
  };
}

// dev-only 急停可視化 HUD（`import.meta.env.DEV`，production 剝除）：橫移/急停在階段 A 為 1-tick
// 立即停止（vx→0 + stopped=true），7.8ms 肉眼不可視——此 readout 讓手動驗證能目視「反向鍵那刻
// stopped 翻 true、vx 歸零」，佐證 gate 有作用（不改 physics）。正式數值呈現屬 WP-8 metrics HUD。
const stopDebug = import.meta.env.DEV ? document.createElement('div') : null;
if (stopDebug) {
  stopDebug.style.cssText = [
    'position:fixed',
    'left:8px',
    'bottom:8px',
    'font:600 13px/1.5 ui-monospace,monospace',
    'color:#e6e9ec',
    'background:rgba(16,18,20,0.7)',
    'padding:6px 10px',
    'border-radius:4px',
    'pointer-events:none',
    'user-select:none',
    'white-space:pre',
    'z-index:20',
  ].join(';');
  document.body.appendChild(stopDebug);
}

// dev-only recoil readout（`import.meta.env.DEV`，production 剝除）：顯示 punch pitch/yaw（視覺 aimPunch,
// deg）、inaccuracy 半徑、彈匣餘量。用途:消解「視覺 ≠ 彈道」的 QA 誤判——準心對準卻打不中時,此
// readout 讓手動驗證能目視「彈道其實被 rawPunch(=aimPunch×2)+ inaccuracy 拉偏」。不改 sim（唯讀）。
const recoilDebug = import.meta.env.DEV ? document.createElement('div') : null;
if (recoilDebug) {
  recoilDebug.style.cssText = [
    'position:fixed',
    'right:8px',
    'bottom:8px',
    'font:600 13px/1.5 ui-monospace,monospace',
    'color:#e6e9ec',
    'background:rgba(16,18,20,0.7)',
    'padding:6px 10px',
    'border-radius:4px',
    'pointer-events:none',
    'user-select:none',
    'white-space:pre',
    'text-align:right',
    'z-index:20',
  ].join(';');
  document.body.appendChild(recoilDebug);
}

// player 位置原點對應 camera 起始 world 位置；位移以 SIM_TO_WORLD 疊加。
// sim/資料一律 source unit（u，CONTEXT 正規單位、CLAUDE.md §4；vStrafe=250 u/s 為 canonical CS 值，
// 不得改），但佔位房間僅 ~10 world unit，若 1:1 疊加則 250 u/s 每 tick 移 ~1.95 world unit、~40ms
// 撞牆＝無法目視橫移/急停。故 render 端把 sim position 乘 SIM_TO_WORLD（1 world unit = 100 u），
// 使 250 u/s 呈現為 ~2.5 world-u/s（可控、急停可目視）。
// **`SIM_TO_WORLD` 是 sim domain 與 world domain 之間的唯一橋樑**（`src/loop/constants.ts`，
// KI-004 / K-1）：corridor 觀測與離線 ε(t) 推導亦消費同一常數，不得在此另存第二份字面值。

// WP-13 / T2 — 視覺 recoil 跟隨比例（OQ-S2-4）：aimPunch(視覺)乘此常數後才組進 camera 朝向。
// 1.0 = 全量視覺後座（渲染 = viewAngles + aimPunch×1）;調小可弱化鏡頭上跳、0 = 關閉視覺跟隨。
// `view_recoil_tracking` 精確 CS2 值待 WP-15 校準（OQ-S2-4 open,不阻塞);此處為可調開關 + 註記。
const VIEW_RECOIL_TRACKING = 1.0;
let baseX = sceneManager.camera.position.x;
let baseY = sceneManager.camera.position.y;
let baseZ = sceneManager.camera.position.z;

function syncCameraBase(): void {
  baseX = sceneManager.camera.position.x;
  baseY = sceneManager.camera.position.y;
  baseZ = sceneManager.camera.position.z;
}

// dev-only 急停 readout 閂鎖狀態（見 render loop 內說明）。
let stopFlashUntil = 0;
let prevVx = 0;
let resultShown = false;
let hudRunStartMs: number | null = null;
let hudElapsedMs = 0;
const hudStats: HUDStats = {
  phase: 'idle',
  elapsedMs: 0,
  score: 0,
  fireCount: 0,
  hitCount: 0,
  vx: 0,
  vz: 0,
  stopped: false,
};

function resetRunPresentation(): void {
  recorder.reset();
  frameLog.reset();
  resultScreen.hide();
  currentHistorySession = undefined;
  historyView.render(undefined);
  resultShown = false;
  hudRunStartMs = null;
  hudElapsedMs = 0;
  stopFlashUntil = 0;
  prevVx = 0;
  recorderStartedAt = new Date().toISOString();
}

function restartActiveDrill(): void {
  drillRunner.restart(); // WP-6 restart path: full state + TargetManager + runner reset.
  resetRunPresentation();
  simLoop = buildSimLoop(); // WP-13 / T2：重建 loop 重置 recoil rng stream + tickIndex（決定性）。
  drillRunner.start(activeDrillConfig);
  syncControlsVisibility();
}

function findSceneOption(sceneId: string): AvailableScene {
  const option = availableScenes.find((candidate) => candidate.id === sceneId);
  if (option === undefined) throw new Error(`Unknown scene: ${sceneId}`);
  return option;
}

function installSceneLoad(
  option: AvailableScene,
  nextScene: Awaited<ReturnType<typeof createSceneManagerWithStatus>>,
): void {
  targetView.dispose();
  impactView.dispose();
  tracerView.dispose();
  sceneManager.dispose();
  sceneManager = nextScene.manager;
  resize();
  targetView = new TargetView(sceneManager.scene);
  impactView = new ImpactView(sceneManager.scene);
  tracerView = new TracerView(sceneManager.scene);
  cameraController.setCamera(sceneManager.camera);
  cameraController.setFov(settingsPanel.fov);
  syncCameraBase();
  activeSceneConfig = option.config;
  activeSceneFallback = nextScene.fallback;
  controls.setSelectedScene(activeSceneConfig.sceneId);
}

async function loadDrillById(drillId: string): Promise<void> {
  const option = availableDrills.find((candidate) => candidate.id === drillId);
  if (option === undefined) throw new Error(`Unknown drill: ${drillId}`);

  const requiredScene = option.sceneId !== undefined ? findSceneOption(option.sceneId) : undefined;
  const targetSceneConfig = requiredScene?.config ?? activeSceneConfig;
  const nextConfig = loadDrill(option.source, targetSceneConfig, option.loadOptions);
  const needsSceneLoad =
    requiredScene !== undefined &&
    (requiredScene.config.sceneId !== activeSceneConfig.sceneId || activeSceneFallback);
  const nextScene = needsSceneLoad ? await createSceneManagerWithStatus(requiredScene.config) : undefined;
  if (nextScene !== undefined && requiredScene !== undefined) installSceneLoad(requiredScene, nextScene);

  drillRunner.restart();
  activeDrillConfig = nextConfig;
  activeDrillSource = option.source;
  activeDrillLoadOptions = option.loadOptions ?? {};
  activeTargetManager = createTargetManager(nextConfig);
  activeDrillRunner = createDrillRunner(sharedState, activeTargetManager);
  resetRunPresentation();
  simLoop = buildSimLoop(); // WP-13 / T2：新 drill 的 seed 生效 + 重置 rng stream（決定性）。
  cameraController.setAdsConfig(activeWeaponConfig().ads); // WP-24 / T2：新 drill 武器的 ADS 光學。
  recorder.configureMouseIntegration({ gain: currentMouseGain() }); // KI-005 / A：新 drill 武器的感度 gain（同一批動作）。
  drillRunner.start(activeDrillConfig);
  controls.setSelectedDrill(option.id);
  syncControlsVisibility();
}

async function loadSceneById(sceneId: string): Promise<void> {
  const option = findSceneOption(sceneId);
  if (option.config.sceneId === activeSceneConfig.sceneId && !activeSceneFallback) return;

  const nextDrillConfig = loadDrill(activeDrillSource, option.config, activeDrillLoadOptions);
  const nextScene = await createSceneManagerWithStatus(option.config);

  installSceneLoad(option, nextScene);

  drillRunner.restart();
  activeDrillConfig = nextDrillConfig;
  activeTargetManager = createTargetManager(activeDrillConfig);
  activeDrillRunner = createDrillRunner(sharedState, activeTargetManager);
  resetRunPresentation();
  simLoop = buildSimLoop();
  drillRunner.start(activeDrillConfig);
  syncControlsVisibility();
}

function createAppProtocolRunner(config: ProtocolConfig): ProtocolRunner<ExportPayload> {
  return createProtocolRunner({
    config,
    async applyCondition(condition) {
      activeResolutionMode = condition.mode;
      settingsPanel.setResolutionMode(condition.mode);
      settingsPanel.lockMode(true);
      resize();
      // KI-002 / D2:只走 loadDrillById——它原子載入該 drill 的正規場景並驗證「新」drill vs
      // 新 scene。移除先前的 loadSceneById(condition.sceneId):它會拿**舊** activeDrillSource
      // 重驗目標場景淨空(BR-active → 啟動 resolution protocol 時舊 BR 前向 drill 過不了 field-low
      // → throw 中止)。每個 protocol condition 的 drill 皆已在 availableDrills 宣告自己的 sceneId。
      await loadDrillById(condition.drillId);
      // dev 兜底:偵測 drill 落點與 condition.sceneId 靜默漂移(drill sceneId 與 protocol 不一致)。
      if (import.meta.env.DEV && activeSceneConfig.sceneId !== condition.sceneId) {
        throw new Error(
          `applyCondition scene mismatch: drill '${condition.drillId}' landed on scene ` +
            `'${activeSceneConfig.sceneId}', expected '${condition.sceneId}'`,
        );
      }
      return {
        mode: displayState.mode,
        sceneId: activeSceneConfig.sceneId,
        drillId: activeDrillConfig.drillId,
      };
    },
    exportCondition: (context) => buildCurrentExportPayload(context),
  });
}

const resolutionProtocolRunner = createAppProtocolRunner(resolutionDetectionProtocol);
const brTrackingProtocolRunner = createAppProtocolRunner(brTrackingProtocol);
let activeProtocolRunner: ProtocolRunner<ExportPayload> = resolutionProtocolRunner;
markProtocolFullscreenExit = () => activeProtocolRunner.markCurrentConditionSuspect('fullscreen-exit');

// WP-8 / T4（FR-8.4）— 重來 / 換 drill 控制。解鎖時可操作；結果頁顯示時也保持可操作。
const controls = createControls({
  drills: availableDrills.map(({ id, label }) => ({ id, label })),
  scenes: availableScenes.map(({ id, label }) => ({ id, label })),
  selectedDrillId: activeDrillConfig.drillId,
  selectedSceneId: activeSceneConfig.sceneId,
  onRestart: restartActiveDrill,
  onLoadDrill: loadDrillById,
  onLoadScene: loadSceneById,
  initialTracerEnabled: tracerEnabled,
  onTracerEnabledChange: (enabled) => {
    tracerEnabled = enabled;
    tracerView.clear(sharedState.shotRays.total);
  },
});

function syncControlsVisibility(): void {
  controls.setVisible(!pointerLock.locked || drillRunner.phase === 'ended');
}

pointerLock.onChange(syncControlsVisibility);
syncControlsVisibility();

const protocolStatus = document.createElement('div');
protocolStatus.id = 'protocol-status';
protocolStatus.style.cssText = [
  'position:fixed',
  'top:12px',
  'left:50%',
  'transform:translateX(-50%)',
  'display:none',
  'align-items:center',
  'gap:10px',
  'max-width:min(92vw,760px)',
  'padding:9px 12px',
  'font:700 13px/1.35 system-ui,sans-serif',
  'color:#e6e9ec',
  'background:rgba(24,27,30,0.96)',
  'border:1px solid rgba(255,255,255,0.14)',
  'border-radius:8px',
  'box-shadow:0 10px 32px rgba(0,0,0,0.3)',
  'pointer-events:auto',
  'z-index:45',
].join(';');
const protocolStatusText = document.createElement('span');
const protocolNextButton = document.createElement('button');
protocolNextButton.type = 'button';
protocolNextButton.textContent = '下一條件';
protocolNextButton.title = 'Start next protocol condition';
protocolNextButton.style.cssText = [
  'height:30px',
  'padding:0 12px',
  'border:1px solid rgba(255,255,255,0.18)',
  'border-radius:6px',
  'font:750 12px/1 system-ui,sans-serif',
  'color:#e6e9ec',
  'background:rgba(15,18,21,0.96)',
  'cursor:pointer',
].join(';');
protocolNextButton.style.display = 'none';
protocolStatus.append(protocolStatusText, protocolNextButton);
document.body.appendChild(protocolStatus);

let completingProtocolCondition = false;
let completedProtocolConditionIndex: number | undefined;

function setProtocolStatus(text: string, showNext: boolean): void {
  protocolStatusText.textContent = text;
  protocolNextButton.style.display = showNext ? 'inline-flex' : 'none';
  protocolStatus.style.display = 'flex';
}

const restOverlay = createRestOverlay();
const sessionPlanRunner: SessionRunnerHandle = createSessionRunner({
  loadDrillById,
  onStatus: (text) => setProtocolStatus(text, false),
  onPhaseChange: (nextPhase) => {
    if (nextPhase.kind === 'rest') restOverlay.show(nextPhase.remainingMs);
    else restOverlay.hide();
  },
});

async function startSessionPlan(): Promise<void> {
  const selection = pendingSessionPlanSelection;
  const setup = sessionSetupValues;
  pendingSessionPlanSelection = undefined;
  if (selection === undefined || setup === undefined) {
    setProtocolStatus('Session Plan 啟動失敗：缺少受試者或計畫選擇。', false);
    return;
  }
  activeSessionPlanPreset = selection.presetId;
  try {
    // T1 retains the literal TEST_FAMILY_IDS order; T3 wires the counterbalanced index.
    await sessionPlanRunner.start({
      participantId: setup.participantId,
      sessionIndex: 0,
      families: selection.families,
      presetId: selection.presetId,
      includeWarmup: selection.includeWarmup,
    });
  } catch (error) {
    activeSessionPlanPreset = undefined;
    setProtocolStatus(`Session Plan 啟動失敗：${error instanceof Error ? error.message : String(error)}`, false);
  }
}

async function startProtocol(runner: ProtocolRunner<ExportPayload>): Promise<void> {
  activeProtocolRunner = runner;
  activeProtocolRunner.reset();
  completingProtocolCondition = false;
  completedProtocolConditionIndex = undefined;
  try {
    const context = await activeProtocolRunner.start();
    setProtocolStatus(protocolRunningText(context), false);
  } catch (error) {
    settingsPanel.lockMode(false);
    setProtocolStatus(`Protocol 啟動失敗:${error instanceof Error ? error.message : String(error)}`, false);
  }
}

function startResolutionProtocol(): Promise<void> {
  return startProtocol(resolutionProtocolRunner);
}

function startBrTrackingProtocol(): Promise<void> {
  return startProtocol(brTrackingProtocolRunner);
}

async function beginNextProtocolCondition(): Promise<void> {
  protocolNextButton.disabled = true;
  try {
    const context = await activeProtocolRunner.beginNextCondition();
    if (context === undefined) {
      settingsPanel.lockMode(false);
      experimentSession.exit();
      setProtocolStatus('Protocol 完成：所有條件已匯出。', false);
      return;
    }
    completedProtocolConditionIndex = undefined;
    setProtocolStatus(protocolRunningText(context), false);
  } catch (error) {
    setProtocolStatus(`下一條件啟動失敗:${error instanceof Error ? error.message : String(error)}`, true);
  } finally {
    protocolNextButton.disabled = false;
  }
}

async function completeActiveProtocolCondition(): Promise<void> {
  const current = activeProtocolRunner.current;
  if (
    current === undefined ||
    completingProtocolCondition ||
    completedProtocolConditionIndex === current.conditionIndex
  ) {
    return;
  }

  completingProtocolCondition = true;
  try {
    const result = await activeProtocolRunner.completeCurrentCondition();
    completedProtocolConditionIndex = result.context.conditionIndex;
    downloadJSON(result.payload, { basename: exportBasename(result.payload) });
    const hasNext = result.context.conditionIndex < activeProtocolRunner.config.conditions.length - 1;
    if (!hasNext) {
      settingsPanel.lockMode(false);
      experimentSession.exit();
    }
    setProtocolStatus(
      `Protocol 條件 ${result.context.conditionIndex + 1}/${activeProtocolRunner.config.conditions.length} 已匯出: ${result.context.conditionLabel}`,
      hasNext,
    );
  } catch (error) {
    setProtocolStatus(`Protocol 匯出失敗:${error instanceof Error ? error.message : String(error)}`, false);
  } finally {
    completingProtocolCondition = false;
  }
}

function protocolRunningText(context: ProtocolConditionContext): string {
  return `Protocol 條件 ${context.conditionIndex + 1}/${activeProtocolRunner.config.conditions.length}: ${context.conditionLabel}`;
}

protocolNextButton.addEventListener('click', () => void beginNextProtocolCondition());

const renderLoop = createRenderLoop((now) => {
  sessionPlanRunner.poll(now);
  // 1) 推進 sim（固定步長，只用 TICK；決定性根源在 SimLoop），取回 alpha 內插係數。
  const { alpha } = simLoop.pump(now);
  const phase = drillRunner.phase;
  if (phase === 'running') {
    if (hudRunStartMs === null) hudRunStartMs = now;
    hudElapsedMs = now - hudRunStartMs;
  } else if (phase === 'countdown' || phase === 'idle') {
    hudRunStartMs = null;
    hudElapsedMs = 0;
  }
  // 2) render 唯讀內插 player 位置（prev→curr）——**不寫回 sharedState**（雙迴圈邊界，render 唯讀）。
  const px = lerp(sharedState.prev.x, sharedState.curr.x, alpha);
  const pz = lerp(sharedState.prev.z, sharedState.curr.z, alpha);
  // 3) player 位移驅動 camera 位置；sim source unit → world 乘 SIM_TO_WORLD（見上）。
  //    視角朝向（yaw/pitch）由 CameraController 走輸入路徑、**不內插**（人眼對視角延遲敏感，且視角非 sim 狀態）。
  sceneManager.camera.position.set(baseX + px * SIM_TO_WORLD, baseY, baseZ + pz * SIM_TO_WORLD);
  // 3b) recoil 視覺 punch（WP-13 / T2）：sim 每 tick 寫 recoil.prev/curr(aimPunch deg,視覺 ×1),
  //     render 以 alpha lerp(比照 position)→ 乘 VIEW_RECOIL_TRACKING → adapter 轉 three rad →
  //     setViewPunch 每幀重組 camera 朝向(滑鼠靜止時 punch 衰減仍逐幀可見,稽核 A2)。
  const punchPitchDeg = lerp(sharedState.recoil.prev.pitchDeg, sharedState.recoil.curr.pitchDeg, alpha) * VIEW_RECOIL_TRACKING;
  const punchYawDeg = lerp(sharedState.recoil.prev.yawDeg, sharedState.recoil.curr.yawDeg, alpha) * VIEW_RECOIL_TRACKING;
  const punchRad = punchToThreeRad(punchPitchDeg, punchYawDeg);
  cameraController.setViewPunch(punchRad.yawRad, punchRad.pitchRad);
  // 3c) ADS 開鏡（WP-24 / T2，FR-E5）：每幀依 heldAds 切換 camera FOV 目標 + GD-16 感度 gain
  //     （比照 setViewPunch，render-only；不進 sim/命中/彈道）。now 為 render 時鐘,僅驅動 FOV 視覺內插。
  cameraController.setAds(sharedState.heldAds, now);
  scopeOverlay.setActive(sharedState.heldAds && activeWeaponConfig().ads !== undefined);
  // 4) 目標 mesh 依 state 顯示/隱藏（唯讀；本 WP 目標序列由 T2/T3 的 TargetManager 寫入）。
  //    移動目標以 alpha 內插 posPrev→pos（WP-18 / T3，比照 player 位置；render-only，不寫 state）。
  targetView.sync(sharedState.targets, alpha);
  // 4b) 彈孔 InstancedMesh 依 impacts 環形格增量同步（WP-13 / T3；唯讀，sim 命中時寫入）。
  impactView.sync(sharedState.impacts);
  // 4c) tracer InstancedMesh 依 shotRays 環形格增量同步（WP-25 / T1；關閉時不呼叫 sync = 零工作）。
  if (tracerEnabled) tracerView.sync(sharedState.shotRays, now);
  // 5) 繪製。
  renderer.render(sceneManager.scene, sceneManager.camera);
  // WP-8 / T2：phase 轉 ended 後只計算一次結果；T4 controls 會負責 restart / 換 drill 時隱藏與重啟。
  if (!resultShown && phase === 'ended') {
    frameLog.freeze();
    if (document.pointerLockElement !== null) document.exitPointerLock();
    resultShown = true;
    syncControlsVisibility();
    void (async () => {
      const payload = await buildCurrentExportPayload();
      const diagnosis = diagnosisForPayload(payload);
      try {
        currentHistorySession = payload.meta.assessment === undefined ? undefined : sessionSummaryFromPayload(payload);
        historyView.render(
          currentHistorySession === undefined
            ? { status: 'insufficient-data', reason: 'This is a Practice session; it cannot establish a formal history baseline.' }
            : undefined,
        );
      } catch (error) {
        currentHistorySession = undefined;
        historyView.render({
          status: 'insufficient-data',
          reason: error instanceof Error ? error.message : 'Current session could not establish a history baseline.',
        });
      }
      resultScreen.show(
        metricsDashboard.compute(snapshotFromExportPayload(payload)),
        metricsDashboard.computePromoted(payload),
        diagnosis,
        qualityFlagsForPayload(payload),
      );
      const sessionPhase = sessionPlanRunner.phase;
      if (sessionPhase.kind === 'warmup') {
        await sessionPlanRunner.advance();
      } else if (sessionPhase.kind === 'family') {
        downloadJSON(payload, { basename: exportBasename(payload) });
        await sessionPlanRunner.advance();
        if (sessionPlanRunner.phase.kind === 'done') experimentSession.exit();
      } else {
        await completeActiveProtocolCondition();
      }
    })();
  }
  hud.update(createHUDStats(sharedState, phase, hudElapsedMs, recorder.hitCount, recorder.fireCount, recorder.hitCount, hudStats));
  // dev-only：更新急停 readout（vx / stopped）——手動驗證用，production 剝除。
  // 急停 stopped=true 只存活 1 tick（7.8ms），render frame（~16ms）幾乎必錯過瞬時值；故除了讀
  // 當下 stopped，另**閂鎖**：偵測到 stopped 或 vx 反向（+→−/−→+，過衝 = 急停已發生）就把綠燈
  // 保持 600ms，使 1-tick 急停可靠可視。閂鎖時鐘用 rAF `now`（量測時鐘域，非 Date.now）。
  if (stopDebug) {
    const p = sharedState.player;
    const reversed = (prevVx > 0 && p.vx < 0) || (prevVx < 0 && p.vx > 0);
    if (p.stopped || reversed) stopFlashUntil = now + 600;
    prevVx = p.vx;
    const flashing = now < stopFlashUntil;
    stopDebug.textContent = `vx ${p.vx.toFixed(0).padStart(5)} u/s\n急停 ${flashing ? '● STOP ✓' : '○ —'}`;
    stopDebug.style.color = flashing ? '#7ee787' : '#e6e9ec';
  }
  // dev-only：更新 recoil readout（punch p/y 視覺 deg、inaccuracy 半徑、ammo）——手動驗證「視覺≠彈道」。
  if (recoilDebug) {
    const rs = sharedState.recoilState;
    recoilDebug.textContent =
      `punch p ${rs.aimPunchPitchDeg.toFixed(2).padStart(7)}°\n` +
      `punch y ${rs.aimPunchYawDeg.toFixed(2).padStart(7)}°\n` +
      `inacc  ${rs.inaccuracyFire.toFixed(4).padStart(8)}\n` +
      `ammo   ${String(sharedState.weapon.ammo).padStart(3)}/${sharedState.weapon.magSize}`;
  }
}, { frameLog });
renderLoop.start();
