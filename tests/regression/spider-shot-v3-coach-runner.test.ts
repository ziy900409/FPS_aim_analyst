import { describe, expect, it } from 'vitest';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';
import type { ExportPayload } from '../../src/data/export.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';
import {
  buildSpiderShotV3CoachReport,
  CEILING_HIT_RATE,
  MIN_BIN_N,
  MIN_ROLLING_TRIALS,
  MIN_TAIL_N,
  PROTOCOL_SCORING_WINDOW_MS,
  __testing,
} from '../../scripts/spiderShotV3CoachRunner.ts';
import {
  renderBinCsv,
  renderCoachReportHtml,
  renderPresentationCsv,
  renderRunCsv,
  __testing as renderTesting,
} from '../../scripts/spiderShotV3CoachReport.ts';

/**
 * stage14 —— `analyze:spider-v3` 的純函式契約。
 *
 * 本檔**不**重測 `deriveSpiderShotTransitions()`／`deriveSpiderShotMetrics()`／
 * `deriveDetectionMetrics()`／`computePhaseMetrics()`／`buildPeekWindows()`（各有自己的測試,
 * C-D4 單一定義）。這裡測的是 runner 與 renderer 自己的六件事：
 *
 *   ① **首發一律走 `firstFire`** —— 首發 miss、補槍命中的窗不得被算成首發命中（HANDOFF §3.3 ①）。
 *   ② **左右一律走 eye-frame `side`** —— `visible.side` 是佔位值,不得用它分箱（HANDOFF §3.3 ②）。
 *   ③ **n 閘與降級** —— n < 8 不下結論、有效樣本 < 10 不畫 p95、呈現數 < 24 不畫滾動窗。
 *   ④ **兩個分母同時報** —— registry 的 `validDurationMs` 與協定的 60.0 s（G2）。
 *   ⑤ **registry 失敗要點名前提** —— `projection-failed` 這個 catch-all 之外要說出缺了什麼（KI-036）。
 *   ⑥ **渲染層不得說出資料不支持的話** —— 沒有 MDC、沒有基準、誠實邊界逐條在場。
 *
 * fixture 一律**合成**,不是真人資料（參與者匯出不進 repo）。
 */

// ---------------------------------------------------------------------------
// 合成 v3 payload
// ---------------------------------------------------------------------------

const TICK_MS = 1000 / 128;
const COUNTDOWN_MS = 3000;
const TICKS_PER_PRESENTATION = 40;
const EYE = { x: 0, y: 1.6, z: 0 } as const;
const DISTANCE_U = 8;
/** 2.0° @ 8 u —— 與 `spider_shot_v3.ts` 的推導同式,故 `angularSizeDeg` 會落在 2.0。 */
const HITBOX_U = 2 * DISTANCE_U * Math.tan((2 / 2) * (Math.PI / 180));

interface PeripheralSpec {
  /** 角半徑（度）—— 即該次抵達的 `D_deg`。 */
  readonly radiusDeg: number;
  /** 方位角（度）,0 = 正上、90 = 正右、270 = 正左（與 `quadrantForPeripheral` 同一參考）。 */
  readonly azimuthDeg: number;
  /** 該窗的開火序列。第一發即 `firstShot`。 */
  readonly fires: readonly { readonly hit: boolean }[];
}

function directionFor(radiusDeg: number, azimuthDeg: number): { x: number; y: number; z: number } {
  const r = (radiusDeg * Math.PI) / 180;
  const a = (azimuthDeg * Math.PI) / 180;
  // forward = (0,0,-1)、right = (1,0,0)、up = (0,1,0);azimuth 自 up 起算、朝 right 為正。
  return {
    x: Math.sin(r) * Math.sin(a),
    y: Math.sin(r) * Math.cos(a),
    z: -Math.cos(r),
  };
}

function aimFor(direction: { x: number; y: number; z: number }): { yaw: number; pitch: number } {
  return { yaw: Math.atan2(-direction.x, -direction.z), pitch: Math.asin(direction.y) };
}

