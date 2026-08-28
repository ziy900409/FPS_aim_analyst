import { describe, expect, it, vi } from 'vitest';
import { createPresentationCoordinator, type ReplayPresentationSession } from './PresentationCoordinator.ts';

function fakeSession(): ReplayPresentationSession & {
  frame: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
} {
  return { frame: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
}

describe('PresentationCoordinator', () => {
  it('starts in live mode and delegates frame()/resize() to the live deps', () => {
    const live = { frame: vi.fn(), resize: vi.fn() };
    const coordinator = createPresentationCoordinator(live);

    expect(coordinator.mode).toBe('live');
    coordinator.frame(123);
    coordinator.resize(800, 600);

    expect(live.frame).toHaveBeenCalledTimes(1);
    expect(live.frame).toHaveBeenCalledWith(123);
    expect(live.resize).toHaveBeenCalledTimes(1);
    expect(live.resize).toHaveBeenCalledWith(800, 600);
  });

  it('replay mode: frame()/resize() delegate solely to the session — live deps see zero calls (NFR-50.5 pump-isolation proxy)', () => {
    const live = { frame: vi.fn(), resize: vi.fn() };
    const coordinator = createPresentationCoordinator(live);
    const session = fakeSession();

    coordinator.enterReplay(session);
    expect(coordinator.mode).toBe('replay');

    for (let now = 0; now < 5000; now += 1000) coordinator.frame(now);
    coordinator.resize(1024, 768);

    expect(session.frame).toHaveBeenCalledTimes(5);
    expect(session.resize).toHaveBeenCalledTimes(1);
    expect(session.resize).toHaveBeenCalledWith(1024, 768);
    expect(live.frame).not.toHaveBeenCalled();
    expect(live.resize).not.toHaveBeenCalled();
  });

  it('leaveReplay() disposes the session exactly once and returns to live', () => {
    const live = { frame: vi.fn(), resize: vi.fn() };
    const coordinator = createPresentationCoordinator(live);
    const session = fakeSession();

    coordinator.enterReplay(session);
    coordinator.leaveReplay();

    expect(session.dispose).toHaveBeenCalledOnce();
    expect(coordinator.mode).toBe('live');

    coordinator.frame(1);
    expect(live.frame).toHaveBeenCalledTimes(1);
    expect(live.frame).toHaveBeenCalledWith(1);
    expect(session.frame).not.toHaveBeenCalled();
  });

  it('leaveReplay() while already live is an idempotent no-op', () => {
    const live = { frame: vi.fn(), resize: vi.fn() };
    const coordinator = createPresentationCoordinator(live);

    expect(() => coordinator.leaveReplay()).not.toThrow();
    expect(coordinator.mode).toBe('live');
  });

  it('enterReplay() while already in replay throws — rapid switch must leaveReplay() first, not silently swap', () => {
    const live = { frame: vi.fn(), resize: vi.fn() };
    const coordinator = createPresentationCoordinator(live);
    const first = fakeSession();
    const second = fakeSession();

    coordinator.enterReplay(first);
    expect(() => coordinator.enterReplay(second)).toThrow(/already in replay mode/);
    expect(first.dispose).not.toHaveBeenCalled();
  });

  it('50x enterReplay/leaveReplay cycles each dispose exactly their own session (no cross-cycle leak)', () => {
    const live = { frame: vi.fn(), resize: vi.fn() };
    const coordinator = createPresentationCoordinator(live);

    for (let i = 0; i < 50; i++) {
      const session = fakeSession();
      coordinator.enterReplay(session);
      coordinator.frame(i);
      coordinator.leaveReplay();
      expect(session.dispose).toHaveBeenCalledOnce();
      expect(coordinator.mode).toBe('live');
    }
  });

  it('dispose() while in replay disposes the active session; further calls throw', () => {
    const live = { frame: vi.fn(), resize: vi.fn() };
    const coordinator = createPresentationCoordinator(live);
    const session = fakeSession();

    coordinator.enterReplay(session);
    coordinator.dispose();

    expect(session.dispose).toHaveBeenCalledOnce();
    expect(() => coordinator.frame(0)).toThrow(/disposed/);
    expect(() => coordinator.enterReplay(fakeSession())).toThrow(/disposed/);
  });

  it('dispose() is idempotent — a second call does not re-dispose the session', () => {
    const live = { frame: vi.fn(), resize: vi.fn() };
    const coordinator = createPresentationCoordinator(live);
    const session = fakeSession();

    coordinator.enterReplay(session);
    coordinator.dispose();
    coordinator.dispose();

    expect(session.dispose).toHaveBeenCalledOnce();
  });
});
