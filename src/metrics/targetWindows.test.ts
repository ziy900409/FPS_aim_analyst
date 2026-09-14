import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { TickRecord } from '../data/RingBuffer.ts';
import type { ExportPayload } from '../data/export.ts';
import { buildPeekWindows } from './peekWindows.ts';
import {
  TARGET_WINDOW_FLAG_VOCABULARY,
  aliveAt,
  buildTargetWindows,
  type TargetWindow,
} from './targetWindows.ts';

const TICK_MS = 1000 / 128;

describe('WP-63 T3 — fixture A（正常 v8：3 顆並發、60 kills）', () => {
  const fixture = v8Fixture({ kills: 60 });
  const result = buildTargetWindows(fixture.payload);

  it('fixture A: 窗數 === visible 事件數（FR-63.1 不變式）', () => {
    expect(result.windows).toHaveLength(visibleCount(fixture.payload));
    expect(result.version).toBe('target-windows-v1');
  });

  it('fixture A: 每個窗的存活時間 = 該顆的真實存活時間，不被別顆的 spawn 截斷', () => {
    for (const expected of fixture.expectedWindows) {
      const window = windowById(result.windows, expected.targetId);
      expect(window.tVisibleMs, expected.targetId).toBe(expected.tVisibleMs);
      expect(window.tKillMs, expected.targetId).toBe(expected.tKillMs);
    }
  });

  it('fixture A: 窗內確實含有別顆的 visible 事件——這正是既有 peek 窗界會被截斷的地方', () => {
    const visibleTimes = fixture.payload.events
      .filter((event) => event.type === 'visible')
      .map((event) => event.t);
    const killed = result.windows.filter(isKilled);
    const straddling = killed.filter((window) =>
      visibleTimes.some((t) => t > window.tVisibleMs && t < window.tKillMs),
    );
    expect(straddling.length).toBeGreaterThan(killed.length / 2);

    // 同一份 payload 餵給既有的單目標窗界原語：它的窗被下一個（屬於別顆的）visible 截斷，
    // 故窗長嚴格短於真實存活時間。這是本 primitive 存在的理由（README §0.1 #3）。
    const peeks = buildPeekWindows(fixture.payload);
    const truncated = straddling.filter((window) => {
      const peek = peeks.find((candidate) => candidate.targetId === window.targetId);
      return peek !== undefined && peek.tEnd < window.tKillMs;
    });
    expect(truncated).toHaveLength(straddling.length);
  });

  it('fixture A: tickRange 是半開區間 [tVisible, tKill)，且 tick 時間都落在窗內', () => {
    const ticks = fixture.payload.ticks;
    for (const window of result.windows.filter(isKilled)) {
      const { start, end } = window.tickRange;
      expect(end).toBeGreaterThan(start);
      expect(ticks[start].t).toBeGreaterThanOrEqual(window.tVisibleMs);
      expect(ticks[end - 1].t).toBeLessThan(window.tKillMs);
      if (start > 0) expect(ticks[start - 1].t).toBeLessThan(window.tVisibleMs);
      if (end < ticks.length) expect(ticks[end].t).toBeGreaterThanOrEqual(window.tKillMs);
    }
  });

  it('fixture A: aliveAt 在每個擊殺時刻回 2 顆、在補位 tick 回 3 顆（FR-63.2）', () => {
    expect(aliveAt(result.windows, 0).targets).toHaveLength(3);
    for (const kill of fixture.kills) {
      const atKill = aliveAt(result.windows, kill.tKillMs);
      expect(atKill.tMs, `kill ${kill.targetId}`).toBe(kill.tKillMs);
      expect(atKill.targets.map((target) => target.targetId), `kill ${kill.targetId}`).not.toContain(
        kill.targetId,
      );
      expect(atKill.targets, `kill ${kill.targetId}`).toHaveLength(2);
      expect(aliveAt(result.windows, kill.tReplacementMs).targets, `replacement ${kill.targetId}`)
        .toHaveLength(3);
    }
  });

  it('fixture A: 存活集合帶座標，且座標來自 visible 事件而非 ticks[].tx', () => {
    const snapshot = aliveAt(result.windows, fixture.kills[10].tReplacementMs);
    for (const target of snapshot.targets) {
      const expected = fixture.positions.get(target.targetId);
      expect(target.pos, target.targetId).toEqual(expected);
    }
    // 這份 fixture 的 ticks[].tx 刻意只描述「陣列首顆」（README §0.1 #1 的形態）：三顆都拿它
    // 會全部指到同一顆。窗界原語必須讀 visible 事件才可能給出三組不同座標。
    const distinct = new Set(snapshot.targets.map((target) => JSON.stringify(target.pos)));
    expect(distinct.size).toBe(3);
  });

  it('fixture A: drill 結束仍存活的 3 顆窗仍在，並標 never_killed（不丟窗）', () => {
    const neverKilled = result.windows.filter((window) => window.tKillMs === undefined);
    expect(neverKilled).toHaveLength(3);
    for (const window of neverKilled) expect(window.flags).toContain('never_killed');
    expect(result.traceFlags).toContain('never_killed');
  });

  it('fixture A: 正常路徑不標任何資料缺失旗標', () => {
    expect(result.traceFlags).toEqual(['never_killed']);
  });
});

