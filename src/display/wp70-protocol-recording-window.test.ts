import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDrillRunner } from '../drill/DrillRunner.ts';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import { createSharedState } from '../state/SharedState.ts';
import { createProtocolRunner, type ProtocolConfig } from './ProtocolRunner.ts';

/**
 * WP-70 / T2（FR-70.5）— protocol 路徑補上 KI-007 的錄製窗判準。
 *
 * ⚠️ 方向與 T1 **相反**：T1 放寬（跨 run 不繼承），本 task **收緊**（protocol 路徑本來漏判）。
 *
 * 修正前的 `main.ts` `fullscreenchange` 處理器：
 *
 * ```ts
 * const recording = drillRunner.phase === 'countdown' || drillRunner.phase === 'running';
 * experimentSession.handleFullscreenChange(fullscreen, recording); // ← 有 recording 閘
 * if (!fullscreen && recording) sharedState.validity.fullscreenExitedDuringRun = true; // ← 有
 * if (!fullscreen) markProtocolFullscreenExit?.();                                     // ← 沒有
 * ```
 *
 * ⇒ drill 之間（`idle`）與收工後（`ended`）退出全螢幕也會把 protocol 的**當前 condition** 標成
 * suspect —— 而 KI-007 當初引入 `recording` 判準正是為了避免這種誤判，只是沒套到這條路徑上。
 * 同一個構念（KI-007 錄製窗）有兩套行為 = C-D4 禁止的第二定義。
 *
 * 本檔的兩層證據：
 *
 * 1. **行為層（成對）**：rig 以**真的** `DrillRunner`（相位由 `start()`/`tick()` 真實推進，不是手塞
 *    字串）+ **真的** `ProtocolRunner` 驅動。`idle`/`ended` 不標記、`countdown`/`running` 仍標記；
 *    缺任一半，另一半在 rig 沒跑起來時也會綠。
 * 2. **source-scan parity pin**：rig 的分派是 production 兩行的逐字副本，由 `PRODUCTION_DISPATCH`
 *    釘住。production 漂移（例如有人把閘拿掉求綠燈，FM-70.5）⇒ parity 測試紅，行為層的結論隨即
 *    失去授權。這是本檔唯一容許「複製判準」的地方，且**明帳**：複製品被證明與正本同文。
 */

/** `main.ts` 的 `fullscreenchange` 處理器內，兩個 sink 共用同一個 `recording` const 的逐字分派。 */
const PRODUCTION_DISPATCH = {
  recording: "const recording = drillRunner.phase === 'countdown' || drillRunner.phase === 'running';",
  runFlag: 'if (!fullscreen && recording) sharedState.validity.fullscreenExitedDuringRun = true;',
  protocol: 'if (!fullscreen && recording) markProtocolFullscreenExit?.();',
} as const;

const PROTOCOL: ProtocolConfig = {
  protocolId: 'resolution_detection_v1',
  requiredDisplay: { minW: 2560, minH: 1440 },
  conditions: [
    { label: 'fhd', mode: 'fhd-1080', sceneId: 'field-low', drillId: 'detection_popin_v1' },
    { label: 'qhd', mode: 'qhd-1440', sceneId: 'field-low', drillId: 'detection_popin_v1' },
  ],
};

function makeDrillConfig(): DrillConfig {
  return {
    drillId: 'test_ad_v1',
    targets: { count: 3, distance: 4 },
    sequence: { alternation: 'LR' },
    timing: { countdownMs: 1000 },
    endCondition: { type: 'targetCount', value: 3 },
  };
}

