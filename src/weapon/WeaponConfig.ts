export interface WeaponConfig {
  id: string;
  cycletimeSec: number;
  magSize: number;
  recoil: {
    seed: number;
    magnitude: number;
    magnitudeVariance: number;
    angleVariance: number;
  };
  inaccuracy: {
    stand: number;
    crouch: number;
    fire: number;
    move: number;
    recoveryTimeStand: number;
    recoveryTimeCrouch: number;
  };
  recoveryTransition?: {
    startBullet: number;
    endBullet: number;
  };
  /**
   * ADS 開鏡光學（WP-24 / T2，FR-E5）。省略 = 該武器不可開鏡（ADS 為 no-op，維持 hip 視角）。
   * `fovDeg`：開鏡目標垂直 FOV（度）；正有限，zoom-in 語意由 `fovDeg < hipFov` 自然成立
   * （hipFov 為使用者/相機設定，不在武器資料內，故此處只驗正有限）。
   * `sensitivityRatio`：GD-16 感度換算係數，正有限，預設 1.0；
   * ADS 有效感度 = `sensitivity × sensitivityRatio × (fovDeg / hipFov)`（作用點在 CameraController）。
   */
  ads?: {
    fovDeg: number;
    sensitivityRatio: number;
  };
  /**
   * Projectile ballistics gate (WP-25 / T3). Omitted means the weapon remains
   * hitscan and must keep the existing fire path semantics.
   */
  bullet?: {
    model: 'projectile';
    speedU: number;
    gravityU: number;
    maxRangeU: number;
  };
}

export interface WeaponValidationWarning {
  path: string;
  message: string;
}

export interface WeaponValidationOptions {
  /**
   * Optional active engagement distance. When supplied, validation warns if
   * projectile time-to-target is below the GD-17 two-tick floor.
   */
  engagementDistanceU?: number;
  warnings?: WeaponValidationWarning[];
}

/**
 * Runtime guard for WeaponConfig data. Mirrors drill/schema.ts style: zero
 * dependencies, field-path errors, and a narrowed config on success.
 */
export function validateWeapon(input: unknown, options: WeaponValidationOptions = {}): WeaponConfig {
  const root = requireObject(input, 'root');

  const id = root.id;
  if (typeof id !== 'string' || id.length === 0) {
    throw err('id', 'must be a non-empty string');
  }

  const cycletimeSec = requirePositiveNumber(root.cycletimeSec, 'cycletimeSec');
  const magSize = requirePositiveInt(root.magSize, 'magSize');

  const recoil = requireObject(root.recoil, 'recoil');
  const seed = requirePositiveInt(recoil.seed, 'recoil.seed');
  const magnitude = requireNonNegativeNumber(recoil.magnitude, 'recoil.magnitude');
  const magnitudeVariance = requireNonNegativeNumber(recoil.magnitudeVariance, 'recoil.magnitudeVariance');
  const angleVariance = requireNonNegativeNumber(recoil.angleVariance, 'recoil.angleVariance');
  if (magnitudeVariance > magnitude) {
    throw err('recoil.magnitudeVariance', 'must not exceed recoil.magnitude');
  }

  const inaccuracy = requireObject(root.inaccuracy, 'inaccuracy');
  const stand = requireNonNegativeNumber(inaccuracy.stand, 'inaccuracy.stand');
  const crouch = requireNonNegativeNumber(inaccuracy.crouch, 'inaccuracy.crouch');
  const fire = requireNonNegativeNumber(inaccuracy.fire, 'inaccuracy.fire');
  const move = requireNonNegativeNumber(inaccuracy.move, 'inaccuracy.move');
  const recoveryTimeStand = requirePositiveNumber(inaccuracy.recoveryTimeStand, 'inaccuracy.recoveryTimeStand');
  const recoveryTimeCrouch = requirePositiveNumber(inaccuracy.recoveryTimeCrouch, 'inaccuracy.recoveryTimeCrouch');

  const recoveryTransition =
    root.recoveryTransition === undefined
      ? undefined
      : validateRecoveryTransition(root.recoveryTransition);

  const ads = root.ads === undefined ? undefined : validateAds(root.ads);
  const bullet = root.bullet === undefined ? undefined : validateBullet(root.bullet, options);

  return {
    id,
    cycletimeSec,
    magSize,
    recoil: { seed, magnitude, magnitudeVariance, angleVariance },
    inaccuracy: { stand, crouch, fire, move, recoveryTimeStand, recoveryTimeCrouch },
    ...(recoveryTransition ? { recoveryTransition } : {}),
    ...(ads ? { ads } : {}),
    ...(bullet ? { bullet } : {}),
  };
}

