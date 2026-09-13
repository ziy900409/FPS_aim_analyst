import * as THREE from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';
import type { TargetState } from '../state/types.ts';
import {
  TARGET_HIT_CAP,
  createTargetHitRing,
  pushTargetHit,
  type TargetHitRing,
} from '../state/SharedState.ts';
import { HIT_FEEDBACK_HOLD_MS, TargetView } from './TargetView.ts';

/** 建一個 TargetState;預設 visible、box hitbox。 */
function target(over: Partial<TargetState> = {}): TargetState {
  return {
    id: over.id ?? 't',
    side: over.side ?? 'R',
    pos: over.pos ?? { x: 0, y: 1, z: 8 },
    visible: over.visible ?? true,
    alive: over.alive ?? true,
    hitbox: over.hitbox ?? { width: 1, height: 2, depth: 1, shape: 'box' },
    motion: over.motion,
    age: over.age,
    posPrev: over.posPrev,
  };
}

/** TargetView 的 pool mesh 型別(逐 mesh 持有自己的 MeshStandardMaterial clone)。 */
type TargetMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

/** scene 內由 TargetView 加入的 mesh(排除燈光等)。 */
function meshes(scene: THREE.Scene): TargetMesh[] {
  return scene.children.filter((c): c is TargetMesh => c instanceof THREE.Mesh);
}

/**
 * 建一個已啟用命中回饋、且已與 ring 對齊高水位的 view —— 等同實機 drill 開場:
 * `setHitFeedback(true)` 後第一個 render frame 先對齊(此時 ring 剛被 `resetTargetHitRing` 清空)。
 */
function armedView(scene: THREE.Scene, ring: TargetHitRing, targets: readonly TargetState[]): TargetView {
  const view = new TargetView(scene);
  view.setHitFeedback(true);
  view.sync(targets, 1, ring, 0);
  return view;
}

