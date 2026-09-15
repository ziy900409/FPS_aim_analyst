import { describe, expect, it, vi } from 'vitest';
import { createProtocolRunner, type ProtocolConfig } from '../../display/ProtocolRunner.ts';
import {
  buildFrozenSessionPlan,
  createSessionRunner,
  type SessionRunnerHandle,
  type SessionRunnerPhase,
} from '../../session/SessionRunner.ts';
import { TEST_FAMILY_IDS } from '../../session/sessionSchedule.ts';
import {
  createTrackingPilotRunner,
  type TrackingPilotRunnerHandle,
  type TrackingPilotRunnerPhase,
} from '../../session/TrackingPilotRunner.ts';
import {
  trackingCorePrPilotV1Practice,
  TRACKING_CORE_PR_PILOT_V1_CANDIDATES,
} from '../../drill/tracking_core_pr_pilot_v1.ts';
import { TRACKING_PILOT_PROTOCOL_VERSION } from '../../pilot/trackingCompatibilityKey.ts';
import type { TrackingPilotManifest } from '../../session/trackingPilotManifest.ts';
import {
  createAttemptFinalizationGate,
  describeAttemptHold,
  type AttemptFinalizationPlan,
} from '../AttemptFinalizationGate.ts';
import { createRunAttemptController } from '../RunAttemptController.ts';
import type { RecordingSnapshot } from '../recordingIntegrity.ts';

/**
 * WP-69 / T5 — the three orchestrators under the **real** `RunAttemptController`, the real
 * `AttemptFinalizationGate` and the real `SessionRunner` / `ProtocolRunner` / `TrackingPilotRunner`.
 *
 * What this file owes (T5 DoD) is mostly a set of **non-events**: after a held attempt, the cursor,
 * the condition index and the block index are bit-for-bit what they were, and nothing reached the
 * Session download, the protocol `exports[]` or the pilot's completed-record set. Non-events are
 * easy to "prove" by accident — a rig that never drove the runner far enough would pass every one
 * of them — so each hold case is paired with the clean case run through the *same* rig, and the
 * clean case asserts the advance actually happens.
 *
 * `main.ts` is not importable (top-level await + WebGPU), so `endDrill()` below restates its ended
 * branch and the last `describe` scans `main.ts` for the shapes that restatement depends on — the
 * technique T2/T3/T4 used.
 */

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const FIRST_TICK = 1000;

/** A clean 40-tick recording. Held dispositions come from the controller, not from broken ticks. */
function cleanSnapshot(): RecordingSnapshot {
  return {
    ticks: Array.from({ length: 40 }, (_, i) => ({ t: FIRST_TICK + i * TICK_MS })),
    events: [{ t: FIRST_TICK + 5 * TICK_MS }],
    simHz: SIM_HZ,
    bufferOverflow: false,
    recorderOverflow: false,
  };
}

function smallManifest(): TrackingPilotManifest {
  return {
    protocolVersion: TRACKING_PILOT_PROTOCOL_VERSION,
    participantId: 'P001',
    sessionIndex: 0,
    orderedBlocks: [
      { drillId: trackingCorePrPilotV1Practice.drillId, seedFamily: 'primary' },
      { drillId: TRACKING_CORE_PR_PILOT_V1_CANDIDATES[0].drillId, seedFamily: 'primary' },
    ],
    restSeconds: 5,
    generatedFromCounterbalanceCell: 'test-cell',
  };
}

function protocolConfig(): ProtocolConfig {
  return {
    protocolId: 'wp69-t5',
    requiredDisplay: { minW: 1920, minH: 1080 },
    conditions: [
      { label: 'c1', mode: 'native', sceneId: 's1', drillId: 'd1' },
      { label: 'c2', mode: 'fhd-1080', sceneId: 's2', drillId: 'd2' },
    ],
  };
}

async function settleTransitions(): Promise<void> {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
}

type Owner = 'session' | 'protocol' | 'pilot' | 'standalone';