function validateBullet(input: unknown, options: WeaponValidationOptions): WeaponConfig['bullet'] {
  const bullet = requireObject(input, 'bullet');
  if (bullet.model !== 'projectile') {
    throw err('bullet.model', 'must be "projectile"');
  }
  const speedU = requirePositiveNumber(bullet.speedU, 'bullet.speedU');
  const gravityU = requirePositiveNumber(bullet.gravityU, 'bullet.gravityU');
  const maxRangeU = requirePositiveNumber(bullet.maxRangeU, 'bullet.maxRangeU');

  const maxRangeTicks = (maxRangeU / speedU) * 128;
  if (maxRangeTicks < 2) {
    pushWarning(options, 'bullet.maxRangeU', 'projectile lifetime is below 2 ticks and degenerates toward hitscan');
  }

  if (options.engagementDistanceU !== undefined) {
    const engagementDistanceU = requirePositiveNumber(options.engagementDistanceU, 'engagementDistanceU');
    const timeToTargetTicks = (engagementDistanceU / speedU) * 128;
    if (timeToTargetTicks < 2) {
      pushWarning(options, 'bullet.speedU', 'projectile reaches engagement distance in < 2 ticks');
    }
  }

  return { model: 'projectile', speedU, gravityU, maxRangeU };
}

function pushWarning(options: WeaponValidationOptions, path: string, message: string): void {
  options.warnings?.push({ path, message });
}

function validateAds(input: unknown): WeaponConfig['ads'] {
  const ads = requireObject(input, 'ads');
  // hipFov 不在武器資料內，故 fovDeg 只驗正有限（zoom-in 由 fovDeg < hipFov 於相機層自然成立）。
  const fovDeg = requirePositiveNumber(ads.fovDeg, 'ads.fovDeg');
  const sensitivityRatio = requirePositiveNumber(ads.sensitivityRatio, 'ads.sensitivityRatio');
  return { fovDeg, sensitivityRatio };
}

function validateRecoveryTransition(input: unknown): WeaponConfig['recoveryTransition'] {
  const transition = requireObject(input, 'recoveryTransition');
  const startBullet = requirePositiveInt(transition.startBullet, 'recoveryTransition.startBullet');
  const endBullet = requirePositiveInt(transition.endBullet, 'recoveryTransition.endBullet');
  if (startBullet > endBullet) {
    throw err('recoveryTransition.startBullet', 'must be <= recoveryTransition.endBullet');
  }
  return { startBullet, endBullet };
}

function err(path: string, msg: string): Error {
  return new Error(`WeaponConfig validation failed: ${path} ${msg}`);
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw err(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw err(path, 'must be a finite number');
  }
  return value;
}

function requireNonNegativeNumber(value: unknown, path: string): number {
  const n = requireFiniteNumber(value, path);
  if (n < 0) throw err(path, 'must be >= 0');
  return n;
}

function requirePositiveNumber(value: unknown, path: string): number {
  const n = requireFiniteNumber(value, path);
  if (n <= 0) throw err(path, 'must be > 0');
  return n;
}

function requirePositiveInt(value: unknown, path: string): number {
  const n = requireFiniteNumber(value, path);
  if (!Number.isInteger(n) || n <= 0) throw err(path, 'must be a positive integer');
  return n;
}
