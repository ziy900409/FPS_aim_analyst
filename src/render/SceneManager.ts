import * as THREE from 'three/webgpu';

/**
 * SceneManager — WP-1 / T1（FR-1.1）
 *
 * 建出可見的封閉房間（地板 + 四牆 + 光）與 PerspectiveCamera，作為 WP-1 視角
 * 與 WP-4 目標的舞台。本檔屬「渲染」層（CONTEXT.md §B）：只擺場景與 camera，
 * 不碰 sim、不引入 accumulator（雙迴圈邊界，WP-2）。
 *
 * ⚠️ 單位：房間尺寸 / 眼高為 **render 端佔位常數**（THREE world unit；OQ-1.2，
 * 10×10×3、眼高 ~1.6）。正式幾何由 WP-6 drill config 以 **canonical CS unit (u)**
 * 定義（CONTEXT.md §C 正規單位：sim/資料一律 u/s，render 可另套 display scale）。
 * 此處的數字不得流入 sim 或匯出資料。
 */

export interface SceneManagerOptions {
  /** [width(X), depth(Z), height(Y)]，預設 [10, 10, 3]（佔位，OQ-1.2）。 */
  roomSize?: [number, number, number];
  /** 玩家眼高（camera Y），預設 1.6（佔位）。 */
  eyeHeight?: number;
  /** 垂直 FOV（度），預設 75；T5 設定面板可即時改。 */
  fovDeg?: number;
}

const FLOOR_COLOR = 0x33373c;
const WALL_COLOR = 0x4d545c;
const BACKGROUND_COLOR = 0x202428;

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  constructor(opts: SceneManagerOptions = {}) {
    const [width, depth, height] = opts.roomSize ?? [10, 10, 3];
    const eyeHeight = opts.eyeHeight ?? 1.6;
    const fovDeg = opts.fovDeg ?? 75;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND_COLOR);

    this.#buildRoom(width, depth, height);
    this.#buildLights(width, depth, height);

    // camera 立於房間一端、踩中軸，朝 -Z 望向對牆與中軸（FR-1.1）。
    // T4 的 CameraController 之後接管 yaw/pitch；此 lookAt 為 yaw=pitch=0 的基準朝向。
    // aspect 先給 1，由 main 在 resize() 帶入真實視窗比例。
    this.camera = new THREE.PerspectiveCamera(fovDeg, 1, 0.1, 1000);
    const standoff = 1; // 與背牆保持距離，避免 camera 卡進牆面
    this.camera.position.set(0, eyeHeight, depth / 2 - standoff);
    this.camera.lookAt(0, eyeHeight, -depth / 2);
  }

  /** 視窗縮放時更新 camera aspect（renderer.setSize 由 main 持有）。 */
  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  #buildRoom(width: number, depth: number, height: number): void {
    const hw = width / 2;
    const hd = depth / 2;

    // 地板：平面鋪在 XZ（y=0），法線朝 +Y。
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // 四牆：PlaneGeometry 預設法線 +Z，以 rotation.y 轉到「朝房間內側」(FrontSide
    // 即可從室內看見且被正確打光)。牆高 = height。
    const wallMat = new THREE.MeshStandardMaterial({
      color: WALL_COLOR,
      roughness: 0.9,
    });
    // [planeWidth, x, z, rotY]
    const walls: ReadonlyArray<[number, number, number, number]> = [
      [width, 0, -hd, 0], // 北牆，法線 +Z（朝中心）
      [width, 0, hd, Math.PI], // 南牆，法線 -Z
      [depth, -hw, 0, Math.PI / 2], // 西牆，法線 +X
      [depth, hw, 0, -Math.PI / 2], // 東牆，法線 -X
    ];
    for (const [planeWidth, x, z, rotY] of walls) {
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(planeWidth, height),
        wallMat,
      );
      wall.position.set(x, height / 2, z);
      wall.rotation.y = rotY;
      this.scene.add(wall);
    }
  }

  #buildLights(width: number, depth: number, height: number): void {
    // 環境光保證無面全黑；方向光給地板與各牆不同明暗，肉眼可分辨表面（DoD）。
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(width * 0.3, height * 1.5, depth * 0.25);
    this.scene.add(dir);
  }
}
