import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadDrill } from '../../src/drill/DrillLoader.ts';
import { resolveTargetHitbox, type SpiderShotYawPitchConfig } from '../../src/drill/DrillConfig.ts';
import { resolveSpiderShotWideV1 } from '../../src/drill/spider_shot_wide_v1.ts';
import { SPIDER_WIDE_DISTANCE_U, SPIDER_WIDE_HITBOX_DIAMETER_U } from '../../src/drill/spiderShotWide.ts';
import { PLAYER_EYE_HEIGHT_U } from '../../src/sim/playerEye.ts';
import { spiderWideEyePos } from '../../src/sim/spiderEyeFrame.ts';
import { CLEARANCE_MARGIN_U } from '../../src/scene/clearance.ts';
import { DEFAULT_PROCEDURAL_ROOM } from '../../src/scene/eyePose.ts';
import { validateScene, type ProceduralRoomConfig, type SceneConfig } from '../../src/scene/SceneConfig.ts';
import { wideFlickArena } from '../../src/scene/scenes/wide-flick-arena.ts';
import {
  spiderWideArenaClearance,
  spiderWideArenaExtremes,
  spiderWideTargetRadiusU,
} from '../../src/scene/spiderWideArena.ts';

/**
 * WP-57 / T3 —— README §2.5 全表逐列斷言 + FR-57.9 的負向證據。
 *
 * T0 discovery item 11：`validateClearance()` 只掃 `propBounds`,牆與地板不在其範圍。本檔是
 * 「目標穿牆／埋地板」的自動閘,先以純函式逐列釘住 §2.5 的數字,再以 `loadDrill()` 證明閘真的會擋。
 */

const FOV_DEG_LEVELS = [60, 75, 90, 120] as const;
const ASPECTS = [16 / 9, 21 / 9, 4 / 3] as const;
/** 每個 yaw/pitch 區間除端點外再取的內點比例。 */
const INTERIOR_FRACTIONS = [0.25, 0.5, 0.75] as const;

const TARGET_RADIUS_U = spiderWideTargetRadiusU(resolveTargetHitbox(resolveSpiderShotWideV1(75, 16 / 9)));
const arenaRoom = wideFlickArena.proceduralRoom!;

/** 單一落點的 hitbox AABB 對四面牆與地板的淨空（world 座標；牆面以 world 原點為中心）。 */
function landingClearanceU(
  room: ProceduralRoomConfig,
  pos: { x: number; y: number; z: number },
  radiusU: number,
): { sideWallU: number; backWallU: number; frontWallU: number; floorU: number; minU: number } {
  const [width, depth] = room.roomSize;
  const floorY = room.floorY ?? 0;
  const sideWallU = width / 2 - (Math.abs(pos.x) + radiusU);
  const backWallU = pos.z - radiusU + depth / 2;
  const frontWallU = depth / 2 - (pos.z + radiusU);
  const floorU = pos.y - radiusU - floorY;
  return { sideWallU, backWallU, frontWallU, floorU, minU: Math.min(sideWallU, backWallU, frontWallU, floorU) };
}

/** 端點 + 內點 × 左右兩側的完整落點列舉（含中心目標）。 */
function enumerateLandings(schedule: SpiderShotYawPitchConfig): Array<{ x: number; y: number; z: number }> {
  const [yawLo, yawHi] = schedule.peripheral.yawMagDegRange;
  const [pitchLo, pitchHi] = schedule.peripheral.pitchDegRange;
  const yawMags = [yawLo, yawHi, ...INTERIOR_FRACTIONS.map((f) => yawLo + f * (yawHi - yawLo))];
  const pitches = [pitchLo, pitchHi, ...INTERIOR_FRACTIONS.map((f) => pitchLo + f * (pitchHi - pitchLo))];
  const landings = [spiderWideEyePos(0, 0, schedule.distanceU)];
  for (const yawMag of yawMags) {
    for (const side of [-1, 1]) {
      for (const pitch of pitches) {
        landings.push(spiderWideEyePos(side * yawMag, pitch, schedule.distanceU));
      }
    }
  }
  return landings;
}

