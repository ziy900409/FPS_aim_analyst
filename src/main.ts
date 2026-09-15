import { assertIsolation } from './env/isolation.ts';
import { createRenderer } from './render/createRenderer.ts';
import { createSceneManagerWithStatus } from './render/SceneManager.ts';
import { createSceneLoadCoordinator } from './render/SceneLoadCoordinator.ts';
import { TargetView } from './render/TargetView.ts';
import { ImpactView } from './render/ImpactView.ts';
import { TracerView } from './render/TracerView.ts';
import { createPresentationCoordinator } from './render/PresentationCoordinator.ts';
import { createPointerLock } from './input/PointerLock.ts';
import { createInputSampler } from './input/InputSampler.ts';
import { CameraController } from './view/CameraController.ts';
import { createSettingsPanel } from './ui/SettingsPanel.ts';
import { createCrosshair } from './ui/Crosshair.ts';
import { createScopeOverlay } from './ui/ScopeOverlay.ts';
import { createExportPanel } from './ui/ExportPanel.ts';
import { createHUD, createHUDStats, type HUDStats } from './ui/HUD.ts';
import { createDrillStartOverlay } from './ui/DrillStartOverlay.ts';
import { createResultScreen } from './ui/ResultScreen.ts';
import { buildResultPresentation, exportBasename } from './results/ResultPresentation.ts';
import { createHistorySaveStatus } from './ui/HistorySaveStatus.ts';
import { createHistoryClient } from './history/HistoryClient.ts';
import { createHistoryPersistence, type HistorySaveState } from './history/HistoryPersistence.ts';
import { createHistoryLibraryController } from './history/HistoryLibraryController.ts';
import { createHistoryNavigator } from './history/navigation/HistoryNavigator.ts';
import { createHistoryScreen, type HistoryScreenHandle } from './ui/history/HistoryScreen.ts';
import { createDrillMetricRegistry } from './history/DrillMetricRegistry.ts';
import { createReplayScreen, type ReplayScreenHandle } from './ui/replay/ReplayScreen.ts';
import { createReplayController, type ReplayController } from './replay/ReplayController.ts';
import { createReplayPresentationSession } from './render/replay/ReplayPresentationSession.ts';
import { createControls, type ControlsHandle } from './ui/Controls.ts';
import {
  createResearcherMenu,
  shouldShowResearcherControls,
  type AppMode,
  type ResearcherMenuHandle,
} from './ui/ResearcherMenu.ts';
import { applyResolutionMode, type DisplayState, type ResolutionMode } from './display/resolutionMode.ts';
import {
  createProtocolRunner,
  type ProtocolConditionContext,
  type ProtocolConfig,
  type ProtocolRunner,
} from './display/ProtocolRunner.ts';
import { brTrackingProtocol } from './display/brTrackingProtocol.ts';
import { resolutionDetectionProtocol } from './display/resolutionDetectionProtocol.ts';
import { probeWarmupP95Ms, runEligibilityGate } from './display/eligibilityGate.ts';
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
import {
  buildFrozenSessionPlan,
  createSessionRunner,
  type SessionRunnerHandle,
  type SessionRunnerPhase,
} from './session/SessionRunner.ts';
import {
  compileSessionProgram,
  deriveProgramFamilyOrder,
  type ProgramBoundary,
} from './session/sessionProgram.ts';
import { KNOWN_SESSION_FAMILY_IDS, type SessionFamilyId } from './session/sessionSchedule.ts';
import { TRACKING_PILOT_RUNTIME_DRILLS } from './session/trackingPilotSchedulableDrills.ts';
import { createTrackingPilotSession, type TrackingPilotSessionHandle } from './pilot/trackingPilotSession.ts';
import { sharedState } from './state/SharedState.ts';
import { createTargetManager, type TargetManager } from './sim/TargetManager.ts';
import { loadDrill, type DrillLoadOptions } from './drill/DrillLoader.ts';
import {
  drillSourceFor,
  researcherControlsDrills,
  resolveAvailableDrill,
  type AvailableDrill,
} from './drill/drillRegistry.ts';
import { createDrillRunner, type DrillRunner } from './drill/DrillRunner.ts';
import {
  resolveDrillTimeLimitMs,
  resolveHitFeedback,
  resolveTargetHitbox,
  targetHitboxToConfig,
  type DrillConfig,
} from './drill/DrillConfig.ts';
import { createSimLoop, DEFAULT_RNG_SEED, type SimLoop } from './loop/SimLoop.ts';
import { punchToThreeRad } from './recoil/adapter.ts';
import { createRenderLoop, lerp } from './loop/RenderLoop.ts';
import { realClock } from './loop/clock.ts';
import type { Clock } from './loop/clock.ts';
import { createPausableTimeMapper } from './loop/pausableTimeMapper.ts';
import { createRunAttemptController } from './attempt/RunAttemptController.ts';
import {
  createAttemptFinalizationGate,
  describeAttemptHold,
  describeDiscardReason,
  invalidAttemptBasename,
  planFinalization,
  type AttemptFinalizationPlan,
} from './attempt/AttemptFinalizationGate.ts';
import type { RecordingSnapshot } from './attempt/recordingIntegrity.ts';
import { createPauseOverlay, type PauseOverlayView } from './ui/PauseOverlay.ts';
import { SIM_HZ, SIM_TO_WORLD } from './loop/constants.ts';
import { createDataRecorder } from './data/DataRecorder.ts';
import { DEFAULT_MAX_DRILL_SECONDS } from './data/RingBuffer.ts';
import {
  collectMeta,
  measureDisplayHz,
  measureDisplayRefresh,
  type AssessmentMeta,
  type CollectMetaArgs,
} from './data/metadata.ts';
import { RAD_PER_COUNT, resolveMouseGain } from './input/mouseGain.ts';
import { buildExportPayload, downloadCSV, downloadJSON, type ExportPayload } from './data/export.ts';
import { STAGE6_PROTOCOL_VERSION } from './drill/protocolVersion.ts';
import { resolveActiveWeapon, WEAPONS, type WeaponId } from './weapon/weapons.ts';
import type { SceneConfig } from './scene/SceneConfig.ts';
import { resolveEyeWorldBase } from './scene/eyePose.ts';
import { isOutsideCorridor } from './scene/corridor.ts';
import { placeholderRoom } from './scene/scenes/placeholder-room.ts';
import { fieldLow } from './scene/scenes/field-low.ts';
import { urbanHigh } from './scene/scenes/urban-high.ts';
import { brField } from './scene/scenes/br-field.ts';
import { peekCorridor } from './scene/scenes/peek-corridor.ts';
import { peekAdCorridor } from './scene/scenes/peek-ad-corridor.ts';
import { microFlickRoom } from './scene/scenes/micro-flick-room.ts';
import { microFlickRoomV2 } from './scene/scenes/micro-flick-room-v2.ts';
import { microFlickRoomV3 } from './scene/scenes/micro-flick-room-v3.ts';
import { microFlickRoomV4 } from './scene/scenes/micro-flick-room-v4.ts';
import { microFlickRoomV5 } from './scene/scenes/micro-flick-room-v5.ts';
import { microFlickRoomV6 } from './scene/scenes/micro-flick-room-v6.ts';
import { microFlickRoomV7 } from './scene/scenes/micro-flick-room-v7.ts';
import { microFlickRoomV8 } from './scene/scenes/micro-flick-room-v8.ts';
import { microFlickRoomV9 } from './scene/scenes/micro-flick-room-v9.ts';
import { spiderShotRoom } from './scene/scenes/spider-shot-room.ts';
import { wideFlickArena } from './scene/scenes/wide-flick-arena.ts';
import { detectionPopinV1 } from './drill/detection_popin_v1.ts';
import { trackingV1 } from './drill/tracking_v1.ts';
import { trackingSceneV1 } from './drill/tracking_scene_v1.ts';
import { trackingLongrangeV1 } from './drill/tracking_longrange_v1.ts';
import { trackingReversalFeedbackV1 } from './drill/tracking_reversal_feedback_v1.ts';
import { trackingCorePrFeedbackV1 } from './drill/tracking_core_pr_feedback_v1.ts';
import { trackingCorePrFeedback30sV1 } from './drill/tracking_core_pr_feedback_30s_v1.ts';
import { trackingBrVariants } from './drill/tracking_br_v1.ts';
import { holdClickV1 } from './drill/hold_click_v1.ts';
import { holdTrackV1 } from './drill/hold_track_v1.ts';
import { spiderShotV1 } from './drill/spider_shot_v1.ts';
import { spiderShotV2 } from './drill/spider_shot_v2.ts';
import { spiderShotV3, spiderShotV3Binding } from './drill/spider_shot_v3.ts';
import { resolveSpiderShotWideV1, spiderShotWideV1Binding } from './drill/spider_shot_wide_v1.ts';
import { assessmentProtocolVersionForDrill } from './drill/assessmentProtocolVersion.ts';
import { counterstrafeReversalV1 } from './drill/counterstrafe_reversal_v1.ts';
import { counterstrafeFreeV1 } from './drill/counterstrafe_free_v1.ts';
import { peekClickTransferPilotV1 } from './drill/peek_click_transfer_pilot_v1.ts';
import {
  PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES,
  peekClickTransferPilotV2Randomized,
  peekClickTransferPilotV2Masked,
} from './drill/peek_click_transfer_pilot_v2.ts';
import { peekClickTransferV1 } from './drill/peek_click_transfer_v1.ts';
import { microFlickThreeTargetTestV1 } from './drill/micro_flick_three_target_test_v1.ts';
import { microFlickThreeTargetTestV2 } from './drill/micro_flick_three_target_test_v2.ts';
import { microFlickThreeTargetTestV3 } from './drill/micro_flick_three_target_test_v3.ts';
import { microFlickThreeTargetTestV4 } from './drill/micro_flick_three_target_test_v4.ts';
import { microFlickThreeTargetTestV5 } from './drill/micro_flick_three_target_test_v5.ts';
import { microFlickThreeTargetTestV6 } from './drill/micro_flick_three_target_test_v6.ts';
import { microFlickThreeTargetTestV7 } from './drill/micro_flick_three_target_test_v7.ts';
import { microFlickThreeTargetTestV8 } from './drill/micro_flick_three_target_test_v8.ts';
import { microFlickThreeTargetTestV9 } from './drill/micro_flick_three_target_test_v9.ts';
import defaultDrillSource from '../drills/counterstrafe_ad_v1.json';

// 進入點必須走 'three/webgpu'（見 createRenderer），否則拿不到 WebGPURenderer。

// WP-0 / T2（FR-0.2）— 啟動先驗 cross-origin isolation（計時量測效度前置，ADR-4）。
const isolation = assertIsolation();
console.info('[isolation]', isolation);

const canvas = document.querySelector<HTMLCanvasElement>('#app')!;

