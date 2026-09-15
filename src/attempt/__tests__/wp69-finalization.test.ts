import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../../data/DataRecorder.ts';
import type { Clock } from '../../loop/clock.ts';
import { SIM_HZ } from '../../loop/constants.ts';
import { createPausableTimeMapper } from '../../loop/pausableTimeMapper.ts';
import { createSimLoop } from '../../loop/SimLoop.ts';
import { createSharedState } from '../../state/SharedState.ts';
import {
  createAttemptFinalizationGate,
  describeDiscardReason,
  planFinalization,
} from '../AttemptFinalizationGate.ts';
import { createRunAttemptController } from '../RunAttemptController.ts';
import type { RecordingSnapshot } from '../recordingIntegrity.ts';

/**
 * WP-69 / T4 — the finalization dispatch as `main.ts` wires it, driven by the **real**
 * `RunAttemptController`, `AttemptFinalizationGate`, `PausableTimeMapper`, `createSimLoop` and
 * `DataRecorder`. Only the six consequences are spies, because the assertion this task actually
 * owes is a **call matrix**: which of payload-builder / metrics / download / history / replay /
 * advance ran, and how many times (T4 DoD, NFR-69.7).
 *
 * `main.ts` is not importable (top-level await + WebGPU), so this rig restates its dispatch and the
 * bottom `describe` scans `main.ts` for the shapes the restatement depends on — the technique T2
 * and T3 used, and the one thing that caught T3's two inverted guards.
 *
 * The ordering under test is not stylistic. `finalizeAttempt()` must run **before the first await**
 * of the ended branch: the `exitPointerLock()` on the line above it queues a `pointer_lock` event
 * stamped later than the last tick, so a gate consulted after an await would see a clean run as
 * `event-out-of-window` and discard it. FM-7 is the same ordering seen from the other side — a
 * payload built before the gate has already leaked its metrics into the UI.
 */

const FPS_60 = 1000 / 60;
const START_WALL = 1_000;
const RESUME_COUNTDOWN_MS = 3_000;

/** Every consequence `main.ts` attaches to a plan field, counted. */
interface CallMatrix {
  buildPayload: number;
  showMetrics: number;
  downloadOfficial: number;
  downloadDiagnostic: number;
  historySave: number;
  replayOpen: number;
  advance: number;
  recorderReset: number;
}

function emptyMatrix(): CallMatrix {
  return {
    buildPayload: 0,
    showMetrics: 0,
    downloadOfficial: 0,
    downloadDiagnostic: 0,
    historySave: 0,
    replayOpen: 0,
    advance: 0,
    recorderReset: 0,
  };
}

interface FinalizationRig {
  readonly runAttempt: ReturnType<typeof createRunAttemptController>;
  readonly calls: CallMatrix;
  /** Basenames actually handed to a download helper, newest last. */
  readonly downloadedBasenames: string[];
  /** The discard notice `main.ts` latches for the pause overlay; `undefined` = none. */
  discardNotice(): string | undefined;
  frame(wallMs: number): void;
  pauseAt(wallMs: number): void;
  resumeFrom(wallMs: number): number;
  /** `liveFrame()`'s `phase === 'ended'` branch. */
  endDrill(): Promise<void>;
  /** The Result screen's manual diagnostic button. */
  clickDiagnosticDownload(): Promise<void>;
  /** The export panel's official JSON button. */
  clickOfficialExport(): Promise<void>;
  /** `resetRunPresentation()` — the single choke point of all four full-restart paths. */
  resetRunPresentation(): void;
  snapshot(): RecordingSnapshot;
}