function pointFor(direction: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  return {
    x: EYE.x + DISTANCE_U * direction.x,
    y: EYE.y + DISTANCE_U * direction.y,
    z: EYE.z + DISTANCE_U * direction.z,
  };
}

/**
 * 產生一份形狀合法的 `spider-shot-v3` 匯出：center/peripheral 交替、eye-frame 幾何、128 Hz tick、
 * 開場 3 秒倒數。準星在每次呈現的前半段由前一個方向線性插值到抵達方向（讓 `ω(t)` 有主彈道段,
 * `phase-v1` 才有 REC/MR/V 可算）。
 */
function makeV3Payload(args: {
  readonly peripherals: readonly PeripheralSpec[];
  readonly meta?: Record<string, unknown>;
}): ExportPayload {
  const ticks: TickRecord[] = [];
  const events: DrillEvent[] = [];
  const centreDirection = { x: 0, y: 0, z: -1 };
  const centrePoint = pointFor(centreDirection);

  let tickIndex = 0;
  const pushTick = (target: { x: number; y: number; z: number } | null, aim: { yaw: number; pitch: number }, previousAim: { yaw: number; pitch: number }): void => {
    ticks.push(
      makeTick({
        t: tickIndex * TICK_MS,
        tx: target?.x ?? null,
        ty: target?.y ?? null,
        tz: target?.z ?? null,
        aim,
        dYaw: aim.yaw - previousAim.yaw,
        dPitch: aim.pitch - previousAim.pitch,
      }),
    );
    tickIndex++;
  };

  let aim = aimFor(centreDirection);
  for (let i = 0; i < Math.round(COUNTDOWN_MS / TICK_MS); i++) pushTick(null, aim, aim);

  let previousDirection = centreDirection;
  args.peripherals.forEach((spec, index) => {
    const peripheralDirection = directionFor(spec.radiusDeg, spec.azimuthDeg);

    for (const [zone, direction, point] of [
      ['center', centreDirection, centrePoint] as const,
      ['peripheral', peripheralDirection, pointFor(peripheralDirection)] as const,
    ]) {
      const targetId = `${zone === 'center' ? 'c' : 'p'}${index}`;
      events.push({
        type: 'visible',
        t: tickIndex * TICK_MS,
        targetId,
        // 佔位值 —— v3 的引擎對每個周邊呈現都寫 'R'。測試 ② 依賴這一點。
        side: 'R',
        zone,
        targetX: point.x,
        targetY: point.y,
        targetZ: point.z,
      } as DrillEvent);

      const from = aimFor(previousDirection);
      const to = aimFor(direction);
      const travelTicks = 12;
      for (let step = 0; step < TICKS_PER_PRESENTATION; step++) {
        const progress = Math.min(1, step / travelTicks);
        const previousAim = aim;
        aim = { yaw: from.yaw + (to.yaw - from.yaw) * progress, pitch: from.pitch + (to.pitch - from.pitch) * progress };
        pushTick(point, aim, previousAim);
      }

      if (zone === 'peripheral') {
        spec.fires.forEach((fire, fireIndex) => {
          events.push({
            type: 'fire',
            // 開火落在抵達段的後半,確保它在該窗的 tickRange 內。
            t: (tickIndex - TICKS_PER_PRESENTATION + 20 + fireIndex * 4) * TICK_MS,
            targetId,
            hit: fire.hit,
            firstShot: fireIndex === 0,
            residualSpeed: 0,
          } as DrillEvent);
        });
      }
      previousDirection = direction;
    }
  });

  return makePayload({
    meta: {
      drillId: 'spider-shot-v3',
      weaponId: 'usp_s_laser',
      displayHz: 240,
      simHz: 128,
      sensitivity: 1.4,
      fovDeg: 75,
      movementModel: 'cs2-source',
      simToWorld: 0.01,
      startedAt: '2026-09-09T14:42:09.086Z',
      assessment: { protocolVersion: 'spider-shot-v3@1.0.0', assessmentFeedbackPolicy: 'minimal-end-of-block' },
      protocolGuard: { noMovement: true },
      validity: { corridorExceeded: false, perfFloor: false, recorderOverflow: false, bufferOverflow: false },
      targets: { hitbox: { widthU: HITBOX_U, heightU: HITBOX_U, depthU: HITBOX_U, shape: 'sphere' } },
      scene: { sceneId: 'spider-shot-room', assetPackVersion: 'spider-shot-room-v1', clutterTier: 'low', fallback: false, eye: EYE },
      spawn: {
        seed: 260827,
        spiderShot: {
          kind: 'center-peripheral-eye-stratified',
          seed: 260827,
          centerDistanceU: DISTANCE_U,
          peripheral: { angularRadiusDegRange: [10, 25], azimuthDegRange: [0, 360], distanceURange: [DISTANCE_U, DISTANCE_U] },
          grid: { azimuthQuadrants: 4, radiusTiers: 3 },
          centerExemptFromTimeout: true,
          targetAngularDiameterDeg: 2,
        },
      },
      mouseIntegration: { model: 'tick-window-integral', radPerCount: 0.0003839724354387525, hipStep: 0.0005, adsStep: 0.0005 },
      ...args.meta,
    } as never,
    ticks,
    events,
  });
}