// WP-0 seam：async bootstrap，取得 renderer + backend（backend 供 WP-7 metadata）。
const { renderer, backend } = await createRenderer(canvas);

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
  { id: peekAdCorridor.sceneId, label: 'peek-ad-corridor-v1', config: peekAdCorridor },
  { id: microFlickRoom.sceneId, label: microFlickRoom.sceneId, config: microFlickRoom },
  { id: microFlickRoomV2.sceneId, label: microFlickRoomV2.sceneId, config: microFlickRoomV2 },
  { id: microFlickRoomV3.sceneId, label: microFlickRoomV3.sceneId, config: microFlickRoomV3 },
  { id: microFlickRoomV4.sceneId, label: microFlickRoomV4.sceneId, config: microFlickRoomV4 },
  { id: microFlickRoomV5.sceneId, label: microFlickRoomV5.sceneId, config: microFlickRoomV5 },
  { id: microFlickRoomV6.sceneId, label: microFlickRoomV6.sceneId, config: microFlickRoomV6 },
  { id: microFlickRoomV7.sceneId, label: microFlickRoomV7.sceneId, config: microFlickRoomV7 },
  { id: microFlickRoomV8.sceneId, label: microFlickRoomV8.sceneId, config: microFlickRoomV8 },
  { id: microFlickRoomV9.sceneId, label: microFlickRoomV9.sceneId, config: microFlickRoomV9 },
  { id: spiderShotRoom.sceneId, label: spiderShotRoom.sceneId, config: spiderShotRoom },
  // WP-57 / T3：寬場 arena。drill 的 roster 註冊需 arm-time resolve（FOV/aspect），屬 T6。
  { id: wideFlickArena.sceneId, label: wideFlickArena.sceneId, config: wideFlickArena },
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
  // KI-011: spider-shot 的目標包絡跨越前方 ±15° 圓錐(見 TargetManager.sampleSpiderShotPose),
  // 未綁定場景時繼承 activeSceneConfig(預設 field-low)——與其 tree/rock 裝飾道具重疊、拒入。
  // placeholder-room 是唯一零 propBounds 的場景,鎖定為固定家(不得改回無 sceneId)。
  { id: spiderShotV1.drillId, label: spiderShotV1.drillId, source: spiderShotV1, sceneId: 'placeholder-room' },
  // WP-44: stratified peripheral schedule variant; same KI-011 zero-propBounds scene as v1.
  { id: spiderShotV2.drillId, label: spiderShotV2.drillId, source: spiderShotV2, sceneId: 'placeholder-room' },
  {
    id: spiderShotV3Binding.id,
    label: spiderShotV3Binding.id,
    source: spiderShotV3,
    sceneId: spiderShotV3Binding.sceneId,
  },
  // WP-57 / T6: the wide-flick sibling construct (~40-70 deg eye-frame displacement). The only
  // roster entry whose config is produced at arm time — `resolveSpiderShotWideV1` reads the vertical
  // FOV slider and the live camera aspect exactly once and freezes them into the resolved config
  // (plus `resolvedFrom` provenance), after which the sim knows nothing about either (GD-6/GD-10).
  {
    id: spiderShotWideV1Binding.id,
    label: spiderShotWideV1Binding.id,
    resolveSource: () => resolveSpiderShotWideV1(settingsPanel.fov, sceneManager.camera.aspect),
    sceneId: spiderShotWideV1Binding.sceneId,
  },
  { id: counterstrafeReversalV1.drillId, label: counterstrafeReversalV1.drillId, source: counterstrafeReversalV1 },
  { id: counterstrafeFreeV1.drillId, label: counterstrafeFreeV1.drillId, source: counterstrafeFreeV1 },
  {
    id: peekClickTransferPilotV1.id,
    label: peekClickTransferPilotV1.id,
    source: peekClickTransferPilotV1.drill,
    sceneId: peekClickTransferPilotV1.sceneId,
    loadOptions: { clearance: peekClickTransferPilotV1.clearanceOptions },
  },
  // WP-52 T4/T5: researcher-mode entry points for the pilot v2 manual gate
  // (T4-manual-pilot-gate.md) — every fixed-size candidate individually, plus the T5 randomized
  // cell that interleaves all three within one balanced-shuffle-seeded run.
  ...PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES.map((candidate) => ({
    id: candidate.id,
    label: candidate.id,
    source: candidate.drill,
    sceneId: candidate.sceneId,
    loadOptions: { clearance: candidate.clearanceOptions },
  })),
  {
    id: peekClickTransferPilotV2Randomized.id,
    label: peekClickTransferPilotV2Randomized.id,
    source: peekClickTransferPilotV2Randomized.drill,
    sceneId: peekClickTransferPilotV2Randomized.sceneId,
    loadOptions: { clearance: peekClickTransferPilotV2Randomized.clearanceOptions },
  },
  // WP-52 masked-visual pilot（使用者請求，2026-09-01）：render 一律套用 2.5° 參考視覺尺寸，
  // hitbox 仍逐一使用真實 1°/2.5°/5° 候選——用於「受試者看不出目前是哪個難度候選」的手感驗證。
  {
    id: peekClickTransferPilotV2Masked.id,
    label: peekClickTransferPilotV2Masked.id,
    source: peekClickTransferPilotV2Masked.drill,
    sceneId: peekClickTransferPilotV2Masked.sceneId,
    loadOptions: { clearance: peekClickTransferPilotV2Masked.clearanceOptions },
  },
  // WP-53 T4 (GD-29 formal freeze): formal Assessment release, distinct drill id from every pilot
  // cohort — reachable both directly here (researcher mode) and via the `'peek-click-transfer-v1'`
  // Session Plan family (SessionRunner.ts resolveFamilyDrillId).
  {
    id: peekClickTransferV1.id,
    label: peekClickTransferV1.id,
    source: peekClickTransferV1.drill,
    sceneId: peekClickTransferV1.sceneId,
    loadOptions: { clearance: peekClickTransferV1.clearanceOptions },
  },
  {
    id: microFlickThreeTargetTestV1.id,
    label: microFlickThreeTargetTestV1.id,
    source: microFlickThreeTargetTestV1.drill,
    sceneId: microFlickThreeTargetTestV1.sceneId,
  },
  ...[microFlickThreeTargetTestV2, microFlickThreeTargetTestV3, microFlickThreeTargetTestV4, microFlickThreeTargetTestV5, microFlickThreeTargetTestV6, microFlickThreeTargetTestV7, microFlickThreeTargetTestV8, microFlickThreeTargetTestV9].map((variant) => ({
    id: variant.id,
    label: variant.id,
    source: variant.drill,
    sceneId: variant.sceneId,
  })),
  ...trackingBrVariants.map((variant) => ({
    id: variant.id,
    label: variant.id,
    source: variant.drill,
    sceneId: variant.sceneId,
  })),
  // WP-64 (FR-64.5) — the curated research-schedulable tracking-pilot blocks, so a custom Session
  // Plan step can actually be loaded by `loadDrillById()`. Projected from the same curated registry
  // the family roster and the declared-weapon map derive from: "compilable" and "loadable" are the
  // same list here, which is what FM-64.2 is about. The entries are built in that module (pinned
  // `field-low`, config by reference, withheld from the Controls dropdown) so a test can execute
  // those three claims instead of scanning this literal for them — see `drillRegistry.ts`.
  ...TRACKING_PILOT_RUNTIME_DRILLS,
  // WP-66 後續（使用者 2026-09-12）：帶命中回饋的 reversal tracking。**不是** pilot block——
  // 不在 `ALL_TRACKING_PILOT_CONFIGS`、不進 manifest，故 `tracking-pilot-v2` 逐位不變。scene 沿用
  // pilot 的 `field-low` pin：`reversal-2d-v1` 的 ±13° 視窗是對該場景 clearance envelope 驗證過的。
  {
    id: trackingReversalFeedbackV1.drillId,
    label: trackingReversalFeedbackV1.drillId,
    source: trackingReversalFeedbackV1,
    sceneId: 'field-low',
  },
  // 同上（使用者 2026-09-13）：core pseudorandom 的 3deg/14dps 格，帶命中回饋的獨立 drill。
  {
    id: trackingCorePrFeedbackV1.drillId,
    label: trackingCorePrFeedbackV1.drillId,
    source: trackingCorePrFeedbackV1,
    sceneId: 'field-low',
  },
  // 使用者 2026-09-14：以上一列為參照的 30 秒變體，且移除置中準備窗（目標自計時第一個 tick
  // 起就移動）。同樣不是 pilot block，scene pin 理由同上。
  {
    id: trackingCorePrFeedback30sV1.drillId,
    label: trackingCorePrFeedback30sV1.drillId,
    source: trackingCorePrFeedback30sV1,
    sceneId: 'field-low',
  },
];
// WP-52: single-source lookup for the additive `visibility` meta every peek-click-transfer
// pilot cell (v1 default, every v2 fixed candidate, and the v2 randomized cell) needs in its
// export — avoids one `drillId === X` branch per cell as the roster grows.
const PEEK_CLICK_TRANSFER_VISIBILITY_BY_DRILL_ID = new Map<string, { sampleCount: 1 | 9; onsetThreshold: number }>([
  [peekClickTransferPilotV1.id, peekClickTransferPilotV1.visibility],
  ...PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES.map((candidate): [string, { sampleCount: 1 | 9; onsetThreshold: number }] => [
    candidate.id,
    candidate.visibility,
  ]),
  [peekClickTransferPilotV2Randomized.id, peekClickTransferPilotV2Randomized.visibility],
  [peekClickTransferPilotV2Masked.id, peekClickTransferPilotV2Masked.visibility],
  [peekClickTransferV1.id, peekClickTransferV1.visibility],
]);
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
const liveSceneLoads = createSceneLoadCoordinator();

// WP-4 / T1（FR-4.1）— 目標渲染:唯讀 sharedState.targets 顯示/隱藏 mesh（狀態由 sim 改，見 T2/T3）。
let targetView = new TargetView(sceneManager.scene);
targetView.setShape(resolveTargetHitbox(activeDrillConfig).shape); // WP-46 / T3：初始 drill 的 hitbox shape 生效。

// WP-13 / T3（FR-B10）— 彈孔渲染:唯讀 sharedState.impacts（sim 命中時寫入）以單一 InstancedMesh
// 繪彈孔（1 draw call）。狀態由 sim 寫、本層唯讀（雙迴圈邊界）。
let impactView = new ImpactView(sceneManager.scene);

// WP-25 / T1（FR-E7）— tracer 渲染:唯讀 sharedState.shotRays（sim 產彈點寫入 origin→endpoint）。
// 顯示開關只存在 render 層，不進 sim / recorder / export。
let tracerView = new TracerView(sceneManager.scene);
let tracerEnabled = true;

let activeResolutionMode: ResolutionMode = 'native';
let displayState: DisplayState = applyResolutionMode(renderer, activeResolutionMode);

// WP-50 / T6 — 建構挪到這裡（而非檔案最尾端的 T3 原始位置）,好讓下面的 `resize()` 能安全讀
// `presentation.mode` 而不撞 TDZ：`liveFrame`（模組頂層 `function` 宣告,見檔案後段)本身會 hoist,
// 建構當下不需要它已經「跑到那一行」,只要在它真正被呼叫（第一個 rAF frame）之前存在即可——這裡遠早
// 於那個時間點。承接 T3 progress.md 記錄的「resize 路由是 T6 wiring 真正需要 replay-active resize
// 時的範圍」(D-50-P19)。
const presentation = createPresentationCoordinator({
  frame: liveFrame,
  resize: (w, h) => sceneManager.resize(w, h),
});

function resize(): void {
  // Replay 期間 canvas 已被搬進 replay viewport、由 `resizeReplayViewport()` 專責量測/套用尺寸
  // （見下方 T6 wiring）；這裡若照舊呼叫 `applyResolutionMode` 會把 canvas 拉回全螢幕尺寸，蓋掉
  // replay 的 viewport 佈局（FR-50.11 exclusive presentation ownership 的 render surface 版本）。
  if (presentation.mode === 'replay') return;
  displayState = applyResolutionMode(renderer, activeResolutionMode);
  sceneManager.resize(displayState.cssW, displayState.cssH);
}
resize();
window.addEventListener('resize', resize);

let activeWeaponOverride: WeaponId | undefined;

function activeWeaponConfig() {
  // WP-62 / T3：precedence（override -> drill 自宣告 -> app 預設）移到 `weapons.ts` 單一定義，
  // 讓決定性／接線測試斷言的是這條規則本身而非它的副本（C-D4）。語意逐位不變。
  return resolveActiveWeapon(activeWeaponOverride, activeDrillConfig.weaponId);
}

// WP-49 T1 — 宣告放在這裡（而非稍後 History 元件實際建構的賦值點）讓 canvas click handler
// （下方,早於 History 實際建好前就掛上）在其間任何 top-level await 期間讀到安全的
// `undefined`,而不是撞 TDZ ReferenceError（同 KI-013 對 `controls` 的處理方式）。
let historyScreenHandle: HistoryScreenHandle | undefined;
// WP-50 T6 — 同一 KI-013 慣例：Replay 全螢幕層晚於 canvas click handler 建構,先在此宣告安全的
// `undefined` 佔位。
let replayScreenHandle: ReplayScreenHandle | undefined;
// KI-017 — History Run Detail can become interactive while later dev/bootstrap awaits are still
// pending. Keep this binding out of TDZ so early replay clicks can guard and show user feedback.
let replayController: ReplayController | undefined;

// WP-1 / T2（FR-1.2）— Pointer Lock：click 取得、Esc/失焦解除、可重取。
const pointerLock = createPointerLock(canvas);

// WP-69 / T3（FR-69.2/69.3/69.6）— pause 生命週期與 sticky attempt validity 的**單一**權威
// （[RunAttemptController.ts]）。宣告在這裡而不是靠近下方的 pause 接線：camera consumer（幾行之後的
// `pointerLock.onMove`）與 InputSampler 都要讀它的相位，兩者都比 pause 接線早建構。
const runAttempt = createRunAttemptController();

/**
 * WP-69 / T4（README §2.4，FR-69.7）— 每一條「這一場結束了 / 要離開了」的路徑都必須先問它一次，
 * 而且只問它。它回的是一份 **plan**（可不可以建 payload / 顯示數值 / 下載 / 保存 / 推進），呼叫端
 * 讀欄位而不是自己判斷——`meta.suspect` 在本檔曾經是那個「大家各自解讀一次」的欄位，FM-2/FM-6 就是
 * 這樣長出來的。
 */
const finalizationGate = createAttemptFinalizationGate(runAttempt);

/**
 * WP-69 / T3（NFR-69.4，FM-5）— gameplay 採計/套用的**單一**閘（README §2.3）。
 * InputSampler 與 camera consumer 共用同一個布林，否則「擋了滑鼠卻沒擋視角」這種半套 pause 會靠
 * 兩份各自漂移的判準長出來。`active` 以外（paused / locking / resume-countdown）一律關閉——
 * 特別是 `resume-countdown`：那時鎖**已經**拿回來了，只有這個閘擋著倒數三秒內的偷跑。
 */
function isGameplayInputEnabled(): boolean {
  return runAttempt.phase === 'active';
}

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
  // WP-49 T1（FM-49.10）— History 為 z-index 最高的 full-screen application surface,理論上
  // 其 pointer-events:auto backdrop 已讓 canvas click 收不到事件;此處仍顯式擋一層，避免未來
  // overlay z-index 回歸（WP-9 曾發生 export panel z-index 低於 backdrop 的先例）重新引入
  // 「History 開著卻取得 Pointer Lock」。
  if (historyScreenHandle?.visible === true) return;
  // WP-50 T6 — Replay 期間 canvas 被搬進 replay viewport 內、直接收得到 click（不像 History 背後有
  // pointer-events:auto backdrop 擋一層）；缺這條會讓使用者點擊 3D replay 畫面時意外取得 live
  // Pointer Lock，違反 FR-50.11/NFR-50.5（replay 期間 Pointer Lock request 必須為 0）。
  if (replayScreenHandle?.visible === true) return;
  // 失敗時由 pointerlockerror 事件驅動 UI 復原，故吞掉 request 的 rejection。
  void pointerLock.request().catch(() => {});
});

// WP-1 / T4（FR-1.4）— yaw/pitch 視角：鎖定中的滑鼠 delta 累積到 camera 朝向。
// 走輸入/render 路徑，不入 sim（雙迴圈邊界，WP-2）；onMove 僅 locked 時轉發（T2）。
const cameraController = new CameraController(sceneManager.camera, sharedState.aim);
pointerLock.onMove((dx, dy) => {
  // WP-69 / T3（NFR-69.4）：與 InputSampler 共用同一個閘（見 `isGameplayInputEnabled`）。
  // `onMove` 只在鎖定中轉發，而 resume 倒數期間正是「已鎖定但還不該動」的窗。
  if (!isGameplayInputEnabled()) return;
  cameraController.applyDelta(dx, dy);
});
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

// KI-035 / BD-039（WP-63 T2）— `refreshRecorderMouseGain()` 的就緒旗標。`createSettingsPanel()`
// 在**建構當下**就把兩個預設值推過 callback 一次,而 `settingsPanel` 與 `recorder` 都是下方才宣告
// 的 `const`（TDZ）⇒ 那一次推送不能碰 recorder,否則 ReferenceError。建構時的初值改由
// `createDataRecorder({ mouseIntegration: { gain: currentMouseGain() } })` 負責（同一份設定）。
let recorderMouseGainWired = false;

const settingsPanel = createSettingsPanel({
  // KI-035（BD-039）:感度／FOV 一變更就把新的 gain 推進 recorder,否則 `ticks[].dYaw`/`dPitch`
  // 會沿用舊 gain 積分,而匯出的 `meta.mouseIntegration` 用當下設定重算 ⇒ 兩者發散且離線不可察覺。
  onSensitivityChange: (s) => {
    cameraController.setSensitivity(s);
    refreshRecorderMouseGain();
  },
  onFovChange: (deg) => {
    cameraController.setFov(deg);
    refreshRecorderMouseGain();
  },
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
let activeSessionPlanSelection: SessionPlanSelection | undefined;
// WP-58 T5 (§2.7) — the family sequence the running custom program actually visits, collapsed once
// at start from the compiled steps so every rep's export restates the same order (FR-58.14).
let activeCustomProgramFamilyOrder: readonly SessionFamilyId[] | undefined;
type PendingSessionMode = 'session' | 'resolution-protocol' | 'br-tracking-protocol' | 'session-plan';
let pendingSessionMode: PendingSessionMode = 'session';
let appMode: AppMode = 'launch';
let researcherMenu: ResearcherMenuHandle | undefined;
// KI-013：宣告放在 syncControlsVisibility()（下方）的定義點之前，讓 setAppMode()/researcherMenu
// 的按鈕 handler（早於本檔 controls 賦值點就掛上）在 controls 尚未建好前呼叫 syncControlsVisibility()
// 時能安全 no-op，而不是撞 TDZ ReferenceError（controls 賦值點之前有 top-level await，使用者/自動化
// 測試的點擊可能落在這個視窗內）。
let controls: ControlsHandle | undefined;
// WP-54 / T6：同 KI-013 pattern —— 研究員選單的 handler 早於本 session 的建構點掛上，宣告前置
// 讓建構完成前的點擊安全 no-op，而不是撞 TDZ ReferenceError。
let trackingPilotSession: TrackingPilotSessionHandle | undefined;
// WP-54 / T6：boot barrier。本檔後段有 top-level await（dev harness、measureDisplayHz、replay
// controller），在那之前整條 drill 載入鏈路（`resetRunPresentation` 等 `let` 綁定）仍在 TDZ；
// 研究員在 boot 視窗內按下「Start manifest」會撞 `Cannot access 'resultShown' before
// initialization`（由 `tracking-pilot-live.spec.ts` 實測抓到）。載入 pilot block 前先等這個
// promise，boot 視窗內的操作只是稍晚開始，而不是丟一個內部錯誤給操作員。
let markAppBooted: (() => void) | undefined;
const appBooted = new Promise<void>((resolve) => {
  markAppBooted = resolve;
});
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
  // WP-52 T2: widened beyond the frozen four-family TEST_FAMILY_IDS so operators can freely
  // include 'peek-click-transfer' in a Session Plan — same single-source allowlist KI-016 fixed
  // metadata validation against, no separate preset-selection UI (WP-43 FR-H3 already removed that
  // in favor of free family checkboxes + free rest-seconds).
  families: [...KNOWN_SESSION_FAMILY_IDS],
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
  // WP-70 / T1（FR-70.1）— 匯出的 fullscreen suspect 成分的**唯一**真值來源。沿用上面算好的
  // `recording`，不另開第二套判準（C-D4：KI-007 的錄製窗定義只能有一個）。
  //
  // 與 `handleFullscreenChange()` 並存而不取代它：那個呼叫仍負責 session 級的 `onSuspect` 去重
  // 觸發（橫幅掛點，OQ-70.2），本行負責**這一場**的效度事實 —— 由 `resetState()` 每場歸零。
  //
  // **不**以 `experimentSession.active` 為前提（比照 `pointerLockLostDuringRun` 的同型理由）：
  // 錄製中掉出全螢幕這件事與有沒有跑正式實驗流程無關，欄位叫 `fullscreenExited` 就不該在某些
  // 模式下對著已發生的退出回報 false。實務差異接近零——只有資格閘會進 Element fullscreen。
  if (!fullscreen && recording) sharedState.validity.fullscreenExitedDuringRun = true;
  if (!fullscreen) markProtocolFullscreenExit?.();
});

