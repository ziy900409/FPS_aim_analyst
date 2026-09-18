import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../../data/DataRecorder.ts';
import type { DrillPhase } from '../../drill/DrillRunner.ts';
import { createInputSampler } from '../../input/InputSampler.ts';
import type { Clock } from '../../loop/clock.ts';
import { SIM_HZ } from '../../loop/constants.ts';
import { createPausableTimeMapper } from '../../loop/pausableTimeMapper.ts';
import { createSimLoop } from '../../loop/SimLoop.ts';
import { createSharedState } from '../../state/SharedState.ts';
import type { PauseOverlayView } from '../../ui/PauseOverlay.ts';
import { createRunAttemptController } from '../RunAttemptController.ts';
import type { RecordingSnapshot } from '../recordingIntegrity.ts';

/**
 * WP-69 / T3 — the pause lifecycle as `main.ts` wires it, driven by the **real** modules:
 * `RunAttemptController`, `PausableTimeMapper`, `InputSampler` and `createSimLoop`. Only the two
 * things a unit test cannot have are faked: the browser's Pointer Lock and the camera consumer.
 *
 * `main.ts` itself is not importable (top-level await + WebGPU), so this rig restates its wiring.
 * The bottom `describe` guards that restatement against drift by scanning `main.ts`'s source for
 * the orderings the rig depends on — the same technique T2 used for `resetRunPresentation()`.
 *
 * The single most important ordering here is inside `beginPause()`: **freeze the mapper first**,
 * then open the attempt fence. Do it the other way round and the fence opens up over live active
 * time, which `pause-fence-unclosed` then reports as `discarded` — i.e. a correct pause would
 * destroy its own recording. The last test in the lifecycle block is that negative control.
 */

const FPS_60 = 1000 / 60;
const START_WALL = 1_000;
const RESUME_COUNTDOWN_MS = 3_000;

interface PauseRig {
  readonly runAttempt: ReturnType<typeof createRunAttemptController>;
  readonly mapper: ReturnType<typeof createPausableTimeMapper>;
  readonly state: ReturnType<typeof createSharedState>;
  readonly recorder: ReturnType<typeof createDataRecorder>;
  /** Views handed to the overlay, newest last — the operator-visible sequence. */
  readonly views: PauseOverlayView[];
  /** Camera deltas actually applied (the gate's observable effect). */
  readonly cameraDeltas: Array<readonly [number, number]>;
  /** `pointerLock.request()` call count — Resume must produce exactly one per click. */
  requestCalls(): number;
  setDrillPhase(phase: DrillPhase): void;
  /** One rAF frame, in `liveFrame()`'s order: pause runtime first, then map, then pump. */
  frame(wallMs: number): number;
  /** Browser events. */
  grantLock(): void;
  loseLock(): void;
  failLockWithError(): void;
  rejectRequest(reason: string): void;
  /** Operator actions. */
  clickResume(): void;
  clickRestart(): void;
  /** Gameplay input from a real `InputSampler` on a fake target. */
  keyDown(code: string, wallMs: number): void;
  keyUp(code: string, wallMs: number): void;
  fireDown(wallMs: number): void;
  mouseMove(dx: number, dy: number, wallMs: number): void;
  snapshotForIntegrity(): RecordingSnapshot;
}

