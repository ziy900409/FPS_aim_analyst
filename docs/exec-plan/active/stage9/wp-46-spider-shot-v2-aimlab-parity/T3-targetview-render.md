# T3 — `TargetView.setShape()` + `main.ts` 接線

> Part of [WP-46](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 |
| **Risk / Cplx** | Low / Low(純渲染,不影響判定/資料;檔案與 T2 不重疊,可與 T2 並行) |
| **Touches** | MODIFY `src/render/TargetView.ts`、`src/main.ts`、`src/render/TargetView.test.ts` |
| **狀態** | ⬜ |

## Objective

`TargetView` 新增 `setShape(shape: 'box' \| 'sphere')`:換掉共用 geometry(disposal 舊的、建立新的),並把既有 pool 內每個 mesh 的 `geometry` 參照就地換成新的(不重建/不銷毀 mesh 本身,保留 pool 重用紀律)。`main.ts` 在載入 drill 時依 `config.targets.hitbox?.shape ?? 'box'` 呼叫。

## Steps

- [ ] `TargetView` 建構子邏輯抽出「建立 box geometry」為私有方法(供 constructor 與 `setShape('box')` 共用)。
- [ ] 新增 `#createGeometry(shape)`:`'box'` → `new THREE.BoxGeometry(1,1,1)`;`'sphere'` → `new THREE.SphereGeometry(0.5, 24, 16)`(半徑 0.5,配合既有 `mesh.scale.set(hitbox.width, height, depth)` 的縮放慣例——sphere 因三軸強制相等,縮放後仍是正圓球)。
- [ ] 新增公開方法 `setShape(shape: 'box' | 'sphere'): void`:若與目前形狀相同則 no-op(避免重複 dispose/建立);否則 `this.#geometry.dispose()`,`this.#geometry = this.#createGeometry(shape)`,遍歷 `this.#pool` 把每個既有 mesh 的 `mesh.geometry = this.#geometry`。
- [ ] `main.ts`:找到目前載入 drill(`loadDrillById`/初始化路徑)呼叫 `targetView` 的地方,新增 `targetView.setShape(config.targets.hitbox?.shape ?? 'box')`(初始載入與 drill 切換都要呼叫到)。
- [ ] 新增 `TargetView.test.ts` 測試:①`setShape('sphere')` 後,`sync()` 顯示的 mesh 之 `geometry` 為 `SphereGeometry` 實例;②先 `sync()` 建立過 pool mesh 後再 `setShape('sphere')`,原本的 mesh 物件(比對 identity,非新建)其 `geometry` 也已換成新的;③連續呼叫 `setShape('box')` 兩次(同形狀)不拋錯、不重複 dispose(可用 spy 驗證 dispose 只呼叫一次或行為冪等)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `setShape('sphere')` 後新 spawn 的目標渲染為球體 geometry | 新測試 |
| ② | 既有 pool mesh(非新建)換形狀後 geometry 參照同步更新 | 新測試 |
| ③ | 同形狀重複呼叫冪等、不洩漏 GPU 資源(舊 geometry 確實 dispose) | 新測試 |
| ④ | `main.ts` 載入/切換 drill 時正確呼叫 `setShape` | code review + 手動或 e2e 確認 spider-shot-v2 載入後外觀為球體 |
| ⑤ | `npx tsc --noEmit` 全專案綠 | 執行確認 |

## Commit

`feat(wp-46): T3 — TargetView 新增 setShape() 球體渲染切換 + main.ts 接線`
