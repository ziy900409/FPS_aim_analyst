# T2 — ADS muzzle(槍口移置準心下方;heldAds 階躍切換)

> Part of [WP-27 muzzle-tracer](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | **T1** ✅ + **OQ-MT-2** ✅(2026-08-03 完成 FHD/QHD 實測並回填) |
| **Risk / Cplx** | Low-Med / Low |
| **Touches** | MODIFY `src/render/muzzleOffset.ts`(ads 數值回填)、`src/loop/SimLoop.ts`(兩處產彈點的 `ads` 引數)、`tests/regression/muzzle-tracer-invariants.test.ts`(ADS 案) |
| **狀態** | ✅ 完成(2026-08-03):`heldAds` 階躍接線 + OQ-MT-2 實測值 + FHD/QHD 截圖 |

## Objective

開鏡時把 tracer 起點自「右手位」移到**準心下方**(FR-MT3):開火 tick 讀 `state.heldAds`
選 hip / ads 偏移向量,**階躍**切換(C-7);`SIM_HZ`、命中幾何、彈道語意、記錄面全部不動(C-5 / GD-16)。

## In scope

- **`SimLoop` 兩處產彈點**:T1 恆傳 `false` 的 `ads` 引數改為 `state.heldAds`
  (hitscan 分支 + `spawnProjectile` 路徑各一)。`state.heldAds` 已由 `applyInput`
  [:83-88](../../../../src/loop/SimLoop.ts#L83-L88) 維護(WP-24 T1),**零新接線**。
- **`muzzleOffset.ts`**:`DEFAULT_MUZZLE_OFFSETS.ads` 由佔位值 `{rightU 0, upU −0.08, forwardU 0.60}`
  回填為 OQ-MT-2 實測值 `{rightU 0, upU −0.065, forwardU 0.60}`;**介面不變**(數值與 code 解耦)。
- **階躍語意(C-7)**:不引入任何 hip↔ads 內插狀態。理由於檔頭註記:tracer origin 是
  capture-at-fire 的 sim 值,平滑內插必然是 render 幀狀態,兩者互斥;且與 GD-16「ADS gain 階躍」一致。
- **測試(`muzzle-tracer-invariants.test.ts` 增段)**:
  - 同一開火條件、`heldAds` 分別為 `true` / `false` → tracer origin **不同**,且各自逐位 ==
    `camPos + R·對應 offset`;
  - `heldAds` 切換**不改** raycast 原點 / `arena.ox/oy/oz` / `arena.x/y/z` / 命中結果 / fire 與 hit 事件內容(逐位);
  - 一次 drill 內 hip → ads → hip 切換,tracer origin 只呈現兩個離散值(**無中間內插值**);
  - ADS 態跨 FPS 決定性 fixture 逐位一致。

## Out of scope

- `CameraController` 的 FOV / gain 行為(WP-24 已交付,本 WP 不動);
- ADS 平滑內插(C-7 已排除);scope overlay;ads 進匯出(WP-24 已有,本 WP 不新增欄位)。

## OQ-MT-2 實測結果

### 方法

- 以 Edge + Playwright 操作實際 Vite 頁面,不是只用公式或單元測試推估。
- 固定 ADS vertical FOV = `40°`,進入 ADS 後等待 `180 ms`(大於 `120 ms` 視覺 transition),再取靜止狀態第一發。
- 固定 `rightU=0`、`forwardU=0.60`,只比較 `upU`;FHD 與 QHD 各量一次。
- 畫面上的理論垂直位移交叉檢查式:
  `downPx = |upU| / (2 × forwardU × tan(FOVv / 2)) × viewportHeight`。

### 原始候選數據

| `upU` | FHD(1080p) | QHD(1440p) | 畫面高度占比 | 判定 |
|---:|---:|---:|---:|---|
| `−0.055` | `136.00 px` | `181.33 px` | `12.59%` | 太靠近準心 |
| `−0.065` | `160.73 px` | `214.30 px` | `14.88%` | 採用;兩解析度均位於準心下方且保留 scope 下緣餘量 |
| `−0.080` | `197.82 px` | `263.76 px` | `18.32%` | QHD 已貼近/超過 scope 下緣 |

最終採用 `DEFAULT_MUZZLE_OFFSETS.ads = { rightU: 0, upU: −0.065, forwardU: 0.60 }`。
FHD 與 QHD 實際產生的 world origin 均為 `[0, 1.5350000000000001, 3.4]`,與
camera `[0, 1.6, 4]` 加上 ADS offset `[0, −0.065, −0.6]` 逐位一致。

### 最終截圖

- [FHD 1920×1080](t2-ads-balanced-fhd.png)
- [QHD 2560×1440](t2-ads-balanced-qhd.png)

## Steps

- [x] SimLoop 兩處 `ads` 引數接 `state.heldAds`。(2026-08-03)
- [x] `muzzle-tracer-invariants.test.ts` ADS 四項斷言綠(差異 / 不變性 / 無中間值 / 跨 FPS)。(2026-08-03)
- [x] **零破壞驗證**:`projectile-determinism.test.ts` 與命中/彈孔/事件既有測試零修改全綠。(2026-08-03)
- [x] export fixture diff 0 驗證。(2026-08-03)
- [x] `npx tsc --noEmit` 0 + `npm run test:ci` exit 0。(2026-08-03)
- [x] OQ-MT-2 量測值回填 `DEFAULT_MUZZLE_OFFSETS.ads`(量測方法與原始數據見本文件)。(2026-08-03)
- [x] 實機截圖:ADS 態槍口落準心下方(FHD/QHD 證據見本文件)。(2026-08-03)

## Definition of Done

1. `heldAds=true/false` 產生**不同** tracer origin,且兩者各自逐位 == `camPos + R·對應 offset`。
2. `heldAds` 切換**不改** raycast 原點 / `arena.o*` / `arena.x/y/z` / 命中結果 / fire 與 hit 事件(逐位斷言)。
3. hip → ads → hip 切換序列中 tracer origin 只出現兩個離散值(**無中間內插值**,C-7)。
4. ADS 決定性 fixture 跨 FPS 逐位一致;`projectile-determinism.test.ts` 零修改全綠。
5. export fixture diff = 0 bytes;`npx tsc --noEmit` 0;`npm run test:ci` exit 0。
6. `DEFAULT_MUZZLE_OFFSETS.ads` 為 **OQ-MT-2 實機量測值**(非佔位值),量測方法 + 原始數據記於本文件。
7. FHD/QHD 實機截圖佐證 ADS 槍口落準心下方。

## Verification Evidence

- OQ-MT-2 候選量測:`3` 組 offset × `2` 種解析度,共 `6/6` 成功;最終乾淨證據截圖 `2/2`。
- T2 targeted tests:`3` files / `19` tests passed。
- 最終 `npm run test:ci`:TypeScript `0` errors、Vitest `81` files / `640` tests passed、Playwright `18/18` passed。
- 首次完整 Playwright 執行有一筆既有 `input-sampler` 的 `__aimDebug` 啟動逾時;單測重跑通過,再跑完整套件亦 `18/18` 通過。
- export/schema 與 projectile-determinism fixture diff = `0`;命中、彈道及事件語意未變。
- `graphify update .`: `1227` nodes / `2950` edges / `72` communities。

## Commit

- `faa6e00 feat(wp-27): connect ADS muzzle origin to held state`
- `117c3d4 feat(wp-27): finalize T2 ADS muzzle calibration`

依工作檢查點拆成兩筆:第一筆完成 `heldAds` 階躍接線與 invariant tests;第二筆完成
OQ-MT-2 校正、FHD/QHD 證據、全套驗證與文件收尾。