function createPauseRig(options: { freezeMapperOnPause?: boolean } = {}): PauseRig {
  const freezeMapperOnPause = options.freezeMapperOnPause ?? true;
  const state = createSharedState();
  const recorder = createDataRecorder();
  const mapper = createPausableTimeMapper();
  const runAttempt = createRunAttemptController();
  const views: PauseOverlayView[] = [];
  const cameraDeltas: Array<readonly [number, number]> = [];
  const tickEnds: number[] = [];

  let drillPhase: DrillPhase = 'running';
  /** wall ms of the frame the pause is being taken on — set by the event that triggers it. */
  let nowWallForPause = START_WALL;
  let locked = false;
  let requestCalls = 0;
  let pendingRequest: { reject: (reason: Error) => void } | undefined;
  let resumeCountdownEndsAtWallMs: number | null = null;
  let pauseErrorView: PauseOverlayView | undefined;

  const isGameplayInputEnabled = (): boolean => runAttempt.phase === 'active';

  // ── fake Pointer Lock（`createPointerLock` 的可觀測介面：request / change / error / move） ──
  const changeCbs: Array<(next: boolean) => void> = [];
  const request = (): Promise<void> => {
    requestCalls += 1;
    return new Promise<void>((_resolve, reject) => {
      pendingRequest = { reject };
    });
  };
  const emitChange = (next: boolean): void => {
    if (next === locked) return; // `setLocked` 只在翻轉時通知（PointerLock.ts 的既有語意）
    locked = next;
    for (const cb of changeCbs) cb(next);
  };

  // ── fake target for the real InputSampler ──
  const listeners = new Map<string, Set<EventListener>>();
  const target: EventTarget = {
    addEventListener(type: string, cb: EventListener): void {
      const set = listeners.get(type) ?? new Set<EventListener>();
      set.add(cb);
      listeners.set(type, set);
    },
    removeEventListener(type: string, cb: EventListener): void {
      listeners.get(type)?.delete(cb);
    },
    dispatchEvent: () => true,
  };
  const dispatch = (type: string, ev: unknown): void => {
    for (const cb of listeners.get(type) ?? []) cb(ev as Event);
  };

  const inputSampler = createInputSampler(state, () => locked, {
    isGameplayInputEnabled,
    mapEventTime: (wallMs) => mapper.mapWallTime(wallMs),
  });
  inputSampler.attach(target);

  // ── main.ts 的 pause runtime，逐條重述 ──
  function beginPause(): void {
    if (runAttempt.phase === 'paused') return;
    // `freezeMapperOnPause: false` = 負向對照組（見檔頭）：只開 fence、不凍時鐘。
    const pausedAtActiveMs = freezeMapperOnPause
      ? mapper.pause(nowWallForPause)
      : mapper.mapWallTime(nowWallForPause); // 負向對照：只讀不凍
    runAttempt.pause(pausedAtActiveMs);
    inputSampler.suspend(nowWallForPause);
    resumeCountdownEndsAtWallMs = null;
  }

  function requestResume(): void {
    if (runAttempt.phase !== 'paused') return;
    runAttempt.beginResume();
    pauseErrorView = undefined;
    void request().catch((error: unknown) => {
      failResume(`重新取得滑鼠鎖定失敗：${error instanceof Error ? error.message : String(error)}`);
    });
  }

  function failResume(message: string): void {
    if (runAttempt.phase !== 'locking') return;
    pauseErrorView = { kind: 'paused', error: message };
    beginPause();
  }

  function confirmResumeLock(atWallMs: number): void {
    if (runAttempt.phase !== 'locking') return;
    runAttempt.confirmLock(atWallMs);
    resumeCountdownEndsAtWallMs = atWallMs + RESUME_COUNTDOWN_MS;
  }

  function updatePauseRuntime(nowWall: number): void {
    if (
      runAttempt.phase === 'resume-countdown' &&
      resumeCountdownEndsAtWallMs !== null &&
      nowWall >= resumeCountdownEndsAtWallMs
    ) {
      runAttempt.finishResumeCountdown(mapper.resume(nowWall));
      resumeCountdownEndsAtWallMs = null;
    }
    views.push(viewFor(nowWall));
  }

  function viewFor(nowWall: number): PauseOverlayView {
    switch (runAttempt.phase) {
      case 'active':
        return { kind: 'hidden' };
      case 'paused':
        return pauseErrorView ?? { kind: 'paused' };
      case 'locking':
        return { kind: 'locking' };
      default:
        return { kind: 'resume-countdown', remainingMs: (resumeCountdownEndsAtWallMs ?? nowWall) - nowWall };
    }
  }

  // main.ts 的第四個 onChange 訂閱者 + onError。
  changeCbs.push((next) => {
    if (next) {
      confirmResumeLock(lastWall);
      return;
    }
    if (drillPhase !== 'countdown' && drillPhase !== 'running') return;
    beginPause();
  });
  // camera consumer：只在鎖定中轉發（PointerLock 語意），再過 gameplay 閘（WP-69 T3）。
  const applyMove = (dx: number, dy: number): void => {
    if (!locked) return;
    if (!isGameplayInputEnabled()) return;
    cameraDeltas.push([dx, dy]);
  };

  const clock: Clock = { now: () => mapper.mapWallTime(START_WALL) };
  const sim = createSimLoop(state, clock, SIM_HZ, undefined, undefined, undefined, recorder, undefined, undefined, {
    afterTick(_s, tickEndMs): void {
      tickEnds.push(tickEndMs);
    },
  });

  let lastWall = START_WALL;

  return {
    runAttempt,
    mapper,
    state,
    recorder,
    views,
    cameraDeltas,
    requestCalls: () => requestCalls,
    setDrillPhase(phase): void {
      drillPhase = phase;
    },
    frame(wallMs): number {
      lastWall = wallMs;
      updatePauseRuntime(wallMs);
      return sim.pump(mapper.mapWallTime(wallMs)).ticks;
    },
    grantLock(): void {
      emitChange(true);
    },
    loseLock(): void {
      nowWallForPause = lastWall;
      emitChange(false);
    },
    failLockWithError(): void {
      // main.ts 的 `pointerLock.onError(...)` handler（`pointerlockerror` 不翻 `locked` ⇒ 不發 change）。
      nowWallForPause = lastWall;
      failResume('重新取得滑鼠鎖定失敗，請再按一次「繼續」。');
    },
    rejectRequest(reason): void {
      nowWallForPause = lastWall;
      pendingRequest?.reject(new Error(reason));
      pendingRequest = undefined;
    },
    clickResume(): void {
      requestResume();
    },
    clickRestart(): void {
      // `restartActiveDrill()` 的 attempt 半邊（其餘由 resetRunPresentation/buildSimLoop 負責）。
      mapper.restart(lastWall);
      runAttempt.restart();
      resumeCountdownEndsAtWallMs = null;
      pauseErrorView = undefined;
      recorder.reset();
    },
    keyDown(code, wallMs): void {
      dispatch('keydown', { code, timeStamp: wallMs, repeat: false });
    },
    keyUp(code, wallMs): void {
      dispatch('keyup', { code, timeStamp: wallMs });
    },
    fireDown(wallMs): void {
      dispatch('mousedown', { button: 0, timeStamp: wallMs });
    },
    mouseMove(dx, dy, wallMs): void {
      dispatch('pointermove', { movementX: dx, movementY: dy, timeStamp: wallMs });
      applyMove(dx, dy);
    },
    snapshotForIntegrity(): RecordingSnapshot {
      const snapshot = recorder.snapshot();
      return {
        ticks: tickEnds.map((t) => ({ t })),
        events: snapshot.events.map((e) => ({ t: e.t })),
        simHz: SIM_HZ,
        bufferOverflow: false,
        recorderOverflow: false,
      };
    },
  };
}