function sceneWithRoom(sceneId: string, room: ProceduralRoomConfig): SceneConfig {
  return validateScene({
    sceneId,
    assetPackVersion: `${sceneId}-v1`,
    clutterTier: 'low',
    asset: null,
    propBounds: [],
    playerCorridor: { halfWidthU: 0.000001 },
    proceduralRoom: room,
  });
}

describe('WP-57 T3 — 12 組（FOV × aspect）的每個落點對四牆與地板淨空 ≥ CLEARANCE_MARGIN_U', () => {
  it('端點與內點、左右兩側、含中心目標，全數通過', () => {
    let worst = { fovDegVertical: 0, aspect: 0, minU: Number.POSITIVE_INFINITY, face: '' };
    let landingCount = 0;

    for (const fovDegVertical of FOV_DEG_LEVELS) {
      for (const aspect of ASPECTS) {
        const drill = resolveSpiderShotWideV1(fovDegVertical, aspect);
        for (const pos of enumerateLandings(drill.spiderShot as SpiderShotYawPitchConfig)) {
          landingCount++;
          const c = landingClearanceU(arenaRoom, pos, TARGET_RADIUS_U);
          expect(c.minU).toBeGreaterThanOrEqual(CLEARANCE_MARGIN_U);
          if (c.minU < worst.minU) {
            const face =
              c.minU === c.sideWallU
                ? 'side'
                : c.minU === c.floorU
                  ? 'floor'
                  : c.minU === c.backWallU
                    ? 'back'
                    : 'front';
            worst = { fovDegVertical, aspect, minU: c.minU, face };
          }
        }
      }
    }

    // 12 組 × (1 中心 + 5 yaw × 2 側 × 5 pitch) = 12 × 51。
    expect(landingCount).toBe(612);
    // 全域最壞面是地板（pitch −6.5° 的下緣 0.5547），不是側牆 —— 側牆最緊是 FOV 120 的 1.3281。
    expect(worst.face).toBe('floor');
    expect(worst.minU).toBeCloseTo(0.5547, 4);
  });

  it('包絡層級的淨空與逐落點結論一致（同一判定式，不另寫一套比較）', () => {
    for (const fovDegVertical of FOV_DEG_LEVELS) {
      for (const aspect of ASPECTS) {
        const drill = resolveSpiderShotWideV1(fovDegVertical, aspect);
        const clearance = spiderWideArenaClearance(
          arenaRoom,
          drill.spiderShot as SpiderShotYawPitchConfig,
          TARGET_RADIUS_U,
        );
        expect(clearance.minU).toBeGreaterThanOrEqual(CLEARANCE_MARGIN_U);
      }
    }
  });
});