function createRig() {
  const drillConfig = makeDrillConfig();
  const sharedState = createSharedState();
  const targetManager = createTargetManager(drillConfig);
  const drillRunner = createDrillRunner(sharedState, targetManager);
  const protocolRunner = createProtocolRunner<{ label: string; suspect: boolean; reason?: string }>({
    config: PROTOCOL,
    applyCondition: (condition) => ({
      mode: condition.mode,
      sceneId: condition.sceneId,
      drillId: condition.drillId,
    }),
    exportCondition: (context) => ({
      label: context.conditionLabel,
      suspect: context.suspect,
      reason: context.suspectReason,
    }),
  });
  const markProtocolFullscreenExit = (): void =>
    protocolRunner.markCurrentConditionSuspect('fullscreen-exit');

  // ↓↓↓ `PRODUCTION_DISPATCH` 的逐字副本（由本檔的 parity 測試釘住）。
  function onFullscreenChange(fullscreen: boolean): void {
    const recording = drillRunner.phase === 'countdown' || drillRunner.phase === 'running';
    if (!fullscreen && recording) sharedState.validity.fullscreenExitedDuringRun = true;
    if (!fullscreen && recording) markProtocolFullscreenExit();
  }
  // ↑↑↑

  /** 把真 drill 推到 `running`（倒數走完、首個目標已 spawn）。 */
  function advanceToRunning(): void {
    drillRunner.start(drillConfig);
    for (let tick = 0; tick < 300 && drillRunner.phase !== 'running'; tick += 1) {
      drillRunner.tick(sharedState, (tick * 1000) / 128); // sim clock（128Hz 步長，不讀時鐘）
    }
  }

  /** 把真 drill 一路打到 `ended`（endCondition = targetCount 3）。 */
  function advanceToEnded(): void {
    advanceToRunning();
    for (let tick = 0; tick < 900 && drillRunner.phase !== 'ended'; tick += 1) {
      drillRunner.tick(sharedState, (tick * 1000) / 128);
      const active = sharedState.targets.find((target) => target.alive);
      if (active) targetManager.markKilled(sharedState, active.id);
    }
  }

  return {
    drillRunner,
    protocolRunner,
    sharedState,
    onFullscreenChange,
    advanceToRunning,
    advanceToEnded,
  };
}

describe('WP-70 T2 — 非錄製中退出全螢幕不標記 protocol condition（FR-70.5）', () => {
  it('idle（drill 之間）退出全螢幕 ⇒ 當前 condition 不被標記', async () => {
    const rig = createRig();
    await rig.protocolRunner.start();
    expect(rig.drillRunner.phase).toBe('idle'); // 還沒 start 任何 drill：正在換 condition 的空檔

    rig.onFullscreenChange(false);

    expect(rig.protocolRunner.current?.suspect).toBe(false);
    expect(rig.protocolRunner.current?.suspectReason).toBeUndefined();
  });

  it('ended（收工去抓匯出檔）退出全螢幕 ⇒ 當前 condition 不被標記', async () => {
    const rig = createRig();
    await rig.protocolRunner.start();
    rig.advanceToEnded();
    expect(rig.drillRunner.phase).toBe('ended');

    rig.onFullscreenChange(false);

    expect(rig.protocolRunner.current?.suspect).toBe(false);
  });

  it('非錄製中的誤標不會滲進該 condition 的匯出', async () => {
    const rig = createRig();
    await rig.protocolRunner.start();
    rig.advanceToEnded();
    rig.onFullscreenChange(false);

    const result = await rig.protocolRunner.completeCurrentCondition();
    expect(result.payload).toEqual({ label: 'fhd', suspect: false, reason: undefined });
  });
});

describe('WP-70 T2 — 錄製中退出全螢幕仍標記（收緊不得誤傷偵測）', () => {
  it('countdown 退出全螢幕 ⇒ 當前 condition 標記為 fullscreen-exit', async () => {
    const rig = createRig();
    await rig.protocolRunner.start();
    rig.drillRunner.start(makeDrillConfig());
    expect(rig.drillRunner.phase).toBe('countdown');

    rig.onFullscreenChange(false);

    expect(rig.protocolRunner.current?.suspect).toBe(true);
    expect(rig.protocolRunner.current?.suspectReason).toBe('fullscreen-exit');
  });

  it('running 退出全螢幕 ⇒ 當前 condition 標記，且標記進得了匯出', async () => {
    const rig = createRig();
    await rig.protocolRunner.start();
    rig.advanceToRunning();
    expect(rig.drillRunner.phase).toBe('running');

    rig.onFullscreenChange(false);

    const result = await rig.protocolRunner.completeCurrentCondition();
    expect(result.payload).toEqual({ label: 'fhd', suspect: true, reason: 'fullscreen-exit' });
  });

  it('錄製中「進入」全螢幕不是失效事件 ⇒ 不標記', async () => {
    const rig = createRig();
    await rig.protocolRunner.start();
    rig.advanceToRunning();

    rig.onFullscreenChange(true);

    expect(rig.protocolRunner.current?.suspect).toBe(false);
  });
});

