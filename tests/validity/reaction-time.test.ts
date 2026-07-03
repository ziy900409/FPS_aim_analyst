import { describe, expect, it } from 'vitest';
import type { DataRecorderSnapshot, DrillEvent } from '../../src/data/DataRecorder.ts';
import { computeMetrics } from '../../src/metrics/compute.ts';

// WP-9 T2 — 計時效度驗證（FR-9.2，規格 §9.2/§14）。
//
// 兩層守護：
//   (1) 確定性驗算：餵「已知間隔」的合成事件，斷言 counterReactionMs === t_counter − t_visible，
//       且單位是 ms、基準是量測時鐘域的相對差（clock-origin 不變）。任何把秒當毫秒、
//       誤用 Date.now/frame 或搞錯基準的管線 bug 都會在此紅燈。
//   (2) 分布量級 sanity：中位數落文獻 ~150–250 ms 量級為合理（非單值硬閾，§14 受試者內相對值）；
//       系統性偏離（<50 ms 或 >1 s）即示警去查計時管線。此處以 withinReactionBand 把
//       「合理量級」的判準寫成可執行邏輯；真實遊玩樣本的中位數屬手動驗收（記於 progress.md）。

// 急停反應時間 = t_counter − t_visible（CONTEXT §急停反應時間）。合成一輪 peek：
// visible → counter（間隔 = reactionMs）→ 首發 fire（落在窗內，供 firstShot 對齊）。
interface Peek {
  visibleT: number;
  side: 'L' | 'R';
  reactionMs: number;
}

function snapshotFromPeeks(peeks: readonly Peek[]): DataRecorderSnapshot {
  const events: DrillEvent[] = [];
  peeks.forEach((peek, index) => {
    const targetId = `t${index}`;
    const counterT = peek.visibleT + peek.reactionMs;
    events.push({ type: 'visible', targetId, side: peek.side, t: peek.visibleT });
    // side R → 玩家向右移(D)後按反向鍵 A 急停；side L → 反之。key 值不影響反應時間計算。
    events.push({ type: 'counter', key: peek.side === 'R' ? 'A' : 'D', t: counterT });
    events.push({
      type: 'fire',
      targetId,
      t: counterT + 10,
      hit: true,
      firstShot: true,
      residualSpeed: 0,
      offsetDeg: 0,
    });
  });
  return { ticks: [], events, recorderOverflow: false };
}

function median(values: readonly number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// 文獻合理量級的判準（OQ-9.2）：中位數落 [lo, hi]（預設 150–250 ms）即通過 sanity。
// 這是量級檢查、非單值硬閾——用來守護「管線沒把時鐘搞爛」，不是評斷受試者。
const REACTION_BAND_MS = { lo: 150, hi: 250 } as const;
function withinReactionBand(medianMs: number, band = REACTION_BAND_MS): boolean {
  return medianMs >= band.lo && medianMs <= band.hi;
}

describe('reaction-time validity — 確定性驗算（單位/基準）', () => {
  it('counterReactionMs 精確等於餵入的已知間隔（ms）', () => {
    const metrics = computeMetrics(
      snapshotFromPeeks([
        { visibleT: 1_000, side: 'R', reactionMs: 150 },
        { visibleT: 2_000, side: 'L', reactionMs: 200 },
        { visibleT: 3_000, side: 'R', reactionMs: 250 },
      ]),
    );

    expect(metrics.counterReactionMs.values).toEqual([150, 200, 250]);
    expect(metrics.counterReactionMs.n).toBe(3);
    expect(metrics.counterReactionMs.mean).toBe(200);
  });

  it('基準為相對差：整體平移 clock origin 不改變反應時間（量測時鐘域可減性）', () => {
    const peeks: Peek[] = [
      { visibleT: 0, side: 'R', reactionMs: 180 },
      { visibleT: 500, side: 'L', reactionMs: 210 },
    ];
    const base = computeMetrics(snapshotFromPeeks(peeks));

    // performance.now() time origin 任意；只要 counter 與 visible 同源，相減後不變。
    const shifted = computeMetrics(
      snapshotFromPeeks(peeks.map((peek) => ({ ...peek, visibleT: peek.visibleT + 9_876_543 }))),
    );

    expect(shifted.counterReactionMs.values).toEqual(base.counterReactionMs.values);
    expect(shifted.counterReactionMs.values).toEqual([180, 210]);
  });

  it('左右 peek 的反應時間各自歸位（左右對稱性以反應時間為據）', () => {
    const metrics = computeMetrics(
      snapshotFromPeeks([
        { visibleT: 1_000, side: 'L', reactionMs: 190 },
        { visibleT: 2_000, side: 'R', reactionMs: 160 },
        { visibleT: 3_000, side: 'L', reactionMs: 210 },
        { visibleT: 4_000, side: 'R', reactionMs: 170 },
      ]),
    );

    expect(metrics.leftRightSymmetry.left.values).toEqual([190, 210]);
    expect(metrics.leftRightSymmetry.right.values).toEqual([160, 170]);
    expect(metrics.leftRightSymmetry.diff).toBeCloseTo(35, 6); // |200 − 165|
  });
});

describe('reaction-time validity — 分布量級 sanity（150–250 ms）', () => {
  it('文獻量級樣本的中位數落 [150, 250] ms', () => {
    const sample = [148, 162, 175, 188, 195, 205, 218, 232, 244, 251];
    const metrics = computeMetrics(
      snapshotFromPeeks(sample.map((reactionMs, i) => ({ visibleT: 1_000 * (i + 1), side: i % 2 === 0 ? 'L' : 'R', reactionMs }))),
    );

    const med = median(metrics.counterReactionMs.values ?? []);
    expect(withinReactionBand(med)).toBe(true);
  });

  it('系統性偏離示警：整體 <50 ms（如把 ms 當成別的單位）不落合理量級', () => {
    // 若計時管線被破壞（誤用 frame 計數、單位換算錯），反應時間會系統性塌到數毫秒級。
    const broken = [3, 4, 5, 6, 7];
    const med = median(broken);
    expect(withinReactionBand(med)).toBe(false);
  });

  it('系統性偏離示警：整體 >1 s（如誤植秒/毫秒）不落合理量級', () => {
    const broken = [1_100, 1_200, 1_300, 1_400, 1_500];
    const med = median(broken);
    expect(withinReactionBand(med)).toBe(false);
  });
});