/** Run `count` frames at 60 FPS starting one period after `from`; returns the last wall time. */
function run(rig: PauseRig, from: number, count: number): number {
  let wall = from;
  for (let i = 1; i <= count; i += 1) {
    wall = from + i * FPS_60;
    rig.frame(wall);
  }
  return wall;
}

describe('WP-69 T3 — 錄製中掉鎖才 pause，且 pause 是 sticky 的（FR-69.1/69.2/69.3）', () => {
  it('running 掉鎖 → paused + invalid-paused', () => {
    const rig = createPauseRig();
    rig.grantLock();
    const wall = run(rig, START_WALL, 10);

    rig.loseLock();
    rig.frame(wall + FPS_60);

    expect(rig.runAttempt.phase).toBe('paused');
    expect(rig.runAttempt.validity).toBe('invalid-paused');
    expect(rig.runAttempt.pauseOccurred).toBe(true);
  });

  it.each<DrillPhase>(['armed', 'idle', 'ended'])(
    '%s 掉鎖不 pause、不失效（FR-69.3：開場釋鎖脈衝與收工釋鎖維持乾淨）',
    (phase) => {
      const rig = createPauseRig();
      rig.setDrillPhase(phase);
      rig.grantLock();
      run(rig, START_WALL, 5);

      rig.loseLock();

      expect(rig.runAttempt.phase).toBe('active');
      expect(rig.runAttempt.pauseOccurred).toBe(false);
    },
  );

  it('resume 完成後 validity 仍是 invalid-paused（sticky，只有 restart 能復原）', () => {
    const rig = createPauseRig();
    rig.grantLock();
    let wall = run(rig, START_WALL, 10);

    rig.loseLock();
    wall = run(rig, wall, 2);
    rig.clickResume();
    rig.grantLock();
    wall = run(rig, wall, 2);
    expect(rig.runAttempt.validity).toBe('invalid-paused');

    // 倒數跑完
    wall = run(rig, wall, Math.ceil(RESUME_COUNTDOWN_MS / FPS_60) + 2);
    expect(rig.runAttempt.phase).toBe('active');
    expect(rig.runAttempt.validity).toBe('invalid-paused'); // ← 這條是 FR-69.2 的全部重點
  });
});

