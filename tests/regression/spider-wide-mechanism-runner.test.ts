import { describe, expect, it } from 'vitest';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';
import type { ExportPayload } from '../../src/data/export.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';
import {
  deriveSpiderWideMechanism,
  formatMechanismCsv,
  MECHANISM_CSV_COLUMNS,
  SPIDER_WIDE_DRILL_ID,
} from '../../scripts/spiderWideMechanismRunner.ts';

/**
 * `spider-shot-wide-v1` 機制層抽取器的純函式契約。
 *
 * 本檔**不**重測 `deriveSpiderShotMetrics()`／`deriveTrackingSamples()`／`buildPeekWindows()`／
 * `omegaDegPerSec()`（各有自己的測試，C-D4 單一定義）。這裡只測 runner 自己負責的四件事：
 *
 *   ① **Tier 分界** —— Tier 0 不得因 detector 失效而消失（KI-031／KI-034 的隔離）。
 *   ② **兩個新組合量** —— `brakeRetention = entryΩ / peakΩ`、`triggerMargin` 的正負號語意。
 *   ③ **KI-042 護欄** —— 輸出不得出現任何首發命中欄位。
 *   ④ **不可算寫空白** —— CSV 絕不以 0 代替 `undefined`。
 *
 * fixture 一律合成，不是真人資料（參與者匯出不進 repo）。
 */

const TICK_MS = 1000 / 128;
const COUNTDOWN_TICKS = Math.round(3000 / TICK_MS);
const EYE = { x: 0, y: 1.6, z: 0 } as const;
const DISTANCE_U = 8;
/** 2.0° @ 8 u —— 與 `spider_shot_wide_v1.ts` 同式，故命中幾何與引擎一致。 */
const HITBOX_U = 2 * DISTANCE_U * Math.tan((1 * Math.PI) / 180);

interface Spec {
  readonly yawDeg: number;
  readonly side: 'L' | 'R';
  /** 每一發：相對該次呈現起點的 tick 偏移 + 命中結果。 */
  readonly fires: readonly { readonly atTick: number; readonly hit: boolean }[];
}

function dirFor(yawDeg: number): { x: number; y: number; z: number } {
  const a = (yawDeg * Math.PI) / 180;
  return { x: Math.sin(a), y: 0, z: -Math.cos(a) };
}

function aimFor(d: { x: number; y: number; z: number }): { yaw: number; pitch: number } {
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(d.y) };
}

function pointFor(d: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  return { x: EYE.x + DISTANCE_U * d.x, y: EYE.y + DISTANCE_U * d.y, z: EYE.z + DISTANCE_U * d.z };
}

/**
 * center ↔ peripheral 交替的合法 wide 匯出。準星以**減速**曲線（ease-out）在前 `travelTicks` 內
 * 抵達目標方向：起步最快、進靶前已幾乎停住。這讓 |ω| 的峰值與進靶速度明顯分離，`brakeRetention`
 * 才是一個有內容的比值 —— 線性插值會讓兩者相等，斷言就只是在測浮點誤差。
 */
function makeWidePayload(specs: readonly Spec[], travelTicks = 10, presentationTicks = 40): ExportPayload {
  const ticks: TickRecord[] = [];
  const events: DrillEvent[] = [];
  const centre = { x: 0, y: 0, z: -1 };
  const centrePoint = pointFor(centre);

  let index = 0;
  let aim = aimFor(centre);
  const push = (
    target: { x: number; y: number; z: number } | null,
    next: { yaw: number; pitch: number },
  ): void => {
    ticks.push(
      makeTick({
        t: index * TICK_MS,
        tx: target?.x ?? null,
        ty: target?.y ?? null,
        tz: target?.z ?? null,
        aim: next,
        dYaw: next.yaw - aim.yaw,
        dPitch: next.pitch - aim.pitch,
      }),
    );
    aim = next;
    index++;
  };

  for (let i = 0; i < COUNTDOWN_TICKS; i++) push(null, aim);

  let previous = centre;
  specs.forEach((spec, n) => {
    const peripheral = dirFor(spec.yawDeg);
    for (const [zone, direction] of [['center', centre], ['peripheral', peripheral]] as const) {
      const point = zone === 'center' ? centrePoint : pointFor(direction);
      const start = index;
      events.push({
        type: 'visible',
        t: start * TICK_MS,
        targetId: `${zone === 'center' ? 'c' : 'p'}${n}`,
        side: spec.side,
        zone,
        targetX: point.x,
        targetY: point.y,
        targetZ: point.z,
      } as DrillEvent);

      const from = aimFor(previous);
      const to = aimFor(direction);
      for (let step = 0; step < presentationTicks; step++) {
        // ease-out：progress = 1 − (1 − s)³，末段每 tick 的角位移趨近 0。
        const s = Math.min(1, step / travelTicks);
        const progress = 1 - (1 - s) ** 3;
        push(point, {
          yaw: from.yaw + (to.yaw - from.yaw) * progress,
          pitch: from.pitch + (to.pitch - from.pitch) * progress,
        });
      }

      if (zone === 'peripheral') {
        spec.fires.forEach((fire, fireIndex) => {
          events.push({
            type: 'fire',
            t: (start + fire.atTick) * TICK_MS,
            hit: fire.hit,
            firstShot: fireIndex === 0,
            targetId: `p${n}`,
            offsetDeg: fire.hit ? 0.2 : 1.4,
          } as unknown as DrillEvent);
        });
      }
      previous = direction;
    }
  });

  return makePayload({
    meta: {
      drillId: SPIDER_WIDE_DRILL_ID,
      targets: { hitbox: { widthU: HITBOX_U, heightU: HITBOX_U, depthU: HITBOX_U, shape: 'sphere' } },
      scene: { eye: EYE },
    } as never,
    ticks,
    events,
  });
}