// WP-43 / T1（FR-H1/H4）— 啟動器收斂為選手測試 / 研究員模式兩個主入口。未獲產品歸類的
// legacy「實驗 session」依 D-43.5 保留為次要第三入口；三條 eligibility 路徑仍沿用既有 routing。
const launchButtonCss = [
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

function setAppMode(next: AppMode): void {
  appMode = next;
  if (next === 'researcher') researcherMenu?.open();
  else researcherMenu?.close();
  syncControlsVisibility();
}

function openSessionSetup(mode: PendingSessionMode): void {
  setAppMode('session');
  pendingSessionMode = mode;
  sessionSetupForm.open();
}

const mainLaunchActions = document.createElement('div');
mainLaunchActions.setAttribute('data-launch-tier', 'primary');
mainLaunchActions.style.cssText = 'display:flex;flex-direction:column;gap:8px';

const participantSessionButton = document.createElement('button');
participantSessionButton.type = 'button';
participantSessionButton.textContent = '選手測試 Session';
participantSessionButton.title = '選擇家族與具名 preset 後執行 session plan';
participantSessionButton.style.cssText = launchButtonCss;
participantSessionButton.addEventListener('click', () => openSessionSetup('session-plan'));

const researcherModeButton = document.createElement('button');
researcherModeButton.type = 'button';
researcherModeButton.textContent = '研究員模式';
researcherModeButton.title = '開啟單一 Drill 調整與研究 protocol';
researcherModeButton.style.cssText = launchButtonCss;
researcherModeButton.addEventListener('click', () => setAppMode('researcher'));

// WP-49 T1（FR-49.1）— 所有使用者都能進入的歷史紀錄入口；`historyScreenHandle` 已於檔案上方
// 宣告避免 TDZ（KI-013 pattern），實際 handle 於下方 History 元件建構區塊賦值。
const historyButton = document.createElement('button');
historyButton.type = 'button';
historyButton.textContent = '歷史紀錄';
historyButton.title = '瀏覽 Participant 過去的 Assessment 結果與趨勢';
historyButton.style.cssText = launchButtonCss;
historyButton.addEventListener('click', () => historyScreenHandle?.open());

mainLaunchActions.append(participantSessionButton, researcherModeButton, historyButton);

const experimentButton = document.createElement('button');
experimentButton.type = 'button';
experimentButton.textContent = '實驗 session';
experimentButton.title = '尚待歸類的既有入口：進入資格閘（GD-10 防線①）';
experimentButton.style.cssText = `${launchButtonCss};opacity:0.72`;
experimentButton.setAttribute('data-launch-tier', 'legacy');
experimentButton.addEventListener('click', () => openSessionSetup('session'));

sessionLaunchControls.append(mainLaunchActions, experimentButton);
researcherMenu = createResearcherMenu({
  parent: sessionLaunchControls,
  onSelectDrillControls: () => {
    researcherMenu?.close();
    syncControlsVisibility();
  },
  onSelectResolutionProtocol: () => openSessionSetup('resolution-protocol'),
  onSelectBrProtocol: () => openSessionSetup('br-tracking-protocol'),
  // WP-54 / T6：tracking pilot 自帶 participant/session/rest 表單（operator screen），不走
  // `openSessionSetup()` 的 SessionSetup→EligibilityGate 路徑——本 WP 不操弄解析度條件，
  // 沿用「單一 Drill 調整」那條「研究員選單直接開啟」的既有分支語意。
  onSelectTrackingPilot: () => {
    researcherMenu?.close();
    setAppMode('researcher');
    trackingPilotSession?.open();
  },
});

// WP-54 / T6 slice 1 — tracking pilot 正式接線：T5 交付的 runner/operator screen 首次接上真實
// 的 drill 載入與匯出路徑（取代 `trackingPilotOperatorHarness.ts` 的 fake stub，D-54.27）。
// `exportBlock` 直接重用既有的 `buildCurrentExportPayload()`，pilot 匯出與 ProtocolRunner/
// SessionRunner 匯出共用同一條組裝路徑（不另開第二條匯出語意）。
//
// **建構點就緊接在研究員選單之後**（而不是留到本檔後段的 protocol/session 接線區）：本檔後段有
// top-level await（dev harness、measureDisplayHz），若建構點落在那之後，使用者在該 await 視窗內
// 按下「Tracking pilot」會撞上 KI-013 的 `?.` 安全 no-op —— 對 controls 那種被動同步無妨，但對
// 一個主入口按鈕就是「按了沒反應」。這裡到選單建構之間沒有任何 await，視窗因此為零。
// 注入的四個函式（loadDrillConfigDirect/buildCurrentExportPayload/setProtocolStatus 與 import
// 的 downloadJSON）都是 hoisted function 或 import，實際呼叫一律發生在互動時（模組早已求值完）。
trackingPilotSession = createTrackingPilotSession({
  loadDrillConfig: async (config) => {
    await appBooted;
    await loadDrillConfigDirect(config);
  },
  exportBlock: () => buildCurrentExportPayload(),
  onBlockExported: (payload) => downloadJSON(payload, { basename: exportBasename(payload) }),
  onStatus: (text) => setProtocolStatus(text, false),
  // 讓每個 block 匯出都能回溯到受試者與 manifest cell：重用既有的 `meta.session` 欄位
  // （participantId + sessionLabel），不新增 schema 欄位。
  onManifestStart: (manifest) => {
    sessionSetupValues = {
      participantId: manifest.participantId,
      sessionLabel: manifest.generatedFromCounterbalanceCell,
    };
  },
});
pointerLock.onChange((locked) => {
  topLeftControls.style.display = locked ? 'none' : 'flex';
});

// KI-005 / A（FR-A-1/7）— tick 窗 mouse 積分的感度 gain。與 collectMeta 的 `meta.mouseIntegration`
// 讀**同一組輸入**（`settingsPanel` 的 sensitivity/FOV + 當前武器的 ads），`buildCurrentExportPayload`
// 內另算一份。
//
// KI-035（2026-09-14 更正）—— 這裡原本宣稱兩者「不可能發散」,那是設計意圖不是現行保證。實際保證
// 是「recorder 的 gain 在下列**每一個**時機都被重設,故任何一刻都是最新值」:
//   1. recorder 建構（`createDataRecorder({ mouseIntegration: ... })`）
//   2. 換武器（`loadWeaponById()`）與換 drill（`activateDrill()`）—— ads 光學會換
//   3. 感度／FOV 滑桿變更（`refreshRecorderMouseGain()`,BD-039 的 (a)）
// 「同一份 `ticks[]` 前後段用同一組 gain」則由 BD-039 的 (b) 保證:`syncAimSettingsLock()` 在
// `countdown`/`running` 期間停用兩個滑桿。(a) 與 (b) 分工不同,缺一不可——(b) 關掉 run 內變更,
// (a) 讓 run **之間**的每一次變更都即時生效（載入 drill 後、取鎖之前調滑桿正是 KI-035 的原始症狀）。
function currentMouseGain() {
  return resolveMouseGain({
    sensitivity: settingsPanel.sensitivity,
    hipFovDeg: settingsPanel.fov,
    ads: activeWeaponConfig().ads,
  });
}

// KI-035 / BD-039 (a)（WP-63 T2）— 把當下設定的 gain 推進 recorder。`recorderMouseGainWired` 之前
// 的呼叫（= `createSettingsPanel()` 建構時的預設值推送）一律略過:那時 `recorder` 還在 TDZ,而它
// 自己的建構參數就已經帶了同一份 gain。
function refreshRecorderMouseGain(): void {
  if (!recorderMouseGainWired) return;
  recorder.configureMouseIntegration({ gain: currentMouseGain() });
}

// WP-7 / T4（FR-7.4）— 匯出控制：讀取 recorder snapshot + metadata 後下載 JSON/CSV。
// 讀取與序列化只在 click handler 內發生，不進 sim tick 熱路徑。
// KI-005 / A（FR-A-7，OQ-A-1「全域開」）：app 佈線層啟用 mouse 積分——opt-in 只保 golden 逐位不變，
// 不得成為「功能上線但實務未生效」。
// KI-005-A / OQ-A-2 / TD-5（2026-08-07 A2-T1 前置決策再拍板：開）：啟用 additive `key` 事件記錄，
// 供離線推導原移動鍵的 sub-tick 釋放時刻（KI-006 構念分析需要，補 tick-derived release 的 ±1 tick
// 量化）。關閉時匯出逐位不變（NFR-A-2 同一紀律），開啟只新增資料，不改既有欄位語意。
// WP-60 / T2（FR-60.2）— raw mouse sample 擷取的 app 佈線層開關，**預設關閉**。
// 為何不像 `recordKeyEvents` 那樣全域開：WP-60 T0 的 entry gate 是**經驗性**的且尚未通過
// （R1 —— `getCoalescedEvents()` 在 Pointer Lock 下是否真的回傳次幀樣本，repo 內只有註解宣稱、
// 無實機證據）。在那個數字量到之前，把逐筆擷取設成所有受測者的常態熱路徑，等於用一個未驗證的
// 前提去換 8.6 MB 常駐 arena 與數 MB 匯出增幅。`?rawMouse=1` 因此同時是兩件事：opt-in 開關，
// 以及 T0 PoC 缺的那個入口 —— 真瀏覽器 + 真 COI + 真滑鼠跑一輪，即可從匯出讀
// `meta.mouseSampling.observedRateHz` 與 `mouseSamples.dtUs` 的分布來結掉 R1/R2。
const rawMouseSampleCapture = new URLSearchParams(window.location.search).get('rawMouse') === '1';
const operatorAnnotationCapture = new URLSearchParams(window.location.search).get('annotation') === '1';
const recorder = createDataRecorder({
  simHz: SIM_HZ,
  // WP-60 / T2：raw sample arena 的容量來源（1000 Hz × 本值 × headroom）。與匯出的
  // `meta.maxDrillSeconds` 綁同一個常數，避免兩處各寫一個上限；tick arena 的容量本來就用此預設值，
  // 顯式傳入不改變 `capacityForDrill()` 的結果。
  maxDrillSeconds: DEFAULT_MAX_DRILL_SECONDS,
  mouseIntegration: { gain: currentMouseGain() },
  recordKeyEvents: true,
  recordAnnotationEvents: operatorAnnotationCapture,
  recordMouseSamples: rawMouseSampleCapture,
});
// KI-035 / BD-039 (a)：recorder 存在之後，感度／FOV 的每一次變更才可以（也必須）推 gain 進來。
recorderMouseGainWired = true;
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
    // WP-58 T5 (FR-58.14/58.15) — each track states what it actually ran, and only that.
    //
    // The frozen arm keeps writing exactly the two stage8 fields it always wrote: its export stays
    // bit-identical to its pre-WP-58 form (FR-58.10 / Delivery policy), so it does *not* gain a
    // `sessionPlanMode: 'frozen'` stamp. Absence of the mode therefore means "not a custom program",
    // which is also true of every payload written before WP-58 — and it is why the cohort rule
    // downstream is written as `=== 'custom'` rather than `!== 'frozen'`.
    //
    // The custom arm restates the whole program plus this export's coordinates in it, so three reps
    // of one drill are three payloads that differ by `sessionPlanRepIndex`. `sessionPlanRestSeconds`
    // keeps its existing meaning (the family seam); the drill/rep seam gets its own field (§2.7).
    ...sessionPlanAuditFields(sessionPlanRunner.phase),
    fovDeg: settingsPanel.fov,
    crossOriginIsolated: isolation.crossOriginIsolated,
    startedAt: recorderStartedAt,
    lateEventCount: sharedState.inputMeta.lateEventCount,
    bufferOverflow: sharedState.inputMeta.bufferOverflow,
    recorderOverflow: snapshot.recorderOverflow,
    // 純觀測 suspect:錄製中退出 fullscreen(GD-10 failure mode)、或 drill frame p95
    // 超過效能地板(GD-10 防線③)。玩家逸出走廊**不在此列**(K-3,KI-004 / S1 T3):越界的真實
    // 後果是視覺遮擋,而場景幾何永不進 sim(GD-6),不可能影響命中判定 —— 屬「該記錄的觀測」而非
    // 「該作廢的 run」,越界事實改由下方 meta.validity.corridorExceeded 記錄。
    //
    // WP-70 / T1 — 這裡**刻意不再讀 `experimentSession.suspect`**（KI-040 缺陷 A）。fullscreen 成分
    // 改由下方 `validity.fullscreenExited` 供應，`collectMeta()` 會把它 OR 進 `meta.suspect`
    // （與 `pointerLockLost`／`pauseOccurred` 同一條路徑）。差別是**效力單位**：舊來源 session 級
    // sticky、永不復位；新來源每場 `resetState()` 歸零 ⇒ 與這一行右半邊的 per-run 效能地板對齊。
    // protocol 分支仍讀 `protocolContext.suspect`（該路徑的錄製窗判準由 T2 補上）。
    suspect: (protocolContext?.suspect ?? false) || frames.summary.p95 > PERF_FLOOR_MS,
    simToWorld: SIM_TO_WORLD,
    // meta.validity(KI-004 / S1 T2,FR-S1-15):與上面的 suspect **不是同一集合**,純觀測拆解,
    // 前拉自 OQ-S1-2;`suspect` 本身的 OR 集合逐位不變。
    validity: {
      corridorExceeded: sharedState.validity.playerCorridorExceeded,
      perfFloor: frames.summary.p95 > PERF_FLOOR_MS,
      recorderOverflow: snapshot.recorderOverflow,
      bufferOverflow: sharedState.inputMeta.bufferOverflow > 0,
      // WP-65 / T5（FR-65.9/65.10）— 本物件是**逐欄手抄**而非展開 sharedState.validity，所以新旗標
      // 必須在這裡明寫，否則會靜默漏掉整條鏈（旗標在記憶體裡翻了、匯出卻永遠 false）。
      // `collectMeta()` 會把它 OR 進 `meta.suspect`（OQ-65.1）。
      pointerLockLost: sharedState.validity.pointerLockLostDuringRun,
      // WP-69 / T4（FR-69.8/69.11）— 讀 `runAttempt`，**不**讀 `sharedState.validity`：這兩個是
      // 兩個構念（前者「這場能不能被採納」、後者「輸入鎖遺失這件事」），錄製中掉鎖會讓兩者同時為
      // 真，但判準未來可能分岔。這個欄位讓 payload 自述「我不可採納」，也讓 `HistoryPersistence`
      // 的第二道防線有東西可讀（README §2.4 defense in depth）。
      pauseOccurred: runAttempt.pauseOccurred,
      // WP-70 / T1（FR-70.1/70.2）— 同上，**逐欄手抄**的第七欄。讀 `sharedState.validity` 而非
      // `experimentSession.suspect`：前者每場歸零（run 級，與同物件的 `perfFloor` 對齊），後者是
      // session 級 sticky，一次中斷會污染其後每一場（KI-040 缺陷 A）。
      fullscreenExited: sharedState.validity.fullscreenExitedDuringRun,
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
      // WP-66 / T3（FR-66.10）：optional-in 的效度斷代自述——省略時不寫入該鍵，既有 payload 鍵面不變。
      ...(activeDrillConfig.targets.hitFeedback !== undefined
        ? { hitFeedback: activeDrillConfig.targets.hitFeedback }
        : {}),
    },
    // WP-54 / T7：protocolGuard 快照原樣帶出（比照 spawn 的 opaque pass-through）。離線 eligibility
    // 必須能從 payload 本身得知這個 run 是否宣告了 requireFire，才不會用結果去定義判準。
    ...(activeDrillConfig.protocolGuard !== undefined ? { protocolGuard: activeDrillConfig.protocolGuard } : {}),
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
      ...(activeDrillConfig.targets.trackingTrajectory !== undefined
        ? { trackingTrajectory: activeDrillConfig.targets.trackingTrajectory }
        : {}),
      ...(activeDrillConfig.timing.trackingPrepMs !== undefined
        ? { trackingPrepMs: activeDrillConfig.timing.trackingPrepMs }
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
            protocolVersion: assessmentProtocolVersionForDrill(activeDrillConfig.drillId),
            assessmentFeedbackPolicy,
          },
        }
      : {}),
    ...(PEEK_CLICK_TRANSFER_VISIBILITY_BY_DRILL_ID.has(activeDrillConfig.drillId)
      ? { visibility: PEEK_CLICK_TRANSFER_VISIBILITY_BY_DRILL_ID.get(activeDrillConfig.drillId) }
      : {}),
  });
  return buildExportPayload(meta, snapshot);
}

