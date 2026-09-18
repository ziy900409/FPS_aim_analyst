import { describe, expect, it } from 'vitest';
import { createPointerLock } from './PointerLock.ts';

/**
 * WP-69 / T3 — `createPointerLock` 的首個單元測試。
 *
 * T0.2 的 blast radius 把這個模組標為「**無單元測試覆蓋**」，而 T3 要在它上面加一個新的
 * `onError` 接縫並讓 resume 的成敗完全依賴它。所以這裡只覆蓋 T3 真正依賴的那幾條語意，
 * 不追求把整個 Pointer Lock 生命週期一次補完（那不是本 task 的範圍）。
 *
 * 最關鍵的一條是最後那個 describe：`pointerlockerror` **不會**發出 change 回撥（`locked` 本來
 * 就是 false，`setLocked(false)` 是 no-op），所以少了 `onError` 就沒有任何取鎖失敗的訊號。
 */

type Listener = (ev?: unknown) => void;

class FakeEventTarget {
  readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, cb: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(cb);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, cb: Listener): void {
    this.listeners.get(type)?.delete(cb);
  }

  emit(type: string, ev?: unknown): void {
    for (const cb of [...(this.listeners.get(type) ?? [])]) cb(ev);
  }

  count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeDocument extends FakeEventTarget {
  pointerLockElement: unknown = null;
  readonly defaultView = new FakeEventTarget();
}

/** `requestPointerLock` 的三種行為：授予、不支援 unadjustedMovement、其他錯誤。 */
type RequestBehaviour = 'grant' | 'not-supported' | 'security-error' | 'void-return';

function setup(behaviour: RequestBehaviour = 'grant'): {
  lock: ReturnType<typeof createPointerLock>;
  doc: FakeDocument;
  canvas: { ownerDocument: FakeDocument };
  optionCalls: Array<unknown>;
} {
  const doc = new FakeDocument();
  const optionCalls: unknown[] = [];
  const canvas = {
    ownerDocument: doc,
    requestPointerLock(options?: unknown): Promise<void> | void {
      optionCalls.push(options);
      if (behaviour === 'void-return') return undefined;
      if (behaviour === 'not-supported' && options !== undefined) {
        const error = new Error('unadjustedMovement');
        error.name = 'NotSupportedError';
        return Promise.reject(error);
      }
      if (behaviour === 'security-error') {
        const error = new Error('no user gesture');
        error.name = 'SecurityError';
        return Promise.reject(error);
      }
      return Promise.resolve();
    },
  };
  const lock = createPointerLock(canvas as unknown as HTMLCanvasElement);
  return { lock, doc, canvas, optionCalls };
}

describe('createPointerLock — 取鎖成功（pointerlockchange 為權威）', () => {
  it('先試 unadjustedMovement；Promise resolve ⇒ rawInputEnabled', async () => {
    const { lock, optionCalls } = setup('grant');
    await lock.request();

    expect(optionCalls).toEqual([{ unadjustedMovement: true }]);
    expect(lock.rawInputEnabled).toBe(true);
  });

  it('locked 只由 pointerlockchange 翻，不由 request() 回傳翻', async () => {
    const { lock, doc } = setup('grant');
    const changes: boolean[] = [];
    lock.onChange((locked) => changes.push(locked));

    await lock.request();
    expect(lock.locked).toBe(false); // request 已 resolve，但事件還沒到
    expect(changes).toEqual([]);

    doc.pointerLockElement = doc; // 非 canvas ⇒ 不算我們的鎖
    doc.emit('pointerlockchange');
    expect(lock.locked).toBe(false);
  });

  it('pointerLockElement === canvas 時翻 locked 並通知一次', async () => {
    const { lock, doc, canvas } = setup('grant');
    const changes: boolean[] = [];
    lock.onChange((locked) => changes.push(locked));

    await lock.request();
    doc.pointerLockElement = canvas;
    doc.emit('pointerlockchange');
    doc.emit('pointerlockchange'); // 重複事件不重複通知

    expect(lock.locked).toBe(true);
    expect(changes).toEqual([true]);
  });
});

describe('createPointerLock — NotSupportedError fallback（WP-1 T3 / 附錄 B）', () => {
  it('降級到不帶 options 的 request，且不把錯誤丟給呼叫端', async () => {
    const { lock, optionCalls } = setup('not-supported');
    await expect(lock.request()).resolves.toBeUndefined();

    expect(optionCalls).toEqual([{ unadjustedMovement: true }, undefined]);
    expect(lock.rawInputEnabled).toBe(false); // 可重現性受影響 ⇒ WP-7 metadata 要記
  });

  it('非 NotSupportedError 不吞（缺手勢等失敗必須讓 resume 看得見）', async () => {
    const { lock } = setup('security-error');
    await expect(lock.request()).rejects.toThrow('no user gesture');
  });

  it('舊版回 void（無 Promise 可判定）⇒ 保守記為未啟用原始輸入', async () => {
    const { lock } = setup('void-return');
    await lock.request();
    expect(lock.rawInputEnabled).toBe(false);
  });
});

describe('createPointerLock — onError（WP-69 / T3，FR-69.5）', () => {
  it('pointerlockerror 發出 onError；且因為本來就沒鎖，一個 change 回撥都不會發', () => {
    const { lock, doc } = setup('grant');
    const changes: boolean[] = [];
    let errors = 0;
    lock.onChange((locked) => changes.push(locked));
    lock.onError(() => {
      errors += 1;
    });

    doc.emit('pointerlockerror');

    expect(errors).toBe(1);
    // ← 這一行就是 onError 存在的理由：沒有它，取鎖失敗在這個模組裡是完全無聲的。
    expect(changes).toEqual([]);
  });

  it('多個訂閱者都收到；解鎖狀態下重複 error 每次都發', () => {
    const { lock, doc } = setup('grant');
    const seen: string[] = [];
    lock.onError(() => seen.push('a'));
    lock.onError(() => seen.push('b'));

    doc.emit('pointerlockerror');
    doc.emit('pointerlockerror');

    expect(seen).toEqual(['a', 'b', 'a', 'b']);
  });
});

describe('createPointerLock — 只在鎖定中轉發 movement（避免殘留 delta）', () => {
  it('鎖定中轉發，解鎖後不再轉發', async () => {
    const { lock, doc, canvas } = setup('grant');
    const moves: Array<readonly [number, number]> = [];
    lock.onMove((dx, dy) => moves.push([dx, dy]));

    await lock.request();
    doc.emit('mousemove', { movementX: 5, movementY: 5 }); // 尚未鎖定
    expect(moves).toEqual([]);

    doc.pointerLockElement = canvas;
    doc.emit('pointerlockchange');
    doc.emit('mousemove', { movementX: 3, movementY: -2 });
    expect(moves).toEqual([[3, -2]]);

    doc.pointerLockElement = null;
    doc.emit('pointerlockchange');
    doc.emit('mousemove', { movementX: 9, movementY: 9 });
    expect(moves).toEqual([[3, -2]]);
  });

  it('失焦（blur）防禦性停止轉發', async () => {
    const { lock, doc, canvas } = setup('grant');
    const moves: Array<readonly [number, number]> = [];
    lock.onMove((dx, dy) => moves.push([dx, dy]));

    await lock.request();
    doc.pointerLockElement = canvas;
    doc.emit('pointerlockchange');
    doc.defaultView.emit('blur');

    doc.emit('mousemove', { movementX: 1, movementY: 1 });
    expect(lock.locked).toBe(false);
    expect(moves).toEqual([]);
  });
});