describe('WP-63 T3 — fixture B（never_killed：drill 結束仍有 3 顆）', () => {
  const fixture = v8Fixture({ kills: 0 });
  const result = buildTargetWindows(fixture.payload);

  it('fixture B: 窗數 === visible 事件數（FR-63.1 不變式）', () => {
    expect(result.windows).toHaveLength(visibleCount(fixture.payload));
    expect(result.windows).toHaveLength(3);
  });

  it('fixture B: 三個窗皆無 tKillMs，且窗延伸到 trace 末尾', () => {
    for (const window of result.windows) {
      expect(window.tKillMs).toBeUndefined();
      expect(window.flags).toEqual(['never_killed']);
      expect(window.tickRange).toEqual({ start: 0, end: fixture.payload.ticks.length });
    }
    expect(aliveAt(result.windows, fixture.payload.ticks.at(-1)!.t).targets).toHaveLength(3);
  });
});

describe('WP-63 T3 — fixture C（no_position：pre-WP-56 形狀的 visible 事件）', () => {
  const fixture = v8Fixture({ kills: 6, omitPositions: true });
  const result = buildTargetWindows(fixture.payload);

  it('fixture C: 窗數 === visible 事件數（FR-63.1 不變式）', () => {
    expect(result.windows).toHaveLength(visibleCount(fixture.payload));
  });

  it('fixture C: 缺座標標 no_position、pos 缺席，且不回退到 ticks[].tx（FM-1）', () => {
    for (const window of result.windows) {
      expect(window.flags, window.targetId).toContain('no_position');
      expect(window.pos, window.targetId).toBeUndefined();
      expect('pos' in window, window.targetId).toBe(false);
    }
    expect(aliveAt(result.windows, fixture.kills[0].tReplacementMs).targets).toEqual([
      { targetId: expect.any(String) },
      { targetId: expect.any(String) },
      { targetId: expect.any(String) },
    ]);
  });

  it('fixture C: 窗界本身仍然正確——缺座標不影響擊殺歸屬', () => {
    for (const kill of fixture.kills) {
      expect(windowById(result.windows, kill.targetId).tKillMs).toBe(kill.tKillMs);
    }
  });
});