describe('WP-70 T2 — 兩個 sink 共用同一個判準值（C-D4 的行為層證據）', () => {
  it('錄製中退出 ⇒ run 旗標與 protocol 標記同時為真', async () => {
    const rig = createRig();
    await rig.protocolRunner.start();
    rig.advanceToRunning();

    rig.onFullscreenChange(false);

    expect(rig.sharedState.validity.fullscreenExitedDuringRun).toBe(true);
    expect(rig.protocolRunner.current?.suspect).toBe(true);
  });

  it('非錄製中退出 ⇒ 兩者同時為假（一套判準，兩個 sink 不得各走各的）', async () => {
    const rig = createRig();
    await rig.protocolRunner.start();
    rig.advanceToEnded();

    rig.onFullscreenChange(false);

    expect(rig.sharedState.validity.fullscreenExitedDuringRun).toBe(false);
    expect(rig.protocolRunner.current?.suspect).toBe(false);
  });
});

/**
 * `main.ts` 不可 import（top-level await + WebGPU），所以 production 接線以 source-scan 釘住 ——
 * 沿用 WP-69 T4 / WP-70 T1 的同一技術。
 */
describe('WP-70 T2 — main.ts 的接線（source-scan）', () => {
  const raw = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
  /** 先剝註解：`main.ts` 的散文正當地寫著它所描述的符號名，逐字掃原文會把註解當成程式碼。 */
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const start = source.indexOf("document.addEventListener('fullscreenchange'");
  const handler = source.slice(start, source.indexOf('\n});', start));

  it('protocol 分派套用 recording 閘（FR-70.5 的修復點）', () => {
    expect(start).toBeGreaterThan(-1);
    expect(handler).toContain(PRODUCTION_DISPATCH.protocol);
  });

  it('未閘的 markProtocolFullscreenExit 分派已不存在（FM-70.5：不得為求綠燈把閘拿掉）', () => {
    expect(handler).not.toMatch(/if \(!fullscreen\) markProtocolFullscreenExit/);
    // handler 內每一個對 `!fullscreen` 的分支都必須帶著 `recording`，沒有第三條漏網路徑。
    const branches = handler.match(/if \(!fullscreen[^)]*\)/g) ?? [];
    expect(branches.length).toBeGreaterThan(0);
    for (const branch of branches) expect(branch).toContain('&& recording');
  });

  it('protocol 與 session 路徑共用同一個 recording 判準值，不是各算一次（C-D4）', () => {
    expect(handler).toContain(PRODUCTION_DISPATCH.recording);
    // 判準運算式在整個 handler 內只出現一次；兩個 sink 都讀那個 const。
    expect(handler.match(/drillRunner\.phase === 'countdown'/g) ?? []).toHaveLength(1);
    expect(handler).toContain('experimentSession.handleFullscreenChange(fullscreen, recording)');
  });

  it('本檔 rig 的分派與 production 逐字相同（parity pin：複製品被證明與正本同文）', () => {
    const rigRaw = readFileSync(new URL(import.meta.url), 'utf8');
    const rigStart = rigRaw.indexOf('function onFullscreenChange(fullscreen: boolean): void {');
    expect(rigStart).toBeGreaterThan(-1);
    const rigBody = rigRaw.slice(rigStart, rigRaw.indexOf('\n  }', rigStart));

    expect(rigBody).toContain(PRODUCTION_DISPATCH.recording);
    expect(handler).toContain(PRODUCTION_DISPATCH.recording);
    // run 旗標那一行 rig 與 production 逐字相同；protocol 那一行 rig 少一個 `?.`（rig 的
    // `markProtocolFullscreenExit` 是必填 const，production 是 boot 期才賦值的 `let`）。
    expect(rigBody).toContain(PRODUCTION_DISPATCH.runFlag);
    expect(handler).toContain(PRODUCTION_DISPATCH.runFlag);
    expect(rigBody).toContain(PRODUCTION_DISPATCH.protocol.replace('?.()', '()'));
  });
});
