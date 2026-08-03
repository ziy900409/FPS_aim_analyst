# T2 — ADS muzzle(槍口移置準心下方;heldAds 階躍切換)

> Part of [WP-27 muzzle-tracer](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | **T1**(hip 路徑先綠)+ **OQ-MT-2**(ads 偏移量實機量測值;未回填可先以佔位值接線並綠,但 DoD ⑥ 需回填後才可勾) |
| **Risk / Cplx** | Low-Med / Low |
| **Touches** | MODIFY `src/render/muzzleOffset.ts`(ads 數值回填)、`src/loop/SimLoop.ts`(兩處產彈點的 `ads` 引數)、`tests/regression/muzzle-tracer-invariants.test.ts`(ADS 案) |
| **狀態** | ⬜ 未開始 |

## Objective

開鏡時把 tracer 起點自「右手位」移到**準心下方**(FR-MT3):開火 tick 讀 `state.heldAds`
選 hip / ads 偏移向量,**階躍**切換(C-7);`SIM_HZ`、命中幾何、彈道語意、記錄面全部不動(C-5 / GD-16)。

## In scope

- **`SimLoop` 兩處產彈點**:T1 恆傳 `false` 的 `ads` 引數改為 `state.heldAds`
  (hitscan 分支 + `spawnProjectile` 路徑各一)。`state.heldAds` 已由 `applyInput`
  [:83-88](../../../../src/loop/SimLoop.ts#L83-L88) 維護(WP-24 T1),**零新接線**。
- **`muzzleOffset.ts`**:`DEFAULT_MUZZLE_OFFSETS.ads` 由佔位值 `{rightU 0, upU −0.08, forwardU 0.60}`
  回填為 OQ-MT-2 的實機量測值;**介面不變**(數值與 code 解耦)。
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

## Steps

- [ ] SimLoop 兩處 `ads` 引數接 `state.heldAds`。
- [ ] `muzzle-tracer-invariants.test.ts` ADS 四項斷言綠(差異 / 不變性 / 無中間值 / 跨 FPS)。
- [ ] **零破壞驗證**:`projectile-determinism.test.ts` 與命中/彈孔/事件既有測試零修改全綠。
- [ ] export fixture diff 0 驗證。
- [ ] `npx tsc --noEmit` 0 + `npm run test:ci` exit 0。
- [ ] OQ-MT-2 量測值回填 `DEFAULT_MUZZLE_OFFSETS.ads`(量測方法與數據記 progress)。
- [ ] 實機截圖:ads 態槍口落準心下方(記 progress)。

## Definition of Done

1. `heldAds=true/false` 產生**不同** tracer origin,且兩者各自逐位 == `camPos + R·對應 offset`。
2. `heldAds` 切換**不改** raycast 原點 / `arena.o*` / `arena.x/y/z` / 命中結果 / fire 與 hit 事件(逐位斷言)。
3. hip → ads → hip 切換序列中 tracer origin 只出現兩個離散值(**無中間內插值**,C-7)。
4. ADS 決定性 fixture 跨 FPS 逐位一致;`projectile-determinism.test.ts` 零修改全綠。
5. export fixture diff = 0 bytes;`npx tsc --noEmit` 0;`npm run test:ci` exit 0。
6. `DEFAULT_MUZZLE_OFFSETS.ads` 為 **OQ-MT-2 實機量測值**(非佔位值),量測方法 + 原始數據記 progress。
7. 實機截圖佐證 ads 槍口落準心下方。

## Commit

`feat(wp-27): T2 ADS muzzle — heldAds 階躍切換槍口至準心下方(命中/彈道零改動)`
