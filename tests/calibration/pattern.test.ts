import { describe, expect, it } from 'vitest';
import patternFixture from '../golden/calibration/ak47-pattern.json';
import { createRecoilState, recoilOnFire, recoilTick, type RecoilState } from '../../src/recoil/punch.ts';
import { generateRecoilTable } from '../../src/recoil/recoilTable.ts';
import { ak47 } from '../../src/weapon/weapons.ts';

const RECOIL_DT_SEC = 1 / 64;
const PATTERN_TOLERANCE_DEG = 0.05;
const WALL_DISTANCE_CM = 1000;

interface PatternFixture {
  meta: {
    weapon: string;
    sourceName: string;
    unit: string;
    calibration: {
      method: string;
      requiresPixelDigitization: boolean;
    };
    comparisonMapping: {
      sourceXDeg: string;
      sourceYDeg: string;
      sampleTiming: string;
      spreadIsolation: string;
    };
  };
  shots: PatternReferenceShot[];
}

interface PatternReferenceShot {
  i: number;
  xDeg: number;
  yDeg: number;
}

interface PatternShot {
  shot: number;
  timeSec: number;
  pitchDeg: number;
  yawDeg: number;
}

interface PatternComparisonRow {
  shot: number;
  actualPitchDeg: number;
  expectedPitchDeg: number;
  deltaPitchDeg: number;
  actualYawDeg: number;
  expectedYawDeg: number;
  deltaYawDeg: number;
}

interface PatternComparisonReport {
  rows: PatternComparisonRow[];
  maxAbsDeg: number;
  max: {
    shot: number;
    axis: 'pitch' | 'yaw';
    deltaDeg: number;
  };
  meanAbsPitchDeg: number;
  meanAbsYawDeg: number;
}

describe('WP-15 T2 AK47 pattern calibration', () => {
  const fixture = patternFixture as PatternFixture;

  it('documents the external pattern fixture contract and project sign mapping', () => {
    expect(fixture.meta.weapon).toBe('ak47');
    expect(fixture.meta.sourceName).toBe('Aiming.Pro drill creator');
    expect(fixture.meta.unit).toBe('deg');
    expect(fixture.meta.calibration).toMatchObject({
      method: 'direct angular values from source UI',
      requiresPixelDigitization: false,
    });
    expect(fixture.meta.comparisonMapping).toEqual({
      sourceXDeg: 'maps to project pattern xDeg = -rawPunchYawDeg',
      sourceYDeg: 'maps to project pattern yDeg = -rawPunchPitchDeg',
      sampleTiming: 'post recoilOnFire, before the next 64Hz recoilTick; this matches patternViewer.simulatePattern',
      spreadIsolation: 'pure punch trajectory only; spread samples are not added',
    });
    expect(fixture.shots).toHaveLength(ak47.magSize);
    expect(fixture.shots.map((shot) => shot.i)).toEqual(Array.from({ length: ak47.magSize }, (_, i) => i + 1));
  });

  it('records the current RED comparison report without tuning recoil constants', () => {
    const report = compareAgainstFixture(simulatePurePunchPattern(), fixture.shots);

    expect(report.maxAbsDeg).toBeGreaterThan(PATTERN_TOLERANCE_DEG);
    expect(report.max).toMatchObject({ shot: 15, axis: 'yaw' });
    expect(report.max.deltaDeg).toBeCloseTo(3.941339466877, 12);
    expect(report.meanAbsPitchDeg).toBeCloseTo(0.391914008411, 12);
    expect(report.meanAbsYawDeg).toBeCloseTo(1.149263835184, 12);
    expect(report.rows[9]).toMatchObject({
      shot: 10,
      actualPitchDeg: 10.18,
      expectedPitchDeg: 10.123,
    });
  });

  it('converts angular offsets to centimeters on a 10m wall', () => {
    expect(angleDegToWallOffsetCm(0.38)).toBeCloseTo(6.632348403026, 12);
    expect(angleDegToWallOffsetCm(10.123)).toBeCloseTo(178.541322483966, 12);
    expect(angleDegToWallOffsetCm(11.83)).toBeCloseTo(209.457394767975, 12);
    expect(angleDegToWallOffsetCm(2.735)).toBeCloseTo(47.771044364474, 12);
  });
});

function simulatePurePunchPattern(): PatternShot[] {
  const table = generateRecoilTable(ak47.recoil);
  const state = createRecoilState();
  const shots: PatternShot[] = [];
  let elapsedSec = 0;

  for (let shot = 1; shot <= ak47.magSize; shot++) {
    const fireAtSec = (shot - 1) * ak47.cycletimeSec;
    while (elapsedSec + 1e-12 < fireAtSec) {
      recoilTick(state, RECOIL_DT_SEC);
      elapsedSec += RECOIL_DT_SEC;
    }

    recoilOnFire(state, ak47, table);
    shots.push(toPatternShot(shot, elapsedSec, state));
  }

  return shots;
}

function toPatternShot(shot: number, timeSec: number, state: RecoilState): PatternShot {
  return {
    shot,
    timeSec: round(timeSec),
    pitchDeg: round(-state.aimPunchPitchDeg * 2),
    yawDeg: round(-state.aimPunchYawDeg * 2),
  };
}

function compareAgainstFixture(actual: PatternShot[], expected: PatternReferenceShot[]): PatternComparisonReport {
  expect(actual).toHaveLength(expected.length);

  const rows: PatternComparisonRow[] = actual.map((shot, index) => {
    const reference = expected[index];
    if (!reference) throw new Error(`Missing AK47 pattern reference for shot ${shot.shot}`);
    return {
      shot: shot.shot,
      actualPitchDeg: shot.pitchDeg,
      expectedPitchDeg: reference.yDeg,
      deltaPitchDeg: round(shot.pitchDeg - reference.yDeg),
      actualYawDeg: shot.yawDeg,
      expectedYawDeg: reference.xDeg,
      deltaYawDeg: round(shot.yawDeg - reference.xDeg),
    };
  });

  let max = { shot: -1, axis: 'pitch' as const, deltaDeg: 0 };
  let totalAbsPitchDeg = 0;
  let totalAbsYawDeg = 0;

  for (const row of rows) {
    totalAbsPitchDeg += Math.abs(row.deltaPitchDeg);
    totalAbsYawDeg += Math.abs(row.deltaYawDeg);
    if (Math.abs(row.deltaPitchDeg) > Math.abs(max.deltaDeg)) {
      max = { shot: row.shot, axis: 'pitch', deltaDeg: row.deltaPitchDeg };
    }
    if (Math.abs(row.deltaYawDeg) > Math.abs(max.deltaDeg)) {
      max = { shot: row.shot, axis: 'yaw', deltaDeg: row.deltaYawDeg };
    }
  }

  return {
    rows,
    maxAbsDeg: Math.abs(max.deltaDeg),
    max,
    meanAbsPitchDeg: totalAbsPitchDeg / rows.length,
    meanAbsYawDeg: totalAbsYawDeg / rows.length,
  };
}

function angleDegToWallOffsetCm(angleDeg: number): number {
  return Math.tan((angleDeg * Math.PI) / 180) * WALL_DISTANCE_CM;
}

function round(value: number): number {
  return Number(value.toFixed(12));
}
