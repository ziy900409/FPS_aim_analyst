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
}

/**
 * Runtime guard for WeaponConfig data. Mirrors drill/schema.ts style: zero
 * dependencies, field-path errors, and a narrowed config on success.
 */
export function validateWeapon(input: unknown): WeaponConfig {
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

  return {
    id,
    cycletimeSec,
    magSize,
    recoil: { seed, magnitude, magnitudeVariance, angleVariance },
    inaccuracy: { stand, crouch, fire, move, recoveryTimeStand, recoveryTimeCrouch },
    ...(recoveryTransition ? { recoveryTransition } : {}),
  };
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
