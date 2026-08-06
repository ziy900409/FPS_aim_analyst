import * as THREE from 'three/webgpu';

/**
 * counts→radians 換算、感度 gain 公式、yaw/pitch 累加的**唯一定義**（KI-005 / A，FR-A-2/3）。
 * `CameraController`（render 視角）與 tick 窗積分器（量測，T4）共用本模組——兩者消費**同一條
 * 事件流的兩種切分**，若各寫一份會重演 KI-004 D2a/D2b（同一幾何量兩層各算一套，其中一套
 * 錯了兩年沒人發現）。修改前必讀 KI-005 / KI-004。
 */

/** CS2 counts→radians 固定線性係數（GD-5：0.022°/count）。**唯一定義**。 */
export const RAD_PER_COUNT = THREE.MathUtils.degToRad(0.022);

/** pitch 夾角 ±89°（Math.PI/2 − 0.01），避免看正上/正下時翻轉。**唯一定義**。 */
export const MAX_PITCH = Math.PI / 2 - 0.01;

export interface MouseGainInput {
  /** SettingsPanel 的 sensitivity（正有限）。 */
  sensitivity: number;
  /** hip 基準垂直 FOV（度）—— 即匯出的 `meta.fovDeg`。 */
  hipFovDeg: number;
  /** 當前武器的 ADS 光學；undefined = 該武器不可開鏡（adsStep === hipStep）。 */
  ads?: { fovDeg: number; sensitivityRatio: number };
}

export interface MouseGain {
  /** hip 態每 count 的 rad = sensitivity × RAD_PER_COUNT。 */
  hipStep: number;
  /** ADS 態每 count 的 rad；無 ads 時 = hipStep。 */
  adsStep: number;
}

function assertPositiveFinite(value: number, name: string): void {
  if (!(Number.isFinite(value) && value > 0)) {
    throw new Error(`mouseGain: ${name} must be a positive finite number, got ${value}`);
  }
}

/**
 * 感度換算的唯一實作（GD-16 的 gain 公式）。純函式、無副作用、不讀時鐘。
 * `CameraController.#adsGain` 與 tick 積分器共用同一結果，故兩者不可能發散。
 *
 * ⚠️ 運算順序刻意逐字對齊現行 `CameraController.setAds`（`ratio * (fovDeg / hipFovDeg)`
 * 先除後乘，再乘上 `hipStep`）——浮點乘法不滿足結合律，改變分組會讓最後一位數偏移。
 *
 * @throws sensitivity / hipFovDeg 非正有限，或 ads 欄位非正有限。
 */
export function resolveMouseGain(input: MouseGainInput): MouseGain {
  assertPositiveFinite(input.sensitivity, 'sensitivity');
  assertPositiveFinite(input.hipFovDeg, 'hipFovDeg');

  const hipStep = input.sensitivity * RAD_PER_COUNT;
  if (input.ads === undefined) {
    return { hipStep, adsStep: hipStep };
  }

  assertPositiveFinite(input.ads.fovDeg, 'ads.fovDeg');
  assertPositiveFinite(input.ads.sensitivityRatio, 'ads.sensitivityRatio');

  const adsGain = input.ads.sensitivityRatio * (input.ads.fovDeg / input.hipFovDeg);
  const adsStep = hipStep * adsGain;
  return { hipStep, adsStep };
}

/**
 * 角度累加的唯一實作：yaw 無界遞減（`yaw -= dx × step`）、pitch 夾 ±MAX_PITCH。
 * `CameraController` 與 tick 積分器各持一個實例，消費**同一條事件流的兩種切分**
 * （render 走 pointerLock.onMove 的 dispatched event；量測走 InputRing 的 coalesced 樣本）。
 */
export interface AimIntegrator {
  readonly yaw: number;
  readonly pitch: number;
  /**
   * 套用一次 delta，回傳**實際生效**的角度差（dPitch 已含夾角效果 ⇒ Σ dPitch ≡ Δpitch）。
   * 純數值運算，零配置——回傳值以重用物件承載，呼叫端須同步讀取、不得保留參考。
   */
  applyDelta(dx: number, dy: number, step: number): { dYaw: number; dPitch: number };
  reset(yaw?: number, pitch?: number): void;
}

class AimIntegratorImpl implements AimIntegrator {
  #yaw = 0;
  #pitch = 0;
  readonly #delta = { dYaw: 0, dPitch: 0 };

  get yaw(): number {
    return this.#yaw;
  }

  get pitch(): number {
    return this.#pitch;
  }

  applyDelta(dx: number, dy: number, step: number): { dYaw: number; dPitch: number } {
    const prevYaw = this.#yaw;
    const prevPitch = this.#pitch;
    this.#yaw -= dx * step;
    this.#pitch = THREE.MathUtils.clamp(this.#pitch - dy * step, -MAX_PITCH, MAX_PITCH);
    this.#delta.dYaw = this.#yaw - prevYaw;
    this.#delta.dPitch = this.#pitch - prevPitch;
    return this.#delta;
  }

  reset(yaw = 0, pitch = 0): void {
    this.#yaw = yaw;
    this.#pitch = pitch;
  }
}

export function createAimIntegrator(): AimIntegrator {
  return new AimIntegratorImpl();
}