// ─── WP-69 / T4：attempt finalization（FR-69.7/69.8/69.9/69.12） ────────────────────────────────
// 這一段是「這一場能不能被當成紀錄」的**唯一**接線。以下每一個消費者都只讀 plan 的欄位:
// `liveFrame()` 的收工分支、`resetRunPresentation()` 的離開分支、兩個匯出面板、Result 的稽核下載。

/**
 * 交給 gate 的錄製快照。`bufferOverflow` 讀 `sharedState.inputMeta`（輸入環的溢位）、
 * `recorderOverflow` 讀 arena——與 `collectMeta()` 裡那兩個欄位**同源同義**，不另立第二套判準。
 */
function recordingSnapshotForGate(): RecordingSnapshot {
  const snapshot = recorder.snapshot();
  return {
    ticks: snapshot.ticks,
    events: snapshot.events,
    simHz: SIM_HZ,
    bufferOverflow: sharedState.inputMeta.bufferOverflow > 0,
    recorderOverflow: snapshot.recorderOverflow,
  };
}

/**
 * 本 attempt 的終局判定，**一場一次**。memo 不是最佳化而是正確性：gate 讀的是當下的 recorder 與
 * fence，而收工之後這兩者還會繼續動（`liveFrame()` 不看相位照樣 pump，收工釋鎖也會補一筆
 * `pointer_lock` 事件）。不 memo 的話，同一場在 Result 上按下匯出時可能拿到與收工當下不同的答案
 * ——那正是 double finalization。`resetRunPresentation()` 清掉它，新 attempt 重新判一次。
 */
let finalizedPlan: AttemptFinalizationPlan | undefined;

function finalizeAttempt(): AttemptFinalizationPlan {
  finalizedPlan ??= finalizationGate.decide(recordingSnapshotForGate());
  return finalizedPlan;
}

/**
 * 匯出鈕要遵守的 plan。已 finalize 就用那一份（Result 顯示的是**那一場**）；還沒 finalize 的隨手
 * 匯出只有在「這一場曾暫停」時才需要問 gate —— 從未暫停的路徑維持既有行為逐位不變（NFR-69.1）。
 * 把 integrity 判準套到任意時點的隨手匯出上不是本 WP 的範圍，只會給乾淨路徑長出新的拒絕理由。
 */
function attemptPlanForExport(): AttemptFinalizationPlan {
  if (finalizedPlan !== undefined) return finalizedPlan;
  if (!runAttempt.pauseOccurred) return planFinalization({ kind: 'eligible-candidate' });
  return finalizationGate.decide(recordingSnapshotForGate());
}

/** 正式匯出（JSON/CSV）的守門。丟例外 = 兩個面板的既有 catch 會把理由 alert 出來。 */
function requireOfficialExport(): void {
  const plan = attemptPlanForExport();
  if (plan.download === 'official') return;
  if (plan.disposition.kind === 'discarded') {
    throw new Error(
      `本次紀錄已作廢（${describeDiscardReason(plan.disposition.reason)}），沒有可匯出的資料；請重新測試。`,
    );
  }
  throw new Error('本次曾暫停，已失去實驗效力：正式匯出已停用。請改用結果頁的「下載稽核檔」。');
}

/** OQ-69.1 / D-69-T0-3 —— 稽核檔的**唯一**產生路徑：操作員手動按，檔名強制帶 `.invalid-paused`。 */
async function downloadInvalidDiagnostic(): Promise<void> {
  const plan = attemptPlanForExport();
  if (plan.download !== 'diagnostic-manual') throw new Error('本次沒有可下載的稽核檔。');
  const payload = await buildCurrentExportPayload();
  downloadJSON(payload, { basename: invalidAttemptBasename(exportBasename(payload)) });
}

/** Result 上的不可採納說明。`null` = 可採納（既有畫面逐位不變）。 */
function invalidAttemptNoticeFor(plan: AttemptFinalizationPlan): Parameters<typeof resultScreen.setInvalidAttempt>[0] {
  if (plan.download !== 'diagnostic-manual') return null;
  return {
    text: '本次曾暫停，已失去實驗效力：不會進入歷史／趨勢，也不能用於門檻判定。此檔僅供稽核，需要保留請按右側下載。',
    downloadLabel: '下載稽核檔（.invalid-paused）',
    onDownload: () => downloadInvalidDiagnostic(),
  };
}

/**
 * WP-69 / T5（FR-69.10，FM-6）— invalid/discarded 時三個 orchestrator 的**唯一**處置點。
 *
 * T4 已經讓它們不會前進（收工分支的 `!plan.advancesOrchestrator` 早退）。少的是另一半：操作員看
 * 不到任何東西告訴他「這一項還沒完成、要重跑」，而 pilot 連「第幾次 attempt 失敗、為什麼」都沒有
 * 留痕。這個函式補的就是那一半，而且**只**在這裡補——三個 runner 都不自己從 `meta.suspect` 或
 * `pointerLockLost` 重算一次 disposition（C-D4）。
 *
 * 三者的差別只在通道，不在規則:pilot 有自己的 status 與 audit（`retryRunningBlock()` 一併把同一
 * 個 block 的 attempt +1，index/config/seed 不動）；Session 與 Protocol 只是**不動**，所以它們要
 * 的只有一句話，寫進既有的 `#protocol-status`。沒有任何 orchestrator 在跑時則完全靜默——單機
 * standalone drill 的畫面不該因為本 WP 多出一條狀態列（NFR-69.1）。
 */
function holdOrchestratorsOnAttempt(plan: AttemptFinalizationPlan): void {
  const notice = describeAttemptHold(plan);
  // 第二個條件不是重複判斷:`describeAttemptHold()` 回 `null` 的時機與 `eligible-candidate` 是同一
  // 個,但只有這一行能把 `plan.disposition` 收窄成 `HeldAttemptDisposition` 交給 pilot。
  if (notice === null || plan.disposition.kind === 'eligible-candidate') return;
  // pilot 優先:它是唯一需要記帳（audit + attempt +1）而不只是停住的 runner，且它自己的 status
  // 通道已經把 block/attempt/reason 說完，不需要再蓋上一句泛用文案。
  if (trackingPilotSession?.handleInvalidAttempt(plan.disposition) === true) return;
  // WP-58 / T3 的先例：顯式標註型別，phase union 有任何改動要在這裡編譯期爆掉而非靜默失配。
  const sessionPhase: SessionRunnerPhase = sessionPlanRunner.phase;
  if (sessionPhase.kind !== 'run' && activeProtocolRunner.current === undefined) return;
  setProtocolStatus(notice, false);
}
// ─── WP-69 / T4 finalization 結束（T5 的 orchestrator hold 見上） ───────────────────────────────

createExportPanel({
  async onExportJSON(): Promise<void> {
    requireOfficialExport();
    const payload = await buildCurrentExportPayload();
    downloadJSON(payload, { basename: exportBasename(payload) });
  },
  async onExportCSV(): Promise<void> {
    requireOfficialExport();
    const payload = await buildCurrentExportPayload();
    downloadCSV(payload, { basename: exportBasename(payload) });
  },
});

// WP-48 T5（FR-48.1/48.8）— Assessment-only 自動保存：main.ts 只建立/呼叫 HistoryPersistence，
// 不直接 fetch、組 API URL 或處理 filesystem error（README §2.4 D-48.P1/D-48.P6）。
const historyClient = createHistoryClient();
const historyPersistence = createHistoryPersistence(historyClient);
const historySaveStatus = createHistorySaveStatus({ onRetry: () => void historyPersistence.retry() });
historyPersistence.subscribe((state) => historySaveStatus.render(state));

// WP-49 T1（FR-49.1/49.6）— navigation/controller/shell only；real Participant/drill/run
// browsing UI is T2/T3, drill metric trends are T4. `historyLibraryController` already reacts
// to route changes against the real `historyClient` (WP-48) — T2 just adds the list-rendering
// components that consume `historyLibraryController.state`.
const historyNavigator = createHistoryNavigator();
const historyLibraryController = createHistoryLibraryController({ navigator: historyNavigator, client: historyClient });
// WP-49 T4/T5 — pure, network-free descriptor lookup shared conceptually with the server-side
// analysis service (`HistoryAnalysisService`, README §2.6): the drill trend section (T5) needs
// `registrationForExactDrill` for metric labels/units/direction, never `project()` client-side.
const drillMetricRegistry = createDrillMetricRegistry();
historyScreenHandle = createHistoryScreen({
  navigator: historyNavigator,
  controller: historyLibraryController,
  registry: drillMetricRegistry,
  onReplay(runId: string): string | void {
    const controller = replayController;
    if (controller === undefined) return 'Replay 尚未就緒，請稍後再試。';
    const route = historyNavigator.current;
    const sourceLabel = route?.kind === 'run' ? `${route.drillId} · ${runId}` : runId;
    controller.open({ kind: 'historical', runId }, sourceLabel);
  },
});
historyLibraryController.start();

// WP-50 T6（FR-50.14）— 供「當次 Result → 3D 重播」使用；每次 show 都更新,不因保存失敗而消失
// （OQ-50.2/D-50-P9：Practice 或保存失敗仍可 replay 這份記憶體中的 payload）。
let lastResultPayload: ExportPayload | undefined;

const resultScreen = createResultScreen({
  saveStatusView: historySaveStatus.element,
  onRestart: restartActiveDrill,
  async onExportJSON(): Promise<void> {
    requireOfficialExport();
    const payload = await buildCurrentExportPayload();
    downloadJSON(payload, { basename: exportBasename(payload) });
  },
  async onExportCSV(): Promise<void> {
    requireOfficialExport();
    const payload = await buildCurrentExportPayload();
    downloadCSV(payload, { basename: exportBasename(payload) });
  },
  // WP-49 T5（FR-49.12）— History 全螢幕層 z-index 高於 Result dialog（HistoryScreen.ts 註解），
  // 直接 push route 讓 History 蓋上來即可；不需要先 hide() Result——關閉/返回 History 後，這個
  // Result dialog 原封不動地還在底下（同一 payload/actions，未重算、未替換成 historical payload，
  // T5 高風險失效模式表「close to Result」要求）。
  onOpenHistory(target): void {
    historyNavigator.push({ kind: 'drill', participantId: target.participantId, drillId: target.drillId, runFilter: 'all' });
  },
  onReplay(): void {
    if (lastResultPayload === undefined) return;
    // WP-69 / T4（T4 Step 5）— 第三道:按鈕在不可採納時已被 `setInvalidAttempt()` 收起,但 replay
    // 會把不可採納（或不可信）的一場當成可檢視的紀錄重放,所以入口本身也拒收一次。
    if (lastResultPayload.meta.validity?.pauseOccurred === true) return;
    replayController?.open({ kind: 'current', payload: lastResultPayload }, '目前結果');
  },
});

/** WP-49 T5（FR-49.12）— 顯示 Result 並串接 History 保存，供 live completion handler 與 dev-only
 * harness 共用（避免兩份「show + save + 視結果接歷史入口」邏輯各算一套）。Assessment 成功保存後才
 * `setHistoryTarget()`；Practice（`historyPersistence.save` 回 `excluded`）或保存失敗都不會呼叫，
 * 按鈕維持隱藏（FR-49.12「Practice Result不顯示歷史入口」／T5 高風險失效模式表）。回傳值供呼叫端
 * fire-and-forget，不阻擋 session/protocol 後續流程（沿用既有 D-48.P6 NFR-48.8 語意）。*/
function showResultAndTrackHistory(
  payload: ExportPayload,
  /**
   * WP-69 / T4 — 預設值讓既有呼叫端（dev-only harness）行為逐位不變；live 路徑一律明傳 gate 的
   * 判定。`savesHistory === false` 時**根本不呼叫** `historyPersistence.save()`：那是第一道防線,
   * `HistoryPersistence` 內的 `invalid-attempt` 排除是第二道（README §2.4 defense in depth）。
   */
  plan: AttemptFinalizationPlan = planFinalization({ kind: 'eligible-candidate' }),
): Promise<HistorySaveState> {
  lastResultPayload = payload;
  resultScreen.show(buildResultPresentation(payload));
  resultScreen.setInvalidAttempt(invalidAttemptNoticeFor(plan));
  // WP-65 / T5（FR-65.11）— 每一場都明確設定一次（含 `null`）。旗標讀自 **payload**（那一場的匯出
  // 事實）而非 `sharedState`（會被下一場的 `resetState()` 清掉），所以歷史／重播路徑拿到同樣的答案。
  resultScreen.setValidityWarning(
    payload.meta.validity?.pointerLockLost === true
      ? '本場測試中途失去滑鼠鎖定（ESC／切換視窗），期間的滑鼠移動未被記錄，本場資料可能失效——建議重新測試。'
      : null,
  );
  // WP-69 / T4（FR-69.8，NFR-69.7）— 不可採納時 `HistoryClient.saveRun` 的呼叫數必須是 0,所以這裡
  // 連 `historyPersistence.save()` 都不呼叫;狀態列改為直接呈現排除理由（與第二道防線同一個字面）。
  if (!plan.savesHistory) {
    const excluded: HistorySaveState = { kind: 'excluded', reason: 'invalid-attempt' };
    historySaveStatus.render(excluded);
    return Promise.resolve(excluded);
  }
  const savePromise = historyPersistence.save(payload);
  void savePromise.then((state) => {
    if (state.kind === 'saved') {
      resultScreen.setHistoryTarget({ participantId: state.run.participantId, drillId: state.run.drillId });
    }
  });
  return savePromise;
}

