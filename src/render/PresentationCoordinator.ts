/**
 * PresentationCoordinator — WP-50 / T3（FR-50.11/NFR-50.5）
 *
 * 全應用同一時間最多一個 active presentation owner：`frame()` 在任何 live 邏輯（尤其
 * `simLoop.pump`）之前先依 mode 分流，replay 分支不落到 live 分支（D-50-P5）。main.ts 的既有
 * render callback 改為 live 分支的實作（本檔不知 sim/render 細節，只做 mode 互斥 + 委派）。
 *
 * 不散落 `if (replayActive)` 到多處（README §6 執行規則）：唯一分流點在 `frame()`/`resize()`，
 * 呼叫端（main.ts / T6 entry points）只需 `enterReplay()`/`leaveReplay()`。
 */

export interface ReplayPresentationSession {
  /** 每 app frame 呼叫一次；session 自行取樣/更新/render 自己的隔離 scene（不落到 live pump）。 */
  frame(nowMs: number): void;
  /** viewport 尺寸變更時呼叫；尚未完成 async 場景載入時可先緩存，待就緒後套用。 */
  resize(w: number, h: number): void;
  /** 釋放 session 擁有的所有資源（scene/camera/player/pending load）。呼叫後不得再呼叫其他方法。 */
  dispose(): void;
}

export type PresentationMode =
  | { readonly kind: 'live' }
  | { readonly kind: 'replay'; readonly session: ReplayPresentationSession };

export interface LivePresentationDeps {
  frame(nowMs: number): void;
  resize(w: number, h: number): void;
}

export interface PresentationCoordinator {
  readonly mode: PresentationMode['kind'];
  enterReplay(session: ReplayPresentationSession): void;
  leaveReplay(): void;
  frame(nowMs: number): void;
  resize(w: number, h: number): void;
  dispose(): void;
}

export function createPresentationCoordinator(live: LivePresentationDeps): PresentationCoordinator {
  let mode: PresentationMode = { kind: 'live' };
  let disposed = false;

  function assertNotDisposed(): void {
    if (disposed) throw new Error('PresentationCoordinator: cannot use a disposed coordinator');
  }

  return {
    get mode(): PresentationMode['kind'] {
      return mode.kind;
    },

    enterReplay(session: ReplayPresentationSession): void {
      assertNotDisposed();
      // 只允許從 live 態進入 replay（README §2.7「只允許從ended Result或History context進入」的
      // 上游前提由呼叫端保證；本層只守「同一時間最多一個 replay session」，rapid switch 須先
      // leaveReplay() 釋放前一個 — 不靜默 dispose-and-replace，避免呼叫端誤以為可以疊加。
      if (mode.kind === 'replay') {
        throw new Error('PresentationCoordinator: already in replay mode — call leaveReplay() first');
      }
      mode = { kind: 'replay', session };
    },

    leaveReplay(): void {
      assertNotDisposed();
      if (mode.kind !== 'replay') return; // 已在 live：idempotent no-op
      mode.session.dispose();
      mode = { kind: 'live' };
    },

    frame(nowMs: number): void {
      assertNotDisposed();
      if (mode.kind === 'replay') {
        mode.session.frame(nowMs);
        return;
      }
      live.frame(nowMs);
    },

    resize(w: number, h: number): void {
      assertNotDisposed();
      if (mode.kind === 'replay') {
        mode.session.resize(w, h);
        return;
      }
      live.resize(w, h);
    },

    dispose(): void {
      if (disposed) return;
      if (mode.kind === 'replay') mode.session.dispose();
      disposed = true;
    },
  };
}