describe('WP-57 T3 — README §2.5.2 逐列', () => {
  const drill75 = resolveSpiderShotWideV1(75, 16 / 9);
  const schedule75 = drill75.spiderShot as SpiderShotYawPitchConfig;

  it('目標半徑與距離同源於 hitbox（0.139641 u @ 8 u）', () => {
    expect(TARGET_RADIUS_U).toBeCloseTo(SPIDER_WIDE_HITBOX_DIAMETER_U / 2, 12);
    expect(TARGET_RADIUS_U).toBeCloseTo(0.139641, 6);
    expect(SPIDER_WIDE_DISTANCE_U).toBe(8);
  });

  it('半寬 9 容納跨 aspect 最壞側向落點 + 目標半徑 + CLEARANCE_MARGIN_U；depth 20 ≥ 17.28', () => {
    const worstLateralU = spiderWideArenaExtremes(
      resolveSpiderShotWideV1(120, 21 / 9).spiderShot as SpiderShotYawPitchConfig,
    ).maxLateralU;
    // 表列 7.5322 是 16:9 × FOV 120；21:9 更貼邊，故半寬需求以跨 aspect 最壞值覆驗。
    expect(worstLateralU + TARGET_RADIUS_U + CLEARANCE_MARGIN_U).toBeLessThanOrEqual(arenaRoom.roomSize[0] / 2);
    expect(spiderWideArenaExtremes(schedule75).maxLateralU).toBeCloseTo(6.2725, 4);
    expect(arenaRoom.roomSize[1]).toBeGreaterThanOrEqual(17.28);
  });

  it('中心目標 (0, 1.6, −8)，對後牆間距 1.8604', () => {
    const center = spiderWideEyePos(0, 0, SPIDER_WIDE_DISTANCE_U);
    expect(center.x).toBeCloseTo(0, 12);
    expect(center.y).toBeCloseTo(PLAYER_EYE_HEIGHT_U, 12);
    expect(center.z).toBeCloseTo(-8, 12);
    expect(landingClearanceU(arenaRoom, center, TARGET_RADIUS_U).backWallU).toBeCloseTo(1.8604, 4);
  });

  it('周邊最大 yaw（16:9 × FOV 120）落在 (±7.5322, y, −2.6955)，側牆間距 1.3281', () => {
    const schedule = resolveSpiderShotWideV1(120, 16 / 9).spiderShot as SpiderShotYawPitchConfig;
    const pos = spiderWideEyePos(schedule.peripheral.yawMagDegRange[1], 0, schedule.distanceU);
    expect(pos.x).toBeCloseTo(7.5322, 4);
    expect(pos.z).toBeCloseTo(-2.6955, 4);
    expect(arenaRoom.roomSize[0] / 2 - pos.x).toBeCloseTo(1.4678, 4);
    expect(landingClearanceU(arenaRoom, pos, TARGET_RADIUS_U).sideWallU).toBeCloseTo(1.3281, 4);
  });

  it('周邊最小 yaw（16:9 × FOV 60 下界）落在 (±5.1520, y, −6.1202)，側牆間距 3.7083', () => {
    const schedule = resolveSpiderShotWideV1(60, 16 / 9).spiderShot as SpiderShotYawPitchConfig;
    const pos = spiderWideEyePos(schedule.peripheral.yawMagDegRange[0], 0, schedule.distanceU);
    expect(pos.x).toBeCloseTo(5.152, 4);
    expect(pos.z).toBeCloseTo(-6.1202, 4);
    expect(landingClearanceU(arenaRoom, pos, TARGET_RADIUS_U).sideWallU).toBeCloseTo(3.7083, 4);
  });

  it('pitch +6.5° 的 y = 2.5056、上緣 2.6453，仍低於牆上緣 4（房間無天花板）', () => {
    const top = spiderWideEyePos(0, schedule75.peripheral.pitchDegRange[1], schedule75.distanceU);
    expect(top.y).toBeCloseTo(2.5056, 4);
    expect(top.y + TARGET_RADIUS_U).toBeCloseTo(2.6453, 4);
    expect(top.y + TARGET_RADIUS_U).toBeLessThan(arenaRoom.roomSize[2]);
    expect(spiderWideArenaClearance(arenaRoom, schedule75, TARGET_RADIUS_U).wallTopU).toBeCloseTo(1.3547, 4);
  });

  it('pitch −6.5° 的 y = 0.6944、下緣 0.5547，對地板 y = 0 仍 > 0.5', () => {
    const bottom = spiderWideEyePos(0, schedule75.peripheral.pitchDegRange[0], schedule75.distanceU);
    expect(bottom.y).toBeCloseTo(0.6944, 4);
    expect(bottom.y - TARGET_RADIUS_U).toBeCloseTo(0.5547, 4);
    expect(bottom.y - TARGET_RADIUS_U).toBeGreaterThan(CLEARANCE_MARGIN_U);
    expect(arenaRoom.floorY).toBeUndefined();
  });

  it('§2.4 表的側向 abs(x)（16:9 四個 FOV 檔位的 yaw 上界）逐列相符', () => {
    const expectedLateralU = { 60: 5.515, 75: 6.273, 90: 6.831, 120: 7.532 } as const;
    for (const fovDegVertical of FOV_DEG_LEVELS) {
      const schedule = resolveSpiderShotWideV1(fovDegVertical, 16 / 9).spiderShot as SpiderShotYawPitchConfig;
      const lateralU = spiderWideEyePos(schedule.peripheral.yawMagDegRange[1], 0, schedule.distanceU).x;
      expect(lateralU).toBeCloseTo(expectedLateralU[fovDegVertical], 3);
    }
  });
});

