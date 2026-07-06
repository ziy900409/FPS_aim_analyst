import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createSharedState, type SharedState } from '../../state/SharedState.ts';
import type { TargetManager } from '../../sim/TargetManager.ts';
import type { TargetState } from '../../state/types.ts';
import { SIM_HZ } from '../constants.ts';
import { simStep } from '../SimLoop.ts';
import { punchToThreeRad } from '../../recoil/adapter.ts';

/**
 * WP-13 / T2 — 視覺/彈道分離的命中判準（miss/hit 補償）
 *
 * 彈道 = `state.aim` + rawPunch(=aimPunch×2, adapter 轉 rad)。故 punch 已知時：
 *   - 準心**照原視角**對準目標 → 彈道被 punch 拉偏 → **miss**；
 *   - 視角**補償 −rawPunch** 後 → 彈道回正對準 → **hit**。
 * 這是「視覺 ≠ 實際」在 sim 命中層的直接後果,也是 QA「打得準卻打不中」的設計來源。
 * 為隔離 spread 噪音:不接 recoilRuntime（lastSpread 恆 0、不施 decay/kick,aimPunch 由測試直接設）。
 */

const TICK_MS = 1000 / SIM_HZ;

/** 遠距 + 小 hitbox → 角度容差小,使數度的 rawPunch 偏移足以 miss。 */
function farTarget(): TargetState {
  return {
    id: 't0',
    side: 'R',
    pos: { x: 0, y: 0, z: -100 },
    visible: true,
    alive: true,
    hitbox: { width: 0.5, height: 0.5, depth: 0.5, part: 'body' },
  };
}

/** camera 立於原點朝 −Z（與 state.aim yaw=pitch=0 同朝向）。 */
function cameraAtOrigin(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  cam.position.set(0, 0, 0);
  cam.lookAt(0, 0, -1);
  cam.updateMatrixWorld(true);
  return cam;
}

/** markKilled 只在命中時被呼叫 → killed 陣列即命中判定。 */
function killTracker(): { killed: string[]; tm: TargetManager } {
  const killed: string[] = [];
  const tm: TargetManager = {
    tick() {},
    markKilled(_s, id) {
      killed.push(id);
    },
    reset() {},
  };
  return { killed, tm };
}

/** 產一發：heldFire + nextFireT=0,本 tick(無 recoilRuntime → 不 decay/spread)產 1 發彈道判定。 */
function fireOnce(state: SharedState, cam: THREE.PerspectiveCamera, tm: TargetManager): void {
  state.heldFire = true;
  state.weapon.nextFireT = 0;
  simStep(state, 1 / SIM_HZ, TICK_MS, tm, cam, undefined, undefined, undefined, undefined);
}

describe('WP-13 / T2 — 彈道 = viewAngles + rawPunch（miss/hit 補償）', () => {
  it('punch=0、準心對準 → hit（退化為中心射線,向後相容）', () => {
    const state = createSharedState();
    state.targets.push(farTarget());
    const { killed, tm } = killTracker();

    fireOnce(state, cameraAtOrigin(), tm);

    expect(killed).toEqual(['t0']);
  });

  it('punch≠0、準心照原視角對準 → 彈道被 rawPunch 拉偏 → miss', () => {
    const state = createSharedState();
    state.targets.push(farTarget());
    // 上跳 + 右漂 punch（Source deg：pitch 下正故上跳為負、yaw 左正故向右為負）。
    state.recoilState.aimPunchPitchDeg = -3;
    state.recoilState.aimPunchYawDeg = -1;
    // state.aim = {0,0}（準心仍照原視角對準目標中心）。
    const { killed, tm } = killTracker();

    fireOnce(state, cameraAtOrigin(), tm);

    expect(killed).toEqual([]); // 彈道上跳右漂,遠距小 hitbox → 落空
  });

  it('punch≠0、視角補償 −rawPunch → 彈道回正 → hit', () => {
    const state = createSharedState();
    state.targets.push(farTarget());
    state.recoilState.aimPunchPitchDeg = -3;
    state.recoilState.aimPunchYawDeg = -1;
    // 補償：state.aim = −rawPunch(three rad),使 ballistic yaw/pitch 抵銷後回正對準。
    const raw = punchToThreeRad(state.recoilState.aimPunchPitchDeg * 2, state.recoilState.aimPunchYawDeg * 2);
    state.aim.yaw = -raw.yawRad;
    state.aim.pitch = -raw.pitchRad;
    const { killed, tm } = killTracker();

    fireOnce(state, cameraAtOrigin(), tm);

    expect(killed).toEqual(['t0']);
  });

  it('rawPunch = aimPunch×2（視覺兩倍）：補償僅 aimPunch×1 仍不足 → miss', () => {
    const state = createSharedState();
    state.targets.push(farTarget());
    state.recoilState.aimPunchPitchDeg = -3;
    state.recoilState.aimPunchYawDeg = -1;
    // 只補償視覺量（×1）→ 殘餘 ×1 偏移仍在 → 遠距 miss（證彈道確實用 ×2 而非 ×1）。
    const visual = punchToThreeRad(state.recoilState.aimPunchPitchDeg, state.recoilState.aimPunchYawDeg);
    state.aim.yaw = -visual.yawRad;
    state.aim.pitch = -visual.pitchRad;
    const { killed, tm } = killTracker();

    fireOnce(state, cameraAtOrigin(), tm);

    expect(killed).toEqual([]);
  });
});