function createFinalizationRig(): FinalizationRig {
  const state = createSharedState();
  const recorder = createDataRecorder();
  const mapper = createPausableTimeMapper();
  const runAttempt = createRunAttemptController();
  const gate = createAttemptFinalizationGate(runAttempt);
  const calls = emptyMatrix();
  const downloadedBasenames: string[] = [];
  const tickEnds: number[] = [];

  let resumeCountdownEndsAtWallMs: number | null = null;
  let finalizedPlan: ReturnType<typeof gate.decide> | undefined;
  let discardNotice: string | undefined;
  let lastWall = START_WALL;

  const clock: Clock = { now: () => mapper.mapWallTime(lastWall) };
  /**
   * `let`，因為 `main.ts` 的每一條 full-restart 路徑都是 `resetRunPresentation()` **緊接**
   * `buildSimLoop()`（T2 已用 source-scan 釘住那個順序）。rig 第一版沒有重建，於是 mapper 歸零後
   * 舊 loop 的 `simTimeMs` 與新的 active 域差了一整段 → re-anchor → `tick-step-off-grid`：
   * 一場乾淨的 restart 被自己判成 `discarded`。這是 rig 不忠實的結果，不是程式的 bug，但它剛好
   * 示範了那個順序為什麼是契約。
   */
  let sim = buildSim();

  function buildSim(): ReturnType<typeof createSimLoop> {
    return createSimLoop(state, clock, SIM_HZ, undefined, undefined, undefined, recorder, undefined, undefined, {
      afterTick(_s, tickEndMs): void {
        tickEnds.push(tickEndMs);
      },
    });
  }

  function snapshot(): RecordingSnapshot {
    const snap = recorder.snapshot();
    return {
      ticks: tickEnds.map((t) => ({ t })),
      events: snap.events.map((e) => ({ t: e.t })),
      simHz: SIM_HZ,
      bufferOverflow: state.inputMeta.bufferOverflow > 0,
      recorderOverflow: snap.recorderOverflow,
    };
  }

  function finalizeAttempt(): ReturnType<typeof gate.decide> {
    finalizedPlan ??= gate.decide(snapshot());
    return finalizedPlan;
  }

  function planForExport(): ReturnType<typeof gate.decide> {
    if (finalizedPlan !== undefined) return finalizedPlan;
    // 從未暫停且尚未結算的隨手匯出維持既有行為（NFR-69.1）——不把 integrity 判準套上去。
    if (!runAttempt.pauseOccurred) return planFinalization({ kind: 'eligible-candidate' });
    return gate.decide(snapshot());
  }

  /** `buildCurrentExportPayload()` — the *only* place a payload comes into existence. */
  async function buildPayload(): Promise<{ basename: string }> {
    calls.buildPayload += 1;
    await Promise.resolve(); // it really is async in `main.ts`; the ordering must survive that
    return { basename: 'drill-2026-09-15T09_18_05.351Z' };
  }

  return {
    runAttempt,
    calls,
    downloadedBasenames,
    discardNotice: () => discardNotice,

    frame(wallMs): void {
      lastWall = wallMs;
      if (
        runAttempt.phase === 'resume-countdown' &&
        resumeCountdownEndsAtWallMs !== null &&
        wallMs >= resumeCountdownEndsAtWallMs
      ) {
        runAttempt.finishResumeCountdown(mapper.resume(wallMs));
        resumeCountdownEndsAtWallMs = null;
      }
      sim.pump(mapper.mapWallTime(wallMs));
    },

    pauseAt(wallMs): void {
      lastWall = wallMs;
      if (runAttempt.phase === 'paused') return;
      runAttempt.pause(mapper.pause(wallMs)); // the nested shape T3 pinned, restated
      resumeCountdownEndsAtWallMs = null;
    },

    resumeFrom(wallMs): number {
      runAttempt.beginResume();
      runAttempt.confirmLock(wallMs);
      resumeCountdownEndsAtWallMs = wallMs + RESUME_COUNTDOWN_MS;
      let wall = wallMs;
      while (runAttempt.phase !== 'active') {
        wall += FPS_60;
        this.frame(wall);
      }
      return wall;
    },

    async endDrill(): Promise<void> {
      // Synchronous prologue, exactly as in `main.ts`: the gate answers before any await.
      const plan = finalizeAttempt();
      if (!plan.buildsPayload) {
        if (plan.clearsRecording) {
          recorder.reset();
          calls.recorderReset += 1;
        }
        discardNotice =
          plan.disposition.kind === 'discarded' ? describeDiscardReason(plan.disposition.reason) : undefined;
        return;
      }
      const payload = await buildPayload();
      calls.showMetrics += 1;
      if (plan.savesHistory) calls.historySave += 1;
      if (plan.offersReplay) calls.replayOpen += 1; // the entry being *offered* is the observable
      if (!plan.advancesOrchestrator) return;
      calls.downloadOfficial += 1;
      downloadedBasenames.push(payload.basename);
      calls.advance += 1;
    },

    async clickDiagnosticDownload(): Promise<void> {
      const plan = planForExport();
      if (plan.download !== 'diagnostic-manual') throw new Error('本次沒有可下載的稽核檔。');
      const payload = await buildPayload();
      calls.downloadDiagnostic += 1;
      downloadedBasenames.push(`${payload.basename}.invalid-paused`);
    },

    async clickOfficialExport(): Promise<void> {
      const plan = planForExport();
      if (plan.download !== 'official') throw new Error('正式匯出已停用。');
      const payload = await buildPayload();
      calls.downloadOfficial += 1;
      downloadedBasenames.push(payload.basename);
    },

    resetRunPresentation(): void {
      if (runAttempt.pauseOccurred) finalizeAttempt();
      finalizedPlan = undefined;
      discardNotice = undefined;
      mapper.restart(lastWall);
      runAttempt.restart();
      resumeCountdownEndsAtWallMs = null;
      recorder.reset();
      tickEnds.length = 0;
      sim = buildSim(); // `main.ts`：reset 之後**必定**緊接 buildSimLoop()（見 `sim` 的說明）
    },

    snapshot,
  };
}

