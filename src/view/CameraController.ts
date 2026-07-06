import * as THREE from 'three/webgpu';

/**
 * CameraController — WP-1 / T4（FR-1.4）
 *
 * 把 Pointer Lock 的滑鼠 delta（movementX/Y）累積成 yaw/pitch，組成 quaternion 套到
 * camera。屬「視角」層（CONTEXT.md §B render 路徑）：視角更新走輸入/render 路徑，
 * **不入 sim**（雙迴圈邊界，WP-2）——本類別不相依任何 sim 模組。
 *
 * 旋轉組合 `quaternion = qYaw · qPitch`：yaw 繞**世界 Y**、pitch 繞**camera local X**，
 * 故無 roll（notes-fps-controls §yaw/pitch）。pitch 以**明確**的專案級夾角 ±MAX_PITCH
 * 限制（R2：不沿用 three.js minPolarAngle/maxPolarAngle 預設），避免看正上/正下時翻轉。
 *
 * 單位：`sensitivity × RAD_PER_COUNT` 為 CS2 counts→radians 線性換算（GD-5）；
 * RAD_PER_COUNT 固定為 0.022°/count，sensitivity 使用者可調（T5）。
 */

/** CS2 counts→radians 固定線性係數（GD-5：0.022°/count）。 */
const RAD_PER_COUNT = THREE.MathUtils.degToRad(0.022);
/** sensitivity 預設值（T5 設定面板可即時改）。 */
const DEFAULT_SENSITIVITY = 1.0;
/** pitch 夾角 ±89°（Math.PI/2 - ε），避免翻轉（R2 明確專案級限制）。 */
const MAX_PITCH = Math.PI / 2 - 0.01;

// 旋轉軸常數（setFromAxisAngle 只讀不改）。
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0);

export interface AimState {
  yaw: number;
  pitch: number;
}

export class CameraController {
  readonly #camera: THREE.PerspectiveCamera;
  readonly #aimSink?: AimState;
  #yaw = 0;
  #pitch = 0;
  #sensitivity = DEFAULT_SENSITIVITY;
  // recoil 視覺 punch（rad，WP-13 / T2）：每幀由 render loop 以 setViewPunch 餵入（aimPunch 內插後
  // 經 adapter 轉 three rad）。與使用者 yaw/pitch 分離：punch 只組進 camera 朝向、**不**寫回 aimSink
  // （state.aim = 使用者視角；彈道另加 rawPunch，避免雙重計入）。
  #punchYaw = 0;
  #punchPitch = 0;

  // 每次 applyDelta 重用，避免 mousemove 高頻路徑上的 GC 卡頓（CLAUDE.md §4 物件重用）。
  readonly #qYaw = new THREE.Quaternion();
  readonly #qPitch = new THREE.Quaternion();

  constructor(camera: THREE.PerspectiveCamera, aimSink?: AimState) {
    this.#camera = camera;
    this.#aimSink = aimSink;
    // 從基準 yaw=pitch=0 起（朝 -Z，與 SceneManager lookAt 一致）；此後 camera 朝向
    // 由本類別獨佔，避免兩套發散的視角狀態（R5）。
    this.#applyToCamera();
  }

  /** 鎖定中的滑鼠 delta → 累積 yaw/pitch（pitch 夾角）→ 套到 camera。 */
  applyDelta(dx: number, dy: number): void {
    const step = this.#sensitivity * RAD_PER_COUNT;
    this.#yaw -= dx * step; // dx>0（右移）→ yaw 減 → 向右看
    this.#pitch = THREE.MathUtils.clamp(this.#pitch - dy * step, -MAX_PITCH, MAX_PITCH);
    this.#applyToCamera();
  }

  /** 設定 sensitivity（T5 設定面板；即時生效於下一次 applyDelta）。 */
  setSensitivity(s: number): void {
    this.#sensitivity = s;
  }

  /**
   * 設定 recoil 視覺 punch（rad，WP-13 / T2）：render loop 每幀呼叫 → 立即重組 camera 朝向，
   * 故滑鼠靜止時 punch 衰減仍逐幀可見（稽核 A2）。punch 疊加於使用者 yaw/pitch **之外**、
   * 不受 pitch 夾角限制（夾角只約束使用者視角，見 `#applyToCamera`）。
   */
  setViewPunch(yawRad: number, pitchRad: number): void {
    this.#punchYaw = yawRad;
    this.#punchPitch = pitchRad;
    this.#applyToCamera();
  }

  /** 設定垂直 FOV（度）（T5 設定面板；即時生效）。 */
  setFov(deg: number): void {
    this.#camera.fov = deg;
    this.#camera.updateProjectionMatrix();
  }

  #applyToCamera(): void {
    // recoil 視覺 punch 疊加於使用者 yaw/pitch 之上組進 camera；使用者 pitch 已於 applyDelta 夾角，
    // punch 加在夾角之外（夾角只約束使用者視角，不夾 punch，避免高後座時卡在 ±89°）。
    this.#qYaw.setFromAxisAngle(WORLD_UP, this.#yaw + this.#punchYaw);
    this.#qPitch.setFromAxisAngle(LOCAL_RIGHT, this.#pitch + this.#punchPitch);
    // qYaw · qPitch：先繞 local X（pitch）再繞 world Y（yaw），組合後無 roll。
    this.#camera.quaternion.copy(this.#qYaw).multiply(this.#qPitch);
    if (this.#aimSink !== undefined) {
      // aimSink = 使用者視角（**不含** punch）：彈道另加 rawPunch=aimPunch×2（SimLoop），
      // 若此處寫入含 punch 的角度會使彈道雙重計入 punch。
      this.#aimSink.yaw = this.#yaw;
      this.#aimSink.pitch = this.#pitch;
    }
  }
}
