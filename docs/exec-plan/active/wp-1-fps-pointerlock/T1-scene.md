# T1 — SceneManager（room / floor / walls / light / camera）

> Part of [WP-1 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Low / Low |
| **Touches** | NEW `src/render/SceneManager.ts`；MODIFY `src/main.ts` |
| **Status** | ⬜ TODO |

## Objective
建出可見的封閉房間（地板、牆、光源）與 `PerspectiveCamera`，作為 WP-1 視角與 WP-4 目標的舞台（FR-1.1）。

## In scope
- `SceneManager`：建 `Scene`、地板 + 四牆（佔位尺寸 10×10×3 m，OQ-1.2）、環境光 + 方向光、`PerspectiveCamera`（玩家眼高 ~1.6 m）。
- `main.ts` 用 `SceneManager` + WP-0 `createRenderer`，每幀 render（暫用 rAF，WP-2 才換雙迴圈）。

## Out of scope
- 目標 / 準心（→ WP-4）；Pointer Lock（→ T2）；移動（→ WP-5）。

## Design notes
- camera 預設朝房間中軸；房間/眼高為常數，WP-6 drill config 可覆寫。
- 暫時 rAF render 一個靜態場景即可；不要在此引入 sim accumulator（WP-2 邊界）。

```ts
export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  constructor(opts?: { roomSize?: [number,number,number]; eyeHeight?: number; fovDeg?: number });
  resize(w: number, h: number): void;
}
```

## Steps
- [ ] 建 `src/render/SceneManager.ts`：地板/牆/光/camera。
- [ ] `main.ts` 串 `createRenderer` + `SceneManager`，rAF render；`resize` 處理視窗縮放。
- [ ] `npm run dev` → 可見封閉房間、可分辨地板與牆、console 無 error。
- [ ] `npx tsc --noEmit` 乾淨。

## Definition of Done
- [ ] 封閉房間可見（地板 + 牆 + 光照）。
- [ ] resize 正常；`tsc` 乾淨。

## Commit
`feat(wp-1): SceneManager 封閉房間 + camera（FR-1.1）`