interface RetryRig {
  readonly runAttempt: ReturnType<typeof createRunAttemptController>;
  readonly session: SessionRunnerHandle;
  readonly protocol: ReturnType<typeof createProtocolRunner<{ id: string }>>;
  readonly pilot: TrackingPilotRunnerHandle;
  /** Files the Session Plan path handed to the app downloader, newest last. */
  readonly sessionDownloads: string[];
  /** Whatever `#protocol-status` was last told to say; `undefined` = never written. */
  status(): string | undefined;
  /** `liveFrame()`'s `phase === 'ended'` branch, restated. */
  endDrill(owner: Owner): Promise<void>;
  /** `resetRunPresentation()` — the choke point every full-restart path goes through. */
  restart(): void;
}

function createRetryRig(): RetryRig {
  const runAttempt = createRunAttemptController();
  const gate = createAttemptFinalizationGate(runAttempt);
  const sessionDownloads: string[] = [];
  let status: string | undefined;
  let finalizedPlan: AttemptFinalizationPlan | undefined;

  /**
   * Every drill load in `main.ts` runs through `resetRunPresentation()` — that is what makes the
   * finalization memo a per-attempt value rather than a per-session one. The rig's two loaders
   * therefore do the same; the first version of this file skipped it, and a stale memo let a
   * *later* held attempt quietly inherit the *earlier* clean attempt's plan.
   */
  function resetRunPresentation(): void {
    if (runAttempt.pauseOccurred) finalizedPlan ??= gate.decide(cleanSnapshot());
    finalizedPlan = undefined;
    runAttempt.restart();
  }

  const session = createSessionRunner({
    loadDrillById: vi.fn(async () => {
      resetRunPresentation();
    }),
    onStatus: (text) => {
      status = text;
    },
  });
  const protocol = createProtocolRunner<{ id: string }>({
    config: protocolConfig(),
    applyCondition: (condition) => ({ mode: condition.mode, sceneId: condition.sceneId, drillId: condition.drillId }),
    exportCondition: (context) => ({ id: context.conditionLabel }),
  });
  const pilot = createTrackingPilotRunner({
    loadDrillConfig: vi.fn(async () => {
      resetRunPresentation();
    }),
    exportBlock: vi.fn(async () => ({}) as never),
    evaluateEligibility: vi.fn(() => ({ status: 'eligible', validScoredTicks: 100, durationMs: 1000 }) as never),
    onStatus: (text) => {
      status = text;
    },
  });

  /** `holdOrchestratorsOnAttempt()` in `main.ts`, restated. */
  function hold(plan: AttemptFinalizationPlan): void {
    const notice = describeAttemptHold(plan);
    if (notice === null || plan.disposition.kind === 'eligible-candidate') return;
    if (pilot.retryRunningBlock(plan.disposition) !== undefined) return;
    const sessionPhase: SessionRunnerPhase = session.phase;
    if (sessionPhase.kind !== 'run' && protocol.current === undefined) return;
    status = notice;
  }

  return {
    runAttempt,
    session,
    protocol,
    pilot,
    sessionDownloads,
    status: () => status,

    async endDrill(owner): Promise<void> {
      const plan = (finalizedPlan ??= gate.decide(cleanSnapshot()));
      if (!plan.advancesOrchestrator) hold(plan);
      if (!plan.buildsPayload) return;
      await Promise.resolve(); // `await buildCurrentExportPayload()`
      if (!plan.advancesOrchestrator) return;
      if (owner === 'pilot') {
        await pilot.completeCurrentBlock();
        return;
      }
      if (owner === 'session') {
        const phase: SessionRunnerPhase = session.phase;
        if (phase.kind === 'run') {
          if (phase.step.warmup !== true) sessionDownloads.push(phase.step.drillId);
          await session.advance();
        }
        return;
      }
      if (owner === 'protocol') await protocol.completeCurrentCondition();
    },

    restart: resetRunPresentation,
  };
}

/** Puts the attempt into `invalid-retained`: paused once, resumed, time axis still provable. */
function pauseAndResume(rig: RetryRig): void {
  rig.runAttempt.pause(FIRST_TICK + 10 * TICK_MS);
  rig.runAttempt.beginResume();
  rig.runAttempt.confirmLock(FIRST_TICK + 11 * TICK_MS);
  rig.runAttempt.finishResumeCountdown(FIRST_TICK + 10 * TICK_MS);
}

