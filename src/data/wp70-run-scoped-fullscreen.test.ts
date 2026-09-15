import { describe, expect, it } from 'vitest';
import { createDrillRunner } from '../drill/DrillRunner.ts';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import { createSharedState, resetState } from '../state/SharedState.ts';
import { collectMeta, type CollectMetaArgs } from './metadata.ts';
import { parseExportPayload } from './exportPayloadSchema.ts';

/**
 * WP-70 / T1（FR-70.1～70.4）— fullscreen suspect 成分的效力單位由 session 級 sticky 改為 **run**。
 *
 * 作法逐字比照 WP-65 T5 的 `pointerLockLostDuringRun`：DOM 事件寫 `SharedState`、`resetState()`
 * 每場歸零、`collectMeta()` 唯讀（ADR-2 的單向路徑）。本檔把那條鏈的**每一個接縫**各釘一次：
 *
 * 1. `SharedState` 層：欄位存在、初值 false、`resetState()` 歸零。
 * 2. **跨 run 不繼承**（FR-70.1 的核心）：以**真的** `DrillRunner.start()` 驅動，不是直接呼叫
 *    `resetState()` —— 缺陷 A 的修復點就在「每場的歸零點是否真的接上」。
 * 3. **run 內未被放寬**：同一場內置真後，跑完整場到 `ended` 仍為真。README §3 的風險分析要求這條
 *    反方向證據：本 WP 唯一該放寬的是「上一場污染這一場」，不是「這一場的偵測」。
 * 4. **端到端旗標 → 匯出**（FM-70.2）：`meta.validity.fullscreenExited` 與 `meta.suspect` 同時為真。
 *    只測 SharedState 會漏掉 `main.ts` 那個**逐欄手抄**的 `validity` 物件，而那正是會靜默失效的地方。
 * 5. schema round-trip 三條（帶旗標／缺席預設 false／非布林拒絕）。
 * 6. `main.ts` source-scan：手抄點存在、`recording` 判準只有一套、`experimentSession.suspect`
 *    不再出現在 export 路徑（FM-70.1）。
 */

const META_BASE: CollectMetaArgs = {
  drillId: 'counterstrafe_ad_v1',
  backend: 'webgpu',
  displayHz: 144,
  sensitivity: 1,
  crossOriginIsolated: true,
  startedAt: '2026-09-15T10:00:00.000Z',
};

const CLEAN_VALIDITY = {
  corridorExceeded: false,
  perfFloor: false,
  recorderOverflow: false,
  bufferOverflow: false,
  pointerLockLost: false,
  pauseOccurred: false,
} as const;

function makeConfig(): DrillConfig {
  return {
    drillId: 'test_ad_v1',
    targets: { count: 3, distance: 4 },
    sequence: { alternation: 'LR' },
    timing: { countdownMs: 1000 },
    endCondition: { type: 'targetCount', value: 3 },
  };
}

describe('WP-70 T1 — SharedState 的 per-run fullscreen 旗標', () => {
  it('初值為 false 且與 pointerLockLostDuringRun 並列於同一個 validity 物件', () => {
    const state = createSharedState();
    expect(state.validity.fullscreenExitedDuringRun).toBe(false);
    // 固定佈局（NFR-70.3）：新欄位是既有 validity 物件的一個欄位，不是另一個容器。
    expect(Object.keys(state.validity).sort()).toEqual([
      'fullscreenExitedDuringRun',
      'playerCorridorExceeded',
      'pointerLockLostDuringRun',
    ]);
  });

  it('resetState() 每場歸零（比照 pointerLockLostDuringRun）', () => {
    const state = createSharedState();
    state.validity.fullscreenExitedDuringRun = true;
    resetState(state);
    expect(state.validity.fullscreenExitedDuringRun).toBe(false);
  });
});

