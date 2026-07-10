import { describe, expect, it } from 'vitest';
import {
  createImpactRing,
  createSharedState,
  IMPACT_CAP,
  pushImpact,
  resetImpactRing,
  resetState,
  sharedState,
} from './SharedState.ts';
import { pushEvent } from './inputRingTestUtil.ts';

describe('SharedState — 三迴圈溝通管道（型別 + 單例）', () => {
  it('createSharedState 回傳全零的獨立實例', () => {
    const a = createSharedState();
    expect(a.player).toEqual({ vx: 0, vz: 0, x: 0, z: 0, stopped: false });
    expect(a.heldFire).toBe(false);
    expect(a.weapon).toEqual({ nextFireT: Infinity, ammo: 30, magSize: 30 });
    expect(a.prev).toEqual({ x: 0, z: 0 });
    expect(a.curr).toEqual({ x: 0, z: 0 });
    expect(a.crosshair).toEqual({ cx: 0, cy: 0 });
    expect(a.aim).toEqual({ yaw: 0, pitch: 0 });
    expect(a.input.size()).toBe(0);
    expect(a.targets).toHaveLength(0);
    expect(a.tVisible.size).toBe(0);
    expect(a.validity).toEqual({ playerCorridorExceeded: false });

    // 實例彼此獨立、且不污染單例
    const b = createSharedState();
    b.player.x = 5;
    expect(a.player.x).toBe(0);
    expect(sharedState.player.x).toBe(0);
  });

  it('單例存在且導出穩定（同一物件參考）', () => {
    expect(sharedState).toBeDefined();
    expect(sharedState).toBe(sharedState);
  });

  it('resetState 原地清空緩衝與快照，並重用既有物件/陣列（GC 紀律）', () => {
    const s = createSharedState();
    const inputRef = s.input;
    const playerRef = s.player;
    const prevRef = s.prev;
    const weaponRef = s.weapon;
    const targetsRef = s.targets;
    const tVisibleRef = s.tVisible;
    const recoilStateRef = s.recoilState;
    const impactsRef = s.impacts;
    const validityRef = s.validity;

    // 弄髒所有欄位
    pushEvent(s, { type: 'fire', down: true, t: 1 });
    s.heldFire = true;
    s.weapon.nextFireT = 123;
    s.weapon.magSize = 20;
    s.weapon.ammo = 4;
    s.player.vx = 250;
    s.player.x = 12;
    s.player.z = -3;
    s.prev.x = 1;
    s.curr.z = 2;
    s.crosshair.cx = 9;
    s.crosshair.cy = -9;
    s.aim.yaw = 0.3;
    s.aim.pitch = -0.2;
    s.recoilState.aimPunchPitchDeg = -5;
    s.recoilState.punchVelYaw = 2;
    s.recoilState.recoilIndex = 7;
    s.recoil.prev.pitchDeg = -1;
    s.recoil.curr.yawDeg = 0.4;
    s.recoil.lastSpread.x = 0.01;
    pushImpact(s.impacts, 1, 2, 3);
    pushImpact(s.impacts, 4, 5, 6);
    s.targets.push({
      id: 't1',
      side: 'R',
      pos: { x: 0, y: 1, z: 8 },
      visible: true,
      alive: true,
      hitbox: { width: 1, height: 2, depth: 1 },
    });
    s.tVisible.set('t1', 123.4);
    s.validity.playerCorridorExceeded = true;

    resetState(s);

    expect(s.input.size()).toBe(0);
    expect(s.player).toEqual({ vx: 0, vz: 0, x: 0, z: 0, stopped: false });
    expect(s.heldFire).toBe(false);
    expect(s.weapon).toEqual({ nextFireT: Infinity, ammo: 20, magSize: 20 });
    expect(s.prev).toEqual({ x: 0, z: 0 });
    expect(s.curr).toEqual({ x: 0, z: 0 });
    expect(s.crosshair).toEqual({ cx: 0, cy: 0 });
    expect(s.aim).toEqual({ yaw: 0, pitch: 0 });
    expect(s.targets).toHaveLength(0);
    expect(s.tVisible.size).toBe(0);
    expect(s.validity).toEqual({ playerCorridorExceeded: false });

    // recoil 狀態機 + 視覺快照 + spread 暫存原地歸零（WP-13 / T1）
    expect(s.recoilState.aimPunchPitchDeg).toBe(0);
    expect(s.recoilState.punchVelYaw).toBe(0);
    expect(s.recoilState.recoilIndex).toBe(0);
    expect(s.recoil.prev).toEqual({ pitchDeg: 0, yawDeg: 0 });
    expect(s.recoil.curr).toEqual({ pitchDeg: 0, yawDeg: 0 });
    expect(s.recoil.lastSpread).toEqual({ x: 0, y: 0 });

    // 彈著格原地清空（WP-13 / T3）：total/cursor 歸零、seq 全清為空槽
    expect(s.impacts.total).toBe(0);
    expect(s.impacts.cursor).toBe(0);
    expect(Array.from(s.impacts.seq)).toEqual(new Array(IMPACT_CAP).fill(0));

    // 重用同一參考（不 realloc）— GC 紀律
    expect(s.input).toBe(inputRef);
    expect(s.player).toBe(playerRef);
    expect(s.prev).toBe(prevRef);
    expect(s.weapon).toBe(weaponRef);
    expect(s.targets).toBe(targetsRef);
    expect(s.tVisible).toBe(tVisibleRef);
    expect(s.recoilState).toBe(recoilStateRef); // recoil 狀態機重用同一物件（GC 紀律）
    expect(s.impacts).toBe(impactsRef); // 彈著格重用同一物件 + typed-array（GC 紀律）
    expect(s.validity).toBe(validityRef);
  });

  it('heldAds 初始 false，resetState 歸零（WP-24 / T1：不跨 drill 汙染）', () => {
    const s = createSharedState();
    expect(s.heldAds).toBe(false);
    s.heldAds = true;
    resetState(s);
    expect(s.heldAds).toBe(false);
  });

  it('resetState() 預設作用於單例', () => {
    sharedState.player.x = 99;
    pushEvent(sharedState, { type: 'key', code: 'KeyD', down: true, t: 0 });
    resetState();
    expect(sharedState.player.x).toBe(0);
    expect(sharedState.input.size()).toBe(0);
  });
});

