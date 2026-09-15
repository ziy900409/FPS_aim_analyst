import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPauseOverlay, type PauseOverlayView } from './PauseOverlay.ts';

/**
 * 無 DOM 的假 document（本專案 UI 測試慣例，見 Controls.test.ts / RestOverlay.test.ts）。
 * `createdCount` 是 NFR-69.5「建構期一次配置、更新路徑零新增 DOM node」的機械證據。
 */
class FakeElement {
  id = '';
  type = '';
  textContent = '';
  disabled = false;
  readonly style: Record<string, string> & { cssText: string; display: string } = {
    cssText: '',
    display: '',
  } as Record<string, string> & { cssText: string; display: string };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<() => void>>();
  removed = false;

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  remove(): void {
    this.removed = true;
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  /** 整棵子樹的文字（文案斷言用）。 */
  text(): string {
    return [this.textContent, ...this.children.map((child) => child.text())].join('\n');
  }
}

class FakeDocument {
  readonly body = new FakeElement();
  readonly buttons: FakeElement[] = [];
  createdCount = 0;

  createElement(tag: string): FakeElement {
    this.createdCount += 1;
    const element = new FakeElement();
    if (tag === 'button') this.buttons.push(element);
    return element;
  }
}

function mount(): {
  document: FakeDocument;
  overlay: ReturnType<typeof createPauseOverlay>;
  root: FakeElement;
  resumeClicks: number[];
  restartClicks: number[];
} {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  const resumeClicks: number[] = [];
  const restartClicks: number[] = [];
  const overlay = createPauseOverlay({
    onResume: () => resumeClicks.push(1),
    onRestart: () => restartClicks.push(1),
  });
  return { document, overlay, root: document.body.children[0]!, resumeClicks, restartClicks };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createPauseOverlay — 文案（T3 DoD：逐字釘住的三句）', () => {
  it('含「本次已失去實驗效力」「繼續仍無效」「只有完整重新測試才能再次接受門檻」', () => {
    const { root } = mount();
    const text = root.text();
    expect(text).toContain('本次已失去實驗效力');
    expect(text).toContain('繼續仍無效');
    expect(text).toContain('只有完整重新測試才能再次接受門檻');
  });

  it('提供 FR-69.4 指名的兩個按鈕（繼續（本次仍無效）／重新測試）', () => {
    const { document } = mount();
    expect(document.buttons.map((b) => b.textContent)).toEqual(['繼續（本次仍無效）', '重新測試']);
  });

  it('文案在建構期就存在，不必先 update() 才寫入（掉鎖當下第一幀即可讀）', () => {
    const { root } = mount();
    expect(root.text()).toContain('繼續仍無效');
  });
});