describe('WP-69 T3 — pause 與 resume 倒數期間沒有任何 gameplay 偷跑（NFR-69.4）', () => {
  function pausedRig(): { rig: PauseRig; wall: number } {
    const rig = createPauseRig();
    rig.grantLock();
    let wall = run(rig, START_WALL, 10);
    rig.loseLock();
    wall = run(rig, wall, 2);
    return { rig, wall };
  }

  it('pause 期間 ring 寫入、camera delta、fire 與 tick 全部零新增', () => {
    const { rig, wall } = pausedRig();
    const ringBefore = rig.state.input.size();
    const overflowBefore = rig.state.inputMeta.bufferOverflow;
    const ticksBefore = rig.recorder.tickCount;
    const firesBefore = rig.recorder.fireCount;

    // 掉鎖後受試者亂按（滑鼠此時未鎖定，鍵盤事件照樣會抵達 window）
    let now = wall;
    for (let i = 0; i < 30; i += 1) {
      now += FPS_60;
      rig.keyDown('KeyD', now);
      rig.fireDown(now);
      rig.mouseMove(40, -20, now);
      expect(rig.frame(now)).toBe(0); // 每一幀都 0 個 tick（NFR-69.2）
    }

    expect(rig.state.input.size()).toBe(ringBefore);
    expect(rig.state.inputMeta.bufferOverflow).toBe(overflowBefore);
    expect(rig.cameraDeltas).toHaveLength(0);
    expect(rig.recorder.tickCount).toBe(ticksBefore);
    expect(rig.recorder.fireCount).toBe(firesBefore);
  });

  it('resume 倒數期間（鎖已拿回來）仍零新增 —— 只有這個閘擋著（FM-5）', () => {
    const { rig, wall } = pausedRig();
    rig.clickResume();
    rig.grantLock(); // 鎖已回來：`isLocked()` 為真，擋住的只剩 gameplay 閘
    const ringBefore = rig.state.input.size();

    let now = wall;
    for (let i = 0; i < 5; i += 1) {
      now += FPS_60;
      rig.keyDown('KeyD', now);
      rig.fireDown(now);
      rig.mouseMove(40, -20, now);
      expect(rig.frame(now)).toBe(0);
    }

    expect(rig.runAttempt.phase).toBe('resume-countdown');
    expect(rig.state.input.size()).toBe(ringBefore);
    expect(rig.cameraDeltas).toHaveLength(0);
  });

  it('倒數完成後 camera 與 ring 立刻恢復（閘不是 sticky，sticky 的是 validity）', () => {
    const { rig, wall } = pausedRig();
    rig.clickResume();
    rig.grantLock();
    let now = run(rig, wall, Math.ceil(RESUME_COUNTDOWN_MS / FPS_60) + 2);
    expect(rig.runAttempt.phase).toBe('active');

    now += FPS_60;
    rig.mouseMove(7, 3, now);
    rig.keyDown('KeyD', now);
    rig.frame(now);

    expect(rig.cameraDeltas).toEqual([[7, 3]]);
    expect(rig.state.input.size()).toBeGreaterThan(0);
  });

  it('pause 邊界補送 release edge，held 狀態不殘留（sim 消費後全部 false）', () => {
    const rig = createPauseRig();
    rig.grantLock();
    let wall = run(rig, START_WALL, 5);

    rig.keyDown('KeyD', wall + 1);
    rig.fireDown(wall + 2);
    wall = run(rig, wall, 3);
    expect(rig.state.held.right).toBe(true);
    expect(rig.state.heldFire).toBe(true);

    rig.loseLock();
    // resume 並跑完倒數，讓 sim 有機會消費 pause 邊界補送的 release edge
    rig.clickResume();
    rig.grantLock();
    run(rig, wall, Math.ceil(RESUME_COUNTDOWN_MS / FPS_60) + 4);

    expect(rig.state.held.right).toBe(false);
    expect(rig.state.heldFire).toBe(false);
  });
});

