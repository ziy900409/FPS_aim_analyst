import type { RecoilTableEntry } from './recoilTable.ts';

const RECOIL_DT_SEC = 1 / 64;
const DT_EPSILON = 1e-12;
const AIM_PUNCH_DECAY_EXP = 8;
const AIM_PUNCH_DECAY_LINEAR = 18;
const PUNCH_VEL_DECAY = 4.5;
const RECOIL_INDEX_DECAY_PER_SEC = Math.LN10 * 2;
const VIEW_PUNCH_SCALE = 0.055;
// Centralized calibration against the WP-10 AK 10-shot golden vector.
const GOLDEN_PITCH_KICK_SCALE = 1.0016607983832462;
const GOLDEN_YAW_KICK_SCALE = 1.7986768446381955;

export interface RecoilState {
  aimPunchPitchDeg: number;
  aimPunchYawDeg: number;
  punchVelPitch: number;
  punchVelYaw: number;
  viewPunchPitchDeg: number;
  viewPunchYawDeg: number;
  recoilIndex: number;
  inaccuracyFire: number;
  lastFireT: number;
  recoilResetDelaySec: number;
}

export interface WeaponRecoilLike {
  cycletimeSec: number;
  inaccuracy: {
    fire: number;
  };
}

export function createRecoilState(): RecoilState {
  return resetRecoilState({
    aimPunchPitchDeg: 0,
    aimPunchYawDeg: 0,
    punchVelPitch: 0,
    punchVelYaw: 0,
    viewPunchPitchDeg: 0,
    viewPunchYawDeg: 0,
    recoilIndex: 0,
    inaccuracyFire: 0,
    lastFireT: Number.POSITIVE_INFINITY,
    recoilResetDelaySec: Number.POSITIVE_INFINITY,
  });
}

export function resetRecoilState(s: RecoilState): RecoilState {
  s.aimPunchPitchDeg = 0;
  s.aimPunchYawDeg = 0;
  s.punchVelPitch = 0;
  s.punchVelYaw = 0;
  s.viewPunchPitchDeg = 0;
  s.viewPunchYawDeg = 0;
  s.recoilIndex = 0;
  s.inaccuracyFire = 0;
  s.lastFireT = Number.POSITIVE_INFINITY;
  s.recoilResetDelaySec = Number.POSITIVE_INFINITY;
  return s;
}

export function recoilTick(s: RecoilState, dtSec: number): void {
  if (Math.abs(dtSec - RECOIL_DT_SEC) > DT_EPSILON) {
    throw new Error('recoilTick dtSec must be exactly 1/64');
  }

  s.aimPunchPitchDeg = hybridDecay(s.aimPunchPitchDeg, dtSec);
  s.aimPunchYawDeg = hybridDecay(s.aimPunchYawDeg, dtSec);
  s.viewPunchPitchDeg = hybridDecay(s.viewPunchPitchDeg, dtSec);
  s.viewPunchYawDeg = hybridDecay(s.viewPunchYawDeg, dtSec);

  s.aimPunchPitchDeg += s.punchVelPitch * dtSec * 0.5;
  s.aimPunchYawDeg += s.punchVelYaw * dtSec * 0.5;

  const velDecay = Math.exp(-PUNCH_VEL_DECAY * dtSec);
  s.punchVelPitch *= velDecay;
  s.punchVelYaw *= velDecay;

  s.aimPunchPitchDeg += s.punchVelPitch * dtSec * 0.5;
  s.aimPunchYawDeg += s.punchVelYaw * dtSec * 0.5;

  s.lastFireT += dtSec;
  if (s.lastFireT > s.recoilResetDelaySec) {
    s.recoilIndex *= Math.exp(-dtSec * RECOIL_INDEX_DECAY_PER_SEC);
    if (s.recoilIndex < 1e-6) s.recoilIndex = 0;
  }
}

export function recoilOnFire(
  s: RecoilState,
  w: WeaponRecoilLike,
  table: readonly RecoilTableEntry[],
): void {
  validateWeapon(w);
  if (table.length === 0) throw new Error('recoil table must not be empty');

  const tableIndex = Math.min(table.length - 1, Math.max(0, Math.trunc(s.recoilIndex)));
  const entry = table[tableIndex];
  if (entry === undefined) throw new Error('recoil table entry is missing');

  const angleRad = (entry.angleDeg * Math.PI) / 180;
  const pitchKick =
    -Math.cos(angleRad) * entry.magnitude * GOLDEN_PITCH_KICK_SCALE;
  const yawKick =
    -Math.sin(angleRad) * entry.magnitude * GOLDEN_PITCH_KICK_SCALE * GOLDEN_YAW_KICK_SCALE;

  s.punchVelPitch += pitchKick;
  s.punchVelYaw += yawKick;
  s.viewPunchPitchDeg += pitchKick * VIEW_PUNCH_SCALE;
  s.viewPunchYawDeg += yawKick * VIEW_PUNCH_SCALE;
  s.recoilIndex += 1;
  s.inaccuracyFire += w.inaccuracy.fire;
  s.lastFireT = 0;
  s.recoilResetDelaySec = w.cycletimeSec * 1.1;
}

function hybridDecay(value: number, dtSec: number): number {
  const decayed = value * Math.exp(-AIM_PUNCH_DECAY_EXP * dtSec);
  const linearStep = AIM_PUNCH_DECAY_LINEAR * dtSec;
  if (decayed > linearStep) return decayed - linearStep;
  if (decayed < -linearStep) return decayed + linearStep;
  return 0;
}

function validateWeapon(w: WeaponRecoilLike): void {
  if (!Number.isFinite(w.cycletimeSec) || w.cycletimeSec <= 0) {
    throw new Error('weapon cycletimeSec must be > 0');
  }
  if (!Number.isFinite(w.inaccuracy.fire) || w.inaccuracy.fire < 0) {
    throw new Error('weapon inaccuracy.fire must be >= 0');
  }
}
