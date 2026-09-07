/**
 * 玩家眼睛高度（source unit），相對 sim 原點正上方。
 *
 * WP-57 / T1：定義從 `src/scene/clearance.ts` 搬到 sim 側。它一直是**玩家**常數而非場景幾何，
 * 但放在 `src/scene` 讓 `src/sim` 無法取用——`architecture.test.ts` 的「`src/sim` 與 `src/state`
 * 不得 import `src/scene`」是 GD-6 的硬閘。`clearance.ts` 原地 re-export 同一個 binding，故所有
 * 既有 import 路徑與數值逐位不變，**眼高仍只有一個定義**（README §2.10）。
 *
 * 這不是 `SceneConfig.proceduralRoom.eyeHeight`：場景必須把 `eyeHeight` 設成同值並以測試釘死，
 * 但 sim 側永遠不讀場景（GD-6）。
 */
export const PLAYER_EYE_HEIGHT_U = 1.6;