describe('WP-57 T3 — FR-57.9 負向證據：預設 [10, 10, 3] 房間裝不下（四個 FOV 檔位皆穿側牆）', () => {
  it('16:9 下每一個 FOV 檔位的整段 yaw 窗（含 pitch 極值的內縮）都超出側牆 x = ±5', () => {
    expect(DEFAULT_PROCEDURAL_ROOM.roomSize).toEqual([10, 10, 3]);
    const halfWidthU = DEFAULT_PROCEDURAL_ROOM.roomSize[0] / 2;
    // README §2.5 的表以 pitch 0 取值；此處連同 pitch 極值造成的內縮一併覆驗（結論更強）。
    const expectedPitchZeroIntervals = {
      60: [5.152, 5.5146],
      75: [5.8986, 6.2725],
      90: [6.4674, 6.8308],
      120: [7.2318, 7.5322],
    } as const;

    for (const fovDegVertical of FOV_DEG_LEVELS) {
      const schedule = resolveSpiderShotWideV1(fovDegVertical, 16 / 9).spiderShot as SpiderShotYawPitchConfig;
      const [yawLo, yawHi] = schedule.peripheral.yawMagDegRange;
      const pitchZeroLo = spiderWideEyePos(yawLo, 0, schedule.distanceU).x;
      const pitchZeroHi = spiderWideEyePos(yawHi, 0, schedule.distanceU).x;
      expect(pitchZeroLo).toBeCloseTo(expectedPitchZeroIntervals[fovDegVertical][0], 4);
      expect(pitchZeroHi).toBeCloseTo(expectedPitchZeroIntervals[fovDegVertical][1], 4);

      const extremes = spiderWideArenaExtremes(schedule);
      expect(extremes.minLateralU).toBeGreaterThan(halfWidthU);
      const clearance = spiderWideArenaClearance(DEFAULT_PROCEDURAL_ROOM, schedule, TARGET_RADIUS_U);
      expect(clearance.sideWallU).toBeLessThan(0);
    }
  });

  it('負向證據只能建立在側牆上：牆高 3 u 放得下 pitch +6.5° 的上緣，後牆才是第二個問題', () => {
    const schedule = resolveSpiderShotWideV1(75, 16 / 9).spiderShot as SpiderShotYawPitchConfig;
    const clearance = spiderWideArenaClearance(DEFAULT_PROCEDURAL_ROOM, schedule, TARGET_RADIUS_U);
    // 牆高不是障礙（README 明列此為原規劃需更正處）。
    expect(clearance.wallTopU).toBeGreaterThan(0);
    // 但 depth 10 的後牆在 z = −5，比中心目標（z = −8）更靠近相機 ⇒ KI-012。
    expect(clearance.backWallU).toBeLessThan(0);
    expect(clearance.floorU).toBeGreaterThan(CLEARANCE_MARGIN_U);
  });
});

