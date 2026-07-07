import { describe, expect, it } from 'vitest';
import sprayBaseline from '../golden/recoil/spray-baseline.json';
import ak47TenShotGolden from '../golden/recoil/ak47-10shot-punch.json';
import {
  canonicalSprayFrames,
  runSpray,
  sprayFrameSequences,
  type SprayBaseline,
} from './sprayDeterminismFixture.ts';

const BASELINE = sprayBaseline as SprayBaseline;
const TEN_SHOT_GOLDEN = ak47TenShotGolden as { final: { rawPunchPitchDeg: number; rawPunchYawDeg: number } };

describe('WP-17 T1 — spray punch / 彈著決定性基準', () => {
  it('canonical per-tick run matches checked-in spray baseline', () => {
    const run = runSpray(canonicalSprayFrames());

    expect(run.phase).toBe('running');
    expect(run.baseline).toEqual(BASELINE);
    expect(run.baseline.final.shots).toBe(30);
    expect(run.baseline.final.impactTotal).toBe(30);
    expect(run.baseline.final.recorderOverflow).toBe(false);
  });

  it('同 seed 重播兩次 → punch/spread/impact 序列 bit-exact', () => {
    const a = runSpray(canonicalSprayFrames()).baseline;
    const b = runSpray(canonicalSprayFrames()).baseline;

    expect(b).toEqual(a);
  });

  for (const [name, abs] of Object.entries(sprayFrameSequences)) {
    it(`${name}:出彈 tick-index keyed punch/spread/impact 序列與 canonical baseline 相同`, () => {
      const run = runSpray(abs).baseline;

      expect(run.final.ticks).toBe(BASELINE.expectedTicks);
      expect(run.shots).toEqual(BASELINE.shots);
      expect(run.final).toEqual(BASELINE.final);
    });
  }

  it('M5 golden sanity:baseline 第 10 發 rawPunch 向量可辨識', () => {
    const tenthShot = BASELINE.shots[9];

    expect(tenthShot.shot).toBe(10);
    expect(tenthShot.rawPunchPitchDeg).toBeLessThan(0);
    expect(tenthShot.rawPunchYawDeg).toBeLessThan(0);
    expect(Math.abs(tenthShot.rawPunchPitchDeg - TEN_SHOT_GOLDEN.final.rawPunchPitchDeg)).toBeLessThanOrEqual(0.25);
    expect(Math.abs(tenthShot.rawPunchYawDeg - TEN_SHOT_GOLDEN.final.rawPunchYawDeg)).toBeLessThanOrEqual(0.1);
  });
});