describe('createPauseOverlay — 可見性與四個 view', () => {
  it('建構後隱藏（hidden 是初始狀態，不是 update 出來的）', () => {
    // 初始隱藏寫在建構期的 `cssText` 裡（假 DOM 不解析 cssText → 不能讀 `style.display`）；
    // 之後的顯示/隱藏才走 `style.display`。這條釘的是「第一幀之前就已經是隱藏的」。
    const { root } = mount();
    expect(root.style.cssText).toContain('display:none');
    expect(root.attributes.get('aria-hidden')).toBe('true');
  });

  it('paused → 顯示、按鈕可按、無倒數數字', () => {
    const { overlay, root, document } = mount();
    overlay.update({ kind: 'paused' });

    expect(root.style.display).toBe('flex');
    expect(root.attributes.get('aria-hidden')).toBe('false');
    expect(document.buttons.every((b) => b.disabled)).toBe(false);
  });

  it('paused 帶 error → 顯示可重試訊息；回到無 error 時清掉（FR-69.5）', () => {
    const { overlay, root } = mount();
    const status = root.children[root.children.length - 1]!;

    overlay.update({ kind: 'paused', error: '取鎖失敗，請再按一次「繼續」' });
    expect(status.textContent).toBe('取鎖失敗，請再按一次「繼續」');

    overlay.update({ kind: 'paused' });
    expect(status.textContent).toBe('');
  });

  it('locking → 只停用「繼續」，「重新測試」維持可按（永遠留一個出口）', () => {
    const { overlay, document, root } = mount();
    overlay.update({ kind: 'locking' });

    expect(document.buttons[0]!.disabled).toBe(true); // 繼續
    expect(document.buttons[1]!.disabled).toBe(false); // 重新測試
    expect(root.children[root.children.length - 1]!.textContent).toBe('正在重新取得滑鼠鎖定…');
  });

  it('locking → paused（取鎖失敗）時「繼續」重新可按', () => {
    const { overlay, document } = mount();
    overlay.update({ kind: 'locking' });
    overlay.update({ kind: 'paused', error: '取鎖失敗' });
    expect(document.buttons.every((b) => b.disabled)).toBe(false);
  });

  it('resume-countdown → 隱藏按鈕、顯示無條件進位的整數秒', () => {
    const { overlay, root, document } = mount();
    const actions = root.children[4]!;
    const digits = root.children[3]!;

    overlay.update({ kind: 'resume-countdown', remainingMs: 3_000 });
    expect(digits.textContent).toBe('3');
    expect(actions.style.display).toBe('none');
    expect(document.buttons.length).toBe(2); // 隱藏,不是重建

    overlay.update({ kind: 'resume-countdown', remainingMs: 2_001 });
    expect(digits.textContent).toBe('3');
    overlay.update({ kind: 'resume-countdown', remainingMs: 1_999 });
    expect(digits.textContent).toBe('2');
  });

  it('resume-countdown 的剩餘值退化到 0 以下時仍顯示 1，不顯示「0」', () => {
    // 顯示 0 會被讀成「已經恢復」,而那恰恰是它還沒恢復的那一刻（同 DrillStartOverlay 的理由）。
    const { overlay, root } = mount();
    const digits = root.children[3]!;
    overlay.update({ kind: 'resume-countdown', remainingMs: 0 });
    expect(digits.textContent).toBe('1');
    overlay.update({ kind: 'resume-countdown', remainingMs: -50 });
    expect(digits.textContent).toBe('1');
  });

  it('hidden → 收起，且倒數數字不殘留到下一次顯示', () => {
    const { overlay, root } = mount();
    const digits = root.children[3]!;

    overlay.update({ kind: 'resume-countdown', remainingMs: 1_000 });
    overlay.update({ kind: 'hidden' });
    expect(root.style.display).toBe('none');

    overlay.update({ kind: 'paused' });
    expect(digits.textContent).toBe('');
    expect(digits.style.display).toBe('none');
  });
});

describe('createPauseOverlay — 回撥（FM-4：user gesture stack 內同步）', () => {
  it('Resume click 同步回撥（沒有 await / 排程跳板）', () => {
    const { document, resumeClicks } = mount();
    let observedDuringDispatch = 0;
    const resume = document.buttons[0]!;
    // dispatch 回來的當下就必須已經計數 —— 有任何跳板的話這裡會是 0。
    resume.dispatch('click');
    observedDuringDispatch = resumeClicks.length;
    expect(observedDuringDispatch).toBe(1);
  });

  it('Restart click 回撥，且與 Resume 互不觸發', () => {
    const { document, resumeClicks, restartClicks } = mount();
    document.buttons[1]!.dispatch('click');
    expect(restartClicks).toHaveLength(1);
    expect(resumeClicks).toHaveLength(0);
  });
});

describe('createPauseOverlay — 更新路徑零新增 DOM node（NFR-69.5）', () => {
  it('跑完所有 view 轉換後 createElement 呼叫數不變', () => {
    const { document, overlay } = mount();
    const afterConstruction = document.createdCount;

    const views: PauseOverlayView[] = [
      { kind: 'paused' },
      { kind: 'locking' },
      { kind: 'paused', error: 'x' },
      { kind: 'resume-countdown', remainingMs: 3_000 },
      { kind: 'resume-countdown', remainingMs: 1_200 },
      { kind: 'hidden' },
    ];
    for (let pass = 0; pass < 3; pass += 1) for (const view of views) overlay.update(view);

    expect(document.createdCount).toBe(afterConstruction);
  });

  it('dispose 把 root 摘掉', () => {
    const { overlay, root } = mount();
    overlay.dispose();
    expect(root.removed).toBe(true);
  });
});