describe('TargetView — 依 state 唯讀顯示/隱藏目標 mesh(FR-4.1)', () => {
  it('visible 目標 → 場景出現對應 mesh,位置/尺寸取自 state', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([target({ pos: { x: -2, y: 1.5, z: 6 }, hitbox: { width: 1, height: 3, depth: 2, shape: 'box' } })]);

    const ms = meshes(scene);
    expect(ms).toHaveLength(1);
    expect(ms[0].visible).toBe(true);
    expect(ms[0].position.toArray()).toEqual([-2, 1.5, 6]);
    // 單位 box 以 scale 套 hitbox 尺寸(hitbox 與 mesh 同來源)。
    expect(ms[0].scale.toArray()).toEqual([1, 3, 2]);
  });

  it('visible=false → mesh 隱藏', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([target({ visible: true })]);
    expect(meshes(scene)[0].visible).toBe(true);

    view.sync([target({ visible: false })]);
    expect(meshes(scene)[0].visible).toBe(false);
  });

  it('mesh 重用:目標數變動不新建 mesh(GC 紀律)', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    // 兩個可見目標 → 池長 2。
    view.sync([target({ id: 'a', side: 'L' }), target({ id: 'b', side: 'R' })]);
    expect(view.poolSize).toBe(2);
    expect(meshes(scene).filter((m) => m.visible)).toHaveLength(2);

    // 降到一個 → 池不縮(重用),多出的 mesh 隱藏。
    view.sync([target({ id: 'a', side: 'L' })]);
    expect(view.poolSize).toBe(2);
    expect(meshes(scene).filter((m) => m.visible)).toHaveLength(1);

    // 回到兩個 → 沿用既有池,不新建。
    view.sync([target({ id: 'a', side: 'L' }), target({ id: 'b', side: 'R' })]);
    expect(view.poolSize).toBe(2);
    expect(meshes(scene).filter((m) => m.visible)).toHaveLength(2);
  });

  it('隱藏中的目標不佔用池 slot(只有 visible 者映射到 mesh)', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([
      target({ id: 'a', visible: false }),
      target({ id: 'b', visible: true }),
    ]);
    expect(view.poolSize).toBe(1);
    expect(meshes(scene).filter((m) => m.visible)).toHaveLength(1);
  });

  it('render alpha 內插：posPrev→pos，alpha=0→posPrev、1→pos、0.5→中點（WP-18/T3，render-only）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);
    const moving = (): TargetState =>
      target({ pos: { x: 4, y: 1.5, z: -8 }, posPrev: { x: 0, y: 1.5, z: -8 } });

    view.sync([moving()], 0);
    expect(meshes(scene)[0].position.toArray()).toEqual([0, 1.5, -8]); // α=0 → posPrev

    view.sync([moving()], 1);
    expect(meshes(scene)[0].position.toArray()).toEqual([4, 1.5, -8]); // α=1 → pos

    view.sync([moving()], 0.5);
    expect(meshes(scene)[0].position.toArray()).toEqual([2, 1.5, -8]); // α=0.5 → 中點
  });

  it('無 posPrev → 退回讀 pos（向後相容；alpha 省略＝1）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([target({ pos: { x: -2, y: 1.5, z: 6 } })]); // 無 posPrev、alpha 預設 1
    expect(meshes(scene)[0].position.toArray()).toEqual([-2, 1.5, 6]);
  });

  it('sync 不寫回 state（render 唯讀；posPrev/pos 不被修改）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);
    const t = target({ pos: { x: 4, y: 1.5, z: -8 }, posPrev: { x: 0, y: 1.5, z: -8 } });

    view.sync([t], 0.5);
    expect(t.pos).toEqual({ x: 4, y: 1.5, z: -8 });
    expect(t.posPrev).toEqual({ x: 0, y: 1.5, z: -8 });
  });

  it('setShape(\'sphere\') 後新 spawn 的目標渲染為 SphereGeometry（WP-46/T3 FR-46.3）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.setShape('sphere');
    view.sync([target()]);

    expect(meshes(scene)[0].geometry).toBeInstanceOf(THREE.SphereGeometry);
  });

  it('既有 pool mesh（非新建）換形狀後 geometry 參照同步更新（WP-46/T3）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([target()]);
    const existingMesh = meshes(scene)[0];
    expect(existingMesh.geometry).toBeInstanceOf(THREE.BoxGeometry);

    view.setShape('sphere');

    // 同一個 mesh 物件（identity 不變），geometry 已換成新的。
    expect(meshes(scene)[0]).toBe(existingMesh);
    expect(existingMesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
  });

  it('連續呼叫 setShape(\'box\') 同形狀為 no-op：不重複 dispose 舊 geometry（WP-46/T3）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([target()]);
    const geometryBefore = meshes(scene)[0].geometry;
    const disposeSpy = vi.spyOn(geometryBefore, 'dispose');

    view.setShape('box');
    view.setShape('box');

    expect(disposeSpy).not.toHaveBeenCalled();
    expect(meshes(scene)[0].geometry).toBe(geometryBefore);
  });

  it('hitbox.visualSize 存在時 mesh 改套 visualSize 尺寸，不讀 hitbox.width/height/depth（WP-52 masked pilot，GD-7 記名例外）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([
      target({
        hitbox: { width: 0.14, height: 0.14, depth: 1, shape: 'box', visualSize: { width: 0.349, height: 0.349, depth: 1 } },
      }),
    ]);

    expect(meshes(scene)[0].scale.toArray()).toEqual([0.349, 0.349, 1]);
  });

  it('hitbox.visualSize 省略 → 沿用 hitbox 尺寸（既有行為逐位不變）', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([target({ hitbox: { width: 0.14, height: 0.14, depth: 1, shape: 'box' } })]);

    expect(meshes(scene)[0].scale.toArray()).toEqual([0.14, 0.14, 1]);
  });

  it('dispose 後場景清空且池歸零', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);
    view.sync([target({ id: 'a' }), target({ id: 'b' })]);
    view.dispose();
    expect(meshes(scene)).toHaveLength(0);
    expect(view.poolSize).toBe(0);
  });
});