/** Run `count` frames at 60 FPS starting one period after `from`; returns the last wall time. */
function run(rig: FinalizationRig, from: number, count: number): number {
  let wall = from;
  for (let i = 1; i <= count; i += 1) {
    wall = from + i * FPS_60;
    rig.frame(wall);
  }
  return wall;
}

describe('WP-69 T4 — 三態的呼叫矩陣（T4 DoD 第 1 條，NFR-69.7）', () => {
  it('eligible-candidate：既有五條路徑全開，且不清 recorder', async () => {
    const rig = createFinalizationRig();
    run(rig, START_WALL, 30);

    await rig.endDrill();

    expect(rig.calls).toEqual({
      buildPayload: 1,
      showMetrics: 1,
      downloadOfficial: 1,
      downloadDiagnostic: 0,
      historySave: 1,
      replayOpen: 1,
      advance: 1,
      recorderReset: 0,
    });
    expect(rig.discardNotice()).toBeUndefined();
  });

  it('invalid-retained：payload 與 metrics 有，history／replay／advance／正式下載全為 0', async () => {
    const rig = createFinalizationRig();
    let wall = run(rig, START_WALL, 20);
    rig.pauseAt(wall);
    wall = rig.resumeFrom(wall);
    wall = run(rig, wall, 20);

    await rig.endDrill();

    expect(rig.calls).toEqual({
      buildPayload: 1,
      showMetrics: 1,
      downloadOfficial: 0, // 自動下載也不發生（OQ-69.1 改手動之後這裡恆為 0）
      downloadDiagnostic: 0, // 直到操作員自己按
      historySave: 0, // NFR-69.7：呼叫數就是斷言
      replayOpen: 0,
      advance: 0, // FM-6：三個 runner 停在同一步
      recorderReset: 0, // arena 必須活著，稽核檔還沒被下載
    });
  });

  it('discarded：payload builder 一次都沒被呼叫，recorder 被清空（FR-69.9／FM-7）', async () => {
    const rig = createFinalizationRig();
    const wall = run(rig, START_WALL, 20);
    rig.pauseAt(wall); // 暫停中直接收工 ⇒ fence 未閉合

    await rig.endDrill();

    expect(rig.calls).toEqual({ ...emptyMatrix(), recorderReset: 1 });
    expect(rig.snapshot().events).toEqual([]);
  });

  it('discarded 會把作廢理由交給 overlay（不是只有靜靜地什麼都不做）', async () => {
    const rig = createFinalizationRig();
    rig.pauseAt(run(rig, START_WALL, 20));

    await rig.endDrill();

    expect(rig.discardNotice()).toBe(describeDiscardReason('pause-fence-unclosed'));
  });
});