describe('WP-69 T3 — Resume 三路收斂（FR-69.4/69.5）', () => {
  function pausedRig(): { rig: PauseRig; wall: number } {
    const rig = createPauseRig();
    rig.grantLock();
    let wall = run(rig, START_WALL, 10);
    rig.loseLock();
    wall = run(rig, wall, 2);
    return { rig, wall };
  }

  it('成功：click → 一次 request → locking → 取鎖 → 倒數 → active', () => {
    const { rig, wall } = pausedRig();

    rig.clickResume();
    // request 必須在 click 回來之前就已經發出（user gesture stack 內，FM-4）——
    // 這裡不 await 任何東西，計數已經是 1。
    expect(rig.requestCalls()).toBe(1);
    expect(rig.runAttempt.phase).toBe('locking');

    rig.grantLock();
    expect(rig.runAttempt.phase).toBe('resume-countdown');

    const frames = Math.ceil(RESUME_COUNTDOWN_MS / FPS_60);
    run(rig, wall, frames - 1);
    expect(rig.runAttempt.phase).toBe('resume-countdown'); // 倒數期間不得提早解凍
    run(rig, wall + (frames - 1) * FPS_60, 2);
    expect(rig.runAttempt.phase).toBe('active');
  });

  it('error（pointerlockerror）：留在 paused 並帶可重試訊息', () => {
    const { rig, wall } = pausedRig();
    rig.clickResume();
    rig.failLockWithError();
    rig.frame(wall + FPS_60);

    expect(rig.runAttempt.phase).toBe('paused');
    expect(rig.views[rig.views.length - 1]).toEqual({
      kind: 'paused',
      error: '重新取得滑鼠鎖定失敗，請再按一次「繼續」。',
    });
  });

  it('request rejection：同樣留在 paused 並帶訊息（第二條收斂路徑）', async () => {
    const { rig, wall } = pausedRig();
    rig.clickResume();
    rig.rejectRequest('SecurityError');
    await Promise.resolve(); // catch 是 microtask
    rig.frame(wall + FPS_60);

    expect(rig.runAttempt.phase).toBe('paused');
    const view = rig.views[rig.views.length - 1]!;
    expect(view.kind).toBe('paused');
    expect(view.kind === 'paused' && view.error).toContain('SecurityError');
  });

  it('失敗後可以再按一次「繼續」並成功（不會卡在沒有出口的畫面）', () => {
    const { rig } = pausedRig();
    rig.clickResume();
    rig.failLockWithError();
    rig.clickResume();

    expect(rig.requestCalls()).toBe(2);
    rig.grantLock();
    expect(rig.runAttempt.phase).toBe('resume-countdown');
  });

  it('倒數途中再次掉鎖 → 回到 paused，且不開第二道 fence', () => {
    const { rig, wall } = pausedRig();
    rig.clickResume();
    rig.grantLock();
    run(rig, wall, 2);

    rig.loseLock();

    expect(rig.runAttempt.phase).toBe('paused');
    expect(rig.runAttempt.pauseFences).toHaveLength(1); // 同一次暫停,不是兩次
  });
});