const BASELINE: readonly Spec[] = [
  // 進靶後才開火 ⇒ trigger margin 為正。
  { yawDeg: 50, side: 'R', fires: [{ atTick: 20, hit: true }] },
  // 進靶前開火、首發 miss、補槍命中 ⇒ trigger margin 為負，且是 KI-042 的分歧案例。
  { yawDeg: -50, side: 'L', fires: [{ atTick: 4, hit: false }, { atTick: 25, hit: true }] },
];

describe('spider-wide mechanism runner', () => {
  it('rejects any drill that has no peripheral presentations', () => {
    const payload = makeWidePayload(BASELINE);
    const wrong = { ...payload, meta: { ...payload.meta, drillId: 'spider_shot_v3' } } as ExportPayload;
    expect(() => deriveSpiderWideMechanism(wrong)).toThrow(/spider-shot-wide-v1/);
  });

  it('emits one row per peripheral presentation, indexed to match the research pipeline', () => {
    const summary = deriveSpiderWideMechanism(makeWidePayload(BASELINE));
    expect(summary.peripheralCount).toBe(2);
    expect(summary.rows.map((row) => row.targetId)).toEqual(['p0', 'p1']);
    expect(summary.rows.map((row) => row.presentationIndex)).toEqual([1, 2]);
    expect(summary.rows.map((row) => row.side)).toEqual(['R', 'L']);
  });

  it('keeps Tier 0 computable even where the detector produced nothing', () => {
    // The point of the tier split: reaction/movement die with the detector (KI-031/KI-034),
    // braking and trigger timing do not, because they never touch tDetectMs.
    const summary = deriveSpiderWideMechanism(makeWidePayload(BASELINE));
    for (const row of summary.rows) {
      expect(row.peakOmegaDegPerSec).toBeGreaterThan(0);
      expect(row.entryOmegaDegPerSec).toBeDefined();
      expect(row.brakeRetention).toBeDefined();
      expect(row.triggerMarginMs).toBeDefined();
    }
    const undetected = summary.rows.filter((row) => row.flags.includes('no_detection'));
    // Without this the loop below can silently become a no-op if the fixture ever starts
    // detecting every presentation, and the tier separation would stop being tested at all.
    expect(undetected.length).toBeGreaterThan(0);
    for (const row of undetected) {
      expect(row.reactionMs).toBeUndefined();
      expect(row.movementTimeMs).toBeUndefined();
      // ...while its Tier 0 neighbours survive.
      expect(row.peakOmegaDegPerSec).toBeDefined();
      expect(row.overshootDeg !== undefined || row.dropCount !== undefined).toBe(true);
    }
  });

  it('derives brake retention as the entry/peak ratio of the same angular speed series', () => {
    const summary = deriveSpiderWideMechanism(makeWidePayload(BASELINE));
    for (const row of summary.rows) {
      const { entryOmegaDegPerSec: entry, peakOmegaDegPerSec: peak, brakeRetention: brake } = row;
      expect(entry).toBeDefined();
      expect(peak).toBeDefined();
      expect(brake).toBeCloseTo(entry! / peak!, 12);
      // The fixture decelerates into the target, so entry speed is a fraction of peak. A linear
      // sweep would make these equal and the ratio would assert nothing.
      expect(entry!).toBeLessThan(peak! / 2);
      expect(brake!).toBeLessThan(0.5);
    }
  });

  it('signs the trigger margin: negative when the shot precedes first entry', () => {
    const summary = deriveSpiderWideMechanism(makeWidePayload(BASELINE));
    const [late, early] = summary.rows;
    expect(late.triggerMarginMs!).toBeGreaterThan(0);
    expect(early.triggerMarginMs!).toBeLessThan(0);
  });

  it('never reports a first-shot hit (KI-042)', () => {
    // `deriveSpiderShotMetrics().firstShot.hit` is the whole window's eventual outcome, so the
    // second presentation -- first shot missed, corrective shot hit -- would be labelled a
    // first-shot hit. This runner must not surface any such field; the research side reads the
    // fire event itself. If someone adds one, this fails.
    const summary = deriveSpiderWideMechanism(makeWidePayload(BASELINE));
    for (const row of summary.rows) {
      expect(Object.keys(row)).not.toContain('hit');
      expect(Object.keys(row).filter((key) => /hit/i.test(key))).toEqual([]);
    }
    expect(MECHANISM_CSV_COLUMNS.filter((column) => /hit/i.test(column))).toEqual([]);
  });

  it('writes blanks, never zeros, for values that could not be computed', () => {
    // A presentation with no shot has no trigger margin and no fire angle error.
    const summary = deriveSpiderWideMechanism(
      makeWidePayload([{ yawDeg: 50, side: 'R', fires: [] }]),
    );
    const csv = formatMechanismCsv([{ runId: 'run-1', summary }]);
    const [header, row] = csv.trim().split('\n');
    expect(header).toBe(MECHANISM_CSV_COLUMNS.join(','));

    const cells = Object.fromEntries(
      MECHANISM_CSV_COLUMNS.map((column, index) => [column, row.split(',')[index]]),
    );
    expect(cells.run_id).toBe('run-1');
    expect(cells.target_id).toBe('p0');
    expect(cells.trigger_margin_ms).toBe('');
    expect(cells.fire_angle_error_deg).toBe('');
    expect(cells.flags).toContain('no_first_shot');
  });
});