describe('WP-70 T1 — 跨 run 不繼承（FR-70.1）', () => {
  it('run N 錄製中退出全螢幕 → DrillRunner.start() 起的 run N+1 旗標為 false', () => {
    const config = makeConfig();
    const state = createSharedState();
    const runner = createDrillRunner(state, createTargetManager(config));

    runner.start(config);
    // run N：錄製中掉出全螢幕（main.ts 的 fullscreenchange 處理器會寫的那一行）。
    state.validity.fullscreenExitedDuringRun = true;

    // run N+1 —— 這是缺陷 A 的修復點：舊語意下 `experimentSession.suspect` 永不復位，
    // 這一場會繼承上一場的失效。
    runner.start(config);
    expect(state.validity.fullscreenExitedDuringRun).toBe(false);
  });

  it('乾淨的 run N+1 匯出的 suspect 為 false（不繼承上一場的失效）', () => {
    const config = makeConfig();
    const state = createSharedState();
    const runner = createDrillRunner(state, createTargetManager(config));

    runner.start(config);
    state.validity.fullscreenExitedDuringRun = true;
    runner.start(config);

    const meta = collectMeta({
      ...META_BASE,
      validity: { ...CLEAN_VALIDITY, fullscreenExited: state.validity.fullscreenExitedDuringRun },
    });
    expect(meta.validity?.fullscreenExited).toBe(false);
    expect(meta.suspect).toBe(false);
  });
});

describe('WP-70 T1 — run 內的偵測未被放寬（README §3 的反方向證據）', () => {
  it('同一場內置真後，drill 一路跑到 ended 仍為真', () => {
    const config = makeConfig();
    const state = createSharedState();
    const tm = createTargetManager(config);
    const runner = createDrillRunner(state, tm);

    runner.start(config);
    state.validity.fullscreenExitedDuringRun = true;

    // 跑完整場（countdown → running → ended）：期間沒有第二個 start()，旗標不得被任何人清掉。
    for (let tick = 0; tick < 600 && runner.phase !== 'ended'; tick += 1) {
      runner.tick(state, (tick * 1000) / 128); // sim clock 域的毫秒（128Hz 步長）
      const active = state.targets.find((target) => target.alive);
      if (active) tm.markKilled(state, active.id);
    }

    expect(runner.phase).toBe('ended');
    expect(state.validity.fullscreenExitedDuringRun).toBe(true);
  });
});

describe('WP-70 T1 — 端到端：旗標 → 匯出（FM-70.2）', () => {
  it('旗標為真 ⇒ meta.validity.fullscreenExited 與 meta.suspect 皆為真', () => {
    const meta = collectMeta({ ...META_BASE, validity: { ...CLEAN_VALIDITY, fullscreenExited: true } });
    expect(meta.validity?.fullscreenExited).toBe(true);
    // 退出全螢幕 = GD-10 的顯示條件在錄製中失效，性質同 perfFloor ⇒ 併入 suspect。
    expect(meta.suspect).toBe(true);
  });

  it('旗標為假且無其他失效 ⇒ 兩者皆為假（一個每場都亮的旗標等於沒有旗標）', () => {
    const meta = collectMeta({ ...META_BASE, validity: { ...CLEAN_VALIDITY, fullscreenExited: false } });
    expect(meta.validity?.fullscreenExited).toBe(false);
    expect(meta.suspect).toBe(false);
  });

  it('與 pointerLockLost 是兩個構念（Esc 同時觸發，視窗切換只觸發本欄）', () => {
    const lockOnly = collectMeta({ ...META_BASE, validity: { ...CLEAN_VALIDITY, pointerLockLost: true } });
    expect(lockOnly.validity?.fullscreenExited).toBe(false);
    expect(lockOnly.validity?.pointerLockLost).toBe(true);

    const fullscreenOnly = collectMeta({ ...META_BASE, validity: { ...CLEAN_VALIDITY, fullscreenExited: true } });
    expect(fullscreenOnly.validity?.fullscreenExited).toBe(true);
    expect(fullscreenOnly.validity?.pointerLockLost).toBe(false);
  });

  it('collectMeta 缺欄補 false（optional-in / required-out，承 D-65-3）', () => {
    const meta = collectMeta({
      ...META_BASE,
      validity: { corridorExceeded: false, perfFloor: false, recorderOverflow: false, bufferOverflow: false },
    });
    expect(meta.validity?.fullscreenExited).toBe(false);
  });

  it('collectMeta 拒絕非布林的 validity.fullscreenExited', () => {
    expect(() =>
      collectMeta({
        ...META_BASE,
        validity: { ...CLEAN_VALIDITY, fullscreenExited: 'yes' as unknown as boolean },
      }),
    ).toThrow('validity.fullscreenExited must be a boolean');
  });
});