describe('WP-69 T3 — pause fence 退化成一個點，錄製仍可證明連續（FR-69.8）', () => {
  it('pause → resume 後 fence 的兩端是同一個 double，finalize 得到 invalid-retained', () => {
    const rig = createPauseRig();
    rig.grantLock();
    let wall = run(rig, START_WALL, 20);

    rig.loseLock();
    wall = run(rig, wall, 120); // 暫停約兩秒的 wall time
    rig.clickResume();
    rig.grantLock();
    wall = run(rig, wall, Math.ceil(RESUME_COUNTDOWN_MS / FPS_60) + 2);
    run(rig, wall, 20);

    const fence = rig.runAttempt.pauseFences[0]!;
    expect(Object.is(fence.pausedAtMs, fence.resumedAtMs)).toBe(true);

    expect(rig.runAttempt.finalize(rig.snapshotForIntegrity())).toEqual({
      kind: 'invalid-retained',
      reason: 'paused',
    });
  });

  it('負向對照：pause 時不凍結 mapper ⇒ fence 張開 ⇒ discarded（pause-fence-unclosed）', () => {
    // 這正是 `beginPause()` 裡「先凍 mapper、再開 fence」那個順序在防的事。把順序做錯，
    // 一次正常的 pause→resume 會讓這一場被自己的 validator 丟掉。
    const rig = createPauseRig({ freezeMapperOnPause: false });
    rig.grantLock();
    let wall = run(rig, START_WALL, 20);

    rig.loseLock();
    wall = run(rig, wall, 120);
    rig.clickResume();
    rig.grantLock();
    wall = run(rig, wall, Math.ceil(RESUME_COUNTDOWN_MS / FPS_60) + 2);
    run(rig, wall, 20);

    const fence = rig.runAttempt.pauseFences[0]!;
    expect(fence.resumedAtMs!).toBeGreaterThan(fence.pausedAtMs);
    expect(rig.runAttempt.finalize(rig.snapshotForIntegrity())).toEqual({
      kind: 'discarded',
      reason: 'pause-fence-unclosed',
    });
  });
});

describe('WP-69 T3 — Restart 是 sticky invalidation 的唯一出口（FR-69.6）', () => {
  it('attempt +1、validity fresh、fence 清空、mapper 回 identity', () => {
    const rig = createPauseRig();
    rig.grantLock();
    const wall = run(rig, START_WALL, 10);
    rig.loseLock();
    run(rig, wall, 5);
    expect(rig.runAttempt.attempt).toBe(1);

    rig.clickRestart();

    expect(rig.runAttempt.attempt).toBe(2);
    expect(rig.runAttempt.validity).toBe('eligible-candidate');
    expect(rig.runAttempt.phase).toBe('active');
    expect(rig.runAttempt.pauseFences).toHaveLength(0);
    expect(rig.mapper.excludedWallMs).toBe(0);
    // identity 回來了：mapWallTime 回傳同一個 double
    expect(Object.is(rig.mapper.mapWallTime(12_345.678), 12_345.678)).toBe(true);
  });

  it('restart 之後 overlay 收起（操作員回到可以重新取鎖的畫面）', () => {
    const rig = createPauseRig();
    rig.grantLock();
    const wall = run(rig, START_WALL, 10);
    rig.loseLock();
    run(rig, wall, 3);
    expect(rig.views[rig.views.length - 1]).toEqual({ kind: 'paused' });

    rig.clickRestart();
    rig.frame(wall + 10 * FPS_60);
    expect(rig.views[rig.views.length - 1]).toEqual({ kind: 'hidden' });
  });
});

describe('WP-69 T3 — 未 pause 的路徑完全看不見本 WP（NFR-69.1）', () => {
  it('overlay 恆為 hidden、mapper 恆為 identity、attempt 恆為 eligible-candidate', () => {
    const rig = createPauseRig();
    rig.grantLock();
    let wall = START_WALL;
    for (let i = 1; i <= 60; i += 1) {
      wall = START_WALL + i * FPS_60;
      rig.keyDown('KeyD', wall - 1);
      rig.keyUp('KeyD', wall - 0.5);
      rig.mouseMove(2, 1, wall);
      rig.frame(wall);
    }

    expect(rig.views.every((view) => view.kind === 'hidden')).toBe(true);
    expect(rig.runAttempt.validity).toBe('eligible-candidate');
    expect(rig.runAttempt.pauseFences).toHaveLength(0);
    expect(rig.cameraDeltas).toHaveLength(60);
    expect(Object.is(rig.mapper.mapWallTime(wall), wall)).toBe(true);
  });
});