/** 一組 n ≥ 24 的周邊呈現,四個方位分箱與三個幅度 tier 都填得到。 */
function standardPeripherals(count: number, hitPattern: (index: number) => readonly { hit: boolean }[]): PeripheralSpec[] {
  // 90 → 水平·右、270 → 水平·左、20 → 近垂直·右、340 → 近垂直·左。
  const azimuths = [90, 270, 20, 340];
  const radii = [12, 17, 22];
  return Array.from({ length: count }, (_unused, index) => ({
    radiusDeg: radii[index % radii.length],
    azimuthDeg: azimuths[index % azimuths.length],
    fires: hitPattern(index),
  }));
}

const ALL_FIRST_SHOT_HITS = () => [{ hit: true }];

function report(payload: ExportPayload, sourcePath = 'run.json') {
  return buildSpiderShotV3CoachReport([{ sourcePath, payload }]);
}

// ---------------------------------------------------------------------------
// ① 首發一律走 firstFire
// ---------------------------------------------------------------------------

describe('首發命中 —— 補槍不得灌水', () => {
  it('counts a missed first shot rescued by a refire as a first-shot MISS', () => {
    const payload = makeV3Payload({
      peripherals: [
        // 首發 miss、第二發命中 ⇒ `PeekWindowTs.outcome` 會是 'hit',但首發不是。
        { radiusDeg: 12, azimuthDeg: 90, fires: [{ hit: false }, { hit: true }] },
        { radiusDeg: 17, azimuthDeg: 270, fires: [{ hit: true }] },
      ],
    });

    const rows = report(payload).rows;

    expect(rows).toHaveLength(2);
    expect(rows[0].firstShotHit).toBe(false);
    expect(rows[0].fireCount).toBe(2);
    // 該窗**確實**命中（補槍）—— 命中時間有值,但首發沒有。這兩件事必須分得開。
    expect(rows[0].hitTimeMs).toBeDefined();
    expect(rows[1].firstShotHit).toBe(true);

    const speed = report(payload).runs[0].effectiveSpeed;
    expect(speed.firstShotHitCount).toBe(1);
    expect(speed.peripheralHitCount).toBe(2);
    // 補槍依賴 = 總命中速度 − 首發有效速度 > 0,正是 M1 要量的東西。
    expect(speed.refireGapPerMinProtocol).toBeGreaterThan(0);
  });

  it('counts a window with no shot at all as a first-shot miss, and flags it separately', () => {
    const payload = makeV3Payload({ peripherals: [{ radiusDeg: 12, azimuthDeg: 90, fires: [] }] });
    const rows = report(payload).rows;

    expect(rows[0].firstShotHit).toBe(false);
    expect(rows[0].noFirstShot).toBe(true);
    expect(rows[0].fireCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ② 左右一律走 eye-frame side
// ---------------------------------------------------------------------------

describe('方位分箱 —— 不得使用 visible.side 佔位值', () => {
  it('bins by eye-frame side even though every visible.side is the placeholder R', () => {
    const payload = makeV3Payload({
      peripherals: [
        { radiusDeg: 12, azimuthDeg: 90, fires: ALL_FIRST_SHOT_HITS() }, // 水平 · 右
        { radiusDeg: 12, azimuthDeg: 270, fires: ALL_FIRST_SHOT_HITS() }, // 水平 · 左
        { radiusDeg: 12, azimuthDeg: 20, fires: ALL_FIRST_SHOT_HITS() }, // 近垂直 · 右
        { radiusDeg: 12, azimuthDeg: 340, fires: ALL_FIRST_SHOT_HITS() }, // 近垂直 · 左
      ],
    });

    const built = report(payload);
    // 每個周邊 visible 事件的 side 都是 'R' —— 若分箱讀它,四箱會塌成一箱。
    expect(built.runs[0].quality.rawSideDistinctValues).toBe(1);
    expect(built.rows.map((row) => row.azimuthBin)).toEqual([
      'horizontal-R',
      'horizontal-L',
      'vertical-R',
      'vertical-L',
    ]);
    expect(built.rows.map((row) => row.side)).toEqual(['R', 'L', 'R', 'L']);
  });

  it('names the placeholder side channel as an overturned design assumption', () => {
    const built = report(makeV3Payload({ peripherals: standardPeripherals(4, ALL_FIRST_SHOT_HITS) }));
    expect(built.overturned.some((entry) => entry.includes('`visible.side` 對 v3 是佔位值'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ③ n 閘與降級
// ---------------------------------------------------------------------------

describe('n 閘與降級', () => {
  it('marks bins under the n threshold as not conclusive', () => {
    const built = report(makeV3Payload({ peripherals: standardPeripherals(4, ALL_FIRST_SHOT_HITS) }));
    const bins = built.runs[0].azimuthBins;

    expect(bins.every((bin) => bin.n < MIN_BIN_N)).toBe(true);
    expect(bins.every((bin) => !bin.conclusive)).toBe(true);
  });

  it('refuses p95 below the tail threshold but still reports n and p50', () => {
    const built = report(makeV3Payload({ peripherals: standardPeripherals(4, ALL_FIRST_SHOT_HITS) }));
    const hitTime = built.runs[0].tails.find((tail) => tail.key === 'hit-time');

    expect(hitTime).toBeDefined();
    expect(hitTime!.n).toBeLessThan(MIN_TAIL_N);
    expect(hitTime!.drawable).toBe(false);
    expect(hitTime!.p95).toBeUndefined();
    expect(hitTime!.ratio).toBeUndefined();
    expect(hitTime!.p50).toBeDefined();
  });

  it('refuses the rolling window below the trial threshold', () => {
    const few = report(makeV3Payload({ peripherals: standardPeripherals(6, ALL_FIRST_SHOT_HITS) }));
    expect(few.runs[0].rollingDrawable).toBe(false);
    expect(few.runs[0].rolling).toEqual([]);

    const many = report(makeV3Payload({ peripherals: standardPeripherals(MIN_ROLLING_TRIALS, ALL_FIRST_SHOT_HITS) }));
    expect(many.runs[0].rollingDrawable).toBe(true);
    expect(many.runs[0].rolling.length).toBeGreaterThan(0);
  });

  it('refuses a Fitts fit when fewer than three amplitude tiers carry a hit time', () => {
    // 全部落在同一個 tier ⇒ 只有一個點,擬合必須拒絕而不是硬畫一條線。
    const built = report(
      makeV3Payload({
        peripherals: Array.from({ length: 6 }, () => ({ radiusDeg: 12, azimuthDeg: 90, fires: ALL_FIRST_SHOT_HITS() })),
      }),
    );

    expect(built.runs[0].fitts.drawable).toBe(false);
    expect(built.runs[0].fitts.reason).toContain('幅度 tier');
    expect(built.runs[0].fitts.slopeMsPerBit).toBeUndefined();
  });

  it('flags the ceiling effect once most conclusive bins sit at the top', () => {
    const built = report(makeV3Payload({ peripherals: standardPeripherals(48, ALL_FIRST_SHOT_HITS) }));
    const conclusive = built.runs[0].azimuthBins.filter((bin) => bin.conclusive);

    expect(conclusive.length).toBeGreaterThan(0);
    expect(conclusive.every((bin) => bin.firstShotHitRate >= CEILING_HIT_RATE)).toBe(true);
    expect(built.overturned.some((entry) => entry.includes('撞天花板'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ④ 兩個分母
// ---------------------------------------------------------------------------

describe('G2 —— 兩個分母同時報', () => {
  it('reports the registry denominator and the protocol window side by side', () => {
    const built = report(makeV3Payload({ peripherals: standardPeripherals(8, ALL_FIRST_SHOT_HITS) }));
    const speed = built.runs[0].effectiveSpeed;
    const quality = built.runs[0].quality;

    expect(speed.protocolDurationMs).toBe(PROTOCOL_SCORING_WINDOW_MS);
    expect(speed.measuredDurationMs).toBeCloseTo(quality.tickSpanMs, 9);
    expect(speed.denominatorInflation).toBeCloseTo(quality.tickSpanMs / PROTOCOL_SCORING_WINDOW_MS - 1, 9);
    // 兩個分母 ⇒ 兩個速率,而且它們不相等。
    expect(speed.firstShotEffectivePerMinProtocol).not.toBeCloseTo(speed.firstShotEffectivePerMinMeasured, 6);
    expect(speed.firstShotEffectivePerMinProtocol).toBeCloseTo(
      (60000 * speed.firstShotHitCount) / PROTOCOL_SCORING_WINDOW_MS,
      9,
    );
  });

  it('places the countdown inside the measured denominator but outside the scoring numerator', () => {
    const built = report(makeV3Payload({ peripherals: standardPeripherals(8, ALL_FIRST_SHOT_HITS) }));
    // 第一個 visible 落在倒數之後 —— 倒數的 tick 在分母裡,分子一發都沒有。
    expect(built.runs[0].quality.firstVisibleOffsetMs).toBeCloseTo(COUNTDOWN_MS, 6);
    expect(built.gates.find((gate) => gate.id === 'G2')?.degradations.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ⑤ registry 失敗要點名前提
// ---------------------------------------------------------------------------

describe('registry —— catch-all 之外要說出缺了什麼', () => {
  it('names the missing participant id rather than only "projection-failed"', () => {
    const built = report(makeV3Payload({ peripherals: standardPeripherals(4, ALL_FIRST_SHOT_HITS) }));
    const registry = built.runs[0].registry;

    expect(registry.status).toBe('invalid-metric');
    expect(registry.reasonCode).toBe('projection-failed');
    expect(registry.diagnosis).toContain('meta.session.participantId');
    // 指標本身仍算得出來 —— 進不了趨勢的是 metadata,不是指標。
    expect(registry.observations.length).toBeGreaterThan(0);
    expect(registry.observations.map((observation) => observation.metricId)).toContain(
      'spider-v3.peripheral-first-shot-hit-rate',
    );
  });

  it('reaches ready once the participant id is present', () => {
    const built = report(
      makeV3Payload({
        peripherals: standardPeripherals(4, ALL_FIRST_SHOT_HITS),
        meta: { session: { participantId: 'P01' } },
      }),
    );

    expect(built.runs[0].registry.status).toBe('ready');
    expect(built.runs[0].registry.diagnosis).toBeUndefined();
    expect(built.runs[0].registry.conditionCell).toContain('spider-v3:frame=eye-v1');
  });
});

// ---------------------------------------------------------------------------
// G4 —— 序列比對
// ---------------------------------------------------------------------------

describe('G4 —— 同一序列的重複必須被認出來', () => {
  it('detects a bit-identical stimulus prefix across repeats of the same schedule', () => {
    const specs = standardPeripherals(6, ALL_FIRST_SHOT_HITS);
    const built = buildSpiderShotV3CoachReport([
      { sourcePath: 'rep1.json', payload: makeV3Payload({ peripherals: specs }) },
      { sourcePath: 'rep2.json', payload: makeV3Payload({ peripherals: [...specs, ...standardPeripherals(2, ALL_FIRST_SHOT_HITS)] }) },
    ]);

    expect(built.sequence.identical).toBe(true);
    expect(built.sequence.commonPeripheralPrefix).toBe(6);
    expect(built.sequence.perRunPeripheralCount).toEqual([6, 8]);
    // rep 比較一律限制在共同前綴內。
    expect(built.repTrend.map((row) => row.n)).toEqual([6, 6]);
    expect(built.gates.find((gate) => gate.id === 'G4')?.verdict).toContain('確認');
  });

  it('reports a genuinely different schedule as not identical', () => {
    const built = buildSpiderShotV3CoachReport([
      { sourcePath: 'a.json', payload: makeV3Payload({ peripherals: standardPeripherals(4, ALL_FIRST_SHOT_HITS) }) },
      {
        sourcePath: 'b.json',
        payload: makeV3Payload({
          peripherals: [{ radiusDeg: 24, azimuthDeg: 135, fires: ALL_FIRST_SHOT_HITS() }, ...standardPeripherals(3, ALL_FIRST_SHOT_HITS)],
        }),
      },
    ]);

    expect(built.sequence.identical).toBe(false);
    expect(built.sequence.commonPeripheralPrefix).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 分箱邊界 / 小工具
// ---------------------------------------------------------------------------

describe('分箱邊界由匯出決定,不是寫死的字面值', () => {
  it('derives tier edges from the exported schedule', () => {
    const payload = makeV3Payload({ peripherals: standardPeripherals(3, ALL_FIRST_SHOT_HITS) });
    expect(__testing.resolveTierEdges(payload)).toEqual([10, 15, 20, 25]);
    expect(__testing.tierKeys([10, 15, 20, 25])).toEqual(['10–15', '15–20', '20–25']);
  });

  it('honours a different tier count without touching the code', () => {
    const payload = makeV3Payload({
      peripherals: standardPeripherals(3, ALL_FIRST_SHOT_HITS),
      meta: {
        spawn: {
          seed: 260827,
          spiderShot: {
            kind: 'center-peripheral-eye-stratified',
            seed: 260827,
            centerDistanceU: DISTANCE_U,
            peripheral: { angularRadiusDegRange: [10, 30], azimuthDegRange: [0, 360], distanceURange: [DISTANCE_U, DISTANCE_U] },
            grid: { azimuthQuadrants: 4, radiusTiers: 4 },
            centerExemptFromTimeout: true,
            targetAngularDiameterDeg: 2,
          },
        },
      },
    });

    expect(__testing.resolveTierEdges(payload)).toEqual([10, 15, 20, 25, 30]);
  });

  it('puts a value on the upper edge into the higher tier and the top value into the last tier', () => {
    const edges = [10, 15, 20, 25];
    expect(__testing.tierKeyFor(10, edges)).toBe('10–15');
    expect(__testing.tierKeyFor(14.999, edges)).toBe('10–15');
    expect(__testing.tierKeyFor(15, edges)).toBe('15–20');
    expect(__testing.tierKeyFor(25, edges)).toBe('20–25');
  });

  it('classifies azimuth bins only when the eye-frame side exists', () => {
    expect(__testing.azimuthBinFor('horizontal', 'R')).toBe('horizontal-R');
    expect(__testing.azimuthBinFor('vertical', 'L')).toBe('vertical-L');
    // side 缺席（抵達點的 x 恰為 0）與 oblique 都不猜,一律 unclassified。
    expect(__testing.azimuthBinFor('vertical', undefined)).toBe('unclassified');
    expect(__testing.azimuthBinFor('oblique', 'R')).toBe('unclassified');
  });
});

// ---------------------------------------------------------------------------
// ⑥ 渲染層
// ---------------------------------------------------------------------------

describe('渲染層 —— 不得說出資料不支持的話', () => {
  const built = buildSpiderShotV3CoachReport([
    { sourcePath: 'rep1.json', payload: makeV3Payload({ peripherals: standardPeripherals(MIN_ROLLING_TRIALS, ALL_FIRST_SHOT_HITS) }) },
    { sourcePath: 'rep2.json', payload: makeV3Payload({ peripherals: standardPeripherals(MIN_ROLLING_TRIALS, ALL_FIRST_SHOT_HITS) }) },
  ]);
  const html = renderCoachReportHtml(built);

  it('never claims an MDC value, and says out loud that the range is not one', () => {
    expect(html).toContain('三場全距');
    expect(html).toContain('不是 MDC');
    // 教練提案示例圖裡的「雜訊帶 ±2.0（MDC）」那類宣稱一個都不可以出現。
    expect(html).not.toMatch(/雜訊帶\s*±/);
    expect(html).not.toMatch(/MDC\s*[（(]最小可偵測變化/);
  });

  it('prints every honesty statement, one list item each', () => {
    const list = html.match(/<ol class="honesty">([\s\S]*?)<\/ol>/)?.[1] ?? '';
    expect(list.match(/<li>/g) ?? []).toHaveLength(built.honesty.length);
    expect(built.honesty).toHaveLength(8);
    // 八條的骨幹必須在場 —— 逐字比對會被 Markdown → HTML 的標記轉換擋掉,所以比對不含標記的片段。
    for (const fragment of [
      '位受試者',
      '沒有絕對門檻',
      '同一刺激序列的重複',
      '同一天連續錄製',
      '無方向',
      '不是神經反應時間',
      '不呈現 cm/360',
      'hits/min 的絕對值被低估',
    ]) {
      expect(html).toContain(fragment);
    }
  });

  it('prints every gate verdict and every degradation', () => {
    for (const gate of built.gates) {
      expect(html).toContain(gate.id);
      for (const degradation of gate.degradations) {
        expect(html).toContain(degradation.replaceAll('**', '').replaceAll('`', '').slice(0, 10));
      }
    }
  });

  it('gives every figure a table view', () => {
    const figures = html.match(/<figure class="viz">/g)?.length ?? 0;
    const tables = html.match(/<details class="viz-table">/g)?.length ?? 0;
    expect(figures).toBeGreaterThanOrEqual(7);
    expect(tables).toBe(figures);
  });

  it('declares both theme scopes for the chart palette tokens', () => {
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain(':root[data-theme="dark"] .viz-root');
    // 系列上限 3 —— 第 4 個 slot 在 all-pairs 下過不了門檻。
    expect(html).toContain('--series-3: #1baf7a');
    expect(html).not.toContain('--series-4');
  });

  it('escapes data before it reaches the page', () => {
    expect(renderTesting.escapeHtml('<script>&"')).toBe('&lt;script&gt;&amp;&quot;');
    // 先跳脫再換標記,否則資料裡的 < 會變成標籤。
    expect(renderTesting.inline('**粗** `code` <b>')).toBe('<strong>粗</strong> <code>code</code> &lt;b&gt;');
  });

  it('emits one CSV row per presentation and per run', () => {
    const presentations = renderPresentationCsv(built).trim().split('\n');
    expect(presentations).toHaveLength(built.rows.length + 1);

    const runs = renderRunCsv(built).trim().split('\n');
    expect(runs).toHaveLength(built.runs.length + 1);

    const bins = renderBinCsv(built).trim().split('\n');
    const expected = built.runs.reduce((sum, run) => sum + run.azimuthBins.length + run.tierBins.length, 0);
    expect(bins).toHaveLength(expected + 1);
  });

  it('leaves a missing value empty in CSV rather than writing 0', () => {
    const noShot = buildSpiderShotV3CoachReport([
      { sourcePath: 'x.json', payload: makeV3Payload({ peripherals: [{ radiusDeg: 12, azimuthDeg: 90, fires: [] }] }) },
    ]);
    const [, row] = renderPresentationCsv(noShot).trim().split('\n');
    const cells = row.split(',');

    // hit_time_ms 欄（index 14）必須是空字串,不是 0 —— 「沒量到」與「量到 0」必須分得開。
    expect(cells[14]).toBe('');
  });
});
