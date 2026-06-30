import { assertIsolation } from './env/isolation.ts';
import { createRenderer } from './render/createRenderer.ts';
import { SceneManager } from './render/SceneManager.ts';
import { createPointerLock } from './input/PointerLock.ts';
import { CameraController } from './view/CameraController.ts';
import { createSettingsPanel } from './ui/SettingsPanel.ts';

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

// 暫用 rAF render 靜態場景；WP-2 才換 sim/render 雙迴圈，此處不引入 sim accumulator。
function frame(): void {
  renderer.render(sceneManager.scene, sceneManager.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