// WP-8 / T3（FR-8.3）— 即時 HUD：rAF 只讀 SharedState + recorder counters，不進 sim、不 snapshot。
const hud = createHUD();

// WP-65 / T3（FR-65.6）— 待命提示與倒數數字。與 HUD 同為 rAF 唯讀呈現層，故建在它旁邊；
// `pointer-events:none` 讓待命期的點擊穿透到 canvas 取鎖（＝解除待命的訊號，D-65-1）。
const drillStartOverlay = createDrillStartOverlay();

// WP-69 / T2 — active measurement time 的**單一**映射點（README §2.2）。首次 pause 前恆為 identity
// （`mapWallTime(now) === now`,逐位),所以未暫停的路徑與 WP-69 之前逐位相同（NFR-69.1）。
// pause 期間 rAF 照跑、`pump()` 照呼叫,但餵進去的是凍結值 ⇒ delta=0 ⇒ ticks=0;resume 不會有
// catch-up 或 >250ms re-anchor（NFR-69.2,見 SimLoop.pump 的 clamp/re-anchor 與 T0.4 實測）。
// T3 把觸發點接上（Pointer Lock → pause）；宣告點上移到 InputSampler 之前，讓下方的 pause runtime
// 與 sampler 的 `mapEventTime` 都讀得到同一個 mapper，`activeClock`/`buildSimLoop()` 不受影響。
const timeMapper = createPausableTimeMapper();

// ─── WP-69 / T3：pause runtime（FR-69.1/69.2/69.4/69.5/69.6） ────────────────────────────────
// 這一小段是 app 這一層**唯一**的 pause 接線。權威分工：相位與 sticky validity 在 `runAttempt`、
// 量測時鐘在 `timeMapper`、取鎖成功與否在 `pointerLock` 的事件、畫面在 `pauseOverlay`。
// 本檔只負責把它們按正確順序串起來，不重新定義其中任何一個構念（C-D4）。

/** 恢復倒數長度 = 該 drill 自己的 `timing.countdownMs`（FR-69.5）——不另立第二個常數。 */
function resolveResumeCountdownMs(): number {
  return activeDrillConfig.timing.countdownMs;
}

/** `null` = 目前沒有進行中的恢復倒數。wall ms：倒數期間 active time 仍凍結，不能拿它計時。 */
let resumeCountdownEndsAtWallMs: number | null = null;
// 四個 view 各一個重用實例：`liveFrame()` 每幀都會呼叫 `pauseOverlay.update()`，其中「未暫停」
// 是每一場每一幀都會走到的路徑 ⇒ 在那裡每幀配置一個物件會把 NFR-69.5 的「熱路徑零配置」變成空話。
// 倒數 view 以就地改寫 `remainingMs` 重用（`update()` 只讀不存）。
const PAUSE_VIEW_HIDDEN: PauseOverlayView = { kind: 'hidden' };
const PAUSE_VIEW_PAUSED: PauseOverlayView = { kind: 'paused' };
const PAUSE_VIEW_LOCKING: PauseOverlayView = { kind: 'locking' };
const pauseCountdownView = { kind: 'resume-countdown' as const, remainingMs: 0 };
/** 上一次取鎖失敗的可重試訊息（FR-69.5）。`undefined` = 沒有錯誤 ⇒ 用上面的共用 `paused` view。 */
let pauseErrorView: PauseOverlayView | undefined;
/**
 * WP-69 / T4（FR-69.9）— 作廢告知。`undefined` = 沒有作廢。
 *
 * 刻意是**閂鎖**而不是從 `runAttempt.phase` 推導：作廢與相位正交（resume 後跑完再作廢時相位是
 * `active`，暫停中收工時是 `paused`），拿相位去猜會兩邊都猜錯。由 `resetRunPresentation()` 清除,
 * 也就是說它活到操作員按下 Restart／換 drill 為止——這正是它該活的長度。
 */
let discardedNoticeView: PauseOverlayView | undefined;

const pauseOverlay = createPauseOverlay({
  // 兩個回撥都必須**同步**執行到底：Resume 的 `requestPointerLock()` 只在這一次 click 的 user
  // gesture stack 內才會被瀏覽器接受（FM-4）。任何 `await`／`setTimeout` 跳板都會讓取鎖靜默失敗。
  onResume: () => requestResume(),
  onRestart: () => restartActiveDrill(),
});

/**
 * 進入 pause。**順序是硬的**：先凍結 mapper、再開 attempt fence、最後補 release edge。
 *
 * 先凍結 mapper ⇒ fence 兩端與 release edge 都蓋在同一個 active ms 上，fence 退化成一個點
 * （D-69-T1-1／D-69-T2-1），沒有任何戳記可能落在裡面。順序顛倒 fence 就會張開，而張開的 fence
 * 正是 `pause-fence-unclosed` 要抓的東西 —— 我們會被自己的 validator 判成 `discarded`。
 *
 * 已在 `paused` 時為 no-op；`locking`／`resume-countdown` 期間再次掉鎖會落回這裡（FR-69.5），
 * 此時 mapper 仍凍結、fence 仍開著，兩者都是冪等的。
 */
function beginPause(): void {
  if (runAttempt.phase === 'paused') return;
  runAttempt.pause(timeMapper.pause(performance.now()));
  // release edge 走 ring（不是直接寫 `SharedState.held*`）：held 狀態是 sim 依時序消費輸入推導出來
  // 的，UI 直接寫會讓狀態與產生它的事件序列對不上（ADR-2 / NFR-69.4）。sampler 內部會把這個 wall
  // 戳記映射成剛剛凍結的 active ms。
  inputSampler.suspend(performance.now());
  resumeCountdownEndsAtWallMs = null;
}

/** Resume 按鈕：同步送出取鎖請求，成功與否交給 `pointerlockchange`／`pointerlockerror` 收斂。 */
function requestResume(): void {
  if (runAttempt.phase !== 'paused') return;
  runAttempt.beginResume();
  pauseErrorView = undefined;
  // `request()` 本身在 user gesture stack 內同步發出；只有**結果**是非同步的（FM-4）。
  void pointerLock.request().catch((error: unknown) => {
    failResume(`重新取得滑鼠鎖定失敗，請再按一次「繼續」：${error instanceof Error ? error.message : String(error)}`);
  });
}

/** 取鎖失敗：留在 paused 並顯示可重試訊息（FR-69.5）。非 `locking` 相位一律忽略。 */
function failResume(message: string): void {
  if (runAttempt.phase !== 'locking') return;
  pauseErrorView = { kind: 'paused', error: message };
  beginPause();
}

/** 取鎖成功：**只**進恢復倒數，不解凍。倒數完成前 input/camera/量測時鐘全部維持凍結（FR-69.5）。 */
function confirmResumeLock(): void {
  if (runAttempt.phase !== 'locking') return;
  const nowWall = performance.now();
  runAttempt.confirmLock(nowWall);
  resumeCountdownEndsAtWallMs = nowWall + resolveResumeCountdownMs();
}

/**
 * 每 rAF 一次，且必須在 `timeMapper.mapWallTime(now)` **之前**呼叫：倒數在本幀完成時要先解凍，
 * 這一幀才拿得到正確的 active time（否則 resume 會晚一幀生效）。
 */
function updatePauseRuntime(nowWall: number): void {
  if (
    runAttempt.phase === 'resume-countdown' &&
    resumeCountdownEndsAtWallMs !== null &&
    nowWall >= resumeCountdownEndsAtWallMs
  ) {
    // 解凍點：`timeMapper.resume()` 回傳的 active ms 與 `pause()` 當初回傳的是**同一個 double**,
    // 直接交給 `finishResumeCountdown()` 關 fence,呼叫端不得自行重算（D-69-T2-1）。
    runAttempt.finishResumeCountdown(timeMapper.resume(nowWall));
    resumeCountdownEndsAtWallMs = null;
  }
  pauseOverlay.update(pauseOverlayView(nowWall));
}

function pauseOverlayView(nowWall: number): PauseOverlayView {
  // 作廢優先於相位：這一場已經沒有任何可恢復的東西，顯示「繼續」只會請人去點一顆假的出口。
  if (discardedNoticeView !== undefined) return discardedNoticeView;
  switch (runAttempt.phase) {
    case 'active':
      return PAUSE_VIEW_HIDDEN;
    case 'paused':
      return pauseErrorView ?? PAUSE_VIEW_PAUSED;
    case 'locking':
      return PAUSE_VIEW_LOCKING;
    default:
      pauseCountdownView.remainingMs = (resumeCountdownEndsAtWallMs ?? nowWall) - nowWall;
      return pauseCountdownView;
  }
}
// ─── WP-69 / T3 pause runtime 結束 ────────────────────────────────────────────────────────────

// WP-3 / T1+T3（FR-3.1/3.3）— 輸入採集：keydown/keyup（A/D/W/S）與開火 mousedown（左鍵）蓋
// event.timeStamp 寫入 sharedState.input，供 sim（T4）依時序消費。事件驅動（非固定迴圈，ADR-2）；
// 掛在 window（鍵盤事件不落在 canvas；lock 中滑鼠事件亦冒泡至 window）。開火以 pointerLock.locked
// 為採計閘門——否則「點擊 canvas 取鎖」與 UI 點擊會被誤判為開火（T3）。與 CameraController（視角走
// pointerLock.onMove）互不干擾——此處只入緩衝供量測（WP-3 目的）。
const inputSampler = createInputSampler(sharedState, () => pointerLock.locked, {
  // WP-69 / T3：pause / locking / resume 倒數期間不採計任何 gameplay down/move（NFR-69.4），
  // 且**每一個**戳記都經 mapper 映射到 active measurement time（未 pause 時為逐位 identity）。
  isGameplayInputEnabled,
  mapEventTime: (wallMs) => timeMapper.mapWallTime(wallMs),
});
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
// WP-65 / T2（FR-65.4，D-65-2）— `requireArm: true` **只**在 app 傳；全部測試與 fpsTestHarness
// 一律省略第三參數（FM-1）。本檔共三個 `activeDrillRunner` 建構點（此處 + activateDrill +
// loadSceneById），三處都必須傳，漏一處就會出現「換 drill／換場景後不需點擊」的情境性不一致。
let activeTargetManager = createTargetManager(activeDrillConfig);
let activeDrillRunner = createDrillRunner(sharedState, activeTargetManager, { requireArm: true });
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
    // WP-65 / T2（FR-65.4，D-65-1）— 待命閘的**單一入口**。restartActiveDrill / loadWeaponById /
    // loadSceneById / activateDrill 四條路徑（Session Plan 的每個 block 走 activateDrill）全部收斂
    // 到這一個 start()，故在這裡釋鎖 = 四條路徑行為一致，不需在各呼叫端各寫一次。
    // 釋鎖的理由：連續 session 中受試者可能**仍持鎖**，若不先釋放，`armRequested` 就沒有新的取鎖
    // 事件可翻 ⇒ 下一場會永遠停在待命。顯式清 armRequested 而不只依賴 resetState()，是為了讓
    // 「每場都要一次新手勢」這條語意在本檔可讀，而不必回頭追 DrillRunner 內部。
    // **順序關鍵**（FM-3）：此刻 activeDrillRunner.phase 必為 'idle'（四條路徑都先 restart()，
    // 初次則是建構後未 start），尚未被設為 'armed'，更不是 'countdown'/'running' ⇒ 本處主動釋鎖
    // 觸發的 pointerlockchange 恆不滿足 T5 掉鎖偵測的 phase 條件，不會誤標效度旗標。
    sharedState.armRequested = false;
    if (document.pointerLockElement !== null) document.exitPointerLock();
    // WP-66 / T3（FR-66.9，FM-3）— 命中回饋接線的**單一來源**，理由與上面的釋鎖完全相同：
    // 初始載入 / restartActiveDrill / loadWeaponById / activateDrill / loadSceneById 五條路徑
    // 全部收斂到這一個 start()，在此接線 = 五條路徑一致，不需在各呼叫端各寫一次比較式。
    // `installSceneLoad()` 重建 `targetView` 亦被涵蓋：它的兩個呼叫端（activateDrill /
    // loadSceneById）都在重建後、同一個同步區塊內走到這裡，中間不可能夾一個 render frame。
    // **順序關鍵**（WP-66 T2 Decision T2-b）：必須在 `activeDrillRunner.start(config)` **之前**——
    // `setHitFeedback()` 會把高水位設回「尚未對齊」，下一幀只對齊、不補亮 backlog；目標 id 每場
    // 自 `t0` 重編，補亮等於讓上一場的命中點亮這一場的同名目標（FM-2）。
    targetView.setHitFeedback(resolveHitFeedback(config));
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
  // WP-65 / T1：純轉發。此 façade 以 `DrillRunner` 型別宣告，故介面新增必填成員時必須同步補
  // 一個 getter。`requireArm` 不在此處傳——它屬於被轉發的 `activeDrillRunner` 建構期（見上）。
  get countdownRemainingMs() {
    return activeDrillRunner.countdownRemainingMs;
  },
};
drillRunner.start(activeDrillConfig);

// WP-60 / T2（FR-60.6，OQ-60.3）— Pointer Lock 轉態入匯出。
// 為什麼必須記：未取鎖的 pointermove **整筆丟棄**（KI-005 / A，FR-A-8），所以 lock 中斷會在原始
// 取樣裡留下一個與「感測器離地」**同形**的事件空洞。不記轉態，離線端就只看得到一個空洞、無從分辨
// 成因 —— 那正是 WP-57 Surprises 6「兩個原因混成一個」的覆轍。
// 與 raw 擷取共用同一個開關：關閉時一個 `pointer_lock` 事件都不記 ⇒ 既有匯出逐位不變（FR-60.2）。
// 只在 drill 實際錄製中（countdown/running）記錄，比照 KI-007 對 `fullscreenchange` 的同一判準；
// 時間戳走 `performance.now()`（與 `event.timeStamp` 同時鐘域，ADR-4），sim 內不新增任何時鐘讀取。
if (recorder.recordMouseSamples) {
  pointerLock.onChange((locked) => {
    if (drillRunner.phase !== 'countdown' && drillRunner.phase !== 'running') return;
    // WP-69 / T3：與 tick／輸入戳記同域（active measurement time）。未 pause 時 mapper 為逐位
    // identity ⇒ 既有匯出不變；少了這層映射，第二次掉鎖會蓋上 wall 戳記而落到 tick 窗之外。
    recorder.recordEvent({ type: 'pointer_lock', locked, t: timeMapper.mapWallTime(performance.now()) });
  });
}

