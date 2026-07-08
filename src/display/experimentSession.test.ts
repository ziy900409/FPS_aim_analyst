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

  it('flags suspect and warns once when fullscreen exits mid-session', () => {
    const onSuspect = vi.fn();
    const session = createExperimentSession({ onSuspect });
    session.enter(PASS_REPORT);

    session.handleFullscreenChange(false);

    expect(session.suspect).toBe(true);
    expect(onSuspect).toHaveBeenCalledTimes(1);
  });

  it('does not re-fire onSuspect on repeated fullscreen exits', () => {
    const onSuspect = vi.fn();
    const session = createExperimentSession({ onSuspect });
    session.enter(PASS_REPORT);

    session.handleFullscreenChange(false);
    session.handleFullscreenChange(true);
    session.handleFullscreenChange(false);

    expect(session.suspect).toBe(true);
    expect(onSuspect).toHaveBeenCalledTimes(1);
  });

  it('ignores fullscreen changes before a session is entered', () => {
    const onSuspect = vi.fn();
    const session = createExperimentSession({ onSuspect });
    session.handleFullscreenChange(false);
    expect(session.suspect).toBe(false);
    expect(onSuspect).not.toHaveBeenCalled();
  });

  it('entering fullscreen (present=true) never raises suspect', () => {
    const session = createExperimentSession();
    session.enter(PASS_REPORT);
    session.handleFullscreenChange(true);
    expect(session.suspect).toBe(false);
  });

  it('retains gate and suspect after exit for the final export read', () => {
    const session = createExperimentSession();
    session.enter(PASS_REPORT);
    session.handleFullscreenChange(false);
    session.exit();
    expect(session.active).toBe(false);
    expect(session.suspect).toBe(true);
    expect(session.gate).toBe(PASS_REPORT);
  });
});