describe('ImpactRing — 彈著環形格（WP-13 / T3）', () => {
  it('createImpactRing 全空：total/cursor 0、seq 全 0、typed-array 容量 = IMPACT_CAP', () => {
    const r = createImpactRing();
    expect(r.total).toBe(0);
    expect(r.cursor).toBe(0);
    expect(r.x).toHaveLength(IMPACT_CAP);
    expect(r.seq).toHaveLength(IMPACT_CAP);
    expect(Array.from(r.seq)).toEqual(new Array(IMPACT_CAP).fill(0));
  });

  it('pushImpact 就地寫 x/y/z、蓋單調 seq（1 起）、推進游標', () => {
    const r = createImpactRing();
    pushImpact(r, 1, 2, 3);
    pushImpact(r, 4, 5, 6);

    expect(r.total).toBe(2);
    expect(r.cursor).toBe(2);
    expect([r.x[0], r.y[0], r.z[0]]).toEqual([1, 2, 3]);
    expect([r.x[1], r.y[1], r.z[1]]).toEqual([4, 5, 6]);
    expect(r.seq[0]).toBe(1);
    expect(r.seq[1]).toBe(2);
  });

  it('溢位 → 環狀覆寫最舊槽（游標繞回、seq 遞增使舊槽被判為新彈著）', () => {
    const r = createImpactRing();
    // 寫滿 CAP 發：slot i 的 seq = i+1。
    for (let i = 0; i < IMPACT_CAP; i++) pushImpact(r, i, 0, 0);
    expect(r.total).toBe(IMPACT_CAP);
    expect(r.cursor).toBe(0); // 繞回
    expect(r.seq[0]).toBe(1);

    // 第 CAP+1 發覆寫 slot 0（最舊），seq 變 CAP+1。
    pushImpact(r, 999, 0, 0);
    expect(r.total).toBe(IMPACT_CAP + 1);
    expect(r.cursor).toBe(1);
    expect(r.x[0]).toBe(999);
    expect(r.seq[0]).toBe(IMPACT_CAP + 1); // 舊槽獲更大 seq → render 端判為新彈著
  });

  it('resetImpactRing 原地清空：total/cursor 0、seq 全清、重用同一 typed-array', () => {
    const r = createImpactRing();
    const xRef = r.x;
    const seqRef = r.seq;
    pushImpact(r, 1, 2, 3);

    resetImpactRing(r);

    expect(r.total).toBe(0);
    expect(r.cursor).toBe(0);
    expect(Array.from(r.seq)).toEqual(new Array(IMPACT_CAP).fill(0));
    expect(r.x).toBe(xRef); // 不 realloc（GC 紀律）
    expect(r.seq).toBe(seqRef);
  });
});
