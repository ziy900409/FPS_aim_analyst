import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../../../src/data/export.ts';
import { angularEccentricityDeg, resolveEyeOrigin } from '../../../src/metrics/eyeOrigin.ts';
import { resolveEyeWorldBase } from '../../../src/scene/eyePose.ts';
import { fieldLow } from '../../../src/scene/scenes/field-low.ts';

/**
 * KI-004 / S1 T4 — 閘 ①(`fire.offsetDeg` oracle)。`offsetDeg` 是引擎開火當下用**真實 camera**
 * 算出的準心 → 目標中心夾角(SimLoop.ts `targetCenterOffsetDeg`),與離線 ε(t) 是同一構念、不同
 * 實作路徑、不同資料來源 —— 此閘若早存在,D2a(遺漏 camera base offset)與 D2b(遺漏 SIM_TO_WORLD)
 * 第一天就會被抓到。
 *
 * 兩份真實 fixture 是 pre-S1 匯出(刻意不補 meta.scene.eye / meta.simToWorld,見 T2 S1-D9),故
 * 這裡以顯式 eyeBase(= `resolveEyeWorldBase(fieldLow)`)呼叫 `resolveEyeOrigin` —— 這同時讓
 * `'explicit'` 分支與「pre-S1 相容路徑」持續受測。
 */

const TOLERANCE_DEG = 0.5;

const FIXTURES = [
  'counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json',
  'counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json',
] as const;

describe('KI-004 / S1 T4 — gate ①: fire.offsetDeg oracle', () => {
  for (const fixture of FIXTURES) {
    it(`|ε(tick_at_fire) − fire.offsetDeg| ≤ ${TOLERANCE_DEG}° for all punch-free fires in ${fixture}`, () => {
      const payload = loadFixture(fixture);
      const eyeOrigin = resolveEyeOrigin(payload, { eyeBase: resolveEyeWorldBase(fieldLow) });

      const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
      const visibleEvents = payload.events
        .filter((event): event is Extract<ExportPayload['events'][number], { type: 'visible' }> => event.type === 'visible')
        .sort((a, b) => a.t - b.t);
      const qualifyingFires = payload.events.filter(
        (event): event is Extract<ExportPayload['events'][number], { type: 'fire' }> =>
          event.type === 'fire' &&
          event.offsetDeg !== undefined &&
          (event.aimPunchPitch ?? 0) === 0 &&
          (event.aimPunchYaw ?? 0) === 0,
      );

      // 防空跑假綠(README §2.5):篩選條件寫死導致合格 fire 數為 0 必須失敗,而非靜默通過。
      expect(qualifyingFires.length).toBeGreaterThan(0);

      const errors: number[] = [];
      for (const fire of qualifyingFires) {
        const tick = argminByAbsDelta(ticks, fire.t);
        const target = resolveFireTarget(tick, fire.targetId, visibleEvents, fire.t);
        const epsilonDeg = angularEccentricityDeg(tick, target, eyeOrigin);
        errors.push(Math.abs(epsilonDeg - (fire.offsetDeg as number)));
      }

      // eslint-disable-next-line no-console
      console.log(
        `${fixture}: n=${errors.length}, median=${median(errors).toFixed(3)}°, max=${Math.max(...errors).toFixed(3)}°`,
      );
      for (const error of errors) {
        expect(error).toBeLessThanOrEqual(TOLERANCE_DEG);
      }
    });
  }
});

function loadFixture(filename: string): ExportPayload {
  const filePath = path.join(__dirname, '../../../research/fixtures/exports', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as ExportPayload;
}

function argminByAbsDelta(ticks: readonly ExportPayload['ticks'][number][], t: number): ExportPayload['ticks'][number] {
  let best = ticks[0];
  let bestDelta = Math.abs(ticks[0].t - t);
  for (const tick of ticks) {
    const delta = Math.abs(tick.t - t);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = tick;
    }
  }
  return best;
}

function resolveFireTarget(
  tick: ExportPayload['ticks'][number],
  targetId: string | undefined,
  visibleEvents: readonly Extract<ExportPayload['events'][number], { type: 'visible' }>[],
  fireT: number,
): { x: number; y: number; z: number } {
  if (tick.tx !== null && tick.ty !== null && tick.tz !== null) {
    return { x: tick.tx, y: tick.ty, z: tick.tz };
  }
  const visible = visibleEvents.filter((event) => event.targetId === targetId && event.t <= fireT).pop();
  if (visible === undefined) throw new Error(`gate ①: no target position resolvable for fire at t=${fireT}`);
  return { x: visible.targetX as number, y: visible.targetY as number, z: visible.targetZ as number };
}

function median(values: readonly number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
