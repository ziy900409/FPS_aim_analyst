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
  // KI-041 — `main.ts` 的 `#protocol-status` 閂鎖,同樣手抄。hold 文案不進閂鎖,新 attempt 開始時
  // 還原上一則 orchestrator 自己寫的狀態（`undefined` = 從未寫過 ⇒ 該元素在 app 那側是隱藏的）。
  let lastOrchestratorStatus: string | undefined;
  let holdNoticeShown = false;
  let writingHoldNotice = false;

  /** `setProtocolStatus()` 的分類半邊,restated。 */
  function setStatus(text: string): void {
    if (writingHoldNotice) holdNoticeShown = true;
    else {
      lastOrchestratorStatus = text;
      holdNoticeShown = false;
    }
    status = text;
  }

  /** `clearAttemptHoldNotice()`, restated. */
  function clearHoldNotice(): void {
    if (!holdNoticeShown) return;
    holdNoticeShown = false;
    status = lastOrchestratorStatus;
  }

  /**
   * Every drill load in `main.ts` runs through `resetRunPresentation()` — that is what makes the
   * finalization memo a per-attempt value rather than a per-session one. The rig's two loaders
   * therefore do the same; the first version of this file skipped it, and a stale memo let a
   * *later* held attempt quietly inherit the *earlier* clean attempt's plan.
   */
  function resetRunPresentation(): void {
    if (runAttempt.pauseOccurred && finalizedPlan === undefined) {
      const plan = (finalizedPlan ??= gate.decide(cleanSnapshot()));
      if (!plan.advancesOrchestrator) hold(plan);
    }
    finalizedPlan = undefined;
    runAttempt.restart();
    clearHoldNotice(); // KI-041 — 末端,與 `main.ts` 同一個位置
  }

  const session = createSessionRunner({
    loadDrillById: vi.fn(async () => {
      resetRunPresentation();
    }),
    onStatus: (text) => {
      setStatus(text);
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
      setStatus(text);
    },
  });

  /** `holdOrchestratorsOnAttempt()` in `main.ts`, restated. */
  function hold(plan: AttemptFinalizationPlan): void {
    const notice = describeAttemptHold(plan);
    if (notice === null || plan.disposition.kind === 'eligible-candidate') return;
    writingHoldNotice = true; // KI-041 — 這個區間內寫的一切都是 hold 文案（含 pilot 自己那一句）
    try {
      if (pilot.retryRunningBlock(plan.disposition) !== undefined) return;
      const sessionPhase: SessionRunnerPhase = session.phase;
      if (sessionPhase.kind !== 'run' && protocol.current === undefined) return;
      setStatus(notice);
    } finally {
      writingHoldNotice = false;
    }
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

  it('paused 時直接 Restart 仍 hold 同一個 step，且不下載（KI-041:狀態列回到該 step 的文案）', async () => {
    const rig = createRetryRig();
    await startSession(rig);
    const held = rig.session.phase;
    const statusBefore = rig.status();

    pauseWithoutResuming(rig);
    rig.restart();

    expect(rig.session.phase).toEqual(held);
    expect(rig.sessionDownloads).toEqual([]);
    // KI-041 / A1 — hold 的**記帳**（上面兩行）逐位不變;變的只有那句話的壽命。新 attempt 一開始
    // 它就失去指涉對象（四條 full-restart 路徑都緊接著 `drillRunner.start()`）,狀態列因此回到
    // orchestrator 自己上一次寫的文案 —— 此處正是同一個 step 的那一句,因為 hold 的定義就是沒前進。
    expect(rig.status()).toBe(statusBefore);
    expect(rig.status() ?? '').not.toContain('重新測試');
  });

  it('full restart 之後同一個 step 重跑，attempt +1、drill 不變（FR-69.6，T5 DoD 第 2 條）', async () => {
    const rig = createRetryRig();
    await startSession(rig);
    const held = rig.session.phase;
    const attemptBefore = rig.runAttempt.attempt;
    const statusBefore = rig.status();

    pauseAndResume(rig);
    await rig.endDrill('session');
    await settleTransitions();
    // KI-041 — 收工當下 hold 文案**必須**在（這是 FR-69.10 的告知,本次修復未放寬）…
    expect(rig.status()).toContain('重新測試');
    rig.restart();

    expect(rig.runAttempt.attempt).toBe(attemptBefore + 1);
    expect(rig.runAttempt.validity).toBe('eligible-candidate');
    expect(rig.session.phase).toEqual(held); // 同一個 drill/step，不是下一個
    // …而 restart 之後它必須消失。這是使用者實測回報的那條路徑（收工才作廢、之後才按重新測試）,
    // 與「暫停中直接 restart」那條在同一個點（`resetRunPresentation()` 末端）收斂。
    expect(rig.status()).toBe(statusBefore);
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

  it('paused 時直接 Restart 仍 hold 同一個 condition，且 exports[] 不長（KI-041:狀態列不留 hold 文案）', async () => {
    const rig = createRetryRig();
    await rig.protocol.start();
    const held = rig.protocol.current;
    const statusBefore = rig.status();

    pauseWithoutResuming(rig);
    rig.restart();

    expect(rig.protocol.current).toEqual(held);
    expect(rig.protocol.exports).toEqual([]);
    // KI-041 / A1。此處 `statusBefore` 是 `undefined`:protocol 的「條件 N/M」那一句由 `main.ts`
    // 的 `startProtocol()` 寫,不在本 rig 的模型內 ⇒ 還原的結果就是「回到沒有人寫過」,在 app 那側
    // 對應到整條狀態列收起。live 的那一半由 `wp69-pause-invalid-restart.spec.ts` 守。
    expect(rig.status()).toBe(statusBefore);
    expect(rig.status() ?? '').not.toContain('重新測試');
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

  it('paused 時直接 Restart 仍先 audit discarded，且同一 block 只增加一次 attempt', async () => {
    const rig = createRetryRig();
    await rig.pilot.start(smallManifest());

    pauseWithoutResuming(rig);
    rig.restart();

    expect(rig.pilot.phase).toMatchObject({ kind: 'running', blockIndex: 0, attempt: 2 });
    expect(rig.pilot.records).toEqual([]);
    expect(rig.pilot.invalidAttempts).toEqual([
      expect.objectContaining({
        blockIndex: 0,
        previousAttempt: 1,
        disposition: { kind: 'discarded', reason: 'pause-fence-unclosed' },
      }),
    ]);
  });

  it('ended invalid attempt 已 hold 後再 Restart 不會重複 audit', async () => {
    const rig = createRetryRig();
    await rig.pilot.start(smallManifest());

    pauseAndResume(rig);
    await rig.endDrill('pilot');
    rig.restart();

    expect(rig.pilot.phase).toMatchObject({ kind: 'running', blockIndex: 0, attempt: 2 });
    expect(rig.pilot.invalidAttempts).toHaveLength(1);
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

  it('paused navigation 在 restart 清狀態前先 hold，且 finalized memo 防止 ended 後重複 audit', () => {
    const start = source.indexOf('function resetRunPresentation()');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('\n}', start));
    const memoGuardAt = body.indexOf('runAttempt.pauseOccurred && finalizedPlan === undefined');
    const holdAt = body.indexOf('holdOrchestratorsOnAttempt(plan)');
    const restartAt = body.indexOf('runAttempt.restart()');
    expect(memoGuardAt).toBeGreaterThan(-1);
    expect(holdAt).toBeGreaterThan(-1);
    expect(restartAt).toBeGreaterThan(-1);
    expect(memoGuardAt).toBeLessThan(holdAt);
    expect(holdAt).toBeLessThan(restartAt);
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
