import { describe, expect, it, vi } from 'vitest';
import { createExperimentSession } from './experimentSession.ts';
import type { GateReport } from './eligibilityGate.ts';

const PASS_REPORT: GateReport = {
  pass: true,
  native: true,
  fullscreen: true,
  perf: true,
  details: 'all pass',
};

describe('createExperimentSession', () => {
  it('starts inactive with no gate and no suspicion', () => {
    const session = createExperimentSession();
    expect(session.active).toBe(false);
    expect(session.suspect).toBe(false);
    expect(session.gate).toBeUndefined();
  });

  it('enter() activates the session and stores the gate report', () => {
    const session = createExperimentSession();
    session.enter(PASS_REPORT);
    expect(session.active).toBe(true);
    expect(session.gate).toBe(PASS_REPORT);
  });

  it('flags suspect and warns once when fullscreen exits while recording', () => {
    const onSuspect = vi.fn();
    const session = createExperimentSession({ onSuspect });
    session.enter(PASS_REPORT);

    session.handleFullscreenChange(false, true);

    expect(session.suspect).toBe(true);
    expect(onSuspect).toHaveBeenCalledTimes(1);
  });

  it('does not re-fire onSuspect on repeated fullscreen exits', () => {
    const onSuspect = vi.fn();
    const session = createExperimentSession({ onSuspect });
    session.enter(PASS_REPORT);

    session.handleFullscreenChange(false, true);
    session.handleFullscreenChange(true, true);
    session.handleFullscreenChange(false, true);

    expect(session.suspect).toBe(true);
    expect(onSuspect).toHaveBeenCalledTimes(1);
  });

  it('ignores fullscreen changes before a session is entered', () => {
    const onSuspect = vi.fn();
    const session = createExperimentSession({ onSuspect });
    session.handleFullscreenChange(false, true);
    expect(session.suspect).toBe(false);
    expect(onSuspect).not.toHaveBeenCalled();
  });

  it('entering fullscreen (present=true) never raises suspect', () => {
    const session = createExperimentSession();
    session.enter(PASS_REPORT);
    session.handleFullscreenChange(true, true);
    expect(session.suspect).toBe(false);
  });

  it('retains gate and suspect after exit for the final export read', () => {
    const session = createExperimentSession();
    session.enter(PASS_REPORT);
    session.handleFullscreenChange(false, true);
    session.exit();
    expect(session.active).toBe(false);
    expect(session.suspect).toBe(true);
    expect(session.gate).toBe(PASS_REPORT);
  });

  it('KI-007：ignores fullscreen exit while not recording (idle between drills / drill ended)', () => {
    const onSuspect = vi.fn();
    const session = createExperimentSession({ onSuspect });
    session.enter(PASS_REPORT);

    session.handleFullscreenChange(false, false);

    expect(session.suspect).toBe(false);
    expect(onSuspect).not.toHaveBeenCalled();
  });

  it('KI-007：a fullscreen exit while not recording does not suppress detection once recording resumes', () => {
    const onSuspect = vi.fn();
    const session = createExperimentSession({ onSuspect });
    session.enter(PASS_REPORT);

    session.handleFullscreenChange(false, false); // idle 之間退出：不算
    session.handleFullscreenChange(true, false); // 下一個 drill 前重新進入全螢幕
    session.handleFullscreenChange(false, true); // 這次是錄製中途真的掉出

    expect(session.suspect).toBe(true);
    expect(onSuspect).toHaveBeenCalledTimes(1);
  });
});