describe('WP-57 T3 — loadDrill 閘：裝不下就 throw，不靜默降級', () => {
  it('arena × 四個 FOV 檔位的已解析 drill 都可載入', () => {
    for (const fovDegVertical of FOV_DEG_LEVELS) {
      for (const aspect of ASPECTS) {
        expect(() => loadDrill(resolveSpiderShotWideV1(fovDegVertical, aspect), wideFlickArena)).not.toThrow();
      }
    }
  });

  it('預設房間尺寸 × 同一 drill 被擋下，錯誤訊息帶各面淨空', () => {
    // 刻意補上 `eyeZ: 0`：未補的預設房間會**先**倒在 eye anchor（fallback eyeZ = 4）上，那是另一個
    // 缺陷。補齊之後仍被擋，才證明擋下的原因是**房間尺寸**本身（FR-57.9）。
    const defaultScene = sceneWithRoom('default-room-negative', { ...DEFAULT_PROCEDURAL_ROOM, eyeZ: 0 });
    for (const fovDegVertical of FOV_DEG_LEVELS) {
      expect(() => loadDrill(resolveSpiderShotWideV1(fovDegVertical, 16 / 9), defaultScene)).toThrow(
        /wide flick arena 裝不下周邊落點/,
      );
    }
    // 未補 eyeZ 的原始預設房間同樣不可綁，只是倒在更前面的一道。
    expect(() =>
      loadDrill(resolveSpiderShotWideV1(75, 16 / 9), sceneWithRoom('default-room-raw', DEFAULT_PROCEDURAL_ROOM)),
    ).toThrow(/eye anchor mismatch/);
  });

  it('eyeHeight 與 PLAYER_EYE_HEIGHT_U 脫鉤即 throw（GD-6）', () => {
    const scene = sceneWithRoom('eye-height-mismatch', { ...arenaRoom, eyeHeight: 1.7 });
    expect(() => loadDrill(resolveSpiderShotWideV1(75, 16 / 9), scene)).toThrow(
      /eyeHeight=1.7 必須等於 PLAYER_EYE_HEIGHT_U/,
    );
  });

  it('eyeZ 不為 0（或被刪掉吃 fallback）即 throw：camera 與 sim eye 原點必須同一點', () => {
    const fallbackScene = sceneWithRoom('eye-z-fallback', {
      roomSize: arenaRoom.roomSize,
      eyeHeight: arenaRoom.eyeHeight,
      fovDeg: arenaRoom.fovDeg,
      colors: arenaRoom.colors,
      lights: arenaRoom.lights,
    });
    expect(() => loadDrill(resolveSpiderShotWideV1(75, 16 / 9), fallbackScene)).toThrow(/eye anchor mismatch/);
    const offsetScene = sceneWithRoom('eye-z-offset', { ...arenaRoom, eyeZ: 4 });
    expect(() => loadDrill(resolveSpiderShotWideV1(75, 16 / 9), offsetScene)).toThrow(/eye anchor mismatch/);
  });

  it('沒有 procedural room envelope 的場景不得綁本 drill', () => {
    const assetOnly = validateScene({
      sceneId: 'asset-only-negative',
      assetPackVersion: 'asset-only-negative-v1',
      clutterTier: 'low',
      asset: null,
      propBounds: [],
      playerCorridor: { halfWidthU: 1 },
    });
    expect(() => loadDrill(resolveSpiderShotWideV1(75, 16 / 9), assetOnly)).toThrow(/需要 procedural room envelope/);
  });

  it('既有 kind 不受本閘影響：v1 幾何 × 預設房間仍可載入', () => {
    const legacy = {
      ...resolveSpiderShotWideV1(75, 16 / 9),
      spiderShot: {
        kind: 'center-peripheral',
        seed: 1,
        centerDistanceU: 8,
        peripheral: {
          angularRadiusDegRange: [10, 25],
          azimuthDegRange: [0, 360],
          distanceURange: [8, 8],
        },
      },
    };
    expect(() => loadDrill(legacy, sceneWithRoom('legacy-ok', DEFAULT_PROCEDURAL_ROOM))).not.toThrow();
    // 連 arena 本身配上 v1 幾何也不觸發本閘（閘只認 `center-peripheral-yawpitch`）。
    expect(() => loadDrill(legacy, wideFlickArena)).not.toThrow();
  });
});

describe('WP-57 T3 — GD-6 方向性：sim 層不得反向 import 場景幾何', () => {
  it('src/sim 內沒有任何檔案 import 場景模組', () => {
    const simDir = fileURLToPath(new URL('../../src/sim/', import.meta.url));
    const offenders: string[] = [];
    for (const entry of readdirSync(simDir)) {
      if (!entry.endsWith('.ts')) continue;
      const source = readFileSync(`${simDir}${entry}`, 'utf-8');
      if (/spiderWideArena/.test(source) || /from ['"][^'"]*\/scene\//.test(source)) offenders.push(entry);
    }
    expect(offenders).toEqual([]);
  });
});
