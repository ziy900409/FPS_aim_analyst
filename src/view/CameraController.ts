import * as THREE from 'three/webgpu';
import { RAD_PER_COUNT, resolveMouseGain, createAimIntegrator, type AimIntegrator } from '../input/mouseGain.ts';

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
 *
 * counts→rad / gain 公式 / yaw-pitch 累加的**唯一定義**在 `src/input/mouseGain.ts`
 * （KI-005 / A，FR-A-2/3）——tick 窗積分器（量測）共用同一套，兩者不可能發散。
 */

/** sensitivity 預設值（T5 設定面板可即時改）。 */
const DEFAULT_SENSITIVITY = 1.0;
/**
 * ADS 開鏡 FOV 過渡時長（ms，render-only，OQ-24.1）。視覺淡入專用——**不進 sim/記錄**
 * （記錄的是 heldAds 事件與逐 tick flag，非此視覺過渡）。感度切換為階躍，不受此內插影響。
 */
const ADS_FOV_TRANSITION_MS = 120;

// 旋轉軸常數（setFromAxisAngle 只讀不改）。
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0);

export interface AimState {
  yaw: number;
  pitch: number;
}

/** ADS 光學參數（WP-24 / T2，來源 `WeaponConfig.ads`）。 */
export interface AdsConfig {
  /** 開鏡目標垂直 FOV（度）。 */
  fovDeg: number;
  /** GD-16 感度換算係數（正有限，預設 1.0）。 */
  sensitivityRatio: number;
}

export class CameraController {
  #camera: THREE.PerspectiveCamera;
  readonly #aimSink?: AimState;
  // yaw/pitch 累加委派 AimIntegrator（mouseGain.ts 單一實作，與 tick 窗積分器共用）。
  readonly #integrator: AimIntegrator = createAimIntegrator();
  #sensitivity = DEFAULT_SENSITIVITY;
  // recoil 視覺 punch（rad，WP-13 / T2）：每幀由 render loop 以 setViewPunch 餵入（aimPunch 內插後
  // 經 adapter 轉 three rad）。與使用者 yaw/pitch 分離：punch 只組進 camera 朝向、**不**寫回 aimSink
  // （state.aim = 使用者視角；彈道另加 rawPunch，避免雙重計入）。
  #punchYaw = 0;
  #punchPitch = 0;

  // ADS 開鏡（WP-24 / T2，FR-E5）：只落 render/input 層（GD-16），不進 sim/命中/彈道。
  #adsConfig?: AdsConfig;
  #adsActive = false;
  // 感度 gain 為**階躍**（切換 ADS 立即生效，非隨 FOV 內插）：hip=sensitivity×RAD_PER_COUNT、
  // ads=hipStep×ratio×(adsFov/hipFov)（resolveMouseGain 產出，FR-A-3）；只在原本會重算 #adsGain
  // 的觸發點（setSensitivity / setAdsConfig(active 中) / setAds 轉場）重算，避免逐幀重新配置。
  #currentStep = DEFAULT_SENSITIVITY * RAD_PER_COUNT;
  // FOV 內插狀態（render-only；#hipFov 為使用者/相機基準 FOV，setFov 維護）。
  #hipFov: number;
  #fovFrom: number;
  #fovTarget: number;
  #fovCurrent: number;
  #transitionStartMs = 0;

  // 每次 applyDelta 重用，避免 mousemove 高頻路徑上的 GC 卡頓（CLAUDE.md §4 物件重用）。
  readonly #qYaw = new THREE.Quaternion();
  readonly #qPitch = new THREE.Quaternion();

  constructor(camera: THREE.PerspectiveCamera, aimSink?: AimState) {
    this.#camera = camera;
    this.#aimSink = aimSink;
    // FOV 基準取自 camera 現值（SceneManager/設定面板設定）；hip=ads=current 起始無過渡。
    this.#hipFov = camera.fov;
    this.#fovFrom = camera.fov;
    this.#fovTarget = camera.fov;
    this.#fovCurrent = camera.fov;
    // 從基準 yaw=pitch=0 起（朝 -Z，與 SceneManager lookAt 一致）；此後 camera 朝向
    // 由本類別獨佔，避免兩套發散的視角狀態（R5）。
    this.#applyToCamera();
  }

  /** 鎖定中的滑鼠 delta → 累積 yaw/pitch（pitch 夾角）→ 套到 camera。ADS 態乘 GD-16 gain。 */
  applyDelta(dx: number, dy: number): void {
    this.#integrator.applyDelta(dx, dy, this.#currentStep);
    this.#applyToCamera();
  }

  /** 設定 sensitivity（T5 設定面板；即時生效於下一次 applyDelta）。 */
  setSensitivity(s: number): void {
    this.#sensitivity = s;
    this.#recomputeStep();
  }

