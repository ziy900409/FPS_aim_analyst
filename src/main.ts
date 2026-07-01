import { assertIsolation } from './env/isolation.ts';
import { createRenderer } from './render/createRenderer.ts';
import { SceneManager } from './render/SceneManager.ts';
import { createPointerLock } from './input/PointerLock.ts';
import { createInputSampler } from './input/InputSampler.ts';
import { CameraController } from './view/CameraController.ts';
import { createSettingsPanel } from './ui/SettingsPanel.ts';
import { sharedState } from './state/SharedState.ts';
import { createSimLoop } from './loop/SimLoop.ts';
import { createRenderLoop, lerp } from './loop/RenderLoop.ts';
import { realClock } from './loop/clock.ts';
import { SIM_HZ } from './loop/constants.ts';

// 進入點必須走 'three/webgpu'（見 createRenderer），否則拿不到 WebGPURenderer。

// WP-0 / T2（FR-0.2）— 啟動先驗 cross-origin isolation（計時量測效度前置，ADR-4）。
const isolation = assertIsolation();
console.info('[isolation]', isolation);

const canvas = document.querySelector<HTMLCanvasElement>('#app')!;

// WP-0 seam：async bootstrap，取得 renderer + backend（backend 供 WP-7 metadata）。
const { renderer, backend } = await createRenderer(canvas);
void backend;

// WP-1 / T1（FR-1.1）— 封閉房間 + camera 舞台。
const sceneManager = new SceneManager();

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
const cameraController = new CameraController(sceneManager.camera);
pointerLock.onMove((dx, dy) => cameraController.applyDelta(dx, dy));

// WP-1 / T5（FR-1.5）— sensitivity/FOV 設定面板（DOM overlay, D1）：拖動即時生效。
// 面板為這兩個設定的單一真實來源（建構時推預設給 controller），值供 WP-7 metadata。
// 鎖定中隱藏、解除時顯示（OQ-1.3）。
const settingsPanel = createSettingsPanel({
  onSensitivityChange: (s) => cameraController.setSensitivity(s),
  onFovChange: (deg) => cameraController.setFov(deg),
});
pointerLock.onChange((locked) => settingsPanel.setVisible(!locked));

// WP-3 / T1+T3（FR-3.1/3.3）— 輸入採集：keydown/keyup（A/D/W/S）與開火 mousedown（左鍵）蓋
// event.timeStamp 寫入 sharedState.input，供 sim（T4）依時序消費。事件驅動（非固定迴圈，ADR-2）；
// 掛在 window（鍵盤事件不落在 canvas；lock 中滑鼠事件亦冒泡至 window）。開火以 pointerLock.locked
// 為採計閘門——否則「點擊 canvas 取鎖」與 UI 點擊會被誤判為開火（T3）。與 CameraController（視角走
// pointerLock.onMove）互不干擾——此處只入緩衝供量測（WP-3 目的）。
const inputSampler = createInputSampler(sharedState, () => pointerLock.locked);
inputSampler.attach(window);

// WP-2 / T2+T3（FR-2.2/2.3）— 雙迴圈：sim（128 Hz 固定步長 accumulator）與 render（rAF）解耦，
// 全透過 sharedState 溝通（ADR-2）。階段 A 單執行緒下，sim 在 render 的 rAF callback 內 pump（§4.3
// 「單一 rAF 超級迴圈」，DESIGN §1）；階段 B 才把 sim 搬入 worker。
const simLoop = createSimLoop(sharedState, realClock, SIM_HZ);

// player 位置原點對應 camera 起始 world 位置；位移以 display scale 疊加。佔位 1:1（sim u → world unit），
// 真 display scale 由 WP-6 drill config 定（CONTEXT 正規單位：render 可另套，sim/資料不得用公尺）。
// 閒置時 player 恆在原點（真鍵盤輸入是 WP-3），故 camera = base，僅朝向由 mouse 變動。
const baseX = sceneManager.camera.position.x;
const baseY = sceneManager.camera.position.y;
const baseZ = sceneManager.camera.position.z;

const renderLoop = createRenderLoop((now) => {
  // 1) 推進 sim（固定步長，只用 TICK；決定性根源在 SimLoop），取回 alpha 內插係數。
  const { alpha } = simLoop.pump(now);
  // 2) render 唯讀內插 player 位置（prev→curr）——**不寫回 sharedState**（雙迴圈邊界，render 唯讀）。
  const px = lerp(sharedState.prev.x, sharedState.curr.x, alpha);
  const pz = lerp(sharedState.prev.z, sharedState.curr.z, alpha);
  // 3) player 位移驅動 camera 位置；視角朝向（yaw/pitch）由 CameraController 走輸入路徑、**不內插**
  //    （人眼對視角延遲敏感，且視角非 sim 狀態）。
  sceneManager.camera.position.set(baseX + px, baseY, baseZ + pz);
  // 4) 繪製。
  renderer.render(sceneManager.scene, sceneManager.camera);
});
renderLoop.start();