describe('WP-70 T1 — export payload schema round-trip（FR-70.3）', () => {
  function payloadWithValidity(validity: Record<string, unknown>): unknown {
    return {
      meta: {
        schemaVersion: 2,
        drillId: 'counterstrafe_ad_v1',
        weaponId: 'hitscan_test_v1',
        weaponSeed: 1,
        rngSeed: 1,
        backend: 'webgpu',
        displayHz: 144,
        simHz: 128,
        browser: 'chromium',
        sensitivity: 1,
        sensitivityModel: 'cs2-0.022deg',
        movementModel: 'cs2-source',
        crossOriginIsolated: true,
        startedAt: '2026-09-15T10:00:00.000Z',
        unit: 'source',
        vStrafe: 250,
        maxDrillSeconds: 60,
        lateEventCount: 0,
        bufferOverflow: false,
        recorderOverflow: false,
        suspect: false,
        simToWorld: 1,
        validity,
      },
      ticks: [],
      events: [],
    };
  }

  it('帶 fullscreenExited: true 的 payload 解析後保留為 true', () => {
    const result = parseExportPayload(payloadWithValidity({ ...CLEAN_VALIDITY, fullscreenExited: true }));
    if (!result.ok) throw new Error('expected ok, got ' + JSON.stringify(result.errors));
    expect(result.payload.meta.validity?.fullscreenExited).toBe(true);
  });

  it('缺席 fullscreenExited 的舊 payload 解析為 false（optional-in，schemaVersion 維持 2）', () => {
    const result = parseExportPayload(
      payloadWithValidity({
        corridorExceeded: false,
        perfFloor: false,
        recorderOverflow: false,
        bufferOverflow: false,
      }),
    );
    if (!result.ok) throw new Error('expected ok, got ' + JSON.stringify(result.errors));
    expect(result.payload.meta.validity?.fullscreenExited).toBe(false);
    expect(result.payload.meta.schemaVersion).toBe(2);
  });

  it('非布林的 fullscreenExited 被拒（optional-in 不等於 lenient-in）', () => {
    const result = parseExportPayload(payloadWithValidity({ ...CLEAN_VALIDITY, fullscreenExited: 1 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.path === 'meta.validity.fullscreenExited')).toBe(true);
  });
});

/**
 * `main.ts` 不可 import（top-level await + WebGPU），所以鏈路的兩端（DOM 事件寫入點、`collectMeta()`
 * 的逐欄手抄點）以 source-scan 釘住 —— 沿用 WP-69 T4 的技術。
 */
describe('WP-70 T1 — main.ts 的接線（source-scan）', () => {
  const raw = import.meta.glob<string>('../main.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })['../main.ts']!;
  /** 先剝註解：`main.ts` 的散文正當地寫著它所描述的符號名，逐字掃原文會把註解當成程式碼。 */
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  it('collectMeta 的 validity 逐欄手抄有帶上新旗標（FM-70.2）', () => {
    expect(source).toContain('fullscreenExited: sharedState.validity.fullscreenExitedDuringRun');
  });

  it('fullscreenchange 處理器沿用同一個 recording 判準，不另開第二套（C-D4）', () => {
    const start = source.indexOf("document.addEventListener('fullscreenchange'");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('\n});', start));
    expect(body).toContain('sharedState.validity.fullscreenExitedDuringRun = true');
    // 判準只在這個 handler 裡算一次；旗標寫入必須讀那個 const，不得重算一份 phase 比較。
    expect(body.match(/drillRunner\.phase === 'countdown'/g) ?? []).toHaveLength(1);
    expect(body).toMatch(/if \(!fullscreen && recording\)/);
  });

  it('export 路徑不再讀 experimentSession.suspect（FM-70.1）', () => {
    expect(source).not.toContain('experimentSession.suspect');
  });
});