  /** 依當前 sensitivity / hipFov / adsConfig / adsActive 重算 #currentStep（resolveMouseGain，FR-A-3）。 */
  #recomputeStep(): void {
    const gain = resolveMouseGain({
      sensitivity: this.#sensitivity,
      hipFovDeg: this.#hipFov,
      ads: this.#adsConfig,
    });
    this.#currentStep = this.#adsActive ? gain.adsStep : gain.hipStep;
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

  /**
   * 設定 hip 基準垂直 FOV（度）（T5 設定面板；即時生效）。非 ADS 時直接套到 camera；
   * ADS 進行中僅更新基準（放開鏡後趨近新值），設定面板鎖定中隱藏故實務不並發（WP-24 / T2）。
   */
  setFov(deg: number): void {
    this.#hipFov = deg;
    if (!this.#adsActive) {
      this.#fovFrom = deg;
      this.#fovTarget = deg;
      this.#fovCurrent = deg;
      this.#applyFov();
    }
  }

  /**
   * 設定當前武器的 ADS 光學（WP-24 / T2）。`undefined` = 該武器不可開鏡（ADS 為 no-op）。
   * 一般在武器/drill 切換時佈線一次；若正 ADS 中變更，重算 gain 與 FOV 目標（保守邊界）。
   */
  setAdsConfig(ads: AdsConfig | undefined): void {
    this.#adsConfig = ads;
    if (this.#adsActive) {
      this.#fovTarget = ads ? ads.fovDeg : this.#hipFov;
      this.#recomputeStep();
    }
  }

  /**
   * 每幀由 render loop 依 `heldAds` 呼叫（比照 `setViewPunch` 模式，render-only，不進 sim）。
   * 狀態轉換時：FOV 目標翻為 ads/hip、gain **階躍**更新（GD-16，以目標態計算而非內插中值）；
   * 每幀依 `nowMs` 推進 FOV 線性內插（時長 `ADS_FOV_TRANSITION_MS`）。無 ADS config 時開鏡為 no-op。
   * `nowMs` 為 render 時鐘（rAF），只作視覺過渡進度，決定性/記錄不依賴之。
   */
  setAds(active: boolean, nowMs: number): void {
    // 無 ADS config 的武器：強制維持 hip（開鏡請求無效）。
    const effectiveActive = active && this.#adsConfig !== undefined;
    if (effectiveActive !== this.#adsActive) {
      this.#adsActive = effectiveActive;
      // 內插起點 = 當前 FOV（支援過渡中反向切換不跳變）；目標 = ads/hip。
      this.#fovFrom = this.#fovCurrent;
      this.#fovTarget = effectiveActive && this.#adsConfig ? this.#adsConfig.fovDeg : this.#hipFov;
      this.#transitionStartMs = nowMs;
      // gain 階躍：立即以目標態計算（切換感度為分析可分的階躍，非隨 FOV 漸變）。
      this.#recomputeStep();
    }
    const t =
      ADS_FOV_TRANSITION_MS <= 0
        ? 1
        : THREE.MathUtils.clamp((nowMs - this.#transitionStartMs) / ADS_FOV_TRANSITION_MS, 0, 1);
    this.#fovCurrent = THREE.MathUtils.lerp(this.#fovFrom, this.#fovTarget, t);
    this.#applyFov();
  }

  #applyFov(): void {
    this.#camera.fov = this.#fovCurrent;
    this.#camera.updateProjectionMatrix();
  }

  /** 場景切換時把既有 yaw/pitch/sensitivity/punch 套到新 camera。 */
  setCamera(camera: THREE.PerspectiveCamera): void {
    this.#camera = camera;
    this.#applyToCamera();
    this.#applyFov(); // 新 camera 繼承當前 FOV（含 ADS 內插中值）
  }

  #applyToCamera(): void {
    // recoil 視覺 punch 疊加於使用者 yaw/pitch 之上組進 camera；使用者 pitch 已於 applyDelta 夾角，
    // punch 加在夾角之外（夾角只約束使用者視角，不夾 punch，避免高後座時卡在 ±89°）。
    const yaw = this.#integrator.yaw;
    const pitch = this.#integrator.pitch;
    this.#qYaw.setFromAxisAngle(WORLD_UP, yaw + this.#punchYaw);
    this.#qPitch.setFromAxisAngle(LOCAL_RIGHT, pitch + this.#punchPitch);
    // qYaw · qPitch：先繞 local X（pitch）再繞 world Y（yaw），組合後無 roll。
    this.#camera.quaternion.copy(this.#qYaw).multiply(this.#qPitch);
    if (this.#aimSink !== undefined) {
      // aimSink = 使用者視角（**不含** punch）：彈道另加 rawPunch=aimPunch×2（SimLoop），
      // 若此處寫入含 punch 的角度會使彈道雙重計入 punch。
      this.#aimSink.yaw = yaw;
      this.#aimSink.pitch = pitch;
    }
  }
}
