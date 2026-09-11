import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDrillStartOverlay } from './DrillStartOverlay.ts';

class FakeElement {
  id = '';
  textContent = '';
  readonly style: Record<string, string> & { cssText: string } = { cssText: '' };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  removed = false;

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  remove(): void {
    this.removed = true;
  }
}

class FakeDocument {
  readonly body = new FakeElement();
  createdCount = 0;

  createElement(): FakeElement {
    this.createdCount += 1;
    return new FakeElement();
  }
}

/** 建 overlay 並回傳三個節點，省去每條測試重複挖 children。 */
function mount(): {
  document: FakeDocument;
  overlay: ReturnType<typeof createDrillStartOverlay>;
  root: FakeElement;
  prompt: FakeElement;
  digits: FakeElement;
} {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  const overlay = createDrillStartOverlay();
  const root = document.body.children[0];
  return { document, overlay, root, prompt: root.children[0], digits: root.children[1] };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createDrillStartOverlay', () => {
  it('起始為隱藏的惰性節點（尚未進待命相位前不得出現在畫面上）', () => {
    const { root, prompt, digits } = mount();

    expect(root.id).toBe('drill-start-overlay');
    expect(root.attributes.get('aria-hidden')).toBe('true');
    expect(root.style.cssText).toContain('display:none');
    expect(prompt.textContent).toBe('');
    expect(digits.textContent).toBe('');
  });

  it('待命相位顯示開始提示，數字行維持空白', () => {
    const { overlay, root, prompt, digits } = mount();

    overlay.update('armed', 0);

    expect(root.style.display).toBe('flex');
    expect(root.attributes.get('aria-hidden')).toBe('false');
    expect(prompt.textContent).toBe('點擊左鍵開始');
    expect(digits.textContent).toBe('');
  });

  it('倒數相位顯示「準備」與剩餘整數秒', () => {
    const { overlay, root, prompt, digits } = mount();

    overlay.update('countdown', 2_400);

    expect(root.style.display).toBe('flex');
    expect(prompt.textContent).toBe('準備');
    expect(digits.textContent).toBe('3');
  });

  it.each([
    ['running' as const],
    ['idle' as const],
    ['ended' as const],
  ])('%s 相位隱藏 overlay（不遮蔽遊戲畫面）', (phase) => {
    const { overlay, root } = mount();
    overlay.update('countdown', 1_500);

    overlay.update(phase, 0);

    expect(root.style.display).toBe('none');
    expect(root.attributes.get('aria-hidden')).toBe('true');
  });

  // `DrillRunner` 在 `nowMs - countdownStartMs >= countdownMs` 當下即轉 running ⇒ countdown 期間
  // 剩餘值恆 > 0，3000 與 1 是真實端點。0 只出現在「phase 已是 countdown 但首個 sim tick 未跑」
  // 的退化窗（getter 於 countdownStartMs === null 時回 0），此時顯示 0 會被讀成「倒數已結束」。
  it.each([
    [3_000, '3'],
    [2_999, '3'],
    [1, '1'],
    [0, '1'],
  ])('剩餘 %d ms 顯示為 %s', (remainingMs, expected) => {
    const { overlay, digits } = mount();

    overlay.update('countdown', remainingMs);

    expect(digits.textContent).toBe(expected);
  });

  it('3 → 2 → 1 逐秒遞減', () => {
    const { overlay, digits } = mount();
    const seen: string[] = [];

    for (const remainingMs of [3_000, 2_100, 1_100, 100]) {
      overlay.update('countdown', remainingMs);
      seen.push(digits.textContent);
    }

    expect(seen).toEqual(['3', '3', '2', '1']);
  });

  it('待命提示落在中線下方，倒數維持置中（不與置中的 #lock-hint 疊字）', () => {
    // 迴歸釘死：`#lock-hint`（「點擊以鎖定滑鼠視角（Esc 解除）」）也是 inset:0 置中，且只在
    // **未鎖定**時顯示——正好涵蓋待命相位。兩者都置中時實機上兩句話逐字疊在一起，兩句都讀不出來
    // （T3 首輪實機截圖抓到）。倒數時受試者已持鎖、lock-hint 自行隱藏，故數字可置中。
    const { overlay, root } = mount();

    overlay.update('armed', 0);
    expect(root.style.justifyContent).toBe('flex-end');
    expect(root.style.paddingBottom).toBe('22vh');

    overlay.update('countdown', 2_500);
    expect(root.style.justifyContent).toBe('center');
    expect(root.style.paddingBottom).toBe('0px');
  });

  it('根節點為 pointer-events:none —— 待命時的點擊必須穿透到 canvas 才取得到鎖（D-65-1）', () => {
    // 這條看似瑣碎，卻是「overlay 吃掉解除待命的那一次點擊 ⇒ drill 再也開不了」的唯一自動化防線。
    const { root } = mount();

    expect(root.style.cssText).toContain('pointer-events:none');
  });

  it('分層落在 HUD 與 rest backdrop 之上、Result dialog 與 drill-controls 之下', () => {
    const { root } = mount();

    const zIndex = Number.parseInt(/z-index:(\d+)/.exec(root.style.cssText)?.[1] ?? 'NaN', 10);
    expect(zIndex).toBeGreaterThan(20); // #metrics-hud = 18、#rest-overlay = 20
    expect(zIndex).toBeLessThan(30); // #result-screen = 30、#drill-controls = 32
  });

  it('連續 update 不新增節點、不重寫未變更的文字（NFR-65.7 的可測代理）', () => {
    const { document, overlay, root, digits } = mount();
    const createdAfterMount = document.createdCount;

    for (let i = 0; i < 100; i++) overlay.update('countdown', 2_500);

    expect(root.children.length).toBe(2);
    expect(document.createdCount).toBe(createdAfterMount); // update() 內零 createElement
    expect(digits.textContent).toBe('3');

    // 值未變時不碰 DOM：直接改掉節點內容，再 update 一次仍不應被覆寫回去。
    digits.textContent = 'sentinel';
    root.style.justifyContent = 'layout-sentinel'; // 版面同理：相位未變就不該重寫
    overlay.update('countdown', 2_500);
    expect(digits.textContent).toBe('sentinel');
    expect(root.style.justifyContent).toBe('layout-sentinel');
  });

  it('dispose 移除根節點', () => {
    const { overlay, root } = mount();

    overlay.dispose();

    expect(root.removed).toBe(true);
  });
});