describe('WP-63 T3 — 旗標詞彙表與不拋錯契約', () => {
  it('任何輸出旗標都在 TARGET_WINDOW_FLAG_VOCABULARY 內（封閉性）', () => {
    const vocabulary = new Set<string>(TARGET_WINDOW_FLAG_VOCABULARY);
    for (const fixture of [
      v8Fixture({ kills: 60 }),
      v8Fixture({ kills: 0 }),
      v8Fixture({ kills: 6, omitPositions: true }),
      v8Fixture({ kills: 4, dryMagazine: true }),
    ]) {
      const result = buildTargetWindows(fixture.payload);
      for (const window of result.windows) {
        for (const flag of window.flags) expect(vocabulary.has(flag), flag).toBe(true);
      }
      for (const flag of result.traceFlags) expect(vocabulary.has(flag), flag).toBe(true);
    }
  });

  it('空 payload、零 tick、亂序事件皆回傳結果而不拋錯', () => {
    expect(buildTargetWindows({ ticks: [], events: [] })).toEqual({
      windows: [],
      version: 'target-windows-v1',
      traceFlags: [],
    });

    const unsorted = buildTargetWindows({
      ticks: [],
      events: [
        { type: 'fire', t: 900, hit: true, firstShot: false, residualSpeed: 0, targetId: 't1' },
        { type: 'visible', targetId: 't1', side: 'R', t: 500, targetX: 1, targetY: 1.5, targetZ: -25 },
        { type: 'visible', targetId: 't0', side: 'L', t: 0, targetX: -1, targetY: 1.5, targetZ: -25 },
      ],
    });
    expect(unsorted.windows.map((window) => window.targetId)).toEqual(['t0', 't1']);
    expect(unsorted.windows[1].tKillMs).toBe(900);
    expect(unsorted.windows[0].flags).toEqual(['never_killed', 'empty_tick_range']);
  });

  it('失手的 fire 不結束窗；命中別顆的 fire 也不結束窗', () => {
    const [window] = buildTargetWindows({
      ticks: [],
      events: [
        { type: 'visible', targetId: 't0', side: 'L', t: 0, targetX: 0, targetY: 1.5, targetZ: -25 },
        { type: 'fire', t: 100, hit: false, firstShot: true, residualSpeed: 0, targetId: 't0' },
        { type: 'fire', t: 270, hit: true, firstShot: false, residualSpeed: 0, targetId: 't9' },
      ],
    }).windows;

    expect(window.tKillMs).toBeUndefined();
    expect(window.flags).toContain('never_killed');
  });

  it('同一個 id 被重複使用時，擊殺只歸屬給當次 presentation', () => {
    const { windows } = buildTargetWindows({
      ticks: [],
      events: [
        { type: 'visible', targetId: 't0', side: 'L', t: 0, targetX: 0, targetY: 1.5, targetZ: -25 },
        { type: 'fire', t: 100, hit: true, firstShot: true, residualSpeed: 0, targetId: 't0' },
        { type: 'visible', targetId: 't0', side: 'R', t: 200, targetX: 2, targetY: 1.5, targetZ: -25 },
        { type: 'fire', t: 400, hit: true, firstShot: true, residualSpeed: 0, targetId: 't0' },
      ],
    });

    expect(windows.map((window) => window.tKillMs)).toEqual([100, 400]);
    expect(windows.map((window) => window.side)).toEqual(['L', 'R']);
  });
});

describe('WP-63 T3 — ammo_exhausted_in_window（FR-63.13）', () => {
  it('窗內把彈匣打到見底時標旗標', () => {
    const fixture = v8Fixture({ kills: 4, dryMagazine: true });
    const result = buildTargetWindows(fixture.payload);
    const flagged = result.windows.filter((window) =>
      window.flags.includes('ammo_exhausted_in_window'),
    );

    expect(flagged.length).toBeGreaterThan(0);
    expect(result.traceFlags).toContain('ammo_exhausted_in_window');
  });

  it('彈匣充足的窗不標旗標；缺 ammo 欄位的匯出也不標', () => {
    expect(buildTargetWindows({
      ticks: [tickAt(0), tickAt(200)],
      events: [
        { type: 'visible', targetId: 't0', side: 'L', t: 0, targetX: 0, targetY: 1.5, targetZ: -25 },
        { type: 'fire', t: 100, hit: false, firstShot: true, residualSpeed: 0, targetId: 't0', ammo: 11 },
        { type: 'fire', t: 270, hit: true, firstShot: false, residualSpeed: 0, targetId: 't0', ammo: 10 },
      ],
    }).traceFlags).toEqual([]);

    expect(buildTargetWindows({
      ticks: [tickAt(0), tickAt(50)],
      events: [
        { type: 'visible', targetId: 't0', side: 'L', t: 0, targetX: 0, targetY: 1.5, targetZ: -25 },
        { type: 'fire', t: 100, hit: true, firstShot: true, residualSpeed: 0, targetId: 't0' },
      ],
    }).traceFlags).toEqual([]);
  });

  it('判準是「扣彈前存量觸底」而非字面的 ammo === 0（SimLoop.ts:510 記的是扣彈前的值）', () => {
    const lastRound = buildTargetWindows({
      ticks: [],
      events: [
        { type: 'visible', targetId: 't0', side: 'L', t: 0, targetX: 0, targetY: 1.5, targetZ: -25 },
        { type: 'fire', t: 100, hit: false, firstShot: true, residualSpeed: 0, targetId: 't0', ammo: 1 },
      ],
    });
    expect(lastRound.windows[0].flags).toContain('ammo_exhausted_in_window');

    // 字面的 0 在真實匯出不會出現（while gate 是 `ammo > 0`），但手工 fixture 仍須被涵蓋。
    const literalZero = buildTargetWindows({
      ticks: [],
      events: [
        { type: 'visible', targetId: 't0', side: 'L', t: 0, targetX: 0, targetY: 1.5, targetZ: -25 },
        { type: 'fire', t: 100, hit: false, firstShot: true, residualSpeed: 0, targetId: 't0', ammo: 0 },
      ],
    });
    expect(literalZero.windows[0].flags).toContain('ammo_exhausted_in_window');
  });
});