/**
 * 這個 rig 是 `main.ts` 接線的重述，重述就會漂移。下面掃描 `main.ts` 的原始碼，把 rig 依賴的幾個
 * 順序與接點釘住——不是為了測字串，而是因為這幾條的**順序**本身就是契約（見檔頭）。
 */
describe('WP-69 T3 — main.ts 的 pause 接線沒有漂移', () => {
  const source = import.meta.glob<string>('../../main.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })['../../main.ts']!;

  it('beginPause 把 mapper 的回傳值**直接**餵給 fence，再補 release edge', () => {
    const body = source.slice(source.indexOf('function beginPause()'));
    const fn = body.slice(0, body.indexOf('\n}'));
    // 逐字釘死巢狀呼叫,而不是「兩個呼叫的先後」：先算一次 active 再另外凍一次（兩次 `now()`）
    // 會讓 fence 的兩端相差一個 sliver,把 `pause-fence-unclosed` 從機械證明降級成容差
    // （D-69-T1-1／D-69-T2-1）。這個 regex 是那條契約唯一說得清楚的形狀。
    expect(fn).toMatch(/runAttempt\.pause\(timeMapper\.pause\(/);
    expect(fn.indexOf('inputSampler.suspend(')).toBeGreaterThan(fn.indexOf('runAttempt.pause('));
  });

  it('liveFrame 先跑 updatePauseRuntime，再 mapWallTime', () => {
    const body = source.slice(source.indexOf('function liveFrame('));
    const runtime = body.indexOf('updatePauseRuntime(now)');
    const map = body.indexOf('timeMapper.mapWallTime(now)');
    // `indexOf` 回 -1 也會滿足 `<`，所以「存在」必須先各自斷言一次 —— 少了這兩行，
    // 把整個呼叫刪掉反而會讓這條測試變綠（實測過）。
    expect(runtime).toBeGreaterThan(-1);
    expect(map).toBeGreaterThan(-1);
    expect(runtime).toBeLessThan(map);
  });

  it('resetRunPresentation 同時歸零 mapper 與 attempt', () => {
    const body = source.slice(source.indexOf('function resetRunPresentation()'));
    const end = body.indexOf('\n}');
    expect(body.slice(0, end)).toMatch(/timeMapper\.restart\(/);
    expect(body.slice(0, end)).toMatch(/runAttempt\.restart\(\)/);
  });

  it('InputSampler 與 camera consumer 共用同一個 gameplay 閘', () => {
    expect(source).toMatch(/pointerLock\.onMove\(\(dx, dy\) => \{[\s\S]*?isGameplayInputEnabled\(\)/);
    expect(source).toMatch(/createInputSampler\([\s\S]*?isGameplayInputEnabled,/);
  });

  it('InputSampler 的每一個戳記都經過 mapper（否則第二次暫停後事件會落在 wall 域）', () => {
    // 這個接點是**靜默**的：拿掉它，未暫停路徑仍然完全正常（mapper 是 identity），
    // 只有「暫停過一次之後」的事件戳記會悄悄落在 tick 窗外 ⇒ 沒有這條掃描就沒人擋得住。
    expect(source).toMatch(/createInputSampler\([\s\S]*?mapEventTime: \(wallMs\) => timeMapper\.mapWallTime\(wallMs\)/);
    expect(source).toMatch(/type: 'pointer_lock', locked, t: timeMapper\.mapWallTime\(/);
  });

  it('resume 倒數長度取自該 drill 的 timing.countdownMs（不另立常數）', () => {
    const body = source.slice(source.indexOf('function resolveResumeCountdownMs()'));
    expect(body.slice(0, body.indexOf('\n}'))).toMatch(/activeDrillConfig\.timing\.countdownMs/);
  });
});