describe('WP-69 T4 — 稽核檔只有手動一條路（OQ-69.1 / D-69-T0-3）', () => {
  it('invalid-retained 收工當下不產生任何檔；按下去才有，且檔名帶 .invalid-paused', async () => {
    const rig = createFinalizationRig();
    let wall = run(rig, START_WALL, 20);
    rig.pauseAt(wall);
    wall = run(rig, rig.resumeFrom(wall), 20);
    await rig.endDrill();
    expect(rig.downloadedBasenames).toEqual([]);

    await rig.clickDiagnosticDownload();

    expect(rig.downloadedBasenames).toHaveLength(1);
    expect(rig.downloadedBasenames[0]).toMatch(/\.invalid-paused$/);
    expect(rig.calls.downloadDiagnostic).toBe(1);
    expect(rig.calls.downloadOfficial).toBe(0);
  });

  it('invalid-retained 的正式匯出鈕被拒絕（不會產生看起來正常的檔名）', async () => {
    const rig = createFinalizationRig();
    let wall = run(rig, START_WALL, 20);
    rig.pauseAt(wall);
    wall = run(rig, rig.resumeFrom(wall), 20);
    await rig.endDrill();

    await expect(rig.clickOfficialExport()).rejects.toThrow('正式匯出已停用');
    expect(rig.downloadedBasenames).toEqual([]);
    expect(rig.calls.buildPayload).toBe(1); // 只有收工那一次；被拒的匯出沒有建第二份
  });

  it('discarded 連稽核檔都沒有（沒有 payload 就沒有檔）', async () => {
    const rig = createFinalizationRig();
    rig.pauseAt(run(rig, START_WALL, 20));
    await rig.endDrill();

    await expect(rig.clickDiagnosticDownload()).rejects.toThrow('沒有可下載的稽核檔');
    await expect(rig.clickOfficialExport()).rejects.toThrow('正式匯出已停用');
    expect(rig.calls.buildPayload).toBe(0);
  });

  it('乾淨的一場照樣可以正式匯出（乾淨路徑零附帶損傷）', async () => {
    const rig = createFinalizationRig();
    run(rig, START_WALL, 30);
    await rig.endDrill();

    await rig.clickOfficialExport();

    expect(rig.calls.downloadOfficial).toBe(2); // 收工自動一次 + 手動一次
    expect(rig.downloadedBasenames.every((name) => !name.includes('.invalid-paused'))).toBe(true);
  });
});

describe('WP-69 T4 — finalization 恰好一次（DoD 第 6 條：沒有 double finalization）', () => {
  it('收工後再 finalize 拿到同一份 plan（memo，不重判）', async () => {
    const rig = createFinalizationRig();
    let wall = run(rig, START_WALL, 20);
    rig.pauseAt(wall);
    wall = run(rig, rig.resumeFrom(wall), 20);

    await rig.endDrill();
    await rig.endDrill(); // 第二次進入收工分支（相位守衛失效時的最壞情況）

    expect(rig.calls.buildPayload).toBe(2); // 呼叫端自己重跑了兩次
    expect(rig.calls.historySave).toBe(0); // 但 plan 沒有變 ⇒ 兩次都不保存
    expect(rig.calls.advance).toBe(0);
  });

  it('收工後 recorder 繼續長 tick，也不會把 invalid-retained 翻成別的東西', async () => {
    const rig = createFinalizationRig();
    let wall = run(rig, START_WALL, 20);
    rig.pauseAt(wall);
    wall = run(rig, rig.resumeFrom(wall), 20);
    await rig.endDrill();

    // `liveFrame()` 不看相位，收工後照樣 pump —— memo 存在的理由就是這個。
    run(rig, wall, 30);
    await rig.clickDiagnosticDownload();

    expect(rig.calls.downloadDiagnostic).toBe(1);
  });
});

