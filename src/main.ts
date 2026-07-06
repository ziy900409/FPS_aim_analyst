import { assertIsolation } from './env/isolation.ts';
import { createRenderer } from './render/createRenderer.ts';
import { SceneManager } from './render/SceneManager.ts';
import { TargetView } from './render/TargetView.ts';
import { createPointerLock } from './input/PointerLock.ts';
import { createInputSampler } from './input/InputSampler.ts';
import { CameraController } from './view/CameraController.ts';
import { createSettingsPanel } from './ui/SettingsPanel.ts';
import { createCrosshair } from './ui/Crosshair.ts';
import { createExportPanel } from './ui/ExportPanel.ts';
import { createHUD, createHUDStats, type HUDStats } from './ui/HUD.ts';
import { createResultScreen } from './ui/ResultScreen.ts';
import { createControls } from './ui/Controls.ts';
import { sharedState } from './state/SharedState.ts';
import { createTargetManager, type TargetManager } from './sim/TargetManager.ts';
import { loadDrill } from './drill/DrillLoader.ts';
import { createDrillRunner, type DrillRunner } from './drill/DrillRunner.ts';
import type { DrillConfig } from './drill/DrillConfig.ts';
import { createSimLoop } from './loop/SimLoop.ts';
import { createRenderLoop, lerp } from './loop/RenderLoop.ts';
import { realClock } from './loop/clock.ts';
import { SIM_HZ } from './loop/constants.ts';
import { createDataRecorder } from './data/DataRecorder.ts';
import { collectMeta, measureDisplayHz } from './data/metadata.ts';
import { buildExportPayload, downloadCSV, downloadJSON, type ExportPayload } from './data/export.ts';
import { createMetricsDashboard } from './metrics/MetricsDashboard.ts';
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
}

const initialDrillConfig = loadDrill(defaultDrillSource);
const availableDrills: AvailableDrill[] = [
  { id: initialDrillConfig.drillId, label: initialDrillConfig.drillId, source: defaultDrillSource },
];
let activeDrillConfig: DrillConfig = initialDrillConfig;
let recorderStartedAt = new Date().toISOString();

// WP-1 / T1（FR-1.1）— 封閉房間 + camera 舞台。
const sceneManager = new SceneManager();

// WP-4 / T1（FR-4.1）— 目標渲染:唯讀 sharedState.targets 顯示/隱藏 mesh（狀態由 sim 改，見 T2/T3）。
const targetView = new TargetView(sceneManager.scene);

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  sceneManager.resize(w, h);
}
resize();
window.addEventListener('resize', resize);

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

// WP-1 / T5（FR-1.5）— sensitivity/FOV 設定面板（DOM overlay, D1）：拖動即時生效。
// 面板為這兩個設定的單一真實來源（建構時推預設給 controller），值供 WP-7 metadata。
// 鎖定中隱藏、解除時顯示（OQ-1.3）。
const settingsPanel = createSettingsPanel({
  onSensitivityChange: (s) => cameraController.setSensitivity(s),
  onFovChange: (deg) => cameraController.setFov(deg),
});
pointerLock.onChange((locked) => settingsPanel.setVisible(!locked));

// WP-4 / T4（FR-4.4）— 螢幕中心準心（DOM overlay, D1）：瞄準參考 + §5 準心對齊偏移的視覺基準。
// 恆顯示（不隨鎖定切換）：第一人稱射線走 camera 中心，準心即射線方向指示。
createCrosshair();

// WP-7 / T4（FR-7.4）— 匯出控制：讀取 recorder snapshot + metadata 後下載 JSON/CSV。
// 讀取與序列化只在 click handler 內發生，不進 sim tick 熱路徑。
const recorder = createDataRecorder({ simHz: SIM_HZ });
async function buildCurrentExportPayload(): Promise<ExportPayload> {
  const snapshot = recorder.snapshot();
  const displayHz = await measureDisplayHz();
  const meta = collectMeta({
    drillId: activeDrillConfig.drillId,
    backend,
    displayHz,
    simHz: SIM_HZ,
    sensitivity: settingsPanel.sensitivity,
    crossOriginIsolated: isolation.crossOriginIsolated,
    startedAt: recorderStartedAt,
    lateEventCount: sharedState.inputMeta.lateEventCount,
    bufferOverflow: sharedState.inputMeta.bufferOverflow,
    recorderOverflow: snapshot.recorderOverflow,
  });
  return buildExportPayload(meta, snapshot);
}