describe('WP-63 T3 — empty_tick_range', () => {
  it('窗內零 tick 時標旗標，且 tickRange 為空區間', () => {
    const { windows } = buildTargetWindows({
      ticks: [{ ...tickAt(0) }, { ...tickAt(1000) }],
      events: [
        { type: 'visible', targetId: 't0', side: 'L', t: 100, targetX: 0, targetY: 1.5, targetZ: -25 },
        { type: 'fire', t: 200, hit: true, firstShot: true, residualSpeed: 0, targetId: 't0' },
      ],
    });

    expect(windows[0].tickRange).toEqual({ start: 1, end: 1 });
    expect(windows[0].flags).toEqual(['empty_tick_range']);
  });
});

describe('WP-63 T3 — NFR-63.4：C-D4 符號掃描（窗界原語不得重寫任何幾何）', () => {
  // 掃描對象是**程式碼**不是註解（沿用 WP-60 T3 的既有教訓：註解正當地「提到」禁用符號來解釋為
  // 什麼不用它們，拿 prose 當違規會逼人把說明刪掉）。
  //
  // 掃描**大小寫敏感**：五個禁用名在各自的 canonical 實作裡就是這個拼法
  //（`trackingDerivation.ts` 的 `epsilonDeg`/`onTarget`、`eyeOrigin.ts` 的 `eyeHeight`、
  // `loop/constants.ts` 的 `SIM_TO_WORLD`、`Math.acos`）。若改成不分大小寫，`peekWindows.ts` 的
  // `WINDOW_EPSILON_MS` 會被誤判——而 T3 的 DoD 明文要求**引用**那個常數而非重新定義它。
  const code = codeOnly(
    readFileSync(fileURLToPath(new URL('./targetWindows.ts', import.meta.url)), 'utf-8'),
  );

  it('五個 canonical 幾何符號的直接出現次數為 0', () => {
    for (const symbol of ['epsilon', 'onTarget', 'eyeHeight', 'SIM_TO_WORLD', 'acos']) {
      expect(occurrences(code, symbol), symbol).toBe(0);
    }
  });

  it('不重寫任何角度／世界座標換算，也不呼叫既有 derivation', () => {
    for (const pattern of [
      /Math\.(acos|asin|atan2?|cos|sin|tan|hypot)/,
      /angularEccentricityDeg/,
      /omegaDegPerSec/,
      /resolveEyeOrigin/,
      /deriveTracking/,
      /deriveDetection/,
      /RAD_TO_DEG|DEG_TO_RAD/,
    ]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it('維持純函式：無時鐘、無隨機、無 DOM、無 three、無 node builtin', () => {
    // DOM 的 `window` 全域不能用 `/window\./` 掃——`window` 正是本模組的核心領域詞（target window），
    // 那個 pattern 會把 `window.flags` 一起打死。改成掃 DOM 專屬的成員與其他全域。
    for (const pattern of [
      /Date\.now\s*\(/,
      /performance\.now\s*\(/,
      /Math\.random\s*\(/,
      /from ['"]three/,
      /from ['"]node:/,
      /document\./,
      /(globalThis|self)\./,
      /window\.(document|location|navigator|addEventListener|requestAnimationFrame|innerWidth)/,
    ]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it('WINDOW_EPSILON_MS 為引用而非重新定義（DoD）', () => {
    expect(code).toMatch(/import \{ WINDOW_EPSILON_MS \} from '\.\/peekWindows\.ts';/);
    expect(code).not.toMatch(/const WINDOW_EPSILON_MS/);
  });
});

describe('WP-63 T3 — NFR-63.3：效能', () => {
  it('60-kill v8 匯出（63 窗、7,680 ticks）在 50 ms 內完成', () => {
    const fixture = v8Fixture({ kills: 60 });
    expect(fixture.payload.ticks.length).toBeGreaterThan(7_000);

    const started = performance.now();
    const result = buildTargetWindows(fixture.payload);
    const elapsedMs = performance.now() - started;

    expect(result.windows).toHaveLength(visibleCount(fixture.payload));
    expect(elapsedMs).toBeLessThan(50);
  });

  it('規劃期估的上界（約 180 個 visible 事件）同樣在 50 ms 內完成', () => {
    // README §0.6/NFR-63.3 寫「約 180 個 visible」；60 kills 的實際形狀是 63 個（60 擊殺 + 3 殘存）。
    // 這裡照規劃數字再壓一次，確保效能斷言涵蓋那個上界。
    const fixture = v8Fixture({ kills: 177 });
    expect(visibleCount(fixture.payload)).toBe(180);

    const started = performance.now();
    const result = buildTargetWindows(fixture.payload);
    const elapsedMs = performance.now() - started;

    expect(result.windows).toHaveLength(180);
    expect(elapsedMs).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// Fixtures：合成的 v8 形狀匯出。決定性（無 Math.random，GD-5）。
// ---------------------------------------------------------------------------

interface V8FixtureKill {
  readonly targetId: string;
  readonly tKillMs: number;
  /** 補位目標的 visible 時刻（`replacement: 'next-tick'`）。 */
  readonly tReplacementMs: number;
}

interface V8Fixture {
  readonly payload: ExportPayload & { ticks: TickRecord[] };
  readonly kills: readonly V8FixtureKill[];
  readonly expectedWindows: readonly { targetId: string; tVisibleMs: number; tKillMs?: number }[];
  readonly positions: ReadonlyMap<string, { x: number; y: number; z: number }>;
}

/**
 * 合成一份 v8 形狀的匯出：三顆同時存活、`next-tick` 補位、每次擊殺前有一發失手。
 *
 * 刻意複製兩個既有的靜默錯誤形態，好讓「窗界原語不能讀它們」成為可測的事：
 *  - `ticks[].tx/ty/tz` 只描述**陣列首顆**（README §0.1 #1）
 *  - 失手的 `fire.targetId` 也指向陣列首顆（README §0.1 #4）
 */
function v8Fixture(options: {
  kills: number;
  omitPositions?: boolean;
  dryMagazine?: boolean;
}): V8Fixture {
  const { kills: killCount, omitPositions = false, dryMagazine = false } = options;
  const events: ExportPayload['events'] = [];
  const positions = new Map<string, { x: number; y: number; z: number }>();
  const killList: V8FixtureKill[] = [];
  const expectedWindows: { targetId: string; tVisibleMs: number; tKillMs?: number }[] = [];
  const visibleAt = new Map<string, number>();
  let nextId = 0;

  const spawn = (slot: number, t: number): string => {
    const targetId = `t${nextId}`;
    const pos = synthPosition(nextId);
    nextId++;
    positions.set(targetId, pos);
    visibleAt.set(targetId, t);
    events.push({
      type: 'visible',
      targetId,
      side: slot % 2 === 0 ? 'L' : 'R',
      t,
      ...(omitPositions ? {} : { targetX: pos.x, targetY: pos.y, targetZ: pos.z }),
    });
    return targetId;
  };

  const slots = [spawn(0, 0), spawn(1, 0), spawn(2, 0)];

  for (let n = 0; n < killCount; n++) {
    const slot = n % 3;
    const targetId = slots[slot];
    // 一半的擊殺落在 tick 邊界上、一半落在 tick 之間，壓測半開區間與容差。
    const tKillMs = 1000 * (n + 1) + (n % 2 === 0 ? 0 : TICK_MS / 2);
    const tMissMs = tKillMs - 170;
    // 失手那一發帶「陣列首顆」的 targetId——README §0.1 #4 的錯誤形態。
    events.push({
      type: 'fire',
      t: tMissMs,
      hit: false,
      firstShot: true,
      residualSpeed: 0,
      targetId: slots[0],
      ammo: dryMagazine ? 2 : 11,
    });
    events.push({
      type: 'fire',
      t: tKillMs,
      hit: true,
      firstShot: false,
      residualSpeed: 0,
      targetId,
      ammo: dryMagazine ? 1 : 10,
    });
    const tReplacementMs = nextTickTimeAfter(tKillMs);
    killList.push({ targetId, tKillMs, tReplacementMs });
    expectedWindows.push({ targetId, tVisibleMs: visibleAt.get(targetId)!, tKillMs });
    slots[slot] = spawn(slot, tReplacementMs);
  }

  for (const targetId of slots) {
    expectedWindows.push({ targetId, tVisibleMs: visibleAt.get(targetId)! });
  }

  const lastEventT = events.reduce((max, event) => Math.max(max, event.t), 0);
  const tickCount = Math.ceil(lastEventT / TICK_MS) + 1;
  const ticks: TickRecord[] = [];
  for (let i = 0; i < tickCount; i++) ticks.push(tickAt(i * TICK_MS));

  return {
    payload: { meta: {} as ExportPayload['meta'], ticks, events },
    kills: killList,
    expectedWindows,
    positions,
  };
}

/**
 * `ticks[].tx/ty/tz` 一律填同一組座標——複製 `RingBuffer.recordState` 「掃到第一個 visible && alive
 * 就停」的形態（README §0.1 #1）。窗界原語若讀它，fixture A 的三顆會塌成一顆。
 */
function tickAt(t: number): TickRecord {
  return {
    t,
    vx: 0,
    vz: 0,
    px: 0,
    pz: 0,
    tx: 0,
    ty: 1.5,
    tz: -25,
    aim: { yaw: 0, pitch: 0 },
    keys: [],
    ads: false,
  };
}

function synthPosition(seed: number): { x: number; y: number; z: number } {
  return {
    x: -3 + 6 * unitFraction(3 * seed),
    y: 1.2 + 0.8 * unitFraction(3 * seed + 1),
    z: -(24 + 2 * unitFraction(3 * seed + 2)),
  };
}

/** 決定性的 [0,1) 取樣（GD-5：分析層 fixture 也不用 `Math.random()`）。 */
function unitFraction(k: number): number {
  return (((k * 2654435761) % 1000) + 1000) % 1000 / 1000;
}

function nextTickTimeAfter(t: number): number {
  return (Math.floor(t / TICK_MS) + 1) * TICK_MS;
}

function visibleCount(payload: Pick<ExportPayload, 'events'>): number {
  return payload.events.filter((event) => event.type === 'visible').length;
}

function windowById(windows: readonly TargetWindow[], targetId: string): TargetWindow {
  const window = windows.find((candidate) => candidate.targetId === targetId);
  if (window === undefined) throw new Error(`no window for ${targetId}`);
  return window;
}

function isKilled(window: TargetWindow): window is TargetWindow & { tKillMs: number } {
  return window.tKillMs !== undefined;
}

/** 去掉區塊與行註解，讓 boundary scan 只看得到程式碼。 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function occurrences(source: string, symbol: string): number {
  return source.split(symbol).length - 1;
}