describe('WP-69 T4 — 導航路徑不可繞過 gate（FR-69.12，OQ-69.4）', () => {
  it('暫停中換 drill/scene/weapon：先過 gate 得到 discarded，再由 restart 清乾淨', () => {
    const rig = createFinalizationRig();
    const wall = run(rig, START_WALL, 20);
    rig.pauseAt(wall);
    expect(rig.runAttempt.pauseOccurred).toBe(true);

    rig.resetRunPresentation();

    // T0.5 凍結的判準逐字執行：暫停中離開 = fence 未閉合 = discarded。T4 不在導航前強迫 resume,
    // 也不放寬判準（OQ-69.4 的結論，代價見 progress.md §T4.5）。
    expect(rig.calls.buildPayload).toBe(0);
    expect(rig.calls.historySave).toBe(0);
    expect(rig.calls.advance).toBe(0);
    // restart 之後是一場全新的 attempt。
    expect(rig.runAttempt.attempt).toBe(2);
    expect(rig.runAttempt.validity).toBe('eligible-candidate');
    expect(rig.runAttempt.pauseOccurred).toBe(false);
  });

  it('從未暫停的導航不觸發 finalization（乾淨路徑零新增工作，NFR-69.1）', () => {
    const rig = createFinalizationRig();
    run(rig, START_WALL, 20);

    rig.resetRunPresentation();

    expect(rig.calls).toEqual(emptyMatrix());
  });

  it('restart 清掉 memo：下一場重新判一次，不繼承上一場的 invalid', async () => {
    const rig = createFinalizationRig();
    let wall = run(rig, START_WALL, 20);
    rig.pauseAt(wall);
    wall = run(rig, rig.resumeFrom(wall), 20);
    await rig.endDrill();
    expect(rig.calls.historySave).toBe(0);

    rig.resetRunPresentation();
    run(rig, wall, 30);
    await rig.endDrill();

    expect(rig.calls.historySave).toBe(1); // 新 attempt 是 eligible
    expect(rig.calls.advance).toBe(1);
  });

  it('作廢告知活到 Restart 為止，然後消失', async () => {
    const rig = createFinalizationRig();
    rig.pauseAt(run(rig, START_WALL, 20));
    await rig.endDrill();
    expect(rig.discardNotice()).toBeDefined();

    rig.resetRunPresentation();

    expect(rig.discardNotice()).toBeUndefined();
  });
});

/**
 * 這個 rig 是 `main.ts` 接線的重述，重述就會漂移。下面掃描 `main.ts` 的原始碼，把 rig 依賴的形狀
 * 逐字釘住。⚠️ T3.9 #1 的教訓：`indexOf(a) < indexOf(b)` 在 `a` 不存在（回 `-1`）時恆真 ——
 * 每一條順序斷言都必須先各自斷言「兩者都存在」，否則把那一行刪掉反而讓測試變綠。
 */