function exportBasename(payload: ExportPayload): string {
  return `${payload.meta.drillId}-${payload.meta.startedAt}`;
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
const resultScreen = createResultScreen();
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
  if (!locked) sharedState.heldFire = false;
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
const simLoop = createSimLoop(sharedState, realClock, SIM_HZ, targetManager, sceneManager.camera, drillRunner, recorder);

// WP-3 / T5 — dev/e2e 觀測縫：**僅 dev**（`import.meta.env.DEV`，production build 剝除）唯讀暴露量測
// 單例,供 Playwright 端到端斷言「事件帶 timeStamp 入 ring → sim 依時序消費」。不影響三迴圈
// （ADR-2;只讀不寫）;e2e 用法見 tests/e2e/input-sampler.spec.ts + WP-3 manual-verification.md。
if (import.meta.env.DEV) {
  (window as unknown as { __aimDebug?: unknown }).__aimDebug = { state: sharedState, pointerLock };
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
  (window as unknown as { __fpsTest?: unknown }).__fpsTest = createFpsTestHarness({
    availableDrills: availableDrills.map(({ id, source }) => ({ id, source })),
    backend,
    crossOriginIsolated: isolation.crossOriginIsolated,
    displayHz,
    sensitivity: settingsPanel.sensitivity,
  });
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

// player 位置原點對應 camera 起始 world 位置；位移以 display scale 疊加。
// **display scale 佔位**（SIM_TO_WORLD，render-only）：sim/資料一律 source unit（u，CONTEXT 正規單位、
// CLAUDE.md §4；vStrafe=250 u/s 為 canonical CS 值，不得改），但佔位房間僅 ~10 world unit，若 1:1 疊加
// 則 250 u/s 每 tick 移 ~1.95 world unit、~40ms 撞牆＝無法目視橫移/急停。故 render 端把 sim position 乘
// 一個佔位 display scale（1 world unit = 100 u），使 250 u/s 呈現為 ~2.5 world-u/s（可控、急停可目視）。
// **只影響 render，不流入 sim/匯出資料**（雙迴圈邊界 + 單位硬約束）；真 display scale 由 WP-6 drill config 定。
const SIM_TO_WORLD = 0.01; // world unit per source unit（佔位；WP-6 drill config 接管）
const baseX = sceneManager.camera.position.x;
const baseY = sceneManager.camera.position.y;
const baseZ = sceneManager.camera.position.z;

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
  resultScreen.hide();
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
  drillRunner.start(activeDrillConfig);
  syncControlsVisibility();
}

function loadDrillById(drillId: string): void {
  const option = availableDrills.find((candidate) => candidate.id === drillId);
  if (option === undefined) throw new Error(`Unknown drill: ${drillId}`);

  const nextConfig = loadDrill(option.source);
  drillRunner.restart();
  activeDrillConfig = nextConfig;
  activeTargetManager = createTargetManager(nextConfig);
  activeDrillRunner = createDrillRunner(sharedState, activeTargetManager);
  resetRunPresentation();
  drillRunner.start(activeDrillConfig);
  controls.setSelectedDrill(activeDrillConfig.drillId);
  syncControlsVisibility();
}

// WP-8 / T4（FR-8.4）— 重來 / 換 drill 控制。解鎖時可操作；結果頁顯示時也保持可操作。
const controls = createControls({
  drills: availableDrills.map(({ id, label }) => ({ id, label })),
  selectedDrillId: activeDrillConfig.drillId,
  onRestart: restartActiveDrill,
  onLoadDrill: loadDrillById,
});

function syncControlsVisibility(): void {
  controls.setVisible(!pointerLock.locked || drillRunner.phase === 'ended');
}

pointerLock.onChange(syncControlsVisibility);
syncControlsVisibility();

const renderLoop = createRenderLoop((now) => {
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
  // 3) player 位移驅動 camera 位置；sim source unit → world 乘 SIM_TO_WORLD 佔位 display scale（見上）。
  //    視角朝向（yaw/pitch）由 CameraController 走輸入路徑、**不內插**（人眼對視角延遲敏感，且視角非 sim 狀態）。
  sceneManager.camera.position.set(baseX + px * SIM_TO_WORLD, baseY, baseZ + pz * SIM_TO_WORLD);
  // 4) 目標 mesh 依 state 顯示/隱藏（唯讀；本 WP 目標序列由 T2/T3 的 TargetManager 寫入）。
  targetView.sync(sharedState.targets);
  // 5) 繪製。
  renderer.render(sceneManager.scene, sceneManager.camera);
  // WP-8 / T2：phase 轉 ended 後只計算一次結果；T4 controls 會負責 restart / 換 drill 時隱藏與重啟。
  if (!resultShown && phase === 'ended') {
    if (document.pointerLockElement !== null) document.exitPointerLock();
    resultScreen.show(metricsDashboard.compute(recorder.snapshot()));
    resultShown = true;
    syncControlsVisibility();
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
});
renderLoop.start();