/** Puts the attempt into `discarded`: finalized while still paused ⇒ `pause-fence-unclosed`. */
function pauseWithoutResuming(rig: RetryRig): void {
  rig.runAttempt.pause(FIRST_TICK + 10 * TICK_MS);
}

async function startSession(rig: RetryRig): Promise<void> {
  const { plan } = buildFrozenSessionPlan({
    participantId: 'P001',
    sessionIndex: 0,
    families: TEST_FAMILY_IDS.slice(0, 2),
    restSeconds: 60,
    includeWarmup: false,
  });
  await rig.session.start(plan);
}

describe('WP-69 T5 — SessionRunner 停在同一 step（FR-69.10，T5 DoD 第 1/3 條）', () => {
  it.each([
    ['invalid-retained', pauseAndResume],
    ['discarded', pauseWithoutResuming],
  ])('%s：cursor/step/status 逐位不變，且沒有任何檔案被下載', async (_label, invalidate) => {
    const rig = createRetryRig();
    await startSession(rig);
    const before = rig.session.phase;
    expect(before.kind).toBe('run');

    invalidate(rig);
    await rig.endDrill('session');
    await settleTransitions();

    expect(rig.session.phase).toEqual(before); // 同一個 step，同一個 cursor
    expect(rig.sessionDownloads).toEqual([]);
    expect(rig.status()).toContain('重新測試');
  });

  it('乾淨的一場照樣前進到下一個 step 並下載（沒把 clean flow 一起擋掉）', async () => {
    const rig = createRetryRig();
    await startSession(rig);
    const first = rig.session.phase;

    await rig.endDrill('session');
    await settleTransitions();

    expect(rig.session.phase).not.toEqual(first);
    expect(rig.sessionDownloads).toHaveLength(1);
  });

  it('full restart 之後同一個 step 重跑，attempt +1、drill 不變（FR-69.6，T5 DoD 第 2 條）', async () => {
    const rig = createRetryRig();
    await startSession(rig);
    const held = rig.session.phase;
    const attemptBefore = rig.runAttempt.attempt;

    pauseAndResume(rig);
    await rig.endDrill('session');
    await settleTransitions();
    rig.restart();

    expect(rig.runAttempt.attempt).toBe(attemptBefore + 1);
    expect(rig.runAttempt.validity).toBe('eligible-candidate');
    expect(rig.session.phase).toEqual(held); // 同一個 drill/step，不是下一個
  });

  it('連續兩次 pause + restart：step 仍不動，attempt 走到 3', async () => {
    const rig = createRetryRig();
    await startSession(rig);
    const held = rig.session.phase;
    const attemptBefore = rig.runAttempt.attempt;

    for (const _ of [0, 1]) {
      pauseAndResume(rig);
      await rig.endDrill('session');
      await settleTransitions();
      rig.restart();
    }

    expect(rig.runAttempt.attempt).toBe(attemptBefore + 2);
    expect(rig.session.phase).toEqual(held);
    expect(rig.sessionDownloads).toEqual([]);
  });
});

describe('WP-69 T5 — ProtocolRunner 停在同一 condition（FR-69.10）', () => {
  it.each([
    ['invalid-retained', pauseAndResume],
    ['discarded', pauseWithoutResuming],
  ])('%s：conditionIndex 不變，exports[] 不長，protocol 不完成', async (_label, invalidate) => {
    const rig = createRetryRig();
    await rig.protocol.start();
    const before = rig.protocol.current;

    invalidate(rig);
    await rig.endDrill('protocol');
    await settleTransitions();

    expect(rig.protocol.current).toEqual(before);
    expect(rig.protocol.exports).toEqual([]);
    expect(rig.status()).toContain('重新測試');
  });

  it('最後一個 condition 被 held 時不觸發 protocol complete（整份 protocol 仍未完成）', async () => {
    const onProtocolComplete = vi.fn();
    const runner = createProtocolRunner<{ id: string }>({
      config: protocolConfig(),
      applyCondition: (condition) => ({ mode: condition.mode, sceneId: condition.sceneId, drillId: condition.drillId }),
      exportCondition: (context) => ({ id: context.conditionLabel }),
      onProtocolComplete,
    });
    const rig = createRetryRig();
    await runner.start();
    await runner.completeCurrentCondition();
    await runner.beginNextCondition();
    expect(runner.current?.conditionIndex).toBe(1); // 最後一個

    pauseAndResume(rig);
    const plan = createAttemptFinalizationGate(rig.runAttempt).decide(cleanSnapshot());
    if (plan.advancesOrchestrator) await runner.completeCurrentCondition();

    expect(onProtocolComplete).not.toHaveBeenCalled();
    expect(runner.exports).toHaveLength(1); // 只有第一個 condition 的那一份
    expect(runner.current?.conditionIndex).toBe(1);
  });

  it('乾淨的一場照樣完成 condition 並推進 exports[]', async () => {
    const rig = createRetryRig();
    await rig.protocol.start();

    await rig.endDrill('protocol');
    await settleTransitions();

    expect(rig.protocol.exports).toHaveLength(1);
  });
});

