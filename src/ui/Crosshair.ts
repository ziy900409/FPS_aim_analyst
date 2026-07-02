/**
 * Crosshair — WP-4 / T4（FR-4.4）
 *
 * 純 TS + DOM overlay（D1，不引框架）：螢幕正中央的小十字準心，作為瞄準參考與
 * §5「準心對齊偏移」量測的視覺基準。第一人稱開火走 camera 中心射線（WP-5），
 * 故準心固定於螢幕中心即代表射線方向。
 *
 * 定位以 `left/top:50% + translate(-50%,-50%)` 取視窗中心 —— 與視窗尺寸無關，
 * 縮放不偏移。`pointer-events:none` 使點擊穿透到 canvas，不擋 Pointer Lock 取得。
 *
 * 唯讀視覺元件：不相依 sim / state，亦不接收輸入。可見性由外部 `setVisible` 控制。
 */

/** 準心臂長（px，中心點到臂端）。 */
const ARM = 6;
/** 準心線寬（px）。 */
const THICK = 2;
/** 中心留空（px，兩臂之間的 gap，露出目標中心）。 */
const GAP = 3;
const COLOR = '#7CFC00';

export interface CrosshairHandle {
  /** 顯示/隱藏準心。 */
  setVisible(visible: boolean): void;
  /** 移除 DOM 節點（測試/teardown）。 */
  dispose(): void;
}

export function createCrosshair(): CrosshairHandle {
  const root = document.createElement('div');
  root.id = 'crosshair';
  root.style.cssText = [
    'position:fixed',
    'left:50%',
    'top:50%',
    'transform:translate(-50%,-50%)',
    'pointer-events:none', // 點擊穿透到 canvas，不擋鎖定取得
    'user-select:none',
    'z-index:12', // 蓋在 settings-panel（11）之上，恆在畫面最上層
  ].join(';');

  // 四臂十字：中心 GAP 留空，各臂為一條實色細線。以絕對定位掛在 root 中心。
  root.append(
    makeArm('vertical', -(GAP + ARM)), // 上
    makeArm('vertical', GAP), // 下
    makeArm('horizontal', -(GAP + ARM)), // 左
    makeArm('horizontal', GAP), // 右
  );
  document.body.appendChild(root);

  return {
    setVisible(visible: boolean): void {
      root.style.display = visible ? 'block' : 'none';
    },
    dispose(): void {
      root.remove();
    },
  };
}

/** 建一條臂：垂直臂沿 y、水平臂沿 x 從中心偏移 `offset` px。 */
function makeArm(orientation: 'vertical' | 'horizontal', offset: number): HTMLElement {
  const arm = document.createElement('div');
  const vertical = orientation === 'vertical';
  arm.style.cssText = [
    'position:absolute',
    'left:0',
    'top:0',
    `width:${vertical ? THICK : ARM}px`,
    `height:${vertical ? ARM : THICK}px`,
    `background:${COLOR}`,
    // 以 translate 從 root 中心平移：垂直臂在 y 軸偏移、水平臂在 x 軸偏移；
    // 另一軸 -50% 使線條對齊中心軸線。
    vertical
      ? `transform:translate(-50%,${offset}px)`
      : `transform:translate(${offset}px,-50%)`,
  ].join(';');
  return arm;
}