// SimLoop 建構時取的時間基準（`lastMs`/`simTimeMs`）必須與 `pump()` 餵入的同一個域,否則重建 loop
// 時會拿 wall 當基準卻被餵 active ms。故注入 mapped clock,而非 `realClock`。
const activeClock: Clock = { now: () => timeMapper.mapWallTime(realClock.now()) };

// WP-13 / T2 — spread/recoil RNG seed 佈線（OQ-13.1）：seed 取自 `drill.sequence.seed`（省略即
// createSimLoop 內後援 DEFAULT_RNG_SEED）。restart / 換 drill 走**重建 loop** 重置 rng stream 與
// tickIndex（決定性:同 seed 同輸入序列位元一致）。seed 值交 WP-16 記入匯出 meta（研究可重現）。
function buildSimLoop(): SimLoop {
  return createSimLoop(
    sharedState,
    activeClock,
    SIM_HZ,
    targetManager,
    sceneManager.camera,
    drillRunner,
    recorder,
    activeWeaponConfig(),
    activeDrillConfig.spiderShot?.seed ?? activeDrillConfig.sequence.seed,
    {
      translation: activeDrillConfig.playerControl?.translation ?? 'enabled',
      afterTick(state): void {
        if (isOutsideCorridor(state.player.x, activeSceneConfig.playerCorridor.halfWidthU, SIM_TO_WORLD)) {
          state.validity.playerCorridorExceeded = true;
        }
      },
      hitscanOcclusion: { propBounds: activeSceneConfig.propBounds },
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
  // WP-60 / T2：additive 唯讀 `drillPhase()`——`pointer_lock` 事件只在 countdown/running 記錄，
  // e2e 若不能讀到相位，就只能靠「載入後應該還在 countdown」的時間假設，那是 flake 的來源。
  (window as unknown as { __aimDebug?: unknown }).__aimDebug = {
    state: sharedState,
    pointerLock,
    recorder,
    drillPhase: (): DrillRunner['phase'] => drillRunner.phase,
  };
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
    availableDrills: availableDrills.map(({ id, source, resolveSource, sceneId, loadOptions }) => ({
      id,
      source,
      // WP-57 / T6: passed through as a thunk, not invoked here — the harness must treat its own
      // `startDrill()` as the arm (reading the display state then), or the E2E resize-invariance
      // gate would compare two runs armed at bootstrap and prove nothing.
      ...(resolveSource !== undefined ? { resolveSource } : {}),
      ...(sceneId !== undefined ? { scene: findSceneOption(sceneId).config } : {}),
      ...(loadOptions !== undefined ? { loadOptions } : {}),
    })),
    availableScenes: availableScenes.map(({ config }) => config),
    backend,
    crossOriginIsolated: isolation.crossOriginIsolated,
    displayHz,
    sensitivity: settingsPanel.sensitivity,
  });
  function applyHistoryOverrides(
    base: ExportPayload,
    overrides?: { readonly participantId?: string; readonly assessment?: boolean },
  ): ExportPayload {
    if (overrides === undefined) return base;
    return {
      ...base,
      meta: {
        ...base.meta,
        ...(overrides.participantId !== undefined ? { session: { participantId: overrides.participantId } } : {}),
        ...(overrides.assessment === true
          ? { assessment: { protocolVersion: STAGE6_PROTOCOL_VERSION, assessmentFeedbackPolicy: 'minimal-end-of-block' as const } }
          : {}),
      },
    };
  }

  (window as unknown as { __fpsTest?: unknown }).__fpsTest = {
    ...fpsTestHarness,
    showResult(): void {
      const payload = fpsTestHarness.forceExportJSON();
      lastResultPayload = payload;
      resultScreen.show(buildResultPresentation(payload));
    },
    // WP-48 T5 — E2E-only hook: drives the *same* `historyPersistence` instance the live
    // completion seam uses (README §2.4), against the harness's own synthetic payload (the harness
    // runs an isolated pipeline, not the live singleton — see fpsTestHarness.ts header). Overrides
    // let tests without a live pointer-lock drill (out of automated scope, full-drill.spec.ts
    // header) still exercise the Assessment/Practice/missing-participant archive policy end to end
    // against the real HistoryClient → Node API → temp root path.
    saveToHistory(overrides?: { readonly participantId?: string; readonly assessment?: boolean }): Promise<HistorySaveState> {
      const payload = applyHistoryOverrides(fpsTestHarness.forceExportJSON(), overrides);
      return historyPersistence.save(payload);
    },
    // WP-49 T5 — E2E-only hook mirroring the live completion handler's
    // `showResultAndTrackHistory()` (same function, not a re-implementation) so a Playwright test
    // can exercise FR-49.12's "查看此 Drill 歷史" entry (visible only after a real Assessment save,
    // absent for Practice) without driving genuine pointer-lock gameplay to a drill's natural end.
    showResultAndSaveToHistory(overrides?: {
      readonly participantId?: string;
      readonly assessment?: boolean;
    }): Promise<HistorySaveState> {
      const payload = applyHistoryOverrides(fpsTestHarness.forceExportJSON(), overrides);
      return showResultAndTrackHistory(payload);
    },
    // WP-58 T6 — E2E-only seam. Enters a live Session Plan without *enforcing* the eligibility
    // gate, then hands over to the real `startSessionPlan()`. Automation cannot pass that gate
    // (PERF_FLOOR_MS is a 120 Hz floor while headless rAF is ~17 ms, and `screen` is 1280x720), so
    // without this seam the whole scheduler runtime — compile -> cursor -> per-rep export -> rest
    // overlay -> done -> exit — would have no real-browser coverage at all. The gate is still run
    // and its genuine (failing) report is what `experimentSession.enter()` records: this fabricates
    // no eligibility pass, it only skips the refusal. Everything downstream is the production path.
    async startSessionPlanWithoutGate(participantId: string, selection: SessionPlanSelection): Promise<void> {
      const report = runEligibilityGate(SESSION_PLAN_MIN_CONDITION, await probeWarmupP95Ms());
      experimentSession.enter(report);
      sessionSetupValues = { participantId };
      pendingSessionPlanSelection = selection;
      await startSessionPlan();
    },
    // WP-69 / T6 — the protocol counterpart of the Session Plan seam above. It still measures and
    // records the genuine eligibility failure; only the automated environment's refusal is skipped
    // so Playwright can exercise the live ProtocolRunner → attempt gate → retry lifecycle.
    async startProtocolWithoutGate(participantId: string, protocol: 'resolution' | 'br'): Promise<void> {
      const report = runEligibilityGate(resolutionDetectionProtocol.requiredDisplay, await probeWarmupP95Ms());
      experimentSession.enter(report);
      sessionSetupValues = { participantId };
      await startProtocol(protocol === 'br' ? brTrackingProtocolRunner : resolutionProtocolRunner);
    },
    /** WP-69 / T6 — read-only live state used to assert the production wiring in Edge. */
    wp69State() {
      const snapshot = recorder.snapshot();
      const pilot = trackingPilotSession?.runner;
      return {
        drill: {
          drillId: activeDrillConfig.drillId,
          sceneId: activeSceneConfig.sceneId,
          weaponId: activeDrillConfig.weaponId ?? 'ak47',
          seed: activeDrillConfig.spiderShot?.seed ?? activeDrillConfig.sequence.seed ?? DEFAULT_RNG_SEED,
        },
        attempt: {
          number: runAttempt.attempt,
          phase: runAttempt.phase,
          validity: runAttempt.validity,
          pauseOccurred: runAttempt.pauseOccurred,
          fenceCount: runAttempt.pauseFences.length,
          lockConfirmationCount: runAttempt.lockConfirmations.length,
        },
        time: {
          mapperPaused: timeMapper.paused,
          excludedWallMs: timeMapper.excludedWallMs,
          hudElapsedMs,
        },
        recording: {
          tickCount: recorder.tickCount,
          eventCount: snapshot.events.length,
          fireCount: recorder.fireCount,
          hitCount: recorder.hitCount,
          recorderOverflow: snapshot.recorderOverflow,
          bufferOverflow: sharedState.inputMeta.bufferOverflow,
          inputSize: sharedState.input.size(),
          ammo: sharedState.weapon.ammo,
        },
        aim: { ...sharedState.aim },
        held: { ...sharedState.held, fire: sharedState.heldFire, ads: sharedState.heldAds },
        finalizedDisposition: finalizedPlan?.disposition,
        resultShown,
        session: sessionPlanRunner.phase,
        protocol: {
          protocolId: activeProtocolRunner.config.protocolId,
          current: activeProtocolRunner.current,
          exportCount: activeProtocolRunner.exports.length,
        },
        pilot:
          pilot === undefined
            ? undefined
            : {
                phase: pilot.phase,
                recordCount: pilot.records.length,
                invalidAttemptCount: pilot.invalidAttempts.length,
                invalidAttempts: pilot.invalidAttempts,
              },
      };
    },
    /** WP-58 T6 — read-only view of the live session cursor, for E2E to follow a running program. */
    sessionPlanState(): {
      readonly phase: SessionRunnerPhase['kind'];
      readonly drillId?: string;
      readonly itemIndex?: number;
      readonly repIndex?: number;
      readonly boundary?: ProgramBoundary;
      readonly nextDrillId?: string;
      readonly experimentActive: boolean;
    } {
      const phase = sessionPlanRunner.phase;
      const experimentActive = experimentSession.active;
      if (phase.kind === 'run') {
        return {
          phase: phase.kind,
          drillId: phase.step.drillId,
          itemIndex: phase.step.itemIndex,
          repIndex: phase.step.repIndex,
          experimentActive,
        };
      }
      if (phase.kind === 'rest') {
        return {
          phase: phase.kind,
          boundary: phase.step.boundary,
          nextDrillId: phase.step.nextDrillId,
          experimentActive,
        };
      }
      return { phase: phase.kind, experimentActive };
    },
    historySaveState(): HistorySaveState {
      return historyPersistence.state;
    },
    retryHistorySave(): Promise<HistorySaveState> {
      return historyPersistence.retry();
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
  // WP-69 / T4（FR-69.12）— 離開/切換 drill/scene/weapon 或按 Restart 時,**若還有一場暫停中的
  // attempt 沒有結算過**,先過同一個 gate。這一行是「navigation 不可繞過 gate」的全部機制:四條
  // full-restart 路徑的共同點就在這裡,下面 `runAttempt.restart()` 一跑,fence 與 validity 就沒了。
  //
  // OQ-69.4 的結論落在這裡:依 T0.5 凍結的判準,暫停中結算 ⇒ `pause-fence-unclosed` ⇒ `discarded`,
  // T4 **不**在導航前強迫 resume,也不放寬判準。理由是那一場根本沒有跑到 `ended`——它是被放棄的,
  // 不是被完成的,而「沒跑完」與「時間軸可證」是兩件事,後者成立不代表前者該被留成紀錄。
  // 代價明帳:暫停中直接換 drill 會連稽核檔都沒有。想留稽核檔的操作員必須先「繼續」把這一場跑完。
  if (runAttempt.pauseOccurred && finalizedPlan === undefined) {
    const plan = finalizeAttempt();
    // A paused attempt abandoned through Restart / drill / scene / weapon navigation never reaches
    // `liveFrame()`'s ended branch. Record the same orchestrator hold here before the attempt state
    // is erased; the memo guard prevents an invalid run that already ended from being audited twice.
    if (!plan.advancesOrchestrator) holdOrchestratorsOnAttempt(plan);
  }
  // 結算結果只活到這一行為止（新 attempt 要重新判一次）。作廢告知同理:Restart 就是它的出口。
  finalizedPlan = undefined;
  discardedNoticeView = undefined;
  // WP-69 / T2（FR-69.6）：full restart 的四條路徑（restart / 換武器 / 換 drill / 換場景）都經過
  // 這裡,且都在下游重建 SimLoop —— 把 mapper 歸零放在這一個共同點,新 attempt 的 active time 回到
  // identity,重建的 loop 才會錨在同一個域（`activeClock`）。順序是硬的:**先歸零、後 buildSimLoop()**。
  timeMapper.restart(performance.now());
  // WP-69 / T3（FR-69.6）— attempt validity / fence / attempt number 與 mapper 在**同一個**點歸零。
  // 這是四條 full-restart 路徑（restart / 換武器 / 換 drill / 換場景）的共同點，也是 sticky
  // `invalid-paused` 唯一的出口：`restart()` 之外沒有任何 mutator 能把 validity 走回來（FR-69.2）。
  runAttempt.restart();
  resumeCountdownEndsAtWallMs = null;
  pauseErrorView = undefined;
  recorder.reset();
  frameLog.reset();
  resultScreen.hide();
  historySaveStatus.render({ kind: 'idle' });
  resultShown = false;
  hudRunStartMs = null;
  hudElapsedMs = 0;
  stopFlashUntil = 0;
  prevVx = 0;
  recorderStartedAt = new Date().toISOString();
}

// WP-65 / T2（FR-65.2/65.4，D-65-1/D-65-5）— 取鎖 = 解除待命。新增一個訂閱者而非改寫既有三個
// （updateLockHint / 清 held 狀態 / syncControlsVisibility），既有行為零變更。
//
// `phase === 'armed'` 這個條件是本函式的全部語意重點：drill **進行中**掉鎖後重新取鎖不會落進來，
// 那一場的 arena 因此完整保留（只由 T5 標記效度），不會被中途清掉。
//
// 為什麼 `recorder.reset()`（D-65-5 / FM-2）：`simStep()` 末端的 `recordTickFromState()` 不看相位，
// 待命期每個 tick 照樣吃一格 arena（容量 41 528 ⇒ 約 324 s 填滿，T0 §4 實測翻轉點逐位相符）。
// 不在這裡丟棄，受試者在待命畫面停留超過約 5 分半，該場匯出就會被 recorderOverflow → suspect 標紅。
// 刻意**不**併進 `resetRunPresentation()`：後者在 `start()` **之前**跑，那時待命期的 tick 根本還沒
// 產生，併過去等於在錯的時點清一次、待命期照樣重新堆積。兩者時機不同，重複是表面的。
function armOnPointerLock(locked: boolean): void {
  if (!locked || drillRunner.phase !== 'armed') return;
  recorder.reset();
  hudRunStartMs = null; // 待命期的 rAF 基準一併歸零（Time 卡的相位分支屬 T4）
  sharedState.armRequested = true; // input → SharedState → sim 唯讀（ADR-2）
}
pointerLock.onChange(armOnPointerLock);

// WP-65 / T5（FR-65.9/65.12，D-65-4／FM-3）— 錄製中掉鎖 = 條件失效，標記但**不中斷**。
//
// 刻意是**第三個**訂閱者，不與 `armOnPointerLock` 合併：兩者條件互斥（`armed` vs `countdown`/
// `running`）、方向相反（取鎖 vs 掉鎖）、構念不同（開始手勢 vs 效度）。合併只會把兩件事糾纏在
// 一個分支裡。
//
// 判準與 `main.ts` 的 `fullscreenchange` recording 判準**逐字相同**（KI-007 已論證過這個窗界：
// `idle`/`ended` 的退出屬正常操作），不另立第二套定義（C-D4）。三個相位被刻意排除：
//   - `'armed'`：`drillRunner.start()` 之前的主動 `exitPointerLock()` 落在這裡 ⇒ 恆不誤標（FM-3）。
//   - `'ended'`：Result 顯示前 `liveFrame` 自己會 `exitPointerLock()`，那是收工不是失效。
//   - `'idle'`：drill 之間，本就沒有錄製中。
//
// **不**以 `experimentSession.active` 為前提（README §0.3 缺口 G1）：那個閘只在 eligibility gate
// 通過的實驗 session 內武裝，選手測試／研究員模式的一般 drill 會完全不被標記。掉鎖與有沒有跑正式
// 流程無關——`onMouseMove` 在 `!locked` 時直接 return，位移沒進輸入鏈這件事在哪個模式都一樣。
pointerLock.onChange((locked) => {
  if (locked) return;
  const phase = drillRunner.phase;
  if (phase !== 'countdown' && phase !== 'running') return;
  sharedState.validity.pointerLockLostDuringRun = true; // input → SharedState → data 唯讀（ADR-2）
});

// WP-69 / T3（FR-69.1/69.2/69.3，OQ-69.2）— 錄製中掉鎖 = 進入 pause 並**永久**失去實驗效力。
//
// 刻意是**第四個**訂閱者，且不與上面那個合併：`pointerLockLost` 與 `pauseOccurred` 是兩個構念
// （FR-69.11）——前者記「輸入鎖遺失」這個事實，後者控制「這場能不能被實驗採納」。錄製中掉鎖會讓兩者
// 同時為真，但它們的判準未來可能分岔，合併會讓那一天無法拆開。
//
// 相位判準與上面那條**逐字相同**（`countdown`/`running`），不新增第二套定義（C-D4／OQ-69.2）：
// `armed` 的開場釋鎖脈衝、`ended` 的收工釋鎖、`idle` 的 drill 之間都不算失效（FR-69.3）。
// 取鎖方向則相反：只有我們自己要求的那一次（`locking` 相位）才算 resume，其餘取鎖不是。
pointerLock.onChange((locked) => {
  if (locked) {
    confirmResumeLock();
    return;
  }
  const phase = drillRunner.phase;
  if (phase !== 'countdown' && phase !== 'running') return;
  beginPause();
});
// 取鎖失敗的第二條收斂路徑（FM-4）：`pointerlockerror` 不會翻 `locked`（本來就是 false），
// 因此**不會**經過上面的 onChange —— 少了這條，一次失敗的 resume 會讓面板永遠停在「正在取鎖…」。
pointerLock.onError(() => {
  failResume('重新取得滑鼠鎖定失敗，請再按一次「繼續」。');
});
// 補一次當下狀態：本檔後段有 dev-only top-level await（`measureDisplayHz`），受試者在那個視窗內
// 點擊取得的鎖會早於本訂閱者掛上 ⇒ 沒有這行，該場會永遠停在待命。訂閱者本身不能更早掛，
// 因為 `hudRunStartMs` 的宣告就在上方不遠處，更早掛會在同一視窗內撞 TDZ ReferenceError。
armOnPointerLock(pointerLock.locked);

function restartActiveDrill(): void {
  drillRunner.restart(); // WP-6 restart path: full state + TargetManager + runner reset.
  resetRunPresentation();
  simLoop = buildSimLoop(); // WP-13 / T2：重建 loop 重置 recoil rng stream + tickIndex（決定性）。
  drillRunner.start(activeDrillConfig);
  syncControlsVisibility();
}

function loadWeaponById(weaponId: WeaponId): void {
  activeWeaponOverride = weaponId;
  drillRunner.restart();
  resetRunPresentation();
  simLoop = buildSimLoop(); // WP-47 / T2：重建 loop 重置 recoil rng stream + tickIndex（決定性,同 restartActiveDrill/loadDrillById）。
  cameraController.setAdsConfig(activeWeaponConfig().ads);
  recorder.configureMouseIntegration({ gain: currentMouseGain() });
  drillRunner.start(activeDrillConfig);
  controls?.setSelectedWeapon(weaponId);
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
  // WP-66 / T3（FM-3）：重建的 view 其 `#hitFeedback` 回到預設 false，但此處**刻意不**接線——
  // 本函式的兩個呼叫端（activateDrill / loadSceneById）都在同一個同步區塊內接著走到
  // `drillRunner.start()`，由那個單一來源設值（中間不可能夾一個 render frame）。在此再寫一次
  // 只會製造第二個比較式，且此刻 `activeDrillConfig` 仍是**舊** drill（activateDrill 要到下一行
  // 才換）⇒ 寫在這裡反而讀起來是錯的。新增第三個呼叫端時，維持「呼叫端負責 start()」這條不變式。
  targetView = new TargetView(sceneManager.scene);
  impactView = new ImpactView(sceneManager.scene);
  tracerView = new TracerView(sceneManager.scene);
  cameraController.setCamera(sceneManager.camera);
  cameraController.setFov(settingsPanel.fov);
  syncCameraBase();
  activeSceneConfig = option.config;
  activeSceneFallback = nextScene.fallback;
  controls?.setSelectedScene(activeSceneConfig.sceneId);
}

/**
 * Shared drill-activation path. Two callers, one behaviour: `loadDrillById()` resolves a
 * registered `availableDrills` entry, and `loadDrillConfigDirect()` (WP-54 / T6) hands over an
 * already-resolved `DrillConfig` that no dropdown entry declares — a tracking-pilot block, whose
 * session-1 variants are alternate-seed clones of a registered config (D-54.26).
 * `selectedDrillId` is supplied only for registered ids: the researcher dropdown must never be
 * forced to a value it has no `<option>` for.
 */
async function activateDrill(
  source: unknown,
  sceneId: string | undefined,
  loadOptions: DrillLoadOptions | undefined,
  selectedDrillId: string | undefined,
  weaponId: WeaponId | undefined,
): Promise<void> {
  // Every activation owns a generation, including same-scene/no-load activations: a preceding GLTF
  // request resolving late must never overwrite the drill/scene transaction selected most recently.
  const sceneRequest = liveSceneLoads.begin();
  // WP-47 / T2：reset-per-drill，避免 BR 專屬武器條件被手動選擇靜默覆蓋。
  // WP-62 / T3：改為套用本步指定武器（Session Plan 逐列）；其餘呼叫端傳 `undefined` ⇒ 與 WP-47/T2
  // 的無條件清空逐位等同。位置不動——必須早於下方 buildSimLoop()／setAdsConfig()／
  // configureMouseIntegration()，否則彈匣、recoil rng stream、ADS 光學與感度 gain 會取到不同世代的武器。
  activeWeaponOverride = weaponId;
  const requiredScene = sceneId !== undefined ? findSceneOption(sceneId) : undefined;
  const targetSceneConfig = requiredScene?.config ?? activeSceneConfig;
  const nextConfig = loadDrill(source, targetSceneConfig, loadOptions);
  const needsSceneLoad =
    requiredScene !== undefined &&
    (requiredScene.config.sceneId !== activeSceneConfig.sceneId || activeSceneFallback);
  const nextScene = needsSceneLoad ? await sceneRequest.load(requiredScene.config) : undefined;
  if (!sceneRequest.isCurrent() || nextScene === null) return;
  if (nextScene !== undefined && requiredScene !== undefined) installSceneLoad(requiredScene, nextScene);

  drillRunner.restart();
  activeDrillConfig = nextConfig;
  activeDrillSource = source;
  activeDrillLoadOptions = loadOptions ?? {};
  activeTargetManager = createTargetManager(nextConfig);
  activeDrillRunner = createDrillRunner(sharedState, activeTargetManager, { requireArm: true });
  resetRunPresentation();
  simLoop = buildSimLoop(); // WP-13 / T2：新 drill 的 seed 生效 + 重置 rng stream（決定性）。
  cameraController.setAdsConfig(activeWeaponConfig().ads); // WP-24 / T2：新 drill 武器的 ADS 光學。
  recorder.configureMouseIntegration({ gain: currentMouseGain() }); // KI-005 / A：新 drill 武器的感度 gain（同一批動作）。
  targetView.setShape(resolveTargetHitbox(activeDrillConfig).shape); // WP-46 / T3：新 drill 的 hitbox shape 生效。
  drillRunner.start(activeDrillConfig);
  if (selectedDrillId !== undefined) controls?.setSelectedDrill(selectedDrillId);
  controls?.setSelectedWeapon(activeWeaponConfig().id); // WP-62 / T3：顯示**實際生效**武器（含 Session Plan 指定值），而非只讀 drill 自宣告。
  syncControlsVisibility();
}

async function loadDrillById(drillId: string, weaponId?: WeaponId): Promise<void> {
  const option = resolveAvailableDrill(availableDrills, drillId);
  // WP-62 / T3：`weaponId` 只有 Session Plan 的 run step 會給；Controls 下拉與 protocol 條件都
  // 省略它 ⇒ 沿用 reset-per-drill。
  await activateDrill(drillSourceFor(option), option.sceneId, option.loadOptions, option.id, weaponId);
}

/** WP-54 / T6 — loads a resolved tracking-pilot `DrillConfig` object. Pinned to `field-low` for
 * the same reason every scene-bound `availableDrills` entry pins one: the pilot blocks' clearance
 * envelope is validated against `field-low` (`tracking_core_pr_pilot_v1.test.ts`), so inheriting
 * whichever scene the researcher happened to leave loaded could reject a valid pilot block. */
async function loadDrillConfigDirect(config: DrillConfig): Promise<void> {
  await activateDrill(config, fieldLow.sceneId, undefined, undefined, undefined);
}

async function loadSceneById(sceneId: string): Promise<void> {
  const sceneRequest = liveSceneLoads.begin();
  const option = findSceneOption(sceneId);
  if (option.config.sceneId === activeSceneConfig.sceneId && !activeSceneFallback) return;

  activeWeaponOverride = undefined; // WP-47 / T2：reset-per-drill，換 scene 亦重建 activeDrillConfig，武器 override 語意應與換 drill 一致。
  const nextDrillConfig = loadDrill(activeDrillSource, option.config, activeDrillLoadOptions);
  const nextScene = await sceneRequest.load(option.config);
  if (nextScene === null) return;

  installSceneLoad(option, nextScene);

  drillRunner.restart();
  activeDrillConfig = nextDrillConfig;
  activeTargetManager = createTargetManager(activeDrillConfig);
  activeDrillRunner = createDrillRunner(sharedState, activeTargetManager, { requireArm: true });
  resetRunPresentation();
  simLoop = buildSimLoop();
  targetView.setShape(resolveTargetHitbox(activeDrillConfig).shape); // WP-46 / T3：場景切換後沿用同一 drill 的 hitbox shape。
  drillRunner.start(activeDrillConfig);
  controls?.setSelectedWeapon(activeDrillConfig.weaponId ?? 'ak47'); // WP-47 / T2：reset-per-drill，下拉選單顯示值回到該 drill 自帶武器。
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
controls = createControls({
  // WP-64 (OQ-64.2): the dropdown is a *projection* of the runtime registry, not the registry
  // itself — `resolveAvailableDrill()` still searches every entry, hidden ones included.
  drills: researcherControlsDrills(availableDrills),
  scenes: availableScenes.map(({ id, label }) => ({ id, label })),
  weapons: Object.keys(WEAPONS).map((id) => ({ id, label: id })),
  selectedDrillId: activeDrillConfig.drillId,
  selectedSceneId: activeSceneConfig.sceneId,
  selectedWeaponId: activeDrillConfig.weaponId ?? 'ak47',
  onRestart: restartActiveDrill,
  onLoadDrill: loadDrillById,
  onLoadScene: loadSceneById,
  onLoadWeapon: (weaponId) => loadWeaponById(weaponId as WeaponId),
  initialTracerEnabled: tracerEnabled,
  onTracerEnabledChange: (enabled) => {
    tracerEnabled = enabled;
    tracerView.clear(sharedState.shotRays.total);
  },
});

// KI-035 / BD-039 (b)（WP-63 T2）— 錄製中（`countdown`/`running`）停用感度與 FOV 滑桿,使一次 run
// 內只有一組 mouse gain。判準沿用 KI-007 對 `fullscreenchange` 的同一條（`countdown`/`running` =
// 實際錄製中）,不另立第二個「run 進行中」定義。
//
// 為什麼這裡就夠:面板在 Pointer Lock 鎖定中整組隱藏,唯一能在錄製中碰到滑桿的路徑是「run 到一半
// 掉鎖」——而 `syncControlsVisibility` 本來就掛在 `pointerLock.onChange` 上,且 drill 的每一個
// start/restart/換武器/換 drill/轉 `ended` 都已經呼叫它。
function syncAimSettingsLock(): void {
  const phase = drillRunner.phase;
  settingsPanel.lockAim(phase === 'countdown' || phase === 'running');
}

function syncControlsVisibility(): void {
  // 放在下面的 early return **之前**：面板要不要鎖與 researcher controls 有沒有建好無關。
  // KI-013 的 TDZ 顧慮在這一行不適用：`settingsPanel`(:519) 與 `drillRunner`(:1114) 之間沒有任何
  // top-level await，模組評估到 `drillRunner` 為止都是同步的 ⇒ 任何 handler 能跑到本函式時，兩者
  // 必定已初始化。⚠️ 若日後有人在這兩個宣告之間插入 top-level await，本行就會變成 KI-013 的重演，
  // 屆時要把它移到 early return 之後（那個窗內相位不可能是 countdown/running，移動不損語意）。
  syncAimSettingsLock();
  // KI-013：controls 尚未建好時（top-level await 期間的早期點擊）無事可同步，安全略過——
  // controls 建好當下會立即呼叫本函式一次，補上當時的 appMode/pointerLock 狀態。
  if (controls === undefined) return;
  controls.setVisible(
    shouldShowResearcherControls(appMode, !pointerLock.locked || drillRunner.phase === 'ended'),
  );
}

pointerLock.onChange(syncControlsVisibility);
syncControlsVisibility();

const protocolStatus = document.createElement('div');
protocolStatus.id = 'protocol-status';
protocolStatus.style.cssText = [
  'position:fixed',
  // WP-66 follow-up: this banner has to clear two neighbours at once. Top-center is
  // `#metrics-hud` (top:12px, ~90px tall) and top-left is `#top-left-controls` (top:16px,
  // 250px wide) — the launcher column is shown whenever the pointer is unlocked, which is
  // exactly when this line reads "Session Plan 完成". So sit centered *below* the HUD row,
  // and reserve 280px on each side so neither end can reach the launcher column (or the
  // export buttons) on a narrow viewport.
  'top:104px',
  'left:50%',
  'transform:translateX(-50%)',
  'display:none',
  'align-items:center',
  'gap:10px',
  'max-width:min(720px,calc(100vw - 560px))',
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
    // WP-58 T4 (OQ-58.3): both values come off the compiled RestStep, so the overlay says exactly
    // what the pre-flight preview table promised for this seam.
    if (nextPhase.kind === 'rest') {
      restOverlay.show(nextPhase.remainingMs, {
        boundary: nextPhase.step.boundary,
        nextDrillId: nextPhase.step.nextDrillId,
      });
    } else restOverlay.hide();
    // WP-58 T-exit (OQ-58.7): one rule for how a Session Plan ends the experiment session —
    // reaching `done` closes it, whether the cursor ran off the end or `poll()`'s unattended
    // auto-advance aborted on a failed load. Before this, only the completion branch called
    // `exit()`, so an aborted session left `active === true` and every later standalone export
    // kept inheriting that session's `gate`/`suspect`. `exit()` is idempotent and keeps
    // `gate`/`suspect` readable, so the run being exported right now is unaffected — it was
    // collected before `advance()` was awaited.
    if (nextPhase.kind === 'done') experimentSession.exit();
  },
});

/**
 * WP-58 T5 — the export's session-plan audit block for whichever track is running, or `{}` when no
 * Session Plan owns this run (a standalone drill, a protocol condition, a pilot block).
 */
function sessionPlanAuditFields(phase: SessionRunnerPhase): Partial<CollectMetaArgs> {
  if (phase.kind !== 'run' || activeSessionPlanSelection === undefined) return {};
  if (activeSessionPlanSelection.mode === 'frozen') {
    return {
      sessionPlanRestSeconds: activeSessionPlanSelection.restSeconds,
      sessionPlanFamilyOrder: activeSessionPlanSelection.families,
    };
  }
  return {
    sessionPlanMode: 'custom',
    sessionPlanItems: activeSessionPlanSelection.items,
    sessionPlanDrillRestSeconds: activeSessionPlanSelection.drillRestSeconds,
    sessionPlanRestSeconds: activeSessionPlanSelection.familyRestSeconds,
    ...(activeCustomProgramFamilyOrder === undefined
      ? {}
      : { sessionPlanFamilyOrder: activeCustomProgramFamilyOrder }),
    sessionPlanItemIndex: phase.step.itemIndex,
    sessionPlanRepIndex: phase.step.repIndex,
  };
}

async function startSessionPlan(): Promise<void> {
  const selection = pendingSessionPlanSelection;
  const setup = sessionSetupValues;
  pendingSessionPlanSelection = undefined;
  if (selection === undefined || setup === undefined) {
    // Same case as the catch below: `onEnter` has already called `experimentSession.enter()`, so
    // bailing out without `exit()` would strand an active session that never ran a single step.
    experimentSession.exit();
    setProtocolStatus('Session Plan 啟動失敗：缺少受試者或計畫選擇。', false);
    return;
  }
  activeSessionPlanSelection = selection;
  activeCustomProgramFamilyOrder = undefined;
  try {
    if (selection.mode === 'custom') {
      // WP-58 T4 — the custom track reaches the runtime through the same compiler and the same
      // runner (FR-58.10); the only difference from frozen is who produced the item list. The form
      // has already compiled and shown this exact program, so a throw here means the operator's
      // plan changed shape between preview and submit, not that the UI let an invalid one through.
      const program = compileSessionProgram({
        items: selection.items,
        drillRestSeconds: selection.drillRestSeconds,
        familyRestSeconds: selection.familyRestSeconds,
      });
      // WP-58 T5 — collapsed once here, from the same compiled steps the runner will walk, so the
      // audit field cannot drift from the program that actually ran (§2.7).
      activeCustomProgramFamilyOrder = deriveProgramFamilyOrder(program);
      await sessionPlanRunner.start({
        participantId: setup.participantId,
        sessionIndex: 0,
        mode: 'custom',
        items: selection.items,
        program,
      });
      return;
    }
    // WP-58 T3 — the frozen track now compiles to the same `ProgramStep[]` the custom track uses
    // (FR-58.10); the runner is a cursor over it and no longer decides which drill a family means.
    const frozen = buildFrozenSessionPlan({
      participantId: setup.participantId,
      sessionIndex: 0,
      families: selection.families,
      restSeconds: selection.restSeconds,
      includeWarmup: selection.includeWarmup,
    });
    // The "this family has no warmup drill" notice belongs to the compile step now that warmup
    // resolution happens there; the runner stays DOM-free and only reports what it is running.
    if (selection.includeWarmup && frozen.warmupAvailability === 'unavailable') {
      setProtocolStatus('本家族無熱身，直接開始正式測試。', false);
    }
    await sessionPlanRunner.start(frozen.plan);
  } catch (error) {
    activeSessionPlanSelection = undefined;
    activeCustomProgramFamilyOrder = undefined;
    // WP-58 T-exit (OQ-58.7): a start that never reached step 0 never publishes a `done` phase, so
    // the `onPhaseChange` rule above cannot see it — close the session here for the same reason.
    experimentSession.exit();
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

// WP-50 / T3（FR-50.11/NFR-50.5）— live 分支本體不變（逐字保留既有 pump/render/HUD 邏輯），
// 只是把它從 renderLoop 的 callback 字面量抽成具名函式，交給 PresentationCoordinator 當作
// live deps 的 `frame`。coordinator 是 render callback 的唯一分流點：目前恆為 live 模式（T6
// 才會真正呼叫 `enterReplay()`），但往後 replay 分支絕不會落到這段 `simLoop.pump` 之前
// （README §2.7/執行規則：不把 replay 判斷散落到多處）。
function liveFrame(now: number): void {
  sessionPlanRunner.poll(now);
  trackingPilotSession?.poll(now); // WP-54 / T6：pilot 的 rest 倒數，比照 SessionRunner.poll()。
  // WP-69 / T3：恢復倒數與 pause 面板。**必須在下一行的 `mapWallTime()` 之前**——倒數若在本幀完成，
  // 要先解凍 mapper，這一幀才拿得到正確的 active time（否則 resume 晚一幀生效）。倒數本身吃 wall
  // `now`：那正是「暫停了多久」的時鐘，不是量測時間。
  updatePauseRuntime(now);
  // WP-69 / T2：rAF 的 wall `now` → active measurement time。**量測**用途一律用 `activeNow`
  // （sim、recorder 戳記、gameplay HUD 經過時間）；**render-only** 的動畫壽命仍用原始 `now`
  //  （命中回饋、tracer、ADS FOV 內插、急停閂鎖）——暫停時畫面該繼續動,但量測不該前進。
  const activeNow = timeMapper.mapWallTime(now);
  // 1) 推進 sim（固定步長，只用 TICK；決定性根源在 SimLoop），取回 alpha 內插係數。
  // WP-69 / T6 live regression: the discarded branch below clears the recorder, but rAF keeps
  // rendering so the discard overlay remains interactive. Do not let subsequent frames pump the
  // ended simulation and silently repopulate that cleared recorder. Restart clears `finalizedPlan`,
  // so the next attempt resumes the ordinary byte-identical pump path.
  const alpha = finalizedPlan?.disposition.kind === 'discarded' ? 0 : simLoop.pump(activeNow).alpha;
  const phase = drillRunner.phase;
  if (phase === 'running') {
    if (hudRunStartMs === null) hudRunStartMs = activeNow;
    hudElapsedMs = activeNow - hudRunStartMs;
  } else if (phase === 'countdown' || phase === 'idle' || phase === 'armed') {
    // WP-65 / T4（FR-65.8）：`'armed'` 必須一起歸零,否則新相位落到 else 之外、`hudElapsedMs` 保留
    // 上一場殘值 ⇒ 待命期的 Time 卡會顯示上一場的時間（倒數型還會顯示一個已經扣掉的剩餘值）。
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
  //    命中回饋（WP-66 / T3）：`hits` 與 `nowMs` 必須**同時**傳（只傳其一會靜默退回舊行為）；
  //    `now` 為 rAF 時鐘,與相鄰的 `tracerView.sync(..., now)` 同一個值、同一個時鐘域。
  targetView.sync(sharedState.targets, alpha, sharedState.targetHits, now);
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
      // WP-69 / T4（FR-69.7/69.9，FM-7）— gate **先於** snapshot／payload／metrics／result／
      // history／advance。同步呼叫（在第一個 await 之前）是刻意的:上一行的 `exitPointerLock()` 會
      // 在下一個 task 補一筆 `pointer_lock` 事件,那筆戳記晚於最後一個 tick,等到 await 之後才判會
      // 把乾淨的一場判成 `event-out-of-window`。
      const plan = finalizeAttempt();
      // WP-69 / T5（FR-69.10）— 在 `buildsPayload` 分岔**之前**:`discarded` 也必須讓 orchestrator
      // 停在原處並留下痕跡,而那條路徑在下一行就 return 了。仍在第一個 await 之前（T4.4）。
      if (!plan.advancesOrchestrator) holdOrchestratorsOnAttempt(plan);
      if (!plan.buildsPayload) {
        // `discarded`：不建 payload、不算 metrics、不顯示 Result、不下載、不保存、不推進。
        // 現地清掉 arena 與 frame log——不可信的資料不留在記憶體裡等下一個讀取者（FR-69.9）。
        if (plan.clearsRecording) {
          recorder.reset();
          frameLog.reset();
        }
        discardedNoticeView =
          plan.disposition.kind === 'discarded'
            ? { kind: 'discarded', reason: describeDiscardReason(plan.disposition.reason) }
            : undefined;
        return;
      }
      const payload = await buildCurrentExportPayload();
      // WP-48 T5（FR-48.1/48.9,D-48.P1）／WP-49 T5（FR-49.12）— 顯示 Result 並觸發保存；
      // fire-and-forget，不阻擋下面 sessionPlanRunner.advance()／completeActiveProtocolCondition()
      // （D-48.P6，NFR-48.8）。
      void showResultAndTrackHistory(payload, plan);
      // WP-69 / T4（FR-69.8/69.10，FM-6）— `invalid-retained` 到此為止：不自動下載正式檔、不推進
      // 任何 orchestrator，三個 runner 停在同一個 run/condition/block 等待 full restart。三者的
      // 「明確 retry 入口」是 T5；本 task 只保證它們**不會前進**。
      if (!plan.advancesOrchestrator) return;
      // WP-58 / T3：顯式標註型別，讓 phase union 的任何改動在此處編譯期爆掉而非靜默失配
      // （D-58-T0-4：這條鏈以前只做 structural 的 `.kind` 比對）。
      const sessionPhase: SessionRunnerPhase = sessionPlanRunner.phase;
      // WP-54 / T6：pilot block 由 TrackingPilotRunner 擁有這一輪的匯出/品質判定/下一個 block，
      // 不落入 Session Plan 或 protocol 的完成分支。
      if (trackingPilotSession?.handleDrillEnded() === true) {
        // no-op：handleDrillEnded() 已接手（回傳 true 才代表確有 pilot block 正在跑）。
      } else if (sessionPhase.kind === 'run') {
        // WP-58 / T3：warmup 併入 run step，四路 if-else 收斂為三路。熱身照舊**不匯出**——
        // 它是暖身而非量測 block（frozen 路徑逐位不變）；custom program 無 warmup（FR-58.17）。
        if (sessionPhase.step.warmup !== true) downloadJSON(payload, { basename: exportBasename(payload) });
        await sessionPlanRunner.advance();
      } else {
        await completeActiveProtocolCondition();
      }
    })();
  }
  // WP-65 / T4（FR-65.7）：`timeLimit` 型 drill 的 Time 卡倒數,`targetCount` 型（傳 `undefined`）
  // 維持正計時。分類由 `resolveDrillTimeLimitMs()` 單一定義——讀 `endCondition`,不讀後援閘
  // `timing.timeLimitMs`（那會讓 targetCount drill 顯示 120 秒倒數）。
  hud.update(
    createHUDStats(
      sharedState,
      phase,
      hudElapsedMs,
      recorder.hitCount,
      recorder.fireCount,
      recorder.hitCount,
      hudStats,
      resolveDrillTimeLimitMs(activeDrillConfig),
    ),
  );
  // WP-65 / T3：`countdownRemainingMs` 的**唯一**讀取點——sim→render 唯讀只開這一個出口
  // （比照既有 `drillRunner.phase`，見 README §2.4 的明帳）。`phase` 沿用上方既有區域變數。
  drillStartOverlay.update(phase, drillRunner.countdownRemainingMs);
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
}

// WP-50 / T6 — Replay entry-point wiring：current Result／historical Run Detail 共用同一 Replay
// Screen；`presentation`（唯一 mode 互斥分流點，T3）已於檔案前段建構，這裡只負責 canvas/viewport
// ownership 交接與 ReplayController 的注入 deps（D-50-P5：共用 renderer/canvas，不共用 live scene/
// camera/SharedState）。

/** Reparents the shared canvas into the Replay viewport and sizes it — called once, right after
 * `ReplayController` has already switched the screen into its 'ready' layout (so the viewport
 * host's box has real dimensions to measure, not a still-`display:none` ancestor's zero size). */
function mountReplayViewport(): void {
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  replayScreenHandle!.viewportElement.appendChild(canvas);
  resizeReplayViewport();
  window.addEventListener('resize', resizeReplayViewport);
}

function resizeReplayViewport(): void {
  const rect = replayScreenHandle!.viewportElement.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // updateStyle:false — 沿用 `applyResolutionMode` 固定解析度分支的慣例：buffer 尺寸交給
  // `renderer.setSize`，CSS 尺寸留給我們自己的 100%/100%（否則 three.js 預設會把 canvas.style
  // 覆寫成絕對像素值，蓋掉 viewport host 的響應式框）。
  renderer.setSize(w, h, false);
  presentation.resize(w, h);
}

/** Restores the shared canvas to its live full-window position/sizing. Idempotent — safe to call
 * even when the canvas was never mounted into the Replay viewport (`ReplayController` calls this
 * on every teardown, not only when a session actually reached 'ready'). */
function unmountReplayViewport(): void {
  if (canvas.parentElement !== replayScreenHandle?.viewportElement) return;
  window.removeEventListener('resize', resizeReplayViewport);
  canvas.style.position = '';
  canvas.style.inset = '';
  canvas.style.width = '';
  canvas.style.height = '';
  document.body.prepend(canvas);
  resize(); // 恢復 live 全螢幕尺寸（presentation.mode 此時已回 'live'，resize() 不會再被 replay 分支擋下）。
}

replayScreenHandle = createReplayScreen({
  // `ReplayScreen`'s cancel-load button always calls `onBack()` right after `onCancelLoad()` (its
  // own doc comment) — `close()` already aborts any in-flight `historyClient.loadRun` and tears
  // down the session/viewport, so wiring only `onBack` covers both without a redundant second call.
  onBack: () => replayController?.close(),
  onRetry: () => replayController?.retry(),
});

const initializedReplayController = createReplayController({
  presentation,
  historyClient,
  availableScenes: availableScenes.map(({ config }) => config),
  fallbackSceneConfig: placeholderRoom,
  createSession: (recording, sceneConfig) =>
    createReplayPresentationSession({
      recording,
      sceneConfig,
      renderer,
      onFrame: (sample, playback) => replayScreenHandle?.updateFrame(sample, playback),
    }),
  mountViewport: mountReplayViewport,
  unmountViewport: unmountReplayViewport,
});
replayController = initializedReplayController;

initializedReplayController.subscribe(() => {
  const state = initializedReplayController.state;
  if (state.kind === 'idle') {
    replayScreenHandle?.hide();
    return;
  }
  replayScreenHandle?.show();
  if (state.kind === 'ready') {
    const controls = initializedReplayController.player;
    if (controls === undefined) return; // defensive — 'ready' always implies a live session/player
    replayScreenHandle?.render({ kind: 'ready', sourceLabel: state.sourceLabel, support: state.support, recording: state.recording, controls });
    return;
  }
  replayScreenHandle?.render(state);
});

const renderLoop = createRenderLoop((now) => presentation.frame(now), { frameLog });
renderLoop.start();

// 模組求值到此為止：所有 module-level binding 都已初始化，drill 載入鏈路可安全進入（見上方
// `appBooted` 的說明）。
markAppBooted?.();