describe('WP-69 T5 — TrackingPilotRunner 重跑同一 block（README §2.5，T5 DoD 第 4 條）', () => {
  it.each([
    ['invalid-retained', pauseAndResume],
    ['discarded', pauseWithoutResuming],
  ])('%s：blockIndex 不動、attempt +1、無 completed record，audit 留一筆', async (_label, invalidate) => {
    const rig = createRetryRig();
    await rig.pilot.start(smallManifest());

    invalidate(rig);
    await rig.endDrill('pilot');
    await settleTransitions();

    const phase: TrackingPilotRunnerPhase = rig.pilot.phase;
    expect(phase).toMatchObject({ kind: 'running', blockIndex: 0, attempt: 2 });
    expect(rig.pilot.records).toEqual([]);
    expect(rig.pilot.invalidAttempts).toHaveLength(1);
    expect(rig.pilot.invalidAttempts[0]).toMatchObject({ blockIndex: 0, previousAttempt: 1 });
  });

  it('practice 與 scored block 走同一條 held 規則（practice 不因為沒有品質閘就被放行）', async () => {
    const rig = createRetryRig();
    await rig.pilot.start(smallManifest());
    await rig.endDrill('pilot'); // practice 乾淨完成
    await settleTransitions();
    await rig.pilot.advance();
    rig.pilot.poll(1000);
    rig.pilot.poll(7000);
    await settleTransitions();
    expect(rig.pilot.phase).toMatchObject({ kind: 'running', blockIndex: 1, role: 'scored' });

    pauseAndResume(rig);
    await rig.endDrill('pilot');
    await settleTransitions();

    expect(rig.pilot.phase).toMatchObject({ kind: 'running', blockIndex: 1, role: 'scored', attempt: 2 });
    expect(rig.pilot.records).toHaveLength(1); // 只有那一場乾淨的 practice
    expect(rig.pilot.records.every((record) => record.blockIndex === 0)).toBe(true);
  });

  it('pilot 擁有這一場時不再多寫一句泛用文案（一個事件一個通道）', async () => {
    const rig = createRetryRig();
    await rig.pilot.start(smallManifest());

    pauseAndResume(rig);
    await rig.endDrill('pilot');
    await settleTransitions();

    expect(rig.status()).toContain('已失效');
    expect(rig.status()).not.toContain('重新測試本項');
  });
});

describe('WP-69 T5 — 沒有 orchestrator 在跑時完全靜默（NFR-69.1）', () => {
  it('standalone drill 的 held attempt 不寫任何 orchestrator 狀態列', async () => {
    const rig = createRetryRig();

    pauseAndResume(rig);
    await rig.endDrill('standalone');
    await settleTransitions();

    expect(rig.status()).toBeUndefined();
    expect(rig.session.phase).toEqual({ kind: 'idle' });
    expect(rig.protocol.current).toBeUndefined();
    expect(rig.pilot.invalidAttempts).toEqual([]);
  });
});

/**
 * 上面的 rig 是 `main.ts` 接線的重述，重述就會漂移。⚠️ T3.9 #1：`indexOf(a) < indexOf(b)` 在 `a`
 * 不存在（回 `-1`）時恆真，所以每條順序斷言都先各自斷言「兩者都存在」。
 */
