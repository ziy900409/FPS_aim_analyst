import * as THREE from 'three/webgpu';
import type { TargetState } from '../state/types.ts';
import { lerp } from '../loop/RenderLoop.ts';
import { TARGET_HIT_CAP, type TargetHitRing } from '../state/SharedState.ts';

/**
 * TargetView — WP-4 / T1b（FR-4.1）
 *
 * 渲染層（CONTEXT.md §B）:依 `SharedState.targets` **唯讀** 顯示/隱藏目標 mesh。
 * 狀態只由 sim（`TargetManager`，T2/T3）改；本檔絕不寫 state（README failure-mode
 * 「render 改目標狀態」)。可見性判定與 `t_visible` 蓋戳屬 sim 職責、不在此。
 *
 * GC 紀律（CLAUDE.md §4）:mesh **重用池**——不每幀/每 spawn `new Mesh`。共用一份單位
 * `BoxGeometry` 與一份 material,以 `mesh.scale` 套各目標 hitbox 尺寸,避免每目標配置新
 * geometry。多出的池內 mesh 隱藏(`visible=false`)而非銷毀,供下次 spawn 重用。
 *
 * hitbox 與 mesh 由同一 `TargetState.hitbox`(box:width/height/depth)衍生,確保視覺與
 * WP-5 raycast(`Box3`)判定同來源、不漂移(README failure-mode「hitbox 與 mesh 不一致」)。
 *
 * **WP-52 masked-visual pilot 例外(GD-7 記名例外,見 DECISIONS.md)**:`hitbox.visualSize` 存在時
 * mesh 改套這個尺寸,hit-test(`HitDetector`/`SimLoop.targetAabb`)、clearance、occlusion 仍讀
 * `hitbox.width/height/depth` 不受影響——render 是唯一讀 `visualSize` 的消費端。省略時逐位不變。
 *
 * **WP-66 命中回饋(hit feedback,T2)**:`setHitFeedback(true)` 後,`sync()` 唯讀消費
 * `SharedState.targetHits` 環形格(sim 唯寫),把本幀被命中的目標上 `emissive` 亮色、
 * `HIT_FEEDBACK_HOLD_MS` 內未再命中即熄滅。**render-only**:不新增命中判定(消費的是既有
 * 判定的結果)、不回寫 ring 任一欄位(高水位只存在本類私有欄位,FM-4)、不進 export/指標
 * (FR-66.12)。未啟用或未帶 ring 時,控制流與本 WP 前逐字相同、材質逐位不變(FM-1)。
 */

const TARGET_COLOR = 0xd94f4f;

/** 命中態維持時長(ms,render-only;OQ-66.2)。命中即重新起算;`nowMs === until` 當下已熄。 */
export const HIT_FEEDBACK_HOLD_MS = 120;
/** 命中態自體發光色。 */
const HIT_EMISSIVE = 0xff8a3d;
/** 未命中態 = `MeshStandardMaterial.emissive` 的預設值,故未啟用命中回饋時逐位不變。 */
const NO_EMISSIVE = 0x000000;

/** pool mesh:各自持有一份 `#material` 的 clone(型別/defines 相同 ⇒ 同 pipeline,FM-6)。 */
type TargetMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

export class TargetView {
  readonly #scene: THREE.Scene;
  /** 單位 geometry(box 1×1×1 / sphere 半徑 0.5);各目標以 mesh.scale 套 hitbox 尺寸,故只需一份。 */
  #geometry: THREE.BufferGeometry;
  #shape: 'box' | 'sphere' = 'box';
  /** 逐 mesh material 的**模板**;自身從不掛在任何 mesh 上(每個 pool mesh 各持一份 clone)。 */
  readonly #material: THREE.MeshStandardMaterial;
  /** mesh 重用池:index 對應本幀第 n 個顯示中的目標;多出者隱藏留用。 */
  readonly #pool: TargetMesh[] = [];
  /** 命中回饋開關(drill 層設定,WP-66/T3 接線);false 時 `sync()` 不讀 ring、不碰材質。 */
  #hitFeedback = false;
  /**
   * 各目標身分的命中態到期時刻(rAF `now` 域,ms)。鍵為 `TargetState.id`——**不是** pool 槽位
   * (FR-66.6/FM-2)。過期即刪 ⇒ 大小恆 ≤ 同時顯示的目標數,暖機後零配置。
   */
  readonly #flashUntil = new Map<string, number>();
  /**
   * 已消費到的 `targetHits.total` 高水位(比照 `ImpactView.#syncedSeq`)。
   * `-1` = 尚未與 ring 對齊(剛切換 `setHitFeedback`)⇒ 下次 `sync()` 只對齊、不補亮既有 backlog。
   */
  #syncedSeq = -1;