/**
 * WP-66 / T2 — 命中視覺回饋(render-only)。
 *
 * 反證優先:第一條測的是「不帶 ring 時逐位不變」(FM-1),因為本 WP 最大的風險不是「亮不起來」,
 * 而是**未指名的 drill 被無聲改掉視覺**。
 */
describe('TargetView — 命中視覺回饋(WP-66/T2:FR-66.4~66.7)', () => {
  /** 與 TargetView.ts 的模組常數逐字對照(該常數未匯出,刻意不讓 render 以外的層讀到)。 */
  const HIT_EMISSIVE = 0xff8a3d;
  const NO_EMISSIVE = 0x000000;
  /** 本 WP 前的材質基準:`MeshStandardMaterial({ color: 0xd94f4f, roughness: 0.6 })`。 */
  const TARGET_COLOR = 0xd94f4f;

  it('FM-1 反證:不帶 hits/nowMs 時,材質三屬性與本 WP 前逐位相同', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);

    view.sync([target({ id: 'a' })]);

    const m = meshes(scene)[0].material;
    expect(m.emissive.getHex()).toBe(NO_EMISSIVE);
    expect(m.color.getHex()).toBe(TARGET_COLOR);
    expect(m.roughness).toBe(0.6);
  });

  /**
   * FM-1 的行為版反證。**必須跑滿兩幀**:未啟用的 view 其高水位恆為 `-1`,若只跑一幀,
   * 任何「漏判 `#hitFeedback`」的錯誤都會被第一幀的高水位對齊分支吃掉而測不出來
   * (變異注入 M-B 實測過這個假綠燈)。第二幀才是真的在考驗開關。
   */
  it('setHitFeedback 未啟用:逐幀帶 ring 且期間有命中,仍不亮(FM-1)', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene); // 預設 false
    const ring = createTargetHitRing();
    const only = (): TargetState[] => [target({ id: 'a' })];

    view.sync(only(), 1, ring, 0); // 未啟用的 drill 照樣逐幀 sync
    pushTargetHit(ring, 'a');
    view.sync(only(), 1, ring, 1000);

    expect(meshes(scene)[0].material.emissive.getHex()).toBe(NO_EMISSIVE);
  });

  it('命中 → 亮起;HOLD_MS 到期 → 熄滅(邊界 nowMs === until 當下已熄)', () => {
    const scene = new THREE.Scene();
    const ring = createTargetHitRing();
    const only = (): TargetState[] => [target({ id: 'a' })];
    const view = armedView(scene, ring, only());
    expect(meshes(scene)[0].material.emissive.getHex()).toBe(NO_EMISSIVE); // 開場未命中

    pushTargetHit(ring, 'a');
    view.sync(only(), 1, ring, 1000);
    expect(meshes(scene)[0].material.emissive.getHex()).toBe(HIT_EMISSIVE);

    // 到期前一毫秒仍亮。
    view.sync(only(), 1, ring, 1000 + HIT_FEEDBACK_HOLD_MS - 1);
    expect(meshes(scene)[0].material.emissive.getHex()).toBe(HIT_EMISSIVE);

    // 到期邊界(nowMs === until)即熄。
    view.sync(only(), 1, ring, 1000 + HIT_FEEDBACK_HOLD_MS);
    expect(meshes(scene)[0].material.emissive.getHex()).toBe(NO_EMISSIVE);
  });

  it('HOLD_MS 內再次命中 → 重新起算,原到期時刻之後仍亮(FR-66.5)', () => {
    const scene = new THREE.Scene();
    const ring = createTargetHitRing();
    const only = (): TargetState[] => [target({ id: 'a' })];
    const view = armedView(scene, ring, only());

    pushTargetHit(ring, 'a');
    view.sync(only(), 1, ring, 1000); // until = 1120

    pushTargetHit(ring, 'a');
    view.sync(only(), 1, ring, 1100); // 重新起算 → until = 1220

    // 原到期時刻(1120)之後仍亮 —— 若沒重新起算,這裡會是 NO_EMISSIVE。
    view.sync(only(), 1, ring, 1150);
    expect(meshes(scene)[0].material.emissive.getHex()).toBe(HIT_EMISSIVE);

    view.sync(only(), 1, ring, 1220);
    expect(meshes(scene)[0].material.emissive.getHex()).toBe(NO_EMISSIVE);
  });

  it('FM-2:目標撤除後同一 pool 槽位被新目標取用,新目標不亮', () => {
    const scene = new THREE.Scene();
    const ring = createTargetHitRing();
    const view = armedView(scene, ring, [target({ id: 'a' })]);

    pushTargetHit(ring, 'a');
    view.sync([target({ id: 'a' })], 1, ring, 1000);
    const slot0 = meshes(scene)[0];
    expect(slot0.material.emissive.getHex()).toBe(HIT_EMISSIVE);

    // a 撤除、b 成為本幀第 0 個顯示目標 ⇒ 佔用同一個 pool mesh,且仍在 a 的 HOLD 窗內。
    view.sync([target({ id: 'b' })], 1, ring, 1010);
    expect(meshes(scene)[0]).toBe(slot0); // 確實是同一個 mesh 物件(槽位重用)
    expect(slot0.material.emissive.getHex()).toBe(NO_EMISSIVE);
  });

  it('同幀多目標:命中者亮、未命中者不亮(FR-66.6)', () => {
    const scene = new THREE.Scene();
    const ring = createTargetHitRing();
    const both = (): TargetState[] => [target({ id: 'a' }), target({ id: 'b' })];
    const view = armedView(scene, ring, both());

    pushTargetHit(ring, 'a');
    view.sync(both(), 1, ring, 1000);

    const ms = meshes(scene);
    expect(ms[0].material.emissive.getHex()).toBe(HIT_EMISSIVE);
    expect(ms[1].material.emissive.getHex()).toBe(NO_EMISSIVE);
  });

  it('本幀未用到的 pool mesh 一併熄滅(FM-2 第二條洩漏路徑)', () => {
    const scene = new THREE.Scene();
    const ring = createTargetHitRing();
    const both = (): TargetState[] => [target({ id: 'a' }), target({ id: 'b' })];
    const view = armedView(scene, ring, both());

    pushTargetHit(ring, 'a');
    pushTargetHit(ring, 'b');
    view.sync(both(), 1, ring, 1000);
    expect(meshes(scene)[1].material.emissive.getHex()).toBe(HIT_EMISSIVE);

    // b 不再顯示 ⇒ slot 1 隱藏,且必須在隱藏的同時熄滅。
    view.sync([target({ id: 'a' })], 1, ring, 1010);
    const ms = meshes(scene);
    expect(ms[1].visible).toBe(false);
    expect(ms[1].material.emissive.getHex()).toBe(NO_EMISSIVE);
    expect(ms[0].material.emissive.getHex()).toBe(HIT_EMISSIVE); // a 仍在窗內
  });

  it('FM-4:sync() 對環形格零回寫(total/cursor/逐槽 id 與 seq 全數不變)', () => {
    const scene = new THREE.Scene();
    const ring = createTargetHitRing();
    const view = armedView(scene, ring, [target({ id: 'a' })]);
    pushTargetHit(ring, 'a');

    const before = {
      total: ring.total,
      cursor: ring.cursor,
      id: [...ring.id],
      seq: Float64Array.from(ring.seq),
    };

    view.sync([target({ id: 'a' })], 1, ring, 1000);
    view.sync([target({ id: 'a' })], 1, ring, 1200); // 含過期清理那一幀

    expect(Object.is(ring.total, before.total)).toBe(true);
    expect(Object.is(ring.cursor, before.cursor)).toBe(true);
    for (let i = 0; i < TARGET_HIT_CAP; i++) {
      expect(Object.is(ring.id[i], before.id[i])).toBe(true);
      expect(Object.is(ring.seq[i], before.seq[i])).toBe(true);
    }
  });

  it('ring 繞圈覆寫後仍以 seq 高水位增量消費(命中數 > TARGET_HIT_CAP 不誤判)', () => {
    const scene = new THREE.Scene();
    const ring = createTargetHitRing();
    const view = armedView(scene, ring, [target({ id: 'a' })]);

    // 一場 tracking run 約 250 次命中,遠超 CAP 64 ⇒ ring 已繞圈多次(T1 Surprise 2)。
    for (let i = 0; i < TARGET_HIT_CAP * 3 + 5; i++) pushTargetHit(ring, 'a');
    expect(ring.total).toBeGreaterThan(TARGET_HIT_CAP);

    view.sync([target({ id: 'a' })], 1, ring, 1000);
    expect(meshes(scene)[0].material.emissive.getHex()).toBe(HIT_EMISSIVE);

    // 之後沒有新命中 ⇒ 到期即熄(高水位已推到 total,不會被舊槽重新點亮)。
    view.sync([target({ id: 'a' })], 1, ring, 1000 + HIT_FEEDBACK_HOLD_MS);
    expect(meshes(scene)[0].material.emissive.getHex()).toBe(NO_EMISSIVE);
  });

  it('重開 drill 清空 ring(total 倒退)→ 不補亮上一場的命中', () => {
    const scene = new THREE.Scene();
    const ring = createTargetHitRing();
    const view = armedView(scene, ring, [target({ id: 't0' })]);

    pushTargetHit(ring, 't0');
    view.sync([target({ id: 't0' })], 1, ring, 1000);
    expect(meshes(scene)[0].material.emissive.getHex()).toBe(HIT_EMISSIVE);

    // 重開 drill:resetTargetHitRing() 後 total 歸零,而目標 id 由 TargetManager 自 t0 重編
    // ⇒ 新一場的 t0 絕不能因為上一場的命中而亮。
    const fresh = createTargetHitRing();
    view.sync([target({ id: 't0' })], 1, fresh, 2000);
    expect(meshes(scene)[0].material.emissive.getHex()).toBe(NO_EMISSIVE);
  });

  it('setHitFeedback(false) 立即熄滅殘留亮態(關閉後 sync 不再碰材質)', () => {
    const scene = new THREE.Scene();
    const ring = createTargetHitRing();
    const view = armedView(scene, ring, [target({ id: 'a' })]);

    pushTargetHit(ring, 'a');
    view.sync([target({ id: 'a' })], 1, ring, 1000);
    expect(meshes(scene)[0].material.emissive.getHex()).toBe(HIT_EMISSIVE);

    view.setHitFeedback(false);
    expect(meshes(scene)[0].material.emissive.getHex()).toBe(NO_EMISSIVE);

    view.sync([target({ id: 'a' })], 1, ring, 1010);
    expect(meshes(scene)[0].material.emissive.getHex()).toBe(NO_EMISSIVE);
  });

  it('逐 mesh 各持一份 material clone(不共用),且 poolSize 與啟用前相同(NFR-66.5)', () => {
    const sceneOff = new THREE.Scene();
    const viewOff = new TargetView(sceneOff);
    viewOff.sync([target({ id: 'a' }), target({ id: 'b' })]);

    const sceneOn = new THREE.Scene();
    const ring = createTargetHitRing();
    const viewOn = armedView(sceneOn, ring, [target({ id: 'a' }), target({ id: 'b' })]);

    expect(viewOn.poolSize).toBe(viewOff.poolSize); // clone 不改變 mesh 數 ⇒ draw call 不變
    const ms = meshes(sceneOn);
    expect(ms[0].material).not.toBe(ms[1].material);
    // clone 與模板同型別、同建構參數 ⇒ 同一 WebGPU pipeline(FM-6)。
    expect(ms[0].material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(ms[1].material.color.getHex()).toBe(TARGET_COLOR);
    expect(ms[1].material.roughness).toBe(0.6);
  });

  it('dispose 釋放每個 mesh 的 material clone', () => {
    const scene = new THREE.Scene();
    const view = new TargetView(scene);
    view.sync([target({ id: 'a' }), target({ id: 'b' })]);

    const spies = meshes(scene).map((m) => vi.spyOn(m.material, 'dispose'));
    view.dispose();

    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });
});