describe('WP-69 T4 — main.ts 的 finalization 接線沒有漂移', () => {
  const raw = import.meta.glob<string>('../../main.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })['../../main.ts']!;

  /**
   * 掃描前先剝註解。⚠️ 這不是整潔而是正確性：`main.ts` 的既有註解裡就寫著
   * `sessionPlanRunner.advance()／completeActiveProtocolCondition()`（WP-48 的 fire-and-forget
   * 說明），而本檔自己的註解也提到 `runAttempt.restart()`。逐字掃原始文字會把**散文**當成呼叫，
   * 順序斷言因此在程式碼完全正確時就先紅了一次。受測的主張是「可執行的接線長這樣」，不是
   * 「檔案裡出現過這些字」（沿用 `architecture.test.ts` 的 `stripComments` 先例）。
   */
  const source = stripComments(raw);

  /** 收工分支的本體：從 `phase === 'ended'` 到該區塊結尾。 */
  const endedBranch = (() => {
    const start = source.indexOf("if (!resultShown && phase === 'ended')");
    expect(start).toBeGreaterThan(-1);
    return source.slice(start, source.indexOf('\n  }', start));
  })();

  it('gate 在收工分支裡跑，且早於 payload builder（FM-7）', () => {
    const gateAt = endedBranch.indexOf('const plan = finalizeAttempt();');
    const buildAt = endedBranch.indexOf('await buildCurrentExportPayload()');
    expect(gateAt).toBeGreaterThan(-1);
    expect(buildAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(buildAt);
  });

  it('gate 早於第一個 await（收工釋鎖補的 pointer_lock 事件會落在最後一個 tick 之後）', () => {
    const gateAt = endedBranch.indexOf('const plan = finalizeAttempt();');
    const awaitAt = endedBranch.indexOf('await ');
    expect(gateAt).toBeGreaterThan(-1);
    expect(awaitAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(awaitAt);
  });

  it('!buildsPayload 直接 return，且那條 return 在 payload builder 之前', () => {
    const guardAt = endedBranch.indexOf('if (!plan.buildsPayload)');
    const buildAt = endedBranch.indexOf('await buildCurrentExportPayload()');
    expect(guardAt).toBeGreaterThan(-1);
    expect(buildAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(buildAt);
    expect(endedBranch.slice(guardAt, buildAt)).toContain('return;');
  });

  it('discarded 路徑清 recorder 與 frame log', () => {
    const guardAt = endedBranch.indexOf('if (!plan.buildsPayload)');
    const block = endedBranch.slice(guardAt, endedBranch.indexOf('await buildCurrentExportPayload()'));
    expect(block).toContain('recorder.reset()');
    expect(block).toContain('frameLog.reset()');
  });

  it('plan 一路傳進 showResultAndTrackHistory（不讓它自己重新判一次）', () => {
    expect(endedBranch).toContain('showResultAndTrackHistory(payload, plan)');
  });

  it('advancesOrchestrator 的閘早於三個 runner 的推進呼叫（FM-6）', () => {
    const guardAt = endedBranch.indexOf('if (!plan.advancesOrchestrator) return;');
    expect(guardAt).toBeGreaterThan(-1);
    for (const call of ['handleDrillEnded()', 'sessionPlanRunner.advance()', 'completeActiveProtocolCondition()']) {
      const callAt = endedBranch.indexOf(call);
      expect(callAt).toBeGreaterThan(-1);
      expect(guardAt).toBeLessThan(callAt);
    }
  });

  it('savesHistory 為假時連 historyPersistence.save() 都不呼叫（第一道防線）', () => {
    const start = source.indexOf('function showResultAndTrackHistory(');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('\n}', start));
    const guardAt = body.indexOf('if (!plan.savesHistory)');
    const saveAt = body.indexOf('historyPersistence.save(payload)');
    expect(guardAt).toBeGreaterThan(-1);
    expect(saveAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(saveAt);
    expect(body.slice(guardAt, saveAt)).toContain('return Promise.resolve(excluded)');
  });

  it('resetRunPresentation 在 runAttempt.restart() 之前先結算暫停中的 attempt（FR-69.12）', () => {
    const start = source.indexOf('function resetRunPresentation()');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('\n}', start));
    const finalizeAt = body.indexOf('if (runAttempt.pauseOccurred) finalizeAttempt();');
    const restartAt = body.indexOf('runAttempt.restart()');
    expect(finalizeAt).toBeGreaterThan(-1);
    expect(restartAt).toBeGreaterThan(-1);
    expect(finalizeAt).toBeLessThan(restartAt);
    expect(body).toContain('finalizedPlan = undefined');
  });

  it('兩個面板的四顆正式匯出鈕都先過 requireOfficialExport()，且早於建 payload', () => {
    // 兩個面板 × JSON/CSV = 四顆鈕。少一次 = 有一條路徑可以繞過 gate 匯出正式檔名。
    expect(source.match(/requireOfficialExport\(\);/g) ?? []).toHaveLength(4);
    for (const handler of ['onExportJSON', 'onExportCSV']) {
      const pattern = new RegExp(`async ${handler}\\(\\): Promise<void> \\{`, 'g');
      const matches = [...source.matchAll(pattern)];
      expect(matches).toHaveLength(2); // export panel + result screen
      for (const match of matches) {
        const body = source.slice(match.index, source.indexOf('\n  },', match.index));
        const guardAt = body.indexOf('requireOfficialExport();');
        const buildAt = body.indexOf('await buildCurrentExportPayload()');
        expect(guardAt).toBeGreaterThan(-1);
        expect(buildAt).toBeGreaterThan(-1);
        expect(guardAt).toBeLessThan(buildAt); // 拒絕必須早於建 payload（FM-7 的同一條理由）
      }
    }
  });

  it('會產生檔案的地方就只有這八處（多一處 = 多一條未授權的出口）', () => {
    // 列舉而非模糊比對：新增第九處會在這裡變紅，逼人明說它歸哪一類，而不是靜悄悄多一條出口。
    const sites = [...source.matchAll(/downloadJSON\(|downloadCSV\(/g)].map((match) =>
      source.slice(source.lastIndexOf('\n', match.index) + 1, source.indexOf('\n', match.index)).trim(),
    );
    expect(sites).toHaveLength(8);
    // 四顆有 requireOfficialExport() 守著的面板鈕（上一條測試釘住那個守衛）。
    expect(sites.filter((line) => line.startsWith('downloadJSON(payload, { basename: exportBasename'))).toHaveLength(2);
    expect(sites.filter((line) => line.startsWith('downloadCSV(payload, { basename: exportBasename'))).toHaveLength(2);
    // 稽核檔：唯一帶 invalidAttemptBasename 的一處。
    expect(sites.filter((line) => line.includes('invalidAttemptBasename'))).toHaveLength(1);
    // 收工自動下載 + pilot block 匯出：兩者都在 `advancesOrchestrator` 閘之後才可能跑到。
    expect(sites.filter((line) => line.startsWith('onBlockExported'))).toHaveLength(1);
    expect(sites.filter((line) => line.startsWith('if (sessionPhase.step.warmup'))).toHaveLength(1);
    // 歷史／重播的既有下載讀的是別人的 payload（`result.payload`），不是當前 attempt。
    expect(sites.filter((line) => line.includes('result.payload'))).toHaveLength(1);
  });

  it('稽核檔的檔名強制走 invalidAttemptBasename()（唯一一處產生路徑）', () => {
    const start = source.indexOf('async function downloadInvalidDiagnostic()');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('\n}', start));
    expect(body).toMatch(/basename: invalidAttemptBasename\(exportBasename\(payload\)\)/);
    expect(body).toContain("plan.download !== 'diagnostic-manual'");
  });

  it('collectMeta 的 validity 讀 runAttempt.pauseOccurred（payload 自述不可採納）', () => {
    expect(source).toContain('pauseOccurred: runAttempt.pauseOccurred');
  });

  it('pauseOverlay 的作廢 view 優先於相位', () => {
    const start = source.indexOf('function pauseOverlayView(');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('\n}', start));
    const noticeAt = body.indexOf('if (discardedNoticeView !== undefined) return discardedNoticeView;');
    const switchAt = body.indexOf('switch (runAttempt.phase)');
    expect(noticeAt).toBeGreaterThan(-1);
    expect(switchAt).toBeGreaterThan(-1);
    expect(noticeAt).toBeLessThan(switchAt);
  });
});

/** 只計可執行的行：`main.ts` 的註解正當地寫著它所描述的呼叫名（見上方 `source` 的說明）。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}