  constructor(scene: THREE.Scene) {
    this.#scene = scene;
    this.#geometry = this.#createGeometry('box');
    this.#material = new THREE.MeshStandardMaterial({
      color: TARGET_COLOR,
      roughness: 0.6,
    });
  }

  /** 建立單位 geometry;'sphere' 半徑 0.5 配合既有 mesh.scale 縮放慣例(三軸相等時仍為正圓球)。 */
  #createGeometry(shape: 'box' | 'sphere'): THREE.BufferGeometry {
    return shape === 'sphere' ? new THREE.SphereGeometry(0.5, 24, 16) : new THREE.BoxGeometry(1, 1, 1);
  }

  /** 切換 pool 共用 geometry(box/sphere);既有 pool mesh 就地換 geometry,不重建/不銷毀 mesh。 */
  setShape(shape: 'box' | 'sphere'): void {
    if (shape === this.#shape) return;
    this.#geometry.dispose();
    this.#geometry = this.#createGeometry(shape);
    this.#shape = shape;
    for (const mesh of this.#pool) mesh.geometry = this.#geometry;
  }

  /**
   * render frame 呼叫(唯讀):把顯示中的目標映射到池內 mesh、其餘隱藏。
   *
   * 顯示條件為 `visible`(是否已 spawn／在視野內——由 sim 於 t_visible 轉換 tick 設,T2);
   * `alive` 撤除語意屬 T3/WP-5,不在 T1b 收斂。
   *
   * **移動目標 render 內插(WP-18 / T3,render-only)**:`alpha ∈ [0,1]` 為 render 在兩 sim tick
   * 快照間的內插係數(比照 player 位置,RenderLoop)。mesh 位置取 `lerp(posPrev, pos, alpha)`——
   * 高 FPS 下移動目標畫面不抖。**絕不寫 state**(唯讀;posPrev/pos 皆由 sim 寫,GD-6/GD-10)。
   * `alpha` 省略＝1 → 讀 `pos`(既有靜止 drill 逐位不變);無 `posPrev`(直接注入目標)亦退回 `pos`。
   *
   * **命中回饋(WP-66 / T2,render-only)**:`hits` + `nowMs` 皆提供且 `setHitFeedback(true)` 時,
   * 才消費環形格並上 `emissive`;任一不成立即走與本 WP 前**逐字相同**的路徑(FM-1)。
   *
   * @param hits  命中環形格(**唯讀**;省略＝不做命中回饋,既有呼叫端逐位相容)
   * @param nowMs rAF 時間戳(wall clock,與 `performance.now()` 同域);`hits` 提供時必填
   */
  sync(targets: readonly TargetState[], alpha = 1, hits?: TargetHitRing, nowMs?: number): void {
    // FM-1 早退條件:三者皆成立才進入任何新程式碼。
    const feedback = this.#hitFeedback && hits !== undefined && nowMs !== undefined;
    if (feedback) this.#ingestHits(hits, nowMs);

    let used = 0;
    for (const t of targets) {
      if (!t.visible) continue;
      const mesh = this.#acquire(used++);
      // posPrev 存在 → 內插(alpha=1 → pos,零破壞);無 posPrev → 直接讀 pos(向後相容)。
      const prev = t.posPrev;
      if (prev !== undefined) {
        mesh.position.set(lerp(prev.x, t.pos.x, alpha), lerp(prev.y, t.pos.y, alpha), lerp(prev.z, t.pos.z, alpha));
      } else {
        mesh.position.set(t.pos.x, t.pos.y, t.pos.z);
      }
      const size = t.hitbox.visualSize ?? t.hitbox;
      mesh.scale.set(size.width, size.height, size.depth);
      mesh.visible = true;
      // 以 `t.id` 為鍵上色——**不以 pool 槽位為鍵**(FR-66.6/FM-2)。
      if (feedback) this.#paintHit(mesh, t.id, nowMs);
    }
    // 本幀未用到的池內 mesh 隱藏(重用、不銷毀)。
    for (let i = used; i < this.#pool.length; i++) {
      const mesh = this.#pool[i];
      mesh.visible = false;
      // FM-2 第二條洩漏路徑:此槽下次可能被**另一個**目標取用,先熄滅才不會把亮起態帶過去。
      if (feedback) mesh.material.emissive.setHex(NO_EMISSIVE);
    }
  }

  /**
   * 啟用／停用命中視覺回饋(drill 層設定;`main.ts` 於載入／換 drill／換武器／換場景四處呼叫)。
   * 停用時 `sync()` 不讀環形格、不改任何材質,輸出與本 WP 前逐位相同。
   *
   * 切換兩個方向都**重新對齊高水位**(`#syncedSeq = -1`):切換當下 ring 內既有的 backlog
   * 不得補亮——目標 id 由 `TargetManager` 每場自 `t0` 重編(`nextId = 0`),補亮等於讓上一場的
   * 命中點亮這一場的同名目標。停用時另需主動熄滅殘留亮態,否則之後 `sync()` 不再碰材質、會卡亮。
   */
  setHitFeedback(enabled: boolean): void {
    if (enabled === this.#hitFeedback) return;
    this.#hitFeedback = enabled;
    this.#syncedSeq = -1;
    this.#flashUntil.clear();
    if (enabled) return;
    for (const mesh of this.#pool) mesh.material.emissive.setHex(NO_EMISSIVE);
  }

  /**
   * 消費環形格新命中(**唯讀**:不寫 `total`／`cursor`／`seq`／`id` 任一欄位,FM-4)。
   *
   * 走 `seq` 高水位增量掃描而非「讀 total 筆」——一場 tracking run 的命中數(約 250)遠超
   * `TARGET_HIT_CAP`,ring 會繞圈覆寫(WP-66 T1 Surprise 2)。
   */
  #ingestHits(hits: TargetHitRing, nowMs: number): void {
    // 剛切換回饋(-1)或 ring 被重開 drill 清空(total 倒退)⇒ 只對齊高水位,不補亮 backlog。
    if (this.#syncedSeq < 0 || hits.total < this.#syncedSeq) {
      this.#flashUntil.clear();
      this.#syncedSeq = hits.total;
      return;
    }
    if (hits.total === this.#syncedSeq) return; // 無新命中(早退,零工作)
    const until = nowMs + HIT_FEEDBACK_HOLD_MS;
    for (let i = 0; i < TARGET_HIT_CAP; i++) {
      if (hits.seq[i] <= this.#syncedSeq) continue; // 舊槽已消費、空槽(seq=0)略過
      this.#flashUntil.set(hits.id[i], until); // 既有 key 直接覆寫 ⇒ 再次命中重新起算(FR-66.5)
    }
    this.#syncedSeq = hits.total;
  }

  /** 依身分上命中態;到期(`nowMs >= until`)即熄並清鍵,使 Map 恆 ≤ 同時顯示的目標數。 */
  #paintHit(mesh: TargetMesh, id: string, nowMs: number): void {
    const until = this.#flashUntil.get(id);
    const lit = until !== undefined && nowMs < until;
    mesh.material.emissive.setHex(lit ? HIT_EMISSIVE : NO_EMISSIVE);
    if (until !== undefined && !lit) this.#flashUntil.delete(id);
  }

  /** 目前池大小(建立過的 mesh 數);測試/診斷用。 */
  get poolSize(): number {
    return this.#pool.length;
  }

  /**
   * 依需擴充池:index 超出時建新 mesh(一次性加入 scene)、否則回收既有。
   *
   * 每個 mesh 持有 `#material` 的**自有 clone**(WP-66/T2,FM-6):型別與 defines 與模板完全相同
   * ⇒ 同一 WebGPU pipeline,執行期只改 `emissive` uniform,不會在首次命中才編 pipeline 而掉幀。
   * clone 數 = pool 大小 = 歷史上單幀最多顯示的目標數(tracking 1、micro-flick v8 3),於此
   * 一次性建立,熱路徑零配置(NFR-66.3)。
   */
  #acquire(i: number): TargetMesh {
    let mesh = this.#pool[i];
    if (mesh === undefined) {
      mesh = new THREE.Mesh(this.#geometry, this.#material.clone());
      this.#pool.push(mesh);
      this.#scene.add(mesh);
    }
    return mesh;
  }

  /** 釋放 GPU 資源(重開 drill／卸載);階段 A 場景長駐,通常不需呼叫。 */
  dispose(): void {
    for (const mesh of this.#pool) {
      this.#scene.remove(mesh);
      mesh.material.dispose(); // 逐 mesh clone 各自持有 GPU 資源(WP-66/T2)
    }
    this.#pool.length = 0;
    this.#geometry.dispose();
    this.#material.dispose(); // 模板本身未上任何 mesh,仍需釋放
    this.#flashUntil.clear();
    this.#syncedSeq = -1;
  }
}