describe('WP-69 T5 — main.ts 的 orchestrator hold 接線沒有漂移', () => {
  const raw = import.meta.glob<string>('../../main.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })['../../main.ts']!;
  const source = stripComments(raw);

  const endedBranch = (() => {
    const start = source.indexOf("if (!resultShown && phase === 'ended')");
    expect(start).toBeGreaterThan(-1);
    return source.slice(start, source.indexOf('\n  }', start));
  })();

  it('hold 在 buildsPayload 分岔之前跑（discarded 那條路徑下一行就 return 了）', () => {
    const holdAt = endedBranch.indexOf('if (!plan.advancesOrchestrator) holdOrchestratorsOnAttempt(plan);');
    const buildGuardAt = endedBranch.indexOf('if (!plan.buildsPayload)');
    expect(holdAt).toBeGreaterThan(-1);
    expect(buildGuardAt).toBeGreaterThan(-1);
    expect(holdAt).toBeLessThan(buildGuardAt);
  });

  it('hold 仍在第一個 await 之前（T4.4 的同一條順序）', () => {
    const holdAt = endedBranch.indexOf('holdOrchestratorsOnAttempt(plan)');
    const awaitAt = endedBranch.indexOf('await ');
    expect(holdAt).toBeGreaterThan(-1);
    expect(awaitAt).toBeGreaterThan(-1);
    expect(holdAt).toBeLessThan(awaitAt);
  });

  it('hold 只讀 plan：不從 meta.suspect／pointerLockLost 重算 disposition（C-D4）', () => {
    const start = source.indexOf('function holdOrchestratorsOnAttempt(');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('\n}', start));
    expect(body).toContain('describeAttemptHold(plan)');
    expect(body).not.toContain('suspect');
    expect(body).not.toContain('pointerLockLost');
  });

  it('pilot 的 held 入口是 handleInvalidAttempt，且 abortCurrentBlock 不在 hold 路徑上（FM-6）', () => {
    const start = source.indexOf('function holdOrchestratorsOnAttempt(');
    const body = source.slice(start, source.indexOf('\n}', start));
    expect(body).toContain('trackingPilotSession?.handleInvalidAttempt(plan.disposition)');
    expect(body).not.toContain('abortCurrentBlock');
    expect(body).not.toContain('handleDrillEnded');
  });

  it('pilot 接手後立刻 return：一個事件一個通道，不會再蓋上泛用文案', () => {
    // 這條只能靠掃描：pilot 在跑時 Session/Protocol 都不是 active，所以少了這個 `return` 目前
    // 不改變任何可觀察行為——但它是「pilot 的 status 才是權威」這句話唯一的落點。
    const start = source.indexOf('function holdOrchestratorsOnAttempt(');
    const body = source.slice(start, source.indexOf('\n}', start));
    const pilotAt = body.indexOf('handleInvalidAttempt(plan.disposition) === true) return;');
    const statusAt = body.indexOf('setProtocolStatus(notice, false)');
    expect(pilotAt).toBeGreaterThan(-1);
    expect(statusAt).toBeGreaterThan(-1);
    expect(pilotAt).toBeLessThan(statusAt);
  });

  it('hold 不推進任何 runner：advance／completeCurrentCondition 都不在它的 body 裡', () => {
    const start = source.indexOf('function holdOrchestratorsOnAttempt(');
    const body = source.slice(start, source.indexOf('\n}', start));
    expect(body).not.toContain('.advance()');
    expect(body).not.toContain('completeActiveProtocolCondition');
    expect(body).not.toContain('completeCurrentCondition');
  });

  it('session phase 讀取點有顯式型別標註（union 改動要編譯期爆掉，T5 DoD 第 6 條）', () => {
    const start = source.indexOf('function holdOrchestratorsOnAttempt(');
    const body = source.slice(start, source.indexOf('\n}', start));
    expect(body).toContain('const sessionPhase: SessionRunnerPhase = sessionPlanRunner.phase;');
  });
});

/** 逐字掃描前剝註解：`main.ts` 的散文裡就寫著它所描述的呼叫名（T4.9 #1）。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}
